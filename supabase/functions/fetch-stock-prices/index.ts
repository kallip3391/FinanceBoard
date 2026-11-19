import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MARKETSTACK_URL = "https://api.marketstack.com/v1/eod";
const BASE_STOCK = "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService";
const BASE_PRODUCT = "https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService";
// 💡 [수정 1] 공공데이터포털 공식 최신 V2 엔드포인트 적용
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

    // --- [SECTION A: 해외 종목 수집 (1순위: 네이버 해외 차트 API, 2순위: MarketStack 백업)] ---
    if (!requestType || requestType !== "KRW") {
      const usdStocks = securities.filter(s => s.currency !== "KRW");
      if (usdStocks.length > 0) {
        console.log(`\n🌐 [해외] 종목 ${usdStocks.length}개 대상 최근 ${usdDates.length}일치 수집 시작 (1순위: 네이버 해외 차트/시세 API)...`);
        const naverSuccessIds = new Set<string>();

        // 1순위: 네이버페이 증권 해외 API (5개씩 묶어 병렬 처리)
        const CHUNK_SIZE = 5;
        for (let i = 0; i < usdStocks.length; i += CHUNK_SIZE) {
          const chunk = usdStocks.slice(i, i + CHUNK_SIZE);

          await Promise.all(
            chunk.map(async (stock) => {
              const ticker = stock.code.trim().toUpperCase();
              try {
                const naverData = await fetchForeignFromNaver(ticker);
                if (naverData && (naverData.close > 0 || (naverData.history && naverData.history.length > 0))) {
                  naverSuccessIds.add(stock.security_id);

                  // 요청된 각 일자별로 실제 과거 일봉 데이터 매칭 및 DB 저장
                  for (const dateObj of usdDates) {
                    const targetCompact = dateObj.usdApiYmd.replace(/-/g, "");

                    // 1) 히스토리에서 해당 일자와 정확히 일치하는 일봉 데이터 탐색
                    let matched = (naverData.history || []).find((h: any) => {
                      const hDt = String(h.localDate || "").replace(/-/g, "");
                      return hDt === targetCompact;
                    });

                    // 2) 주말/휴일 등으로 당일 데이터가 없는 경우, 해당 일자 직전 영업일 일봉 매칭
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

                      console.log(`✅ [해외/네이버] ${ticker.padEnd(6)} | ${dateObj.usdApiYmd} | 종가: ${dayClose.toString().padStart(8)}`);
                    }
                  }
                }
              } catch (err: any) {
                console.warn(`⚠️ [해외/네이버 실패] ${ticker}:`, err.message);
              }
            })
          );
        }

        // 2순위: 네이버에서 조회되지 않은 종목에 한해 MarketStack 백업 호출
        const failedStocks = usdStocks.filter(s => !naverSuccessIds.has(s.security_id));
        if (failedStocks.length > 0) {
          if (MS_KEYS.length > 0) {
            console.log(`\n⚠️ [해외/MarketStack 백업] 네이버 실패 종목 ${failedStocks.length}개 대상 최근 ${usdDates.length}일치 전환 시도...`);
            const failedTickers = failedStocks.map(s => s.code.trim().toUpperCase());

            for (const dateObj of usdDates) {
              const bulkData = await fetchBulkWithSwitching(failedTickers, dateObj.usdApiYmd, MS_KEYS);
              const lastSuccessMap = new Map();

              if (bulkData && bulkData.length > 0) {
                for (const item of bulkData) {
                  if (item.close && item.close > 0) lastSuccessMap.set(item.symbol, item);
                }
              }

              for (const stock of failedStocks) {
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
            console.log(`ℹ️ [해외] 네이버 실패 종목 ${failedStocks.length}개가 있으나 MarketStack 키가 없어 건너뜁니다.`);
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

            // 💡 [수정 2] 다양한 종목코드('GOLD', '04020000' 등) 및 이름('금현물') 판별 강화
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

// 💡 [수정 4] 해외 종목 네이버페이 증권 차트 및 시세 조회 (과거 일봉 및 당일 종가 모두 지원)
async function fetchForeignFromNaver(ticker: string) {
  const cleanTicker = ticker.trim().toUpperCase();
  const baseTicker = cleanTicker.replace(/\.(O|N|A|AMS)$/i, "");
  
  // 후보 목록 구성 (나스닥, 뉴욕, 아멕스, 아멕스(AMS), 점 표기 대응)
  const candidates: { code: string; exchange: string }[] = [];

  if (baseTicker.includes(".") || baseTicker.includes("-")) {
    const rawNoPunct = baseTicker.replace(/[\.-]/g, "");
    const bVariant = baseTicker.replace(/[\.-]/g, "b");
    candidates.push({ code: `${bVariant}.N`, exchange: "NYSE" });
    candidates.push({ code: `${rawNoPunct}.N`, exchange: "NYSE" });
    candidates.push({ code: `${baseTicker}.N`, exchange: "NYSE" });
    candidates.push({ code: `${baseTicker}.O`, exchange: "NASDAQ" });
    candidates.push({ code: `${baseTicker}.A`, exchange: "AMEX" });
    candidates.push({ code: baseTicker, exchange: "" });
  } else {
    candidates.push({ code: `${baseTicker}.O`, exchange: "NASDAQ" });
    candidates.push({ code: `${baseTicker}.N`, exchange: "NYSE" });
    candidates.push({ code: `${baseTicker}.A`, exchange: "AMEX" });
    candidates.push({ code: `${baseTicker}.AMS`, exchange: "AMS" });
    candidates.push({ code: `${baseTicker}.A`, exchange: "AMS" });
    candidates.push({ code: `${baseTicker}.O`, exchange: "" });
    candidates.push({ code: `${baseTicker}.N`, exchange: "" });
    candidates.push({ code: baseTicker, exchange: "" });
  }

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*"
  };

  for (const { code, exchange } of candidates) {
    // 1. 차트 API (정확한 periodType=dayCandle 파라미터 적용)
    try {
      const exchangeQuery = exchange ? `&stockExchangeType=${exchange}` : "";
      const chartUrl = `https://api.stock.naver.com/chart/foreign/item/${code}?periodType=dayCandle${exchangeQuery}`;
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
      // 다음 후보 계속 시도
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

// 💡 [수정 3] 금현물 전용 시세 조회 함수 신설 (V2 API + 'GOLD' 코드 대응)
async function fetchGoldPriceFromPublic(key: string, beginYmd: string, code: string) {
  try {
    // 100g 미니금이 아닌 경우 기본 대표 종목 '04020000'(금 1Kg)으로 조회
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
        // 단축코드가 맞거나(04020000), 종목명이 1Kg인 항목 매칭
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
