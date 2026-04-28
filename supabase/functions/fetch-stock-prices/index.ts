import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MARKETSTACK_URL = "https://api.marketstack.com/v1/eod";
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

    // [Step 1] 최근 3일 수집용 날짜 생성
    const targetDates = getPastDaysIncludingWeekends(3);
    const reversedDates = [...targetDates].reverse(); 

    // --- [SECTION A: 해외 종목 수집 (USD/해외)] ---
    if (!requestType || requestType !== "KRW") {
      const usdStocks = securities.filter(s => s.currency !== "KRW");
      if (usdStocks.length > 0 && MS_KEY) {
        console.log(`\n🌐 [해외] 최근 3일 스캔 시작...`);
        const tickers = usdStocks.map(s => s.code.trim().toUpperCase());
        const lastSuccessCloseMap = new Map(); // 💡 종가(close)만 임시 보관

        for (const dateObj of reversedDates) {
          const bulkData = await fetchBulkFromMarketStack(tickers, dateObj.usdApiYmd, MS_KEY);
          
          if (bulkData && bulkData.length > 0) {
            for (const item of bulkData) {
              if (item.close && item.close > 0) lastSuccessCloseMap.set(item.symbol, item.close);
            }
          }

          for (const stock of usdStocks) {
            const ticker = stock.code.trim().toUpperCase();
            const apiData = (bulkData || []).find(d => d.symbol === ticker);
            
            const isValidData = apiData && apiData.close && apiData.close > 0;
            // 💡 종가는 유효하면 API 값을, 아니면 이전 값을 사용
            const targetClose = isValidData ? apiData.close : lastSuccessCloseMap.get(ticker);

            if (targetClose) {
              await supabase.from("stock_prices").upsert({
                security_id: stock.security_id,
                price_date: dateObj.dbFormatted, 
                close_price: targetClose,
                // 💡 시/고/저가는 과거 데이터를 끌어오지 않고, 당일 API 값(없으면 0)을 순수하게 보관
                open_price: apiData?.open || 0,
                high_price: apiData?.high || 0,
                low_price: apiData?.low || 0,
                volume: (dateObj.isWeekend || !isValidData) ? 0 : (apiData?.volume || 0),
                currency: stock.currency,
                updated_at: new Date().toISOString()
              }, { onConflict: "security_id,price_date" });

              const status = !isValidData ? "📋 (종가만 복사)" : "✅ (저장완료)";
              console.log(`${status} [해외/ ${ticker}] DB:${dateObj.dbFormatted} -> 종가:${targetClose}`);
            }
          }
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    // --- [SECTION B: 국내 종목 수집 (KRW)] ---
    if (!requestType || requestType === "KRW") {
      const krwStocks = securities.filter(s => s.currency === "KRW");
      for (const stock of krwStocks) {
        console.log(`\n🇰🇷 [국내] ${stock.name} 수집 시작...`);
        let lastSuccessClose = 0; // 💡 종가(close)만 임시 보관

        for (const dateObj of reversedDates) {
          let priceData = await fetchFromPublic(`${BASE_STOCK}/getStockPriceInfo`, PUB_KEY!, dateObj.krwApiYmd, stock.code);
          if (!priceData) {
            for (const apiName of ["getETFPriceInfo", "getETNPriceInfo", "getELWPriceInfo"]) {
              priceData = await fetchFromPublic(`${BASE_PRODUCT}/${apiName}`, PUB_KEY!, dateObj.krwApiYmd, stock.code);
              if (priceData) break;
            }
          }
          
          const isValidPrice = priceData && priceData.close && priceData.close > 0;
          if (isValidPrice) lastSuccessClose = priceData.close;
          const targetClose = isValidPrice ? priceData.close : lastSuccessClose;

          if (targetClose > 0) {
            await supabase.from("stock_prices").upsert({
              security_id: stock.security_id,
              price_date: dateObj.dbFormatted,
              close_price: Math.round(targetClose),
              // 💡 국내 주식도 마찬가지로 당일 API 값 그대로 보관
              open_price: Math.round(priceData?.open || 0),
              high_price: Math.round(priceData?.high || 0),
              low_price: Math.round(priceData?.low || 0),
              volume: (dateObj.isWeekend || !isValidPrice) ? 0 : Math.round(priceData?.volume || 0),
              currency: "KRW",
              updated_at: new Date().toISOString()
            }, { onConflict: "security_id,price_date" });

            const status = !isValidPrice ? "📋 (종가만 복사)" : "✅ (저장완료)";
            console.log(`${status} [국내/ ${stock.name}] DB:${dateObj.dbFormatted} -> 종가:${Math.round(targetClose)}`);
          }
          await new Promise(r => setTimeout(r, 150));
        }
      }
    }

    // --- [SECTION C: 과거 데이터 공백 보완 (4~10일 전)] ---
    console.log(`\n🔍 [데이터 보완] 과거 4~10일 구간 점검 시작...`);
    const kstDate = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
    const kstToday = new Date(kstDate.getUTCFullYear(), kstDate.getUTCMonth(), kstDate.getUTCDate());

    const checkStartLimit = new Date(kstToday); checkStartLimit.setDate(kstToday.getDate() - 10);
    const checkEndLimit = new Date(kstToday); checkEndLimit.setDate(kstToday.getDate() - 4); 

    let patchedCount = 0;
    for (const stock of securities) {
      const { data: minRec } = await supabase.from("stock_prices").select("price_date").eq("security_id", stock.security_id).order("price_date", { ascending: true }).limit(1).maybeSingle();
      if (!minRec) continue;

      const fillRange = getDatesInRange(new Date(minRec.price_date) > checkStartLimit ? new Date(minRec.price_date) : checkStartLimit, checkEndLimit);

      for (const dateStr of fillRange) {
        // 💡 수정: 현재 DB에 있는 전체 컬럼을 불러와서 시/고/저가를 덮어쓰지 않도록 합니다.
        const { data: current } = await supabase.from("stock_prices").select("*").eq("security_id", stock.security_id).eq("price_date", dateStr).maybeSingle();
        if (current && current.close_price > 0) continue; 

        // 💡 가장 최근의 '정상 종가' 하나만 불러옵니다.
        const { data: lastValid } = await supabase.from("stock_prices").select("close_price").eq("security_id", stock.security_id).lt("price_date", dateStr).gt("close_price", 0).order("price_date", { ascending: false }).limit(1).maybeSingle();

        if (lastValid) {
          await supabase.from("stock_prices").upsert({
            security_id: stock.security_id, 
            price_date: dateStr, 
            close_price: lastValid.close_price,
            // 기존에 0원으로라도 보관되어 있던 값이 있다면 그대로 유지, 아예 DB행이 없었다면 0으로 세팅
            open_price: current?.open_price || 0, 
            high_price: current?.high_price || 0, 
            low_price: current?.low_price || 0,
            volume: current?.volume || 0, 
            currency: stock.currency, 
            updated_at: new Date().toISOString()
          }, { onConflict: "security_id,price_date" });
          
          patchedCount++;
          console.log(`🛠️ [값 복구] ${stock.name} (${dateStr}) <- 이전 정상 종가(${lastValid.close_price}) 복사 완료`);
        }
      }
    }
    
    console.log(`\n✅ [보완 완료] 총 ${patchedCount}건의 데이터 공백을 성공적으로 메웠습니다.`);
    
    return new Response(JSON.stringify({ success: true, patched: patchedCount }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("🚨 에러:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

/** --- [Helper Functions] --- **/

function getPastDaysIncludingWeekends(count: number) {
  const days = [];
  const kstDate = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
  const today = new Date(kstDate.getUTCFullYear(), kstDate.getUTCMonth(), kstDate.getUTCDate());

  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dayOfWeek = d.getDay(); 
    
    let krwApiDate = new Date(d);
    if (dayOfWeek === 0) krwApiDate.setDate(d.getDate() - 2);      
    else if (dayOfWeek === 6) krwApiDate.setDate(d.getDate() - 1); 

    let usdApiDate = new Date(d);
    if (dayOfWeek === 0) usdApiDate.setDate(d.getDate() - 2);      
    else if (dayOfWeek === 1) usdApiDate.setDate(d.getDate() - 3); 
    else usdApiDate.setDate(d.getDate() - 1);                      

    days.push({ 
      dbFormatted: formatDateToISO(d), 
      krwApiYmd: formatDateToISO(krwApiDate), 
      usdApiYmd: formatDateToISO(usdApiDate), 
      isWeekend: (dayOfWeek === 0 || dayOfWeek === 6) 
    });
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
    const cleanYmd = ymd.replace(/-/g, '');
    const url = `${apiUrl}?serviceKey=${key}&resultType=json&basDt=${cleanYmd}&likeSrtnCd=${code}&numOfRows=10`;
    const res = await fetch(url);
    const data = await res.json();
    const item = data.response?.body?.items?.item;
    const itemList = Array.isArray(item) ? item : (item ? [item] : []);
    const exact = itemList.find((i: any) => i.srtnCd === code);
    return exact ? { close: Number(exact.clpr), open: Number(exact.mkp || exact.basPrc), high: Number(exact.hipr), low: Number(exact.lopr), volume: Number(exact.trqu) } : null;
  } catch { return null; }
}