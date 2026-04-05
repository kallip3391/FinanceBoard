// 1. 환경 변수 설정
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://tjmajybdygdcvwxfdlgf.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_uMjU8UnWjo2ecDE5agAAKw_vHYeJxnY';
process.env.KIS_API_URL = 'https://openapi.koreainvestment.com:9443';
process.env.KIS_APP_EXCHANGE_KEY = 'PSNfE344snWOerNumDAWu9CtTjqJz2dWlNQk';
process.env.KIS_APP_EXCHANGE_SECRET = 'be4F9R/sdLK+9p/kmYrUuBFqtEIvr+M7O3N/NfNBYD55BViZrxbdApEcM9pScCimgwycxThJ1a53NpxtJuHcSb6WreJOqozAl3nzDTxBJywMsB5AxNf8EqQjCX1fhZzVmMGMC8tLOlZFP8DUVW9jy03hxC0Tq8YY9WgpE1hZ8SHPZiAtJjE=';

// 2. 모듈 동적 임포트
const { default: KISApiManager } = await import('./src/lib/kisApi.js');

async function testSearch(term) {
    console.log(`[테스트] KIS 검색 시도: ${term}`);
    try {
        const results = await KISApiManager.searchDomesticStock(term);
        console.log(`Results for ${term}:`, JSON.stringify(results, null, 2));
    } catch (e) {
        console.error('❌ 테스트 중 오류 발생:', e.message);
    }
}

async function runTests() {
    await testSearch('0163Y0');
    await testSearch('401630');
}

runTests();
