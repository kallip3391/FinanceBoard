import { NextResponse } from 'next/server';

/**
 * GET /api/stock-price?symbol=TSLA (또는 symbol=005930.KS)
 * 
 * 1. 국내 종목 (005930, 005930.KS, 247540.KQ 등):
 *    - 1순위: 네이버페이 증권 국내 시세 API (초고속, 키 불필요)
 * 
 * 2. 해외 종목 (AAPL, TSLA, QQQ, NVDA 등):
 *    - 1순위: 네이버페이 증권 해외 시세 API (키 불필요, 0.05초 응답, 봇 차단 없음)
 *    - 2순위: MarketStack API (프로젝트 환경변수의 6개 키 자동 스위칭)
 *    - 3순위 (비상용): 야후 파이낸스 차트 API
 */

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawSymbol = searchParams.get('symbol');

  if (!rawSymbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  const symbol = rawSymbol.trim();
  const isDomestic = /^\d{6}/.test(symbol) || symbol.endsWith('.KS') || symbol.endsWith('.KQ');
  const cleanCode = symbol.replace(/\.(KS|KQ)$/i, '').trim();

  const standardHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
  };

  try {
    // ══════════════════════════════════════════════
    // A. 국내 주식/ETF 조회
    // ══════════════════════════════════════════════
    if (isDomestic) {
      // 1순위: 네이버페이 증권 모바일 basic API
      try {
        const naverDomesticUrl = `https://m.stock.naver.com/front-api/v1/stock/${cleanCode}/basic`;
        const res = await fetch(naverDomesticUrl, { headers: standardHeaders, next: { revalidate: 30 } });
        if (res.ok) {
          const data = await res.json();
          const rawPrice = data?.now || data?.closePrice;
          const price = parseFloat(String(rawPrice || '0').replace(/,/g, ''));
          if (price > 0) {
            return makeResponse(price, 'naver-domestic', symbol);
          }
        }
      } catch (err) {
        console.warn(`[API/StockPrice] 네이버 국내 시세 1차 실패 (${cleanCode}):`, err.message);
      }

      // 2순위: 네이버 실시간 polling API
      try {
        const pollingUrl = `https://polling.finance.naver.com/api/realtime/domestic/stock/${cleanCode}`;
        const res = await fetch(pollingUrl, { headers: standardHeaders, next: { revalidate: 30 } });
        if (res.ok) {
          const data = await res.json();
          const rawPrice = data?.result?.areas?.[0]?.datas?.[0]?.nv;
          const price = parseFloat(String(rawPrice || '0').replace(/,/g, ''));
          if (price > 0) {
            return makeResponse(price, 'naver-domestic-polling', symbol);
          }
        }
      } catch (err) {
        console.warn(`[API/StockPrice] 네이버 국내 폴링 시세 실패 (${cleanCode}):`, err.message);
      }
    }

    // ══════════════════════════════════════════════
    // B. 해외 주식/ETF 조회 (1순위: 네이버, 2순위: MarketStack, 3순위: 야후)
    // ══════════════════════════════════════════════
    const upperTicker = cleanCode.toUpperCase();

    // ──────────────────────────────────────────────
    // 1순위: 네이버페이 증권 해외주식 API (키 불필요, 차단율 0%)
    // ──────────────────────────────────────────────
    // 나스닥(.O), 뉴욕거래소(.N), 아멕스(.A, .AMS) 및 특수 표기(BRKb.N) 순차 매칭
    const baseTicker = upperTicker.replace(/\.(O|N|A|AMS)$/i, '');
    let candidateCodes = [];
    if (baseTicker.includes('.') || baseTicker.includes('-')) {
      const bVariant = baseTicker.replace(/[\.-]/g, 'b');
      candidateCodes = [
        `${bVariant}.N`,
        `${baseTicker.replace(/[\.-]/g, '')}.N`,
        `${baseTicker}.N`,
        `${baseTicker}.O`,
        `${baseTicker}.A`,
        baseTicker
      ];
    } else {
      candidateCodes = [
        `${baseTicker}.P`, // 💡 PCX (NYSE Arca / 미국 ETF 대다수)
        `${baseTicker}.O`, // 나스닥
        `${baseTicker}.N`, // 뉴욕증권거래소
        `${baseTicker}.A`, // 아멕스
        `${baseTicker}.AMS`,
        baseTicker
      ];
    }

    for (const reutersCode of candidateCodes) {
      try {
        const naverForeignUrl = `https://api.stock.naver.com/stock/${reutersCode}/basic`;
        const res = await fetch(naverForeignUrl, { headers: standardHeaders, next: { revalidate: 60 } });
        if (res.ok) {
          const data = await res.json();
          const rawPrice = data?.now || data?.closePrice;
          const price = parseFloat(String(rawPrice || '0').replace(/,/g, ''));
          if (price > 0) {
            return makeResponse(price, 'naver-foreign', symbol);
          }
        }
      } catch (err) {
        // 다음 접미사 후보 계속 시도
      }
    }

    // ──────────────────────────────────────────────
    // 2순위: MarketStack API (등록된 API 키들로 자동 전환 조회)
    // ──────────────────────────────────────────────
    const msKeys = [
      process.env.MARKETSTACK_API_KEY,
      process.env.MARKETSTACK_API_KEY_1,
      process.env.MARKETSTACK_API_KEY_2,
      process.env.MARKETSTACK_API_KEY_3,
      process.env.MARKETSTACK_API_KEY_4,
      process.env.MARKETSTACK_API_KEY_5
    ].filter(Boolean);

    if (msKeys.length > 0) {
      for (let i = 0; i < msKeys.length; i++) {
        const key = msKeys[i];
        try {
          const msUrl = `https://api.marketstack.com/v1/eod/latest?access_key=${key}&symbols=${upperTicker}`;
          const res = await fetch(msUrl, { next: { revalidate: 300 } });
          if (res.ok) {
            const result = await res.json();
            const item = result?.data?.[0];
            const price = parseFloat(String(item?.close || item?.last || '0'));
            if (price > 0) {
              return makeResponse(price, `marketstack-key-${i + 1}`, symbol);
            }
          }
        } catch (err) {
          continue;
        }
      }
    }

    // ──────────────────────────────────────────────
    // 3순위 (비상용): 야후 파이낸스 차트 API
    // ──────────────────────────────────────────────
    try {
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
      const res = await fetch(yahooUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (price && price > 0) {
          return makeResponse(price, 'yahoo-fallback', symbol);
        }
      }
    } catch (err) {
      console.warn(`[API/StockPrice] 야후 폴백 실패 (${symbol}):`, err.message);
    }

    // 모든 시도 실패 시 404 반환
    return NextResponse.json({ error: `종목(${symbol}) 정보를 찾을 수 없습니다.` }, { status: 404 });

  } catch (error) {
    console.error('[API/StockPrice] Server Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * MarketPriceManager 및 기존 호출부와의 100% 하위 호환성을 갖춘 응답 생성 함수
 */
function makeResponse(price, source, symbol) {
  return NextResponse.json({
    price,
    symbol,
    source,
    chart: {
      result: [
        {
          meta: {
            regularMarketPrice: price,
            symbol
          }
        }
      ]
    }
  });
}
