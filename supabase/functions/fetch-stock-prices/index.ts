import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MARKETSTACK_URL = "http://api.marketstack.com/v1/eod";
const BASE_STOCK = "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService";
const BASE_PRODUCT = "https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const PUB_KEY = Deno.env.get("PUBLIC_DATA_SERVICE_KEY");
    const MS_KEY = Deno.env.get("MARKETSTACK_API_KEY");

    const url = new URL(req.url);
    const requestType = url.searchParams.get("type")?.toUpperCase(); 
    
    const { data: securities } = await supabase.from("security").select("*");
    if (!securities) throw new Error("종목 리스트를 불러올 수 없습니다.");

    // [Step 1] 최근 3일 수집용 날짜 (SECTION A, B 전용)
    const targetDates = getPastDaysIncludingWeekends(3);
    const reversedDates = [...targetDates].reverse();

    // --- [SECTION A: 해외 종목 수집 (기존 로직 보존)] ---
    if (!requestType || requestType !== "KRW") {
      const usdStocks = securities.filter(s => s.currency !== "KRW");
      if (usdStocks.length > 0 && MS_KEY) {
        console.log(`🌐 [해외] 최근 3일 스캔 시작...`);
        const tickers = usdStocks.map(s => s.code.trim().toUpperCase());
        const lastSuccessMap = new Map();

        for (const dateObj of reversedDates) {
          const bulkData = await fetchBulkFromMarketStack(tickers, dateObj.dbFormatted, MS_KEY);
          if (bulkData && bulkData.length > 0) {
            for (const item of bulkData) lastSuccessMap.set(item.symbol, item);
          }
          for (const stock of usdStocks) {
            const ticker = stock.code.trim().toUpperCase();
            const apiData = (bulkData || []).find(d => d.symbol === ticker);
            const finalData = apiData || lastSuccessMap.get(ticker);
            if (finalData) {
              await supabase.from("stock_prices").upsert({
                security_id: stock.security_id,
                price_date: dateObj.dbFormatted,
                close_price: finalData.close,
                open_price: finalData.open,
                high_price: finalData.high,
                low_price: finalData.low,
                volume: (dateObj.isWeekend || !apiData) ? 0 : finalData.volume,
                currency: stock.currency,
                updated_at: new Date().toISOString()
              }, { onConflict: "security_id,price_date" });
              const status = !apiData ? "📋 (복사저장)" : "✅ (저장완료)";
              console.log(`${status} [해외/ ${ticker}] ${dateObj.dbFormatted}: ${finalData.close}`);
            }
          }
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    // --- [SECTION B: 국내 종목 수집 (기존 로직 보존)] ---
    if (!requestType || requestType === "KRW") {
      const krwStocks = securities.filter(s => s.currency === "KRW");
      for (const stock of krwStocks) {
        console.log(`\n🇰🇷 [국내] ${stock.name} 수집 시작...`);
        let lastSuccessPrice: any = null;
        for (const dateObj of reversedDates) {
          let priceData = await fetchFromPublic(`${BASE_STOCK}/getStockPriceInfo`, PUB_KEY!, dateObj.apiYmd, stock.code);
          if (!priceData) {
            for (const apiName of ["getETFPriceInfo", "getETNPriceInfo", "getELWPriceInfo"]) {
              priceData = await fetchFromPublic(`${BASE_PRODUCT}/${apiName}`, PUB_KEY!, dateObj.apiYmd, stock.code);
              if (priceData) break;
            }
          }
          if (priceData) lastSuccessPrice = priceData;
          const finalPriceData = priceData || lastSuccessPrice;
          if (finalPriceData) {
            await supabase.from("stock_prices").upsert({
              security_id: stock.security_id,
              price_date: dateObj.dbFormatted,
              close_price: Math.round(finalPriceData.close),
              open_price: Math.round(finalPriceData.open),
              high_price: Math.round(finalPriceData.high),
              low_price: Math.round(finalPriceData.low),
              volume: (dateObj.isWeekend || !priceData) ? 0 : Math.round(finalPriceData.volume),
              currency: "KRW",
              updated_at: new Date().toISOString()
            }, { onConflict: "security_id,price_date" });
            const status = !priceData ? "📋 (복사저장)" : "✅ (저장완료)";
            console.log(`${status} [국내/ ${stock.name}] ${dateObj.dbFormatted}: ${Math.round(finalPriceData.close)}`);
          }
          await new Promise(r => setTimeout(r, 150));
        }
      }
    }

    // --- [SECTION C: 데이터 공백/오류 보완 (4일 전 ~ 10일 전) - 정밀 수정본] ---
    console.log(`\n🔍 [데이터 보완] 4~10일 전 구간 점검 시작...`);
    
    const now = new Date();
    const kstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const kstToday = new Date(kstDate.getUTCFullYear(), kstDate.getUTCMonth(), kstDate.getUTCDate());

    const checkStartLimit = new Date(kstToday);
    checkStartLimit.setDate(kstToday.getDate() - 10);
    const checkEndLimit = new Date(kstToday);
    checkEndLimit.setDate(kstToday.getDate() - 4); 

    let patchedCount = 0;

    for (const stock of securities) {
      const { data: minRec } = await supabase.from("stock_prices").select("price_date").eq("security_id", stock.security_id).order("price_date", { ascending: true }).limit(1).maybeSingle();
      if (!minRec) continue;

      const dbMinDate = new Date(minRec.price_date);
      const actualStart = checkStartLimit > dbMinDate ? checkStartLimit : dbMinDate;
      const fillRange = getDatesInRange(actualStart, checkEndLimit);

      for (const dateStr of fillRange) {
        // 1. 해당 날짜에 데이터가 존재하는지 확인 (PK인 security_id, price_date 사용)
        const { data: current } = await supabase
          .from("stock_prices")
          .select("close_price")
          .eq("security_id", stock.security_id)
          .eq("price_date", dateStr)
          .maybeSingle();

        // 2. [의도 반영] 정상 데이터(가격 > 0)가 이미 있으면 절대 건드리지 않고 스킵
        if (current && current.close_price > 0) {
          continue; 
        }

        // 3. 데이터가 없거나 0원인 경우만 과거 정상가 조회
        const { data: lastValid } = await supabase
          .from("stock_prices")
          .select("*")
          .eq("security_id", stock.security_id)
          .lt("price_date", dateStr)
          .gt("close_price", 0) 
          .order("price_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastValid) {
          await supabase.from("stock_prices").upsert({
            security_id: stock.security_id,
            price_date: dateStr,
            close_price: lastValid.close_price,
            open_price: lastValid.open_price,
            high_price: lastValid.high_price,
            low_price: lastValid.low_price,
            volume: 0,
            currency: stock.currency,
            updated_at: new Date().toISOString()
          }, { onConflict: "security_id,price_date" });
          
          patchedCount++;
          const action = !current ? "➕ [신규추가]" : "🛠️ [값 복구]";
          console.log(`${action} ${stock.name} (${dateStr}) <- ${lastValid.price_date} 데이터 복사완료`);
        }
      }
    }
    
    console.log(`\n✅ [보완 완료] 4~10일 구간 점검을 마쳤습니다. (실제 보정: ${patchedCount}건)`);

    return new Response(JSON.stringify({ success: true, patched: patchedCount }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("🚨 에러:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

/** --- [Helper Functions] --- **/

function getPastDaysIncludingWeekends(count: number) {
  const days = [];
  const now = new Date();
  const kstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const today = new Date(kstDate.getUTCFullYear(), kstDate.getUTCMonth(), kstDate.getUTCDate());
  for (let i = 0; i < count; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const dayOfWeek = d.getDay();
    let apiDate = new Date(d);
    if (dayOfWeek === 0) apiDate.setDate(d.getDate() - 2);
    else if (dayOfWeek === 6) apiDate.setDate(d.getDate() - 1);
    days.push({ apiYmd: formatDateToYMD(apiDate), dbFormatted: formatDateToISO(d), isWeekend: (dayOfWeek === 0 || dayOfWeek === 6) });
  }
  return days;
}

function getDatesInRange(start: Date, end: Date) {
  const dates = [];
  let curr = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (curr <= end) {
    dates.push(formatDateToISO(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

function formatDateToYMD(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateToISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function fetchBulkFromMarketStack(tickers: string[], date: string, apiKey: string) {
  try {
    const url = `${MARKETSTACK_URL}?access_key=${apiKey}&symbols=${tickers.join(',')}&date_from=${date}&date_to=${date}&limit=100`;
    const res = await fetch(url);
    const result = await res.json();
    return result.data || [];
  } catch { return []; }
}

async function fetchFromPublic(apiUrl: string, key: string, ymd: string, code: string) {
  try {
    const url = `${apiUrl}?serviceKey=${key}&resultType=json&basDt=${ymd}&likeSrtnCd=${code}&numOfRows=10`;
    const res = await fetch(url);
    const data = await res.json();
    const item = data.response?.body?.items?.item;
    const itemList = Array.isArray(item) ? item : (item ? [item] : []);
    const exact = itemList.find((i: any) => i.srtnCd === code);
    return exact ? { close: Number(exact.clpr), open: Number(exact.mkp || exact.basPrc), high: Number(exact.hipr), low: Number(exact.lopr), volume: Number(exact.trqu) } : null;
  } catch { return null; }
}