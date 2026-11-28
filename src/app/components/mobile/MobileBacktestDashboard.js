"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Layers,
  RefreshCw,
  Plus,
  Trash2,
  Sliders,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Check,
  X
} from "lucide-react";
import {
  AreaChart,
  Area,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const PERIOD_OPTIONS = [
  { id: "1y", label: "1년" },
  { id: "3y", label: "3년" },
  { id: "5y", label: "5년" },
  { id: "10y", label: "10년" },
  { id: "max", label: "전체" }
];

const PERIOD_LABEL_MAP = {
  "1y": "1년",
  "3y": "3년",
  "5y": "5년",
  "10y": "10년",
  max: "전체"
};

const formatCleanWon = (val) => {
  if (val == null || isNaN(val)) return "0";
  const num = Math.round(val);
  if (num === 0) return "0";
  if (Math.abs(num) >= 100000000) {
    return `${(num / 100000000).toFixed(2)}억`;
  }
  if (Math.abs(num) >= 10000) {
    return `${(num / 10000).toLocaleString()}만`;
  }
  return num.toLocaleString();
};

const formatExactWon = (val) => {
  if (val == null || isNaN(val)) return "0원";
  return `${Math.round(val).toLocaleString()}원`;
};

const formatRollingValue = (val, decimals, showSign, suffix, formatFn, emptyText) => {
  if (val == null || isNaN(val)) return emptyText;
  if (formatFn) return formatFn(val);
  const formattedNum =
    decimals > 0
      ? Number(val).toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        })
      : Math.round(val).toLocaleString();
  const sign = showSign && val > 0 ? "+" : "";
  return `${sign}${formattedNum}${suffix}`;
};

// ── 모바일 KPI 카드 숫자 롤링 카운터 (직접 DOM 렌더링 + easeOutQuart) ──
function MobileRollingNumber({
  value,
  duration = 650,
  decimals = 0,
  showSign = false,
  suffix = "",
  formatFn,
  emptyText = "-"
}) {
  const spanRef = useRef(null);
  const prevValueRef = useRef(0);

  useEffect(() => {
    if (value == null || isNaN(value)) {
      if (spanRef.current) spanRef.current.textContent = emptyText;
      prevValueRef.current = 0;
      return;
    }

    const endVal = Number(value);
    const startVal = Number(prevValueRef.current) || 0;
    if (startVal === endVal) {
      if (spanRef.current) {
        spanRef.current.textContent = formatRollingValue(
          endVal,
          decimals,
          showSign,
          suffix,
          formatFn,
          emptyText
        );
      }
      return;
    }

    let startTime = null;
    let animationFrame;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      const current = startVal + (endVal - startVal) * easeProgress;

      if (spanRef.current) {
        spanRef.current.textContent = formatRollingValue(
          current,
          decimals,
          showSign,
          suffix,
          formatFn,
          emptyText
        );
      }

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      } else {
        if (spanRef.current) {
          spanRef.current.textContent = formatRollingValue(
            endVal,
            decimals,
            showSign,
            suffix,
            formatFn,
            emptyText
          );
        }
        prevValueRef.current = endVal;
      }
    };

    animationFrame = requestAnimationFrame(step);
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [value, duration, decimals, showSign, suffix, formatFn, emptyText]);

  const initialText =
    value != null && !isNaN(value)
      ? formatRollingValue(0, decimals, showSign, suffix, formatFn, emptyText)
      : emptyText;

  return <span ref={spanRef}>{initialText}</span>;
}

const MobileYearOnlyTick = ({ x, y, payload, yearTickSet }) => {
  const label = yearTickSet[payload.value];
  if (!label) return null;
  return (
    <text x={x} y={y + 11} textAnchor="middle" fill="#94a3b8" fontSize={10} fontWeight={600}>
      {label}
    </text>
  );
};

