import { NextResponse } from 'next/server';

const standardHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*'
};

// 시세 인메모리 캐시 (TTL: 30분)
const historyMemoryCache = new Map();
const HISTORY_CACHE_TTL = 30 * 60 * 1000;

// 야후 파이낸스 일봉 시세 호출 (최대 10년, query1 -> query2 미러 자동 폴백)
async function fetchYahooHistory(symbol, range = '5y') {
  const cacheKey = `yahoo_${symbol}_${range}`;
  const cached = historyMemoryCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < HISTORY_CACHE_TTL)) {
    return cached.data;
  }

  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
      const res = await fetch(url, { headers: standardHeaders, signal: AbortSignal.timeout(5000), next: { revalidate: 3600 } });
      if (!res.ok) continue;
      const json = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result) continue;

      const timestamps = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];
      const historyMap = new Map();

      for (let i = 0; i < timestamps.length; i++) {
        const ts = timestamps[i];
        const close = closes[i];
        if (!ts || close == null || isNaN(close) || close <= 0) continue;
        const d = new Date(ts * 1000);
        const dateStr = d.toISOString().split('T')[0];
        historyMap.set(dateStr, Number(close.toFixed(2)));
      }

      if (historyMap.size > 0) {
        historyMemoryCache.set(cacheKey, { data: historyMap, timestamp: Date.now() });
        return historyMap;
      }
    } catch (err) {
      console.warn(`[fetchYahooHistory] ${host} 실패 (${symbol}):`, err.message);
    }
  }
  return null;
}

