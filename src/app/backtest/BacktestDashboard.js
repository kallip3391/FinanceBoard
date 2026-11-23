"use client";

import { memo, useState, useEffect, useRef } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Sparkles, 
  BarChart2, 
  RefreshCw 
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

// 통화 기호(₩) 없이 단위를 붙여주는 헬퍼 (KPI 카드 내부 간결한 표기용)
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

// 원 단위 정확한 금액 표기 헬퍼 (예: 256,123,456원)
const formatExactWon = (val) => {
  if (val == null || isNaN(val)) return "0원";
  return `${Math.round(val).toLocaleString()}원`;
};

// ── 상단 요약 카드 숫자 롤링 카운터 (직접 DOM 렌더링으로 리액트 부하 0%, 부드러운 롤링 전환) ──
function AnimatedRollingNumber({
  value,
  duration = 400,
  decimals = 0,
  showSign = false,
  prefix = "",
  suffix = "",
  formatFn,
  emptyText = "-"
}) {
  const spanRef = useRef(null);
  const prevValueRef = useRef(value != null && !isNaN(value) ? Number(value) : null);
  const isFirstMountRef = useRef(true);

  // 값 포맷터 헬퍼
  const format = (val) => {
    if (val == null || isNaN(val)) return emptyText;
    if (formatFn) return formatFn(val);
    let formattedNum = "";
    if (decimals > 0) {
      formattedNum = val.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    } else {
      formattedNum = Math.round(val).toLocaleString();
    }
    const sign = showSign && val > 0 ? "+" : "";
    return `${sign}${prefix}${formattedNum}${suffix}`;
  };

  useEffect(() => {
    if (value == null || isNaN(value)) {
      if (spanRef.current) spanRef.current.textContent = emptyText;
      prevValueRef.current = null;
      return;
    }

    const endVal = Number(value);

    // 컴포넌트 첫 마운트 시 (최초 1회 백테스트 실행 시: 즉시 최종값 표시)
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      if (spanRef.current) spanRef.current.textContent = format(endVal);
      prevValueRef.current = endVal;
      return;
    }

    const startVal = prevValueRef.current != null ? prevValueRef.current : endVal;
    if (startVal === endVal) {
      if (spanRef.current) spanRef.current.textContent = format(endVal);
      return;
    }

    let startTime = null;
    let animationFrame;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // easeOutQuad: 초반부터 후반까지 균일하고 부드러운 감속 곡선 (단절감 없이 부드럽게 롤링)
      const easeProgress = 1 - (1 - progress) * (1 - progress);
      const current = startVal + (endVal - startVal) * easeProgress;

      if (spanRef.current) {
        spanRef.current.textContent = format(current);
      }

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      } else {
        if (spanRef.current) spanRef.current.textContent = format(endVal);
        prevValueRef.current = endVal;
      }
    };

    animationFrame = requestAnimationFrame(step);
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [value, duration]);

  const initialNum = value != null && !isNaN(value) ? Number(value) : null;
  return <span ref={spanRef}>{format(initialNum)}</span>;
}

