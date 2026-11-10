"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ChevronDown, Sprout, Calendar, TrendingUp, CheckCircle, X } from "lucide-react";
import {
   BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { useAuth } from "@/contexts/AuthContext";
import { useAssets } from "@/contexts/AssetContext";
import MobileDividendDashboard from "@/app/components/mobile/MobileDividendDashboard";
import { useAnimatedModal, useAnimatedDataModal } from "@/hooks/useAnimatedModal";

function StockLogo({ code, name, isKRW }) {
  const [hasError, setHasError] = useState(false);
  const cleanCode = (code || '').replace(/\.(KS|KQ|US|kospi|kosdaq)$/i, '').trim();
  const logoUrl = cleanCode ? `https://static.toss.im/png-icons/securities/icn-sec-fill-${cleanCode}.png` : null;

  // ETF 여부 판별
  const isETF = (name || '').toUpperCase().includes('ETF') ||
                /^(KODEX|TIGER|ACE|RISE|SOL|PLUS|KOSEF|ARIRANG|WOORI|TIMEFOLIO)/i.test(name || '');

  if (!logoUrl || hasError) {
    const displayText = isETF ? 'ETF' : (name ? name.slice(0, 1) : (isKRW ? '국' : '해'));

    return (
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold shrink-0 ${
          isETF
            ? 'bg-purple-100 text-purple-700 text-[10px]'
            : isKRW
              ? 'bg-blue-100/80 text-blue-600 text-xs'
              : 'bg-amber-100/80 text-amber-700 text-xs'
        }`}
      >
        {displayText}
      </div>
    );
  }

  return (
    <div className="w-9 h-9 rounded-lg shrink-0 overflow-hidden flex items-center justify-center bg-slate-100/60">
      <img
        src={logoUrl}
        alt={name || cleanCode}
        onError={() => setHasError(true)}
        className="w-full h-full object-cover rounded-lg"
        loading="lazy"
      />
    </div>
  );
}

const getCurrencySymbol = (currency) => {
  switch (currency) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'JPY': return '¥';
    case 'CNY': return '¥';
    case 'GBP': return '£';
    case 'HKD': return 'HK$';
    default: return currency ? `${currency} ` : '$';
  }
};

const formatStockCode = (code) => {
  if (!code) return "";
  const str = String(code).trim();
  if (/^\d+$/.test(str)) {
    return str.padStart(6, "0");
  }
  return str;
};

export default function DividendsPage() {
  const { user } = useAuth();
  const { monthlyDividendSummary, isDividendsLoading: loading, dividendTransactions } = useAssets();
  const [chartReady, setChartReady] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('1년');

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const yearDropdownRef = useRef(null);

  // 월별 배당 상세 팝업 모달 상태 및 퇴장 애니메이션 훅
  const [selectedMonthModal, setSelectedMonthModal] = useState(null);
  const { 
    data: monthModalData, 
    isOpen: isMonthModalOpen, 
    isClosing: isMonthClosing 
  } = useAnimatedDataModal(selectedMonthModal);

  // 연간 총 배당현황 클릭 시 연간 월별 배당 팝업 모달 상태 및 퇴장 애니메이션 훅
  const [isAnnualModalOpen, setIsAnnualModalOpen] = useState(false);
  const { 
    mounted: isAnnualMounted, 
    isClosing: isAnnualClosing 
  } = useAnimatedModal(isAnnualModalOpen);
  const [annualModalFilterMonth, setAnnualModalFilterMonth] = useState('ALL');
  const annualScrollRef = useRef(null);

  // 연간 팝업 월 탭 변경 시 스크롤 최상단 이동
  useEffect(() => {
    if (annualScrollRef.current) {
      annualScrollRef.current.scrollTop = 0;
    }
  }, [annualModalFilterMonth]);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target)) {
        setIsYearDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedMonthModal) setSelectedMonthModal(null);
        if (isAnnualModalOpen) setIsAnnualModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMonthModal, isAnnualModalOpen]);

  const formatCurrency = (value) => new Intl.NumberFormat('ko-KR').format(value || 0);

  // 데이터 집계 및 차트 가공
  const { filteredChartData, groupedData, totalDividends, availableYears, filteredChartTotal } = useMemo(() => {
    let totalObj = 0;
    const grouped = {};
    const monthlyMap = {};

    monthlyDividendSummary.forEach(item => {
      const recordMonth = item.record_month || '';
      if (!recordMonth || recordMonth.length < 7) return;
      
      const year = recordMonth.split('-')[0];
      const month = recordMonth.split('-')[1];
      const fullMonthKey = `${year}-${month}`;
      
      const amt = Number(item.total_dividend) || 0;
      totalObj += amt;

      if (!monthlyMap[fullMonthKey]) {
        monthlyMap[fullMonthKey] = { KRW: 0, OVERSEAS: 0, total: 0 };
      }
      const curr = item.currency || 'KRW';
      if (curr === 'KRW') {
        monthlyMap[fullMonthKey].KRW += amt;
      } else {
        monthlyMap[fullMonthKey].OVERSEAS += amt;
      }
      monthlyMap[fullMonthKey].total += amt;

      if (!grouped[year]) {
        grouped[year] = { total: 0, count: 0, months: {} };
      }
      grouped[year].total += amt;
      grouped[year].count += (item.dividend_count || 1);

      if (!grouped[year].months[month]) {
        grouped[year].months[month] = { total: 0, count: 0, stocks: {} };
      }
      grouped[year].months[month].total += amt;
      grouped[year].months[month].count += (item.dividend_count || 1);

      const stockName = item.security_name || '알 수 없음';
      const foreignAmt = Number(item.dividend_amount || item.total_dividend_foreign || item.foreign_dividend || item.dividendAmount) || 0;
      if (!grouped[year].months[month].stocks[stockName]) {
        grouped[year].months[month].stocks[stockName] = {
          name: stockName,
          code: item.security_code || '',
          total: 0,
          currency: item.currency || 'KRW',
          dividendAmount: 0
        };
      }
      grouped[year].months[month].stocks[stockName].total += amt;
      grouped[year].months[month].stocks[stockName].dividendAmount += foreignAmt;
    });

    const currencyPriority = { KRW: 1, USD: 2, EUR: 3, JPY: 4, GBP: 5, CNY: 6, HKD: 7 };

    Object.keys(grouped).forEach(y => {
      Object.keys(grouped[y].months).forEach(m => {
        const monthObj = grouped[y].months[m];
        monthObj.items = Object.values(monthObj.stocks).sort((a, b) => {
          const pA = currencyPriority[a.currency] || 99;
          const pB = currencyPriority[b.currency] || 99;
          if (pA !== pB) return pA - pB;
          return b.total - a.total;
        });
      });
    });

    const sortedAvailableYears = Object.keys(grouped).sort((a, b) => b - a);

    // 차트 표시 연도 목록 산출
    const targetYearNum = parseInt(selectedYear, 10) || (sortedAvailableYears[0] ? parseInt(sortedAvailableYears[0], 10) : new Date().getFullYear());
    const yearsWithData = sortedAvailableYears.map(Number).sort((a, b) => a - b);
    const latestYearWithData = yearsWithData.length > 0 ? yearsWithData[yearsWithData.length - 1] : targetYearNum;
    const earliestYearWithData = yearsWithData.length > 0 ? yearsWithData[0] : targetYearNum;

    let yearsToDisplay = [];
    if (selectedPeriod === '1년') {
      // 1년 : 월별 배당요약에 선택된 년도 기준 1월 ~ 12월
      yearsToDisplay = [targetYearNum];
    } else if (selectedPeriod === '3년') {
      // 3년 : 월별 배당요약에 선택된 년도 기준 해당년도 포함 이전 3개년치 1월 ~ 12월
      yearsToDisplay = [targetYearNum - 2, targetYearNum - 1, targetYearNum];
    } else if (selectedPeriod === '5년') {
      // 5년 : 월별 배당요약에 선택된 년도 기준 해당년도 포함 이전 5개년치 1월 ~ 12월
      yearsToDisplay = [targetYearNum - 4, targetYearNum - 3, targetYearNum - 2, targetYearNum - 1, targetYearNum];
    } else if (selectedPeriod === '10년') {
      // 10년 : 월별 배당요약에 선택된 년도 기준 해당년도 포함 이전 10개년치 1월 ~ 12월
      yearsToDisplay = Array.from({ length: 10 }, (_, i) => targetYearNum - 9 + i);
    }

    const chartArray = [];
    let periodTotalSum = 0;

    yearsToDisplay.forEach(y => {
      for (let mNum = 1; mNum <= 12; mNum++) {
        const mStr = mNum.toString().padStart(2, '0');
        const fullKey = `${y}-${mStr}`;
        const shortYear = String(y).slice(2);
        const chartKey = `${shortYear}.${mStr}`;
        const dataObj = monthlyMap[fullKey] || { KRW: 0, OVERSEAS: 0, total: 0 };
        periodTotalSum += dataObj.total;

        chartArray.push({
          month: chartKey,
          fullYear: y,
          monthNum: mNum,
          KRW: dataObj.KRW,
          OVERSEAS: dataObj.OVERSEAS,
          total: dataObj.total
        });
      }
    });

    return {
      filteredChartData: chartArray.map((d, index) => ({ ...d, idx: index })),
      groupedData: grouped,
      totalDividends: totalObj,
      filteredChartTotal: periodTotalSum,
      availableYears: sortedAvailableYears
    };
  }, [monthlyDividendSummary, selectedPeriod, selectedYear]);

  // 선택된 연도의 월별 최고 배당 금액 산출 (최대 배지 및 하이라이트용)
  const maxMonthlyTotal = useMemo(() => {
    const monthsObj = groupedData[selectedYear]?.months || {};
    let max = 0;
    Object.values(monthsObj).forEach(m => {
      if ((m.total || 0) > max) max = m.total;
    });
    return max;
  }, [groupedData, selectedYear]);

  // 1~12월 전체 월 데이터 및 배당 유무
  const all12MonthsData = useMemo(() => {
    const yearObj = groupedData[selectedYear] || { total: 0, count: 0, months: {} };
    return Array.from({ length: 12 }, (_, i) => {
      const mStr = (i + 1).toString().padStart(2, '0');
      const monthObj = yearObj.months?.[mStr];
      const items = monthObj?.items || [];
      const total = monthObj?.total || 0;
      const count = monthObj?.count || 0;
      const hasData = total > 0 && items.length > 0;
      return {
        mNum: i + 1,
        mStr,
        total,
        count,
        items,
        hasData
      };
    });
  }, [groupedData, selectedYear]);

  // 연간 월별 배당 상세 팝업용 리스트 (배당이 있는 월만 필터링)
  const annualMonthlyList = useMemo(() => {
    return all12MonthsData.filter(m => m.hasData);
  }, [all12MonthsData]);

  const [isChanging, setIsChanging] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);

  useEffect(() => {
    if (!chartReady) {
      const timer = setTimeout(() => {
        setChartReady(true);
        setIsRevealing(true);
        setTimeout(() => setIsRevealing(false), 3000);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [chartReady]);

  const handlePeriodChange = (p) => {
    if (p === selectedPeriod) return;
    setIsChanging(true);
    setIsRevealing(false);
    
    setTimeout(() => {
      setSelectedPeriod(p);
      setTimeout(() => {
        setIsChanging(false);
        setIsRevealing(true);
        setTimeout(() => setIsRevealing(false), 3000);
      }, 50);
    }, 200);
  };

  const handleYearChange = (y) => {
    if (y === selectedYear) {
      setIsYearDropdownOpen(false);
      return;
    }
    setIsChanging(true);
    setIsRevealing(false);
    setIsYearDropdownOpen(false);

    setTimeout(() => {
      setSelectedYear(y);
      setSelectedPeriod('1년');
      setTimeout(() => {
        setIsChanging(false);
        setIsRevealing(true);
        setTimeout(() => setIsRevealing(false), 3000);
      }, 50);
    }, 200);
  };

  return (
    <>
      {/* 모바일 화면 (768px 미만) 전용 배당금 대시보드 */}
      <div className="mobile-only-block w-full">
        <MobileDividendDashboard
          user={user}
          loading={loading}
          groupedData={groupedData}
          availableYears={availableYears}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          formatCurrency={formatCurrency}
        />
      </div>

      {/* 데스크톱 화면 (768px 이상) 전용 */}
      <div className="desktop-only h-full flex-col pb-0 animate-fade-in">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/50 shadow-sm">
              <Sprout size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">배당금 현황</h1>
              <p className="text-xs text-slate-400 font-medium mt-0.5">월별 배당금 추이 및 종목별 배당 상세 내역을 확인합니다.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {!user && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg text-sm">
                로그인 후 보유 자산을 확인할 수 있습니다.
              </div>
            )}
          </div>
        </div>

        {/* 로딩 화면 */}
        {user && loading && (
          <div className="glass-card py-24 flex flex-col items-center justify-center gap-3">
            <div className="w-9 h-9 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="font-bold text-slate-700 text-base">배당 내역을 불러오는 중...</span>
            <span className="text-sm text-slate-400">잠시만 기다려주세요</span>
          </div>
        )}

        {/* 로그인 완료 및 로딩 완료 후 본문 표시 */}
        {user && !loading && (
          <>
            {/* Bar Chart Section (공간을 미리 확보하여 레이아웃 밀림 방지) */}
            <div className="glass-card p-6 min-h-[400px] mb-8 overflow-hidden">
              <div className="flex justify-end items-center mb-6">
                <div className="flex flex-col items-end gap-3">
                  <div className="flex gap-2">
                    {['1년', '3년', '5년', '10년'].map((p) => (
                      <button
                        key={p}
                        onClick={() => handlePeriodChange(p)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                          selectedPeriod === p
                            ? 'bg-brand text-white shadow-md shadow-brand/20'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 shadow-sm'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pr-1">
                    <span className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">TOTAL</span>
                    <span className="text-2xl font-black text-brand-dark tabular-nums tracking-tighter">
                      {formatCurrency(filteredChartTotal)}
                      <span className="text-base font-bold ml-1 text-brand">원</span>
                    </span>
                  </div>
                </div>
              </div>

              <style>{`
                @media (min-width: 768px) {
                  .md-panel {
                    min-height: auto !important;
                    padding-bottom: 1.25rem !important;
                  }
                }
                @keyframes chartFadeIn {
                  from { opacity: 0; }
                  to { opacity: 1; }
                }
                @keyframes chartRiseUp {
                  from { clip-path: inset(100% 0 0 0); }
                  to { clip-path: inset(0 0 0 0); }
                }
                .anim-xaxis { animation: chartFadeIn 0.5s ease-out forwards; opacity: 0; }
                .anim-yaxis { animation: chartFadeIn 0.5s ease-out 0.5s forwards; opacity: 0; }
                .rev-bars-ghost { animation: chartRiseUp 0.6s ease-out 0.2s forwards; clip-path: inset(100% 0 0 0); }
                .rev-bars-krw { animation: chartRiseUp 0.9s ease-out 0.8s forwards; clip-path: inset(100% 0 0 0); }
                .rev-bars-overseas { animation: chartRiseUp 0.9s ease-out 1.7s forwards; clip-path: inset(100% 0 0 0); }
                .rev-bars-overseas-instant { animation: chartRiseUp 0.9s ease-out 1.7s forwards; clip-path: inset(100% 0 0 0); }
                .vis-bars-ghost { clip-path: inset(0 0 0 0); fill: #f3f4f6; }
                .vis-bars-krw { clip-path: inset(0 0 0 0); fill: #3b82f6; }
                .vis-bars-overseas { clip-path: inset(0 0 0 0); fill: #f59e0b; }
              `}</style>

              <div 
                key={`${selectedPeriod}-${selectedYear}`}
                className="h-[300px] min-w-0"
                style={{ 
                  opacity: isChanging ? 0 : 1,
                  transition: isChanging ? 'none' : 'opacity 0.2s ease-in'
                }}
              >
                {chartReady ? (
                  <ResponsiveContainer width="100%" height={300} minWidth={0}>
                    <BarChart 
                      data={filteredChartData} 
                      barCategoryGap={filteredChartData.length > 80 ? "6%" : filteredChartData.length > 48 ? "10%" : filteredChartData.length > 24 ? "18%" : "25%"}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <Legend 
                        verticalAlign="top" 
                        align="right" 
                        iconType="circle" 
                        wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: 'bold' }} 
                      />
                      <XAxis
                        className="anim-xaxis"
                        xAxisId="month"
                        type={filteredChartData.length <= 1 ? "category" : "number"}
                        dataKey={filteredChartData.length <= 1 ? "month" : "idx"}
                        domain={filteredChartData.length <= 1 ? undefined : [-0.5, filteredChartData.length - 0.5]}
                        ticks={filteredChartData.length <= 1 ? undefined : filteredChartData.map(d => d.idx)}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        tick={(props) => {
                          const { x, y, payload } = props;
                          const idx = payload.value;
                          const current = filteredChartData[idx];
                          if (!current) return null;
                          const [year, month] = current.month.split('.');
                          const yearGroup = filteredChartData.filter(d => d.month.split('.')[0] === year);
                          const midIdx = Math.floor((yearGroup[0].idx + yearGroup[yearGroup.length - 1].idx) / 2);
                          const showYear = idx === midIdx;

                          // 밀집도에 따른 월 표시 (가독성 보호: 10년 120개 조회 시 6/12월, 5년 60개 조회 시 분기별)
                          const totalBars = filteredChartData.length;
                          const mNum = parseInt(month, 10);
                          const isDense = totalBars > 24;
                          const isVeryDense = totalBars > 48;
                          const isUltraDense = totalBars > 80;
                          const showMonthLabel = isUltraDense
                            ? (mNum === 6 || mNum === 12)
                            : isVeryDense
                              ? (mNum === 3 || mNum === 6 || mNum === 9 || mNum === 12)
                              : isDense
                                ? (mNum % 2 === 1 || mNum === 12)
                                : true;

                          return (
                            <g transform={`translate(${x},${y})`}>
                              {showMonthLabel && (
                                <text x={0} y={15} textAnchor="middle" fill="#64748b" fontSize={isDense ? 10 : 12} fontWeight={500}>
                                  {`${mNum}월`}
                                </text>
                              )}
                              {showYear && (
                                <text x={0} y={42} textAnchor="middle" fill="#334155" fontSize={13} fontWeight="bold">
                                  {`20${year}년`}
                                </text>
                              )}
                            </g>
                          );
                        }}
                        height={50}
                      />
                      <YAxis
                        className="anim-yaxis"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 13, fontWeight: 500 }}
                        tickFormatter={(v) => v >= 10000 ? `${v / 10000}만` : v}
                      />
                      <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const hasKRW = data.KRW > 0;
                            const hasOVERSEAS = data.OVERSEAS > 0;
                            
                            return (
                              <div className="bg-white/90 backdrop-blur-md p-4 border border-slate-100 rounded-2xl shadow-xl min-w-[200px]">
                                <p className="text-sm font-black text-slate-800 mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
                                  <Calendar size={14} className="text-brand stroke-[3px]" />
                                  {(() => {
                                    const [y, m] = data.month.split('.');
                                    return `${y}년 ${parseInt(m)}월`;
                                  })()}
                                </p>
                                <div className="space-y-2 mb-3">
                                  {hasKRW && (
                                    <div className="flex justify-between items-center gap-4">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }}></div>
                                        <span className="text-xs font-bold text-slate-600">국내</span>
                                      </div>
                                      <span className="text-sm font-black text-slate-800">{formatCurrency(data.KRW)}</span>
                                    </div>
                                  )}
                                  {hasOVERSEAS && (
                                    <div className="flex justify-between items-center gap-4">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f59e0b' }}></div>
                                        <span className="text-xs font-bold text-slate-600">해외</span>
                                      </div>
                                      <span className="text-sm font-black text-slate-800">{formatCurrency(data.OVERSEAS)}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                                  <span className="text-xs font-bold text-slate-500">월 총합</span>
                                  <span className="text-base font-black text-brand-dark">{formatCurrency(data.total)}</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      {filteredChartData.map((d, idx) => {
                        if (idx > 0 && d.month.split('.')[0] !== filteredChartData[idx - 1].month.split('.')[0]) {
                          return (
                            <ReferenceLine
                              xAxisId="month"
                              key={`ref-${idx}`}
                              x={idx - 0.5}
                              stroke="#94a3b8"
                              strokeWidth={1}
                              strokeDasharray="4 4"
                            />
                          );
                        }
                        return null;
                      })}
                      <Bar name="국내" dataKey="KRW" fill="#3b82f6" barSize={0} opacity={0} isAnimationActive={false} />
                      <Bar name="해외" dataKey="OVERSEAS" fill="#f59e0b" barSize={0} opacity={0} isAnimationActive={false} />

                      <Bar 
                        xAxisId="month" 
                        dataKey="total" 
                        isAnimationActive={false}
                        legendType="none"
                        shape={(props) => {
                          const { x, y, width, height, payload } = props;
                          if (!payload || payload.total <= 0) return null;

                          const krwH = (payload.KRW / payload.total) * height || 0;
                          const overseasH = (payload.OVERSEAS / payload.total) * height || 0;
                          const hasKRW = payload.KRW > 0;
                          
                          return (
                            <g>
                              <rect 
                                className={isRevealing ? "rev-bars-ghost" : "vis-bars-ghost"}
                                x={x} y={y} 
                                width={width} height={height} 
                                fill="#f3f4f6" rx={4} ry={4}
                              />
                              {payload.KRW > 0 && (
                                <rect 
                                  className={isRevealing ? "rev-bars-krw" : "vis-bars-krw"}
                                  x={x} y={y + (height - krwH)} 
                                  width={width} height={krwH + 0.5} 
                                  fill="#3b82f6"
                                />
                              )}
                              {payload.OVERSEAS > 0 && (
                                <rect 
                                  className={isRevealing ? (hasKRW ? "rev-bars-overseas" : "rev-bars-overseas-instant") : "vis-bars-overseas"}
                                  x={x} y={y + (height - krwH - overseasH)} 
                                  width={width} height={overseasH} 
                                  fill="#f59e0b" 
                                />
                              )}
                            </g>
                          );
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-[300px] flex items-center justify-center">
                    <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* 카드형 헤더 및 연도 선택 섹션 */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-800 border-l-4 border-brand pl-4">월별 배당 요약</h2>
                <span className="text-xs text-slate-400 font-medium">카드를 클릭하면 해당 월의 종목별 상세 배당 내역을 확인할 수 있습니다.</span>
              </div>

              {/* 커스텀 연도 선택기 (프리미엄 드롭다운) */}
              <div className="relative" ref={yearDropdownRef}>
                <button 
                  onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border-b-2 border-brand/20 transition-all hover:border-brand/50 group cursor-pointer"
                >
                  <span className="text-lg font-black text-brand tracking-tighter">{selectedYear}년</span>
                  <ChevronDown size={18} className={`text-brand/50 transition-transform duration-300 ${isYearDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isYearDropdownOpen && (
                  <div className="absolute top-full right-0 mt-2 w-32 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/50 z-50 overflow-hidden py-2 animate-fade-in divide-y divide-slate-50">
                    {(availableYears.length > 0 ? availableYears : [new Date().getFullYear().toString()]).map(y => (
                      <button
                        key={y}
                        onClick={() => handleYearChange(y)}
                        className={`w-full px-4 py-2 text-sm font-bold transition-all text-left flex items-center justify-between group cursor-pointer
                          ${selectedYear === y 
                            ? 'text-brand bg-brand/5' 
                            : 'text-slate-500 hover:bg-slate-50 hover:text-brand'
                          }`}
                      >
                        {y}년
                        {selectedYear === y && <div className="w-1.5 h-1.5 rounded-full bg-brand"></div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 연간 배당 합계 요약 창 (Full Width Premium - 클릭 시 연간 월별 배당 상세 팝업) */}
            <div 
              key={`annual-card-${selectedYear}`}
              onClick={() => {
                setAnnualModalFilterMonth('ALL');
                setIsAnnualModalOpen(true);
              }}
              className="bg-white border border-slate-100 rounded-3xl p-8 mb-5 shadow-xl shadow-slate-200/50 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group opacity-0 animate-page-slide cursor-pointer hover:shadow-2xl hover:border-brand/30 hover:-translate-y-0.5 transition-all active:scale-[0.99]"
              title="클릭 시 연간 월별 배당 상세 내역이 팝업으로 조회됩니다"
            >
              <div className="flex items-center gap-6 z-10">
                <div className="flex flex-col">
                  <div className="flex items-center mb-1.5">
                    <span className="text-sm font-black text-brand uppercase tracking-[0.2em]">{selectedYear} ANNUAL REPORT</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">연간 총 배당현황</h2>
                    <span className="text-xs font-bold text-brand bg-brand/5 border border-brand/20 px-2.5 py-1 rounded-full group-hover:bg-brand group-hover:text-white transition-all shadow-2xs">
                      월별 내역 조회 ↗
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 mt-1.5">
                    <CheckCircle size={14} strokeWidth={3} className="text-brand/60" />
                    <p className="text-base font-bold">
                      {groupedData[selectedYear]?.count || 0} 건의 배당 내역이 있습니다
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-center md:items-end z-10">
                <span className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 font-bold">Total Dividends Received</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-brand-dark tabular-nums tracking-tighter">
                    {formatCurrency(groupedData[selectedYear]?.total || 0)}
                  </span>
                  <span className="text-xl font-bold text-slate-400">원</span>
                </div>
              </div>

              {/* 배경용 데코 */}
              <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-brand/5 to-transparent pointer-events-none"></div>
              <div className="absolute top-0 left-0 w-2 h-full bg-brand"></div>
            </div>

            {/* 1월 ~ 12월 카드 그리드: 1~6월, 7~12월 각각 한 줄로 표시 (연도 변경 시 전체 1~12월 순차 재등장) */}
            <div key={`dividend-cards-grid-${selectedYear}`} className="space-y-4 mb-2">
              {/* 상반기: 1 ~ 6월 */}
              <div className="grid grid-cols-6 gap-4">
                {Array.from({ length: 6 }, (_, i) => {
                  const m = (i + 1).toString().padStart(2, '0');
                  const monthData = groupedData[selectedYear]?.months[m];
                  const amount = monthData?.total || 0;
                  const hasData = amount > 0;
                  const isMaxMonth = hasData && amount === maxMonthlyTotal && maxMonthlyTotal > 0;
                  const stockCount = monthData?.items?.length || 0;

                  let krw = 0;
                  let overseas = 0;
                  (monthData?.items || []).forEach(st => {
                    if (st.currency === 'KRW') krw += (Number(st.total) || 0);
                    else overseas += (Number(st.total) || 0);
                  });

                  return (
                    <div 
                      key={`card-${selectedYear}-${m}`}
                      onClick={() => {
                        if (hasData && monthData?.items?.length > 0) {
                          setSelectedMonthModal({
                            mNum: i + 1,
                            mStr: m,
                            total: amount,
                            items: monthData.items || []
                          });
                        }
                      }}
                      className={`relative group overflow-hidden rounded-[1.25rem] p-4 transition-all duration-300 border opacity-0 animate-page-slide stagger-${i + 1} ${
                        hasData 
                          ? isMaxMonth
                            ? 'bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 border-emerald-300 shadow-lg shadow-emerald-500/10 hover:border-emerald-400 hover:-translate-y-1 hover:shadow-xl cursor-pointer active:scale-95'
                            : 'bg-white border-slate-200/90 shadow-sm hover:border-blue-300 hover:-translate-y-1 hover:shadow-md cursor-pointer active:scale-95'
                          : 'bg-slate-50/70 border-slate-100/90 hover:bg-white/80 transition-colors duration-300'
                      }`}
                    >
                      {/* 좌측 포인트 바 */}
                      <div className={`absolute top-0 left-0 w-2 h-full z-20 ${
                        hasData ? (isMaxMonth ? 'bg-emerald-500' : 'bg-blue-600') : 'bg-slate-200'
                      }`} />
                      
                      {/* 1행: 좌측 MONTH 라벨 / 우측 국내/해외 구분 */}
                      <div className="flex justify-between items-start pl-1">
                        <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${
                          hasData ? (isMaxMonth ? 'text-emerald-600' : 'text-blue-600') : 'text-slate-400'
                        }`}>
                          MONTH
                        </span>

                        {/* 우측: 국내 / 해외 도트 & 텍스트 */}
                        <div className="flex items-center gap-2 min-h-[16px]">
                          {hasData && (
                            <>
                              {krw > 0 && (
                                <span className="flex items-center gap-1 text-[11px] font-bold text-slate-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block shrink-0"></span>
                                  국내
                                </span>
                              )}
                              {overseas > 0 && (
                                <span className="flex items-center gap-1 text-[11px] font-bold text-slate-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block shrink-0"></span>
                                  해외
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* 2행: 좌측 월 숫자(1월) & '최대' 배지 / 우측 종목수 (| 2종목) */}
                      <div className="flex justify-between items-center pl-1 mt-0.5">
                        <div className="flex items-center gap-1.5">
                          <h3 className={`text-2xl font-black ${
                            hasData ? (isMaxMonth ? 'text-emerald-800' : 'text-slate-900') : 'text-slate-400'
                          }`}>
                            {i + 1}월
                          </h3>
                          {isMaxMonth && (
                            <span className="text-[9px] font-black text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-full tracking-tight shrink-0 shadow-2xs">
                              최대
                            </span>
                          )}
                        </div>

                        {/* 우측: 종목수 (| 2종목) */}
                        <div className="flex items-center gap-1.5 pr-0.5 min-h-[22px]">
                          {hasData ? (
                            <>
                              <div className={`w-[2.5px] h-3.5 rounded-full shrink-0 ${isMaxMonth ? 'bg-emerald-500' : 'bg-blue-600'}`} />
                              <span className={`text-xs font-bold ${isMaxMonth ? 'text-emerald-800 font-extrabold' : 'text-slate-800'}`}>
                                {stockCount}종목
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-300 font-semibold">-</span>
                          )}
                        </div>
                      </div>

                      {/* 3행: 하단 우측 TOTAL & 금액 */}
                      <div className="flex flex-col items-end mt-3 pr-0.5">
                        <span className={`text-[10px] font-black uppercase tracking-tight mb-0.5 ${
                          hasData ? (isMaxMonth ? 'text-emerald-600' : 'text-blue-600') : 'text-slate-300'
                        }`}>
                          TOTAL
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-2xl font-black tabular-nums transition-all ${
                            hasData ? (isMaxMonth ? 'text-emerald-700' : 'text-blue-600') : 'text-slate-300'
                          }`}>
                            {formatCurrency(amount)}
                          </span>
                          <span className={`text-xs font-bold ${hasData ? 'text-slate-400' : 'text-slate-200'}`}>원</span>
                        </div>
                      </div>

                      {/* 배경 장식 */}
                      {hasData && (
                        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-brand/5 rounded-full blur-3xl group-hover:bg-brand/10 transition-all duration-700 pointer-events-none"></div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 하반기: 7 ~ 12월 */}
              <div className="grid grid-cols-6 gap-4">
                {Array.from({ length: 6 }, (_, idx) => {
                  const i = idx + 6;
                  const m = (i + 1).toString().padStart(2, '0');
                  const monthData = groupedData[selectedYear]?.months[m];
                  const amount = monthData?.total || 0;
                  const hasData = amount > 0;
                  const isMaxMonth = hasData && amount === maxMonthlyTotal && maxMonthlyTotal > 0;
                  const stockCount = monthData?.items?.length || 0;

                  let krw = 0;
                  let overseas = 0;
                  (monthData?.items || []).forEach(st => {
                    if (st.currency === 'KRW') krw += (Number(st.total) || 0);
                    else overseas += (Number(st.total) || 0);
                  });

                  return (
                    <div 
                      key={`card-${selectedYear}-${m}`}
                      onClick={() => {
                        if (hasData && monthData?.items?.length > 0) {
                          setSelectedMonthModal({
                            mNum: i + 1,
                            mStr: m,
                            total: amount,
                            items: monthData.items || []
                          });
                        }
                      }}
                      className={`relative group overflow-hidden rounded-[1.25rem] p-4 transition-all duration-300 border opacity-0 animate-page-slide stagger-${i + 1} ${
                        hasData 
                          ? isMaxMonth
                            ? 'bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 border-emerald-300 shadow-lg shadow-emerald-500/10 hover:border-emerald-400 hover:-translate-y-1 hover:shadow-xl cursor-pointer active:scale-95'
                            : 'bg-white border-slate-200/90 shadow-sm hover:border-blue-300 hover:-translate-y-1 hover:shadow-md cursor-pointer active:scale-95'
                          : 'bg-slate-50/70 border-slate-100/90 hover:bg-white/80 transition-colors duration-300'
                      }`}
                    >
                      {/* 좌측 포인트 바 */}
                      <div className={`absolute top-0 left-0 w-2 h-full z-20 ${
                        hasData ? (isMaxMonth ? 'bg-emerald-500' : 'bg-blue-600') : 'bg-slate-200'
                      }`} />
                      
                      {/* 1행: 좌측 MONTH 라벨 / 우측 국내/해외 구분 */}
                      <div className="flex justify-between items-start pl-1">
                        <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${
                          hasData ? (isMaxMonth ? 'text-emerald-600' : 'text-blue-600') : 'text-slate-400'
                        }`}>
                          MONTH
                        </span>

                        {/* 우측: 국내 / 해외 도트 & 텍스트 */}
                        <div className="flex items-center gap-2 min-h-[16px]">
                          {hasData && (
                            <>
                              {krw > 0 && (
                                <span className="flex items-center gap-1 text-[11px] font-bold text-slate-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block shrink-0"></span>
                                  국내
                                </span>
                              )}
                              {overseas > 0 && (
                                <span className="flex items-center gap-1 text-[11px] font-bold text-slate-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block shrink-0"></span>
                                  해외
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* 2행: 좌측 월 숫자(1월) & '최대' 배지 / 우측 종목수 (| 2종목) */}
                      <div className="flex justify-between items-center pl-1 mt-0.5">
                        <div className="flex items-center gap-1.5">
                          <h3 className={`text-2xl font-black ${
                            hasData ? (isMaxMonth ? 'text-emerald-800' : 'text-slate-900') : 'text-slate-400'
                          }`}>
                            {i + 1}월
                          </h3>
                          {isMaxMonth && (
                            <span className="text-[9px] font-black text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-full tracking-tight shrink-0 shadow-2xs">
                              최대
                            </span>
                          )}
                        </div>

                        {/* 우측: 종목수 (| 2종목) */}
                        <div className="flex items-center gap-1.5 pr-0.5 min-h-[22px]">
                          {hasData ? (
                            <>
                              <div className={`w-[2.5px] h-3.5 rounded-full shrink-0 ${isMaxMonth ? 'bg-emerald-500' : 'bg-blue-600'}`} />
                              <span className={`text-xs font-bold ${isMaxMonth ? 'text-emerald-800 font-extrabold' : 'text-slate-800'}`}>
                                {stockCount}종목
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-300 font-semibold">-</span>
                          )}
                        </div>
                      </div>

                      {/* 3행: 하단 우측 TOTAL & 금액 */}
                      <div className="flex flex-col items-end mt-3 pr-0.5">
                        <span className={`text-[10px] font-black uppercase tracking-tight mb-0.5 ${
                          hasData ? (isMaxMonth ? 'text-emerald-600' : 'text-blue-600') : 'text-slate-300'
                        }`}>
                          TOTAL
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-2xl font-black tabular-nums transition-all ${
                            hasData ? (isMaxMonth ? 'text-emerald-700' : 'text-blue-600') : 'text-slate-300'
                          }`}>
                            {formatCurrency(amount)}
                          </span>
                          <span className={`text-xs font-bold ${hasData ? 'text-slate-400' : 'text-slate-200'}`}>원</span>
                        </div>
                      </div>

                      {/* 배경 장식 */}
                      {hasData && (
                        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-brand/5 rounded-full blur-3xl group-hover:bg-brand/10 transition-all duration-700 pointer-events-none"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── 월별 상세 배당 팝업 모달 (샘플 데스크톱 모달) ── */}
        {isMonthModalOpen && monthModalData && (
          <div 
            className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 ${
              isMonthClosing ? 'animate-fade-out pointer-events-none' : 'animate-fade-in'
            }`}
            onClick={() => setSelectedMonthModal(null)}
          >
            <div 
              className={`bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl max-h-[82vh] flex flex-col overflow-hidden ${
                isMonthClosing ? 'animate-modal-out' : 'animate-page-slide'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 모달 헤더 */}
              <div className="flex justify-between items-start p-6 pb-4 border-b border-slate-100 shrink-0">
                <div>
                  <span className="text-xs font-bold text-slate-400 block">
                    {selectedYear}년 배당 내역
                  </span>
                  <div className="flex items-center gap-2.5 mt-1">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">
                      {monthModalData.mNum}월 배당 종목
                    </h3>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                      {monthModalData.items.length}개 종목
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 font-bold block">월 총 배당금</span>
                    <span className="text-lg font-black text-emerald-600 tabular-nums tracking-tight">
                      {formatCurrency(monthModalData.total)}원
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedMonthModal(null)}
                    className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    aria-label="닫기"
                  >
                    <X size={20} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* 모달 본문: 종목 리스트 */}
              <div className="overflow-y-auto p-6 space-y-2.5 flex-1">
                {monthModalData.items.map((st, idx) => {
                  const isKRW = st.currency === 'KRW';
                  const stockCode = formatStockCode(st.code);

                  // 해외종목 외화 배당금 계산
                  let foreignAmount = Number(st.dividendAmount) || 0;
                  if (!isKRW && foreignAmount <= 0 && dividendTransactions && dividendTransactions.length > 0) {
                    const mStr = String(monthModalData.mNum).padStart(2, '0');
                    const mKey = `${selectedYear}-${mStr}`;
                    const matchingTxList = dividendTransactions.filter(tx =>
                      (tx.date || '').startsWith(mKey) &&
                      ((tx.stock_code || tx.stockCode) === st.code || (tx.stock_name || tx.stock) === st.name)
                    );
                    foreignAmount = matchingTxList.reduce((sum, tx) => sum + (Number(tx.dividend_amount) || 0), 0);
                  }
                  if (!isKRW && foreignAmount <= 0 && st.total > 0) {
                    foreignAmount = st.total / 1350;
                  }

                  const sym = getCurrencySymbol(st.currency || 'USD');
                  const cleanDivAmount = !isKRW && foreignAmount > 0
                    ? `${sym} ${foreignAmount.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '';

                  return (
                    <div
                      key={`web-modal-st-${idx}`}
                      className={`p-3.5 bg-slate-50/70 hover:bg-slate-50/90 rounded-2xl border border-slate-100 transition-colors flex items-center gap-3.5 opacity-0 animate-feed-lift stagger-${(idx % 12) + 1}`}
                    >
                      {/* 로고 */}
                      <StockLogo code={st.code} name={st.name} isKRW={isKRW} />

                      {/* 우측 정보 */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        {/* 1행: 종목명 */}
                        <div className="flex justify-between items-center leading-tight">
                          <p className="text-[14px] font-bold text-slate-900 truncate pr-2">
                            {st.name}
                          </p>
                        </div>

                        {/* 2행: 코드 + 배지 + 외화 + 원화 배당금 (모바일 1:1 정렬) */}
                        <div className="flex items-center justify-between mt-1 text-[12px] leading-tight">
                          {/* 좌: 종목코드(고정폭) + 국내/해외 구분 배지 */}
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="font-mono text-slate-400 font-medium w-[62px] shrink-0 truncate">
                              {stockCode}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 text-center ${
                                isKRW
                                  ? "bg-blue-50 text-blue-600 border-blue-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {isKRW ? "국내" : "해외"}
                            </span>
                          </div>

                          {/* 중: 외화 표시 (해외종목 우측 정렬 고정폭 영역) */}
                          <div className="w-[130px] flex justify-end items-center pr-3 shrink-0">
                            {!isKRW && cleanDivAmount ? (
                              <span className="text-[12px] font-medium text-slate-500 tabular-nums truncate">
                                {cleanDivAmount}
                              </span>
                            ) : null}
                          </div>

                          {/* 우: 원화 총 배당금 */}
                          <div className="flex-1 text-right shrink-0">
                            <span className="text-[13px] font-black text-slate-900 tabular-nums">
                              {formatCurrency(st.total)}원
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── 연간 총 배당현황 클릭 시 연간 월별 배당 상세 팝업 모달 ── */}
        {isAnnualMounted && (
          <div 
            className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center pt-[8vh] p-4 overflow-y-auto ${
              isAnnualClosing ? 'animate-fade-out pointer-events-none' : 'animate-fade-in'
            }`}
            onClick={() => setIsAnnualModalOpen(false)}
          >
            <div 
              className={`bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl max-h-[82vh] flex flex-col overflow-hidden ${
                isAnnualClosing ? 'animate-modal-out' : 'animate-page-slide'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 모달 헤더 */}
              <div className="flex justify-between items-start p-6 pb-4 border-b border-slate-100 shrink-0">
                <div>
                  <span className="text-xs font-bold text-brand uppercase tracking-wider block">
                    {selectedYear} ANNUAL REPORT
                  </span>
                  <div className="flex items-center gap-2.5 mt-1">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">
                      {selectedYear}년 연간 월별 배당 내역
                    </h3>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                      총 {groupedData[selectedYear]?.count || 0}건
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 font-bold block">연간 총 배당금</span>
                    <span className="text-xl font-black text-emerald-600 tabular-nums tracking-tight">
                      {formatCurrency(groupedData[selectedYear]?.total || 0)}원
                    </span>
                  </div>
                  <button
                    onClick={() => setIsAnnualModalOpen(false)}
                    className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    aria-label="닫기"
                  >
                    <X size={20} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* 월별 빠른 필터 탭 바: 전체, 1월~12월 전체 표시 (내역 없는 월은 비활성화) */}
              <div className="px-6 py-2.5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setAnnualModalFilterMonth('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    annualModalFilterMonth === 'ALL'
                      ? 'bg-brand text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                  }`}
                >
                  전체
                </button>
                {all12MonthsData.map(m => {
                  const isSelected = annualModalFilterMonth === m.mStr;
                  const hasData = m.hasData;

                  if (!hasData) {
                    return (
                      <button
                        key={`annual-tab-${m.mStr}`}
                        disabled={true}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 bg-slate-50 border border-slate-100 cursor-not-allowed select-none"
                        title={`${m.mNum}월 배당 내역 없음`}
                      >
                        {m.mNum}월
                      </button>
                    );
                  }

                  return (
                    <button
                      key={`annual-tab-${m.mStr}`}
                      onClick={() => setAnnualModalFilterMonth(m.mStr)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-brand text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                      }`}
                    >
                      {m.mNum}월
                    </button>
                  );
                })}
              </div>

              {/* 모달 본문: 월별 그룹 및 종목 리스트 (고정 높이 컨테이너 내부 스크롤) */}
              <div ref={annualScrollRef} className="overflow-y-auto p-6 flex-1">
                <div key={annualModalFilterMonth} className="space-y-6">
                  {(() => {
                    const filteredList = annualMonthlyList.filter(
                      m => annualModalFilterMonth === 'ALL' || m.mStr === annualModalFilterMonth
                    );

                    if (filteredList.length === 0) {
                      return (
                        <div className="py-16 text-center text-slate-400 text-sm font-medium">
                          {selectedYear}년에 등록된 배당 내역이 없습니다.
                        </div>
                      );
                    }

                    let animSeq = 0;
                    return filteredList.map(m => {
                      const headerStagger = (animSeq++ % 16) + 1;
                      return (
                        <div key={`annual-month-group-${m.mStr}`} className="space-y-2.5">
                          {/* 월 구분 헤더 바 (합계 항목부터 순서대로 stagger 효과 적용) */}
                          <div 
                            className={`flex justify-between items-center bg-slate-100/90 px-4 py-2.5 rounded-2xl border border-slate-200/80 sticky top-0 z-10 backdrop-blur-md shadow-2xs opacity-0 animate-feed-lift stagger-${headerStagger}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                              <span className="text-base font-black text-slate-800 tracking-tight">{m.mNum}월</span>
                              <span className="text-xs font-bold text-slate-500">{m.items.length}개 종목</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-[11px] font-bold text-slate-400">합계</span>
                              <span className="text-sm font-black text-emerald-600 tabular-nums">
                                {formatCurrency(m.total)}원
                              </span>
                            </div>
                          </div>

                          {/* 해당 월의 종목별 리스트 (위에서부터 순서대로 stagger 효과 적용) */}
                          <div className="space-y-2 pl-0.5 pr-0.5">
                            {m.items.map((st, idx) => {
                              const itemStagger = (animSeq++ % 16) + 1;
                              const isKRW = st.currency === 'KRW';
                              const stockCode = formatStockCode(st.code);

                              // 해외종목 외화 배당금 계산
                              let foreignAmount = Number(st.dividendAmount) || 0;
                              if (!isKRW && foreignAmount <= 0 && dividendTransactions && dividendTransactions.length > 0) {
                                const mKey = `${selectedYear}-${m.mStr}`;
                                const matchingTxList = dividendTransactions.filter(tx =>
                                  (tx.date || '').startsWith(mKey) &&
                                  ((tx.stock_code || tx.stockCode) === st.code || (tx.stock_name || tx.stock) === st.name)
                                );
                                foreignAmount = matchingTxList.reduce((sum, tx) => sum + (Number(tx.dividend_amount) || 0), 0);
                              }
                              if (!isKRW && foreignAmount <= 0 && st.total > 0) {
                                foreignAmount = st.total / 1350;
                              }

                              const sym = getCurrencySymbol(st.currency || 'USD');
                              const cleanDivAmount = !isKRW && foreignAmount > 0
                                ? `${sym} ${foreignAmount.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '';

                              return (
                                <div
                                  key={`annual-st-${m.mStr}-${idx}`}
                                  className={`p-3.5 bg-slate-50/70 hover:bg-slate-50/90 rounded-2xl border border-slate-100 transition-colors flex items-center gap-3.5 opacity-0 animate-feed-lift stagger-${itemStagger}`}
                                >
                                  {/* 로고 */}
                                  <StockLogo code={st.code} name={st.name} isKRW={isKRW} />

                                  {/* 우측 정보 */}
                                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    {/* 1행: 종목명 */}
                                    <div className="flex justify-between items-center leading-tight">
                                      <p className="text-[14px] font-bold text-slate-900 truncate pr-2">
                                        {st.name}
                                      </p>
                                    </div>

                                    {/* 2행: 코드 + 배지 + 외화 + 원화 배당금 (모바일 1:1 정렬) */}
                                    <div className="flex items-center justify-between mt-1 text-[12px] leading-tight">
                                      {/* 좌: 종목코드(고정폭) + 국내/해외 구분 배지 */}
                                      <div className="flex items-center gap-1 shrink-0">
                                        <span className="font-mono text-slate-400 font-medium w-[62px] shrink-0 truncate">
                                          {stockCode}
                                        </span>
                                        <span
                                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 text-center ${
                                            isKRW
                                              ? "bg-blue-50 text-blue-600 border-blue-200"
                                              : "bg-amber-50 text-amber-700 border-amber-200"
                                          }`}
                                        >
                                          {isKRW ? "국내" : "해외"}
                                        </span>
                                      </div>

                                      {/* 중: 외화 표시 (해외종목 우측 정렬 고정폭 영역) */}
                                      <div className="w-[130px] flex justify-end items-center pr-3 shrink-0">
                                        {!isKRW && cleanDivAmount ? (
                                          <span className="text-[12px] font-medium text-slate-500 tabular-nums truncate">
                                            {cleanDivAmount}
                                          </span>
                                        ) : null}
                                      </div>

                                      {/* 우: 원화 총 배당금 */}
                                      <div className="flex-1 text-right shrink-0">
                                        <span className="text-[13px] font-black text-slate-900 tabular-nums">
                                          {formatCurrency(st.total)}원
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
