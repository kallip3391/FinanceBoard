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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) return null;
      return session.user.id;
    } catch (err) {
      // 세션 확인 중 발생하는 예외는 조용히 처리 (F5 등에서 발생 가능)
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
    const { data: { session } } = await supabase.auth.getSession();
    return !!session?.user;
  }

  // 거래내역 조회 (필터링 지원)
  static async getTransactions(filters = {}) {
    const userId = await this.getCurrentUserId();
    if (!userId) return []; // 에러 대신 빈 데이터

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
    if (!userId) return [];
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
      .eq('user_id', userId);

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
    const currencySymbolMap = {
      'KRW': '₩', 'USD': '$', 'EUR': '€', 'JPY': '¥', 'CNY': '¥', 'GBP': '£', 'HKD': 'HK$'
    };
    const symbol = currencySymbolMap[currency] || currency;
    return `${symbol} ${amount.toLocaleString()}`;
  }

  // 환율 적용 금액 계산
  static calculateLocalAmount(amount, currency, exchangeRate) {
    if (currency === 'KRW' || !exchangeRate) return amount;
    return Math.round(amount * exchangeRate);
  }

  // 통계 데이터 계산
  static async getStatistics(transactionType = null) {
    const userId = await this.getCurrentUserId();
    if (!userId) return { totalBuy: 0, totalSell: 0, totalDividend: 0, transactionCount: 0, currencyBreakdown: {} };

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
      totalBuy: 0, totalSell: 0, totalDividend: 0, transactionCount: data?.length || 0, currencyBreakdown: {}
    };

    data?.forEach(tx => {
      if (tx.transaction_type === TRANSACTION_TYPES.DIVIDEND) {
        stats.totalDividend += tx.total_dividend || 0;
      } else if (tx.trade_type === TRADE_TYPES.BUY) {
        stats.totalBuy += tx.amount || 0;
      } else if (tx.trade_type === TRADE_TYPES.SELL) {
        stats.totalSell += tx.amount || 0;
      }
      const currency = tx.currency || 'KRW';
      if (!stats.currencyBreakdown[currency]) stats.currencyBreakdown[currency] = 0;
      stats.currencyBreakdown[currency] += tx.amount || 0;
    });

    return stats;
  }

  // 종목 목록 조회
  static async getStocks() {
    const userId = await this.getCurrentUserId();
    if (!userId) return [];
    const { data, error } = await supabase
      .from('security')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // 이름으로 종목 검색
  static async searchStocksByName(name, currency = 'KRW') {
    const userId = await this.getCurrentUserId();
    if (!userId) return [];
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
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  static async getLatestExchangeRates() {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('currency, rate, exchange_date')
      .order('exchange_date', { ascending: false });
    if (error) return { 'KRW': 1 };
    const rates = { 'KRW': 1 };
    if (data) {
      data.forEach(item => {
        const cur = (item.currency || '').toUpperCase();
        if (!rates[cur]) rates[cur] = Number(item.rate) || 1;
      });
    }
    return rates;
  }

  // 자산 트렌드 (일별) 데이터 조회
  static async getDailyTrendData() {
    const userId = await this.getCurrentUserId();
    if (!userId) return [];

    let allData = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('v_daily_asset_trends')
        .select('*')
        .eq('user_id', userId)
        .order('record_date', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) break;
      if (!data || data.length === 0) hasMore = false;
      else {
        allData = [...allData, ...data];
        from += pageSize;
        if (data.length < pageSize) hasMore = false;
      }
      if (allData.length >= 10000) break;
    }

    return allData.map(item => {
      const invest = Number(item.total_invest_amount) || 0;
      const evalAmt = Number(item.total_eval_amount) || 0;
      return {
        date: (item.record_date || '').toString().split(' ')[0].replace(/\./g, '-'),
        invest,
        eval: evalAmt,
        dividend: Number(item.total_dividend_amount) || 0,
        combinedProfit: Number(item.total_combined_profit) || 0,
        profitRate: invest > 0 ? Number((((evalAmt - invest) / invest) * 100).toFixed(2)) : 0
      };
    });
  }

  static async getHoldingsFromView() {
    const userId = await this.getCurrentUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('view_transactions')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('뷰 데이터 조회 실패:', error);
      return [];
    }
    return data || [];
  }

  static async getMonthlyDividendSummary() {
    const userId = await this.getCurrentUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('v_monthly_dividend_summary')
      .select('*')
      .eq('user_id', userId)
      .order('record_month', { ascending: false });

    if (error) return [];
    return data || [];
  }

  static async getExchangeRate(date, fromCurrency = 'USD', toCurrency = 'KRW') {
    if (fromCurrency === toCurrency) return 1;
    
    try {
      // 1. 미래 날짜 판정 (시간 제외 문자열 비교로 정확도 향상)
      const todayStr = new Date().toISOString().split('T')[0];
      if (date > todayStr) {
        return await this.getLatestRateOnly(fromCurrency);
      }

      // 2. DB 조회 (정확한 일자)
      if (toCurrency === 'KRW') {
        const { data: dbData } = await supabase
          .from('exchange_rates')
          .select('rate')
          .eq('exchange_date', date)
          .eq('currency', fromCurrency.toUpperCase())
          .maybeSingle();

        if (dbData && dbData.rate) return dbData.rate;
      }

      // 3. 외부 API 시도 (Frankfurter API)
      try {
        const resp = await fetch(`https://api.frankfurter.app/${date}?from=${fromCurrency}&to=${toCurrency}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.rates && data.rates[toCurrency]) return data.rates[toCurrency];
        }
      } catch (e) {}
      
      // 4. 최종 Fallback: 데이터가 없으면 DB의 가장 최신 환율이라도 가져옴
      return await this.getLatestRateOnly(fromCurrency);

    } catch (error) {
      console.error('환율 조회 실패:', error);
      return 1350; // 최후의 보루
    }
  }

  static async getLatestRateOnly(currency) {
    try {
      const { data } = await supabase
        .from('exchange_rates')
        .select('rate')
        .eq('currency', currency.toUpperCase())
        .order('exchange_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.rate || 1350;
    } catch (e) {
      return 1350;
    }
  }
}
