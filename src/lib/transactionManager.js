import { supabase } from './supabase';

// 통화 관련 상수
export const CURRENCIES = {
  KRW: { symbol: '₩', code: 'KRW', name: '한국 원' },
  USD: { symbol: '$', code: 'USD', name: '미국 달러' },
  EUR: { symbol: '€', code: 'EUR', name: '유로' },
  JPY: { symbol: '¥', code: 'JPY', name: '일본 엔' },
  GBP: { symbol: '£', code: 'GBP', name: '영국 파운드' },
  CNY: { symbol: '¥', code: 'CNY', name: '중국 위안' },
  HKD: { symbol: '$', code: 'HKD', name: '홍콩 달러' }
};

// 거래 유형 상수
export const TRANSACTION_TYPES = {
  DOMESTIC: 'domestic',
  OVERSEAS: 'overseas',
  DIVIDEND: 'dividend'
};

// 매수/매도 구분 상수
export const TRADE_TYPES = {
  BUY: 'BUY',
  SELL: 'SELL',
  DIV: 'DIV'
};

// 통합 데이터 관리 클래스
export class TransactionManager {
  // 현재 로그인한 사용자 ID 가져오기
  static async getCurrentUserId() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.warn('사용자 ID 조회 실패:', error.message);
        return null;
      }
      return user?.id;
    } catch (err) {
      console.error('사용자 ID 조회 예외:', err);
      return null;
    }
  }

  static async addAccount(accountData) {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('로그인이 필요합니다.');
    const payload = {
      ...accountData,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase
      .from('accounts')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  // 사용자 인증 상태 확인
  static async isAuthenticated() {
    const { data: { user } } = await supabase.auth.getUser();
    return !!user;
  }

  // 거래내역 조회 (필터링 지원)
  static async getTransactions(filters = {}) {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('로그인이 필요합니다.');

    let query = supabase
      .from('transactions')
      .select('*, security(*)')
      .eq('user_id', userId)
      .eq('mate_stat', '01');

    // 필터링 적용
    if (filters.transaction_type) {
      query = query.eq('transaction_type', filters.transaction_type);
    }
    if (filters.currency) {
      query = query.eq('currency', filters.currency);
    }
    if (filters.security_id) {
      query = query.eq('security_id', filters.security_id);
    }
    if (filters.start_date) {
      query = query.gte('date', filters.start_date);
    }
    if (filters.end_date) {
      query = query.lte('date', filters.end_date);
    }

    // 정렬
    query = query.order('date', { ascending: false });

    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  }

  // 국내 매매내역 조회
  static async getDomesticTransactions(filters = {}) {
    return this.getTransactions({ ...filters, transaction_type: TRANSACTION_TYPES.DOMESTIC });
  }

  // 해외 매매내역 조회
  static async getOverseasTransactions(filters = {}) {
    return this.getTransactions({ ...filters, transaction_type: TRANSACTION_TYPES.OVERSEAS });
  }

  // 배당내역 조회
  static async getDividendTransactions(filters = {}) {
    return this.getTransactions({ ...filters, transaction_type: TRANSACTION_TYPES.DIVIDEND });
  }

  // 계좌 목록 조회
  static async getAccounts() {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('로그인이 필요합니다.');
    const { data, error } = await supabase
      .from('accounts')
      .select('account_id, account_nm, financial_institution, type')
      .eq('user_id', userId)
      .order('account_nm', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  static async isAccountNameExists(accountNm) {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('로그인이 필요합니다.');
    const { data, error } = await supabase
      .from('accounts')
      .select('account_id')
      .eq('user_id', userId)
      .eq('account_nm', accountNm)
      .limit(1);
    if (error) throw error;
    return (data && data.length > 0);
  }

  static async deleteAccountByName(accountNm) {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('로그인이 필요합니다.');
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('user_id', userId)
      .eq('account_nm', accountNm);
    if (error) throw error;
    return true;
  }

  // 거래내역 추가
  static async addTransaction(transactionData) {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('로그인이 필요합니다.');


    const { data, error } = await supabase
      .from('transactions')
      .insert({
        ...transactionData,
        mate_stat: '01',
        alt_sync: true,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();


    if (error) throw error;
    return data?.[0] ?? null;
  }

  // 거래내역 수정
  static async updateTransaction(transactionId, updateData) {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('로그인이 필요합니다.');


    const { data, error } = await supabase
      .from('transactions')
      .update({
        ...updateData,
        alt_sync: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId)
      .eq('user_id', userId)
      .select();


    if (error) throw error;
    return data?.[0] ?? null;
  }

  // 거래내역 삭제
  static async deleteTransaction(transactionId) {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('로그인이 필요합니다.');

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId)
      .eq('user_id', userId); // 추가 보안

    if (error) throw error;
    return true;
  }

  // 거래내역 삭제 (상태값 변경 - Soft Delete)
  static async softDeleteTransaction(transactionId) {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('로그인이 필요합니다.');

    const { error } = await supabase
      .from('transactions')
      .update({
        mate_stat: '03',
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  // 통화별 포맷팅
  static formatCurrency(amount, currency = 'KRW') {
    if (amount === null || amount === undefined) return '-';
    
    // 통화코드 매핑
    const currencySymbolMap = {
      'KRW': '₩',
      'USD': '$',
      'EUR': '€',
      'JPY': '¥',
      'CNY': '¥',
      'GBP': '£',
      'HKD': 'HK$'
    };
    
    const symbol = currencySymbolMap[currency] || currency;
    return `${symbol} ${amount.toLocaleString()}`;
  }

  // 환율 적용 금액 계산
  static calculateLocalAmount(amount, currency, exchangeRate) {
    if (currency === 'KRW' || !exchangeRate) return amount;
    return Math.round(amount * exchangeRate);
  }

  // 데이터 접근 권한 확인
  static async checkDataAccess(transactionId) {
    const userId = await this.getCurrentUserId();
    if (!userId) return false;

    const { data, error } = await supabase
      .from('transactions')
      .select('user_id')
      .eq('id', transactionId)
      .eq('user_id', userId)
      .single();

    if (error || !data) return false;
    return true;
  }

  // 통계 데이터 계산
  static async getStatistics(transactionType = null) {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('로그인이 필요합니다.');

    let query = supabase
      .from('transactions')
      .select('trade_type, amount, currency, transaction_type')
      .eq('user_id', userId)
      .eq('mate_stat', '01');

    if (transactionType) {
      query = query.eq('transaction_type', transactionType);
    }

    const { data, error } = await query;
    if (error) throw error;

    const stats = {
      totalBuy: 0,
      totalSell: 0,
      totalDividend: 0,
      transactionCount: data?.length || 0,
      currencyBreakdown: {}
    };

    data?.forEach(tx => {
      if (tx.transaction_type === TRANSACTION_TYPES.DIVIDEND) {
        stats.totalDividend += tx.total_dividend || 0;
      } else if (tx.trade_type === TRADE_TYPES.BUY) {
        stats.totalBuy += tx.amount || 0;
      } else if (tx.trade_type === TRADE_TYPES.SELL) {
        stats.totalSell += tx.amount || 0;
      }

      // 통화별 집계
      const currency = tx.currency || 'KRW';
      if (!stats.currencyBreakdown[currency]) {
        stats.currencyBreakdown[currency] = 0;
      }
      stats.currencyBreakdown[currency] += tx.amount || 0;
    });

    return stats;
  }

  // 종목 추가
  static async addStock(stockData) {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('로그인이 필요합니다.');


    try {
      const { data, error } = await supabase
        .from('security')
        .insert({
          security_id: crypto.randomUUID(),
          user_id: userId,
          name: stockData.name,
          code: stockData.code,
          sector: stockData.sector,
          currency: stockData.currency || 'KRW',
          exchange_code: stockData.exchange_code || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();


      if (error) {
        console.error('Supabase 에러:', error);
        
        // 테이블이 존재하지 않을 경우의 대체 처리
        if (error.code === 'PGRST205') {
          // 임시: 로컬 스토리지에 저장 (개발용)
          const existingStocks = JSON.parse(localStorage.getItem('userStocks') || '[]');
          existingStocks.push({
            security_id: crypto.randomUUID(),
            user_id: userId,
            name: stockData.name,
            code: stockData.code,
            sector: stockData.sector,
            currency: stockData.currency || 'KRW',
            created_at: new Date().toISOString()
          });
          localStorage.setItem('userStocks', JSON.stringify(existingStocks));
          
          return {
            security_id: crypto.randomUUID(),
            name: stockData.name,
            code: stockData.code,
            sector: stockData.sector,
            currency: stockData.currency || 'KRW',
            created_at: new Date().toISOString()
          };
        }
        
        throw error;
      }
      return data?.[0] ?? null;
    } catch (err) {
      console.error('전체 에러:', err);
      throw err;
    }
  }

  // 종목 목록 조회
  static async getStocks() {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('security')  // stocks -> security로 변경
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // 이름으로 종목 검색
  static async searchStocksByName(name, currency = 'KRW') {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('로그인이 필요합니다.');

    // 1. 내부 DB 검색 수행
    let query = supabase
      .from('security')
      .select('security_id, name, code, sector, currency, exchange_code')
      .eq('user_id', userId);

    if (name && name.trim()) {
      query = query.or(`name.ilike.%${name.trim()}%,code.ilike.%${name.trim()}%`);
    }

    if (currency === 'OVERSEAS') {
      query = query.neq('currency', 'KRW');
    } else if (currency) {
      query = query.eq('currency', currency);
    }

    query = query.order('name', { ascending: true });
    const { data: results, error: localError } = await query;
    if (localError) throw localError;

    // 좌측부터 일치하는 항목(Prefix match)을 우선적으로 상단에 배치
    if (name && name.trim()) {
      const term = name.trim().toUpperCase();
      results.sort((a, b) => {
        const aCode = (a.code || '').toUpperCase();
        const bCode = (b.code || '').toUpperCase();
        const aName = (a.name || '').toUpperCase();
        const bName = (b.name || '').toUpperCase();

        const aCodeMatch = aCode.startsWith(term);
        const bCodeMatch = bCode.startsWith(term);
        const aNameMatch = aName.startsWith(term);
        const bNameMatch = bName.startsWith(term);

        if (aCodeMatch && !bCodeMatch) return -1;
        if (!aCodeMatch && bCodeMatch) return 1;
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;

        return aName.localeCompare(bName, 'ko');
      });
    }

    return results || [];
  }
  static async getExchangeRate(date, fromCurrency = 'USD', toCurrency = 'KRW') {
    if (fromCurrency === toCurrency) return 1;
    
    try {
      // 1. 미래 날짜인 경우 DB/API 조회 없이 즉시 반환 (Frankfurter API 등에서 미래 데이터는 없음)
      const today = new Date();
      if (!date || new Date(date) > today) {
        console.warn(`[ExchangeRate] 미래 일자 환율 조회 시도 (${date}), 조회를 건너뜁니다.`);
        return fromCurrency === 'USD' ? 1350 : 1;
      }

      // 2. Supabase exchange_rates 테이블에서 환율 먼저 조회 (거래일 기준)
      if (toCurrency === 'KRW') {
        const { data: dbData, error: dbError } = await supabase
          .from('exchange_rates')
          .select('rate')
          .eq('exchange_date', date)
          .eq('currency', fromCurrency.toUpperCase())
          .maybeSingle();

        if (dbData && dbData.rate) {
          return dbData.rate;
        }

        if (dbError && Object.keys(dbError).length > 0) {
          console.error('[DB] 환율 조회 중 오류:', dbError);
        } else {
        }
      }

      // 3. DB에 데이터가 없는 경우 외부 API 시도
      try {
        const resp = await fetch(`https://api.frankfurter.app/${date}?from=${fromCurrency}&to=${toCurrency}`);
        if (resp.ok) {
          const data = await resp.json();
          return data.rates[toCurrency];
        }
      } catch (fetchError) {
        console.warn('[API] 환율 fetch 오류:', fetchError.message);
      }
      
      return fromCurrency === 'USD' ? 1350 : 1;

    } catch (error) {
      console.error('환율 조회 전체 오류:', error);
      return 1350;
    }
  }

  // 종목 중복 체크 (이름 또는 코드)
  static async checkStockDuplicate(name, code) {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('로그인이 필요합니다.');
    
    // exact match for name or code
    const { data, error } = await supabase
      .from('security')
      .select('security_id')
      .eq('user_id', userId)
      .or(`name.eq."${name}",code.eq."${code}"`)
      .limit(1);
      
    if (error) throw error;
    return (data && data.length > 0);
  }

  // 종목 삭제
  static async deleteStock(securityId) {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('로그인이 필요합니다.');

    const { error } = await supabase
      .from('security')
      .delete()
      .eq('security_id', securityId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }

  // 자산 트렌드 (일별) 데이터 조회
  static async getDailyTrendData() {
    const userId = await this.getCurrentUserId();
    if (!userId) return [];

    // Supabase 서버의 1,000건 제한을 우회하기 위해 페이지네이션 수행
    let allData = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('v_daily_asset_trends')
        .select('user_id, record_date, total_invest_amount, total_eval_amount, total_daily_profit, total_dividend_amount, total_combined_profit')
        .eq('user_id', userId)
        .order('record_date', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('Error fetching v_daily_asset_trends:', error.message);
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allData = [...allData, ...data];
        from += pageSize;
        // 1,000건보다 적게 오면 마지막 페이지임
        if (data.length < pageSize) {
          hasMore = false;
        }
      }
      
      // 혹시 모를 무한 루프 방지 (최대 10개 페이지 = 10,000건)
      if (allData.length >= 10000) break;
    }

    if (!allData || allData.length === 0) return [];

    // 뷰 레벨에서 이미 일자별 유니크 처리되었으므로 단순 매핑만 수행
    return allData.map(item => {
      // 날짜 파싱 보정 (YY.MM.DD 형식 대응 및 하이픈 통일)
      const recordDateStr = (item.record_date || '').toString().replace(/\./g, '-');
      let rawDate = recordDateStr;
      
      if (recordDateStr.split('-')[0].length === 2 && recordDateStr.includes('-')) {
        rawDate = '20' + recordDateStr;
      }
      
      // 날짜 부분만 추출 (시간 정보 제외)
      const cleanDate = rawDate.split(' ')[0];
      
      const invest = Number(item.total_invest_amount) || 0;
      const evalAmt = Number(item.total_eval_amount) || 0;
      const dividend = Number(item.total_dividend_amount) || 0;
      const combinedProfit = Number(item.total_combined_profit) || 0;

      let profitRate = 0;
      if (invest > 0) {
        // 수익률 = (평가금액 - 매수금액) / 매수금액
        profitRate = ((evalAmt - invest) / invest) * 100;
      }

      return {
        date: cleanDate,
        invest,                      // 매수금액
        eval: evalAmt,               // 평가금액
        dividend,                    // 배당금액
        combinedProfit,              // 총손익금액 (수익+배당)
        profitRate: Number(profitRate.toFixed(2)) // 수익률 (%)
      };
    });
  }

  /**
   * 최신 환율 정보를 가져옵니다. (통화별 최신 exchange_date 기준)
   */
  static async getLatestExchangeRates() {
    // order by date desc to get newest ones first
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('currency, rate, exchange_date')
      .order('exchange_date', { ascending: false });

    if (error) {
      console.error('환율 조회 실패:', error);
      return { 'KRW': 1 };
    }

    const rates = { 'KRW': 1 };
    if (data) {
      data.forEach(item => {
        const cur = (item.currency || '').toUpperCase();
        if (!rates[cur]) {
          rates[cur] = Number(item.rate) || 1;
        }
      });
    }
    return rates;
  }

  /**
   * 종목별 자산 현황 산출 (요청하신 산식 적용)
   * 수량 : trade_type = 'BUY' 의 SUM(quantity) - trade_type ='SELL' 의 SUM(quantity)
   * 매수가 : trade_type = 'BUY' 의 SUM(amount) / trade_type = 'BUY' 의 SUM(quantity)
   */
  static async getHoldingsStatus() {
    const userId = await this.getCurrentUserId();
    if (!userId) return [];

    // 1. 거래 내역과 환율 동시 조회
    const [txs, rates] = await Promise.all([
      this.getTransactions(),
      this.getLatestExchangeRates()
    ]);

    if (!txs || txs.length === 0) return [];

    const holdingsMap = {};

    txs.forEach(tx => {
      const { security_id, trade_type, quantity, amount, currency, security } = tx;
      const code = security?.code || 'UNKNOWN';
      const name = security?.name || 'Unknown';
      
      if (!holdingsMap[security_id]) {
        holdingsMap[security_id] = {
          security_id,
          name,
          code,
          currency: currency || 'KRW',
          buy_qty: 0,
          sell_qty: 0,
          buy_amount: 0,
          current_price: 0 // 현재가는 외부 연동 필요 (일단 0)
        };
      }

      const h = holdingsMap[security_id];
      if (trade_type === TRADE_TYPES.BUY) {
        h.buy_qty += (Number(quantity) || 0);
        h.buy_amount += (Number(amount) || 0);
      } else if (trade_type === TRADE_TYPES.SELL) {
        h.sell_qty += (Number(quantity) || 0);
      }
    });

    // 2. 최종 계산 및 원화 환산
    return Object.values(holdingsMap).map(h => {
      const net_qty = h.buy_qty - h.sell_qty;
      // 매수가 : trade_type = 'BUY' 의 SUM(amount) / trade_type = 'BUY' 의 SUM(quantity)
      const avg_buy_price = h.buy_qty > 0 ? h.buy_amount / h.buy_qty : 0;
      
      // 환율 (최신 데이터)
      const exchange_rate = rates[h.currency.toUpperCase()] || 1;

      return {
        ...h,
        holding_qty: net_qty,
        avg_buy_price: avg_buy_price,
        exchange_rate: exchange_rate,
        // 평가액(원) 상단: 보유수량 * 현재가 * 환율 (현재가는 UI에서 주입 가능하도록 구조 유지)
        invest_amount: net_qty * avg_buy_price
      };
    });
  }
  /**
   * view_transactions 뷰 테이블에서 요약된 보유 현황을 가져옵니다.
   */
  static async getHoldingsFromView() {
    const userId = await this.getCurrentUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('view_transactions')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('뷰 데이터 조회 실패:', error);
      throw error;
    }
    return data || [];
  }

  /**
   * v_monthly_dividend_summary 뷰에서 배당 요약 정보를 가져옵니다.
   */
  static async getMonthlyDividendSummary() {
    const userId = await this.getCurrentUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('v_monthly_dividend_summary')
      .select('*')
      .eq('user_id', userId)
      .order('record_month', { ascending: false });

    if (error) {
      console.error('배당 요약 조회 실패:', error);
      return [];
    }
    return data || [];
  }
}
