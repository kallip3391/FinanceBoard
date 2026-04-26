"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAssets } from "@/contexts/AssetContext";
import { LayoutDashboard, List, Globe, LayoutList, PieChart as PieChartIcon } from "lucide-react";
import { TransactionManager } from "@/lib/transactionManager";
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ReferenceLine
} from "recharts";

export default function HoldingsPage() {
  const { user } = useAuth();
  const { holdings, holdingsByAccount, summary, trendData, isTrendLoading, refreshAssets, refreshTrendData } = useAssets();
  const [selectedPeriod, setSelectedPeriod] = useState("1년");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [stockViewMode, setStockViewMode] = useState("card");
  const [isClient, setIsClient] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const [currentStockPage, setCurrentStockPage] = useState(1);
  const [currentAccPage, setCurrentAccPage] = useState(1);
  const [loadedPeriods, setLoadedPeriods] = useState(new Set(['3개월', '6개월', '1년']));
  const STOCKS_PER_PAGE = 6;
  const LIST_PER_PAGE = 8;

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
    const timer = setTimeout(() => setChartReady(true), 150);
    
    // 세션 내 상태 유지를 위해 로컬스토리지 복원
    const saved = localStorage.getItem('stockViewMode');
    if (saved) setStockViewMode(saved);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('stockViewMode', stockViewMode);
      setCurrentStockPage(1);
      setCurrentAccPage(1);
    }
  }, [stockViewMode, isClient]);

  // 로그아웃 시 선택된 계좌 초기화
  useEffect(() => {
    if (!user) {
      setSelectedAccount("");
    }
  }, [user]);

  // 대시보드 진입 시 별도의 refreshAssets() 호출 불필요 (이미 Context에서 처리됨)

  useEffect(() => {
    if (Object.keys(holdingsByAccount || {}).length > 0 && (!selectedAccount || !holdingsByAccount[selectedAccount])) {
      setSelectedAccount(Object.keys(holdingsByAccount)[0]);
    }
    setCurrentAccPage(1);
  }, [holdingsByAccount, selectedAccount]);

  // 기간 변경 시 필요한 데이터 추가 로드 (하이브리드 방식)
  useEffect(() => {
    let days = 365;
    switch (selectedPeriod) {
      case "3개월": days = 90; break;
      case "6개월": days = 180; break;
      case "1년": days = 365; break;
      case "3년": days = 1095; break;
      case "전체": days = Infinity; break;
    }
    
    // 1년 이상인 경우에만 추가 로드 시도 (AssetContext 내부에서 중복 체크함)
    if (days > 365 || days === Infinity) {
      refreshTrendData(days);
    }
  }, [selectedPeriod, refreshTrendData]);

  // 로딩 완료 후 해당 기간 로드 완료 처리
  useEffect(() => {
    if (!isTrendLoading && (selectedPeriod === "3년" || selectedPeriod === "전체")) {
      setLoadedPeriods(prev => {
        if (prev.has(selectedPeriod)) return prev;
        const next = new Set(prev);
        next.add(selectedPeriod);
        return next;
      });
    }
  }, [isTrendLoading, selectedPeriod]);

  // 애니메이션 시간 및 방식 계산
  const isLongPeriod = selectedPeriod === "3년" || selectedPeriod === "전체";
  const isFirstLoad = !loadedPeriods.has(selectedPeriod);
  
  // 최초 로딩이거나 DB 조회 후 로딩 완료된 시점에는 '그리기' 방식(Key 변경), 그 외에는 '모핑' 방식(Key 고정)
  const topChartKey = isFirstLoad && isTrendLoading ? 'loading' : (isFirstLoad ? `draw-${selectedPeriod}` : 'cached');
  const animDuration = isFirstLoad ? (isLongPeriod ? 4000 : 2500) : 2500;

  const sectorData = useMemo(() => {
    return holdings.reduce((acc, h) => {
      const sector = h.sector || "기타";
      const amount = h.evaluationAmountKRW || 0;
      if (amount > 0) {
        const idx = acc.findIndex(item => item.name === sector);
        if (idx > -1) acc[idx].value += amount;
        else acc.push({ name: sector, value: amount });
      }
      return acc;
    }, []).sort((a, b) => b.value - a.value);
  }, [holdings]);

  const currencyData = useMemo(() => {
    return holdings.reduce((acc, h) => {
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
  }, [holdings]);

  const stockDataRaw = useMemo(() => {
    return holdings.reduce((acc, h) => {
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
  }, [holdings]);

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
                  <span className="text-sm font-bold text-slate-700 group-hover:text-brand transition-colors truncate">{displayTitle}</span>
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

  const formatTrendCurrency = (value) => {
    if (value === 0) return "0";
    const absValue = Math.abs(value);
    if (absValue >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
    if (absValue >= 10000) return `${(value / 10000).toFixed(0)}만`;
    return new Intl.NumberFormat("ko-KR").format(value);
  };

  // 트렌드 데이터 가공 (useMemo로 최적화 및 연도 표시 그룹화 로직 포함)
  // 트렌드 데이터에 필요한 정보(가공된 데이터셋 + 그라데이션 오프셋) 통합 계산
  const chartDataObj = useMemo(() => {
    // 초기 로딩 시에도 객체 구조를 유지하여 undefined 에러 방지
    if (!trendData || trendData.length === 0) {
      return { data: [], off: 0.5 };
    }
    const now = new Date();
    const endDateStr = now.toISOString().split('T')[0];
    
    let days = 365;
    switch (selectedPeriod) {
      case "3개월": days = 90; break;
      case "6개월": days = 180; break;
      case "1년": days = 365; break;
      case "3년": days = 1095; break;
      case "전체": days = Infinity; break;
    }

    let startDateStr = "0000-00-00";
    if (days !== Infinity) {
      const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
      startDateStr = startDate.toISOString().split('T')[0];
    }

    const range = trendData.filter(d => d.date >= startDateStr && d.date <= endDateStr);

    // 그라데이션 오프셋 계산 (수익률 0 지점 찾기)
    const profitRates = range.map(d => d.profitRate);
    const maxProfit = Math.max(...profitRates, 0);
    const minProfit = Math.min(...profitRates, 0);
    let off = 0;
    if (maxProfit > minProfit) {
      off = maxProfit / (maxProfit - minProfit);
    }

    return {
      data: range.map(d => ({ 
        ...d, 
        displayDate: d.date.replace(/-/g, '.')
      })),
      off: off
    };
  }, [trendData, selectedPeriod]);

  // chartData 구조 분해
  const finalChartData = chartDataObj.data;
  const profitOffset = chartDataObj.off;

  // X축에 실제로 표시할 틱(레이블)들을 사용자 요청 기준에 따라 정밀 정렬
  const axisTicks = useMemo(() => {
    if (!finalChartData || finalChartData.length === 0) return [];
    
    let ticks = [];
    const lastIdx = finalChartData.length - 1;

    finalChartData.forEach((d, idx) => {
      const [y, m, day] = d.date.split('-').map(Number);
      
      let isVisible = false;
      switch (selectedPeriod) {
        case "3개월":
          if ((lastIdx - idx) % 3 === 0) isVisible = true;
          break;
        case "6개월":
          if ((lastIdx - idx) % 6 === 0) isVisible = true;
          break;
        case "1년":
          if (day === 1) isVisible = true;
          break;
        case "3년":
        case "전체":
          if ((m === 1 && day === 1) || (m === 4 && day === 1) || (m === 7 && day === 1) || (m === 10 && day === 1)) {
            isVisible = true;
          }
          break;
      }

      if (isVisible) ticks.push(d.date);
    });

    if (ticks.length === 0 && finalChartData.length > 0) ticks.push(finalChartData[finalChartData.length - 1].date);
    
    ticks = Array.from(new Set(ticks)).sort();

    const filtered = [];
    const minGap = (selectedPeriod === "전체" || selectedPeriod === "3년" || selectedPeriod === "1년") ? 25 : 2;
    
    for (const t of ticks) {
      if (filtered.length === 0) {
        filtered.push(t);
        continue;
      }
      const last = new Date(filtered[filtered.length - 1]);
      const current = new Date(t);
      const diff = (current - last) / (1000 * 60 * 60 * 24);
      if (diff >= minGap) filtered.push(t);
    }

    return filtered;
  }, [finalChartData, selectedPeriod]);

  const yearMarkTicks = useMemo(() => {
    const marks = {};
    axisTicks.forEach(t => {
      const yr = t.split('-')[0];
      if (!marks[yr]) marks[yr] = t;
    });
    return marks;
  }, [axisTicks]);

  // 각 연도의 첫 번째 데이터 연도 경계선 지점 계산 (세로 수직선용)
  const yearSeparators = useMemo(() => {
    if (!finalChartData || finalChartData.length === 0) return [];
    
    const separators = [];
    const seenYears = new Set();
    const firstYear = finalChartData[0].date.split('-')[0];
    seenYears.add(firstYear);

    finalChartData.forEach((d) => {
      const yr = d.date.split('-')[0];
      if (!seenYears.has(yr)) {
        separators.push({ val: d.date, yr: yr });
        seenYears.add(yr);
      }
    });

    return separators;
  }, [finalChartData]);

  const CustomXAxisTick = ({ x, y, payload }) => {
    if (!payload.value) return null;
    const [year, month, day] = payload.value.split('-');
    const showYear = yearMarkTicks[year] === payload.value;
    
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={10} dy={5} textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight={600}>
          {`${month}.${day}`}
        </text>
        {showYear && (
          <text x={0} y={25} dy={5} textAnchor="middle" fill="#334155" fontSize={12} fontWeight="bold">
            {year}년
          </text>
        )}
      </g>
    );
  };

  const TrendTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const orderConfig = { "투자금액": 1, "평가금액": 2, "수익": 3 };
      const sortedPayload = [...payload].sort((a, b) => (orderConfig[a.name] || 99) - (orderConfig[b.name] || 99));
      const profitEntry = sortedPayload.find(p => p.name === "수익" && p.payload);
      
      return (
        <div className="bg-white/90 backdrop-blur-md p-3 border border-slate-100 rounded-xl shadow-xl min-w-[180px]">
          <div className="flex justify-between items-center mb-2 border-b border-slate-50 pb-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
          </div>
          <div className="space-y-1.5">
            {payload.map((entry, index) => (
              <div key={index} className="flex items-center justify-between gap-8">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: entry.color }}></div>
                  <span className="text-[13px] font-bold text-slate-600">{entry.name}</span>
                </div>
                <span className="font-black text-slate-800 tracking-tight text-[14px] tabular-nums">
                  {new Intl.NumberFormat("ko-KR").format(entry.value)}원
                </span>
              </div>
            ))}
            {!payload.find(p => p.dataKey === "profitRate") && payload[0].payload.profitRate !== undefined && (
              <div className="pt-2 mt-2 border-t border-slate-50 flex items-center justify-between gap-8">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-amber-500 shadow-sm"></div>
                  <span className="text-[13px] font-bold text-slate-600">수익률</span>
                </div>
                <span className={`font-black tracking-tight text-[14px] tabular-nums ${payload[0].payload.profitRate >= 0 ? "text-rose-500" : "text-blue-500"}`}>
                  {payload[0].payload.profitRate > 0 ? "+" : ""}{payload[0].payload.profitRate.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (!isClient) return null;

  return (
    <div className="animate-fade-in flex flex-col gap-10 w-full min-w-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl border border-blue-100/50 shadow-sm">
              <LayoutDashboard size={20} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">대시보드</h1>
          </div>
          {user && (
            <p className="text-slate-500 text-sm pl-12">보유 중인 모든 종목의 상세 수익 현황과 계좌별 분배를 확인할 수 있는 대시보드입니다.</p>
          )}
        </div>

        {!user && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg text-sm">
            로그인 후 본인의 거래내역을 관리할 수 있습니다.
          </div>
        )}
      </div>

      {user && chartReady && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800 border-l-4 border-brand pl-4">자산 트렌드</h2>
            <div className="flex gap-2">
              {["3개월", "6개월", "1년", "3년", "전체"].map((p) => (
                <button key={p} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${selectedPeriod === p ? "bg-brand text-white shadow-md shadow-brand/20" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm"}`} onClick={() => setSelectedPeriod(p)}>{p}</button>
              ))}
            </div>
          </div>
          <div className="glass-card overflow-hidden flex flex-col min-w-0">
            {isTrendLoading ? (
              <div className="flex-1 flex items-center justify-center p-20 text-slate-400 text-sm">트렌드 데이터를 불러오는 중...</div>
            ) : finalChartData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-20 text-slate-400 text-center">조회된 트렌드 데이터가 없습니다.</div>
            ) : (
              <div className="flex-1 w-full p-2 pb-0 flex flex-col gap-2 min-h-[400px] min-w-0 overflow-hidden">
                  <div className="h-[250px] w-full min-w-0 relative flex-shrink-0" style={{ minWidth: "100%", height: "250px" }}>
                    {isClient && chartReady && (
                      <ResponsiveContainer width="100%" height={250} debounce={100}>
                        <AreaChart data={finalChartData} syncId="assetTrend" margin={{ top: 10, right: 2, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorEval" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                            <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.05}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <filter id="shadow" height="200%">
                            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#3b82f6" floodOpacity="0.15" />
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" hide padding={{ left: 0, right: 0 }} />
                        <YAxis 
                          yAxisId="left"
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700, textAnchor: "middle" }} 
                          tickFormatter={formatTrendCurrency} 
                          width={50}
                          dx={-10}
                        />
                        <YAxis 
                          yAxisId="right" 
                          orientation="right" 
                          width={50} 
                          tick={false} 
                          axisLine={false} 
                          tickLine={false} 
                        />
                        <Tooltip 
                          content={<TrendTooltip />} 
                          cursor={{ stroke: '#e2e8f0', strokeWidth: 2 }} 
                          position={{ y: 0 }}
                        />
                        {yearSeparators.map(sep => (
                          <ReferenceLine 
                            key={`top-sep-${sep.val}`}
                            x={sep.val} 
                            stroke="#94a3b8" 
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            isFront={true}
                            alwaysShow={true}
                            label={{ 
                              position: 'top', 
                              value: `${sep.yr}년`, 
                              fill: '#475569', 
                              fontSize: 12, 
                              fontWeight: 700,
                              offset: 15
                            }}
                          />
                        ))}
                        {/* 1. 매수금액 (회색선) */}
                        <Area 
                          key={`asset-invest-${topChartKey}`}
                          yAxisId="left"
                          type="monotone" 
                          dataKey="invest" 
                          stroke="#64748b" 
                          strokeWidth={1.5} 
                          strokeOpacity={0.8}
                          fill="transparent"
                          name="매수금액" 
                          activeDot={{ r: 3, fill: '#64748b' }}
                          isAnimationActive={true}
                          animationDuration={animDuration}
                          animationEasing="ease-in-out"
                        />
                        {/* 2. 평가금액 (파란색 면) */}
                        <Area 
                          key={`asset-eval-${topChartKey}`}
                          yAxisId="left"
                          type="monotone" 
                          dataKey="eval" 
                          stroke="#3b82f6" 
                          strokeWidth={1.5} 
                          fill="url(#colorEval)" 
                          name="평가금액" 
                          activeDot={{ r: 5, strokeWidth: 0, fill: '#3b82f6' }}
                          isAnimationActive={true}
                          animationDuration={animDuration}
                          animationEasing="ease-in-out"
                          filter="url(#shadow)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* 차트 상/하단 구분선 (가시성 강화) */}
                <div className="mx-6 h-[1px] bg-gradient-to-r from-transparent via-slate-300/80 to-transparent"></div>

                {/* 하단: 수익률 차트 (37.5%) */}
                <div className="h-[150px] w-full min-w-0 relative flex-shrink-0" style={{ minWidth: "100%", height: "150px" }}>
                  {isClient && chartReady && (
                    <ResponsiveContainer width="100%" height={150} debounce={100}>
                      <AreaChart data={finalChartData} syncId="assetTrend" margin={{ top: 0, right: 2, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset={profitOffset} stopColor="#2dd4bf" stopOpacity={0.45} />
                            <stop offset={profitOffset} stopColor="#2dd4bf" stopOpacity={0.05} />
                            <stop offset={profitOffset} stopColor="#fb7185" stopOpacity={0.05} />
                            <stop offset={profitOffset} stopColor="#fb7185" stopOpacity={0.45} />
                          </linearGradient>
                          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="1.5" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={<CustomXAxisTick />} 
                          ticks={axisTicks}
                          height={50}
                          padding={{ left: 0, right: 0 }}
                          interval={0}
                        />
                        <YAxis 
                          yAxisId="left" 
                          width={50} 
                          tick={false} 
                          axisLine={false} 
                          tickLine={false} 
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: "#f43f5e", fontSize: 10, fontWeight: 700, textAnchor: "middle" }} 
                          tickFormatter={(v) => `${v}%`} 
                          width={50}
                          dx={15}
                        />
                        <Tooltip 
                          content={() => null} 
                        />
                        
                        {yearSeparators.map(sep => (
                          <ReferenceLine 
                            key={`bottom-sep-${sep.val}`}
                            x={sep.val} 
                            stroke="#94a3b8" 
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            isFront={true}
                            alwaysShow={true}
                          />
                        ))}
                        {/* 수익률 (항상 좌->우 채워지기 위해 key에 selectedPeriod 포함) */}
                        <Area 
                          key={`profit-rate-fill-${selectedPeriod}-${isTrendLoading}`}
                          yAxisId="right"
                          type="monotone" 
                          dataKey="profitRate" 
                          stroke="#94a3b8" 
                          strokeWidth={1.5} 
                          strokeOpacity={0.6}
                          fill="url(#colorProfit)"
                          baseValue={0}
                          name="수익률" 
                          activeDot={{ r: 5, strokeWidth: 0, fill: '#ff4d6d', filter: 'url(#glow)' }}
                          isAnimationActive={true}
                          animationDuration={animDuration}
                          animationEasing="ease-in-out"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {holdings.length > 0 && chartReady && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800 border-l-4 border-brand pl-4">포트폴리오</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass-card p-6 flex flex-col items-center">
              <div className="flex items-center gap-2 self-start mb-6 pb-2 border-b-2 border-slate-100 w-full"><PieChartIcon size={24} className="text-brand" /><h3 className="text-[18px] font-black text-slate-800 uppercase tracking-tighter">섹터</h3></div>
              <div className="w-full h-[280px]"><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={sectorData} cx="50%" cy="50%" innerRadius={0} outerRadius={120} paddingAngle={2} cornerRadius={3} dataKey="value" stroke="none">{sectorData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip content={<CustomPieTooltip total={sectorData.reduce((acc, cur) => acc + cur.value, 0)} />} /></PieChart></ResponsiveContainer></div>
              <CustomDashboardLegend data={sectorData} colors={PIE_COLORS} total={sectorData.reduce((acc, cur) => acc + cur.value, 0)} />
            </div>
            <div className="glass-card p-6 flex flex-col items-center">
              <div className="flex items-center gap-2 self-start mb-6 pb-2 border-b-2 border-slate-100 w-full"><Globe size={24} className="text-brand" /><h3 className="text-[18px] font-black text-slate-800 uppercase tracking-tighter">지역</h3></div>
              <div className="w-full h-[280px]"><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={currencyData} cx="50%" cy="50%" innerRadius={0} outerRadius={120} paddingAngle={2} cornerRadius={3} dataKey="value" stroke="none">{currencyData.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 4) % PIE_COLORS.length]} />)}</Pie><Tooltip content={<CustomPieTooltip total={currencyData.reduce((acc, cur) => acc + cur.value, 0)} />} /></PieChart></ResponsiveContainer></div>
              <CustomDashboardLegend data={currencyData} colors={PIE_COLORS.slice(4).concat(PIE_COLORS.slice(0, 4))} total={currencyData.reduce((acc, cur) => acc + cur.value, 0)} />
            </div>
            <div className="glass-card p-6 flex flex-col items-center">
              <div className="flex items-center gap-2 self-start mb-6 pb-2 border-b-2 border-slate-100 w-full"><LayoutList size={24} className="text-brand" /><h3 className="text-[18px] font-black text-slate-800 uppercase tracking-tighter">종목</h3></div>
              <div className="w-full h-[280px]"><ResponsiveContainer width="100%" height={280}><PieChart><Pie data={stockData} cx="50%" cy="50%" innerRadius={0} outerRadius={120} paddingAngle={2} cornerRadius={3} dataKey="value" stroke="none">{stockData.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 8) % PIE_COLORS.length]} />)}</Pie><Tooltip content={<CustomPieTooltip total={stockData.reduce((acc, cur) => acc + cur.value, 0)} />} /></PieChart></ResponsiveContainer></div>
              <CustomDashboardLegend data={stockData} colors={PIE_COLORS.slice(8).concat(PIE_COLORS.slice(0, 8))} total={stockData.reduce((acc, cur) => acc + cur.value, 0)} />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-6">
          <h2 className="text-xl font-bold text-slate-800 border-l-4 border-brand pl-4">종목별 보유현황</h2>
          {user && (
            <div className="flex gap-2">
              <button onClick={() => setStockViewMode("card")} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${stockViewMode === 'card' ? 'bg-brand text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 shadow-sm'}`}><LayoutDashboard size={16} /> 카드형</button>
              <button onClick={() => setStockViewMode("table")} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${stockViewMode === 'table' ? 'bg-brand text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 shadow-sm'}`}><List size={16} /> 리스트형</button>
            </div>
          )}
        </div>

        <div className="glass-card p-6">
          {stockViewMode === "card" ? (
            <div className="flex flex-col gap-6">
              {user && summary.totalEvaluation > 0 && (
                <div className="bg-brand/5 p-5 rounded-2xl border-2 border-brand/20 shadow-sm">
                  <div className="flex items-center justify-between mb-4 border-b border-brand/10 pb-2"><span className="text-brand font-bold uppercase tracking-wider text-lg">현황</span></div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="flex flex-col items-center">
                      <div className="text-sm text-slate-500 mb-1">평가액</div>
                      <div className="inline-flex flex-col items-end">
                        <div className="text-[21px] font-black tabular-nums text-slate-900">{formatCurrency(summary.totalEvaluation, 'KRW')}</div>
                        <div className={`text-[15px] font-black tabular-nums ${summary.totalProfit > 0 ? "text-red-500" : "text-blue-500"}`}>({formatCurrency(summary.totalProfit, 'KRW')})</div>
                      </div>
                    </div>
                    <div><div className="text-sm text-slate-500 mb-1">수익률</div><div className={`text-xl font-black ${summary.avgProfitRate > 0 ? "text-red-600" : "text-blue-600"}`}>{summary.avgProfitRate.toFixed(2)}%</div></div>
                    <div><div className="text-sm text-slate-500 mb-1">배당금</div><div className="text-xl font-black text-emerald-600">{formatCurrency(summary.totalDividend, 'KRW')}</div></div>
                    <div><div className="text-sm text-slate-500 mb-1">총 수익률</div><div className={`text-xl font-black ${summary.avgTotalReturn > 0 ? "text-red-600" : "text-blue-600"}`}>{summary.avgTotalReturn.toFixed(2)}%</div></div>
                  </div>
                </div>
              )}
              <div key={`stock-grid-${currentStockPage}`} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {holdings.slice((currentStockPage - 1) * STOCKS_PER_PAGE, currentStockPage * STOCKS_PER_PAGE).map((h, i) => {
                  const s = getCurrencyStyle(h.currency);
                  return (
                    <div key={i} className={`relative bg-white p-4 pt-5 rounded-2xl border ${s.border} hover:shadow-lg transition-all h-[210px] flex flex-col justify-between opacity-0 animate-page-slide stagger-${i + 1} overflow-hidden`}>
                      <div className={`absolute top-0 left-0 right-0 h-1.5 ${s.accent}`}></div>
                      <div className="flex justify-between items-start gap-4">
                         <div className="flex-1 min-w-0 flex items-start gap-2">
                           <span className={`shrink-0 mt-0.5 text-[10px] font-black px-1.5 py-0.5 rounded ${s.light} ${s.text}`}>{h.currency}</span>
                           <div className="flex-1 min-w-0">
                             <div className="font-bold text-slate-800 truncate mb-0.5">{h.name}</div>
                             <div className="text-[12px] text-slate-400 font-mono truncate">{h.code}</div>
                           </div>
                         </div>
                         <div className="text-right shrink-0">
                           <div className="text-lg font-bold text-slate-800 whitespace-nowrap">{h.currentPrice ? `${getCurrencySymbol(h.currency)}${formatCurrency(h.currentPrice, h.currency)}` : '-'}</div><div className="text-xs text-slate-500">현재가</div>
                         </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm"><div className="text-slate-600">보유수량</div><div className="font-medium">{formatCurrency(h.totalQuantity, 'QTY')}주</div></div>
                        <div className="flex justify-between items-center text-sm"><div className="text-slate-600">매수가</div><div className="font-medium">{getCurrencySymbol(h.currency)}{formatCurrency(h.purchasePrice, h.currency)}</div></div>
                        <div className="pt-2 border-t flex justify-between items-center"><div className="text-sm font-bold text-brand-dark">평가액</div><div className="text-xl font-black text-brand-dark">{formatCurrency(h.evaluationAmountKRW, 'KRW')}</div></div>
                      </div>
                    </div>
                  );
                })}
                {(() => {
                  const cnt = holdings.slice((currentStockPage - 1) * STOCKS_PER_PAGE, currentStockPage * STOCKS_PER_PAGE).length;
                  if (cnt > 0 && cnt < STOCKS_PER_PAGE) return [...Array(STOCKS_PER_PAGE - cnt)].map((_, i) => <div key={i} className={`relative bg-white rounded-2xl border border-slate-200 h-[210px] opacity-0 animate-page-slide stagger-${cnt + i + 1} overflow-hidden`}><div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-300"></div></div>);
                  return null;
                })()}
              </div>
              {holdings.length > STOCKS_PER_PAGE && (
                <div className="flex items-center justify-center gap-6 mt-2">
                  <button onClick={() => setCurrentStockPage(p => Math.max(1, p - 1))} disabled={currentStockPage === 1} className={`flex items-center justify-center w-10 h-10 rounded-xl ${currentStockPage === 1 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-500 hover:bg-brand/8'}`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
                  <div className="flex items-center gap-1.5 font-bold"><span className="text-brand">{currentStockPage}</span><span className="text-slate-300">/</span><span className="text-slate-400">{Math.ceil(holdings.length / STOCKS_PER_PAGE)}</span></div>
                  <button onClick={() => setCurrentStockPage(p => Math.min(Math.ceil(holdings.length / STOCKS_PER_PAGE), p + 1))} disabled={currentStockPage >= Math.ceil(holdings.length / STOCKS_PER_PAGE)} className={`flex items-center justify-center w-10 h-10 rounded-xl ${currentStockPage >= Math.ceil(holdings.length / STOCKS_PER_PAGE) ? 'text-slate-200 cursor-not-allowed' : 'text-slate-500 hover:bg-brand/8'}`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
              <table className="w-full border-collapse">
                <thead><tr className="bg-slate-50/50 border-b border-slate-200"><th className="px-4 py-4 text-center text-sm font-semibold text-slate-500 w-[300px]">종목명</th><th className="px-3 py-4 text-right text-sm font-semibold text-slate-500">수량</th><th className="px-3 py-4 text-right text-sm font-semibold text-slate-500">매수가&nbsp;</th><th className="px-3 py-4 text-right text-sm font-semibold text-slate-500">현재가&nbsp;</th><th className="px-3 py-4 text-right text-sm font-semibold text-slate-500">평가액&nbsp;&nbsp;&nbsp;</th><th className="px-3 py-4 text-right text-sm font-semibold text-slate-500">평가액(원)&nbsp;&nbsp;</th><th className="px-3 py-4 text-right text-sm font-semibold text-slate-500">수익률&nbsp;&nbsp;</th><th className="px-3 py-4 text-right text-sm font-semibold text-slate-500">배당금&nbsp;&nbsp;</th><th className="px-3 py-4 text-right text-sm font-semibold text-slate-500">총수익률&nbsp;</th></tr></thead>
                <tbody key={`stock-list-${currentStockPage}`} className="divide-y divide-slate-50">
                  {user && holdings.length > 0 && <tr className="bg-brand/5 border-b-2 border-brand/10 font-bold"><td colSpan="5" className="px-4 py-3 text-center text-sm text-brand">합계</td><td className="px-3 py-3 whitespace-nowrap"><div className="flex flex-col text-right"><span className="text-[15px] font-bold tabular-nums text-slate-900">{formatCurrency(summary.totalEvaluation, 'KRW')}</span><span className={`text-[12px] mt-0.5 tabular-nums font-bold ${summary.totalProfit > 0 ? "text-red-500" : (summary.totalProfit < 0 ? "text-blue-500" : "text-slate-400")}`}>({formatCurrency(summary.totalProfit, 'KRW')})</span></div></td><td className={`px-3 py-3 text-right text-sm ${summary.avgProfitRate > 0 ? "text-red-600" : (summary.avgProfitRate < 0 ? "text-blue-600" : "text-slate-400")}`}>{summary.avgProfitRate.toFixed(2)}%</td><td className="px-3 py-3 text-right text-sm font-bold text-emerald-700">{formatCurrency(summary.totalDividend, 'KRW')}</td><td className={`px-3 py-3 text-right text-sm ${summary.avgTotalReturn > 0 ? "text-red-600" : (summary.avgTotalReturn < 0 ? "text-blue-600" : "text-slate-400")}`}>{summary.avgTotalReturn.toFixed(2)}%</td></tr>}
                  {holdings.slice((currentStockPage - 1) * LIST_PER_PAGE, currentStockPage * LIST_PER_PAGE).map((h, i) => (
                    <tr key={i} className={`hover:bg-slate-50/80 transition-colors opacity-0 animate-row-fade stagger-${i + 1}`}><td className="px-4 py-3"><div className="flex items-center gap-2"><div className={`w-[2px] h-8 rounded-full ${getCurrencyStyle(h.currency).accent}`}></div><div className="flex flex-col"><span className="text-sm text-slate-900 font-semibold">{h.name}</span><span className="text-[12px] text-slate-400 font-mono">{h.code}</span></div></div></td><td className="px-3 py-3 text-right text-sm font-medium text-slate-600 whitespace-nowrap">{formatCurrency(h.totalQuantity, 'QTY')}</td><td className="px-3 py-3 text-right text-sm font-medium text-slate-600 whitespace-nowrap">{getCurrencySymbol(h.currency)}{formatCurrency(h.purchasePrice, h.currency)}</td><td className="px-3 py-3 text-right text-sm font-medium text-slate-600 whitespace-nowrap">{getCurrencySymbol(h.currency)}{formatCurrency(h.currentPrice || h.purchasePrice, h.currency)}</td><td className="px-3 py-3 text-right text-sm font-medium text-slate-600 whitespace-nowrap">{(h.totalQuantity * (h.currentPrice || h.purchasePrice)) > 0 ? `${getCurrencySymbol(h.currency)}${formatCurrency(h.totalQuantity * (h.currentPrice || h.purchasePrice), h.currency)}` : '-'}</td><td className="px-3 py-3 whitespace-nowrap"><div className="flex flex-col text-right"><span className="text-sm font-bold tabular-nums text-slate-900">{formatCurrency(h.evaluationAmountKRW, 'KRW')}</span>{h.evaluationAmountKRW > 0 && <span className={`text-[11px] tabular-nums font-bold ${h.profitAmountKRW > 0 ? "text-red-500" : (h.profitAmountKRW < 0 ? "text-blue-500" : "text-slate-400")}`}>({formatCurrency(h.profitAmountKRW, 'KRW')})</span>}</div></td><td className={`px-3 py-3 text-right text-sm font-bold ${parseFloat(h.returnRate) > 0 ? "text-red-600" : (parseFloat(h.returnRate) < 0 ? "text-blue-600" : "text-slate-400")}`}>{parseFloat(h.returnRate) === 0 ? "0.00%" : `${h.returnRate}%`}</td><td className="px-3 py-3 text-right text-sm font-bold text-emerald-700 whitespace-nowrap">{formatCurrency(h.dividend, 'KRW')}</td><td className={`px-3 py-3 text-right text-sm font-bold ${parseFloat(h.totalReturnRate) > 0 ? "text-red-600" : (parseFloat(h.totalReturnRate) < 0 ? "text-blue-600" : "text-slate-400")}`}>{parseFloat(h.totalReturnRate) === 0 ? "0.00%" : `${h.totalReturnRate}%`}</td></tr>
                  ))}
                </tbody>
              </table>
              {holdings.length > LIST_PER_PAGE && (
                <div className="flex items-center justify-center gap-6 py-4 border-t border-slate-50">
                  <button onClick={() => setCurrentStockPage(p => Math.max(1, p - 1))} disabled={currentStockPage === 1} className={`flex items-center justify-center w-10 h-10 rounded-xl ${currentStockPage === 1 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-500 hover:bg-brand/8'}`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
                  <div className="flex items-center gap-1.5 font-bold"><span className="text-brand">{currentStockPage}</span><span className="text-slate-300">/</span><span className="text-slate-400">{Math.ceil(holdings.length / LIST_PER_PAGE)}</span></div>
                  <button onClick={() => setCurrentStockPage(p => Math.min(Math.ceil(holdings.length / LIST_PER_PAGE), p + 1))} disabled={currentStockPage >= Math.ceil(holdings.length / LIST_PER_PAGE)} className={`flex items-center justify-center w-10 h-10 rounded-xl ${currentStockPage >= Math.ceil(holdings.length / LIST_PER_PAGE) ? 'text-slate-200 cursor-not-allowed' : 'text-slate-500 hover:bg-brand/8'}`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-xl font-bold text-slate-800 border-l-4 border-brand pl-4">계좌별 보유현황</h2>
          <div className="flex flex-wrap gap-2 justify-end pr-6">{Object.keys(holdingsByAccount).map(acc => <button key={acc} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${selectedAccount === acc ? "bg-brand text-white shadow-md shadow-brand/20" : "bg-white text-slate-600 border border-slate-200 hover:border-brand/30 hover:bg-brand/5 shadow-sm"}`} onClick={() => setSelectedAccount(acc)}>{acc}</button>)}</div>
        </div>
        <div className="glass-card p-6">
          {stockViewMode === "card" ? (
            <div className="flex flex-col gap-6">
              {accSummary.totalEval > 0 && <div key={`summary-${selectedAccount}`} className="bg-brand/5 p-5 rounded-2xl border-2 border-brand/20 shadow-sm animate-summary-pop"><div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center"><div className="flex flex-col items-center"><div className="text-sm text-slate-500 mb-1">평가액</div><div className="inline-flex flex-col items-end"><div className="text-[21px] font-black tabular-nums text-slate-900">{formatCurrency(accSummary.totalEval, 'KRW')}</div><div className={`text-[15px] font-black tabular-nums ${accProfit > 0 ? "text-red-500" : "text-blue-500"}`}>({formatCurrency(accProfit, 'KRW')})</div></div></div><div><div className="text-sm text-slate-500 mb-1">수익률</div><div className={`text-xl font-black ${accProfitRate > 0 ? "text-red-600" : "text-blue-600"}`}>{accProfitRate.toFixed(2)}%</div></div><div><div className="text-sm text-slate-500 mb-1">배당금</div><div className="text-xl font-black text-emerald-600">{formatCurrency(accSummary.totalDiv, 'KRW')}</div></div><div><div className="text-sm text-slate-500 mb-1">총 수익률</div><div className={`text-xl font-black ${accTotalReturn > 0 ? "text-red-600" : "text-blue-600"}`}>{accTotalReturn.toFixed(2)}%</div></div></div></div>}
              <div key={`acc-grid-${selectedAccount}-${currentAccPage}`} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accountHoldings.slice((currentAccPage - 1) * STOCKS_PER_PAGE, currentAccPage * STOCKS_PER_PAGE).map((h, i) => {
                  const s = getCurrencyStyle(h.currency);
                  return (
                    <div key={i} className={`relative bg-white p-4 pt-5 rounded-2xl border ${s.border} hover:shadow-lg transition-all h-[210px] flex flex-col justify-between opacity-0 animate-page-slide stagger-${i + 1} overflow-hidden`}>
                      <div className={`absolute top-0 left-0 right-0 h-1.5 ${s.accent}`}></div>
                      <div className="flex justify-between items-start gap-4"><div className="flex-1 min-w-0 flex items-start gap-2"><span className={`shrink-0 mt-0.5 text-[10px] font-black px-1.5 py-0.5 rounded ${s.light} ${s.text}`}>{h.currency}</span><div className="flex-1 min-w-0"><div className="font-bold text-slate-800 truncate mb-0.5">{h.name}</div><div className="text-[12px] text-slate-400 font-mono truncate">{h.code}</div></div></div><div className="text-right shrink-0"><div className="text-lg font-bold text-slate-800 whitespace-nowrap">{h.currentPrice ? `${getCurrencySymbol(h.currency)}${formatCurrency(h.currentPrice, h.currency)}` : '-'}</div><div className="text-xs text-slate-500">현재가</div></div></div>
                      <div className="space-y-2"><div className="flex justify-between items-center text-sm"><div className="text-slate-600">보유수량</div><div className="font-medium">{formatCurrency(h.totalQuantity, 'QTY')}주</div></div><div className="flex justify-between items-center text-sm"><div className="text-slate-600">매수가</div><div className="font-medium">{getCurrencySymbol(h.currency)}{formatCurrency(h.purchasePrice, h.currency)}</div></div><div className="pt-2 border-t flex justify-between items-center"><div className="text-sm font-bold text-brand-dark">평가액</div><div className="text-xl font-black text-brand-dark">{formatCurrency(h.evaluationAmountKRW, 'KRW')}</div></div></div>
                    </div>
                  );
                })}
                {(() => {
                  const cnt = accountHoldings.slice((currentAccPage - 1) * STOCKS_PER_PAGE, currentAccPage * STOCKS_PER_PAGE).length;
                  if (cnt > 0 && cnt < STOCKS_PER_PAGE) return [...Array(STOCKS_PER_PAGE - cnt)].map((_, i) => <div key={i} className={`relative bg-white rounded-2xl border border-slate-200 h-[210px] opacity-0 animate-page-slide stagger-${cnt + i + 1} overflow-hidden`}><div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-300"></div></div>);
                  return null;
                })()}
              </div>
              {accountHoldings.length > STOCKS_PER_PAGE && (
                <div className="flex items-center justify-center gap-6 mt-2">
                  <button onClick={() => setCurrentAccPage(p => Math.max(1, p - 1))} disabled={currentAccPage === 1} className={`flex items-center justify-center w-10 h-10 rounded-xl ${currentAccPage === 1 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-500 hover:bg-brand/8'}`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
                  <div className="flex items-center gap-1.5 font-bold"><span className="text-brand">{currentAccPage}</span><span className="text-slate-300">/</span><span className="text-slate-400">{Math.ceil(accountHoldings.length / STOCKS_PER_PAGE)}</span></div>
                  <button onClick={() => setCurrentAccPage(p => Math.min(Math.ceil(accountHoldings.length / STOCKS_PER_PAGE), p + 1))} disabled={currentAccPage >= Math.ceil(accountHoldings.length / STOCKS_PER_PAGE)} className={`flex items-center justify-center w-10 h-10 rounded-xl ${currentAccPage >= Math.ceil(accountHoldings.length / STOCKS_PER_PAGE) ? 'text-slate-200 cursor-not-allowed' : 'text-slate-500 hover:bg-brand/8'}`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
              <table className="w-full border-collapse">
                <thead><tr className="bg-slate-50/50 border-b border-slate-200"><th className="px-4 py-4 text-center text-sm font-semibold text-slate-500 w-[300px]">종목명</th><th className="px-3 py-4 text-right text-sm font-semibold text-slate-500">수량</th><th className="px-3 py-4 text-right text-sm font-semibold text-slate-500">매수가&nbsp;</th><th className="px-3 py-4 text-right text-sm font-semibold text-slate-500">현재가&nbsp;</th><th className="px-3 py-4 text-right text-sm font-semibold text-slate-500">평가액&nbsp;&nbsp;&nbsp;</th><th className="px-3 py-4 text-right text-sm font-semibold text-slate-500">평가액(원)&nbsp;&nbsp;</th><th className="px-3 py-4 text-right text-sm font-semibold text-slate-500">수익률&nbsp;&nbsp;</th><th className="px-3 py-4 text-right text-sm font-semibold text-slate-500">배당금&nbsp;&nbsp;</th><th className="px-3 py-4 text-right text-sm font-semibold text-slate-500">총수익률&nbsp;</th></tr></thead>
                <tbody key={`acc-list-${selectedAccount}-${currentAccPage}`} className="divide-y divide-slate-50">
                  {accountHoldings.length > 0 && <tr className="bg-brand/5 border-b-2 border-brand/10 font-bold"><td colSpan="5" className="px-4 py-3 text-center text-sm text-brand">합계</td><td className="px-3 py-3 whitespace-nowrap"><div className="flex flex-col text-right"><span className="text-[15px] font-bold tabular-nums text-slate-900">{formatCurrency(accSummary.totalEval, 'KRW')}</span><span className={`text-[12px] mt-0.5 tabular-nums font-bold ${accProfit > 0 ? "text-red-500" : (accProfit < 0 ? "text-blue-500" : "text-slate-400")}`}>({formatCurrency(accProfit, 'KRW')})</span></div></td><td className={`px-3 py-3 text-right text-sm ${accProfitRate > 0 ? "text-red-600" : (accProfitRate < 0 ? "text-blue-600" : "text-slate-400")}`}>{accProfitRate.toFixed(2)}%</td><td className="px-3 py-3 text-right text-sm font-bold text-emerald-700">{formatCurrency(accSummary.totalDiv, 'KRW')}</td><td className={`px-3 py-3 text-right text-sm ${accTotalReturn > 0 ? "text-red-600" : (accTotalReturn < 0 ? "text-blue-600" : "text-slate-400")}`}>{accTotalReturn.toFixed(2)}%</td></tr>}
                  {accountHoldings.slice((currentAccPage - 1) * LIST_PER_PAGE, currentAccPage * LIST_PER_PAGE).map((h, i) => (
                    <tr key={i} className={`hover:bg-slate-50/80 transition-colors opacity-0 animate-row-fade stagger-${i + 1}`}><td className="px-4 py-3"><div className="flex items-center gap-2"><div className={`w-[2px] h-8 rounded-full ${getCurrencyStyle(h.currency).accent}`}></div><div className="flex flex-col"><span className="text-sm text-slate-900 font-semibold">{h.name}</span><span className="text-[12px] text-slate-400 font-mono">{h.code}</span></div></div></td><td className="px-3 py-3 text-right text-sm font-medium text-slate-600 whitespace-nowrap">{formatCurrency(h.totalQuantity, 'QTY')}</td><td className="px-3 py-3 text-right text-sm font-medium text-slate-600 whitespace-nowrap">{getCurrencySymbol(h.currency)}{formatCurrency(h.purchasePrice, h.currency)}</td><td className="px-3 py-3 text-right text-sm font-medium text-slate-600 whitespace-nowrap">{getCurrencySymbol(h.currency)}{formatCurrency(h.currentPrice || h.purchasePrice, h.currency)}</td><td className="px-3 py-3 text-right text-sm font-medium text-slate-600 whitespace-nowrap">{(h.totalQuantity * (h.currentPrice || h.purchasePrice)) > 0 ? `${getCurrencySymbol(h.currency)}${formatCurrency(h.totalQuantity * (h.currentPrice || h.purchasePrice), h.currency)}` : '-'}</td><td className="px-3 py-3 whitespace-nowrap"><div className="flex flex-col text-right"><span className="text-sm font-bold tabular-nums text-slate-900">{formatCurrency(h.evaluationAmountKRW, 'KRW')}</span>{h.evaluationAmountKRW > 0 && <span className={`text-[11px] tabular-nums font-bold ${h.profitAmountKRW > 0 ? "text-red-500" : (h.profitAmountKRW < 0 ? "text-blue-500" : "text-slate-400")}`}>({formatCurrency(h.profitAmountKRW, 'KRW')})</span>}</div></td><td className={`px-3 py-3 text-right text-sm font-bold ${parseFloat(h.returnRate) > 0 ? "text-red-600" : (parseFloat(h.returnRate) < 0 ? "text-blue-600" : "text-slate-400")}`}>{parseFloat(h.returnRate) === 0 ? "0.00%" : `${h.returnRate}%`}</td><td className="px-3 py-3 text-right text-sm font-bold text-emerald-700 whitespace-nowrap">{formatCurrency(h.dividend, 'KRW')}</td><td className={`px-3 py-3 text-right text-sm font-bold ${parseFloat(h.totalReturnRate) > 0 ? "text-red-600" : (parseFloat(h.totalReturnRate) < 0 ? "text-blue-600" : "text-slate-400")}`}>{parseFloat(h.totalReturnRate) === 0 ? "0.00%" : `${h.totalReturnRate}%`}</td></tr>
                  ))}
                </tbody>
              </table>
              {accountHoldings.length > LIST_PER_PAGE && (
                <div className="flex items-center justify-center gap-6 py-4 border-t border-slate-50">
                  <button onClick={() => setCurrentAccPage(p => Math.max(1, p - 1))} disabled={currentAccPage === 1} className={`flex items-center justify-center w-10 h-10 rounded-xl ${currentAccPage === 1 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-500 hover:bg-brand/8'}`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
                  <div className="flex items-center gap-1.5 font-bold"><span className="text-brand">{currentAccPage}</span><span className="text-slate-300">/</span><span className="text-slate-400">{Math.ceil(accountHoldings.length / LIST_PER_PAGE)}</span></div>
                  <button onClick={() => setCurrentAccPage(p => Math.min(Math.ceil(accountHoldings.length / LIST_PER_PAGE), p + 1))} disabled={currentAccPage >= Math.ceil(accountHoldings.length / LIST_PER_PAGE)} className={`flex items-center justify-center w-10 h-10 rounded-xl ${currentAccPage >= Math.ceil(accountHoldings.length / LIST_PER_PAGE) ? 'text-slate-200 cursor-not-allowed' : 'text-slate-500 hover:bg-brand/8'}`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
