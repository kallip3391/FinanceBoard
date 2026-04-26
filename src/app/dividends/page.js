"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ChevronDown, ChevronRight, List, Sprout, Calendar, LayoutDashboard, TrendingUp, CheckCircle } from "lucide-react";
import {
   BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { useAuth } from "@/contexts/AuthContext";
import { TransactionManager } from "@/lib/transactionManager";

const getCurrencyBadgeStyles = (currency) => {
  const styles = {
    'KRW': 'bg-blue-50 text-blue-600 border-blue-200',
    'USD': 'bg-emerald-50 text-emerald-600 border-emerald-200',
    'JPY': 'bg-rose-50 text-rose-600 border-rose-200',
    'EUR': 'bg-indigo-50 text-indigo-600 border-indigo-200',
    'HKD': 'bg-amber-50 text-amber-600 border-amber-200',
    'CNY': 'bg-red-50 text-red-600 border-red-200',
    'GBP': 'bg-violet-50 text-violet-600 border-violet-200'
  };
  return styles[currency] || 'bg-slate-50 text-slate-400 border-slate-100';
};

const getCurrencyStyle = (currency) => {
  switch (currency) {
    case 'KRW': return { accent: 'bg-blue-500' };
    case 'USD': return { accent: 'bg-emerald-500' };
    case 'JPY': return { accent: 'bg-rose-500' };
    case 'EUR': return { accent: 'bg-indigo-500' };
    case 'HKD': return { accent: 'bg-amber-500' };
    case 'CNY': return { accent: 'bg-red-500' };
    case 'GBP': return { accent: 'bg-violet-500' };
    default: return { accent: 'bg-slate-400' };
  }
};

export default function DividendsPage() {
  const { user } = useAuth();
  const [dividends, setDividends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartReady, setChartReady] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('1년');

  // 년도/월 토글 상태
  const [expandedYears, setExpandedYears] = useState(new Set());
  const [expandedMonths, setExpandedMonths] = useState(new Set());
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const yearDropdownRef = useRef(null);

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

  const formatCurrency = (value) => new Intl.NumberFormat('ko-KR').format(value || 0);


  // 데이터 집계 및 차트 가공
  const { filteredChartData, groupedData, totalDividends, availableYears } = useMemo(() => {
    let totalObj = 0;
    const grouped = {};
    const monthlyCurrencyTotals = {}; // for chart: { '26.03': { KRW: 1000, OVERSEAS: 2000 } }

    // 현재 시점 기준으로 기간 계산
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11

    const getMonthDistance = (year, month) => {
      return (currentYear - parseInt(year)) * 12 + (currentMonth - (parseInt(month) - 1));
    };

    dividends.forEach(item => {
      const recordMonth = item.record_month || ''; // 'YYYY-MM'
      if (!recordMonth || recordMonth.length < 7) return;
      
      const year = recordMonth.split('-')[0];
      const month = recordMonth.split('-')[1];
      
      const amt = Number(item.total_dividend) || 0;
      totalObj += amt;

      const shortYear = year.slice(2);
      const chartKey = `${shortYear}.${month}`;

      // 기간 필터링 체크 (현재 월 기준 상대적 거리)
      const distance = getMonthDistance(year, month);
      let isWithinPeriod = true;
      if (selectedPeriod === '1년') isWithinPeriod = distance <= 12 && distance >= -6;
      else if (selectedPeriod === '3년') isWithinPeriod = distance <= 36 && distance >= -12;
      else if (selectedPeriod === '5년') isWithinPeriod = distance <= 60 && distance >= -12;

      if (isWithinPeriod) {
        if (!monthlyCurrencyTotals[chartKey]) monthlyCurrencyTotals[chartKey] = { KRW: 0, OVERSEAS: 0 };
        const curr = item.currency || 'KRW';
        if (curr === 'KRW') {
          monthlyCurrencyTotals[chartKey].KRW += amt;
        } else {
          monthlyCurrencyTotals[chartKey].OVERSEAS += amt;
        }
      }

      // 그룹화는 전체 기간 데이터 사용 (테이블용)
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
      if (!grouped[year].months[month].stocks[stockName]) {
        grouped[year].months[month].stocks[stockName] = {
          name: stockName,
          code: item.security_code || '',
          total: 0,
          currency: item.currency || 'KRW'
        };
      }
      grouped[year].months[month].stocks[stockName].total += amt;
    });

    // Convert stocks map to sorted array for each month
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

    const chartArray = Object.keys(monthlyCurrencyTotals)
      .sort((a, b) => a.localeCompare(b))
      .map(k => ({
        month: k,
        KRW: monthlyCurrencyTotals[k].KRW,
        OVERSEAS: monthlyCurrencyTotals[k].OVERSEAS,
        total: monthlyCurrencyTotals[k].KRW + monthlyCurrencyTotals[k].OVERSEAS
      }));

    return {
      filteredChartData: chartArray.map((d, index) => ({ ...d, idx: index })),
      groupedData: grouped,
      totalDividends: totalObj,
      availableYears: Object.keys(grouped).sort((a, b) => b - a)
    };
  }, [dividends, selectedPeriod]);



  const toggleYear = (year) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const isYearExpanded = (year) => expandedYears.has(year);
  const monthKey = (year, month) => `${year}-${month}`;

  const toggleMonth = (year, month) => {
    const key = monthKey(year, month);
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isMonthExpanded = (year, month) => expandedMonths.has(monthKey(year, month));

  // 펼치기/접기 제어 기능
  const expandToMonths = () => {
    const years = new Set(Object.keys(groupedData));
    setExpandedYears(years);
    setExpandedMonths(new Set());
  };

  const expandToStocks = () => {
    const years = new Set(Object.keys(groupedData));
    const months = new Set();
    Object.keys(groupedData).forEach(y => {
      Object.keys(groupedData[y].months).forEach(m => {
        months.add(monthKey(y, m));
      });
    });
    setExpandedYears(years);
    setExpandedMonths(months);
  };

  const collapseAll = () => {
    setExpandedYears(new Set());
    setExpandedMonths(new Set());
  };

  const sortedYears = Object.keys(groupedData).sort((a, b) => Number(b) - Number(a));
  
  const [isChanging, setIsChanging] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false); // 초기 로딩 애니메이션 제어

  useEffect(() => {
    async function fetchData() {
      if (user) {
        try {
          setLoading(true);
          const data = await TransactionManager.getMonthlyDividendSummary();
          setDividends(data || []);
          setExpandedYears(new Set());
          setExpandedMonths(new Set());
        } catch (error) {
          console.error('배당금 내역 로드 오류:', error);
          setDividends([]);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
        setDividends([]);
      }
    }
    fetchData();

    if (!chartReady) {
      const timer = setTimeout(() => {
        setChartReady(true);
        setIsRevealing(true);
        // 3초 뒤 애니메이션 클래스 제거하여 사이드바 등 UI 조작 시 재발동 방지
        setTimeout(() => setIsRevealing(false), 3000);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [user?.id, chartReady]);

  const handlePeriodChange = (p) => {
    if (p === selectedPeriod) return;
    setIsChanging(true);
    setIsRevealing(false);
    
    setTimeout(() => {
      setSelectedPeriod(p);
      setTimeout(() => {
        setIsChanging(false);
        setIsRevealing(true);
        // 애니메이션 완료 후 고정 상태로 변경
        setTimeout(() => setIsRevealing(false), 3000);
      }, 50);
    }, 200);
  };

  return (
    <div className="animate-fade-in h-full flex flex-col pb-10">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/50 shadow-sm">
            <Sprout size={20} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">배당금 현황</h1>
        </div>

        <div className="flex items-center gap-4">
          {!user && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg text-sm">
              로그인 후 본인의 배당내역을 확인할 수 있습니다.
            </div>
          )}
          {user && loading && <span className="text-sm text-slate-400 self-center">데이터를 불러오는 중...</span>}
        </div>
      </div>

      {/* Bar Chart Section */}
      {user && chartReady && (
        <div className="glass-card p-6 min-h-[400px] mb-8 overflow-hidden">
          <div className="flex justify-end items-center mb-6">
            <div className="flex flex-col items-end gap-3">
              <div className="flex gap-2">
                {['1년', '3년', '5년', '전체'].map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePeriodChange(p)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${selectedPeriod === p
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
                  {formatCurrency(totalDividends)}
                  <span className="text-base font-bold ml-1 text-brand">원</span>
                </span>
              </div>
            </div>
          </div>

          <style>{`
            @keyframes chartFadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes chartRiseUp {
              from { 
                clip-path: inset(100% 0 0 0);
              }
              to { 
                clip-path: inset(0 0 0 0);
              }
            }
            .anim-xaxis { animation: chartFadeIn 0.5s ease-out forwards; opacity: 0; }
            .anim-yaxis { animation: chartFadeIn 0.5s ease-out 0.5s forwards; opacity: 0; }
            
            .rev-bars-ghost { animation: chartRiseUp 0.6s ease-out 0.2s forwards; clip-path: inset(100% 0 0 0); }
            .rev-bars-krw { animation: chartRiseUp 0.9s ease-out 0.8s forwards; clip-path: inset(100% 0 0 0); }
            .rev-bars-overseas { animation: chartRiseUp 0.9s ease-out 1.7s forwards; clip-path: inset(100% 0 0 0); }
            .rev-bars-overseas-instant { animation: chartRiseUp 0.9s ease-out 1.7s forwards; clip-path: inset(100% 0 0 0); }
            
            /* 고정 노출 상태 (애니메이션 완료 후 또는 UI 실시간 변경 시) */
            .vis-bars-ghost { clip-path: inset(0 0 0 0); fill: #f3f4f6; }
            .vis-bars-krw { clip-path: inset(0 0 0 0); fill: #3b82f6; }
            .vis-bars-overseas { clip-path: inset(0 0 0 0); fill: #f59e0b; }
          `}</style>

          <div 
            key={selectedPeriod}
            className="h-[300px] min-w-0"
            style={{ 
              opacity: isChanging ? 0 : 1,
              transition: isChanging ? 'none' : 'opacity 0.2s ease-in'
            }}
          >
            {/* 표준 스택 바 차트: 부드러운 전환 효과 구현 */}
            <ResponsiveContainer width="100%" height={300} minWidth={0}>
              <BarChart data={filteredChartData} barCategoryGap="25%">
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
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text x={0} y={15} textAnchor="middle" fill="#64748b" fontSize={12} fontWeight={500}>
                          {`${parseInt(month)}월`}
                        </text>
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
                {/* 범례 표시용 투명 바 (실제 그리지는 않음) */}
                <Bar name="국내" dataKey="KRW" fill="#3b82f6" barSize={0} opacity={0} isAnimationActive={false} />
                <Bar name="해외" dataKey="OVERSEAS" fill="#f59e0b" barSize={0} opacity={0} isAnimationActive={false} />

                {/* 
                  마스터 바(Master Bar): 
                  단일 Bar 컴포넌트 내에서 배경/국내/해외를 한꺼번에 그리는 커스텀 셰이프 방식.
                  시리즈 분리로 인한 가로 어긋남 및 오버랩 문제를 원천적으로 해결합니다.
                */}
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
                        {/* 1단계: Ghost 배경 프레임 */}
                        <rect 
                          className={isRevealing ? "rev-bars-ghost" : "vis-bars-ghost"}
                          x={x} y={y} 
                          width={width} height={height} 
                          fill="#f3f4f6" rx={4} ry={4}
                        />
                        {/* 2단계: 국내 배당금 */}
                        {payload.KRW > 0 && (
                          <rect 
                            className={isRevealing ? "rev-bars-krw" : "vis-bars-krw"}
                            x={x} y={y + (height - krwH)} 
                            width={width} height={krwH + 0.5} 
                            fill="#3b82f6"
                          />
                        )}
                        {/* 3단계: 해외 데이터 */}
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
          </div>
        </div>
      )}

      {/* Grouped Content Section */}
      <div className="flex justify-between items-end mb-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800 border-l-4 border-brand pl-4">배당 요약</h2>
            {user && (
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('card')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                    viewMode === 'card' 
                      ? 'bg-brand text-white shadow-md shadow-brand/20' 
                      : 'bg-white text-slate-500 border border-slate-200 shadow-sm hover:bg-slate-50'
                  }`}
                >
                  <LayoutDashboard size={16} />
                  카드형
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                    viewMode === 'list' 
                      ? 'bg-brand text-white shadow-md shadow-brand/20' 
                      : 'bg-white text-slate-500 border border-slate-200 shadow-sm hover:bg-slate-50'
                  }`}
                >
                  <List size={16} />
                  리스트형
                </button>
              </div>
            )}
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-3">
            {viewMode === 'card' ? (
              /* 커스텀 연도 선택기 (프리미엄 드롭다운) */
              <div className="relative" ref={yearDropdownRef}>
                <button 
                  onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border-b-2 border-brand/20 transition-all hover:border-brand/50 group cursor-pointer"
                >
                  <span className="text-lg font-black text-brand tracking-tighter">{selectedYear}년</span>
                  <ChevronDown size={18} className={`text-brand/50 transition-transform duration-300 ${isYearDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isYearDropdownOpen && (
                  <div className="absolute top-full right-0 mt-2 w-32 bg-white/90 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/50 z-50 overflow-hidden py-2 animate-fade-in divide-y divide-slate-50">
                    {(availableYears.length > 0 ? availableYears : [new Date().getFullYear().toString()]).map(y => (
                      <button
                        key={y}
                        onClick={() => {
                          setSelectedYear(y);
                          setIsYearDropdownOpen(false);
                        }}
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
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={collapseAll}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 shadow-sm transition-all"
                  title="모두 접기"
                >
                  년
                </button>
                <button
                  onClick={expandToMonths}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 shadow-sm transition-all"
                  title="월까지 펼치기"
                >
                  월
                </button>
                <button
                  onClick={expandToStocks}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 shadow-sm transition-all"
                  title="종목까지 전체 펼치기"
                >
                  <List size={14} />
                  전체
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {user && viewMode === 'card' ? (
        <div key={`card-view-${selectedYear}`} className="animate-fade-in">
          {!user ? (
            <div className="bg-white border border-slate-100 rounded-3xl p-20 shadow-sm flex flex-col items-center justify-center text-slate-500 gap-4 mb-10">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                <LayoutDashboard size={32} />
              </div>
              <span className="text-lg font-bold">로그인 후 배당내역을 확인할 수 있습니다.</span>
            </div>
          ) : (
            <>
              {/* 연간 배당 합계 요약 창 (Full Width Premium) */}
              <div className="bg-white border border-slate-100 rounded-3xl p-8 mb-10 shadow-xl shadow-slate-200/50 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group opacity-0 animate-page-slide">
                <div className="flex items-center gap-6 z-10">
                  <div className="flex flex-col">
                    <div className="flex items-center mb-1.5">
                      <span className="text-sm font-black text-brand uppercase tracking-[0.2em]">{selectedYear} ANNUAL REPORT</span>
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">연간 총 배당현황</h2>
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

                {/* 배경용 데코 장착 */}
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-brand/5 to-transparent pointer-events-none"></div>
                <div className="absolute top-0 left-0 w-2 h-full bg-brand"></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
                {Array.from({ length: 12 }, (_, i) => {
                  const m = (i + 1).toString().padStart(2, '0');
                  const monthData = groupedData[selectedYear]?.months[m];
                  const amount = monthData?.total || 0;
                  const hasData = amount > 0;

                  return (
                    <div 
                      key={`${selectedYear}-${m}`} 
                      className={`relative group overflow-hidden rounded-[1.25rem] p-4 transition-all duration-500 border opacity-0 animate-page-slide stagger-${i + 1} cursor-pointer ${
                        hasData 
                          ? 'bg-white border-brand/10 shadow-lg shadow-brand/5 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/10 active:scale-95' 
                          : 'bg-slate-50/50 border-slate-100 hover:bg-white transition-colors duration-500'
                      }`}
                    >
                      {/* 좌측 포인트 바 */}
                      <div className={`absolute top-0 left-0 w-1.5 h-full z-20 ${hasData ? 'bg-brand' : 'bg-slate-200'}`}></div>
                      
                      {/* 상단: 월 표시 */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex flex-col">
                          <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${hasData ? 'text-brand' : 'text-slate-400'}`}>MONTH</span>
                          <h3 className={`text-2xl font-black ${hasData ? 'text-slate-800' : 'text-slate-400'}`}>{i + 1}월</h3>
                        </div>
                        {hasData && (
                          <div className="flex items-center justify-center text-brand group-hover:rotate-12 group-hover:scale-110 transition-all duration-500">
                            <TrendingUp size={24} strokeWidth={2.5} />
                          </div>
                        )}
                      </div>

                      {/* 하단: 금액 표시 */}
                      <div className="flex flex-col items-end">
                        <span className={`text-[9px] font-bold uppercase tracking-tight mb-1 ${hasData ? 'text-brand' : 'text-slate-300'}`}>TOTAL</span>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-xl font-black tabular-nums transition-all ${
                            hasData ? 'text-brand-dark' : 'text-slate-300'
                          }`}>
                            {formatCurrency(amount)}
                          </span>
                          <span className={`text-[10px] font-bold ${hasData ? 'text-slate-400' : 'text-slate-200'}`}>원</span>
                        </div>
                      </div>

                      {/* 프리미엄 장식 요소 */}
                      {hasData && (
                        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-brand/5 rounded-full blur-3xl group-hover:bg-brand/10 transition-all duration-700"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
    ) : (
        /* 리스트형 테이블 - 상세 정보 */
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm mb-10">
          <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="px-6 py-4 text-left text-[15px] font-bold text-slate-500">{"\u00A0".repeat(3)}년 / 월 / 종목명</th>
              <th className="px-6 py-4 text-center text-[15px] font-bold text-slate-500">종목코드</th>
              <th className="px-6 py-4 text-center text-[15px] font-bold text-slate-500">통화</th>
              <th className="px-6 py-4 text-right text-[15px] font-bold text-slate-500">배당금{"\u00A0".repeat(4)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
              {sortedYears.length === 0 && !loading && (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span>{user ? '등록된 배당금 내역이 없습니다.' : '로그인 후 배당내역을 확인할 수 있습니다.'}</span>
                    </div>
                  </td>
                </tr>
              )}

            {sortedYears.map((year) => {
              const yearData = groupedData[year];
              const sortedMonths = Object.keys(yearData.months).sort((a, b) => Number(b) - Number(a));

              return (
                <React.Fragment key={`year-${year}`}>
                  {/* Year Row */}
                  <tr
                    className="bg-slate-50/30 cursor-pointer"
                    onClick={() => toggleYear(year)}
                  >
                    <td className="px-6 py-5 flex items-center gap-2 font-black text-lg text-slate-800">
                      <div className="bg-slate-400 text-white rounded p-0.5">
                        {isYearExpanded(year) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                      {year}년 <span className="text-sm font-bold text-slate-400">({yearData.count}건)</span>
                    </td>
                    <td></td>
                    <td></td>
                    <td className="px-6 py-5 text-right font-black text-xl text-brand-dark tabular-nums tracking-tighter">{formatCurrency(yearData.total)}</td>
                  </tr>

                  {/* Months & Stocks */}
                  {isYearExpanded(year) && sortedMonths.map((month) => {
                    const monthData = yearData.months[month];
                    return (
                      <React.Fragment key={`month-${year}-${month}`}>
                        {/* Month Row */}
                        <tr
                          className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                          onClick={() => toggleMonth(year, month)}
                        >
                          <td className="px-12 py-3 flex items-center gap-2 font-bold text-base text-slate-700">
                            <div className="bg-slate-200 text-slate-500 rounded p-0.5">
                              {isMonthExpanded(year, month) ? (
                                <ChevronDown size={12} />
                              ) : (
                                <ChevronRight size={12} />
                              )}
                            </div>
                            {Number(month)}월 <span className="text-xs font-bold text-slate-400">({monthData.count}건)</span>
                          </td>
                          <td></td>
                          <td></td>
                          <td className="px-6 py-3 text-right font-black text-lg text-emerald-600 tabular-nums tracking-tighter">
                            {formatCurrency(monthData.total)}
                          </td>
                        </tr>

                        {/* Stocks aggregation by month is already handled in useMemo */}
                        {isMonthExpanded(year, month) && monthData.items.map((item, idx) => (
                          <tr key={`item-${item.name}-${idx}`} className="text-slate-500 hover:bg-slate-50/50 transition-colors">
                            <td className="px-20 py-2">
                              <div className="flex items-center gap-3">
                                <div className={`w-1 h-6 rounded-full ${getCurrencyStyle(item.currency).accent}`}></div>
                                <span className={`text-base font-bold ${getCurrencyBadgeStyles(item.currency).split(' ')[1]}`}>
                                  {item.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-2 text-center">
                              {item.currency !== 'KRW' && item.code && (
                                <span className={`text-base font-bold ${getCurrencyBadgeStyles(item.currency).split(' ')[1]}`}>
                                  {item.code}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-2 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[12px] font-black border transition-all ${getCurrencyBadgeStyles(item.currency)}`}>
                                {item.currency}
                              </span>
                            </td>
                            <td className="px-6 py-2 text-right font-black text-base text-amber-500 tabular-nums tracking-tighter">
                              {formatCurrency(item.total)}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
    </div>
  );
}
