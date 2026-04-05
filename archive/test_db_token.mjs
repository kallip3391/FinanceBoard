// 1. 환경 변수 설정
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://tjmajybdygdcvwxfdlgf.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_uMjU8UnWjo2ecDE5agAAKw_vHYeJxnY';
process.env.KIS_API_URL = 'https://openapi.koreainvestment.com:9443';
process.env.KIS_APP_EXCHANGE_KEY = 'PSNfE344snWOerNumDAWu9CtTjqJz2dWlNQk';
process.env.KIS_APP_EXCHANGE_SECRET = 'be4F9R/sdLK+9p/kmYrUuBFqtEIvr+M7O3N/NfNBYD55BViZrxbdApEcM9pScCimgwycxThJ1a53NpxtJuHcSb6WreJOqozAl3nzDTxBJywMsB5AxNf8EqQjCX1fhZzVmMGMC8tLOlZFP8DUVW9jy03hxC0Tq8YY9WgpE1hZ8SHPZiAtJjE=';

// 2. 동적 임포트
const { supabase } = await import('./src/lib/supabase.js');
const { default: KISApiManager } = await import('./src/lib/kisApi.js');

const userId = '354f88af-198f-4cc2-a570-5a92fa84bc3f';

async function testWithDbToken() {
  console.log('[테스트] DB에서 토큰 확인 중...');

  // DB에서 직접 토큰 읽기
  const { data: tokenData, error } = await supabase
    .from('api_tokens')
    .select('access_token, expired_at, updated_at')
    .eq('user_id', userId)
    .eq('service_name', 'KIS')
    .maybeSingle();

  if (error) {
    console.error('❌ DB 조회 오류:', error.message, '| 코드:', error.code, '| 힌트:', error.hint);
    return;
  }
  if (!tokenData) {
    console.warn('⚠️ DB에 해당 사용자의 KIS 토큰이 없습니다.');
    return;
  }

  console.log('✅ DB 토큰 발견!');
  console.log(`   - expired_at: ${tokenData.expired_at}`);
  console.log(`   - updated_at: ${tokenData.updated_at}`);
  console.log(`   - 현재 시각: ${new Date().toISOString()}`);
  console.log(`   - 만기 여부: ${new Date(tokenData.expired_at).getTime() < Date.now() ? '❌ 만기됨' : '✅ 유효함'}`);

  // KISApiManager에 DB 토큰 주입 (터미널에는 세션이 없으므로 강제 주입)
  KISApiManager.token = tokenData.access_token;
  KISApiManager.tokenExpiredAt = new Date(tokenData.expired_at).getTime();

  // 검색 실행
  console.log('\n[검색] 0163Y0 종목 KIS 조회 시작...');
  const results = await KISApiManager.searchDomesticStock('0163Y0');

  if (results && results.length > 0) {
    console.log('✅ 검색 성공! 결과 리스트:');
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.warn('⚠️ KIS에서 0163Y0 결과 없음 → 야후 파이낸스 폴백 처리 예정');
  }
}

testWithDbToken();
