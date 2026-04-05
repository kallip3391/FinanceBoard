"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAssets } from "@/contexts/AssetContext";
import { LayoutDashboard, List, Globe, LayoutList, PieChart as PieChartIcon } from "lucide-react";
import { TransactionManager } from "@/lib/transactionManager";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

export default function HoldingsPage() {
  const { user } = useAuth();
  const { holdings, holdingsByAccount, summary, refreshAssets } = useAssets();
  const [selectedPeriod, setSelectedPeriod] = useState("1년");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [stockViewMode, setStockViewMode] = useState("card");
  const [isClient, setIsClient] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const [currentStockPage, setCurrentStockPage] = useState(1);
  const [currentAccPage, setCurrentAccPage] = useState(1);
  const STOCKS_PER_PAGE = 6;
  const LIST_PER_PAGE = 8;

  const [trendData, setTrendData] = useState([]);
  const [isTrendLoading, setIsTrendLoading] = useState(true);

  // 계좌별 합계 계산
  const accountHoldings = selectedAccount ? (holdingsByAccount[selectedAccount] || []) : [];
  const accSummary = accountHoldings.reduce((acc, h) => {
    acc.totalEval += h.evaluationAmountKRW;
    acc.totalCost += h.totalCostKRW;
    acc.totalDiv += h.dividend;
    return acc;
  }, { totalEval: 0, totalCost: 0, totalDiv: 0 });
  const accProfit = accSummary.totalEval - accSummary.totalCost;
  const accProfitRate = accSummary.totalCost > 0 ? (accSummary.totalEval / accSummary.totalCost - 1) * 100 : 0;
  const accTotalReturn = accSummary.totalCost > 0 ? ((accSummary.totalEval + accSummary.totalDiv) / accSummary.totalCost - 1) * 100 : 0;

  useEffect(() => {
    setIsClient(true);
    const timer = setTimeout(() => setChartReady(true), 200);
    const saved = localStorage.getItem('stockViewMode');
    if (saved) setStockViewMode(saved);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('stockViewMode', stockViewMode);
      setCurrentStockPage(1); // Reset page when view mode changes
      setCurrentAccPage(1);
    }
  }, [stockViewMode, isClient]);

  // 해당 페이지에 진입할 때마다 최신 자산 정보를 갱신합니다.
  useEffect(() => {
    if (isClient) {
      refreshAssets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]);

  useEffect(() => {
    async function loadTrend() {
      if (!user) {
        setTrendData([]);
        setIsTrendLoading(false);
        return;
      }
      setIsTrendLoading(true);
      try {
        const data = await TransactionManager.getDailyTrendData();
        setTrendData(data);
      } catch (e) {
        console.error("트렌드 데이터 로드 오류:", e);
      } finally {
        setIsTrendLoading(false);
      }
    }
    if (isClient) {
      loadTrend();
    }
  }, [isClient, user]);

  useEffect(() => {
    if (Object.keys(holdingsByAccount || {}).length > 0 && (!selectedAccount || !holdingsByAccount[selectedAccount])) {
      setSelectedAccount(Object.keys(holdingsByAccount)[0]);
    }
    setCurrentAccPage(1); // Reset account page when account changes
  }, [holdingsByAccount, selectedAccount]);

  // 포트폴리오 차트 데이터 생성
  const sectorData = holdings.reduce((acc, h) => {
    const sector = h.sector || "기타";
    const amount = h.evaluationAmountKRW || 0;
    if (amount > 0) {
      const idx = acc.findIndex(item => item.name === sector);
      if (idx > -1) acc[idx].value += amount;
      else acc.push({ name: sector, value: amount });
    }
    return acc;
  }, []).sort((a, b) => b.value - a.value);

  const currencyData = holdings.reduce((acc, h) => {
    const currencyMap = {
      'KRW': '한국', 'USD': '미국', 'EUR': '유럽',
      'JPY': '일본', 'GBP': '영국', 'CNY': '중국', 'HKD': '홍콩'
    };
    const currency = h.currency || "KRW";
    const name = currencyMap[currency] || '해외';
    const amount = h.evaluationAmountKRW || 0;
    if (amount > 0) {
      const idx = acc.findIndex(item => item.name === name);
      if (idx > -1) acc[idx].value += amount;
      else acc.push({ name: name, value: amount });
    }
    return acc;
  }, []).sort((a, b) => b.value - a.value);

  const stockDataRaw = holdings.reduce((acc, h) => {
    const displayName = h.code ? `${h.name} (${h.code})` : (h.name || "알수없음");
    const amount = h.evaluationAmountKRW || 0;
    if (amount > 0) {
      const idx = acc.findIndex(item => item.name === displayName);
      if (idx > -1) acc[idx].value += amount;
      else acc.push({ 
        name: displayName, 
        value: amount,
        code: h.code,
        currency: h.currency,
        sector: h.sector
      });
    }
    return acc;
  }, []).sort((a, b) => b.value - a.value);

  // 상위 10개 노출 후 나머지는 기타 처리
  const stockData = stockDataRaw.length > 10
    ? [
      ...stockDataRaw.slice(0, 10),
      { name: "기타", value: stockDataRaw.slice(10).reduce((sum, item) => sum + item.value, 0) }
    ]
    : stockDataRaw;

  const PIE_COLORS = [
    '#4F46E5', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
    '#6366F1', '#14B8A6', '#84CC16', '#7C3AED'
  ];

  const CustomPieTooltip = ({ active, payload, total }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percent = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
      return (
        <div className="bg-white/95 backdrop-blur-md p-3 border border-slate-100 rounded-xl shadow-xl">
          <p className="text-sm font-bold text-slate-800 mb-1 flex items-baseline">
            {data.name.includes(' (') ? data.name.split(' (')[0] : data.name}
            {data.name.includes(' (') && (
              <span className="text-[11px] text-slate-400 ml-1.5 font-bold">
                ({data.name.split(' (')[1]}
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].fill }}></span>
            <span className="text-xs font-bold text-slate-600">
              {formatCurrency(data.value, 'KRW')}원 ({percent}%)
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomDashboardLegend = ({ data, colors, total }) => {
    return (
      <div className="mt-4 w-full max-h-[104px] overflow-y-auto pr-2 custom-scrollbar">
        <div className="flex flex-col gap-2">
          {data.map((item, index) => {
            const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
            const displayTitle = (item.currency === 'USD' && item.sector === 'ETF' && item.code)
              ? item.code
              : (item.name.includes(' (') ? item.name.split(' (')[0] : item.name);

            return (
              <div key={index} className="flex items-center justify-between group py-1 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors rounded-lg px-2">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: colors[index % colors.length] }}></div>
                  <span className="text-sm font-bold text-slate-700 group-hover:text-brand transition-colors truncate">
                    {displayTitle}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-1.5 flex-shrink-0 w-[185px]">
                  <div className="w-[65px] flex justify-end">
                    <span className="text-[12px] font-black text-brand shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>{percent}%</span>
                  </div>
                  <span className="text-[14px] font-black text-slate-700 w-[110px] text-right shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.value, 'KRW')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const formatCurrency = (value, currency = 'KRW') => {
    if (value === undefined || value === null) return "0";
    if (currency === 'QTY') return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 4 }).format(value);
    if (currency === 'KRW') {
      const roundedValue = Math.round(value / 10) * 10;
      return new Intl.NumberFormat('ko-KR').format(roundedValue);
    }
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };

  const getCurrencySymbol = (currency) => {
    switch (currency) {
      case 'KRW': return '₩ ';
      case 'USD': return '$ ';
      case 'EUR': return '€ ';
      case 'GBP': return '£ ';
      case 'JPY': return '¥ ';
      case 'CNY': return '¥ ';
      case 'HKD': return 'HK$ ';
      default: return '';
    }
  };

  const getCurrencyStyle = (currency) => {
    switch (currency) {
      case 'KRW': return { border: 'border-blue-200', bg: 'bg-blue-50/30', accent: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50' };
      case 'USD': return { border: 'border-emerald-200', bg: 'bg-emerald-50/30', accent: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50' };
      case 'JPY': return { border: 'border-rose-200', bg: 'bg-rose-50/30', accent: 'bg-rose-500', text: 'text-rose-600', light: 'bg-rose-50' };
      case 'EUR': return { border: 'border-indigo-200', bg: 'bg-indigo-50/30', accent: 'bg-indigo-500', text: 'text-indigo-600', light: 'bg-indigo-50' };
      case 'GBP': return { border: 'border-violet-200', bg: 'bg-violet-50/30', accent: 'bg-violet-500', text: 'text-violet-600', light: 'bg-violet-50' };
      case 'HKD': return { border: 'border-amber-200', bg: 'bg-amber-50/30', accent: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50' };
      case 'CNY': return { border: 'border-red-200', bg: 'bg-red-50/30', accent: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50' };
      default: return { border: 'border-slate-200', bg: 'bg-slate-50/30', accent: 'bg-slate-400', text: 'text-slate-600', light: 'bg-slate-50' };
    }
  };

  if (!isClient) return null;

  const formatTrendCurrency = (value) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
    return new Intl.NumberFormat("ko-KR").format(value);
  };

  const getFilteredTrendData = () => {
    if (!trendData || trendData.length === 0) return [];
    const now = new Date();
    const formatDate = (dateStr) => {
      const d = new Date(dateStr);
      const yy = String(d.getFullYear()).slice(2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yy}.${mm}.${dd}`;
    };

    const getDaysCutoff = () => {
      switch(selectedPeriod) { case "3개월": return 90; case "6개월": return 180; case "1년": return 360; case "3년": return 1080; case "5년": return 1800; case "전체": return Infinity; default: return 360; }
    };
    const getInterval = () => {
      switch(selectedPeriod) { case "3개월": return 1; case "6개월": return 3; case "1년": return 30; case "3년": return 30; case "5년": return 60; case "전체": return 60; default: return 30; }
    };

    const days = getDaysCutoff();
    const interval = getInterval();
    const cutoffDate = days === Infinity ? new Date(0) : new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    const range = trendData.filter(d => new Date(d.date) >= cutoffDate);

    let filtered = range.filter((_, i) => i % interval === 0).map(d => ({ ...d, date: formatDate(d.date) }));
    if (range.length > 0) {
      const lastItem = range[range.length - 1];
      const formattedLast = formatDate(lastItem.date);
      if (filtered.length > 0 && filtered[filtered.length - 1].date !== formattedLast) {
        filtered.push({ ...lastItem, date: formattedLast });
      } else if (filtered.length === 0) {
        filtered.push({ ...lastItem, date: formattedLast });
      }
    }
    return filtered;
  };

  const TrendTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const orderConfig = { "매수금액": 1, "평가금액": 2, "손익": 3 };
      const sortedPayload = [...payload].sort((a, b) => (orderConfig[a.name] || 99) - (orderConfig[b.name] || 99));
      const profitEntry = sortedPayload.find(p => p.name === "손익" && p.payload);
      const returnRate = profitEntry ? profitEntry.payload.returnRate : undefined;
      
      return (
        <div className="bg-slate-900/95 backdrop-blur-md p-5 border border-slate-700/50 rounded-2xl shadow-2xl min-w-[200px]">
          <p className="text-sm font-bold text-slate-400 mb-3 border-b border-slate-700/50 pb-2">{label}</p>
          <div className="space-y-2.5">
            {sortedPayload.map((entry, index) => (
              <div key={index} className="flex items-center justify-between gap-6">
                <span className="text-sm font-bold" style={{ color: entry.color }}>{entry.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-black text-white tracking-tight text-right">
                    {entry.name === "손익" && entry.value > 0 ? "+" : ""}
                    {new Intl.NumberFormat("ko-KR").format(entry.value)}
                    <span className="text-[11px] font-normal text-slate-400 ml-1">원</span>
                  </span>
                  {entry.name === "손익" && returnRate !== undefined && (
                    <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${returnRate >= 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {returnRate > 0 ? '+' : ''}{returnRate}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

