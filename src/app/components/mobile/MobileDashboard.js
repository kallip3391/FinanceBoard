"use client";

import { useState, useMemo, useRef, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAssets } from "@/contexts/AssetContext";
import {
  LayoutDashboard,
  Briefcase,
  Landmark,
  Layers,
  Coins,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { useAnimatedModal } from "@/hooks/useAnimatedModal";

const emptySubscribe = () => () => {};

/* ───────── 상수 / 유틸 (웹버전과 100% 동일한 로직) ───────── */
const PIE_COLORS = [
  "#4F46E5", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#06B6D4", "#F97316",
  "#6366F1", "#14B8A6", "#84CC16", "#7C3AED",
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

// 종목코드 포맷 (숫자 코드는 6자리 0 패딩 보정)
const formatStockCode = (code) => {
  if (!code) return "";
  const str = String(code).trim();
  if (/^\d+$/.test(str)) {
    return str.padStart(6, "0");
  }
  return str;
};

/* ───────── 토스 로고 컴포넌트 (테두리 없는 모던 라운드 룩) ───────── */
function StockLogo({ code, name, isKRW }) {
  const [hasError, setHasError] = useState(false);
  const cleanCode = (code || '').replace(/\.(KS|KQ|US|kospi|kosdaq)$/i, '').trim();
  const logoUrl = cleanCode ? `https://static.toss.im/png-icons/securities/icn-sec-fill-${cleanCode}.png` : null;

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

/* ───────── 파이 툴팁 ───────── */
function PieTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const title = d.name.includes(" (") ? d.name.split(" (")[0] : d.name;
  const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-md text-[11px]">
      <p className="font-bold text-slate-800">{title}</p>
      <p className="font-black text-emerald-600">{pct}%</p>
      <p className="text-slate-500">{formatCurrency(d.value, 'KRW')}원</p>
    </div>
  );
}

/* ───────── 메인 컴포넌트 ───────── */
export default function MobileDashboard() {
  const { user } = useAuth();
  const { holdings = [], summary = {} } = useAssets();
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // 보유종목 바텀시트 모달 상태
  const [isHoldingsModalOpen, setIsHoldingsModalOpen] = useState(false);
  const { mounted: isHoldingsMounted, isClosing: isHoldingsClosing } = useAnimatedModal(isHoldingsModalOpen);
  // 아코디언 펼침 상태 관리 (종목코드별 토글)
  const [expandedCodes, setExpandedCodes] = useState({});

  const handleOpenHoldingsModal = () => {
    setExpandedCodes({});
    setIsHoldingsModalOpen(true);
  };

  const handleCloseHoldingsModal = () => {
    setIsHoldingsModalOpen(false);
    setExpandedCodes({});
  };

  const toggleExpand = (code) => {
    setExpandedCodes((prev) => ({
      ...prev,
      [code]: !prev[code]
    }));
  };

  // 모달 상단바 드래그(쓸어내려 닫기) 핸들러
  const touchStartYRef = useRef(null);
  const handleHeaderTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartYRef.current = e.touches[0].clientY;
    }
  };
  const handleHeaderTouchEnd = (e) => {
    if (touchStartYRef.current === null) return;
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const touchEndY = e.changedTouches[0].clientY;
    const diffY = touchEndY - touchStartYRef.current;
    touchStartYRef.current = null;
    // 아래로 40px 이상 쓸어내렸을 때 닫기
    if (diffY > 40) {
      handleCloseHoldingsModal();
    }
  };

  /* 파이 차트 데이터 가공 */
  const stockDataRaw = useMemo(() => {
    return (holdings || [])
      .reduce((acc, h) => {
        const name = h.code ? `${h.name} (${h.code})` : (h.name || "알수없음");
        const amt = h.evaluationAmountKRW || 0;
        if (amt <= 0) return acc;
        const idx = acc.findIndex((x) => x.name === name);
        if (idx > -1) { acc[idx].value += amt; return acc; }
        return [...acc, { name, value: amt, code: h.code, currency: h.currency }];
      }, [])
      .sort((a, b) => b.value - a.value);
  }, [holdings]);

  const stockData =
    stockDataRaw.length > 10
      ? [
          ...stockDataRaw.slice(0, 10),
          {
            name: "기타",
            value: stockDataRaw.slice(10).reduce((s, x) => s + x.value, 0),
          },
        ]
      : stockDataRaw;

  const total = stockData.reduce((s, x) => s + x.value, 0);
  const isProfit = (summary?.totalProfit || 0) > 0;
  const isLoss = (summary?.totalProfit || 0) < 0;

  const totalDividendKRW = summary?.totalDividend || 0;
  const totalProfitWithDividend = (summary?.totalProfit || 0) + totalDividendKRW;
  const isTotalProfit = totalProfitWithDividend > 0;
  const isTotalLoss = totalProfitWithDividend < 0;

  const totalReturnRateVal = summary?.avgTotalReturn !== undefined
    ? Number(summary.avgTotalReturn)
    : ((summary?.totalEvaluation - summary?.totalProfit) > 0
      ? ((totalProfitWithDividend) / (summary.totalEvaluation - summary.totalProfit)) * 100
      : Number(summary?.avgProfitRate || 0));

  const isTotalRateProfit = totalReturnRateVal > 0;
  const isTotalRateLoss = totalReturnRateVal < 0;

  return (
    <div style={{ maxWidth: "100vw", overflowX: "hidden" }} className="flex flex-col gap-0 bg-slate-50 pb-1">
      <div className="flex flex-col gap-3 px-3 pt-3 pb-1" style={{ maxWidth: "100%" }}>

        {/* 비로그인 안내 */}
        {!user && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-5 rounded-2xl text-sm text-center font-medium mt-2">
            로그인 후 보유 자산을 확인할 수 있습니다.
          </div>
        )}

        {/* ── 1. 최상단 헤더 카드 (로그인 시에만 표시) ── */}
        {user && (
          <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/60 shadow-xs">
                <LayoutDashboard size={18} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-slate-800 tracking-tight leading-tight">
                  대시보드
                </h1>
                <span className="text-[11px] font-semibold text-slate-400">
                  자산 구성 및 보유 현황
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 로그인 후 자산 로딩 상태 */}
        {user && summary?.isLoading && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 flex flex-col items-center justify-center gap-3 animate-fade-in">
            <div className="relative flex items-center justify-center">
              <div className="w-10 h-10 border-3 border-emerald-500/20 rounded-full" />
              <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin absolute" />
            </div>
            <div className="text-center">
              <span className="font-bold text-slate-800 text-sm block">자산 데이터를 분석하고 있습니다</span>
              <span className="text-xs text-slate-400 mt-1 block">실시간 시세 및 보유 내역 동기화 중...</span>
            </div>
          </div>
        )}

        {/* ── 2. 포트폴리오 비중 차트 카드 (거래내역 상단과 동일한 animate-fade-in 효과) ── */}
        {user && !summary?.isLoading && (holdings?.length || 0) > 0 && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-3.5 sm:p-4 flex flex-col gap-2 animate-fade-in">
            {/* 섹션 서브헤더 */}
            <div className="flex items-center gap-2 pb-1">
              <div className="w-1.5 h-4.5 rounded-full bg-emerald-600" />
              <span className="text-[14.5px] font-black text-slate-800 leading-none tracking-tight">
                자산 구성 비중
              </span>
            </div>

            {/* 차트 + 범례 */}
            <div className="flex items-center px-1 py-1 gap-2">
              {/* 좌: 파이 차트 */}
              <div style={{ width: 130, height: 130, flexShrink: 0 }}>
                {isClient && (
                  <ResponsiveContainer width={130} height={130} minWidth={0}>
                    <PieChart>
                      <Pie
                        data={stockData}
                        cx="50%" cy="50%"
                        innerRadius={36}
                        outerRadius={60}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                        startAngle={90}
                        endAngle={-270}
                        isAnimationActive={true}
                        animationDuration={900}
                        animationEasing="ease-out"
                      >
                        {stockData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip total={total} />} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* 우: 범례 2열 (좌측: 종목명, 우측: 비중) */}
              <div className="flex-1 grid grid-cols-2 gap-x-2 gap-y-1 content-start min-w-0" style={{ maxHeight: 130, overflowY: "auto" }}>
                {stockData.map((item, i) => {
                  const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0";
                  const title = item.name.includes(" (") ? item.name.split(" (")[0] : item.name;
                  return (
                    <div key={i} className="flex items-center justify-between gap-1 min-w-0 py-0.5">
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <span
                          className="rounded-full shrink-0"
                          style={{ width: 6, height: 6, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="text-[10px] text-slate-700 font-semibold truncate leading-tight">
                          {title}
                        </span>
                      </div>
                      <span
                        className="text-[10px] font-black leading-tight shrink-0 tabular-nums ml-1"
                        style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}
                      >
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── 3. 하단 2x2 그리드 영역 (배당금현황 월별 카드와 동일한 animate-page-slide & 35ms 딜레이 효과 적용) ── */}
        {user && !summary?.isLoading && (
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {/* [1번째 칸] 보유종목 (활성화 카드 -> 탭 시 바텀시트 모달) */}
            <div
              onClick={handleOpenHoldingsModal}
              style={{
                animationDelay: '0ms',
                animationFillMode: 'forwards',
              }}
              className="bg-white rounded-2xl p-3.5 border border-emerald-200/90 hover:border-emerald-400 bg-gradient-to-br from-white via-white to-emerald-50/25 shadow-xs active:scale-[0.98] transition-all duration-200 cursor-pointer flex flex-col justify-between opacity-0 animate-page-slide"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
                    <Briefcase size={16} strokeWidth={2.5} />
                  </div>
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100/80 text-emerald-700">
                    {holdings.length}종목
                  </span>
                </div>

                {/* 보유종목 명칭 (좌) & 금액 + 손익률 (우) */}
                <div className="flex items-start justify-between gap-1 mt-1">
                  <div>
                    <h3 className="text-[14px] font-black text-slate-800 tracking-tight leading-tight">
                      보유종목
                    </h3>
                    <p className="text-[10.5px] font-medium text-slate-400 mt-0.5 leading-tight">
                      상세 현황
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end shrink-0">
                    <span className="text-[12px] font-black text-slate-900 tabular-nums leading-tight">
                      {formatCurrency(summary.totalEvaluation, 'KRW')}<span className="text-[10px] font-bold ml-0.5">원</span>
                    </span>
                    <span className={`text-[10.5px] font-bold tabular-nums mt-0.5 leading-tight ${isProfit ? 'text-red-600' : isLoss ? 'text-blue-600' : 'text-slate-500'}`}>
                      {isProfit ? '+' : ''}{summary.avgProfitRate.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10.5px] text-emerald-600 font-semibold">상세 내역 확인</span>
                <ChevronRight size={14} className="text-emerald-500" />
              </div>
            </div>

            {/* [2번째 칸] 계좌별 현황 (향후 추가 영역) */}
            <div
              style={{
                animationDelay: '35ms',
                animationFillMode: 'forwards',
              }}
              className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-2xs flex flex-col justify-between opacity-80 opacity-0 animate-page-slide transition-all duration-200"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/80 shadow-2xs">
                    <Landmark size={16} strokeWidth={2.5} />
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">
                    준비중
                  </span>
                </div>
                <h3 className="text-[14px] font-bold text-slate-700 tracking-tight">계좌별 현황</h3>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">자산 분배</p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10.5px] text-slate-400 font-medium">연동 계좌 관리</span>
                <ChevronRight size={14} className="text-slate-300" />
              </div>
            </div>

            {/* [3번째 칸] 섹터 분석 (향후 추가 영역) */}
            <div
              style={{
                animationDelay: '70ms',
                animationFillMode: 'forwards',
              }}
              className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-2xs flex flex-col justify-between opacity-80 opacity-0 animate-page-slide transition-all duration-200"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100/80 shadow-2xs">
                    <Layers size={16} strokeWidth={2.5} />
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">
                    준비중
                  </span>
                </div>
                <h3 className="text-[14px] font-bold text-slate-700 tracking-tight">섹터 분석</h3>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">업종별 비중</p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10.5px] text-slate-400 font-medium">섹터별 분산도</span>
                <ChevronRight size={14} className="text-slate-300" />
              </div>
            </div>

            {/* [4번째 칸] 배당 요약 (향후 추가 영역) */}
            <div
              style={{
                animationDelay: '105ms',
                animationFillMode: 'forwards',
              }}
              className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-2xs flex flex-col justify-between opacity-80 opacity-0 animate-page-slide transition-all duration-200"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100/80 shadow-2xs">
                    <Coins size={16} strokeWidth={2.5} />
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">
                    준비중
                  </span>
                </div>
                <h3 className="text-[14px] font-bold text-slate-700 tracking-tight">배당 요약</h3>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">수익 결산</p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10.5px] text-slate-400 font-medium">배당 수익 결산</span>
                <ChevronRight size={14} className="text-slate-300" />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── 4. 보유종목 바텀시트 모달 (아코디언 11개 항목 + 상단바 탭/드래그 닫기) ── */}
      {isHoldingsMounted && (
        <div
          className={`fixed inset-0 z-[100] bg-black/50 backdrop-blur-xs flex flex-col justify-end transition-opacity ${
            isHoldingsClosing ? 'animate-fade-out' : 'animate-fade-in'
          }`}
          onClick={handleCloseHoldingsModal}
        >
          <div
            className={`bg-white rounded-t-3xl p-4 sm:p-5 shadow-2xl border-t border-slate-100 max-h-[85vh] flex flex-col ${
              isHoldingsClosing ? 'animate-sheet-down' : 'animate-sheet-up'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 드래그 핸들 바 (탭하거나 아래로 쓸어내려 닫기) */}
            <div
              onClick={handleCloseHoldingsModal}
              onTouchStart={handleHeaderTouchStart}
              onTouchEnd={handleHeaderTouchEnd}
              className="w-full py-1.5 flex flex-col items-center justify-center cursor-pointer active:opacity-60 transition-opacity shrink-0"
              title="상단바를 누르거나 아래로 밀어서 닫기"
            >
              <div className="w-12 h-1.5 bg-slate-300 rounded-full hover:bg-slate-400 transition-colors" />
            </div>

            {/* 바텀시트 헤더 */}
            <div className="flex justify-between items-center mb-3 pb-2.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs shrink-0">
                  <Briefcase size={15} strokeWidth={2.5} />
                </div>
                <h3 className="text-base font-black text-slate-800 tracking-tight">
                  보유종목 현황
                </h3>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  총 {holdings.length}개 종목
                </span>
              </div>
              <button
                onClick={handleCloseHoldingsModal}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="닫기"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* 상단 요약 배너 (라벨: 좌측 정렬 / 금액: 각 컬럼 내 우측 정렬 - 사용자 시안 100% 일치) */}
            <div className="bg-gradient-to-r from-slate-50 via-emerald-50/15 to-emerald-50/35 rounded-2xl p-3.5 border border-slate-100 mb-3 shrink-0 shadow-2xs">
              <div className="grid grid-cols-2 gap-3">
                {/* 좌측: 평가액 / 손익(수익률) */}
                <div className="flex flex-col justify-between">
                  <div>
                    <p className="text-[10.5px] font-bold text-slate-400 text-left leading-tight">평가액</p>
                    <p className="text-[16px] font-black text-slate-900 tracking-tight text-right mt-0.5 tabular-nums leading-tight">
                      {formatCurrency(summary.totalEvaluation, 'KRW')}<span className="text-[11px] font-bold ml-0.5">원</span>
                    </p>
                  </div>
                  <div className="mt-2.5">
                    <p className="text-[10.5px] font-bold text-slate-400 text-left leading-tight">손익</p>
                    <div className="flex flex-col items-end mt-0.5">
                      <span className={`text-[14px] font-black tabular-nums leading-tight ${isProfit ? 'text-red-600' : isLoss ? 'text-blue-600' : 'text-slate-700'}`}>
                        {isProfit ? '+' : ''}{formatCurrency(summary.totalProfit, 'KRW')}<span className="text-[10px] font-bold ml-0.5">원</span>
                      </span>
                      <span className={`text-[10px] font-bold tabular-nums mt-0.5 leading-tight ${isProfit ? 'text-red-600' : isLoss ? 'text-blue-600' : 'text-slate-500'}`}>
                        ({isProfit ? '+' : ''}{(summary.avgProfitRate || 0).toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* 우측: 배당금 / 총손익(총수익률) */}
                <div className="flex flex-col justify-between">
                  <div>
                    <p className="text-[10.5px] font-bold text-slate-400 text-left leading-tight">배당금</p>
                    <p className={`text-[16px] font-black tracking-tight text-right mt-0.5 tabular-nums leading-tight ${totalDividendKRW > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {totalDividendKRW > 0 ? `+${formatCurrency(totalDividendKRW, 'KRW')}` : '0'}<span className="text-[11px] font-bold ml-0.5">원</span>
                    </p>
                  </div>
                  <div className="mt-2.5">
                    <p className="text-[10.5px] font-bold text-slate-400 text-left leading-tight">총손익</p>
                    <div className="flex flex-col items-end mt-0.5">
                      <span className={`text-[14px] font-black tabular-nums leading-tight ${isTotalProfit ? 'text-red-600' : isTotalLoss ? 'text-blue-600' : 'text-slate-700'}`}>
                        {isTotalProfit ? '+' : ''}{formatCurrency(totalProfitWithDividend, 'KRW')}<span className="text-[10px] font-bold ml-0.5">원</span>
                      </span>
                      <span className={`text-[10px] font-bold tabular-nums mt-0.5 leading-tight ${isTotalRateProfit ? 'text-red-600' : isTotalRateLoss ? 'text-blue-600' : 'text-slate-500'}`}>
                        ({isTotalRateProfit ? '+' : ''}{totalReturnRateVal.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 종목별 아코디언 카드 리스트 (스크롤 가능 - 하단 여백 추가로 마지막 종목 잘림 방지) */}
            <div className="overflow-y-auto space-y-2.5 pr-1 pb-10 flex-1">
              {holdings.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                  보유 중인 종목이 없습니다.
                </div>
              ) : (
                holdings.map((h, idx) => {
                  const itemKey = h.id ? `holding-${h.id}` : `${h.code || 'stock'}-${h.account_id || idx}`;
                  const isKRW = !h.currency || h.currency === 'KRW';
                  const isExpanded = !!expandedCodes[itemKey];

                  const profitPos = (h.profitAmountKRW || 0) > 0;
                  const profitNeg = (h.profitAmountKRW || 0) < 0;
                  const returnRateVal = parseFloat(h.returnRate);
                  const formattedReturnRate = !isNaN(returnRateVal) ? returnRateVal.toFixed(2) : "0.00";
                  const ratePos = returnRateVal > 0;

                  const totalProfitKRW = (h.profitAmountKRW || 0) + (h.dividend || 0);
                  const totalProfitPos = totalProfitKRW > 0;
                  const totalProfitNeg = totalProfitKRW < 0;

                  const totalRateRaw = h.totalReturnRate !== undefined
                    ? h.totalReturnRate
                    : (h.totalCostKRW > 0
                      ? (((totalProfitKRW) / h.totalCostKRW) * 100)
                      : returnRateVal);
                  const totalRateNum = parseFloat(totalRateRaw);
                  const formattedTotalRate = !isNaN(totalRateNum) ? totalRateNum.toFixed(2) : "0.00";
                  const totalRatePos = totalRateNum > 0;
                  const totalRateNeg = totalRateNum < 0;

                  return (
                    <div
                      key={itemKey}
                      className={`p-3 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-colors shadow-2xs opacity-0 animate-feed-lift stagger-${(idx % 12) + 1}`}
                    >
                      {/* 카드 1행 (클릭 시 아코디언 펼치기/접기) */}
                      <div
                        onClick={() => toggleExpand(itemKey)}
                        className="flex items-center gap-2.5 cursor-pointer select-none"
                      >
                        {/* 좌측: 로고 */}
                        <StockLogo code={h.code} name={h.name} isKRW={isKRW} />

                        {/* 우측: 2행 구성 (1행: 종목명 & 금액, 2행: 코드/구분/수량 & 손익) */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          {/* 1행: 종목명 (좌) & 평가금액 (우) */}
                          <div className="flex justify-between items-center leading-tight gap-1.5">
                            <p className="text-[13px] font-bold text-slate-900 truncate pr-1">
                              {h.name}
                            </p>
                            <span className="text-[13px] font-black text-slate-900 tabular-nums shrink-0 whitespace-nowrap">
                              {formatCurrency(h.evaluationAmountKRW, 'KRW')}<span className="text-[10px] font-bold ml-0.5">원</span>
                            </span>
                          </div>

                          {/* 2행: 종목코드+구분+수량 (좌) & 손익 (우) */}
                          <div className="flex justify-between items-center mt-1 text-[11px] leading-tight gap-1.5">
                            <div className="flex items-center gap-0 shrink-0 text-slate-400 font-medium">
                              {/* 1. 종목코드 (8자리 고정폭) */}
                              <span className="font-mono text-slate-400 w-[54px] shrink-0 truncate">
                                {formatStockCode(h.code)}
                              </span>

                              {/* 2. 구분 (국내/해외 배지) */}
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 text-center ${
                                  isKRW
                                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {isKRW ? '국내' : '해외'}
                              </span>

                              {/* 3. 수량 (거래내역과 동일하게 고정폭 및 우측 정렬) */}
                              <span className="w-[44px] text-right text-slate-700 font-semibold tabular-nums truncate ml-2">
                                {formatCurrency(h.totalQuantity, 'QTY')}주
                              </span>
                            </div>

                            {/* 우: 손익 & 수익률 */}
                            <span className={`text-[11px] font-bold tabular-nums shrink-0 text-right whitespace-nowrap ${profitPos ? 'text-red-600' : profitNeg ? 'text-blue-600' : 'text-slate-500'}`}>
                              <span className="hide-under-420 max-[420px]:hidden">{profitPos ? '+' : ''}{formatCurrency(h.profitAmountKRW, 'KRW')}<span className="text-[9.5px] font-bold ml-0.5">원</span> </span>({ratePos ? '+' : ''}{formattedReturnRate}%)
                            </span>
                          </div>
                        </div>

                        {/* 우측 끝: 아코디언 토글 화살표 */}
                        <div className="p-0.5 text-slate-400 shrink-0">
                          {isExpanded ? (
                            <ChevronUp size={16} strokeWidth={2.5} />
                          ) : (
                            <ChevronDown size={16} strokeWidth={2.5} />
                          )}
                        </div>
                      </div>

                      {/* 세부 항목 펼침 영역 (4열 가로 그리드 배치 - 사용자 제공 시안과 100% 일치) */}
                      {isExpanded && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 animate-fade-in">
                          <div className="bg-white rounded-xl border border-slate-100/90 px-1 py-2.5 shadow-2xs grid grid-cols-4 gap-1 text-center items-start">
                            {/* 1열: 매수가 */}
                            <div className="flex flex-col items-center justify-start min-w-0">
                              <span className="text-[10px] text-slate-400 font-medium leading-tight">매수가</span>
                              <span className="text-[11px] font-bold text-slate-800 tabular-nums mt-1 whitespace-nowrap leading-tight">
                                {isKRW ? (
                                  <>
                                    {formatCurrency(h.purchasePrice, 'KRW')}
                                    <span className="text-[9.5px] font-bold ml-0.5">원</span>
                                  </>
                                ) : (
                                  `${getCurrencySymbol(h.currency)}${formatCurrency(h.purchasePrice, h.currency)}`
                                )}
                              </span>
                            </div>

                            {/* 2열: 현재가 */}
                            <div className="flex flex-col items-center justify-start min-w-0">
                              <span className="text-[10px] text-slate-400 font-medium leading-tight">현재가</span>
                              <span className="text-[11px] font-bold text-slate-800 tabular-nums mt-1 whitespace-nowrap leading-tight">
                                {isKRW ? (
                                  <>
                                    {formatCurrency(h.currentPrice, 'KRW')}
                                    <span className="text-[9.5px] font-bold ml-0.5">원</span>
                                  </>
                                ) : (
                                  `${getCurrencySymbol(h.currency)}${formatCurrency(h.currentPrice, h.currency)}`
                                )}
                              </span>
                            </div>

                            {/* 3열: 배당금 */}
                            <div className="flex flex-col items-center justify-start min-w-0">
                              <span className="text-[10px] text-slate-400 font-medium leading-tight">배당금</span>
                              <span className={`text-[11px] font-bold tabular-nums mt-1 whitespace-nowrap leading-tight ${(h.dividend || 0) > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                {(h.dividend || 0) > 0 ? `+${formatCurrency(h.dividend, 'KRW')}` : '0'}<span className="text-[9.5px] font-bold ml-0.5">원</span>
                              </span>
                            </div>

                            {/* 4열: 총손익 */}
                            <div className="flex flex-col items-center justify-start min-w-0">
                              <span className="text-[10px] text-slate-400 font-medium leading-tight">총손익</span>
                              <div className="flex flex-col items-end mt-1">
                                <span className={`text-[11px] font-bold tabular-nums whitespace-nowrap leading-tight ${totalProfitPos ? 'text-red-600' : totalProfitNeg ? 'text-blue-600' : 'text-slate-700'}`}>
                                  {totalProfitPos ? '+' : ''}{formatCurrency(totalProfitKRW, 'KRW')}<span className="text-[9.5px] font-bold ml-0.5">원</span>
                                </span>
                                <span className={`text-[10px] font-bold tabular-nums mt-0.5 leading-tight whitespace-nowrap ${totalRatePos ? 'text-red-600' : totalRateNeg ? 'text-blue-600' : 'text-slate-700'}`}>
                                  ({totalRatePos ? '+' : ''}{formattedTotalRate}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