export default function MobileBacktestDashboard({
  user,
  portfolio,
  setPortfolio,
  totalWeight,
  initialAmount,
  setInitialAmount,
  monthlyContribution,
  setMonthlyContribution,
  period,
  setPeriod,
  rebalancing,
  setRebalancing,
  REBALANCING_OPTIONS,
  benchmarks,
  toggleBenchmark,
  searchQuery,
  searchResults,
  selectedSearchIndex = 0,
  setSelectedSearchIndex,
  isSearching,
  isSearchOpen,
  setIsSearchOpen,
  handleSearchInputChange,
  handleSearchKeyDown,
  handleSearchPaste,
  executeSearch,
  addStock,
  updateWeight,
  removeStock,
  handleEqualWeight,
  loading,
  resultData,
  setResultData,
  executedConfig,
  runBacktest,
  insufficientStocks,
  formatWon,
  isMounted,
  showAlert
}) {
  // 3, 4, 5번 결과 화면 슬라이드 인덱스 (0: KPI 카드, 1: 자산 성장 추이 & 낙폭, 2: 연도별 수익률 비교)
  const [resultSlide, setResultSlide] = useState(0);
  const [isRebalOpen, setIsRebalOpen] = useState(false);

  const mobileSearchRef = useRef(null);
  const searchInputRef = useRef(null);
  const portfolioListRef = useRef(null);
  const mobileRebalRef = useRef(null);

  const currentRebalancingOption =
    REBALANCING_OPTIONS.find((o) => o.id === rebalancing) || REBALANCING_OPTIONS[0];

  // 검색 실행 또는 선택 항목 추가 (모바일 키보드 검색/엔터 및 돋보기 버튼 공용)
  const handleTriggerSearch = async (e) => {
    if (e) e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    if (isSearchOpen && searchResults.length > 0) {
      handleSelectSearchItem(searchResults[selectedSearchIndex] || searchResults[0]);
      return;
    }
    const list = await executeSearch(trimmed);
    if (list && list.length > 0) {
      setSelectedSearchIndex?.(0);
      setIsSearchOpen(true);
    } else {
      showAlert(
        "검색 결과 없음",
        `"${trimmed}" 검색 결과가 없습니다.\n티커 또는 종목명을 다시 확인해주세요.`,
        "error"
      );
    }
  };

  // 드롭다운 항목 선택 시 최상단에 종목 추가 후 가상 키보드 닫기 및 스크롤 최상단 이동
  const handleSelectSearchItem = (item) => {
    addStock(item, true);
    searchInputRef.current?.blur?.();
    requestAnimationFrame(() => {
      if (portfolioListRef.current) {
        portfolioListRef.current.scrollTop = 0;
      }
    });
  };

  // 모바일 검색창 엔터 키 입력 시 드롭다운이 열려 있으면 최상단 추가(prepend)
  const handleMobileSearchKeyDown = (e) => {
    if (
      e.key === "Enter" &&
      !e.nativeEvent?.isComposing &&
      isSearchOpen &&
      searchResults.length > 0
    ) {
      e.preventDefault();
      e.stopPropagation();
      handleSelectSearchItem(searchResults[selectedSearchIndex] || searchResults[0]);
      return;
    }
    handleSearchKeyDown(e);
  };

  // 백테스트 실행 시 3번 화면(슬라이드 0)으로 초기화 후 실행
  const handleRunBacktest = () => {
    setResultSlide(0);
    runBacktest();
  };

  // 외부 터치/클릭 시 모바일 검색 드롭다운 및 리밸런싱 드롭다운 닫기
  useEffect(() => {
    const handleOutside = (event) => {
      if (
        mobileSearchRef.current &&
        mobileSearchRef.current.offsetParent !== null &&
        !mobileSearchRef.current.contains(event.target)
      ) {
        setIsSearchOpen(false);
        setSelectedSearchIndex?.(0);
      }
      if (
        mobileRebalRef.current &&
        mobileRebalRef.current.offsetParent !== null &&
        !mobileRebalRef.current.contains(event.target)
      ) {
        setIsRebalOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [setIsSearchOpen, setSelectedSearchIndex]);

  // 기존 종목 유지한 채 종목 입력·수정 화면으로 복귀
  const handleEditPortfolio = () => {
    setResultData(null);
    setResultSlide(0);
  };

  // 결과 조회 취소 -> 1번 초기 화면으로 복귀
  const handleCancelResult = () => {
    setResultData(null);
    setPortfolio([]);
    setResultSlide(0);
  };

  const summary = resultData?.summary;
  const chartSeries = useMemo(() => resultData?.chartSeries || [], [resultData?.chartSeries]);
  const annualReturns = resultData?.annualReturns || [];

  const yearTickSet = useMemo(() => {
    const seen = new Set();
    return chartSeries.reduce((acc, item) => {
      const fullYear = "20" + item.date.slice(0, 2);
      if (!seen.has(fullYear)) {
        seen.add(fullYear);
        if (seen.size > 1) {
          acc[item.date] = fullYear;
        }
      }
      return acc;
    }, {});
  }, [chartSeries]);

  const totalReturnVal = summary?.totalReturnRate ?? summary?.totalReturn ?? 0;
  const executedPeriodLabel = PERIOD_LABEL_MAP[executedConfig?.period || period] || "5년";

  return (
    <div style={{ maxWidth: "100vw", overflowX: "hidden" }} className="flex flex-col gap-0 bg-slate-50 pb-2">
      <div className="flex flex-col gap-3 px-3 pt-3 pb-1" style={{ maxWidth: "100%" }}>
        {/* 비로그인 안내 */}
        {!user && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-5 rounded-2xl text-sm text-center font-medium mt-2">
            로그인 후 포트폴리오 백테스트를 이용할 수 있습니다.
          </div>
        )}

        {user && (
          <>
            {/* ── 상단 헤더 & 백테스트/변동성 이동 바 ── */}
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm opacity-0 animate-feed-lift stagger-1">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl text-white shadow-xs shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600">
                  <Layers size={18} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-extrabold text-slate-800 tracking-tight leading-tight truncate">
                    포트폴리오 백테스트
                  </h1>
                  <span className="text-[11px] font-semibold text-slate-400 leading-[24px] block truncate">
                    맞춤 자산 배분 비중 기반 과거 수익률
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  type="button"
                  disabled
                  className="p-1 text-slate-200 cursor-not-allowed"
                  aria-label="현재 포트폴리오 백테스트 화면입니다"
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
                <span className="text-[14px] font-black text-slate-800 tracking-tight min-w-[46px] text-center select-none">
                  백테스트
                </span>
                <Link
                  href="/volatility"
                  className="p-1 text-slate-600 hover:text-slate-900 active:scale-90 transition-all cursor-pointer"
                  aria-label="변동성 분석으로 이동"
                  title="변동성 분석으로 이동"
                >
                  <ChevronRight size={18} strokeWidth={2.5} />
                </Link>
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════ */}
            {/* [1번 · 2번 화면] 포트폴리오 구성 및 실행 설정 화면        */}
            {/* ════════════════════════════════════════════════════════ */}
            {!resultData && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 space-y-3 opacity-0 animate-feed-lift stagger-2">
                {/* 카드 헤더 */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h2 className="text-[14.5px] font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                    <Sliders size={16} className="text-indigo-600" />
                    포트폴리오 구성
                  </h2>
                  <div className="flex items-center gap-1.5">
                    {portfolio.length >= 1 && (
                      <button
                        type="button"
                        onClick={handleEqualWeight}
                        className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 active:scale-95 transition-all cursor-pointer"
                      >
                        균등배분
                      </button>
                    )}
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-lg transition-all ${
                        portfolio.length > 0
                          ? "bg-indigo-50 text-indigo-600 border border-indigo-200 font-black"
                          : "bg-slate-100 text-slate-400 border border-slate-200/80"
                      }`}
                    >
                      총 {portfolio.length} 종목
                    </span>
                  </div>
                </div>

                {/* 종목 검색창 (웹 화면과 동일한 검색/드롭다운 UX) */}
                <div className="relative" ref={mobileSearchRef}>
                  <form onSubmit={handleTriggerSearch} className="relative flex items-center">
                    <input
                      ref={searchInputRef}
                      type="text"
                      enterKeyHint="search"
                      aria-label="종목명, 티커 또는 종목코드 검색"
                      value={searchQuery}
                      onChange={handleSearchInputChange}
                      onKeyDown={handleMobileSearchKeyDown}
                      onPaste={handleSearchPaste}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck="false"
                      className="mobile-compact-input w-full h-[36px] pl-3.5 pr-9 py-0 text-[13px] leading-normal bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold transition-all uppercase"
                    />
                    {!searchQuery && (
                      <span className="pointer-events-none absolute left-3.5 right-9 top-1/2 -translate-y-1/2 text-xs font-normal text-slate-400 truncate select-none">
                        + 종목명 / 티커 / 종목코드 입력 후 Enter...
                      </span>
                    )}
                    {isSearching ? (
                      <RefreshCw size={16} className="absolute right-3 text-slate-400 animate-spin" />
                    ) : (
                      <button
                        type="submit"
                        onMouseDown={(e) => e.preventDefault()}
                        className="absolute right-2.5 p-1 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                        aria-label="종목 검색"
                      >
                        <Search size={16} />
                      </button>
                    )}
                  </form>

                  {/* 검색 드롭다운 (웹과 동일한 2줄 구조 + 위에서 아래로 순차 등장) */}
                  {isSearchOpen && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 max-h-[216px] overflow-y-auto text-xs animate-fade-in">
                      {searchResults.map((item, idx) => {
                        const isSelected = selectedSearchIndex === idx;
                        const isDom =
                          item.currency === "KRW" ||
                          item.market === "KOSPI" ||
                          item.market === "KOSDAQ" ||
                          /^\d{6}/.test(item.code);
                        return (
                          <button
                            key={`${item.code}-${idx}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelectSearchItem(item)}
                            style={{ animationDelay: `${idx * 40}ms` }}
                            className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between transition-colors cursor-pointer opacity-0 animate-feed-lift ${
                              isSelected
                                ? "bg-indigo-50/90 text-indigo-950 font-bold border-l-3 border-indigo-600 pl-3"
                                : "hover:bg-slate-50 active:bg-indigo-50/60 text-slate-800"
                            }`}
                          >
                            <div className="min-w-0 pr-2 flex-1">
                              <div className="truncate text-xs font-bold leading-tight">
                                {item.name}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                                    isDom
                                      ? "bg-blue-50 text-blue-600 border border-blue-200/60"
                                      : "bg-amber-50 text-amber-700 border border-amber-200/60"
                                  }`}
                                >
                                  {isDom ? "국내" : "해외"}
                                </span>
                                <span
                                  className={`text-[10px] font-mono truncate ${
                                    isSelected ? "text-indigo-600" : "text-slate-400"
                                  }`}
                                >
                                  {item.code}{item.market ? ` · ${item.market}` : ""}
                                </span>
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center ml-2">
                              {isSelected ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-600 text-white font-black shadow-2xs flex items-center gap-1">
                                  선택됨 <span className="text-[9px] opacity-80">↵</span>
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-bold">
                                  추가
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 1번(빈 상태: 종목 1개 영역 82px + 간격 8px + 안내슬롯 30px = 120px) vs 2번(종목 추가됨) 리스트 영역 */}
                {portfolio.length === 0 ? (
                  <div className="h-[120px] border-2 border-dashed border-slate-200/90 rounded-2xl px-4 flex flex-col items-center justify-center text-center bg-slate-50/40">
                    <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mb-2 shadow-2xs">
                      <Plus size={18} strokeWidth={2.5} />
                    </div>
                    <p className="text-xs font-black text-slate-800 leading-tight">
                      추가된 종목이 없습니다
                    </p>
                    <p className="text-[11px] font-medium text-slate-400 mt-1 leading-tight">
                      상단 검색창에서 종목을 검색하여 추가하세요.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div
                      ref={portfolioListRef}
                      className={`space-y-2 h-[82px] ${
                        portfolio.length >= 2 ? "mobile-visible-scrollbar pr-1.5" : "overflow-y-hidden"
                      }`}
                    >
                      {portfolio.map((item, idx) => {
                        const isDom = item.currency === "KRW";
                        const isInsufficient = insufficientStocks.includes(item.symbol) || insufficientStocks.includes(item.code);
                        return (
                          <div
                            key={item.symbol || item.code || idx}
                            className={`min-h-[80px] flex flex-col justify-center rounded-xl border p-3 transition-colors animate-card-entrance ${
                              isInsufficient
                                ? "border-rose-300 bg-rose-50/40"
                                : "border-slate-200/80 bg-white shadow-2xs"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2.5">
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${
                                    isDom
                                      ? "bg-blue-50 text-blue-600 border-blue-200"
                                      : "bg-amber-50 text-amber-700 border-amber-300"
                                  }`}
                                >
                                  {isDom ? "국내" : "해외"}
                                </span>
                                <span className="text-xs font-extrabold text-slate-900 truncate">
                                  {item.name}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`text-[11px] font-extrabold font-mono ${
                                    isDom ? "text-blue-600" : "text-amber-500"
                                  }`}
                                >
                                  {item.code}
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={item.weight}
                                  onFocus={(e) => e.target.select?.()}
                                  onChange={(e) => updateWeight(idx, e.target.value)}
                                  className={`mobile-compact-input w-[38px] py-0.5 px-1 text-center text-[13px] font-black rounded-lg border-2 tabular-nums focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                    isDom
                                      ? "border-blue-400 text-slate-900 focus:border-blue-600"
                                      : "border-amber-400 text-slate-900 focus:border-amber-500"
                                  }`}
                                />
                                <span className="text-xs font-bold text-slate-500">%</span>
                                <button
                                  type="button"
                                  onClick={() => removeStock(idx)}
                                  className="p-1 text-slate-400 hover:text-rose-500 active:scale-90 transition-colors cursor-pointer"
                                  aria-label={`${item.name} 삭제`}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            <div className="py-1.5 -my-1.5 flex items-center touch-none">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={Number(item.weight) || 0}
                                onTouchMove={(e) => e.stopPropagation()}
                                onChange={(e) => updateWeight(idx, e.target.value)}
                                className={`w-full h-2 rounded-lg cursor-pointer touch-none ${
                                  isDom ? "accent-blue-500" : "accent-amber-500"
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 비중 합계 100% 안내 고정 슬롯 (종목 추가 상태 전용) */}
                    <div className="h-[30px] flex items-center">
                      {totalWeight !== 100 && (
                        <div className="w-full h-full flex items-center justify-between text-[11px] font-bold px-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 animate-fade-in">
                          <span>비중 합계 100%가 필요합니다.</span>
                          <span className="tabular-nums">현재 {totalWeight}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 초기 투자금액 / 월 적립금액 */}
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      초기 투자금액
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={
                          initialAmount !== "" && initialAmount !== undefined
                            ? Number(initialAmount).toLocaleString("ko-KR")
                            : ""
                        }
                        onFocus={(e) => e.target.select?.()}
                        onClick={(e) => e.target.select?.()}
                        onChange={(e) => {
                          const clean = e.target.value.replace(/[^0-9]/g, "");
                          setInitialAmount(clean === "" ? "" : Number(clean));
                        }}
                        placeholder="0"
                        className="w-full pl-3 pr-7 py-2 text-sm font-black bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 text-right tabular-nums"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">
                        원
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      월 적립금액
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={
                          monthlyContribution !== "" && monthlyContribution !== undefined
                            ? Number(monthlyContribution).toLocaleString("ko-KR")
                            : ""
                        }
                        onFocus={(e) => e.target.select?.()}
                        onClick={(e) => e.target.select?.()}
                        onChange={(e) => {
                          const clean = e.target.value.replace(/[^0-9]/g, "");
                          setMonthlyContribution(clean === "" ? "" : Number(clean));
                        }}
                        placeholder="0"
                        className="w-full pl-3 pr-7 py-2 text-sm font-black bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 text-right tabular-nums"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">
                        원
                      </span>
                    </div>
                  </div>
                </div>

                {/* 분석 기간 */}
                <div className="!mt-2.5">
                  <span className="block text-[11px] font-bold text-slate-500 mb-1.5">
                    분석 기간
                  </span>
                  <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100 rounded-xl">
                    {PERIOD_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPeriod(opt.id)}
                        className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          period === opt.id
                            ? "bg-indigo-600 text-white font-black shadow-xs"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 리밸런싱 주기 */}
                <div className="relative !mt-2.5" ref={mobileRebalRef}>
                  <span className="block text-[11px] font-bold text-slate-500 mb-1.5">
                    리밸런싱 주기
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsRebalOpen((prev) => !prev)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-extrabold text-slate-800">
                        {currentRebalancingOption.label}
                      </span>
                      <span className="text-slate-400 font-medium">
                        ({currentRebalancingOption.eng})
                      </span>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition-transform ${
                        isRebalOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isRebalOpen && (
                    <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-40 overflow-hidden divide-y divide-slate-50 animate-tooltip-in">
                      {REBALANCING_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setRebalancing(opt.id);
                            setIsRebalOpen(false);
                          }}
                          className={`w-full px-3.5 py-2.5 flex items-center justify-between text-xs cursor-pointer ${
                            rebalancing === opt.id
                              ? "bg-indigo-50 text-indigo-700 font-black"
                              : "text-slate-700 hover:bg-slate-50 font-semibold"
                          }`}
                        >
                          <span>
                            {opt.label}{" "}
                            <span className="text-slate-400 font-normal">({opt.eng})</span>
                          </span>
                          {rebalancing === opt.id && <Check size={14} className="text-indigo-600" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 벤치마크 비교 선택 */}
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-xs font-bold text-slate-500">벤치마크</span>
                  <div className="flex items-center gap-3.5">
                    {[
                      { id: "SPY", label: "S&P 500 (SPY)" },
                      { id: "QQQ", label: "나스닥 100 (QQQ)" }
                    ].map((bm) => {
                      const checked = benchmarks.includes(bm.id);
                      return (
                        <button
                          key={bm.id}
                          type="button"
                          onClick={() => toggleBenchmark(bm.id)}
                          className="flex items-center gap-1.5 cursor-pointer select-none"
                        >
                          <span
                            className={`w-4 h-4 rounded-sm flex items-center justify-center border transition-colors ${
                              checked
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "bg-white border-slate-300 text-transparent"
                            }`}
                          >
                            <Check size={12} strokeWidth={3} />
                          </span>
                          <span className="text-xs font-bold text-slate-800">{bm.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 실행하기 CTA 버튼 */}
                <button
                  type="button"
                  onClick={handleRunBacktest}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>백테스트 분석 중...</span>
                    </>
                  ) : (
                    <span>🚀 백테스트 실행하기</span>
                  )}
                </button>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════ */}
            {/* [3 · 4 · 5번 화면] 백테스트 결과 슬라이드 카드            */}
            {/* ════════════════════════════════════════════════════════ */}
            {resultData && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 space-y-3 opacity-0 animate-feed-lift stagger-1">
                {/* ── 추천 상단 조회 종목 요약 바 + 취소(1번 복귀) 버튼 ── */}
                <div className="pb-2.5 border-b border-slate-100 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-extrabold text-slate-500">
                        조회 포트폴리오
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200/80">
                        {executedPeriodLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={handleEditPortfolio}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[11px] font-bold border border-indigo-200 shadow-2xs active:scale-95 transition-all cursor-pointer"
                      >
                        <Sliders size={11} strokeWidth={2.5} />
                        <span>수정</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelResult}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold border border-rose-200 shadow-2xs active:scale-95 transition-all cursor-pointer"
                      >
                        <X size={12} strokeWidth={2.5} />
                        <span>취소</span>
                      </button>
                    </div>
                  </div>

                  {/* 조회된 종목 1줄씩 세로 목록 (3칸 고정 실선 박스, 위에서부터 순서대로, 3개 초과 시 우측 스크롤) */}
                  <div className="border border-slate-200/90 rounded-xl p-1.5 bg-slate-50/30">
                    <div
                      className={`h-[92px] space-y-1 ${
                        portfolio.length > 3 ? "mobile-visible-scrollbar pr-1.5" : "overflow-y-hidden"
                      }`}
                    >
                      {portfolio.map((item, idx) => {
                        const isDom = item.currency === "KRW";
                        return (
                          <div
                            key={`chip-${item.symbol}-${idx}`}
                            className={`h-[28px] px-2.5 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between gap-2 shadow-2xs opacity-0 animate-feed-lift stagger-${Math.min(idx + 1, 6)}`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isDom ? "bg-blue-500" : "bg-amber-500"
                                }`}
                              />
                              <span className="text-[11px] font-bold text-slate-800 truncate">
                                {item.name || item.code}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {item.code && (
                                <span
                                  className={`font-mono text-[10.5px] font-extrabold ${
                                    isDom ? "text-blue-600" : "text-amber-500"
                                  }`}
                                >
                                  {item.code}
                                </span>
                              )}
                              <span className="text-[11px] font-black text-indigo-600 tabular-nums w-8 text-right">
                                {item.weight}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3 / 4 / 5 화면 탭 인디케이터 */}
                  <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 rounded-xl">
                    {[
                      { idx: 0, label: "요약 지표" },
                      { idx: 1, label: "성장 추이" },
                      { idx: 2, label: "연도별 수익률" }
                    ].map((tab) => (
                      <button
                        key={tab.idx}
                        type="button"
                        onClick={() => setResultSlide(tab.idx)}
                        className={`py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          resultSlide === tab.idx
                            ? "bg-indigo-600 text-white font-black shadow-xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── 탭별 결과 본문 (3번 / 4번 / 5번 화면) ── */}
                <div className="min-h-[345px]">
                  {/* [3번 화면] 2×2 핵심 성과 지표 KPI 카드 */}
                  {resultSlide === 0 && (
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* ① 최종 자산 (누적수익률) */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs flex flex-col justify-between min-h-[175px] opacity-0 animate-feed-lift stagger-1">
                        <div>
                          <span className="text-[11px] font-bold text-slate-600 tracking-tight block mb-2">
                            ① 최종 자산 (누적수익률)
                          </span>
                          <div className="text-right">
                            <div className="text-[17px] font-black text-slate-900 tracking-tight leading-tight tabular-nums">
                              <MobileRollingNumber
                                value={summary?.finalValue ?? summary?.finalBalance}
                                formatFn={formatExactWon}
                              />
                            </div>
                            <div
                              className={`text-xs font-extrabold tracking-tight tabular-nums mt-0.5 ${
                                totalReturnVal >= 0 ? "text-rose-500" : "text-blue-500"
                              }`}
                            >
                              (
                              <MobileRollingNumber
                                value={totalReturnVal}
                                decimals={1}
                                showSign={true}
                                suffix="%"
                              />
                              )
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-100 text-[10.5px] text-slate-500 font-medium space-y-0.5 tabular-nums">
                          <div className="truncate">
                            원금 :{" "}
                            <strong className="text-slate-600 font-bold">
                              <MobileRollingNumber
                                value={summary?.investedCapital}
                                formatFn={(v) => `${formatCleanWon(v)}원`}
                              />
                            </strong>
                          </div>
                          <div className="truncate">
                            국내:{" "}
                            <strong className="text-slate-800 font-bold">
                              <MobileRollingNumber
                                value={summary?.domesticWon ?? 0}
                                formatFn={formatExactWon}
                              />
                            </strong>
                          </div>
                          <div className="truncate">
                            해외:{" "}
                            <strong className="text-slate-800 font-bold">
                              <MobileRollingNumber
                                value={summary?.foreignWon ?? 0}
                                formatFn={formatExactWon}
                              />
                            </strong>{" "}
                            <span className="text-slate-400">
                              (
                              <MobileRollingNumber
                                value={summary?.foreignUsd ?? 0}
                                formatFn={(v) => `$${Math.round(v).toLocaleString()}`}
                              />
                              )
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ② 최대 낙폭 (MDD) */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs flex flex-col justify-between min-h-[175px] opacity-0 animate-feed-lift stagger-2">
                        <div>
                          <span className="text-[11px] font-bold text-slate-600 tracking-tight block mb-3">
                            ② 최대 낙폭 (MDD)
                          </span>
                          <div className="text-right text-xl font-black text-blue-600 tracking-tight tabular-nums">
                            <MobileRollingNumber
                              value={summary?.maxDrawdown}
                              decimals={1}
                              suffix="%"
                              emptyText="-"
                            />
                          </div>
                        </div>

                        <div className="mt-2 pt-2.5 border-t border-slate-100 space-y-1 text-[11px] tabular-nums">
                          <div className="flex items-center justify-between">
                            <span className={benchmarks.includes("SPY") ? "font-bold text-slate-700" : "text-slate-400"}>
                              S&amp;P500
                            </span>
                            <span className={benchmarks.includes("SPY") && summary?.spyDrawdown != null ? "font-extrabold text-blue-600" : "text-slate-300"}>
                              {benchmarks.includes("SPY") && summary?.spyDrawdown != null ? (
                                <MobileRollingNumber
                                  value={summary.spyDrawdown}
                                  decimals={1}
                                  suffix="%"
                                />
                              ) : (
                                "-"
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={benchmarks.includes("QQQ") ? "font-bold text-slate-700" : "text-slate-400"}>
                              나스닥 100
                            </span>
                            <span className={benchmarks.includes("QQQ") && summary?.qqqDrawdown != null ? "font-extrabold text-blue-600" : "text-slate-300"}>
                              {benchmarks.includes("QQQ") && summary?.qqqDrawdown != null ? (
                                <MobileRollingNumber
                                  value={summary.qqqDrawdown}
                                  decimals={1}
                                  suffix="%"
                                />
                              ) : (
                                "-"
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ③ 샤프 지수 (Sharpe) */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs flex flex-col justify-between min-h-[156px] opacity-0 animate-feed-lift stagger-3">
                        <div>
                          <span className="text-[11px] font-bold text-slate-600 tracking-tight block mb-3">
                            ③ 샤프 지수 (Sharpe)
                          </span>
                          <div className="text-right text-xl font-black text-slate-900 tracking-tight tabular-nums">
                            <MobileRollingNumber
                              value={summary?.sharpeRatio}
                              decimals={2}
                              emptyText="-"
                            />
                          </div>
                        </div>

                        <div className="mt-2 pt-2.5 border-t border-slate-100 flex justify-center">
                          <span className="font-bold text-emerald-600 bg-emerald-50/80 px-2.5 py-1 rounded-lg text-[10.5px] border border-emerald-200/70 text-center w-full truncate">
                            {summary?.sharpeRatio >= 1.5
                              ? "매우 우수 (Very Good)"
                              : summary?.sharpeRatio >= 1.0
                                ? "우수 (Good)"
                                : "보통 (Moderate)"}
                          </span>
                        </div>
                      </div>

                      {/* ④ 벤치마크 상관계수 (r) */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs flex flex-col justify-between min-h-[156px] opacity-0 animate-feed-lift stagger-4">
                        <div>
                          <span className="text-[11px] font-bold text-slate-600 tracking-tight block mb-2.5">
                            ④ 벤치마크 상관계수 (r)
                          </span>
                          <div className="space-y-1.5 text-xs tabular-nums">
                            <div className="flex items-center justify-between">
                              <span className={benchmarks.includes("SPY") ? "font-bold text-purple-950" : "text-slate-400"}>
                                S&amp;P500
                              </span>
                              <span className={`text-sm font-black ${benchmarks.includes("SPY") && summary?.rSpy != null ? "text-purple-700" : "text-slate-300"}`}>
                                {benchmarks.includes("SPY") && summary?.rSpy != null ? (
                                  <MobileRollingNumber
                                    value={summary.rSpy}
                                    decimals={2}
                                  />
                                ) : (
                                  "-"
                                )}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className={benchmarks.includes("QQQ") ? "font-bold text-purple-950" : "text-slate-400"}>
                                나스닥 100
                              </span>
                              <span className={`text-sm font-black ${benchmarks.includes("QQQ") && summary?.rQqq != null ? "text-purple-700" : "text-slate-300"}`}>
                                {benchmarks.includes("QQQ") && summary?.rQqq != null ? (
                                  <MobileRollingNumber
                                    value={summary.rQqq}
                                    decimals={2}
                                  />
                                ) : (
                                  "-"
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 pt-2.5 border-t border-slate-100 flex justify-center">
                          <span className="font-bold text-purple-700 bg-purple-50/80 px-2.5 py-1 rounded-lg text-[10.5px] border border-purple-200/70 text-center w-full truncate">
                            {(summary?.rSpy ?? 1) >= 0.8
                              ? "지수 밀착형"
                              : (summary?.rSpy ?? 1) >= 0.5
                                ? "지수 추종형"
                                : (summary?.rSpy ?? 1) > 0
                                  ? "우수한 리스크 분산"
                                  : "지수 반대 성향"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* [4번 화면] 자산 성장 추이 & 낙폭(MDD) 차트 */}
                  {resultSlide === 1 && (
                    <div className="space-y-2 animate-page-slide">
                      <div>
                        <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                          <TrendingUp size={16} className="text-emerald-600" />
                          자산 성장 추이
                        </h3>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                          (초기 {(executedConfig?.initialAmount ?? 10000000).toLocaleString()}원 + 월 {(executedConfig?.monthlyContribution ?? 500000).toLocaleString()}원 적립)
                        </p>

                        <div className="flex items-center gap-2.5 text-[11px] font-bold text-slate-600 flex-wrap mt-2">
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-1.5 bg-emerald-500 rounded-full" /> 내 포트폴리오
                          </span>
                          {benchmarks.includes("SPY") && (
                            <span className="flex items-center gap-1">
                              <span className="w-2.5 h-1.5 bg-red-500 rounded-full" /> S&amp;P 500
                            </span>
                          )}
                          {benchmarks.includes("QQQ") && (
                            <span className="flex items-center gap-1">
                              <span className="w-2.5 h-1.5 bg-yellow-500 rounded-full" /> 나스닥 100
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-1 bg-slate-300 rounded-full" /> 총 투입원금
                          </span>
                        </div>
                      </div>

                      <div className="h-[180px] w-full">
                        {isMounted && chartSeries.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartSeries} margin={{ top: 8, right: 6, left: -12, bottom: 0 }}>
                              <defs>
                                <linearGradient id="mColorPort" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.22} />
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                              <XAxis
                                dataKey="date"
                                tick={<MobileYearOnlyTick yearTickSet={yearTickSet} />}
                                interval={0}
                                axisLine={{ stroke: "#e2e8f0" }}
                                tickLine={false}
                                height={22}
                              />
                              <YAxis
                                tick={{ fontSize: 10, fill: "#94a3b8" }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(v) => formatWon(v).replace("₩", "")}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload || !payload.length) return null;
                                  const p = payload[0].payload;
                                  return (
                                    <div className="bg-white/95 backdrop-blur-md p-2.5 rounded-xl border border-slate-200 shadow-xl text-[11px] space-y-1">
                                      <p className="font-bold text-slate-700 border-b border-slate-100 pb-1">
                                        {p.fullDate}
                                      </p>
                                      <p className="text-emerald-600 font-black">
                                        내 포트폴리오: {Math.round(p.portfolio).toLocaleString()}원
                                      </p>
                                      {benchmarks.includes("SPY") && (
                                        <p className="text-red-600 font-bold">
                                          S&amp;P 500: {Math.round(p.spy).toLocaleString()}원
                                        </p>
                                      )}
                                      {benchmarks.includes("QQQ") && (
                                        <p className="text-yellow-600 font-bold">
                                          나스닥 100: {Math.round(p.qqq).toLocaleString()}원
                                        </p>
                                      )}
                                      <p className="text-slate-400 font-semibold border-t border-slate-100 pt-1">
                                        원금: {Math.round(p.invested).toLocaleString()}원 (낙폭: {p.drawdown}%)
                                      </p>
                                    </div>
                                  );
                                }}
                              />
                              <Line type="stepAfter" dataKey="invested" stroke="#cbd5e1" strokeWidth={1.5} dot={false} animationDuration={850} animationEasing="ease-out" />
                              {benchmarks.includes("SPY") && (
                                <Line type="monotone" dataKey="spy" stroke="#ef4444" strokeWidth={1.8} dot={false} animationDuration={850} animationEasing="ease-out" />
                              )}
                              {benchmarks.includes("QQQ") && (
                                <Line type="monotone" dataKey="qqq" stroke="#eab308" strokeWidth={1.8} dot={false} animationDuration={850} animationEasing="ease-out" />
                              )}
                              <Area type="monotone" dataKey="portfolio" stroke="#10b981" strokeWidth={2.2} fillOpacity={1} fill="url(#mColorPort)" animationDuration={850} animationEasing="ease-out" />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                            표시할 차트 데이터가 없습니다.
                          </div>
                        )}
                      </div>

                      {/* 낙폭 차트 (Drawdown MDD %) */}
                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1 shrink-0">
                            <TrendingDown size={13} className="text-rose-500" />
                            낙폭 차트 (Drawdown MDD %)
                          </span>
                          <span className="text-[9.5px] text-slate-400 truncate">
                            역사적 고점 대비 하락 깊이 및 회복 궤적
                          </span>
                        </div>
                        <div className="h-[52px] w-full">
                          {isMounted && chartSeries.length > 0 && (
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartSeries} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                                <XAxis dataKey="date" hide />
                                <YAxis
                                  domain={["dataMin", 0]}
                                  tick={{ fontSize: 9, fill: "#94a3b8" }}
                                  tickFormatter={(v) => `${v}%`}
                                  axisLine={false}
                                  tickLine={false}
                                />
                                <Tooltip
                                  formatter={(val) => [`${val}%`, "낙폭"]}
                                  labelFormatter={(lbl) => `일자: ${lbl}`}
                                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                                />
                                <Area type="monotone" dataKey="drawdown" stroke="#f43f5e" strokeWidth={1.2} fill="#ffe4e6" fillOpacity={0.65} dot={false} animationDuration={750} animationEasing="ease-out" />
                              </AreaChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* [5번 화면] 연도별 수익률 비교 (Annual Returns) */}
                  {resultSlide === 2 && (
                    <div className="space-y-3 animate-page-slide">
                      <div>
                        <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                          <BarChart2 size={16} className="text-indigo-600" />
                          연도별 수익률 비교 (Annual Returns)
                        </h3>
                        <div className="flex items-center gap-3 text-xs font-bold mt-2">
                          <span className="flex items-center gap-1.5 text-emerald-600">
                            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> 포트폴리오
                          </span>
                          {benchmarks.includes("SPY") && (
                            <span className="flex items-center gap-1.5 text-red-600">
                              <span className="w-2.5 h-2.5 rounded-xs bg-red-500" /> S&amp;P 500
                            </span>
                          )}
                          {benchmarks.includes("QQQ") && (
                            <span className="flex items-center gap-1.5 text-yellow-600">
                              <span className="w-2.5 h-2.5 rounded-xs bg-yellow-500" /> 나스닥 100
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="h-[285px] w-full">
                        {isMounted && annualReturns.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              key={`m-annual-${annualReturns.map((r) => r.year).join("-")}`}
                              data={annualReturns}
                              margin={{ top: 10, right: 8, left: -14, bottom: 0 }}
                              maxBarSize={28}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                              <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                              <Tooltip
                                cursor={{ fill: "#f1f5f9", radius: 4 }}
                                content={({ active, payload }) => {
                                  if (!active || !payload || !payload.length) return null;
                                  const d = payload[0].payload;
                                  return (
                                    <div className="bg-white/95 backdrop-blur-md p-2.5 rounded-xl border border-slate-200 shadow-xl text-xs space-y-1">
                                      <p className="font-bold text-slate-700">{d.year}년 연간 수익률</p>
                                      <p className="text-emerald-600 font-bold">
                                        내 포트폴리오: {d.portfolio > 0 ? `+${d.portfolio}%` : `${d.portfolio}%`}
                                      </p>
                                      {benchmarks.includes("SPY") && (
                                        <p className="text-red-600 font-medium">
                                          S&amp;P 500: {d.spy > 0 ? `+${d.spy}%` : `${d.spy}%`}
                                        </p>
                                      )}
                                      {benchmarks.includes("QQQ") && (
                                        <p className="text-yellow-600 font-medium">
                                          나스닥 100: {d.qqq > 0 ? `+${d.qqq}%` : `${d.qqq}%`}
                                        </p>
                                      )}
                                    </div>
                                  );
                                }}
                              />
                              <Bar dataKey="portfolio" fill="#10b981" radius={[3, 3, 0, 0]} animationBegin={0} animationDuration={600} animationEasing="ease-out" />
                              {benchmarks.includes("SPY") && (
                                <Bar dataKey="spy" fill="#ef4444" radius={[3, 3, 0, 0]} animationBegin={90} animationDuration={600} animationEasing="ease-out" />
                              )}
                              {benchmarks.includes("QQQ") && (
                                <Bar dataKey="qqq" fill="#eab308" radius={[3, 3, 0, 0]} animationBegin={180} animationDuration={600} animationEasing="ease-out" />
                              )}
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                            연도별 데이터가 없습니다.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
