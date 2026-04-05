// TSLA 해외 종목 야후 파이낸스 검색 테스트
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
};

const code = 'TSLA';

async function testOverseas() {
  console.log(`[해외 종목 검색] ${code}\n`);

  // 1. Yahoo Search API
  const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${code}`;
  const searchRes = await fetch(searchUrl, { headers });
  const searchData = await searchRes.json();

  const quotes = searchData.quotes || [];
  const filtered = quotes.filter(q =>
    !q.symbol.endsWith('.KS') && !q.symbol.endsWith('.KQ') &&
    q.quoteType !== 'CRYPTOCURRENCY'
  );

  console.log('Yahoo Search 결과:');
  filtered.forEach(q => {
    const name = q.longname || q.shortname || '';
    const exchangeCode = q.symbol.includes('.') ? q.symbol.split('.')[1] : (q.exchange || '');
    console.log(`  - 종목명: ${name}`);
    console.log(`    code: ${q.symbol}`);
    console.log(`    market: ${q.exchDisp || q.exchange}`);
    console.log(`    exchange_code: ${exchangeCode}`);
    console.log();
  });

  // 2. Yahoo Chart API 검증
  console.log(`[Yahoo Chart 조회] ${code}`);
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${code}?interval=1m&range=1d`;
  const chartRes = await fetch(chartUrl, { headers });
  const chartData = await chartRes.json();
  const meta = chartData?.chart?.result?.[0]?.meta;
  if (meta) {
    console.log(`  - 종목명: ${meta.longName || meta.shortName}`);
    console.log(`  - 현재가: $${meta.regularMarketPrice}`);
    console.log(`  - 거래소: ${meta.exchangeName}`);
    console.log(`  - 통화: ${meta.currency}`);
  }
}

testOverseas();
