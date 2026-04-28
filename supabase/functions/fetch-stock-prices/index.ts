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
    
    // 총 6개의 API 키를 탄창에 장전합니다.
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
    
    const { data: securities } = await supabase.from("security").select("*");
    if (!securities) throw new Error("종목 리스트를 불러올 수 없습니다.");

    // 💡 [수정됨] 국내용(3일)과 해외용(1일) 날짜 범위를 각각 따로 생성합니다.
    const krwTargetDates = getPastDaysIncludingWeekends(3);
    const krwReversedDates = [...krwTargetDates].reverse(); 

    const usdTargetDates = getPastDaysIncludingWeekends(1); // 해외는 1일치만!
    const usdReversedDates = [...usdTargetDates].reverse();

    // --- [SECTION A: 해외 종목 수집 (USD/해외)] ---
    if (!requestType || requestType !== "KRW") {
      const usdStocks = securities.filter(s => s.currency !== "KRW");
      
      if (usdStocks.length > 0 && MS_KEYS.length > 0) {
        console.log(`\n🌐 [해외] 최근 1일 스캔 시작... (등록된 API 키: ${MS_KEYS.length}개)`);
        const tickers = usdStocks.map(s => s.code.trim().toUpperCase());
        const lastSuccessMap = new Map();

        // 💡 해외는 1일치(usdReversedDates) 배열만 순회합니다.
        for (const dateObj of usdReversedDates) {
          const bulkData = await fetchBulkFromMarketStack(tickers, dateObj.usdApiYmd, MS_KEYS);
          
          if (bulkData && bulkData.length > 0) {
            for (const item of bulkData) {
              if (item.close && item.close > 0) lastSuccessMap.set(item.symbol, item);
            }
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
                volume: (dateObj.isWeekend || !apiData) ? 0 : (finalData.volume || 0),
                currency: stock.currency,
                updated_at: new Date().toISOString()
              }, { onConflict: "security_id,price_date" });

              const status = !apiData ? "📋 (복사저장)" : "✅ (저장완료)";
              console.log(`${status} [해외/ ${ticker}] ${dateObj.dbFormatted} (API: ${dateObj.usdApiYmd}): ${finalData.close}`);
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
        let lastSuccessPrice: any = null;

        // 💡 국내는 기존대로 3일치(krwReversedDates) 배열을 순회합니다.
        for (const dateObj of krwReversedDates) {
          let priceData = await fetchFromPublic(`${BASE_STOCK}/getStockPriceInfo`, PUB_KEY!, dateObj.krwApiYmd, stock.code);
          if (!priceData) {
            for (const apiName of ["getETFPriceInfo", "getETNPriceInfo", "getELWPriceInfo"]) {
              priceData = await fetchFromPublic(`${BASE_PRODUCT}/${apiName}`, PUB_KEY!, dateObj.krwApiYmd, stock.code);
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

    // --- [SECTION C: 과거 데이터 공백 보완 (2~10일 전)] ---
    // 💡 [수정됨] 4~10일에서 2~10일로 변경되었습니다.
    console.log(`\n🔍 [데이터 보완] 과거 2~10일 구간 점검 시작...`);
    const kstDate = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
    const kstToday = new Date(kstDate.getUTCFullYear(), kstDate.getUTCMonth(), kstDate.getUTCDate());

    const checkStartLimit = new Date(kstToday); checkStartLimit.setDate(kstToday.getDate() - 10);
    const checkEndLimit = new Date(kstToday); checkEndLimit.setDate(kstToday.getDate() - 2); // 💡 2일전으로 수정

    let patchedCount = 0;
    for (const stock of securities) {
      const { data: minRec } = await supabase.from("stock_prices").select("price_date").eq("security_id", stock.security_id).order("price_date", { ascending: true }).limit(1).maybeSingle();
      if (!minRec) continue;

      const fillRange = getDatesInRange(new Date(minRec.price_date) > checkStartLimit ? new Date(minRec.price_date) : checkStartLimit, checkEndLimit);

      for (const dateStr of fillRange) {
        const { data: current } = await supabase.from("stock_prices").select("close_price").eq("security_id", stock.security_id).eq("price_date", dateStr).maybeSingle();
        if (current && current.close_price > 0) continue; 

        const { data: lastValid } = await supabase.from("stock_prices").select("*").eq("security_id", stock.security_id).lt("price_date", dateStr).gt("close_price", 0).order("price_date", { ascending: false }).limit(1).maybeSingle();

        if (lastValid) {
          await supabase.from("stock_prices").upsert({
            security_id: stock.security_id, price_date: dateStr, close_price: lastValid.close_price,
            open_price: lastValid.open_price, high_price: lastValid.high_price, low_price: lastValid.low_price,
            volume: 0, currency: stock.currency, updated_at: new Date().toISOString()
          }, { onConflict: "security_id,price_date" });
          
          patchedCount++;
          console.log(`🛠️ [값 복구] ${stock.name} (${dateStr}) <- ${lastValid.price_date} 정상가 복사 완료`);
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

async function fetchBulkFromMarketStack(tickers: string[], date: string, apiKeys: string[]) {
  for (const apiKey of apiKeys) {
    try {
      const url = `${MARKETSTACK_URL}?access_key=${apiKey}&symbols=${tickers.join(',')}&date_from=${date}&date_to=${date}&limit=100`;
      const res = await fetch(url);
      const result = await res.json();
      
      if (!result.error && result.data) {
        return result.data;
      }
      
      const keySuffix = apiKey.slice(-4);
      console.log(`⚠️ API 키(*${keySuffix}) 사용 불가(한도초과 등). 다음 대기열 키로 교체 시도...`);
    } catch (error) { 
      console.error(`🚨 API 통신 에러:`, error);
    }
  }
  
  return []; 
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