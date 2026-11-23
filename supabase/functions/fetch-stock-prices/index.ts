import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MARKETSTACK_URL = "https://api.marketstack.com/v1/eod";
const BASE_STOCK = "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService";
const BASE_PRODUCT = "https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService";
// 💡 공공데이터포털 공식 최신 V2 엔드포인트 적용
const BASE_GENERAL_V2 = "https://apis.data.go.kr/1160100/GetGeneralProductInfoService_V2";

// KRX 금현물 대표 종목코드 (금 99.99% 1kg: 04020000, 미니금 100g: 04020100)
const GOLD_SPOT_CODES = ["04020000", "04020100"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const PUB_KEY = Deno.env.get("PUBLIC_DATA_SERVICE_KEY");
    
    const MS_KEYS = [
      Deno.env.get("MARKETSTACK_API_KEY"),
      Deno.env.get("MARKETSTACK_API_KEY_1"),
      Deno.env.get("MARKETSTACK_API_KEY_2"),
      Deno.env.get("MARKETSTACK_API_KEY_3"),
      Deno.env.get("MARKETSTACK_API_KEY_4"),
      Deno.env.get("MARKETSTACK_API_KEY_5")
    ].filter(Boolean) as string[];

    const url = new URL(req.url);
    const requestType = url.searchParams.get("type")?.toUpperCase(); 
    // 💡 수집 기간(일수) 또는 특정 일자 파라미터 지원 (기본 3일치 수집)
    const daysParam = parseInt(url.searchParams.get("days") || "3", 10);
    const targetDateParam = url.searchParams.get("date"); // YYYY-MM-DD 특정일자
    
    const { data: securities } = await supabase.from("security").select("*");
    if (!securities) throw new Error("종목 리스트를 불러올 수 없습니다.");

    let krwDates = getPastDaysIncludingWeekends(daysParam).reverse(); 
    let usdDates = getPastDaysIncludingWeekends(daysParam).reverse();

    if (targetDateParam) {
      const singleDateObj = {
        dbFormatted: targetDateParam,
        krwApiYmd: targetDateParam,
        usdApiYmd: targetDateParam,
        isWeekend: false
      };
      krwDates = [singleDateObj];
      usdDates = [singleDateObj];
    }

    // --- [SECTION A: 해외 종목 수집 (1순위: 네이버 해외 API, 2순위: 야후 파이낸스, 3순위: MarketStack 백업)] ---
    if (!requestType || requestType !== "KRW") {
      const usdStocks = securities.filter(s => s.currency !== "KRW");
      if (usdStocks.length > 0) {
        console.log(`\n🌐 [해외] 종목 ${usdStocks.length}개 대상 최근 ${usdDates.length}일치 수집 시작 (1순위: 네이버 증권 API)...`);
        const naverSuccessIds = new Set<string>();

        // 1순위: 네이버페이 증권 해외 API (.K, .O, .N, .P, .A, 원형)
        const CHUNK_SIZE = 5;
        for (let i = 0; i < usdStocks.length; i += CHUNK_SIZE) {
          const chunk = usdStocks.slice(i, i + CHUNK_SIZE);

          await Promise.all(
            chunk.map(async (stock) => {
              const ticker = stock.code.trim().toUpperCase();
              const exCode = stock.exchange_code || "";
              try {
                const naverData = await fetchForeignFromNaver(ticker, exCode);
                if (naverData && (naverData.close > 0 || (naverData.history && naverData.history.length > 0))) {
                  naverSuccessIds.add(stock.security_id);

                  for (const dateObj of usdDates) {
                    const targetCompact = dateObj.usdApiYmd.replace(/-/g, "");

                    let matched = (naverData.history || []).find((h: any) => {
                      const hDt = String(h.localDate || "").replace(/-/g, "");
                      return hDt === targetCompact;
                    });

                    if (!matched && naverData.history && naverData.history.length > 0) {
                      const prevCandles = naverData.history
                        .filter((h: any) => String(h.localDate || "").replace(/-/g, "") <= targetCompact)
                        .sort((a: any, b: any) => String(a.localDate).localeCompare(String(b.localDate)));
                      if (prevCandles.length > 0) {
                        matched = prevCandles[prevCandles.length - 1];
                      }
                    }

                    const dayClose = matched ? parseFloat(String(matched.closePrice).replace(/,/g, "")) : naverData.close;
                    const dayOpen = matched ? parseFloat(String(matched.openPrice || dayClose).replace(/,/g, "")) : naverData.open;
                    const dayHigh = matched ? parseFloat(String(matched.highPrice || dayClose).replace(/,/g, "")) : naverData.high;
                    const dayLow = matched ? parseFloat(String(matched.lowPrice || dayClose).replace(/,/g, "")) : naverData.low;
                    const dayVol = matched ? Number(matched.accumulatedTradingVolume || 0) : naverData.volume;

                    if (dayClose > 0) {
                      await supabase.from("stock_prices").upsert({
                        security_id: stock.security_id,
                        price_date: dateObj.usdApiYmd,
                        close_price: dayClose,
                        open_price: dayOpen || 0,
                        high_price: dayHigh || 0,
                        low_price: dayLow || 0,
                        volume: dateObj.isWeekend ? 0 : (dayVol || 0),
                        currency: stock.currency,
                        updated_at: new Date().toISOString()
                      }, { onConflict: "security_id,price_date" });

                      console.log(`✅ [해외/네이버] ${ticker.padEnd(6)} (${naverData.reutersCode}) | ${dateObj.usdApiYmd} | 종가: ${dayClose.toString().padStart(8)}`);
                    }
                  }
                }
              } catch (err: any) {
                console.warn(`⚠️ [해외/네이버 실패] ${ticker}:`, err.message);
              }
            })
          );
        }

        // 2순위: 네이버 미조회 종목에 대해 야후 파이낸스 차트 API로 보완 수집 (키 불필요, 100% 무료 커버)
        const failedNaverStocks = usdStocks.filter(s => !naverSuccessIds.has(s.security_id));
        const yahooSuccessIds = new Set<string>();

        if (failedNaverStocks.length > 0) {
          console.log(`\n🌐 [해외/야후] 네이버 미조회 ${failedNaverStocks.length}개 종목 -> 야후 파이낸스로 보완 수집...`);
          await Promise.all(
            failedNaverStocks.map(async (stock) => {
              const ticker = stock.code.trim().toUpperCase();
              try {
                const yahooData = await fetchForeignFromYahoo(ticker);
                if (yahooData && (yahooData.close > 0 || (yahooData.history && yahooData.history.length > 0))) {
                  yahooSuccessIds.add(stock.security_id);

                  for (const dateObj of usdDates) {
                    const targetCompact = dateObj.usdApiYmd.replace(/-/g, "");
                    let matched = (yahooData.history || []).find((h: any) => h.localDate === targetCompact);

                    if (!matched && yahooData.history && yahooData.history.length > 0) {
                      const prevCandles = yahooData.history
                        .filter((h: any) => h.localDate <= targetCompact)
                        .sort((a: any, b: any) => a.localDate.localeCompare(b.localDate));
                      if (prevCandles.length > 0) {
                        matched = prevCandles[prevCandles.length - 1];
                      }
                    }

                    const dayClose = matched ? matched.close : yahooData.close;
                    const dayOpen = matched ? matched.open : yahooData.open;
                    const dayHigh = matched ? matched.high : yahooData.high;
                    const dayLow = matched ? matched.low : yahooData.low;
                    const dayVol = matched ? matched.volume : yahooData.volume;

                    if (dayClose > 0) {
                      await supabase.from("stock_prices").upsert({
                        security_id: stock.security_id,
                        price_date: dateObj.usdApiYmd,
                        close_price: dayClose,
                        open_price: dayOpen || 0,
                        high_price: dayHigh || 0,
                        low_price: dayLow || 0,
                        volume: dateObj.isWeekend ? 0 : (dayVol || 0),
                        currency: stock.currency,
                        updated_at: new Date().toISOString()
                      }, { onConflict: "security_id,price_date" });

                      console.log(`✅ [해외/야후] ${ticker.padEnd(6)} | ${dateObj.usdApiYmd} | 종가: ${dayClose.toString().padStart(8)}`);
                    }
                  }
                }
              } catch (err: any) {
                console.warn(`⚠️ [해외/야후 실패] ${ticker}:`, err.message);
              }
            })
          );
        }

        // 3순위: 네이버와 야후 모두 실패한 종목에 한해 MarketStack 최종 백업 호출
        const finalFailedStocks = failedNaverStocks.filter(s => !yahooSuccessIds.has(s.security_id));
        if (finalFailedStocks.length > 0) {
          if (MS_KEYS.length > 0) {
            console.log(`\n⚠️ [해외/MarketStack 백업] 최종 미조회 종목 ${finalFailedStocks.length}개 대상 최근 ${usdDates.length}일치 전환 시도...`);
            const failedTickers = finalFailedStocks.map(s => s.code.trim().toUpperCase());

            for (const dateObj of usdDates) {
              const bulkData = await fetchBulkWithSwitching(failedTickers, dateObj.usdApiYmd, MS_KEYS);
              const lastSuccessMap = new Map();

              if (bulkData && bulkData.length > 0) {
                for (const item of bulkData) {
                  if (item.close && item.close > 0) lastSuccessMap.set(item.symbol, item);
                }
              }

              for (const stock of finalFailedStocks) {
                const ticker = stock.code.trim().toUpperCase();
                const apiData = (bulkData || []).find((d: any) => d.symbol === ticker);
                const finalData = apiData || lastSuccessMap.get(ticker);

                if (finalData) {
                  await supabase.from("stock_prices").upsert({
                    security_id: stock.security_id,
                    price_date: dateObj.usdApiYmd,
                    close_price: finalData.close,
                    open_price: finalData.open || 0,
                    high_price: finalData.high || 0,
                    low_price: finalData.low || 0,
                    volume: (dateObj.isWeekend || !apiData) ? 0 : (finalData.volume || 0),
                    currency: stock.currency,
                    updated_at: new Date().toISOString()
                  }, { onConflict: "security_id,price_date" });

                  const icon = !apiData ? "📋" : "✅";
                  console.log(`${icon} [해외/MarketStack] ${ticker.padEnd(6)} | ${dateObj.usdApiYmd} | 종가: ${finalData.close.toString().padStart(8)}`);
                }
              }
            }
          } else {
            console.log(`ℹ️ [해외] 미조회 종목 ${finalFailedStocks.length}개가 있으나 MarketStack 키가 없어 건너뜁니다.`);
          }
        }
      }
    }

    // --- [SECTION B: 국내 종목 및 금현물 수집] ---
    if (!requestType || requestType === "KRW") {
      const krwStocks = securities.filter(s => s.currency === "KRW");
      const beginBasDt = krwDates[0].krwApiYmd.replace(/-/g, "");
      console.log(`\n🇰🇷 [국내/금현물] 최근 ${krwDates.length}일치 데이터 수집 시작 (시작일: ${beginBasDt})...`);

      const CHUNK_SIZE = 5;
      for (let i = 0; i < krwStocks.length; i += CHUNK_SIZE) {
        const chunk = krwStocks.slice(i, i + CHUNK_SIZE);

        await Promise.all(
          chunk.map(async (stock) => {
            const cleanCode = stock.code.trim();
            const upperCode = cleanCode.toUpperCase();
            const name = stock.name || "";

            // 💡 다양한 종목코드('GOLD', '04020000' 등) 및 이름('금현물') 판별 강화
            const isGoldSpot =
              GOLD_SPOT_CODES.includes(cleanCode) ||
              upperCode === "GOLD" ||
              upperCode === "KRX_GOLD" ||
              name.includes("금현물") ||
              (stock.sector === "원자재" && name.includes("금")) ||
              stock.exchange_code === "OTHER" ||
              stock.market_type === "OTHER" ||
              stock.type?.toUpperCase() === "GOLD" ||
              stock.asset_type?.toUpperCase() === "GOLD";

            let priceList: any[] = [];

            if (isGoldSpot) {
              // 1. KRX 금현물 전용 API 호출 (V2 엔드포인트 + 코드 자동 매핑)
              priceList = await fetchGoldPriceFromPublic(PUB_KEY!, beginBasDt, cleanCode);
            } else {
              // 2. 일반 주식 조회
              priceList = await fetchFromPublic(`${BASE_STOCK}/getStockPriceInfo`, PUB_KEY!, beginBasDt, cleanCode);

              // 3. 없으면 ETF / ETN / ELW 순으로 조회
              if (priceList.length === 0) {
                for (const apiName of ["getETFPriceInfo", "getETNPriceInfo", "getELWPriceInfo"]) {
                  priceList = await fetchFromPublic(`${BASE_PRODUCT}/${apiName}`, PUB_KEY!, beginBasDt, cleanCode);
                  if (priceList.length > 0) break;
                }
              }

              // 4. 그래도 없으면 혹시 미분류 금현물일 수 있으므로 금현물 폴백 조회
              if (priceList.length === 0) {
                priceList = await fetchGoldPriceFromPublic(PUB_KEY!, beginBasDt, cleanCode);
              }
            }

            if (priceList.length > 0) {
              const rowsToUpsert = priceList.map((item) => ({
                security_id: stock.security_id,
                price_date: item.date,
                close_price: Math.round(item.close),
                open_price: Math.round(item.open),
                high_price: Math.round(item.high),
                low_price: Math.round(item.low),
                volume: Math.round(item.volume),
                currency: "KRW",
                updated_at: new Date().toISOString()
              }));

              await supabase.from("stock_prices").upsert(rowsToUpsert, { onConflict: "security_id,price_date" });

              const label = isGoldSpot ? "[금현물]" : "[국내]";
              for (const row of rowsToUpsert) {
                console.log(`✅ ${label} ${stock.name.padEnd(10)} | ${row.price_date} | 종가: ${row.close_price.toLocaleString().padStart(8)}`);
              }
            }
          })
        );
      }
    }

    // --- [SECTION C: 보완 로직] ---
    console.log(`\n🔍 [보완] 점검 시작...`);
    await runOptimizedPatch(supabase, securities);
    
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("🚨 에러:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

/** --- [Helper Functions] --- **/

// 💡 1순위: 해외 종목 네이버 증권 차트 및 시세 조회 (.K, .O, .N, .P, .A, 원형)
async function fetchForeignFromNaver(ticker: string, exchangeCode?: string) {
  const cleanTicker = ticker.trim().toUpperCase();
  const baseTicker = cleanTicker.replace(/\.(O|N|P|K|A|Z|AMS)$/i, "");
  const ex = (exchangeCode || "").trim().toUpperCase();

  const candidateCodes: string[] = [];

  // 거래소별 맞춤형 우선순위
  if (ex === "PCX") {
    // 💡 PCX (NYSE Arca): 네이버는 .K(ETF 전용) 또는 .O, .P
    candidateCodes.push(`${baseTicker}.K`, `${baseTicker}.O`, `${baseTicker}.P`, `${baseTicker}.N`, baseTicker);
  } else if (ex === "BTS" || ex === "BATS" || ex === "BZX") {
    candidateCodes.push(`${baseTicker}.K`, `${baseTicker}.Z`, `${baseTicker}.P`, `${baseTicker}.O`, baseTicker);
  } else if (ex === "NYQ" || ex === "NYSE") {
    candidateCodes.push(`${baseTicker}.N`, `${baseTicker}.K`, `${baseTicker}.P`, baseTicker);
  } else if (ex === "NMS" || ex === "NGM" || ex === "NCM" || ex === "NASDAQ") {
    candidateCodes.push(`${baseTicker}.O`, `${baseTicker}.K`, `${baseTicker}.P`, baseTicker);
  } else {
    candidateCodes.push(`${baseTicker}.K`, `${baseTicker}.O`, `${baseTicker}.N`, `${baseTicker}.P`, `${baseTicker}.A`, baseTicker);
  }

  // 중복 제거
  const uniqueCodes = Array.from(new Set(candidateCodes));

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*"
  };

  for (const code of uniqueCodes) {
    // 1. 차트 API (stockExchangeType 파라미터 제외하고 호출하여 호환성 극대화)
    try {
      const chartUrl = `https://api.stock.naver.com/chart/foreign/item/${code}?periodType=dayCandle`;
      const res = await fetch(chartUrl, { headers });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          const latest = list[list.length - 1];
          const close = parseFloat(String(latest.closePrice || "0").replace(/,/g, ""));
          if (close > 0) {
            return {
              symbol: cleanTicker,
              reutersCode: code,
              close,
              open: parseFloat(String(latest.openPrice || close).replace(/,/g, "")),
              high: parseFloat(String(latest.highPrice || close).replace(/,/g, "")),
              low: parseFloat(String(latest.lowPrice || close).replace(/,/g, "")),
              volume: Number(latest.accumulatedTradingVolume || 0),
              history: list
            };
          }
        }
      }
    } catch {
      // 다음 시도
    }

    // 2. 기본 시세 basic API (당일 최신 시세 백업)
    try {
      const basicUrl = `https://api.stock.naver.com/stock/${code}/basic`;
      const res = await fetch(basicUrl, { headers });
      if (res.ok) {
        const data = await res.json();
        const rawClose = data?.closePrice || data?.now;
        const close = parseFloat(String(rawClose || "0").replace(/,/g, ""));
        if (close > 0) {
          const rawDt = String(data?.localDate || "");
          return {
            symbol: cleanTicker,
            reutersCode: code,
            close,
            open: parseFloat(String(data?.openPrice || close).replace(/,/g, "")),
            high: parseFloat(String(data?.highPrice || close).replace(/,/g, "")),
            low: parseFloat(String(data?.lowPrice || close).replace(/,/g, "")),
            volume: Number(data?.accumulatedTradingVolume || 0),
            history: [{
              localDate: rawDt.replace(/-/g, ""),
              closePrice: close,
              openPrice: parseFloat(String(data?.openPrice || close).replace(/,/g, "")),
              highPrice: parseFloat(String(data?.highPrice || close).replace(/,/g, "")),
              lowPrice: parseFloat(String(data?.lowPrice || close).replace(/,/g, "")),
              accumulatedTradingVolume: Number(data?.accumulatedTradingVolume || 0)
            }]
          };
        }
      }
    } catch {
      // 계속 시도
    }
  }

  return null;
}

