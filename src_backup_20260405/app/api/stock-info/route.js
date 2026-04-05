import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const name = searchParams.get('name');
  const domesticOnly = searchParams.get('domesticOnly') === 'true';
  const overseasOnly = searchParams.get('overseasOnly') === 'true';

  if (!code && !name) {
    return NextResponse.json({ error: 'Stock code or name is required' }, { status: 400 });
  }

  // Set better headers for reliable fetching
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
  };

  try {
    // 1. Try Public Data API - Absolute Priority for Domestic
    const searchTerm = name || code;
    const SERVICE_KEY = process.env.PUBLIC_DATA_SERVICE_KEY;

    if (!overseasOnly && searchTerm && SERVICE_KEY) {
      try {
        console.log(`[API] 공공데이터 검색 시도: ${searchTerm}`);
        const isCodeStr = /^[A-Z0-9]+$/i.test(searchTerm) && !/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(searchTerm);
        const encodeParam = encodeURIComponent(searchTerm);
        
        const fetchPublicData = async (url) => {
          try {
            const res = await fetch(url);
            if (!res.ok) return [];
            const data = await res.json();
            const items = data.response?.body?.items?.item;
            if (!items) return [];
            return Array.isArray(items) ? items : [items];
          } catch (e) {
            console.error('[API] 공공데이터 fetch 오류:', e.message);
            return [];
          }
        };

        const urls = [];
        if (isCodeStr) {
          urls.push(`https://apis.data.go.kr/1160100/service/GetKrxListedInfoService/getItemInfo?serviceKey=${SERVICE_KEY}&resultType=json&likeSrtnCd=${encodeParam}&numOfRows=50`);
          urls.push(`https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService/getETFPriceInfo?serviceKey=${SERVICE_KEY}&resultType=json&likeSrtnCd=${encodeParam}&numOfRows=50`);
        } else {
          urls.push(`https://apis.data.go.kr/1160100/service/GetKrxListedInfoService/getItemInfo?serviceKey=${SERVICE_KEY}&resultType=json&likeItmsNm=${encodeParam}&numOfRows=50`);
          urls.push(`https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService/getETFPriceInfo?serviceKey=${SERVICE_KEY}&resultType=json&likeItmsNm=${encodeParam}&numOfRows=50`);
        }

        const responses = await Promise.all(urls.map(url => fetchPublicData(url)));
        const combinedItems = responses.flat();

        if (combinedItems.length > 0) {
          const uniqueResultsMap = new Map();
          for (const item of combinedItems) {
            let itemCode = item.srtnCd || '';
            if (itemCode.startsWith('A')) itemCode = itemCode.substring(1);
            
            const itemName = item.itmsNm;
            if (!itemName) continue;

            if (!uniqueResultsMap.has(itemCode)) {
              const market = item.mrktCtg || 'KOSPI'; // ETF defaults to KOSPI
              uniqueResultsMap.set(itemCode, {
                name: itemName,
                code: itemCode,
                market: market,
                exchange_code: market === 'KOSDAQ' ? 'KQ' : 'KS',
                symbol: `${itemCode}.${market === 'KOSDAQ' ? 'KQ' : 'KS'}`
              });
            }
          }

          const results = Array.from(uniqueResultsMap.values());
          if (results.length > 0) {
            console.log(`[API] 공공데이터 결과 발견: ${results.length}건`);
            return NextResponse.json({
              results,
              source: 'public-data'
            });
          }
        }
        console.log(`[API] 공공데이터 결과 없음, 다음 검색 진행`);
      } catch (err) {
        console.error('[API] 공공데이터 API 오류:', err.message);
      }
    }

    // 2. Fallback to Yahoo Search API - localized for KR
    const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${code}${!overseasOnly ? '&region=KR&lang=ko-KR' : ''}`;
    try {
      const searchResponse = await fetch(searchUrl, { headers });
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.quotes && searchData.quotes.length > 0) {
          const results = searchData.quotes
            .filter(q => {
              // Ensure we filter correctly
              const isKorean = (q.symbol.endsWith('.KS') || q.symbol.endsWith('.KQ')) || (q.exchange === 'KSC' || q.exchange === 'KOE');
              if (domesticOnly) return isKorean;
              if (overseasOnly) return !isKorean && q.quoteType !== 'CRYPTOCURRENCY';
              return true;
            })
            .map(q => ({
              name: q.longname || q.name || q.shortname || '',
              code: (q.symbol.endsWith('.KS') || q.symbol.endsWith('.KQ') || q.exchange === 'KSC' || q.exchange === 'KOE') ? q.symbol.split('.')[0] : q.symbol,
              market: q.exchDisp || q.exchange || 'OVERSEAS',
              exchange_code: q.symbol.includes('.') ? q.symbol.split('.')[1] : (q.exchange || ''),
              symbol: q.symbol
            }))
            .filter(item => item.name);

          // Sort results: Domestic -> US (any exchange) -> Others
          results.sort((a, b) => {
            const getPriority = (market, symbol) => {
              const mkt = market?.toUpperCase() || '';
              if (['KOSPI', 'KOSDAQ', 'KONEX', 'KSC', 'KOE'].includes(mkt) || symbol.endsWith('.KS') || symbol.endsWith('.KQ')) return 1;
              if (['NASDAQ', 'NYSE', 'NYQ', 'NMS', 'PCX', 'ASE', 'BATS', 'OTC', 'ARCA'].includes(mkt)) return 2;
              return 3;
            };
            return getPriority(a.market, a.symbol) - getPriority(b.market, b.symbol);
          });

          if (results.length > 0) {
            return NextResponse.json({
              results,
              source: 'yahoo-search'
            });
          }
        }
      }
    } catch (err) {
      console.error('Yahoo Search API error:', err);
    }

    // 3. Fallback to Yahoo CHART API (v8)
    if (!overseasOnly) {
      const symbols = [`${code}.KS`, `${code}.KQ`];
      for (const symbol of symbols) {
        const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d&region=KR&lang=ko-KR`;
        try {
          const response = await fetch(chartUrl, { headers });
          if (response.ok) {
            const data = await response.json();
            const meta = data?.chart?.result?.[0]?.meta;
            if (meta && (meta.longName || meta.shortName)) {
              return NextResponse.json({
                results: [{
                  name: meta.longName || meta.shortName,
                  code: meta.symbol.split('.')[0],
                  market: symbol.endsWith('.KS') ? 'KOSPI' : 'KOSDAQ',
                  exchange_code: symbol.split('.')[1] || '',
                  symbol: meta.symbol
                }],
                source: 'yahoo-chart'
              });
            }
          }
        } catch (err) {
          console.error(`Error fetching chart for ${symbol}:`, err);
        }
      }
    } else {
      const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${code}?interval=1m&range=1d`;
      try {
        const response = await fetch(chartUrl, { headers });
        if (response.ok) {
          const data = await response.json();
          const meta = data?.chart?.result?.[0]?.meta;
          if (meta && (meta.longName || meta.shortName)) {
            return NextResponse.json({
              results: [{
                name: meta.longName || meta.shortName,
                code: meta.symbol,
                market: meta.exchangeName || 'OVERSEAS',
                exchange_code: meta.exchangeName || '',
                symbol: meta.symbol
              }],
              source: 'yahoo-chart'
            });
          }
        }
      } catch (err) {
        console.error(`Error fetching chart for ${code}:`, err);
      }
    }

    return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
  } catch (error) {
    console.error('Main API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
