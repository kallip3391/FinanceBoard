"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useAnimatedDataModal } from "@/hooks/useAnimatedModal";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Activity,
  Sparkles,
  BarChart2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
  X
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

// ── 모바일 KPI 카드 숫자 롤링 카운터 (직접 DOM 렌더링 + easeOutQuart) ──
function MobileRollingNumber({
  value,
  duration = 650,
  decimals = 1,
  prefix = "",
  suffix = "",
  showSign = false,
  formatFn,
  emptyText = "-"
}) {
  const spanRef = useRef(null);
  const prevValueRef = useRef(null);
  const isFirstMountRef = useRef(true);
  const formatRef = useRef(null);

  const format = useCallback(
    (num) => {
      if (num == null || isNaN(num)) return emptyText;
      if (formatFn) return formatFn(num);
      const sign = showSign && num > 0 ? "+" : "";
      return `${prefix}${sign}${Number(num).toFixed(decimals)}${suffix}`;
    },
    [formatFn, decimals, prefix, suffix, showSign, emptyText]
  );

  useEffect(() => {
    formatRef.current = format;
  }, [format]);

  useEffect(() => {
    const fmt = formatRef.current || format;
    if (value == null || isNaN(Number(value))) {
      if (spanRef.current) spanRef.current.textContent = emptyText;
      prevValueRef.current = null;
      return;
    }

    const endVal = Number(value);

    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      if (spanRef.current) spanRef.current.textContent = fmt(endVal);
      prevValueRef.current = endVal;
      return;
    }

    const startVal = prevValueRef.current != null ? prevValueRef.current : endVal;
    if (startVal === endVal) {
      if (spanRef.current) spanRef.current.textContent = fmt(endVal);
      return;
    }

    let startTime = null;
    let animationFrame;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      const current = startVal + (endVal - startVal) * easeProgress;
      const activeFmt = formatRef.current || format;

      if (spanRef.current) {
        spanRef.current.textContent = activeFmt(current);
      }

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      } else {
        if (spanRef.current) spanRef.current.textContent = activeFmt(endVal);
        prevValueRef.current = endVal;
      }
    };

    animationFrame = requestAnimationFrame(step);
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const initialNum = value != null && !isNaN(Number(value)) ? Number(value) : null;
  return <span ref={spanRef}>{format(initialNum)}</span>;
}

function MobileVolatilityXAxisTick({ x, y, payload, loadedPeriod }) {
  const val = payload?.value;
  if (!val) return null;
  const label =
    loadedPeriod === "1m" || loadedPeriod === "3m"
      ? `${val.slice(5, 7)}.${val.slice(8, 10)}`
      : `${val.slice(2, 4)}.${val.slice(5, 7)}`;

  return (
    <text x={x} y={y + 11} textAnchor="middle" fill="#94a3b8" fontSize={10} fontWeight={600}>
      {label}
    </text>
  );
}

function MobileVolatilityYAxisTick({ x, y, payload, isKr }) {
  const v = payload?.value;
  if (v == null || isNaN(v)) return null;
  let label;
  if (isKr) {
    label =
      Math.abs(v) >= 10000
        ? `${Number((v / 10000).toFixed(1)).toLocaleString("ko-KR")}만원`
        : `${Math.round(v).toLocaleString("ko-KR")}원`;
  } else {
    label = `$${Number(v).toLocaleString("en-US")}`;
  }

  return (
    <text x={x - 3} y={y + 3} textAnchor="end" fill="#94a3b8" fontSize={9.5} fontWeight={600}>
      {label}
    </text>
  );
}

