// 1. 환경 변수 설정
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://tjmajybdygdcvwxfdlgf.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_uMjU8UnWjo2ecDE5agAAKw_vHYeJxnY';
process.env.KIS_API_URL = 'https://openapi.koreainvestment.com:9443';
process.env.KIS_APP_EXCHANGE_KEY = 'PSNfE344snWOerNumDAWu9CtTjqJz2dWlNQk';
process.env.KIS_APP_EXCHANGE_SECRET = 'be4F9R/sdLK+9p/kmYrUuBFqtEIvr+M7O3N/NfNBYD55BViZrxbdApEcM9pScCimgwycxThJ1a53NpxtJuHcSb6WreJOqozAl3nzDTxBJywMsB5AxNf8EqQjCX1fhZzVmMGMC8tLOlZFP8DUVW9jy03hxC0Tq8YY9WgpE1hZ8SHPZiAtJjE=';

// 2. 모듈 동적 임포트
const { supabase } = await import('./src/lib/supabase.js');

async function testManualTokenSync() {
  const userId = '354f88af-198f-4cc2-a570-5a92fa84bc3f';
  console.log(`[테스트 시작] 사용자 ID: ${userId} 에 대한 KIS 토큰 발급 및 저장을 시도합니다.`);

  try {
    // KIS 토큰 발급 (서버 직접 호출)
    console.log('1. KIS 서버에 토큰 발급 요청 중...');
    const response = await fetch(`${process.env.KIS_API_URL}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: process.env.KIS_APP_EXCHANGE_KEY,
        appsecret: process.env.KIS_APP_EXCHANGE_SECRET
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('2. 토큰 발급 성공!');
      
      const expiredAt = new Date(Date.now() + (data.expires_in * 1000)).toISOString();
      const now = new Date().toISOString();

      console.log('3. Supabase api_tokens 테이블에 upsert 시도...');
      const { data: result, error: upsertError } = await supabase
        .from('api_tokens')
        .upsert({
          user_id: userId,
          service_name: 'kis',
          access_token: data.access_token,
          expired_at: expiredAt,
          updated_at: now
        }, {
          onConflict: 'user_id,service_name'
        })
        .select();

      if (upsertError) {
        console.error('❌ DB 저장 실패:', upsertError.message);
        if (upsertError.message.includes('permission denied')) {
            console.warn('⚠️ RLS 정책 때문에 차단되었을 수 있습니다. DB 설정을 확인해주세요.');
        }
      } else {
        console.log('✅ DB 수록 성공! 해당 사용자의 KIS 토큰이 업데이트되었습니다.');
        console.log('저장된 데이터 확인:', JSON.stringify(result, null, 2));
      }
    } else {
      const err = await response.json();
      console.error('❌ KIS 응답 오류:', JSON.stringify(err));
    }
  } catch (err) {
    console.error('❌ 실행 중 예외 발생:', err.message);
  }
}

testManualTokenSync();
