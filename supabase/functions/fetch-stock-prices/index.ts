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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const PUB_KEY = Deno.env.get("PUBLIC_DATA_SERVICE_KEY");
    
    // API 키 6개 탄창 로드
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

    // 💡 [수집 범위 설정] 
    // 국내는 그대로 3일, 해외(USD)는 현재 2일치 수집 (나중에 1로 변경 가능)
    const krwDates = getPastDaysIncludingWeekends(3).reverse(); 
    const usdDates = getPastDaysIncludingWeekends(3).reverse(); // 👈 나중에 여기를 1로 바꾸세요!

    // --- [SECTION A: 해외 종목 수집] ---
    if (!requestType || requestType !== "KRW") {
      const usdStocks = securities.filter(s => s.currency !== "KRW");
      if (usdStocks.length > 0 && MS_KEYS.length > 0) {
        console.log(`\n🌐 [해외] 최근 ${usdDates.length}일 데이터 수집 시작...`);
        const tickers = usdStocks.map(s => s.code.trim().toUpperCase());

        for (const dateObj of usdDates) {
          const bulkData = await fetchBulkWithSwitching(tickers, dateObj.usdApiYmd, MS_KEYS);
          const lastSuccessMap = new Map();

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
                price_date: dateObj.usdApiYmd, // 미국 현지 날짜로 저장
                close_price: finalData.close,
                open_price: finalData.open || 0,
                high_price: finalData.high || 0,
                low_price: finalData.low || 0,
                volume: (dateObj.isWeekend || !apiData) ? 0 : (finalData.volume || 0),
                currency: stock.currency,
                updated_at: new Date().toISOString()
              }, { onConflict: "security_id,price_date" });

              const icon = !apiData ? "📋" : "✅";
              console.log(`${icon} [해외] ${ticker.padEnd(6)} | ${dateObj.usdApiYmd} | 종가: ${finalData.close.toString().padStart(8)}`);
            }
          }
        }
      }
    }

    // --- [SECTION B: 국내 종목 수집] ---
    if (!requestType || requestType === "KRW") {
      const krwStocks = securities.filter(s => s.currency === "KRW");
      console.log(`\n🇰🇷 [국내] 최근 ${krwDates.length}일 데이터 수집 시작...`);
      for (const stock of krwStocks) {
        let lastPrice: any = null;
        for (const dateObj of krwDates) {
          let priceData = await fetchFromPublic(`${BASE_STOCK}/getStockPriceInfo`, PUB_KEY!, dateObj.krwApiYmd, stock.code);
          if (!priceData) {
            for (const apiName of ["getETFPriceInfo", "getETNPriceInfo", "getELWPriceInfo"]) {
              priceData = await fetchFromPublic(`${BASE_PRODUCT}/${apiName}`, PUB_KEY!, dateObj.krwApiYmd, stock.code);
              if (priceData) break;
            }
          }
          if (priceData) lastPrice = priceData;
          const final = priceData || lastPrice;
          if (final) {
            await supabase.from("stock_prices").upsert({
              security_id: stock.security_id,
              price_date: dateObj.krwApiYmd,
              close_price: Math.round(final.close),
              open_price: Math.round(final.open),
              high_price: Math.round(final.high),
              low_price: Math.round(final.low),
              volume: (dateObj.isWeekend || !priceData) ? 0 : Math.round(final.volume),
              currency: "KRW",
              updated_at: new Date().toISOString()
            }, { onConflict: "security_id,price_date" });

            const icon = !priceData ? "📋" : "✅";
            console.log(`${icon} [국내] ${stock.name.padEnd(10)} | ${dateObj.krwApiYmd} | 종가: ${Math.round(final.close).toLocaleString().padStart(8)}`);
          }
        }
      }
    }

    // --- [SECTION C: 보완 로직] ---
    console.log(`\n🔍 [보완] 점검 시작...`);
    await runOptimizedPatch(supabase, securities);
    
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("🚨 에러:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

/** --- [Helper Functions] --- **/

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

async function fetchFromPublic(apiUrl: string, key: string, ymd: string, code: string) {
  try {
    const url = `${apiUrl}?serviceKey=${key}&resultType=json&basDt=${ymd.replace(/-/g, '')}&likeSrtnCd=${code}&numOfRows=10`;
    const res = await fetch(url);
    const data = await res.json();
    const item = data.response?.body?.items?.item;
    const list = Array.isArray(item) ? item : (item ? [item] : []);
    const exact = list.find((i: any) => i.srtnCd === code);
    return exact ? { close: Number(exact.clpr), open: Number(exact.mkp || exact.basPrc), high: Number(exact.hipr), low: Number(exact.lopr), volume: Number(exact.trqu) } : null;
  } catch { return null; }
}