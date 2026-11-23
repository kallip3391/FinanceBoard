import { NextResponse } from 'next/server';

const standardHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*'
};

// 인메모리 검색 캐시 (TTL: 10분)
const searchMemoryCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || searchParams.get('query') || '').trim();

  if (!q) {
    return NextResponse.json([]);
  }

  // 1. 메모리 캐시 확인 (0ms 초고속 반환)
  const cached = searchMemoryCache.get(q.toLowerCase());
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return NextResponse.json(cached.data);
  }

  const results = [];
  const seenCodes = new Set();
  const SERVICE_KEY = process.env.PUBLIC_DATA_SERVICE_KEY;

  const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(q);
  const is6Digits = /^\d{6}$/.test(q);

  // ══════════════════════════════════════════════════════════
  // A. [국내 종목 1순위: 초고속 0.07초] 다음 증권 국내 검색 API
  // ══════════════════════════════════════════════════════════
  const daumPromise = (async () => {
    try {
      const res = await fetch(`https://finance.daum.net/api/search?q=${encodeURIComponent(q)}`, {
        headers: {
          ...standardHeaders,
          'Referer': 'https://finance.daum.net/'
        },
        next: { revalidate: 300 }
      });
      if (res.ok) {
        const json = await res.json();
        const items = json.suggestItems || [];
        return items.map((item) => {
          const code = item.displayedCode || (item.symbolCode || '').replace(/^A/, '');
          const market = (item.market || '').toUpperCase().includes('KOSDAQ') ? 'KOSDAQ' : 'KOSPI';
          return {
            code,
            name: item.koreanName,
            market,
            symbol: `${code}.${market === 'KOSDAQ' ? 'KQ' : 'KS'}`,
            currency: 'KRW'
          };
        });
      }
    } catch (e) {
      console.warn('[stock-search] Daum search fallback:', e.message);
    }
    return [];
  })();

  // ══════════════════════════════════════════════════════════
  // B. [해외 종목 & ETF 1순위: 0.15초] 야후 파이낸스 Search API
  // ══════════════════════════════════════════════════════════
  const yahooPromise = (async () => {
    try {
      const yahooUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`;
      const res = await fetch(yahooUrl, { headers: standardHeaders, next: { revalidate: 300 } });
      if (res.ok) {
        const data = await res.json();
        const quotes = data?.quotes || [];
        return quotes.map((item) => {
          const symbol = item.symbol;
          if (!symbol) return null;
          const isKorean = symbol.endsWith('.KS') || symbol.endsWith('.KQ');
          const code = isKorean ? symbol.split('.')[0] : symbol;
          const name = item.longname || item.shortname || item.name || symbol;
          const market = item.exchDisp || item.exchange || (isKorean ? 'KOSPI' : 'US');
          return {
            code,
            name,
            market,
            symbol,
            currency: isKorean ? 'KRW' : 'USD'
          };
        }).filter(Boolean);
      }
    } catch (e) {
      console.warn('[stock-search] Yahoo search fallback:', e.message);
    }
    return [];
  })();

  // 두 소스를 병렬(Parallel)로 동시 호출하여 0.2초 이내 완료
  const [daumList, yahooList] = await Promise.all([daumPromise, yahooPromise]);

  // 국내 결과 우선 수집 (한글명 우선 보장)
  daumList.forEach(item => {
    if (item.code && !seenCodes.has(item.code)) {
      seenCodes.add(item.code);
      results.push(item);
    }
  });

  // 해외 종목 수집
  yahooList.forEach(item => {
    if (item.code && !seenCodes.has(item.code)) {
      seenCodes.add(item.code);
      results.push(item);
    }
  });

  // ══════════════════════════════════════════════════════════
  // C. [비상 폴백] 공공데이터포털(KRX) - 국내 결과가 0개일 때만 호출
  // ══════════════════════════════════════════════════════════
  if (results.length === 0 && SERVICE_KEY && (hasKorean || is6Digits)) {
    try {
      const encodeParam = encodeURIComponent(q);
      const paramKey = is6Digits ? 'likeSrtnCd' : 'likeItmsNm';
      const urlKrx = `https://apis.data.go.kr/1160100/service/GetKrxListedInfoService/getItemInfo?serviceKey=${SERVICE_KEY}&resultType=json&${paramKey}=${encodeParam}&numOfRows=15`;
      const res = await fetch(urlKrx);
      if (res.ok) {
        const data = await res.json();
        const items = data?.response?.body?.items?.item || [];
        const arr = Array.isArray(items) ? items : [items];
        arr.forEach(item => {
          let code = item.srtnCd || '';
          if (code.startsWith('A')) code = code.substring(1);
          if (code && !seenCodes.has(code) && item.itmsNm) {
            seenCodes.add(code);
            results.push({
              code,
              name: item.itmsNm,
              market: item.mrktCtg || 'KOSPI',
              symbol: `${code}.${item.mrktCtg === 'KOSDAQ' ? 'KQ' : 'KS'}`,
              currency: 'KRW'
            });
          }
        });
      }
    } catch {}
  }

  // ══════════════════════════════════════════════════════════
  // D. 정확도 우선 정렬 (Exact Match를 최상단으로)
  // ══════════════════════════════════════════════════════════
  const upperQ = q.toUpperCase();
  results.sort((a, b) => {
    const aExact = a.code.toUpperCase() === upperQ || a.name === q;
    const bExact = b.code.toUpperCase() === upperQ || b.name === q;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    const aStarts = a.name.startsWith(q) || a.code.startsWith(upperQ);
    const bStarts = b.name.startsWith(q) || b.code.startsWith(upperQ);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    return 0;
  });

  const finalResults = results.slice(0, 10);

  // 캐시 저장
  if (finalResults.length > 0) {
    searchMemoryCache.set(q.toLowerCase(), {
      data: finalResults,
      timestamp: Date.now()
    });
  }

  return NextResponse.json(finalResults);
}
