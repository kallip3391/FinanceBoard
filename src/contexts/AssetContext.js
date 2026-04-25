"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { TransactionManager } from '@/lib/transactionManager';
import MarketPriceManager from '@/lib/marketPriceManager';

const AssetContext = createContext();

export function AssetProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
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
      
      const viewData = await TransactionManager.getHoldingsFromView();
      const exchangeRates = await TransactionManager.getLatestExchangeRates();
      
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
          const prev = securityMap[sid];
          prev.totalQuantity += processed.totalQuantity;
          prev.totalCostKRW += processed.totalCostKRW;
          prev.evaluationAmountKRW += processed.evaluationAmountKRW;
          prev.profitAmountKRW += processed.profitAmountKRW;
          prev.dividend += processed.dividend;
          
          const currentRate = exchangeRates[prev.currency.toUpperCase()] || 1;
          prev.purchasePrice = prev.totalCostKRW / (prev.totalQuantity * currentRate);
          prev.returnRate = prev.purchasePrice > 0 ? ((prev.currentPrice / prev.purchasePrice) - 1) * 100 : 0;
          prev.totalReturnRate = prev.totalCostKRW > 0 ? ((prev.profitAmountKRW + prev.dividend) / prev.totalCostKRW) * 100 : 0;
        }
        
        totalEval += processed.evaluationAmountKRW;
        totalDiv += processed.dividend;
        totalProfit += processed.profitAmountKRW;
      });

      const finalHoldings = Object.values(securityMap).sort((a, b) => {
        if (a.currency_order !== b.currency_order) return a.currency_order - b.currency_order;
        return b.evaluationAmountKRW - a.evaluationAmountKRW;
      });

      const finalHoldingsByAccount = {};
      viewData.forEach(h => {
        const accName = h.account_name || '알수없음';
        if (!finalHoldingsByAccount[accName]) finalHoldingsByAccount[accName] = [];
        finalHoldingsByAccount[accName].push(processHolding(h));
      });

      Object.keys(finalHoldingsByAccount).forEach(accName => {
        finalHoldingsByAccount[accName].sort((a, b) => {
          if (a.currency_order !== b.currency_order) return a.currency_order - b.currency_order;
          return b.evaluationAmountKRW - a.evaluationAmountKRW;
        });
      });

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
      if (user) console.error("실제 자산 데이터 조회 실패:", err);
      setSummary(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  const refreshTrendData = useCallback(async () => {
    if (!user) {
      setTrendData([]);
      setIsTrendLoading(false);
      return;
    }

    try {
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
      if (user) console.error("트렌드 데이터 로드 오류:", e);
      setTrendData([]);
    } finally {
      setIsTrendLoading(false);
    }
  }, [user, trendData.length]);

  const refreshTransactions = useCallback(async () => {
    if (!user) {
      setDomesticTransactions([]);
      setOverseasTransactions([]);
      setIsTransactionsLoading(false);
      return;
    }

    try {
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
      if (user) console.error("거래 내역 로드 오류:", e);
    } finally {
      setIsTransactionsLoading(false);
    }
  }, [user, domesticTransactions.length, overseasTransactions.length, dividendTransactions.length]);

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
      if (user) console.error("계좌 정보 로드 오류:", e);
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
    // [보안/에러방지] 인증 로딩 중이거나 유저가 없으면 데이터를 요청하지 않음
    if (authLoading || !user) return;
    
    refreshAssets();
  }, [user, authLoading, refreshAssets]);

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