// ═════════════════════════════════════════════════════════════════════
// [우측] 백테스트 분석 결과 대시보드 컴포넌트 (React.memo 메모이제이션)
// 좌측의 검색어 타이핑, 비중 슬라이더 조절 시 불필요한 Recharts 대용량 SVG 재계산을 차단
// ═════════════════════════════════════════════════════════════════════
const BacktestDashboard = memo(function BacktestDashboard({
  resultData,
  loading,
  benchmarks,
  executedConfig,
  isMounted,
  formatWon
}) {
  const summary = resultData?.summary;
  const chartSeries = resultData?.chartSeries || [];
  const annualReturns = resultData?.annualReturns || [];
  const correlationMatrix = resultData?.correlationMatrix;

  return (
    <div className={`lg:col-span-8 xl:col-span-9 ${!resultData ? "h-full flex flex-col" : "space-y-6 animate-fade-in"}`}>
      {!resultData ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 md:p-12 shadow-xs text-center flex flex-col items-center justify-center flex-1 w-full h-full min-h-[580px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 shadow-sm animate-pulse">
                <RefreshCw size={32} className="animate-spin text-indigo-600" />
              </div>
              <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight mb-2">
                백테스트 시뮬레이션 분석 중...
              </h3>
              <p className="text-xs md:text-sm text-slate-500 max-w-md leading-relaxed">
                과거 주가 시세, 환율 시계열 데이터 및 리밸런싱 로직을 계산하고 있습니다.
              </p>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 shadow-2xs">
                <Layers size={32} className="stroke-[2.2]" />
              </div>
              <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight mb-2">
                포트폴리오를 구성하고 백테스트를 실행해보세요
              </h3>
              <p className="text-xs md:text-sm text-slate-500 max-w-md leading-relaxed mb-8">
                실제 일별 주가 시세와 원/달러 환율 시계열 데이터를 바탕으로 자산 성장 추이, MDD, 샤프지수 및 벤치마크(S&amp;P 500, 나스닥 100) 비교 분석을 제공합니다.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl text-left">
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70 space-y-1.5">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center">1</div>
                  <h4 className="text-xs font-bold text-slate-800">종목 추가</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    좌측 검색창에서 종목을 검색하거나 &apos;내 보유자산 불러오기&apos;를 클릭하세요.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70 space-y-1.5">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center">2</div>
                  <h4 className="text-xs font-bold text-slate-800">비중 설정</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    슬라이더나 숫자로 비중을 조절하여 총합 100%를 맞추세요. (균등 배분 지원)
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70 space-y-1.5">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center">3</div>
                  <h4 className="text-xs font-bold text-slate-800">백테스트 실행</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    투자금, 적립금, 기간 설정 후 &apos;🚀 백테스트 실행하기&apos;를 누르면 결과가 출력됩니다.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {/* ──────────────────────────────────────────────────────── */}
          {/* 상단 4대 성과 지표 KPI 카드                              */}
          {/* ──────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* ① 최종 자산 (누적수익률) */}
            <div className="bg-white rounded-2xl border border-slate-200/80 py-3.5 px-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors h-[162px] min-h-[162px] max-h-[162px] overflow-hidden shrink-0 animate-card-entrance">
              <div>
                <div className="flex items-center justify-between text-slate-500 mb-1.5">
                  <span className="text-xs font-bold text-slate-600 tracking-tight">① 최종 자산 (누적수익률)</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200/80">
                    원화 합산
                  </span>
                </div>
                <div className="text-right">
                  <div className="relative group inline-block cursor-help">
                    <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight hover:text-indigo-600 transition-colors">
                      <AnimatedRollingNumber
                        value={summary?.finalValue ?? summary?.finalBalance}
                        formatFn={(val) => formatExactWon(val)}
                      />
                    </div>
                    {/* 마우스 호버 시 나타나는 환차익 다크 글래스모피즘 툴팁 */}
                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/95 text-white text-xs font-bold shadow-2xl backdrop-blur-md border border-slate-700/80 pointer-events-none z-50 whitespace-nowrap transition-all">
                      <span className="text-indigo-400">환차익 :</span>
                      <span className="text-white font-black">
                        ${summary?.fxProfitUsd !== undefined ? Math.abs(summary.fxProfitUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                      </span>
                      <span className="text-indigo-300">
                        [{(summary?.fxImpactPct ?? 0) >= 0 ? `+${summary?.fxImpactPct ?? 0}%` : `${summary?.fxImpactPct ?? 0}%`}]
                      </span>
                      {/* 하단 툴팁 화살표 */}
                      <div className="absolute top-full right-6 -mt-[1px] w-0 h-0 border-x-4 border-x-transparent border-t-[5px] border-t-slate-900/95" />
                    </div>
                  </div>
                  <div className={`text-xs sm:text-sm font-bold tracking-tight ${(summary?.totalReturnRate ?? summary?.totalReturn ?? 0) >= 0 ? "text-rose-500" : "text-blue-500"}`}>
                    (
                    <AnimatedRollingNumber
                      value={summary?.totalReturnRate ?? summary?.totalReturn}
                      decimals={1}
                      showSign={true}
                      suffix="%"
                    />
                    )
                  </div>
                </div>
              </div>

              {/* 하단 국내 / 해외 (2줄) & 원금 */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 h-[46px] flex flex-col justify-center text-[11px] text-slate-500 font-medium space-y-1">
                <div className="flex items-center justify-between">
                  <span>
                    국내: <strong className="text-slate-800 font-bold">
                      <AnimatedRollingNumber
                        value={summary?.domesticWon ?? 0}
                        formatFn={(val) => formatExactWon(val)}
                      />
                    </strong>
                  </span>
                  <span>
                    원금 : <strong className="text-slate-500 font-bold">
                      <AnimatedRollingNumber
                        value={summary?.investedCapital}
                        formatFn={(val) => `${formatCleanWon(val)}원`}
                      />
                    </strong>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="relative group inline-block cursor-help">
                    <span className="hover:text-slate-800 transition-colors">
                      해외: <strong className="text-slate-800 font-bold">
                        <AnimatedRollingNumber
                          value={summary?.foreignWon ?? 0}
                          formatFn={(val) => formatExactWon(val)}
                        />
                      </strong>{" "}
                      <AnimatedRollingNumber
                        value={summary?.foreignUsd}
                        formatFn={(val) => val != null ? `($${Math.round(val).toLocaleString()})` : "($0)"}
                      />
                    </span>
                    {/* 마우스 호버 시 나타나는 환차익 다크 글래스모피즘 툴팁 */}
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/95 text-white text-xs font-bold shadow-2xl backdrop-blur-md border border-slate-700/80 pointer-events-none z-50 whitespace-nowrap transition-all">
                      <span className="text-indigo-400">환차익 :</span>
                      <span className="text-white font-black">
                        ${summary?.fxProfitUsd !== undefined ? Math.abs(summary.fxProfitUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                      </span>
                      <span className="text-indigo-300">
                        [{(summary?.fxImpactPct ?? 0) >= 0 ? `+${summary?.fxImpactPct ?? 0}%` : `${summary?.fxImpactPct ?? 0}%`}]
                      </span>
                      {/* 하단 툴팁 화살표 */}
                      <div className="absolute top-full left-6 -mt-[1px] w-0 h-0 border-x-4 border-x-transparent border-t-[5px] border-t-slate-900/95" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ② 최대 낙폭 (MDD) */}
            <div className="bg-white rounded-2xl border border-slate-200/80 py-3.5 px-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors h-[162px] min-h-[162px] max-h-[162px] overflow-hidden shrink-0 animate-card-entrance stagger-1">
              <div>
                <div className="flex items-center justify-between text-slate-500 mb-1.5">
                  <span className="text-xs font-bold text-slate-600 tracking-tight">② 최대 낙폭 (MDD)</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200/80">
                    하방 방어력
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xl sm:text-2xl font-black text-blue-600 tracking-tight leading-tight">
                    <AnimatedRollingNumber
                      value={summary?.maxDrawdown}
                      decimals={1}
                      suffix="%"
                      emptyText="-"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-100 h-[46px] flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="text-slate-500 font-medium">비교지수</span>
                <div className="flex flex-col items-end space-y-1">
                  <div className="flex items-center justify-end gap-2 text-[11px] leading-tight">
                    <span className={`w-[58px] font-bold transition-colors ${benchmarks.includes("SPY") ? "text-slate-800" : "text-slate-400"}`}>
                      S&P500
                    </span>
                    <span 
                      key={benchmarks.includes("SPY") ? "spy-on" : "spy-off"}
                      className={`w-12 text-right font-bold transition-colors ${benchmarks.includes("SPY") && summary?.spyDrawdown !== undefined && summary?.spyDrawdown !== null ? "text-blue-600" : "text-slate-300 font-normal"}`}
                    >
                      {benchmarks.includes("SPY") && summary?.spyDrawdown !== undefined && summary?.spyDrawdown !== null ? (
                        <AnimatedRollingNumber
                          value={summary?.spyDrawdown}
                          decimals={1}
                          suffix="%"
                        />
                      ) : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2 text-[11px] leading-tight">
                    <span className={`w-[58px] font-bold transition-colors ${benchmarks.includes("QQQ") ? "text-slate-800" : "text-slate-400"}`}>
                      나스닥 100
                    </span>
                    <span 
                      key={benchmarks.includes("QQQ") ? "qqq-on" : "qqq-off"}
                      className={`w-12 text-right font-bold transition-colors ${benchmarks.includes("QQQ") && summary?.qqqDrawdown !== undefined && summary?.qqqDrawdown !== null ? "text-blue-600" : "text-slate-300 font-normal"}`}
                    >
                      {benchmarks.includes("QQQ") && summary?.qqqDrawdown !== undefined && summary?.qqqDrawdown !== null ? (
                        <AnimatedRollingNumber
                          value={summary?.qqqDrawdown}
                          decimals={1}
                          suffix="%"
                        />
                      ) : "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ③ 샤프 지수 (Sharpe Ratio) */}
            <div className="bg-white rounded-2xl border border-slate-200/80 py-3.5 px-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors h-[162px] min-h-[162px] max-h-[162px] overflow-hidden shrink-0 animate-card-entrance stagger-2">
              <div>
                <div className="flex items-center justify-between text-slate-500 mb-1.5">
                  <span className="text-xs font-bold text-slate-600 tracking-tight">③ 샤프 지수 (Sharpe)</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/80">
                    수익 가성비
                  </span>
                </div>
                <div className="text-right">
                  <div className="relative group inline-block cursor-help">
                    <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight hover:text-emerald-600 transition-colors">
                      <AnimatedRollingNumber
                        value={summary?.sharpeRatio}
                        decimals={2}
                        emptyText="-"
                      />
                    </div>
                    {/* 마우스 호버 시 나타나는 샤프 지수 다크 글래스모피즘 툴팁 */}
                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col gap-1.5 p-3 rounded-xl bg-slate-900/95 text-white text-[11px] shadow-2xl backdrop-blur-md border border-slate-700/80 pointer-events-none z-50 whitespace-nowrap transition-all text-left">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                        <span>💡 샤프 지수 (Sharpe Ratio)</span>
                      </div>
                      <p className="text-slate-200 font-medium text-xs">
                        위험을 감수한 대가로 수익을 얼마나 챙겼는가?
                      </p>
                      <div className="text-[10.5px] text-slate-300 border-t border-slate-700/60 pt-2 mt-0.5 flex flex-col space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>1.0 미만 (보통) : 위험 감수 대비 수익률이 낮음</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>1.0 ~ 1.5 (우수) : 금융 시장에서 인정하는 양호하고 탄탄한 투자 전략</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>1.5 ~ 2.0 (매우 우수): 변동성을 잘 통제하면서 높은 수익달성</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>2.0 이상 (최우수): 글로벌 탑티어 헤지펀드 수준의 탁월한 리스크관리</span>
                        </div>
                      </div>
                      {/* 하단 툴팁 화살표 */}
                      <div className="absolute top-full right-6 -mt-[1px] w-0 h-0 border-x-4 border-x-transparent border-t-[5px] border-t-slate-900/95" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-100 h-[46px] flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">성과 평가</span>
                <span className="font-bold text-emerald-600 bg-emerald-50/80 px-2.5 py-0.5 rounded-md text-xs border border-emerald-200/60">
                  {summary?.sharpeRatio >= 1.5 ? "매우 우수 (Very Good)" : summary?.sharpeRatio >= 1.0 ? "우수 (Good)" : "보통 (Moderate)"}
                </span>
              </div>
            </div>

            {/* ④ 벤치마크 상관계수 (r) */}
            <div className="bg-white rounded-2xl border border-slate-200/80 py-3.5 px-3.5 sm:px-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors h-[162px] min-h-[162px] max-h-[162px] overflow-hidden shrink-0 animate-card-entrance stagger-3">
              <div>
                <div className="flex items-center justify-between text-slate-500 mb-1.5">
                  <span className="text-xs font-bold text-slate-600 tracking-tight">④ 벤치마크 상관계수 (r)</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/80">
                    지수 추종도
                  </span>
                </div>
                <div className="flex justify-end">
                  <div className="relative group inline-block cursor-help">
                    <div className="flex flex-col items-end space-y-1">
                      <div className="flex items-center justify-between w-[125px] leading-tight">
                        <span className={`text-xs sm:text-sm font-bold transition-colors ${benchmarks.includes("SPY") ? "text-purple-950" : "text-slate-400"}`}>
                          S&P500
                        </span>
                        <span 
                          key={benchmarks.includes("SPY") ? "spy-on" : "spy-off"}
                          className={`w-12 text-right text-base sm:text-lg font-black transition-colors ${benchmarks.includes("SPY") && summary?.rSpy !== undefined && summary?.rSpy !== null ? "text-purple-700" : "text-slate-300 font-normal"}`}
                        >
                          {benchmarks.includes("SPY") && summary?.rSpy !== undefined && summary?.rSpy !== null ? (
                            <AnimatedRollingNumber
                              value={summary?.rSpy}
                              decimals={2}
                            />
                          ) : "-"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between w-[125px] leading-tight">
                        <span className={`text-xs sm:text-sm font-bold transition-colors ${benchmarks.includes("QQQ") ? "text-purple-950" : "text-slate-400"}`}>
                          나스닥 100
                        </span>
                        <span 
                          key={benchmarks.includes("QQQ") ? "qqq-on" : "qqq-off"}
                          className={`w-12 text-right text-base sm:text-lg font-black transition-colors ${benchmarks.includes("QQQ") && summary?.rQqq !== undefined && summary?.rQqq !== null ? "text-purple-700" : "text-slate-300 font-normal"}`}
                        >
                          {benchmarks.includes("QQQ") && summary?.rQqq !== undefined && summary?.rQqq !== null ? (
                            <AnimatedRollingNumber
                              value={summary?.rQqq}
                              decimals={2}
                            />
                          ) : "-"}
                        </span>
                      </div>
                    </div>
                    {/* 마우스 호버 시 나타나는 벤치마크 상관계수 다크 글래스모피즘 툴팁 */}
                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex flex-col gap-1.5 p-3 rounded-xl bg-slate-900/95 text-white text-[11px] shadow-2xl backdrop-blur-md border border-slate-700/80 pointer-events-none z-50 whitespace-nowrap transition-all text-left">
                      <div className="flex items-center gap-1.5 font-bold text-purple-300">
                        <span>💡 벤치마크 상관계수 (Correlation, r)</span>
                      </div>
                      <p className="text-slate-200 font-medium text-xs">
                        지수(S&P 500, 나스닥 100)와 얼마나 유사한가
                      </p>
                      <div className="text-[10.5px] text-slate-300 border-t border-slate-700/60 pt-2 mt-0.5 flex flex-col space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-purple-400 font-bold">•</span>
                          <span>0.80 ~ 1.00 (지수 밀착형) : 지수와 대부분 동일한 형태로 움직임</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-purple-400 font-bold">•</span>
                          <span>0.50 ~ 0.79 (지수 추종형) : 지수 상승,하락을 적절히 추종</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-purple-400 font-bold">•</span>
                          <span>0.50 미만 : 지수와 유사성이 낮음</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-purple-400 font-bold">•</span>
                          <span>0 이하 : 지수와 반대성향</span>
                        </div>
                      </div>
                      {/* 하단 툴팁 화살표 */}
                      <div className="absolute top-full right-6 -mt-[1px] w-0 h-0 border-x-4 border-x-transparent border-t-[5px] border-t-slate-900/95" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-100 h-[46px] flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">분산 효과</span>
                <span 
                  key={`badge-${(summary?.rSpy ?? 1) >= 0.8 ? "tight" : (summary?.rSpy ?? 1) >= 0.5 ? "follow" : (summary?.rSpy ?? 1) > 0 ? "div" : "opp"}`}
                  className="font-bold text-purple-700 bg-purple-50/80 px-2.5 py-0.5 rounded-md text-xs border border-purple-200/60"
                >
                  {(summary?.rSpy ?? 1) >= 0.8 ? "지수 밀착형" : (summary?.rSpy ?? 1) >= 0.5 ? "지수 추종형" : (summary?.rSpy ?? 1) > 0 ? "우수한 리스크 분산" : "지수 반대 성향"}
                </span>
              </div>
            </div>

          </div>

          {/* ──────────────────────────────────────────────────────── */}
          {/* 중앙 메인 자산 성장 추이 & MDD 수중 차트                */}
          {/* ──────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <TrendingUp size={18} className="text-emerald-600" />
                  포트폴리오 자산 성장 추이
                  <span className="text-xs font-normal text-slate-400">
                    (초기 {formatWon(executedConfig?.initialAmount ?? 10000000)} + 월 {formatWon(executedConfig?.monthlyContribution ?? 500000)} 적립)
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  실제 환율 변동 및 적립금 매수가 반영된 원화(KRW) 기준 자산 성장 궤적
                </p>
              </div>

              {/* 범례 표시 */}
              <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1.5 bg-emerald-500 rounded-sm" /> 내 포트폴리오
                </span>
                {benchmarks.includes("SPY") && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-1.5 bg-slate-400 rounded-sm border-t border-dashed border-slate-600" /> S&P 500
                  </span>
                )}
                {benchmarks.includes("QQQ") && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-1.5 bg-purple-500 rounded-sm" /> 나스닥 100
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-slate-300 rounded-sm" /> 총 투입원금
                </span>
              </div>
            </div>

            {/* 자산 성장 라인/영역 차트 */}
            <div className="h-[300px] w-full relative">
              {loading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-xl">
                  <RefreshCw size={24} className="text-indigo-600 animate-spin" />
                </div>
              )}
              {isMounted && chartSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartSeries} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPort" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                      tickFormatter={(v) => formatWon(v).replace("₩", "")}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const p = payload[0].payload;
                          return (
                            <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-xl text-xs space-y-1">
                              <p className="font-bold text-slate-700 border-b border-slate-100 pb-1">{p.fullDate} (환율 ₩{p.fxRate})</p>
                              <p className="text-emerald-600 font-black text-sm">내 포트폴리오: {formatWon(p.portfolio)}</p>
                              {benchmarks.includes("SPY") && (
                                <p className="text-slate-500 font-medium">S&P 500: {formatWon(p.spy)}</p>
                              )}
                              {benchmarks.includes("QQQ") && (
                                <p className="text-purple-600 font-medium">나스닥 100: {formatWon(p.qqq)}</p>
                              )}
                              <p className="text-slate-400 font-semibold border-t border-slate-100 pt-1">
                                총 투입원금: {formatWon(p.invested)} (낙폭: {p.drawdown}%)
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {/* 총 투입원금 선 */}
                    <Line type="stepAfter" dataKey="invested" stroke="#cbd5e1" strokeWidth={1.5} dot={false} animationDuration={900} />
                    {/* S&P 500 (원화 환산) */}
                    {benchmarks.includes("SPY") && (
                      <Line
                        key={`spy-${executedConfig?.executedAt || 'init'}`}
                        type="monotone"
                        dataKey="spy"
                        stroke="#64748b"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                        animationDuration={1000}
                      />
                    )}
                    {/* 나스닥 100 */}
                    {benchmarks.includes("QQQ") && (
                      <Line
                        key={`qqq-${executedConfig?.executedAt || 'init'}`}
                        type="monotone"
                        dataKey="qqq"
                        stroke="#a855f7"
                        strokeWidth={1.5}
                        dot={false}
                        animationDuration={1000}
                      />
                    )}
                    {/* 내 포트폴리오 */}
                    <Area type="monotone" dataKey="portfolio" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPort)" animationDuration={1000} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs font-medium">
                  표시할 차트 데이터가 없습니다.
                </div>
              )}
            </div>

            {/* 하단 수중 낙폭 (MDD Underwater) 차트 */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <TrendingDown size={14} className="text-rose-500" />
                  수중 낙폭 차트 (Drawdown MDD %)
                </span>
                <span className="text-[10px] text-slate-400">역사적 고점 대비 하락 깊이 및 회복 궤적</span>
              </div>
              <div className="h-[90px] w-full relative">
                {loading && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-lg">
                    <RefreshCw size={18} className="text-rose-500 animate-spin" />
                  </div>
                )}
                {isMounted && chartSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartSeries} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                      <XAxis dataKey="date" hide />
                      <YAxis domain={["dataMin", 0]} tick={{ fontSize: 9, fill: "#94a3b8" }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(val) => [`${val}%`, "낙폭"]}
                        labelFormatter={(lbl) => `일자: ${lbl}`}
                        contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      />
                      <Area type="monotone" dataKey="drawdown" stroke="#f43f5e" strokeWidth={1.2} fill="#ffe4e6" fillOpacity={0.6} dot={false} animationDuration={900} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────── */}
          {/* 하단 2분할 섹션: [종목 상관관계 매트릭스] + [연도별 수익률 막대] */}
          {/* ──────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
            
            {/* [좌측 6열] 종목 & 벤치마크 상관관계 매트릭스 테이블 */}
            <div className="xl:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                    <Sparkles size={16} className="text-purple-600" />
                    종목 & 벤치마크 상관관계 매트릭스
                  </h4>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    -1.0 (역상관) ~ +1.0 (동조화)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-center text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100 text-[10px]">
                        <th className="py-2 text-left font-bold pl-2">종목</th>
                        {correlationMatrix?.symbols?.map((sym, sIdx) => (
                          <th key={`${sym}-${sIdx}`} className="py-2 px-1 text-[11px] font-mono">
                            {sym.replace(/\.(KS|KQ)$/, '')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {correlationMatrix?.matrix?.map((row, rIdx) => (
                        <tr key={`${row.symbol}-${rIdx}`} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 text-left font-bold text-slate-800 text-[11px] pl-2 truncate max-w-[100px]" title={row.name}>
                            {row.symbol.replace(/\.(KS|KQ)$/, '')}
                          </td>
                          {row.values?.map((val, cIdx) => {
                            const isSelf = rIdx === cIdx;
                            // 색상 매핑: 양의 상관관계(빨강/주황), 음의 상관관계(파랑/초록)
                            let bgClass = "bg-slate-50 text-slate-600";
                            if (isSelf) {
                              bgClass = "bg-slate-100 text-slate-400 font-bold";
                            } else if (val >= 0.7) {
                              bgClass = "bg-rose-50 text-rose-700 font-bold";
                            } else if (val >= 0.4) {
                              bgClass = "bg-amber-50 text-amber-700 font-semibold";
                            } else if (val <= 0.1) {
                              bgClass = "bg-emerald-50 text-emerald-700 font-bold";
                            }

                            return (
                              <td key={cIdx} className="py-1 px-1">
                                <span className={`inline-block w-full py-1 rounded-md text-[11px] ${bgClass}`}>
                                  {val > 0 && !isSelf ? `+${val}` : val}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                <span>💡 상관계수가 낮을수록(0.5 이하) 하락장 방어 분산 효과가 극대화됩니다.</span>
              </div>
            </div>

            {/* [우측 6열] 연도별 수익률 비교 바 차트 (내 포트폴리오 vs SPY vs QQQ 3개 막대) */}
            <div className="xl:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                    <BarChart2 size={16} className="text-indigo-600" />
                    연도별 수익률 비교 (Annual Returns)
                  </h4>
                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    <span className="flex items-center gap-1 text-emerald-600">
                      <span className="w-2 h-2 rounded-xs bg-emerald-500" /> 포트폴리오
                    </span>
                    {benchmarks.includes("SPY") && (
                      <span className="flex items-center gap-1 text-slate-600">
                        <span className="w-2 h-2 rounded-xs bg-slate-500" /> S&P 500
                      </span>
                    )}
                    {benchmarks.includes("QQQ") && (
                      <span className="flex items-center gap-1 text-purple-600">
                        <span className="w-2 h-2 rounded-xs bg-purple-500" /> 나스닥 100
                      </span>
                    )}
                  </div>
                </div>

                <div className="h-[210px] w-full mt-2">
                  {isMounted && annualReturns.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={annualReturns} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `${v}%`} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-white/95 backdrop-blur-md p-2.5 rounded-xl border border-slate-200 shadow-xl text-xs space-y-1">
                                  <p className="font-bold text-slate-700">{d.year}년 연간 수익률</p>
                                  <p className="text-emerald-600 font-bold">내 포트폴리오: {d.portfolio > 0 ? `+${d.portfolio}%` : `${d.portfolio}%`}</p>
                                  {benchmarks.includes("SPY") && (
                                    <p className="text-slate-600 font-medium">S&P 500: {d.spy > 0 ? `+${d.spy}%` : `${d.spy}%`}</p>
                                  )}
                                  {benchmarks.includes("QQQ") && (
                                    <p className="text-purple-600 font-medium">나스닥 100: {d.qqq > 0 ? `+${d.qqq}%` : `${d.qqq}%`}</p>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="portfolio" fill="#10b981" radius={[3, 3, 0, 0]} animationDuration={800} />
                        {benchmarks.includes("SPY") && (
                          <Bar dataKey="spy" fill="#64748b" radius={[3, 3, 0, 0]} animationDuration={800} />
                        )}
                        {benchmarks.includes("QQQ") && (
                          <Bar dataKey="qqq" fill="#a855f7" radius={[3, 3, 0, 0]} animationDuration={800} />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs">
                      연도별 데이터가 없습니다.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                <span>하락장(2022년 등)에서의 방어율과 상승장 초과 달성도를 연도별로 비교합니다.</span>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
});

export default BacktestDashboard;