// 💡 2순위: 야후 파이낸스 차트 API (키 불필요, 100% 무료, 모든 미국 종목/ETF 완벽 지원)
async function fetchForeignFromYahoo(ticker: string) {
  try {
    const cleanTicker = ticker.trim().toUpperCase();
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanTicker}?range=10d&interval=1d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const closes = quote.close || [];
    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const volumes = quote.volume || [];

    const history: any[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const close = closes[i];
      if (!ts || close == null) continue;
      const d = new Date(ts * 1000);
      const dateStr = formatDateToISO(d);
      history.push({
        date: dateStr,
        localDate: dateStr.replace(/-/g, ""),
        close: Number(close),
        open: Number(opens[i] || close),
        high: Number(highs[i] || close),
        low: Number(lows[i] || close),
        volume: Number(volumes[i] || 0)
      });
    }

    if (history.length === 0) return null;
    const latest = history[history.length - 1];

    return {
      symbol: cleanTicker,
      close: latest.close,
      open: latest.open,
      high: latest.high,
      low: latest.low,
      volume: latest.volume,
      history
    };
  } catch (err: any) {
    console.warn(`[야후 파이낸스 오류] ${ticker}:`, err.message);
    return null;
  }
}

// 💡 금현물 전용 시세 조회 함수 (V2 API + 'GOLD' 코드 대응)
async function fetchGoldPriceFromPublic(key: string, beginYmd: string, code: string) {
  try {
    const targetCode = (code === "04020100" || code.includes("100g")) ? "04020100" : "04020000";
    const url = `${BASE_GENERAL_V2}/getGoldPriceInfo_V2?serviceKey=${key}&resultType=json&beginBasDt=${beginYmd}&numOfRows=100`;
    
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    const data = await res.json();
    const item = data.response?.body?.items?.item;
    const list = Array.isArray(item) ? item : (item ? [item] : []);

    return list
      .filter((i: any) => {
        const srtnCd = String(i.srtnCd || "");
        const itmsNm = String(i.itmsNm || "");
        if (targetCode === "04020100") {
          return srtnCd === "04020100" || itmsNm.includes("100g");
        }
        return srtnCd === "04020000" || itmsNm.includes("1Kg") || itmsNm.includes("1kg");
      })
      .map((i: any) => {
        const rawDt = String(i.basDt);
        return {
          date: `${rawDt.slice(0, 4)}-${rawDt.slice(4, 6)}-${rawDt.slice(6, 8)}`,
          close: Number(i.clpr), // 1g당 원화 시세
          open: Number(i.mkp || i.clpr),
          high: Number(i.hipr || i.clpr),
          low: Number(i.lopr || i.clpr),
          volume: Number(i.trqu || 0)
        };
      });
  } catch (err) {
    console.error("[금현물 조회 오류]", err);
    return [];
  }
}