export default function MobileVolatilityDashboard({
  user,
  selectedStock,
  setSelectedStock,
  setRawHistoryData,
  setErrorMsg,
  period,
  setPeriod,
  periodOptions = [],
  searchQuery,
  searchResults = [],
  isSearching,
  isSearchOpen,
  setIsSearchOpen,
  selectedSearchIndex = 0,
  setSelectedSearchIndex,
  handleSearchInputChange,
  handleSearchKeyDown,
  handleSearchPaste,
  executeSearch,
  selectStockFromSearch,
  comparisonList = [],
  isLoading,
  errorMsg,
  stats,
  bellCurveTicks = [],
  xTicks = [],
  currency,
  formatPrice,
  staticBellCurveSvg,
  isMounted
}) {
  // 0: 요약 지표, 1: 주가 · 밴드, 2: 정규분포
  const [activeSlide, setActiveSlide] = useState(0);
  const [tappedBarIdx, setTappedBarIdx] = useState(null);
  const [tappedSigmaIdx, setTappedSigmaIdx] = useState(null);
  const [searchRevealKey, setSearchRevealKey] = useState(0);

  const mobileSearchContainerRef = useRef(null);
  const mobileSearchInputRef = useRef(null);
  const sigmaGridRef = useRef(null);
  const bellChartBoxRef = useRef(null);

  const tappedBarData = useMemo(() => {
    if (tappedBarIdx === null || !stats?.histogramBars?.[tappedBarIdx]) return null;
    return { idx: tappedBarIdx, bar: stats.histogramBars[tappedBarIdx] };
  }, [tappedBarIdx, stats]);

  const tappedSigmaData = useMemo(() => {
    if (tappedSigmaIdx === null || !bellCurveTicks?.[tappedSigmaIdx]) return null;
    return { idx: tappedSigmaIdx, tick: bellCurveTicks[tappedSigmaIdx] };
  }, [tappedSigmaIdx, bellCurveTicks]);

  const { data: activeBarPopup, isOpen: isBarPopupOpen, isClosing: isBarPopupClosing } =
    useAnimatedDataModal(tappedBarData, 200);
  const { data: activeSigmaPopup, isOpen: isSigmaPopupOpen, isClosing: isSigmaPopupClosing } =
    useAnimatedDataModal(tappedSigmaData, 200);

  // 외부 터치/클릭 시 모바일 검색 드롭다운, 차트 막대 툴팁 및 표준편차 팝업 닫기
  useEffect(() => {
    const handleOutside = (event) => {
      if (
        mobileSearchContainerRef.current &&
        mobileSearchContainerRef.current.offsetParent !== null &&
        !mobileSearchContainerRef.current.contains(event.target)
      ) {
        setIsSearchOpen(false);
        setSelectedSearchIndex?.(0);
      }
      if (bellChartBoxRef.current && !bellChartBoxRef.current.contains(event.target)) {
        setTappedBarIdx(null);
      }
      if (sigmaGridRef.current && !sigmaGridRef.current.contains(event.target)) {
        setTappedSigmaIdx(null);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [setIsSearchOpen, setSelectedSearchIndex]);

  const handleSelectFromDropdown = (item) => {
    selectStockFromSearch(item);
    setActiveSlide(0);
    setTappedBarIdx(null);
    setTappedSigmaIdx(null);
    mobileSearchInputRef.current?.blur?.();
  };

  const handleSelectHoldingChip = (item) => {
    setSelectedStock({
      symbol: item.symbol,
      name: item.name,
      market: item.market || (item.isKRW ? "KOSPI" : "US"),
      isKRW: Boolean(item.isKRW),
      fromSearch: false
    });
    setActiveSlide(0);
    setTappedBarIdx(null);
    setTappedSigmaIdx(null);
    setIsSearchOpen(false);
  };

  const handleClearSelectedStock = () => {
    setSelectedStock(null);
    setRawHistoryData?.([]);
    setErrorMsg?.("");
    setActiveSlide(0);
    setTappedBarIdx(null);
    setTappedSigmaIdx(null);
    setSearchRevealKey((prev) => prev + 1);
  };

  const handleTriggerSearch = async (e) => {
    if (e) e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    if (isSearchOpen && searchResults.length > 0) {
      handleSelectFromDropdown(searchResults[selectedSearchIndex] || searchResults[0]);
      return;
    }
    const list = await executeSearch(trimmed);
    if (list && list.length > 0) {
      setSelectedSearchIndex?.(0);
      setIsSearchOpen(true);
    }
  };

  const handleMobileSearchKeyDown = (e) => {
    if (
      e.key === "Enter" &&
      !e.nativeEvent?.isComposing &&
      isSearchOpen &&
      searchResults.length > 0
    ) {
      e.preventDefault();
      e.stopPropagation();
      handleSelectFromDropdown(searchResults[selectedSearchIndex] || searchResults[0]);
      return;
    }
    handleSearchKeyDown(e);
  };

  const handlePeriodChange = (nextPeriod) => {
    setPeriod(nextPeriod);
    setTappedBarIdx(null);
    setTappedSigmaIdx(null);
  };

  const handleSlideChange = (idx) => {
    setActiveSlide(idx);
    setTappedBarIdx(null);
    setTappedSigmaIdx(null);
  };

  const cleanCode = selectedStock ? selectedStock.symbol.replace(/\.(KS|KQ)$/, "") : "";
  const parenMatch = selectedStock ? selectedStock.name.match(/^[^\s(]+\s*\((.+)\)$/) : null;
  const displayName = selectedStock ? (parenMatch ? parenMatch[1] : selectedStock.name) : "";
  const currentPeriodLabel = periodOptions.find((p) => p.id === period)?.label || "1년";
  const isKrChart = currency === "KRW" || Boolean(selectedStock?.isKRW);

  const formatCompactTickPrice = (val) => {
    if (val == null || isNaN(val)) return "-";
    if (isKrChart) {
      return Math.abs(val) >= 10000
        ? `${Number((val / 10000).toFixed(1)).toLocaleString("ko-KR")}만`
        : `${Math.round(val).toLocaleString("ko-KR")}`;
    }
    return Math.abs(val) >= 1000
      ? `$${Math.round(val).toLocaleString("en-US")}`
      : `$${Number(val).toFixed(1)}`;
  };

  return (
    <div style={{ maxWidth: "100vw", overflowX: "hidden" }} className="flex flex-col gap-0 bg-slate-50 pb-2">
      <div className="flex flex-col gap-3 px-3 pt-3 pb-1" style={{ maxWidth: "100%" }}>
        {/* ── 상단 헤더 카드 & 백테스트/표준편차 이동 바 ── */}
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm opacity-0 animate-feed-lift stagger-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl text-white shadow-xs shrink-0 bg-gradient-to-br from-rose-500 to-red-600">
              <TrendingUp size={18} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-extrabold text-slate-800 tracking-tight leading-tight truncate">
                종목 변동성 &amp; 표준편차 분석
              </h1>
              <span className="text-[11px] font-semibold text-slate-400 leading-[24px] block truncate">
                변동성 지표 및 정규분포 분석
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            <Link
              href="/backtest"
              className="p-1 text-slate-600 hover:text-slate-900 active:scale-90 transition-all cursor-pointer"
              aria-label="백테스트로 이동"
              title="백테스트로 이동"
            >
              <ChevronLeft size={18} strokeWidth={2.5} />
            </Link>
            <span className="text-[14px] font-black text-slate-800 tracking-tight min-w-[46px] text-center select-none">
              표준편차
            </span>
            <button
              type="button"
              disabled
              className="p-1 text-slate-200 cursor-not-allowed"
              aria-label="현재 종목 변동성 분석 화면입니다"
            >
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* 비로그인 안내 */}
        {!user && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-5 rounded-2xl text-sm text-center font-medium mt-1">
            로그인 후 확인할 수 있습니다.
          </div>
        )}

        {/* ── 메인 통합 카드 ── */}
        {user && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 space-y-3 opacity-0 animate-feed-lift stagger-2">
            {/* 섹션 타이틀 */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-[14.5px] font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <Activity size={16} className="text-slate-700 shrink-0" />
                포트폴리오 보유 종목 변동성 비교
              </h2>
            </div>

            {/* 조회 전: 종목 검색창 / 조회 후: 선택된 종목 바 */}
            {!selectedStock ? (
              <div
                key={`search-bar-${searchRevealKey}`}
                className={`relative z-30 ${searchRevealKey > 0 ? "animate-header-switch" : ""}`}
                style={searchRevealKey > 0 ? { animationDuration: "0.42s" } : undefined}
                ref={mobileSearchContainerRef}
              >
                <form onSubmit={handleTriggerSearch} className="relative flex items-center">
                  <input
                    ref={mobileSearchInputRef}
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
                    className="mobile-compact-input w-full h-[38px] pl-3.5 pr-9 py-0 text-[13px] leading-normal bg-slate-50 border border-slate-200/90 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 focus:bg-white font-semibold transition-all uppercase"
                  />
                  {!searchQuery && (
                    <span className="pointer-events-none absolute left-3.5 right-9 top-1/2 -translate-y-1/2 text-xs font-normal text-slate-400 truncate select-none">
                      + 종목명 / 티커 / 종목코드 입력 후 Enter...
                    </span>
                  )}
                  {isSearching ? (
                    <RefreshCw size={15} className="absolute right-3 text-rose-500 animate-spin" />
                  ) : (
                    <button
                      type="submit"
                      onMouseDown={(e) => e.preventDefault()}
                      className="absolute right-2.5 p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      aria-label="종목 검색"
                    >
                      <Search size={15} />
                    </button>
                  )}
                </form>

                {/* 검색 드롭다운 (위에서 아래로 순차 등장) */}
                {isSearchOpen && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 max-h-[216px] overflow-y-auto text-xs animate-fade-in">
                    {searchResults.map((item, idx) => {
                      const isSelected = selectedSearchIndex === idx;
                      const isItemDomestic =
                        item.currency === "KRW" ||
                        /^\d{6}/.test(item.code) ||
                        item.market === "KOSPI" ||
                        item.market === "KOSDAQ";
                      return (
                        <button
                          key={`${item.code}-${idx}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelectFromDropdown(item)}
                          style={{ animationDelay: `${idx * 45}ms`, animationDuration: "0.26s" }}
                          className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between transition-colors cursor-pointer opacity-0 animate-feed-lift ${
                            isSelected
                              ? "bg-rose-50/90 text-rose-950 font-bold border-l-3 border-rose-600 pl-3"
                              : "hover:bg-slate-50 active:bg-rose-50/60 text-slate-800"
                          }`}
                        >
                          <div className="min-w-0 pr-2 flex-1">
                            <div className="truncate text-xs font-bold leading-tight">{item.name}</div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                                  isItemDomestic
                                    ? "bg-blue-50 text-blue-600 border border-blue-200/60"
                                    : "bg-amber-50 text-amber-700 border border-amber-200/60"
                                }`}
                              >
                                {isItemDomestic ? "국내" : "해외"}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 truncate">
                                {item.code} · {item.market}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] px-2 py-1 rounded-md bg-rose-50 text-rose-600 border border-rose-200 font-bold shrink-0">
                            선택
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div
                key={`selected-bar-${selectedStock.symbol}`}
                className="h-[38px] flex items-center justify-between gap-2 px-3 rounded-xl bg-slate-50 border border-slate-200/80 animate-header-switch"
                style={{ animationDuration: "0.42s" }}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${
                      selectedStock.fromSearch
                        ? "bg-rose-100 text-rose-700"
                        : "bg-slate-200/80 text-slate-700"
                    }`}
                  >
                    {selectedStock.fromSearch ? <Search size={10} /> : <Activity size={10} />}
                    {selectedStock.fromSearch ? "검색" : "보유"}
                  </span>
                  <span className="text-xs font-extrabold text-slate-900 truncate">
                    {displayName}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[11px] font-extrabold tabular-nums ${
                      selectedStock.isKRW ? "text-blue-600" : "text-amber-600"
                    }`}
                  >
                    {cleanCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearSelectedStock}
                    className="p-0.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 active:scale-90 transition-all cursor-pointer"
                    aria-label="종목 선택 해제"
                  >
                    <X size={14} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            )}

            {/* 기간 선택 세그먼트 ([1개월] [3개월] [6개월] [1년] [3년]) */}
            <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/60">
              {periodOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handlePeriodChange(opt.id)}
                  className={`py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap text-center ${
                    period === opt.id
                      ? "bg-rose-600 text-white font-black shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* ──────────────────────────────────────────────────────── */}
            {/* State A: 미선택 초기 화면 (시안 1번 화면)                */}
            {/* ──────────────────────────────────────────────────────── */}
            {!selectedStock && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/40 min-h-[378px] flex flex-col items-center justify-center p-5 text-center gap-4 animate-fade-in">
                <button
                  type="button"
                  onClick={() => mobileSearchInputRef.current?.focus()}
                  className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shadow-xs hover:bg-rose-100 active:scale-95 transition-all cursor-pointer"
                  aria-label="종목 검색하기"
                >
                  <Plus size={22} strokeWidth={2.5} />
                </button>
                <div className="space-y-1">
                  <p className="text-xs font-extrabold text-slate-700">
                    종목을 검색하거나 아래 보유 종목을 선택해보세요
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    1일 평균 변동폭, ±1σ 범위 및 정규분포를 즉시 분석합니다.
                  </p>
                </div>

                {comparisonList.length > 0 && (
                  <div className="w-full pt-2">
                    <div className="flex flex-wrap items-center justify-center gap-1.5 max-h-[120px] overflow-y-auto mobile-visible-scrollbar px-1">
                      {comparisonList.map((item, idx) => {
                        const chipCode = item.symbol.replace(/\.(KS|KQ)$/, "");
                        const chipLabel = item.isKRW ? item.name : chipCode;
                        return (
                          <button
                            key={`quick-${item.symbol}-${idx}`}
                            type="button"
                            onClick={() => handleSelectHoldingChip(item)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200/90 text-[11px] font-bold text-slate-700 shadow-2xs hover:border-rose-300 hover:bg-rose-50/40 active:scale-95 transition-all cursor-pointer opacity-0 animate-feed-lift"
                            style={{ animationDelay: `${Math.min(idx, 7) * 40}ms` }}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                item.isKRW ? "bg-blue-500" : "bg-amber-500"
                              }`}
                            />
                            <span className="truncate max-w-[120px]">{chipLabel}</span>
                            <span className="text-[10px] font-black text-rose-600 tabular-nums">
                              {item.vol}%
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ──────────────────────────────────────────────────────── */}
            {/* State B: 로딩 또는 에러 상태                             */}
            {/* ──────────────────────────────────────────────────────── */}
            {selectedStock && (isLoading || !stats) && (
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 min-h-[378px] flex flex-col items-center justify-center p-5 text-center gap-3 animate-fade-in">
                {isLoading ? (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-2xs animate-pulse">
                      <RefreshCw size={24} className="animate-spin text-rose-600" />
                    </div>
                    <p className="text-sm font-black text-slate-800">
                      종목 변동성 데이터 분석 중...
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                      과거 일별 시세와 표준편차·정규분포 지표를 계산하고 있습니다.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold text-slate-500">
                      {errorMsg || "표시할 변동성 데이터가 없습니다."}
                    </p>
                    <button
                      type="button"
                      onClick={handleClearSelectedStock}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold active:scale-95 cursor-pointer"
                    >
                      선택 해제
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ──────────────────────────────────────────────────────── */}
            {/* State C: 종목 선택 완료 후 3화면 슬라이드 (2·3·4번 화면) */}
            {/* ──────────────────────────────────────────────────────── */}
            {selectedStock && !isLoading && stats && (
              <div className="space-y-3 animate-fade-in">
                {/* 3-탭 스위처 ([요약 지표] [주가 · 밴드] [정규분포]) */}
                <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 rounded-xl">
                  {[
                    { idx: 0, label: "요약 지표" },
                    { idx: 1, label: "주가 · 밴드" },
                    { idx: 2, label: "정규분포" }
                  ].map((tab) => (
                    <button
                      key={tab.idx}
                      type="button"
                      onClick={() => handleSlideChange(tab.idx)}
                      className={`py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                        activeSlide === tab.idx
                          ? "bg-rose-600 text-white font-black shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* 탭별 결과 본문 */}
                <div className="min-h-[334px]">
                  {/* ══ Slide 0: 요약 지표 (2×2 KPI 카드) ══ */}
                  {activeSlide === 0 && (
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* ① 현재 주가 */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs flex flex-col justify-between min-h-[162px] opacity-0 animate-feed-lift stagger-1">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[11px] font-bold text-slate-600 tracking-tight shrink-0">
                              ① 현재 주가
                            </span>
                          </div>
                          <div className="mb-1.5">
                            <span className="inline-block max-w-full text-[9.5px] font-black px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 truncate">
                              {selectedStock.isKRW ? displayName : cleanCode}
                            </span>
                          </div>
                          <div className="text-right text-[17px] font-black text-slate-900 tracking-tight tabular-nums leading-tight">
                            <MobileRollingNumber value={stats.activePrice} formatFn={formatPrice} />
                          </div>
                        </div>

                        <div className="mt-1.5 pt-1.5 border-t border-slate-100 space-y-0.5 text-[10px] leading-tight font-semibold">
                          <div className="text-slate-400">전일 대비</div>
                          <div
                            className={`flex items-center justify-end gap-0.5 font-bold tabular-nums whitespace-nowrap ${
                              stats.priceChange >= 0 ? "text-rose-600" : "text-blue-600"
                            }`}
                          >
                            {stats.priceChange >= 0 ? (
                              <TrendingUp size={11} />
                            ) : (
                              <TrendingDown size={11} />
                            )}
                            <span>
                              {stats.priceChange >= 0 ? "+" : "-"}
                              {formatPrice(Math.abs(stats.priceChange))} (
                              {stats.priceChangeRate >= 0 ? "+" : ""}
                              {stats.priceChangeRate.toFixed(2)}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ② 최대 낙폭 (MDD) */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs flex flex-col justify-between min-h-[162px] opacity-0 animate-feed-lift stagger-2">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[11px] font-bold text-slate-600 tracking-tight shrink-0">
                              ② 최대 낙폭 (MDD)
                            </span>
                          </div>
                          <div className="mb-1.5 flex justify-start">
                            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 whitespace-nowrap">
                              고점 대비 : {currentPeriodLabel}
                            </span>
                          </div>
                          <div className="text-right text-[17px] font-black text-blue-600 tracking-tight tabular-nums leading-tight">
                            <MobileRollingNumber value={stats.periodMdd} decimals={1} suffix="%" />
                          </div>
                        </div>

                        <div className="mt-1.5 pt-1.5 border-t border-slate-100 space-y-0.5 text-[10px] leading-tight font-semibold">
                          <div className="text-slate-400">현재 낙폭 (고점 대비)</div>
                          <div className="text-right font-bold text-blue-600 tabular-nums">
                            <MobileRollingNumber
                              value={stats.currentDrawdown}
                              decimals={1}
                              suffix="%"
                            />
                          </div>
                        </div>
                      </div>

                      {/* ③ 1σ 예상 가격 범위 */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs flex flex-col justify-between min-h-[162px] opacity-0 animate-feed-lift stagger-3">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[11px] font-bold text-slate-600 tracking-tight shrink-0">
                              ③ 1σ 예상 가격 범위
                            </span>
                          </div>
                          <div className="mb-1.5 flex justify-start">
                            <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              68.3% 구간
                            </span>
                          </div>
                          <div className="space-y-0.5 tabular-nums leading-tight">
                            <div className="flex items-baseline justify-between gap-1">
                              <span className="text-[10.5px] font-bold text-slate-400 shrink-0">하단</span>
                              <span className="text-[14.5px] font-black text-emerald-600 tracking-tight text-right">
                                <MobileRollingNumber value={stats.lower1s} formatFn={formatPrice} />
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-1">
                              <span className="text-[10.5px] font-bold text-slate-400 shrink-0">상단</span>
                              <span className="text-[14.5px] font-black text-emerald-600 tracking-tight text-right">
                                <MobileRollingNumber value={stats.upper1s} formatFn={formatPrice} />
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-1.5 pt-1.5 border-t border-slate-100 space-y-0.5 text-[10px] leading-tight font-semibold">
                          <div className="text-slate-400">2σ 범위 (95.5%)</div>
                          <div className="text-right font-bold text-emerald-600 tabular-nums truncate">
                            <MobileRollingNumber value={stats.lower2s} formatFn={formatPrice} />
                            {" ~ "}
                            <MobileRollingNumber value={stats.upper2s} formatFn={formatPrice} />
                          </div>
                        </div>
                      </div>

                      {/* ④ 1일 평균 변동폭 (1-Day σ) */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs flex flex-col justify-between min-h-[162px] opacity-0 animate-feed-lift stagger-4">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[11px] font-bold text-slate-600 tracking-tight truncate">
                              ④ 1일 평균 변동폭
                            </span>
                          </div>
                          <div className="mb-1.5 flex justify-start">
                            <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              일일 리스크
                            </span>
                          </div>
                          <div className="text-right text-[17px] font-black text-amber-600 tracking-tight tabular-nums leading-tight">
                            <MobileRollingNumber
                              value={stats.dailySigma * 100}
                              decimals={2}
                              prefix="± "
                              suffix="%"
                            />
                          </div>
                        </div>

                        <div className="mt-1.5 pt-1.5 border-t border-slate-100 space-y-0.5 text-[10px] leading-tight font-semibold">
                          <div className="text-slate-400">일평균 등락 범위</div>
                          <div className="text-right font-bold text-amber-600 tabular-nums">
                            <MobileRollingNumber
                              value={stats.dailyPriceDelta}
                              formatFn={(val) => `± ${formatPrice(val)}`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ══ Slide 1: 표준편차(±1σ, ±2σ) 밴드 차트 ══ */}
                  {activeSlide === 1 && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs h-[334px] flex flex-col gap-2 animate-fade-in">
                      <div className="space-y-1 shrink-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <h3 className="text-[12.5px] font-black text-slate-900 tracking-tight flex items-center gap-1.5 min-w-0">
                            <BarChart2 size={15} className="text-blue-600 shrink-0" />
                            <span className="truncate">표준편차(±1σ, ±2σ) 밴드 차트</span>
                          </h3>
                          <span
                            className={`px-1.5 py-0.5 rounded-lg text-[9.5px] font-bold border whitespace-nowrap shrink-0 ${stats.riskLevel.color}`}
                          >
                            {stats.riskLevel.label}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-slate-400 font-medium leading-snug">
                          20일 이동평균선을 기준으로 한 정상 변동성 채널(±1σ 68.3%, ±2σ 95.5%)
                        </p>
                      </div>

                      {/* 범례 (한 줄 고정) */}
                      <div className="flex items-center justify-between gap-1 text-[9.5px] font-semibold text-slate-500 whitespace-nowrap shrink-0">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-1 bg-blue-600 rounded-sm shrink-0" /> 주가
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-1 bg-slate-400 rounded-sm shrink-0" /> 이동평균
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-emerald-100 border border-emerald-500 rounded-xs shrink-0" />
                          ±1σ 밴드(68.3%)
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-purple-100 border border-purple-400 rounded-xs shrink-0" />
                          ±2σ 밴드(95.5%)
                        </span>
                      </div>

                      {/* 차트 영역 */}
                      <div className="flex-1 min-h-0 w-full">
                        {isMounted && stats.chartSeries?.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={stats.chartSeries}
                              margin={{ top: 10, right: 6, left: 0, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="mobileColorClose" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.16} />
                                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                              <XAxis
                                dataKey="fullDate"
                                ticks={xTicks}
                                tick={<MobileVolatilityXAxisTick loadedPeriod={period} />}
                                axisLine={{ stroke: "#e2e8f0" }}
                                tickLine={false}
                              />
                              <YAxis
                                width={48}
                                domain={["auto", "auto"]}
                                tick={<MobileVolatilityYAxisTick isKr={isKrChart} />}
                                axisLine={{ stroke: "#e2e8f0" }}
                                tickLine={false}
                              />
                              <Tooltip
                                animationDuration={150}
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const p = payload[0].payload;
                                    const distFromMa = p.ma
                                      ? ((p.close - p.ma) / (p.upper1 - p.ma || 1)).toFixed(2)
                                      : "0";
                                    return (
                                      <div className="bg-white/95 backdrop-blur-md p-2.5 rounded-xl border border-slate-200 shadow-xl text-[11px] space-y-0.5">
                                        <p className="font-bold text-slate-700 border-b border-slate-100 pb-0.5">
                                          {p.fullDate}
                                        </p>
                                        <p className="text-blue-600 font-black">
                                          종가: {formatPrice(p.close)}
                                        </p>
                                        <p className="text-slate-500 font-medium">
                                          20일 평균: {formatPrice(p.ma)}
                                        </p>
                                        <p className="text-emerald-600 font-semibold">
                                          ±1σ: {formatPrice(p.lower1)} ~ {formatPrice(p.upper1)}
                                        </p>
                                        <p className="text-purple-600 font-semibold">
                                          ±2σ: {formatPrice(p.lower2)} ~ {formatPrice(p.upper2)}
                                        </p>
                                        <div className="text-[10px] font-bold text-slate-400 pt-0.5">
                                          밴드 위치:{" "}
                                          <span
                                            className={
                                              Number(distFromMa) >= 0
                                                ? "text-rose-500"
                                                : "text-blue-500"
                                            }
                                          >
                                            {Number(distFromMa) > 0 ? `+${distFromMa}σ` : `${distFromMa}σ`}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="upper2"
                                stroke="#a855f7"
                                strokeOpacity={0.65}
                                strokeWidth={1.1}
                                strokeDasharray="5 4"
                                fill="none"
                                fillOpacity={0}
                                dot={false}
                                animationDuration={850}
                              />
                              <Area
                                type="monotone"
                                dataKey="lower2"
                                stroke="#a855f7"
                                strokeOpacity={0.65}
                                strokeWidth={1.1}
                                strokeDasharray="5 4"
                                fill="none"
                                fillOpacity={0}
                                dot={false}
                                animationDuration={850}
                              />
                              <Area
                                type="monotone"
                                dataKey="upper1"
                                stroke="#10b981"
                                strokeOpacity={0.75}
                                strokeWidth={1.3}
                                strokeDasharray="4 3"
                                fill="none"
                                fillOpacity={0}
                                dot={false}
                                animationDuration={850}
                              />
                              <Area
                                type="monotone"
                                dataKey="lower1"
                                stroke="#10b981"
                                strokeOpacity={0.75}
                                strokeWidth={1.3}
                                strokeDasharray="4 3"
                                fill="none"
                                fillOpacity={0}
                                dot={false}
                                animationDuration={850}
                              />
                              <Area
                                type="monotone"
                                dataKey="ma"
                                stroke="#94a3b8"
                                strokeWidth={1.4}
                                fill="none"
                                fillOpacity={0}
                                dot={false}
                                animationDuration={850}
                              />
                              <Area
                                type="monotone"
                                dataKey="close"
                                stroke="#2563eb"
                                strokeWidth={2.2}
                                fillOpacity={1}
                                fill="url(#mobileColorClose)"
                                animationDuration={900}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs">
                            {errorMsg || "표시할 차트 데이터가 없습니다."}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ══ Slide 2: 일일 수익률 정규분포 ══ */}
                  {activeSlide === 2 && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs h-[334px] flex flex-col gap-2 animate-fade-in">
                      <div className="flex items-start justify-between gap-2 shrink-0">
                        <div className="min-w-0">
                          <h3 className="text-[13px] font-black text-slate-900 tracking-tight flex items-center gap-1.5 leading-snug">
                            <Sparkles size={15} className="text-emerald-600 shrink-0" />
                            <span>일일 수익률 정규분포</span>
                          </h3>
                          <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">
                            1~3 표준편차(σ) 구간별 예상 가격 및 변동 비율
                          </p>
                        </div>

                        <span
                          key={`mobile-bell-risk-${period}-${stats.riskLevel.label}`}
                          className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 text-right leading-tight animate-header-switch"
                          style={{ animationDuration: "0.9s" }}
                        >
                          위험 등급: {stats.riskLevel.label.split(" ")[0] || "보통"}
                        </span>
                      </div>

                      {/* 벨 커브 & 히스토그램 SVG */}
                      <div
                        ref={bellChartBoxRef}
                        className="relative flex-1 min-h-0 w-full overflow-hidden bg-slate-50/70 rounded-xl border border-slate-100 p-0.5 flex items-center justify-center"
                      >
                        {isBarPopupOpen && activeBarPopup && (() => {
                          const { idx, bar } = activeBarPopup;
                          const rawPct = ((bar.x + bar.width / 2 - 30) / 540) * 100;
                          const posClass =
                            rawPct < 33
                              ? "left-1.5"
                              : rawPct > 67
                                ? "right-1.5"
                                : "left-1/2 -translate-x-1/2";
                          const fmtPct = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
                          return (
                            <div
                              onClick={() => setTappedBarIdx(null)}
                              className={`absolute top-1.5 z-20 max-w-[calc(100%-12px)] cursor-pointer ${posClass}`}
                            >
                              <div
                                key={`bar-popup-${idx}`}
                                className={`bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-200 shadow-lg text-[10.5px] whitespace-nowrap truncate ${
                                  isBarPopupClosing ? "animate-tooltip-out" : "animate-tooltip-in"
                                }`}
                              >
                                <span className="font-bold text-slate-600">일간 변동: </span>
                                <span className="font-black text-slate-900">
                                  {fmtPct(bar.minPct)} ~ {fmtPct(bar.maxPct)}
                                </span>
                                <span className="ml-1 text-slate-400 font-semibold">({bar.count}일)</span>
                              </div>
                            </div>
                          );
                        })()}

                        {staticBellCurveSvg && (
                          <svg
                            viewBox="30 10 540 184"
                            className="w-full h-full"
                            suppressHydrationWarning
                          >
                            <path
                              d={staticBellCurveSvg.areaPath}
                              fill="#f1f5f9"
                              opacity={0.6}
                              suppressHydrationWarning
                            />
                            <rect x="225" y="15" width="150" height="154" fill="#ecfdf5" opacity={0.7} rx="6" />

                            {stats.histogramBars?.map((bar, idx) => (
                              <g
                                key={idx}
                                onClick={() => {
                                  setTappedSigmaIdx(null);
                                  setTappedBarIdx((prev) => (prev === idx ? null : idx));
                                }}
                                className="cursor-pointer"
                                style={{
                                  transformOrigin: "0px 169px",
                                  animation: `bellBarRise 0.55s cubic-bezier(0.16, 1, 0.3, 1) ${0.12 + idx * 0.025}s both`
                                }}
                              >
                                <rect
                                  x={bar.x}
                                  y={bar.y}
                                  width={bar.width}
                                  height={bar.height}
                                  fill={bar.color || "#10b981"}
                                  opacity={tappedBarIdx === idx ? 0.88 : 0.45}
                                  rx="2"
                                  className="transition-all duration-700 ease-out"
                                />
                                <rect x={bar.x} y={15} width={bar.width} height={154} fill="transparent" />
                              </g>
                            ))}

                            <g className="pointer-events-none">
                              <line x1="300" y1="20" x2="300" y2="169" stroke="#059669" strokeWidth="2" strokeDasharray="3 3" />
                              <line x1="225" y1="48" x2="225" y2="169" stroke="#10b981" strokeWidth="1.5" strokeDasharray="2 2" />
                              <line x1="375" y1="48" x2="375" y2="169" stroke="#10b981" strokeWidth="1.5" strokeDasharray="2 2" />
                              <line x1="150" y1="111" x2="150" y2="169" stroke="#a855f7" strokeWidth="1" strokeDasharray="2 2" />
                              <line x1="450" y1="111" x2="450" y2="169" stroke="#a855f7" strokeWidth="1" strokeDasharray="2 2" />
                              <line x1="75" y1="157" x2="75" y2="169" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />
                              <line x1="525" y1="157" x2="525" y2="169" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />

                              <path
                                d={staticBellCurveSvg.path}
                                pathLength="1"
                                fill="none"
                                stroke="#0ea5e9"
                                strokeWidth="3"
                                strokeLinecap="round"
                                className="animate-bell-curve-draw"
                                suppressHydrationWarning
                              />

                              <text x="75" y="187" textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="700">-3σ</text>
                              <text x="150" y="187" textAnchor="middle" fill="#9333ea" fontSize="11" fontWeight="700">-2σ</text>
                              <text x="225" y="187" textAnchor="middle" fill="#059669" fontSize="11" fontWeight="800">-1σ</text>
                              <text x="300" y="187" textAnchor="middle" fill="#2563eb" fontSize="11" fontWeight="800">0</text>
                              <text x="375" y="187" textAnchor="middle" fill="#059669" fontSize="11" fontWeight="800">+1σ</text>
                              <text x="450" y="187" textAnchor="middle" fill="#9333ea" fontSize="11" fontWeight="700">+2σ</text>
                              <text x="525" y="187" textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="700">+3σ</text>
                            </g>
                          </svg>
                        )}
                      </div>

                      {/* -3σ ~ +3σ 눈금 그리드 (스크롤 없이 한 화면 표시 + 탭 팝업) */}
                      <div ref={sigmaGridRef} className="relative shrink-0">
                        {isSigmaPopupOpen && activeSigmaPopup && (() => {
                          const { idx, tick: t } = activeSigmaPopup;
                          const tailProb =
                            Math.abs(t.sigma) === 1
                              ? "15.9%"
                              : Math.abs(t.sigma) === 2
                                ? "2.3%"
                                : Math.abs(t.sigma) === 3
                                  ? "0.1%"
                                  : "50.0%";
                          const rangeProb =
                            Math.abs(t.sigma) === 1
                              ? "68.3%"
                              : Math.abs(t.sigma) === 2
                                ? "95.5%"
                                : Math.abs(t.sigma) === 3
                                  ? "99.7%"
                                  : "50.0%";
                          const zoneLabel = t.isCenter
                            ? "현재 기준가"
                            : Math.abs(t.sigma) === 1
                              ? "정상 구간 (±1σ)"
                              : Math.abs(t.sigma) === 2
                                ? "주의 구간 (±2σ)"
                                : "극단 구간 (±3σ)";
                          const desc = t.isCenter
                            ? "현재 주가 기준점 (변동률 0%)"
                            : `±${Math.abs(t.sigma)}σ 범위 안 머무를 확률: ${rangeProb}`;
                          const subDesc = t.isCenter
                            ? null
                            : t.sigma < 0
                              ? `${t.label} 이하 하락 확률: 약 ${tailProb}`
                              : `${t.label} 이상 상승 확률: 약 ${tailProb}`;
                          const posClass =
                            idx <= 1
                              ? "left-0"
                              : idx >= 5
                                ? "right-0"
                                : "left-1/2 -translate-x-1/2";

                          return (
                            <div
                              onClick={() => setTappedSigmaIdx(null)}
                              className={`absolute bottom-full mb-1.5 z-30 max-w-full cursor-pointer ${posClass}`}
                            >
                              <div
                                key={`sigma-popup-${idx}`}
                                className={`bg-slate-900/95 backdrop-blur-md text-white text-xs px-3.5 py-2.5 rounded-xl shadow-2xl border border-slate-700/80 whitespace-nowrap space-y-1 ${
                                  isSigmaPopupClosing ? "animate-tooltip-out" : "animate-tooltip-in"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3 border-b border-slate-700/70 pb-1">
                                  <span className="font-black text-emerald-400">{t.label}</span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                    {zoneLabel}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-200 font-medium">{desc}</p>
                                {subDesc && (
                                  <p className="text-[11px] text-slate-300 font-medium">{subDesc}</p>
                                )}
                                <p className="text-[11px] text-slate-300 font-bold">
                                  예상가: <span className="text-white">{formatPrice(t.price)}</span> ({t.pctChangeStr})
                                </p>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="grid grid-cols-7 gap-1 text-center">
                          {bellCurveTicks.map((t, idx) => (
                            <button
                              key={t.label}
                              type="button"
                              onClick={() => {
                                setTappedBarIdx(null);
                                setTappedSigmaIdx((prev) => (prev === idx ? null : idx));
                              }}
                              className={`px-0.5 py-1.5 rounded-xl border flex flex-col items-center justify-between opacity-0 animate-feed-lift min-w-0 cursor-pointer transition-transform active:scale-95 ${
                                tappedSigmaIdx === idx ? "ring-2 ring-slate-800/25" : ""
                              } ${
                                t.isCenter
                                  ? "bg-blue-50/80 border-blue-200 shadow-2xs"
                                  : Math.abs(t.sigma) === 1
                                    ? "bg-emerald-50/60 border-emerald-200"
                                    : Math.abs(t.sigma) === 2
                                      ? "bg-purple-50/40 border-purple-100"
                                      : "bg-slate-50/80 border-slate-100"
                              }`}
                              style={{ animationDelay: `${idx * 35}ms` }}
                            >
                              <span
                                className={`text-[9.5px] font-black tracking-tighter whitespace-nowrap ${
                                  t.isCenter
                                    ? "text-blue-700"
                                    : t.sigma > 0
                                      ? "text-emerald-700"
                                      : t.sigma < 0
                                        ? "text-blue-700"
                                        : "text-slate-600"
                                }`}
                              >
                                {t.isCenter ? "기준" : t.label}
                              </span>
                              <span
                                className={`text-[9px] font-black my-0.5 tabular-nums tracking-tighter whitespace-nowrap ${
                                  t.isCenter
                                    ? "text-blue-600"
                                    : t.mult > 0
                                      ? "text-rose-600"
                                      : "text-blue-600"
                                }`}
                              >
                                <MobileRollingNumber
                                  value={t.pctChange}
                                  formatFn={(val) => `${val > 0 ? "+" : ""}${val.toFixed(1)}%`}
                                />
                              </span>
                              <span className="text-[8.5px] font-bold text-slate-800 tracking-tighter tabular-nums whitespace-nowrap">
                                <MobileRollingNumber
                                  value={t.price}
                                  formatFn={formatCompactTickPrice}
                                />
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 신뢰구간 범례 (한 줄 표시) */}
                      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1 text-[9px] tracking-tighter text-slate-500 whitespace-nowrap shrink-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span>
                            <strong className="font-bold text-slate-700">±1σ(68.27%)</strong>: 정상 주가 구간
                          </span>
                        </div>
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                          <span>
                            <strong className="font-bold text-slate-700">±2σ(95.45%)</strong>: 과열/침체 한계선
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
