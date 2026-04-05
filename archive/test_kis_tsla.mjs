// 1. 환경 변수 설정
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://tjmajybdygdcvwxfdlgf.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_uMjU8UnWjo2ecDE5agAAKw_vHYeJxnY';
process.env.KIS_API_URL = 'https://openapi.koreainvestment.com:9443';
process.env.KIS_APP_EXCHANGE_KEY = 'PSNfE344snWOerNumDAWu9CtTjqJz2dWlNQk';
process.env.KIS_APP_EXCHANGE_SECRET = 'be4F9R/sdLK+9p/kmYrUuBFqtEIvr+M7O3N/NfNBYD55BViZrxbdApEcM9pScCimgwycxThJ1a53NpxtJuHcSb6WreJOqozAl3nzDTxBJywMsB5AxNf8EqQjCX1fhZzVmMGMC8tLOlZFP8DUVW9jy03hxC0Tq8YY9WgpE1hZ8SHPZiAtJjE=';

// 2. 모듈 동적 임포트
const { default: KISApiManager } = await import('./src/lib/kisApi.js');

async function testSearchTSLA() {
  console.log(`[테스트] KIS에서 'TSLA' 검색을 시도합니다.`);
  try {
    const results = await KISApiManager.searchDomesticStock('TSLA');
    if (results.length > 0) {
      console.log(`✅ 결과 (${results.length}건 발견):`);
      results.forEach(r => console.log(`   - 종목명: ${r.name} | 코드: ${r.code} | 시장: ${r.market} | 시장코드: ${r.market_id}`));
    } else {
      console.warn(`⚠️ KIS에서 'TSLA' 종목을 찾을 수 없습니다. (국내 검색 API 한계)`);
    }
  } catch (error) {
    console.error('❌ 검색 중 오류:', error.message);
  }
}

testSearchTSLA();