async function fetchBulkWithSwitching(tickers: string[], date: string, keys: string[]) {
  console.log(`📡 [해외 통신] ${date}자 데이터 요청 중...`);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const suffix = key.slice(-4);
    try {
      const url = `${MARKETSTACK_URL}?access_key=${key}&symbols=${tickers.join(',')}&date_from=${date}&date_to=${date}&limit=100`;
      const res = await fetch(url);
      const result = await res.json();
      if (!result.error && result.data) {
        console.log(`✨ [키 적중] ${i + 1}번 키(*${suffix}) 성공`);
        return result.data;
      }
      console.log(`❌ [키 패스] ${i + 1}번 키(*${suffix}) 실패: ${result.error?.code || 'Unknown'}`);
    } catch { continue; }
  }
  return [];
}

async function runOptimizedPatch(supabase: any, securities: any[]) {
  const kstToday = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
  const start = new Date(kstToday); start.setDate(kstToday.getDate() - 10);
  const end = new Date(kstToday); end.setDate(kstToday.getDate() - 2);
  const fillRange = getDatesInRange(start, end);

  for (const stock of securities) {
    const { data: existing } = await supabase
      .from("stock_prices")
      .select("price_date, close_price")
      .eq("security_id", stock.security_id)
      .gte("price_date", formatDateToISO(start))
      .lte("price_date", formatDateToISO(end));

    const priceMap = new Map(existing?.map((p: any) => [p.price_date, p.close_price]));

    for (const dateStr of fillRange) {
      if (priceMap.has(dateStr) && (priceMap.get(dateStr) || 0) > 0) continue;
      const { data: last } = await supabase
        .from("stock_prices")
        .select("*")
        .eq("security_id", stock.security_id)
        .lt("price_date", dateStr)
        .gt("close_price", 0)
        .order("price_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (last) {
        await supabase.from("stock_prices").upsert({
          security_id: stock.security_id, price_date: dateStr, 
          close_price: last.close_price, open_price: last.open_price,
          high_price: last.high_price, low_price: last.low_price,
          volume: 0, currency: stock.currency, updated_at: new Date().toISOString()
        }, { onConflict: "security_id,price_date" });
      }
    }
    await new Promise(r => setTimeout(r, 20));
  }
  console.log(`✅ [보완] 완료`);
}

