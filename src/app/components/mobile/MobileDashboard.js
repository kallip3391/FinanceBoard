"use client";

import { useState, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAssets } from "@/contexts/AssetContext";
import { ChevronLeft, ChevronRight, ArrowLeftRight } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const emptySubscribe = () => () => {};

/* ───────── 상수 / 유틸 (웹버전과 100% 동일한 로직) ───────── */
const PIE_COLORS = [
  "#4F46E5","#10B981","#F59E0B","#EF4444",
  "#8B5CF6","#EC4899","#06B6D4","#F97316",
  "#6366F1","#14B8A6","#84CC16","#7C3AED",
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
  const { holdings, summary } = useAssets();
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [currentPage, setCurrentPage] = useState(1);
  const [tableTab, setTableTab] = useState("basic"); // "basic" | "dividend"
  const ITEMS_PER_PAGE = 4;

  const totalPages = Math.ceil((holdings?.length || 0) / ITEMS_PER_PAGE) || 1;
  const pagedHoldings = (holdings || []).slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  /* 파이 차트 데이터 */
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

  return (
    <div style={{ maxWidth: "100vw", overflowX: "hidden" }} className="flex flex-col gap-0 bg-slate-50 min-h-full pb-3">
      <div className="flex flex-col gap-3 px-3 pt-3 pb-1" style={{ maxWidth: "100%" }}>
        {/* ── 섹션 1: 포트폴리오 ── */}
        {user && (holdings?.length || 0) > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ overflow: "hidden" }}>
            {/* 섹션 헤더 */}
            <div className="flex items-center gap-2 px-4 pt-3.5 pb-2 border-b border-slate-50">
              <div className="w-1 h-4 rounded-full bg-emerald-500" />
              <span className="text-sm font-bold text-slate-700">포트폴리오</span>
            </div>

            {/* 차트 + 범례 */}
            <div className="flex items-start px-2 py-3 gap-1">
              {/* 좌: 파이 차트 */}
              <div style={{ width: 130, height: 130, flexShrink: 0 }}>
                {isClient && (
                  <ResponsiveContainer width={130} height={130} minWidth={0}>
                    <PieChart>
                      <Pie
                        data={stockData}
                        cx="50%" cy="50%"
                        innerRadius={0}
                        outerRadius={60}
                        paddingAngle={1}
                        dataKey="value"
                        stroke="none"
                        startAngle={90}
                        endAngle={-270}
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
              <div className="flex-1 grid grid-cols-2 gap-x-2 gap-y-1 content-start pt-1 min-w-0" style={{ maxHeight: 130, overflowY: "auto" }}>
                {stockData.map((item, i) => {
                  const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0";
                  const title = item.name.includes(" (") ? item.name.split(" (")[0] : item.name;
                  return (
                    <div key={i} className="flex items-center justify-between gap-1 min-w-0 py-0.5">
                      {/* 좌측: 컬러점 + 종목명 (길면 말줄임) */}
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <span
                          className="rounded-full shrink-0"
                          style={{ width: 6, height: 6, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="text-[10px] text-slate-700 font-semibold truncate leading-tight">
                          {title}
                        </span>
                      </div>

                      {/* 우측: 비중 % (고정 너비 유지) */}
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

        {/* ── 섹션 2: 종목별 보유현황 ── */}
        {user && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ overflow: "hidden" }}>
            {/* 섹션 헤더 */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-emerald-500" />
                <span className="text-sm font-bold text-slate-700">종목별 보유현황</span>
              </div>

              {/* 미니멀 아웃라인 칩 버튼 */}
              <button
                type="button"
                onClick={() => setTableTab((prev) => (prev === "basic" ? "dividend" : "basic"))}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all duration-150 active:scale-95 cursor-pointer ${
                  tableTab === "dividend"
                    ? "border border-emerald-500/80 bg-emerald-50/70 text-emerald-700 font-bold shadow-2xs"
                    : "border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium shadow-2xs"
                }`}
                aria-label="조회 항목 전환"
              >
                <span>{tableTab === "basic" ? "배당·총손익" : "기본 보기"}</span>
                <ArrowLeftRight
                  size={11}
                  strokeWidth={2}
                  className={`transition-colors ${
                    tableTab === "dividend" ? "text-emerald-600" : "text-slate-400"
                  }`}
                />
              </button>
            </div>

            {/* 요약 카드: 평가액 | 수익금 */}
            {summary.totalEvaluation > 0 && (
              <div className="mx-3 my-3 flex rounded-xl border border-slate-100 shadow-sm" style={{ overflow: "hidden" }}>
                {/* 평가액 */}
                <div className="flex-1 bg-slate-50 px-3 py-3">
                  <p className="text-[11px] text-slate-500 mb-1 font-medium text-left">평가액</p>
                  <p className="text-[18px] font-black text-slate-900 tabular-nums leading-tight text-center">
                    {formatCurrency(summary.totalEvaluation, 'KRW')}
                  </p>
                </div>
                {/* 수익금 */}
                <div className="flex-1 bg-slate-50 px-3 py-3">
                  <div className="flex items-center gap-1.5 mb-1 justify-start">
                    <p className="text-[11px] text-slate-500 font-medium">수익금</p>
                    <span
                      className={`text-[11px] font-bold tabular-nums ${
                        isProfit
                          ? "text-red-600"
                          : isLoss
                          ? "text-blue-600"
                          : "text-slate-500"
                      }`}
                    >
                      ({isProfit ? "+" : ""}
                      {summary.avgProfitRate.toFixed(2)}%)
                    </span>
                  </div>
                  <p
                    className={`text-[18px] font-black tabular-nums leading-tight text-center ${
                      isProfit ? "text-red-600" : isLoss ? "text-blue-600" : "text-slate-900"
                    }`}
                  >
                    {isProfit ? "+" : ""}
                    {formatCurrency(summary.totalProfit, 'KRW')}
                  </p>
                </div>
              </div>
            )}

            {/* ── 보유 종목 테이블 ── */}
            <div className="px-3 pb-2.5">
              <div className="border border-slate-200 rounded-xl" style={{ overflow: "hidden", width: "100%" }}>

                {/* 테이블 헤더 */}
                <div className="bg-slate-50 border-b border-slate-200 flex" style={{ width: "100%" }}>
                  {/* 종목명 열 */}
                  <div style={{ width: 86, flexShrink: 0 }} className="px-2 py-2.5 flex items-center justify-center text-center">
                    <span className="text-[10px] font-semibold text-slate-500">종목명</span>
                  </div>
                  {/* 나머지 3열 헤더 (가운데 정렬, 세로선 없음) */}
                  <div className="flex-1 grid grid-cols-3 min-w-0">
                    {/* 1열: 매수가 / 현재가 */}
                    <div className="px-1 py-1.5 text-center flex flex-col justify-center">
                      <span className="text-[9px] font-semibold text-slate-500 leading-tight block">매수가</span>
                      <span className="text-[9px] text-slate-400 leading-tight block mt-0.5">현재가</span>
                    </div>

                    {tableTab === "basic" ? (
                      <>
                        {/* 2열: 잔고수량 / 평가금액 */}
                        <div className="px-1 py-1.5 text-center flex flex-col justify-center">
                          <span className="text-[9px] font-semibold text-slate-500 leading-tight block">잔고수량</span>
                          <span className="text-[9px] text-slate-400 leading-tight block mt-0.5">평가금액</span>
                        </div>
                        {/* 3열: 평가손익 / 수익률 */}
                        <div className="px-1 py-1.5 text-center flex flex-col justify-center">
                          <span className="text-[9px] font-semibold text-slate-500 leading-tight block">평가손익</span>
                          <span className="text-[9px] text-slate-400 leading-tight block mt-0.5">수익률</span>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* 2열: 배당금(원) */}
                        <div className="px-1 py-1.5 text-center flex items-center justify-center">
                          <span className="text-[9px] font-bold text-emerald-700 leading-tight whitespace-nowrap">
                            배당금(원)
                          </span>
                        </div>
                        {/* 3열: 총손익 / 총수익률 */}
                        <div className="px-1 py-1.5 text-center flex flex-col justify-center">
                          <span className="text-[9px] font-bold text-slate-700 leading-tight block">총손익</span>
                          <span className="text-[9px] text-slate-400 leading-tight block mt-0.5">총수익률</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 로딩 상태 및 빈 상태 */}
                {summary?.isLoading ? (
                  <div className="py-10 flex flex-col items-center justify-center gap-2.5 text-slate-400 text-sm">
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span className="font-medium text-slate-500 text-xs">자산을 불러오고 있습니다...</span>
                  </div>
                ) : (
                  holdings.length === 0 && (
                    <div className="py-8 text-center text-slate-400 text-sm font-medium">
                      보유 중인 종목이 없습니다.
                    </div>
                  )
                )}

                {/* 종목 행 (페이지 이동 시 세련된 스태거 페이드인 애니메이션) */}
                <div key={`stock-page-${currentPage}-${tableTab}`} className="divide-y divide-slate-100">
                  {pagedHoldings.map((h, idx) => {
                    const profitPos = (h.profitAmountKRW || 0) > 0;
                    const profitNeg = (h.profitAmountKRW || 0) < 0;
                    const ratePos = parseFloat(h.returnRate) > 0;
                    const rateNeg = parseFloat(h.returnRate) < 0;

                    const totalProfitKRW = (h.profitAmountKRW || 0) + (h.dividend || 0);
                    const totalProfitPos = totalProfitKRW > 0;
                    const totalProfitNeg = totalProfitKRW < 0;
                    const rawTotalRate = h.totalReturnRate !== undefined
                      ? h.totalReturnRate
                      : (h.totalCostKRW > 0
                        ? (((totalProfitKRW) / h.totalCostKRW) * 100).toFixed(2)
                        : h.returnRate);
                    const totalRatePos = parseFloat(rawTotalRate) > 0;
                    const totalRateNeg = parseFloat(rawTotalRate) < 0;

                    return (
                      <div
                        key={`${currentPage}-${h.code || idx}`}
                        className={`flex items-stretch min-h-[50px] opacity-0 animate-row-fade stagger-${idx + 1}`}
                        style={{ width: "100%" }}
                      >
                        {/* 종목명 (좌측 정렬, 세로선 없음) */}
                        <div style={{ width: 86, flexShrink: 0 }} className="pl-2.5 pr-1 py-1.5 bg-slate-50/40 flex flex-col items-start justify-center text-left">
                          <span className="text-[10px] font-bold text-slate-800 leading-tight line-clamp-2 break-all">
                            {h.name}
                          </span>
                          <span className="text-[8px] text-slate-400 font-mono mt-0.5 truncate leading-tight">
                            {h.code}
                          </span>
                        </div>

                        {/* 우측 3열 (우측 정렬, 세로선 없음) */}
                        <div className="flex-1 grid grid-cols-3 min-w-0">
                          {/* 1열: 매수가 / 현재가 */}
                          <div className="pl-0.5 pr-2.5 py-1.5 text-right flex flex-col justify-center">
                            <span className="text-[11px] font-semibold text-slate-800 tabular-nums leading-tight block">
                              {getCurrencySymbol(h.currency)}{formatCurrency(h.purchasePrice, h.currency)}
                            </span>
                            <span className="text-[9.5px] font-medium text-slate-500 tabular-nums leading-tight block mt-0.5">
                              {h.currentPrice
                                ? `${getCurrencySymbol(h.currency)}${formatCurrency(h.currentPrice, h.currency)}`
                                : "-"}
                            </span>
                          </div>

                          {tableTab === "basic" ? (
                            <>
                              {/* 2열: 잔고수량 / 평가금액 */}
                              <div className="pl-0.5 pr-2.5 py-1.5 text-right flex flex-col justify-center">
                                <span className="text-[11px] font-semibold text-slate-800 tabular-nums leading-tight block">
                                  {formatCurrency(h.totalQuantity, 'QTY')}주
                                </span>
                                <span className="text-[9.5px] font-medium text-slate-500 tabular-nums leading-tight block mt-0.5">
                                  {formatCurrency(h.evaluationAmountKRW, 'KRW')}
                                </span>
                              </div>

                              {/* 3열: 평가손익 / 수익률 */}
                              <div className="pl-0.5 pr-2.5 py-1.5 text-right flex flex-col justify-center">
                                <span
                                  className={`text-[11px] font-bold tabular-nums leading-tight block ${
                                    profitPos ? "text-red-600" : profitNeg ? "text-blue-600" : "text-slate-700"
                                  }`}
                                >
                                  {profitPos ? "+" : ""}
                                  {formatCurrency(h.profitAmountKRW, 'KRW')}
                                </span>
                                <span
                                  className={`text-[9.5px] font-bold tabular-nums leading-tight block mt-0.5 ${
                                    ratePos ? "text-red-500" : rateNeg ? "text-blue-500" : "text-slate-500"
                                  }`}
                                >
                                  {ratePos ? "+" : ""}
                                  {parseFloat(h.returnRate) === 0 ? "0.00" : h.returnRate}%
                                </span>
                              </div>
                            </>
                          ) : (
                            <>
                              {/* 2열 (배당·총손익 탭): 배당금 */}
                              <div className="pl-0.5 pr-2.5 py-1.5 text-right flex items-center justify-end">
                                <span
                                  className={`text-[11px] font-bold tabular-nums leading-tight block ${
                                    (h.dividend || 0) > 0 ? "text-emerald-600" : "text-slate-400"
                                  }`}
                                >
                                  {(h.dividend || 0) > 0 ? `+${formatCurrency(h.dividend, 'KRW')}` : "0"}
                                </span>
                              </div>

                              {/* 3열 (배당·총손익 탭): 총손익 / 총수익률 */}
                              <div className="pl-0.5 pr-2.5 py-1.5 text-right flex flex-col justify-center">
                                <span
                                  className={`text-[11px] font-bold tabular-nums leading-tight block ${
                                    totalProfitPos ? "text-red-600" : totalProfitNeg ? "text-blue-600" : "text-slate-700"
                                  }`}
                                >
                                  {totalProfitPos ? "+" : ""}
                                  {formatCurrency(totalProfitKRW, 'KRW')}
                                </span>
                                <span
                                  className={`text-[9.5px] font-bold tabular-nums leading-tight block mt-0.5 ${
                                    totalRatePos ? "text-red-500" : totalRateNeg ? "text-blue-500" : "text-slate-500"
                                  }`}
                                >
                                  {totalRatePos ? "+" : ""}
                                  {parseFloat(rawTotalRate) === 0 ? "0.00" : rawTotalRate}%
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* 페이지네이션 (웹버전 스타일 - 가운데 정렬, 컴팩트 여백) */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2 pb-0.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
                      currentPage === 1
                        ? "text-slate-200 cursor-not-allowed"
                        : "text-slate-500 hover:bg-slate-100 active:scale-95 cursor-pointer"
                    }`}
                    aria-label="이전 페이지"
                  >
                    <ChevronLeft size={16} strokeWidth={2.5} />
                  </button>

                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <span className="text-emerald-600 font-black">{currentPage}</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-slate-400">{totalPages}</span>
                  </div>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
                      currentPage === totalPages
                        ? "text-slate-200 cursor-not-allowed"
                        : "text-slate-500 hover:bg-slate-100 active:scale-95 cursor-pointer"
                    }`}
                    aria-label="다음 페이지"
                  >
                    <ChevronRight size={16} strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 비로그인 안내 */}
        {!user && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-5 rounded-2xl text-sm text-center font-medium mt-2">
            로그인 후 보유 자산을 확인할 수 있습니다.
          </div>
        )}

      </div>
    </div>
  );
}
