import { NextResponse } from 'next/server';

/**
 * GET /api/stock-history?symbol=NVDA&period=1y
 * 
 * 기간 옵션: 1m, 3m, 6m, 1y, 3y
 * 지원: 국내 주식 (005930, 005930.KS), 해외 주식/ETF (NVDA, TSLA, SCHD, SGOV 등), KRX 금현물
 */

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawSymbol = searchParams.get('symbol') || searchParams.get('code');
  const period = (searchParams.get('period') || '1y').toLowerCase();

  if (!rawSymbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  const symbol = rawSymbol.trim();
  const isDomestic = /^\d{6}/.test(symbol) || symbol.endsWith('.KS') || symbol.endsWith('.KQ');
  const cleanCode = symbol.replace(/\.(KS|KQ)$/i, '').trim();

  // period -> yahoo range 매핑
  const rangeMap = {
    '1m': '1mo',
    '3m': '3mo',
    '6m': '6mo',
    '1y': '1y',
    '3y': '3y',
    '5y': '5y'
  };
  const yahooRange = rangeMap[period] || '1y';

  const standardHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
  };

  try {
    let data = null;

    // ══════════════════════════════════════════════
    // A. [1순위] 네이버페이 증권 차트 및 시세 API
    // ══════════════════════════════════════════════
    if (isDomestic) {
      // 1. 국내 주식 네이버 일봉 차트
      try {
        const naverCount = period === '3y' ? 800 : 400;
        const naverUrl = `https://fchart.stock.naver.com/sise.nhn?symbol=${cleanCode}&timeframe=day&count=${naverCount}&requestType=0`;
        const res = await fetch(naverUrl, { headers: standardHeaders });
        if (res.ok) {
          const xmlText = await res.text();
          const items = xmlText.match(/<item data="([^"]+)"/g) || [];
          const history = items.map((tag) => {
            const raw = tag.replace('<item data="', '').replace('"', '');
            const parts = raw.split('|');
            const dStr = parts[0];
            const date = `${dStr.slice(0, 4)}-${dStr.slice(4, 6)}-${dStr.slice(6, 8)}`;
            return {
              date,
              open: Number(parts[1]),
              high: Number(parts[2]),
              low: Number(parts[3]),
              close: Number(parts[4]),
              volume: Number(parts[5])
            };
          });

          if (history.length > 5) {
            const currentPrice = history[history.length - 1].close;
            const previousClose = history.length > 1 ? history[history.length - 2].close : currentPrice;
            data = {
              symbol: cleanCode,
              currency: 'KRW',
              currentPrice,
              previousClose,
              history
            };
          }
        }
      } catch (err) {
        console.warn('[API/stock-history] 네이버 국내 차트 실패:', err.message);
      }
    } else if (period !== '3y') {
      // 2. 해외 주식/ETF 네이버 해외 차트 API (.O, .K, .N, .P, .A, 원형) - 3y 장기 데이터는 Yahoo 바로 조회
      const upper = cleanCode.toUpperCase();
      const candidateCodes = [`${upper}.O`, `${upper}.K`, `${upper}.N`, `${upper}.P`, `${upper}.A`, upper];

      for (const reutersCode of candidateCodes) {
        try {
          const chartUrl = `https://api.stock.naver.com/chart/foreign/item/${reutersCode}?periodType=dayCandle`;
          const res = await fetch(chartUrl, { headers: standardHeaders });
          if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list) && list.length > 5) {
              const history = list.map((item) => {
                const rawDt = String(item.localDate || '');
                const date = rawDt.length === 8 ? `${rawDt.slice(0, 4)}-${rawDt.slice(4, 6)}-${rawDt.slice(6, 8)}` : rawDt;
                return {
                  date,
                  open: Number(item.openPrice || item.closePrice),
                  high: Number(item.highPrice || item.closePrice),
                  low: Number(item.lowPrice || item.closePrice),
                  close: Number(item.closePrice),
                  volume: Number(item.accumulatedTradingVolume || 0)
                };
              });

              const currentPrice = history[history.length - 1].close;
              const previousClose = history.length > 1 ? history[history.length - 2].close : currentPrice;
              data = {
                symbol: upper,
                currency: 'USD',
                currentPrice,
                previousClose,
                history
              };
              break;
            }
          }
        } catch {
          continue;
        }
      }
    }

    // ══════════════════════════════════════════════
    // B. [2순위] 야후 파이낸스 차트 API (네이버 실패 또는 1년/3년 장기 데이터 보완)
    // ══════════════════════════════════════════════
    const needsLongerHistory =
      ((period === '1y') && data && data.history && data.history.length < 150) ||
      ((period === '3y') && data && data.history && data.history.length < 550);

    if (!data || needsLongerHistory) {
      let yahooSymbol = symbol;
      if (isDomestic && !yahooSymbol.includes('.')) {
        yahooSymbol = `${cleanCode}.KS`;
      }

      const tryYahoo = async (sym) => {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=${yahooRange}&interval=1d`;
          const res = await fetch(url, { headers: standardHeaders, next: { revalidate: 300 } });
          if (!res.ok) return null;
          const json = await res.json();
          const result = json?.chart?.result?.[0];
          if (!result) return null;

          const meta = result.meta || {};
          const timestamps = result.timestamp || [];
          const quote = result.indicators?.quote?.[0] || {};
          const closes = quote.close || [];
          const opens = quote.open || [];
          const highs = quote.high || [];
          const lows = quote.low || [];
          const volumes = quote.volume || [];

          const history = [];
          for (let i = 0; i < timestamps.length; i++) {
            const ts = timestamps[i];
            const close = closes[i];
            if (!ts || close == null || isNaN(close)) continue;
            const d = new Date(ts * 1000);
            const dateStr = d.toISOString().split('T')[0];
            history.push({
              date: dateStr,
              close: Number(close.toFixed(2)),
              open: Number((opens[i] || close).toFixed(2)),
              high: Number((highs[i] || close).toFixed(2)),
              low: Number((lows[i] || close).toFixed(2)),
              volume: Number(volumes[i] || 0)
            });
          }

          if (history.length === 0) return null;

          const currentPrice = meta.regularMarketPrice || history[history.length - 1].close;
          const previousClose = meta.chartPreviousClose || meta.previousClose || (history.length > 1 ? history[history.length - 2].close : currentPrice);

          return {
            symbol: sym,
            currency: meta.currency || (isDomestic ? 'KRW' : 'USD'),
            currentPrice,
            previousClose,
            history
          };
        } catch {
          return null;
        }
      };

      let yahooData = await tryYahoo(yahooSymbol);
      if (!yahooData && isDomestic && !symbol.includes('.KQ')) {
        yahooData = await tryYahoo(`${cleanCode}.KQ`);
      }

      if (yahooData) {
        data = yahooData;
      }
    }

    if (!data || !data.history || data.history.length === 0) {
      return NextResponse.json({ error: '주가 히스토리 데이터를 불러올 수 없습니다.' }, { status: 404 });
    }

    // 선택된 기간(1m, 3m, 6m, 1y, 3y)에 맞게 히스토리 필터링
    const latestDateStr = data.history[data.history.length - 1]?.date;
    if (latestDateStr) {
      const cutoff = new Date(latestDateStr);
      if (period === '1m') cutoff.setMonth(cutoff.getMonth() - 1);
      else if (period === '3m') cutoff.setMonth(cutoff.getMonth() - 3);
      else if (period === '6m') cutoff.setMonth(cutoff.getMonth() - 6);
      else if (period === '3y') cutoff.setFullYear(cutoff.getFullYear() - 3);
      else cutoff.setFullYear(cutoff.getFullYear() - 1);

      const cutoffStr = cutoff.toISOString().split('T')[0];
      const filtered = data.history.filter((d) => d.date >= cutoffStr);
      if (filtered.length >= 5) {
        data.history = filtered;
      }
    }

    // 최신 실시간 현재가 확인 및 보정 (있을 경우 최신 가격으로 덮어씀)
    try {
      const priceRes = await fetch(new URL(`/api/stock-price?symbol=${encodeURIComponent(symbol)}`, request.url));
      if (priceRes.ok) {
        const priceData = await priceRes.json();
        if (priceData && priceData.price > 0) {
          data.currentPrice = priceData.price;
        }
      }
    } catch {
      // 실시간 실패 시 히스토리 최신가 유지
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API/stock-history] 오류:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