function getPastDaysIncludingWeekends(count: number) {
  const days = [];
  const kst = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
  const today = new Date(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
  for (let i = 0; i < count; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const dow = d.getDay();
    let krw = new Date(d);
    if (dow === 0) krw.setDate(d.getDate() - 2); else if (dow === 6) krw.setDate(d.getDate() - 1);
    let usd = new Date(d);
    if (dow === 0) usd.setDate(d.getDate() - 2); else if (dow === 1) usd.setDate(d.getDate() - 3); else usd.setDate(d.getDate() - 1);
    days.push({ dbFormatted: formatDateToISO(d), krwApiYmd: formatDateToISO(krw), usdApiYmd: formatDateToISO(usd), isWeekend: (dow === 0 || dow === 6) });
  }
  return days;
}

function getDatesInRange(s: Date, e: Date) {
  const dates = []; let c = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  while (c <= e) { dates.push(formatDateToISO(c)); c.setDate(c.getDate() + 1); }
  return dates;
}

function formatDateToISO(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

// 일반 국내 주식 / ETF 전용
async function fetchFromPublic(apiUrl: string, key: string, beginYmd: string, code: string) {
  try {
    const url = `${apiUrl}?serviceKey=${key}&resultType=json&beginBasDt=${beginYmd}&likeSrtnCd=${code}&numOfRows=100`;
    const res = await fetch(url);
    const data = await res.json();
    const item = data.response?.body?.items?.item;
    const list = Array.isArray(item) ? item : (item ? [item] : []);
    return list
      .filter((i: any) => i.srtnCd === code)
      .map((i: any) => {
        const rawDt = String(i.basDt);
        return {
          date: `${rawDt.slice(0, 4)}-${rawDt.slice(4, 6)}-${rawDt.slice(6, 8)}`,
          close: Number(i.clpr),
          open: Number(i.mkp || i.basPrc),
          high: Number(i.hipr),
          low: Number(i.lopr),
          volume: Number(i.trqu)
        };
      });
  } catch { return []; }
}