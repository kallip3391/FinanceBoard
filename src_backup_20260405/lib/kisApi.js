import { supabase } from './supabase.js';

/**
 * KIS (Korea Investment & Securities) API Manager
 * 한국투자증권 OpenAPI 연동 관리 클래스
 *
 * 토큰 관리 흐름:
 * 1. user_id로 DB 조회 → 없음 → KIS 신규발급 → DB INSERT
 * 2. user_id로 DB 조회 → 없음 → KIS 신규발급 → DB INSERT
 * 3. user_id로 DB 조회 → 있음 → expired_at 만기됨 → 신규발급 → DB UPDATE
 * 4. user_id로 DB 조회 → 있음 → expired_at 유효함 → DB 값 그대로 사용
 */

class KISApiManager {
  static token = null;
  static tokenExpiredAt = null;

  static async getAccessToken() {
    const appKey = process.env.KIS_APP_EXCHANGE_KEY;
    const appSecret = process.env.KIS_APP_EXCHANGE_SECRET;
    const apiUrl = process.env.KIS_API_URL;

    if (!appKey || !appSecret || !apiUrl) {
      throw new Error('KIS API 설정이 누락되었습니다. (.env.local 확인)');
    }

    // Step 1. 현재 로그인한 구글 사용자 ID 확인
    let userId = null;
    try {
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id;
      }
    } catch {
      console.warn('[KIS] 사용자 정보 확인 불가');
    }

    // 로그인 안된 경우: 인메모리 캐시만 사용 (DB 저장 없이)
    if (!userId) {
      if (this.token && this.tokenExpiredAt && Date.now() < this.tokenExpiredAt) {
        return this.token;
      }
      return await this._issueNewToken(apiUrl, appKey, appSecret, null);
    }

    // Step 2. DB에서 user_id 기준으로 기존 토큰 조회
    if (supabase) {
      try {
        const { data: tokenData } = await supabase
          .from('api_tokens')
          .select('access_token, expired_at')
          .eq('user_id', userId)
          .eq('service_name', 'KIS')
          .single();

        if (tokenData) {
          const expiredAt = new Date(tokenData.expired_at).getTime();

          // 케이스 4: DB 있음 + 만기 전 → DB 값 그대로 사용
          if (Date.now() < expiredAt) {
            console.log('[KIS] 케이스4: DB 유효 토큰 재사용');
            this.token = tokenData.access_token;
            this.tokenExpiredAt = expiredAt;
            return tokenData.access_token;
          }

          // 케이스 3: DB 있음 + 만기됨 → 신규발급 후 DB UPDATE
          console.log('[KIS] 케이스3: DB 토큰 만료 → 신규 발급 후 UPDATE');
          return await this._issueNewToken(apiUrl, appKey, appSecret, userId);

        } else {
          // 케이스 1,2: DB 없음 → 신규 발급 후 DB INSERT
          console.log('[KIS] 케이스1,2: DB 토큰 없음 → 신규 발급 후 INSERT');
          return await this._issueNewToken(apiUrl, appKey, appSecret, userId);
        }

      } catch (e) {
        console.warn('[KIS] DB 조회 오류:', e.message);
      }
    }

