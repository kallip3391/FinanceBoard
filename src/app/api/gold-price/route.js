import { NextResponse } from 'next/server';

/**
 * GET /api/gold-price
 * 
 * 1. 우선순위 1: 공공데이터포털(금융위원회_일반상품시세정보) - getGoldPriceInfo_V2
 * 2. 폴백(Fallback): 네이버페이 증권 모바일 API (M04020000: KRX 금 99.99 1Kg)
 * 
 * KRX 금현물 1g당 원화 시세(KRW/g), 전일대비 등락폭, 등락률, 기준일자 반환
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetItem = searchParams.get('item'); // e.g. '1kg' or '100g' (기본값: 1kg)

  const SERVICE_KEY = process.env.PUBLIC_DATA_SERVICE_KEY;

  // 1. 공공데이터포털 API 시도
  if (SERVICE_KEY) {
    try {
      const publicDataUrl = `https://apis.data.go.kr/1160100/GetGeneralProductInfoService_V2/getGoldPriceInfo_V2?serviceKey=${SERVICE_KEY}&resultType=json&numOfRows=10`;
      
      const res = await fetch(publicDataUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        next: { revalidate: 60 } // 60초 캐싱으로 API 호출 최적화
      });

      if (res.ok) {
        const data = await res.json();
        const rawItems = data?.response?.body?.items?.item;

        if (rawItems) {
          const list = Array.isArray(rawItems) ? rawItems : [rawItems];
          
          if (list.length > 0) {
            // 기준일자(basDt)가 가장 최신인 데이터 중 1Kg(대표) 및 100g 분류
            const parsedList = list.map(item => {
              const rawPrice = String(item.clpr || '0').replace(/,/g, '');
              const rawFltp = String(item.fltp || '0').replace(/,/g, '');
              const rawFltRt = String(item.fltRt || '0').replace(/,/g, '');
              const basDt = String(item.basDt || '');

              const formattedDate = basDt.length === 8 
                ? `${basDt.slice(0, 4)}-${basDt.slice(4, 6)}-${basDt.slice(6, 8)}`
                : basDt;

              return {
                name: item.itmsNm || '금 99.99 1Kg',
                code: item.srtnCd || '',
                price: parseFloat(rawPrice) || 0,
                change: parseFloat(rawFltp) || 0,
                changeRate: parseFloat(rawFltRt) || 0,
                date: formattedDate,
                rawDate: basDt,
                openPrice: parseFloat(String(item.mkp || '0').replace(/,/g, '')) || 0,
                highPrice: parseFloat(String(item.hipr || '0').replace(/,/g, '')) || 0,
                lowPrice: parseFloat(String(item.lopr || '0').replace(/,/g, '')) || 0,
                volume: parseFloat(String(item.trqu || '0').replace(/,/g, '')) || 0,
                tradingValue: parseFloat(String(item.trPrc || '0').replace(/,/g, '')) || 0
              };
            });

            // 사용자가 특정 종목(100g)을 요청했거나, 기본 대표 종목(1Kg) 선택
            let selected = parsedList[0];
            if (targetItem === '100g') {
              const found100g = parsedList.find(p => p.name.includes('100g'));
              if (found100g) selected = found100g;
            } else {
              const found1kg = parsedList.find(p => p.name.includes('1Kg') || p.name.includes('1kg'));
              if (found1kg) selected = found1kg;
            }

            return NextResponse.json({
              success: true,
              source: 'public-data',
              name: selected.name,
              code: selected.code,
              price: selected.price,
              change: selected.change,
              changeRate: selected.changeRate,
              date: selected.date,
              openPrice: selected.openPrice,
              highPrice: selected.highPrice,
              lowPrice: selected.lowPrice,
              items: parsedList
            });
          }
        }
      } else {
        console.warn(`[API/GoldPrice] 공공데이터포털 응답 상태 이상: ${res.status}`);
      }
    } catch (err) {
      console.error('[API/GoldPrice] 공공데이터포털 조회 중 오류:', err.message);
    }
  }

  // 2. 폴백(Fallback): 네이버페이 증권 모바일 API
  try {
    const naverUrl = 'https://m.stock.naver.com/front-api/v1/marketIndex/prices?category=metals&reutersCode=M04020000&page=1&pageSize=1';
    const naverRes = await fetch(naverUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      next: { revalidate: 60 }
    });

    if (naverRes.ok) {
      const naverData = await naverRes.json();
      const latest = naverData?.result?.[0];

      if (latest) {
        const rawPrice = String(latest.closePrice || '0').replace(/,/g, '');
        const rawFltp = String(latest.fluctuations || '0').replace(/,/g, '');
        const rawFltRt = String(latest.fluctuationsRatio || '0').replace(/,/g, '');

        return NextResponse.json({
          success: true,
          source: 'naver-marketindex-fallback',
          name: '금 99.99 1Kg',
          code: 'M04020000',
          price: parseFloat(rawPrice) || 0,
          change: parseFloat(rawFltp) || 0,
          changeRate: parseFloat(rawFltRt) || 0,
          date: latest.localTradedAt || '',
          openPrice: parseFloat(String(latest.openPrice || '0').replace(/,/g, '')) || 0,
          highPrice: parseFloat(String(latest.highPrice || '0').replace(/,/g, '')) || 0,
          lowPrice: parseFloat(String(latest.lowPrice || '0').replace(/,/g, '')) || 0,
          items: []
        });
      }
    }
  } catch (err) {
    console.error('[API/GoldPrice] 네이버 폴백 조회 중 오류:', err.message);
  }

  return NextResponse.json(
    { error: 'KRX 금시세 데이터를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.' },
    { status: 500 }
  );
}