// 네이버 국내 종목 일봉 시세
async function fetchNaverDomesticHistory(code, count = 2800) {
  const cleanCode = code.replace(/\.(KS|KQ)$/i, '').trim();
  const cacheKey = `naver_${cleanCode}_${count}`;
  const cached = historyMemoryCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < HISTORY_CACHE_TTL)) {
    return cached.data;
  }

  try {
    const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${cleanCode}&timeframe=day&count=${count}&requestType=0`;
    const res = await fetch(url, { headers: standardHeaders, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const xml = await res.text();
    const items = xml.match(/<item data="([^"]+)"/g) || [];
    const historyMap = new Map();

    items.forEach((tag) => {
      const raw = tag.replace('<item data="', '').replace('"', '');
      const parts = raw.split('|');
      const dStr = parts[0];
      const date = `${dStr.slice(0, 4)}-${dStr.slice(4, 6)}-${dStr.slice(6, 8)}`;
      const close = Number(parts[4]);
      if (close > 0) {
        historyMap.set(date, close);
      }
    });

    if (historyMap.size > 0) {
      historyMemoryCache.set(cacheKey, { data: historyMap, timestamp: Date.now() });
    }

    return historyMap;
  } catch (err) {
    console.warn(`[fetchNaverDomesticHistory] 실패 (${code}):`, err.message);
    return null;
  }
}

// 피어슨 상관계수 계산 함수
function calculateCorrelation(arrA, arrB) {
  const n = Math.min(arrA.length, arrB.length);
  if (n < 5) return 0;

  let sumA = 0, sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += arrA[i];
    sumB += arrB[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const diffA = arrA[i] - meanA;
    const diffB = arrB[i] - meanB;
    num += diffA * diffB;
    denA += diffA * diffA;
    denB += diffB * diffB;
  }

  const den = Math.sqrt(denA * denB);
  if (den === 0) return 0;
  return Number((num / den).toFixed(2));
}

// 직전 거래일 유효 시세(Forward-Fill) 조회 헬퍼 함수
function getPriceOnOrBefore(historyMap, targetDate, fallback = 100) {
  if (!historyMap || historyMap.size === 0) return fallback;
  if (historyMap.has(targetDate)) {
    const val = historyMap.get(targetDate);
    if (val > 0) return val;
  }

  // targetDate 이전 중 가장 최근 거래일 탐색
  const dates = Array.from(historyMap.keys()).sort();
  let latestBefore = null;
  for (let i = 0; i < dates.length; i++) {
    const d = dates[i];
    if (d <= targetDate) {
      const p = historyMap.get(d);
      if (p > 0) latestBefore = p;
    } else {
      break;
    }
  }
  if (latestBefore != null) return latestBefore;

  // targetDate 이전 데이터가 없으면 최초 거래일 시세 반환
  for (let i = 0; i < dates.length; i++) {
    const p = historyMap.get(dates[i]);
    if (p > 0) return p;
  }

  return fallback;
}

export async function POST(request) {
  try {
    const body = await request.json();
    let {
      portfolio = [],
      initialAmount = 10000000,
      monthlyContribution = 500000,
      period = '5y',
      rebalancing = 'quarterly',
      benchmarks = ['SPY', 'QQQ']
    } = body;

    if (!Array.isArray(portfolio) || portfolio.length === 0) {
      return NextResponse.json({ error: '포트폴리오 종목을 1개 이상 설정해 주세요.' }, { status: 400 });
    }

    // 1. 야후 range 결정 (5y, 10y, max)
    const range = period === '1y' ? '2y' : period === '3y' ? '4y' : period === '10y' ? '10y' : period === 'max' ? 'max' : '6y';

    // 2. 환율(KRW=X), 벤치마크(SPY, QQQ), 포트폴리오 종목들 일별 시세 병렬 수집
    const allSymbols = [...portfolio.map(p => p.symbol), 'SPY', 'QQQ', 'KRW=X'];
    const historyMaps = new Map();

    await Promise.all(
      allSymbols.map(async (sym) => {
        const isDomestic = /^\d{6}/.test(sym) || sym.endsWith('.KS') || sym.endsWith('.KQ');
        let hist = null;

        if (isDomestic) {
          // 국내 종목: 네이버 우선 -> 야후 보완 (10년 조회 시 2800일치 확보)
          const naverCount = period === '10y' || period === 'max' ? 2800 : 1500;
          hist = await fetchNaverDomesticHistory(sym, naverCount);
          if (!hist || hist.size < 50) {
            const clean = sym.replace(/\.(KS|KQ)$/i, '');
            hist = await fetchYahooHistory(`${clean}.KS`, range);
            if (!hist) hist = await fetchYahooHistory(`${clean}.KQ`, range);
          }
        } else {
          // 해외 종목 / 환율 / 지수: 야후 파이낸스
          hist = await fetchYahooHistory(sym, range);
        }

        if (hist && hist.size > 0) {
          historyMaps.set(sym, hist);
        }
      })
    );

    // 환율 데이터 확인 (없을 경우 1,350원 고정 폴백)
    const fxMap = historyMaps.get('KRW=X') || new Map();
    const spyMap = historyMaps.get('SPY') || new Map();
    const qqqMap = historyMaps.get('QQQ') || new Map();

    // 3. 종목별 최초 데이터 시작일 및 거래일 수 분석
    const stockInceptionList = [];
    for (const item of portfolio) {
      const hist = historyMaps.get(item.symbol);
      if (!hist || hist.size === 0) {
        return NextResponse.json({ error: `'${item.name || item.symbol}' 종목의 시세 데이터를 불러올 수 없습니다.` }, { status: 400 });
      }
      const sortedDates = Array.from(hist.keys()).sort();
      const firstDate = sortedDates[0];
      const tradingDays = hist.size;

      stockInceptionList.push({
        symbol: item.symbol,
        name: item.name || item.symbol,
        code: item.code || item.symbol,
        firstDate,
        tradingDays
      });
    }

    // 4. 공통 거래일 리스트 추출 헬퍼 함수
    const getCommonDatesInfo = (portList) => {
      let lDate = '2000-01-01';
      let lSym = '';
      portList.forEach(p => {
        const hist = historyMaps.get(p.symbol);
        if (hist) {
          const fDate = Array.from(hist.keys()).sort()[0];
          if (fDate > lDate) {
            lDate = fDate;
            lSym = p.name || p.symbol;
          }
        }
      });
      if (spyMap.size > 0) {
        const spyFirst = Array.from(spyMap.keys()).sort()[0];
        if (spyFirst > lDate) lDate = spyFirst;
      }
      if (qqqMap.size > 0) {
        const qqqFirst = Array.from(qqqMap.keys()).sort()[0];
        if (qqqFirst > lDate) lDate = qqqFirst;
      }

      const dSet = new Set();
      portList.forEach(p => {
        const hist = historyMaps.get(p.symbol);
        if (hist) {
          for (const d of hist.keys()) {
            if (d >= lDate) dSet.add(d);
          }
        }
      });
      if (spyMap.size > 0) {
        for (const d of spyMap.keys()) {
          if (d >= lDate) dSet.add(d);
        }
      }
      return {
        candidateDates: Array.from(dSet).sort(),
        latestInceptionDate: lDate,
        limitingSymbol: lSym
      };
    };

    let { candidateDates, latestInceptionDate, limitingSymbol } = getCommonDatesInfo(portfolio);
    let excludedStocks = [];

    // 상장 기간이 20영업일 미만인 종목 확인
    const shortDaysStocks = stockInceptionList.filter(s => s.tradingDays < 20);

    if (shortDaysStocks.length > 0 || candidateDates.length < 20) {
      // 제외 대상 종목 (자체 거래일 20일 미만 종목 또는 공통 시작일을 촉발한 최근 상장 종목)
      excludedStocks = shortDaysStocks.length > 0
        ? shortDaysStocks
        : stockInceptionList.filter(s => s.firstDate === latestInceptionDate);

      // 문제 종목을 제외한 나머지 유효 종목들
      const remainingPortfolio = portfolio.filter(p => !excludedStocks.some(t => t.symbol === p.symbol));
      const formatTargetLines = (targets) => targets.map((s, idx) => `  ${idx + 1}. ${s.name} : ${s.firstDate}`).join('\n');

      if (remainingPortfolio.length === 0) {
        return NextResponse.json({
          error: `백테스트를 위한 거래일 부족한 종목이 있습니다.\n(최소 20영업일 이상)\n조회 가능한 종목만 적용하겠습니다.\n\n[상장 기간 부족 종목 ( ${excludedStocks.length}개)]\n${formatTargetLines(excludedStocks)}\n\n상장 기간이 부족한 종목을 제외해 주세요.`,
          excludedStocks,
          shortTitle: "거래일이 부족한 종목이 있습니다."
        }, { status: 400 });
      }

      // 나머지 종목들로 비중을 100%로 재조정(normalize)하여 백테스트 계속 진행!
      const validTotalWeight = remainingPortfolio.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);
      portfolio = remainingPortfolio.map(p => ({
        ...p,
        weight: validTotalWeight > 0 ? (p.weight / validTotalWeight) * 100 : (100 / remainingPortfolio.length)
      }));

      // 재조정된 포트폴리오로 공통 시작일 및 거래일 재계산
      const recomputed = getCommonDatesInfo(portfolio);
      candidateDates = recomputed.candidateDates;
      latestInceptionDate = recomputed.latestInceptionDate;
      limitingSymbol = recomputed.limitingSymbol;

      if (candidateDates.length < 20) {
        return NextResponse.json({
          error: `백테스트를 위한 거래일 부족한 종목이 있습니다.\n(최소 20영업일 이상)\n조회 가능한 종목만 적용하겠습니다.\n\n[상장 기간 부족 종목 ( ${excludedStocks.length}개)]\n${formatTargetLines(excludedStocks)}\n\n상장 기간이 부족한 종목을 제외해 주세요.`,
          excludedStocks,
          shortTitle: "거래일이 부족한 종목이 있습니다."
        }, { status: 400 });
      }
    }

    // 5. 시뮬레이션 변수 초기화
    let currentInvested = initialAmount;

    // 종목별 보유 주식수 초기화
    const shares = {};
    portfolio.forEach(p => { shares[p.symbol] = 0; });
    let spyShares = 0;
    let qqqShares = 0;

    // 환율 고정 시뮬레이션용 (환율 기여도 계산용)
    const fixedFxShares = {};
    portfolio.forEach(p => { fixedFxShares[p.symbol] = 0; });

    // 시작일(Day 0) 매수
    const startDate = candidateDates[0];

    // 활성 시세 Forward-Fill 추적 객체 (휴일 등으로 시세 누락 시 직전 유효 시세 자동 유지)
    const activePrices = {
      fx: getPriceOnOrBefore(fxMap, startDate, 1350),
      spy: getPriceOnOrBefore(spyMap, startDate, 380),
      qqq: getPriceOnOrBefore(qqqMap, startDate, 300)
    };

    portfolio.forEach(p => {
      const hist = historyMaps.get(p.symbol);
      activePrices[p.symbol] = getPriceOnOrBefore(hist, startDate, 10000);
    });

    const initialFx = activePrices.fx;
    let lastFx = initialFx;
    const fixedFxBase = initialFx;

    portfolio.forEach(p => {
      const price = activePrices[p.symbol];
      const allocWon = initialAmount * (p.weight / 100);

      if (p.currency === 'USD' || !p.symbol.endsWith('.KS')) {
        // 해외: 원화 -> 달러 환전 매수
        const dollarAmount = allocWon / initialFx;
        shares[p.symbol] = dollarAmount / price;
        fixedFxShares[p.symbol] = dollarAmount / price;
      } else {
        // 국내: 원화 그대로 매수
        shares[p.symbol] = allocWon / price;
        fixedFxShares[p.symbol] = allocWon / price;
      }
    });

    const initialSpyPrice = activePrices.spy;
    spyShares = (initialAmount / initialFx) / initialSpyPrice;

    const initialQqqPrice = activePrices.qqq;
    qqqShares = (initialAmount / initialFx) / initialQqqPrice;

    // 6. 일별 시뮬레이션 루프
    const chartSeries = [];
    let peakValue = initialAmount;
    let maxDrawdown = 0;

    let peakSpy = initialAmount;
    let maxSpyDrawdown = 0;

    let peakQqq = initialAmount;
    let maxQqqDrawdown = 0;

    let lastMonth = startDate.slice(0, 7);
    let lastQuarter = Math.floor(parseInt(startDate.slice(5, 7), 10) / 3.1);

    const portfolioDailyReturns = [];
    const spyDailyReturns = [];
    const qqqDailyReturns = [];
    let prevPortVal = initialAmount;
    let prevSpyVal = initialAmount;
    let prevQqqVal = initialAmount;

    // 연도별 수익률 추적용
    const yearStats = {};

    candidateDates.forEach((date, dayIdx) => {
      const currentYear = date.slice(0, 4);
      if (!yearStats[currentYear]) {
        yearStats[currentYear] = { startPort: 0, endPort: 0, startSpy: 0, endSpy: 0, startQqq: 0, endQqq: 0 };
      }

      // 시세 및 환율 Forward-Fill 갱신 (오늘 시장이 열렸으면 새 가격, 휴일이면 직전 유효 종가 유지)
      if (fxMap.has(date) && fxMap.get(date) > 0) {
        activePrices.fx = fxMap.get(date);
        lastFx = activePrices.fx;
      }
      if (spyMap.has(date) && spyMap.get(date) > 0) {
        activePrices.spy = spyMap.get(date);
      }
      if (qqqMap.has(date) && qqqMap.get(date) > 0) {
        activePrices.qqq = qqqMap.get(date);
      }
      portfolio.forEach(p => {
        const hist = historyMaps.get(p.symbol);
        if (hist && hist.has(date) && hist.get(date) > 0) {
          activePrices[p.symbol] = hist.get(date);
        }
      });

      const curMonth = date.slice(0, 7);
      const curQuarter = Math.floor(parseInt(date.slice(5, 7), 10) / 3.1);

      // A. 월 적립식 매수 (월이 바뀌는 첫 거래일)
      if (curMonth !== lastMonth && monthlyContribution > 0) {
        currentInvested += monthlyContribution;

        portfolio.forEach(p => {
          const price = activePrices[p.symbol];
          const allocWon = monthlyContribution * (p.weight / 100);

          if (p.currency === 'USD' || !p.symbol.endsWith('.KS')) {
            const dollarAmount = allocWon / lastFx;
            shares[p.symbol] += dollarAmount / price;
            fixedFxShares[p.symbol] += (allocWon / fixedFxBase) / price;
          } else {
            shares[p.symbol] += allocWon / price;
            fixedFxShares[p.symbol] += allocWon / price;
          }
        });

        const spyPrice = activePrices.spy;
        spyShares += (monthlyContribution / lastFx) / spyPrice;

        const qqqPrice = activePrices.qqq;
        qqqShares += (monthlyContribution / lastFx) / qqqPrice;

        lastMonth = curMonth;
      }

      // B. 리밸런싱 실행 (분기별 / 연간)
      const isRebalanceDay = (rebalancing === 'quarterly' && curQuarter !== lastQuarter) ||
                             (rebalancing === 'monthly' && curMonth !== lastMonth) ||
                             (rebalancing === 'annually' && currentYear !== chartSeries[chartSeries.length - 1]?.date.slice(0, 4));

      if (isRebalanceDay && rebalancing !== 'none' && chartSeries.length > 0) {
        let totalCurrentWon = 0;
        portfolio.forEach(p => {
          const price = activePrices[p.symbol];
          const isUsd = p.currency === 'USD' || !p.symbol.endsWith('.KS');
          const wonVal = isUsd ? (shares[p.symbol] * price * lastFx) : (shares[p.symbol] * price);
          totalCurrentWon += wonVal;
        });

        // 비중대로 재배분
        portfolio.forEach(p => {
          const price = activePrices[p.symbol];
          const targetWon = totalCurrentWon * (p.weight / 100);
          const isUsd = p.currency === 'USD' || !p.symbol.endsWith('.KS');

          if (isUsd) {
            shares[p.symbol] = (targetWon / lastFx) / price;
          } else {
            shares[p.symbol] = targetWon / price;
          }
        });

        lastQuarter = curQuarter;
      }

      // C. 당일 총 자산 가치 계산
      let totalPortfolioWon = 0;
      let totalFixedFxWon = 0;
      let domesticTotalWon = 0;
      let foreignTotalWon = 0;
      let foreignTotalUsd = 0;

      portfolio.forEach(p => {
        const price = activePrices[p.symbol];
        const isUsd = p.currency === 'USD' || !p.symbol.endsWith('.KS');

        if (isUsd) {
          const usdVal = shares[p.symbol] * price;
          const wonVal = usdVal * lastFx;
          foreignTotalUsd += usdVal;
          foreignTotalWon += wonVal;
          totalPortfolioWon += wonVal;

          totalFixedFxWon += fixedFxShares[p.symbol] * price * fixedFxBase;
        } else {
          const wonVal = shares[p.symbol] * price;
          domesticTotalWon += wonVal;
          totalPortfolioWon += wonVal;

          totalFixedFxWon += fixedFxShares[p.symbol] * price;
        }
      });

      // 벤치마크 가치 (원화 환산)
      const curSpyPrice = activePrices.spy;
      const curSpyWon = spyShares * curSpyPrice * lastFx;

      const curQqqPrice = activePrices.qqq;
      const curQqqWon = qqqShares * curQqqPrice * lastFx;

      // MDD 계산
      if (totalPortfolioWon > peakValue) peakValue = totalPortfolioWon;
      const portDD = peakValue > 0 ? ((totalPortfolioWon - peakValue) / peakValue) * 100 : 0;
      if (portDD < maxDrawdown) maxDrawdown = portDD;

      if (curSpyWon > peakSpy) peakSpy = curSpyWon;
      const spyDD = peakSpy > 0 ? ((curSpyWon - peakSpy) / peakSpy) * 100 : 0;
      if (spyDD < maxSpyDrawdown) maxSpyDrawdown = spyDD;

      if (curQqqWon > peakQqq) peakQqq = curQqqWon;
      const qqqDD = peakQqq > 0 ? ((curQqqWon - peakQqq) / peakQqq) * 100 : 0;
      if (qqqDD < maxQqqDrawdown) maxQqqDrawdown = qqqDD;

      // 일별 수익률 기록
      if (dayIdx > 0) {
        portfolioDailyReturns.push((totalPortfolioWon - prevPortVal) / prevPortVal);
        spyDailyReturns.push((curSpyWon - prevSpyVal) / prevSpyVal);
        qqqDailyReturns.push((curQqqWon - prevQqqVal) / prevQqqVal);
      }
      prevPortVal = totalPortfolioWon;
      prevSpyVal = curSpyWon;
      prevQqqVal = curQqqWon;

      // 연도별 시작/끝 기록
      if (yearStats[currentYear].startPort === 0) {
        yearStats[currentYear].startPort = totalPortfolioWon;
        yearStats[currentYear].startSpy = curSpyWon;
        yearStats[currentYear].startQqq = curQqqWon;
      }
      yearStats[currentYear].endPort = totalPortfolioWon;
      yearStats[currentYear].endSpy = curSpyWon;
      yearStats[currentYear].endQqq = curQqqWon;

      chartSeries.push({
        date: date.slice(2), // YY-MM-DD
        fullDate: date,
        portfolio: Math.round(totalPortfolioWon),
        fixedFxPort: Math.round(totalFixedFxWon),
        spy: Math.round(curSpyWon),
        qqq: Math.round(curQqqWon),
        invested: Math.round(currentInvested),
        drawdown: Number(portDD.toFixed(2)),
        domesticWon: Math.round(domesticTotalWon),
        foreignWon: Math.round(foreignTotalWon),
        foreignUsd: Math.round(foreignTotalUsd),
        fxRate: Number(lastFx.toFixed(1))
      });
    });

    const finalDay = chartSeries[chartSeries.length - 1];
    const finalPortWon = finalDay.portfolio;
    const finalInvested = finalDay.invested;
    const netProfit = finalPortWon - finalInvested;
    const totalReturnRate = finalInvested > 0 ? (netProfit / finalInvested) * 100 : 0;

    // 환율 효과 계산
    const fixedFxReturnRate = finalInvested > 0 ? ((finalDay.fixedFxPort - finalInvested) / finalInvested) * 100 : 0;
    const fxImpactPct = Number((totalReturnRate - fixedFxReturnRate).toFixed(1));
    const fxProfitWon = Math.round(finalPortWon - finalDay.fixedFxPort);
    const fxProfitUsd = finalDay.fxRate > 0 ? Number((fxProfitWon / finalDay.fxRate).toFixed(2)) : 0;

    // 벤치마크 최종 수익률
    const spyTotalReturn = finalInvested > 0 ? ((finalDay.spy - finalInvested) / finalInvested) * 100 : 0;
    const qqqTotalReturn = finalInvested > 0 ? ((finalDay.qqq - finalInvested) / finalInvested) * 100 : 0;

    // 샤프 지수 계산 (연환산)
    const N = portfolioDailyReturns.length;
    let dailyVariance = 0;
    const meanDaily = portfolioDailyReturns.reduce((a, b) => a + b, 0) / (N || 1);
    portfolioDailyReturns.forEach(r => {
      dailyVariance += Math.pow(r - meanDaily, 2);
    });
    const dailyStd = Math.sqrt(dailyVariance / ((N - 1) || 1));
    const annualStd = dailyStd * Math.sqrt(252);
    const yearsElapsed = N / 252;
    const cagr = yearsElapsed > 0 ? Math.pow(finalPortWon / initialAmount, 1 / yearsElapsed) - 1 : 0;
    const riskFreeRate = 0.035; // 무위험 금리 3.5%
    const sharpeRatio = annualStd > 0 ? Number(((cagr - riskFreeRate) / annualStd).toFixed(2)) : 1.2;

    // 상관계수 계산
    const rSpy = calculateCorrelation(portfolioDailyReturns, spyDailyReturns);
    const rQqq = calculateCorrelation(portfolioDailyReturns, qqqDailyReturns);

    // 종목 간 상관관계 히트맵 매트릭스 계산 (SPY, QQQ가 포트폴리오에 이미 있으면 중복 방지)
    const matrixSymbols = [...portfolio.map(p => p.symbol)];
    const matrixNames = [...portfolio.map(p => p.name || p.symbol)];

    if (!matrixSymbols.some(s => s === 'SPY' || s.startsWith('SPY.'))) {
      matrixSymbols.push('SPY');
      matrixNames.push('S&P 500');
    }
    if (!matrixSymbols.some(s => s === 'QQQ' || s.startsWith('QQQ.'))) {
      matrixSymbols.push('QQQ');
      matrixNames.push('나스닥 100');
    }

    const correlationMatrix = [];

    // 각 종목의 일별 수익률 추출 (Forward-Fill 반영된 시세 기준)
    const symbolReturnsMap = new Map();
    matrixSymbols.forEach(sym => {
      const hist = sym === 'SPY' ? spyMap : sym === 'QQQ' ? qqqMap : historyMaps.get(sym);
      const returns = [];
      let prevP = getPriceOnOrBefore(hist, candidateDates[0], 100);
      for (let i = 1; i < candidateDates.length; i++) {
        const curP = getPriceOnOrBefore(hist, candidateDates[i], prevP);
        returns.push(prevP > 0 ? (curP - prevP) / prevP : 0);
        prevP = curP;
      }
      symbolReturnsMap.set(sym, returns);
    });

    for (let i = 0; i < matrixSymbols.length; i++) {
      const row = [];
      const symA = matrixSymbols[i];
      const retA = symbolReturnsMap.get(symA) || [];

      for (let j = 0; j < matrixSymbols.length; j++) {
        if (i === j) {
          row.push(1.0);
        } else {
          const symB = matrixSymbols[j];
          const retB = symbolReturnsMap.get(symB) || [];
          row.push(calculateCorrelation(retA, retB));
        }
      }
      correlationMatrix.push({
        symbol: matrixSymbols[i],
        name: matrixNames[i],
        values: row
      });
    }

    // 연도별 3개 막대 수익률 비교
    const annualReturns = Object.keys(yearStats).map(yr => {
      const s = yearStats[yr];
      const portRet = s.startPort > 0 ? ((s.endPort - s.startPort) / s.startPort) * 100 : 0;
      const spyRet = s.startSpy > 0 ? ((s.endSpy - s.startSpy) / s.startSpy) * 100 : 0;
      const qqqRet = s.startQqq > 0 ? ((s.endQqq - s.startQqq) / s.startQqq) * 100 : 0;

      return {
        year: yr,
        portfolio: Number(portRet.toFixed(1)),
        spy: Number(spyRet.toFixed(1)),
        qqq: Number(qqqRet.toFixed(1))
      };
    });

    // 화면 차트 렌더링 최적화: 포인트가 너무 많으면(10년치 ~2500일) SVG 곡선 계산과 툴팁 호버 시 굼뜸 현상 발생
    // 재무 지표는 100% 전수 계산되었으며, 프론트엔드 차트용 시리즈만 첫날/마지막날/월말 보존 스마트 다운샘플링 (~600포인트)
    let optimizedChartSeries = chartSeries;
    if (chartSeries.length > 700) {
      const step = Math.ceil(chartSeries.length / 600);
      const sampled = [];
      for (let i = 0; i < chartSeries.length; i++) {
        const isFirst = i === 0;
        const isLast = i === chartSeries.length - 1;
        const isStep = i % step === 0;
        const curDate = chartSeries[i].fullDate;
        const nextDate = i < chartSeries.length - 1 ? chartSeries[i + 1].fullDate : '';
        const isMonthEnd = curDate.slice(0, 7) !== nextDate.slice(0, 7);

        if (isFirst || isLast || isStep || isMonthEnd) {
          sampled.push(chartSeries[i]);
        }
      }
      optimizedChartSeries = sampled;
    }

    return NextResponse.json({
      summary: {
        finalValue: finalPortWon,
        investedCapital: finalInvested,
        netProfit,
        totalReturnRate: Number(totalReturnRate.toFixed(1)),
        domesticWon: finalDay.domesticWon,
        foreignWon: finalDay.foreignWon,
        foreignUsd: finalDay.foreignUsd,
        fxImpactPct,
        fxProfitWon,
        fxProfitUsd,
        maxDrawdown: Number(maxDrawdown.toFixed(1)),
        spyDrawdown: Number(maxSpyDrawdown.toFixed(1)),
        qqqDrawdown: Number(maxQqqDrawdown.toFixed(1)),
        sharpeRatio,
        rSpy,
        rQqq,
        spyTotalReturn: Number(spyTotalReturn.toFixed(1)),
        qqqTotalReturn: Number(qqqTotalReturn.toFixed(1)),
        commonStartDate: latestInceptionDate,
        limitingSymbol,
        daysCount: candidateDates.length
      },
      chartSeries: optimizedChartSeries,
      correlationMatrix: {
        labels: matrixNames,
        symbols: matrixSymbols,
        matrix: correlationMatrix
      },
      annualReturns,
      excludedStocks
    });
  } catch (error) {
    console.error('[API/backtest] 에러:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
