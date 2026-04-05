import { NextResponse } from 'next/server';

/**
 * GET /api/stock-price?symbol=TSLA
 * 야후 파이낸스 API를 서버 측에서 호출하여 CORS 문제를 해결합니다.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  try {
    console.log(`[API/StockPrice] 조회를 시도하는 종목: ${symbol}`);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
        console.error(`[API/StockPrice] 야후 파이낸스 응답 오류 (${symbol}): Status ${response.status}`);
        return NextResponse.json({ error: `종목(${symbol}) 정보를 찾을 수 없습니다.` }, { status: response.status });
    }

    const data = await response.json();
    console.log(`[API/StockPrice] 성공적으로 데이터 로드 완료: ${symbol}`);
    return NextResponse.json(data);

  } catch (error) {
    console.error('[API/StockPrice] Server Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
