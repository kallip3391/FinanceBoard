"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { TransactionManager } from '@/lib/transactionManager';
import MarketPriceManager from '@/lib/marketPriceManager';

const AssetContext = createContext();

export function AssetProvider({ children }) {
  const { user } = useAuth();
  const [holdings, setHoldings] = useState([]);
  const [holdingsByAccount, setHoldingsByAccount] = useState({});
  const [summary, setSummary] = useState({
    totalEvaluation: 0,
    totalProfit: 0,
    totalDividend: 0,
    avgProfitRate: 0,
    avgTotalReturn: 0,
    isLoading: true
  });
  const [trendData, setTrendData] = useState([]);
  const [isTrendLoading, setIsTrendLoading] = useState(true);
  const [domesticTransactions, setDomesticTransactions] = useState([]);
  const [overseasTransactions, setOverseasTransactions] = useState([]);
  const [dividendTransactions, setDividendTransactions] = useState([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [accountNameById, setAccountNameById] = useState({});
  const [isAccountsLoading, setIsAccountsLoading] = useState(false);

  const calculateAssets = useCallback(async () => {
    if (!user) {
      setHoldings([]);
      setHoldingsByAccount({});
      setSummary(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      setSummary(prev => ({ ...prev, isLoading: true }));
      
      // 1. 뷰 테이블에서 집계 데이터 로드 (매수/매도/배당 합산 완료 상태)
      const viewData = await TransactionManager.getHoldingsFromView();
      const exchangeRates = await TransactionManager.getLatestExchangeRates();
      
      // 2. 실시간 시세 조회를 위한 심볼 리스트 추출
      // 뷰에는 이미 유니크한 security_id 별로 데이터가 있으나, 계좌별로 중복될 수 있으므로 Set 사용
      const uniqueSecurities = Array.from(new Set(viewData.map(v => v.security_id)));
      const securityMapForSymbols = viewData.reduce((acc, curr) => {
        if (!acc[curr.security_id]) {
          acc[curr.security_id] = {
            code: curr.security_code,
            exchange_code: curr.sector === '해외' ? 'OVERSEAS' : (curr.currency === 'KRW' ? 'KOSPI' : 'OVERSEAS')
          };
        }
        return acc;
      }, {});

      const fetchSymbols = uniqueSecurities.map(sid => {
        const s = securityMapForSymbols[sid];
        return MarketPriceManager.formatSymbol(s.code, s.exchange_code);
      });
      
      const livePrices = await MarketPriceManager.getMultiplePrices(fetchSymbols);

      // 3. 동적 데이터 계산 함수 (시세/환율 반영)
      const processHolding = (h) => {
        const lookupSym = MarketPriceManager.formatSymbol(
          h.security_code, 
          h.sector === '해외' ? 'OVERSEAS' : (h.currency === 'KRW' ? 'KOSPI' : 'OVERSEAS')
        );
        const currentPrice = livePrices[lookupSym] || null;
        const currentRate = exchangeRates[h.currency.toUpperCase()] || 1;
        
        const purchasePrice = Number(h.avg_buy_price) || 0;
        const effectivePrice = currentPrice !== null ? currentPrice : purchasePrice;
        
        const evalAmtKRW = h.total_quantity * effectivePrice * currentRate;
        const totalCostKRW = h.total_quantity * purchasePrice * currentRate;
        let profitKRW = evalAmtKRW - totalCostKRW;
        
        if (Math.abs(profitKRW) < 0.01) profitKRW = 0;

        const returnRate = purchasePrice > 0 ? ((effectivePrice / purchasePrice) - 1) * 100 : 0;
        const totalReturnRate = totalCostKRW > 0 ? 
          ((profitKRW + (Number(h.total_dividend) || 0)) / totalCostKRW) * 100 : 0;

        return {
          ...h,
          name: h.security_name,
          code: h.security_code,
          currentPrice,
          exchangeRate: currentRate,
          evaluationAmountKRW: evalAmtKRW,
          profitAmountKRW: profitKRW,
          totalCostKRW: totalCostKRW,
          returnRate: returnRate.toFixed(2),
          totalReturnRate: totalReturnRate.toFixed(2),
          dividend: Number(h.total_dividend) || 0,
          purchasePrice: purchasePrice,
          totalQuantity: h.total_quantity
        };
      };

      // 4. 종목별 통합 데이터 산출 (전체 계좌 합산)
      const securityMap = {};
      let totalEval = 0;
      let totalDiv = 0;
      let totalProfit = 0;

      viewData.forEach(h => {
        const sid = h.security_id;
        const processed = processHolding(h);
        
        if (!securityMap[sid]) {
          securityMap[sid] = { ...processed };
        } else {
          // 수량, 원금, 평가액 등 합산
          const prev = securityMap[sid];
          prev.totalQuantity += processed.totalQuantity;
          prev.totalCostKRW += processed.totalCostKRW;
          prev.evaluationAmountKRW += processed.evaluationAmountKRW;
          prev.profitAmountKRW += processed.profitAmountKRW;
          prev.dividend += processed.dividend;
          
          // 통합 평단가 및 수익률 재계산 (현재 환율 기준)
          const currentRate = exchangeRates[prev.currency.toUpperCase()] || 1;
          prev.purchasePrice = prev.totalCostKRW / (prev.totalQuantity * currentRate);
          prev.returnRate = prev.purchasePrice > 0 ? ((prev.currentPrice / prev.purchasePrice) - 1) * 100 : 0;
          prev.totalReturnRate = prev.totalCostKRW > 0 ? ((prev.profitAmountKRW + prev.dividend) / prev.totalCostKRW) * 100 : 0;
        }
        
        totalEval += processed.evaluationAmountKRW;
        totalDiv += processed.dividend;
        totalProfit += processed.profitAmountKRW;
      });

      // 최상위 정렬 규칙 적용 (통화별 -> 금액별)
      const finalHoldings = Object.values(securityMap).sort((a, b) => {
        if (a.currency_order !== b.currency_order) return a.currency_order - b.currency_order;
        return b.evaluationAmountKRW - a.evaluationAmountKRW;
      });

      // 5. 계좌별 정보 변환 및 정렬 (통화순 -> 금액순)
      const finalHoldingsByAccount = {};
      viewData.forEach(h => {
        const accName = h.account_name || '알수없음';
        if (!finalHoldingsByAccount[accName]) finalHoldingsByAccount[accName] = [];
        finalHoldingsByAccount[accName].push(processHolding(h));
      });

      // 계좌 내부 종목들도 통화/금액순으로 정렬 적용
      Object.keys(finalHoldingsByAccount).forEach(accName => {
        finalHoldingsByAccount[accName].sort((a, b) => {
          if (a.currency_order !== b.currency_order) return a.currency_order - b.currency_order;
          return b.evaluationAmountKRW - a.evaluationAmountKRW;
        });
      });

      // 6. 상태 업데이트 (10원 단위 반올림 및 정합성 보장)
      setHoldings(finalHoldings);
      setHoldingsByAccount(finalHoldingsByAccount);
      setSummary({
        totalEvaluation: Math.round(totalEval / 10) * 10,
        totalProfit: Math.round(totalProfit / 10) * 10,
        totalDividend: Math.round(totalDiv / 10) * 10,
        avgProfitRate: (totalEval - totalProfit > 0) ? (totalEval / (totalEval - totalProfit) - 1) * 100 : 0,
        avgTotalReturn: (totalEval - totalProfit > 0) ? ((totalEval + totalDiv) / (totalEval - totalProfit) - 1) * 100 : 0,
        isLoading: false
      });

    } catch (err) {
      console.error("실제 자산 데이터 조회 실패:", err);
      setSummary(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  // 자산 트렌드 데이터 조회 (전역 캐싱용)
  const refreshTrendData = useCallback(async () => {
    if (!user) {
      setTrendData([]);
      setIsTrendLoading(false);
      return;
    }

    try {
      // 이미 데이터가 있는 경우(캐싱된 경우) 로더를 띄우지 않고 백그라운드에서 업데이트함
      if (trendData.length === 0) {
        setIsTrendLoading(true);
      }
      
      const data = await TransactionManager.getDailyTrendData();
      
      const sortedData = data.map(d => ({
        ...d,
        date: d.date.split(' ')[0].replace(/\./g, '-')
      })).sort((a, b) => new Date(a.date) - new Date(b.date));
      
      setTrendData(sortedData);
    } catch (e) {
      console.error("트렌드 데이터 로드 오류:", e);
      setTrendData([]);
    } finally {
      setIsTrendLoading(false);
    }
  }, [user, trendData.length]);

  // 국내/해외 거래 내역 조회 (전역 캐싱용)
  const refreshTransactions = useCallback(async () => {
    if (!user) {
      setDomesticTransactions([]);
      setOverseasTransactions([]);
      setIsTransactionsLoading(false);
      return;
    }

    try {
      // 이미 데이터가 있는 경우 로더 없이 백그라운드 업데이트
      if (domesticTransactions.length === 0 && overseasTransactions.length === 0 && dividendTransactions.length === 0) {
        setIsTransactionsLoading(true);
      }
      
      const [domestic, overseas, dividend] = await Promise.all([
        TransactionManager.getDomesticTransactions(),
        TransactionManager.getOverseasTransactions(),
        TransactionManager.getDividendTransactions()
      ]);
      
      setDomesticTransactions(domestic || []);
      setOverseasTransactions(overseas || []);
      setDividendTransactions(dividend || []);
    } catch (e) {
      console.error("거래 내역 로드 오류:", e);
    } finally {
      setIsTransactionsLoading(false);
    }
  }, [user, domesticTransactions.length, overseasTransactions.length, dividendTransactions.length]);

  // 계좌 정보 조회 (전역 관리용)
  const refreshAccounts = useCallback(async () => {
    if (!user) {
      setAccounts([]);
      setAccountNameById({});
      setIsAccountsLoading(false);
      return;
    }

    try {
      setIsAccountsLoading(true);
      const list = await TransactionManager.getAccounts();
      const sortedList = (list || []).sort((a, b) => {
        const nameA = a.account_nm || '';
        const nameB = b.account_nm || '';
        return nameB.localeCompare(nameA, 'ko-KR');
      }).reverse();
      
      const map = (list || []).reduce((acc, cur) => {
        if (cur.account_id) acc[cur.account_id] = cur.account_nm;
        return acc;
      }, {});
      
      setAccounts(sortedList);
      setAccountNameById(map);
    } catch (e) {
      console.error("계좌 정보 로드 오류:", e);
    } finally {
      setIsAccountsLoading(false);
    }
  }, [user]);

  const refreshAssets = useCallback(async () => {
    await Promise.all([
      calculateAssets(),
      refreshTrendData(),
      refreshTransactions(),
      refreshAccounts()
    ]);
  }, [calculateAssets, refreshTrendData, refreshTransactions, refreshAccounts]);

  useEffect(() => {
    refreshAssets();
  }, [user, refreshAssets]); // user 변경 시 또는 refreshAssets 변경 시 1회 호출

  const value = {
    holdings,
    holdingsByAccount,
    summary,
    trendData,
    isTrendLoading,
    domesticTransactions,
    overseasTransactions,
    dividendTransactions,
    isTransactionsLoading,
    accounts,
    accountNameById,
    isAccountsLoading,
    refreshAssets,
    refreshTrendData,
    refreshTransactions,
    refreshAccounts
  };

  return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>;
}

export const useAssets = () => {
  const context = useContext(AssetContext);
  if (!context) throw new Error('useAssets must be used within an AssetProvider');
  return context;
};

