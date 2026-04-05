// 1. 환경 변수 설정
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://tjmajybdygdcvwxfdlgf.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_uMjU8UnWjo2ecDE5agAAKw_vHYeJxnY';
process.env.KIS_API_URL = 'https://openapi.koreainvestment.com:9443';
process.env.KIS_APP_EXCHANGE_KEY = 'PSNfE344snWOerNumDAWu9CtTjqJz2dWlNQk';
process.env.KIS_APP_EXCHANGE_SECRET = 'be4F9R/sdLK+9p/kmYrUuBFqtEIvr+M7O3N/NfNBYD55BViZrxbdApEcM9pScCimgwycxThJ1a53NpxtJuHcSb6WreJOqozAl3nzDTxBJywMsB5AxNf8EqQjCX1fhZzVmMGMC8tLOlZFP8DUVW9jy03hxC0Tq8YY9WgpE1hZ8SHPZiAtJjE=';

const { supabase } = await import('./src/lib/supabase.js');

const userId = '354f88af-198f-4cc2-a570-5a92fa84bc3f';
const apiUrl = process.env.KIS_API_URL;
const appKey = process.env.KIS_APP_EXCHANGE_KEY;
const appSecret = process.env.KIS_APP_EXCHANGE_SECRET;
const term = '009830';

async function testAllTypes() {
  const { data: tokenData } = await supabase
    .from('api_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .eq('service_name', 'KIS')
    .maybeSingle();

  if (!tokenData) { console.error('❌ DB 토큰 없음'); return; }
  const token = tokenData.access_token;
  console.log('✅ DB 토큰 로드 성공\n');

  // 모든 상품구분코드 시도
  const types = [
    { cd: '300', name: '주권(300)' },
    { cd: '301', name: '주권/우선주(301)' },
    { cd: '400', name: 'ETF(400)' },
    { cd: '500', name: 'ETN(500)' },
    { cd: '543', name: 'ETF-레버리지(543)' },
    { cd: '544', name: 'ETF-인버스(544)' },
  ];

  for (const t of types) {
    const url = `${apiUrl}/uapi/domestic-stock/v1/quotations/search-stock-info?PRDT_TYPE_CD=${t.cd}&PDNO=${term}`;
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'authorization': `Bearer ${token}`,
        'appkey': appKey,
        'appsecret': appSecret,
        'tr_id': 'CTPF1604R',
        'custtype': 'P'
      }
    });
    const data = await res.json();
    const found = data.output?.prdt_name || data.output?.prdt_abrv_nm;
    if (found) {
      console.log(`✅ [${t.name}] 발견! 종목명: ${found}`);
      console.log('   전체 결과:', JSON.stringify(data.output, null, 2));
    } else {
      console.log(`❌ [${t.name}] 없음: ${(data.msg1 || '').trim()}`);
    }
  }
}

testAllTypes();
