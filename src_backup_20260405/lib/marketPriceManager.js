/**
 * MarketPriceManager
 * 
 * 역할을 분리하여 외부 시장 데이터를 전문적으로 관리하는 클래스입니다.
 * 실시간 주가 조회 및 캐싱 기능을 담당합니다.
 */

class MarketPriceManager {
  // 간단한 메모리 캐시 (동일 세션 내 중복 호출 방지)
  static priceCache = new Map();
  static CACHE_EXPIRE_TIME = 1000 * 60 * 5; // 5분 캐시 유지

  /**
   * 종목 코드를 기반으로 현재가를 조회합니다.
   * @param {string} symbol 종목 코드 (예: 'TSLA', '005930.KS')
   * @returns {Promise<number|null>} 현재가
   */
  static async getPrice(symbol) {
    if (!symbol) return null;

    // 1. 캐시 확인
    const cachedData = this.priceCache.get(symbol);
    if (cachedData && (Date.now() - cachedData.timestamp < this.CACHE_EXPIRE_TIME)) {
      console.log(`[MarketPriceManager] 캐시 데이터 반환: ${symbol}`);
      return cachedData.price;
    }

    try {
      // CORS 문제 해결을 위해 내부 API 프록시 (/api/stock-price) 사용
      const url = `/api/stock-price?symbol=${symbol}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[MarketPriceManager] 종목(${symbol}) 조회 실패: Status ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      
      if (!data.chart?.result || data.chart.result.length === 0) {
        throw new Error('데이터를 찾을 수 없습니다.');
      }

      const res = data.chart.result[0];
      const meta = res.meta;
      const currentPrice = meta.regularMarketPrice;

      // 2. 캐시 저장
      this.priceCache.set(symbol, {
        price: currentPrice,
        timestamp: Date.now()
      });

      console.log(`[MarketPriceManager] 실시간 가격 조회 완료: ${symbol} = ${currentPrice}`);
      return currentPrice;

    } catch (error) {
      console.error(`[MarketPriceManager] 주가 조회 중 오류 발생 (${symbol}):`, error);
      
      // 오류 발생 시 캐시된 데이터가 있다면 오래된 데이터라도 반환 (Fall-back)
      if (cachedData) return cachedData.price;
      
      return null;
    }
  }

  /**
   * 여러 종목의 가격을 한꺼번에 조회합니다.
   * @param {string[]} symbols 
   */
  static async getMultiplePrices(symbols) {
    if (!symbols || symbols.length === 0) return {};
    
    const uniqueSymbols = Array.from(new Set(symbols));
    const results = {};
    
    await Promise.all(uniqueSymbols.map(async (sym) => {
      results[sym] = await this.getPrice(sym);
    }));
    
    return results;
  }

  /**
   * 국내 종목 코드를 야후 파이낸스 형식으로 변환합니다.
   * @param {string} code 숫자 6자리 코드 
   * @param {string} market 'KOSPI' | 'KOSDAQ'
   */
  static formatSymbol(code, market = 'KOSPI') {
    if (!code) return '';
    if (code.includes('.')) return code; // 이미 형식이 맞춰진 경우
    
    const mkt = market?.toUpperCase() || '';
    
    // KIS 시장 코드 또는 매핑된 코드 처리
    if (mkt === 'STK' || mkt === 'KOSPI' || mkt === 'KS') {
      return `${code}.KS`;
    }
    if (mkt === 'KSQ' || mkt === 'KOSDAQ' || mkt === 'KQ') {
      return `${code}.KQ`;
    }
    
    // 코드가 숫자로만 이루어져 있다면 국내 주식 기본값으로 간주 (KOSPI)
    if (/^\d+$/.test(code)) {
      return `${code}.KS`;
    }
    
    return code; // 해외 주식(NASDAQ 등)은 그대로 반환
  }
}

export default MarketPriceManager;