    // Fallback: DB 연결 실패 시 인메모리 사용
    if (this.token && this.tokenExpiredAt && Date.now() < this.tokenExpiredAt) {
      return this.token;
    }
    return await this._issueNewToken(apiUrl, appKey, appSecret, null);
  }

  // KIS 토큰 신규 발급 후 DB upsert (없으면 INSERT, 있으면 UPDATE)
  static async _issueNewToken(apiUrl, appKey, appSecret, userId) {
    console.log('[KIS] KIS 서버에 신규 토큰 발급 요청...');
    const response = await fetch(`${apiUrl}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: appKey,
        appsecret: appSecret
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`KIS 토큰 발급 실패: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const newToken = data.access_token;
    // expires_in은 초 단위 (보통 86400 = 24시간)
    const newExpiredAt = new Date(Date.now() + (data.expires_in * 1000)).toISOString();

    // 인메모리 캐시 갱신
    this.token = newToken;
    this.tokenExpiredAt = new Date(newExpiredAt).getTime();

    // DB upsert: userId 있는 경우에만 (없으면 INSERT, 있으면 UPDATE)
    if (userId && supabase) {
      try {
        const { error } = await supabase
          .from('api_tokens')
          .upsert({
            user_id: userId,
            service_name: 'KIS',
            access_token: newToken,
            expired_at: newExpiredAt,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,service_name' });

        if (error) {
          console.warn('[KIS] DB 저장 오류:', error.message);
        } else {
          console.log('[KIS] 토큰 DB 저장 완료 (INSERT or UPDATE)');
        }
      } catch (e) {
        console.warn('[KIS] DB 저장 예외:', e.message);
      }
    }

    return newToken;
  }

  static async searchDomesticStock(searchTerm) {
    if (!searchTerm || searchTerm.trim().length < 2) return [];

    try {
      const token = await this.getAccessToken();
      const appKey = process.env.KIS_APP_EXCHANGE_KEY;
      const appSecret = process.env.KIS_APP_EXCHANGE_SECRET;
      const apiUrl = process.env.KIS_API_URL;

      const term = searchTerm.trim();
      const isCode = /^\d+$/.test(term);

      // 코드 검색: 주권(300) → ETF(400) → ETN(500) 순서로 조회
      if (isCode) {
        const productTypes = [
          { cd: '300', label: '주권' },
          { cd: '400', label: 'ETF' },
          { cd: '500', label: 'ETN' }
        ];

        for (const pt of productTypes) {
          console.log(`[KIS] 코드 조회 시도 (${pt.label}): ${term}`);
          try {
            const url = `${apiUrl}/uapi/domestic-stock/v1/quotations/search-stock-info?PRDT_TYPE_CD=${pt.cd}&PDNO=${term}`;
            const response = await fetch(url, {
              headers: {
                'Content-Type': 'application/json',
                'authorization': `Bearer ${token}`,
                'appkey': appKey,
                'appsecret': appSecret,
                'tr_id': 'CTPF1604R',
                'custtype': 'P'
              }
            });

            if (response.ok) {
              const data = await response.json();
              const out = data.output;
              // 약식명 우선, 없으면 정식명
              const name = out?.prdt_abrv_name || out?.prdt_abrv_nm || out?.prdt_name;
              // shtn_pdno가 있으면 사용 (6자리 단축코드), 없으면 pdno 후미 6자리
              const code = out?.shtn_pdno || (out?.pdno?.length > 6 ? out.pdno.slice(-6) : out?.pdno);

              if (out && name && code) {
                console.log(`[KIS] ${pt.label} 발견: ${name} (${code})`);
                return [{
                  name,
                  code,
                  market: out.prdt_clsf_name || pt.label,
                  market_id: out.mket_id_cd || 'STK',
                  type: pt.label
                }];
              }
            }
          } catch (e) {
            console.warn(`[KIS] ${pt.label}(${pt.cd}) 조회 오류:`, e.message);
          }
        }

        // 코드로 CTPF1604R 전부 실패 시 통합검색 시도
        console.log(`[KIS] 코드 기반 통합검색 시도: ${term}`);
        try {
          const searchUrl = `${apiUrl}/uapi/domestic-stock/v1/quotations/search-info?PRDT_NM=&PDNO=${term}`;
          const sResponse = await fetch(searchUrl, {
            headers: {
              'Content-Type': 'application/json',
              'authorization': `Bearer ${token}`,
              'appkey': appKey,
              'appsecret': appSecret,
              'tr_id': 'CTRP6541R',
              'custtype': 'P'
            }
          });
          if (sResponse.ok) {
            const sData = await sResponse.json();
            if (sData.output && Array.isArray(sData.output) && sData.output.length > 0) {
              return sData.output.map(item => ({
                name: item.prdt_abrv_name || item.prdt_abrv_nm || item.prdt_name,
                code: item.shtn_pdno || (item.pdno?.length > 6 ? item.pdno.slice(-6) : item.pdno),
                market: item.mket_id_cd_nm || '국내',
                market_id: item.mket_id_cd || 'STK',
                type: item.prdt_type_cd_nm
              }));
            }
          }
        } catch (e) {
          console.warn('[KIS] 통합검색 오류:', e.message);
        }

        return [];
      }

      // 이름 검색: 통합검색(CTRP6541R)
      console.log(`[KIS] 이름 기반 통합검색: ${term}`);
      try {
        const searchUrl = `${apiUrl}/uapi/domestic-stock/v1/quotations/search-info?PRDT_NM=${encodeURIComponent(term)}&PDNO=`;
        const sResponse = await fetch(searchUrl, {
          headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${token}`,
            'appkey': appKey,
            'appsecret': appSecret,
            'tr_id': 'CTRP6541R',
            'custtype': 'P'
          }
        });
        if (sResponse.ok) {
          const sData = await sResponse.json();
          if (sData.output && Array.isArray(sData.output)) {
            const results = sData.output.map(item => ({
              name: item.prdt_abrv_name || item.prdt_abrv_nm || item.prdt_name,
              code: item.shtn_pdno || (item.pdno?.length > 6 ? item.pdno.slice(-6) : item.pdno),
              market: item.mket_id_cd_nm || '국내',
              market_id: item.mket_id_cd || 'STK',
              type: item.prdt_type_cd_nm
            }));
            // 중복 제거
            return results.reduce((acc, cur) => {
              if (!acc.find(i => i.code === cur.code)) acc.push(cur);
              return acc;
            }, []);
          }
        }
      } catch (e) {
        console.error('[KIS] 이름 기반 통합검색 오류:', e.message);
      }

      return [];

    } catch (error) {
      console.error('[KIS] 전체 검색 프로세스 오류:', error.message);
      return [];
    }
  }
}

export default KISApiManager;

