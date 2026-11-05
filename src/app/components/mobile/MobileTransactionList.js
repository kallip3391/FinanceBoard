"use client";

import Link from "next/link";
import {
  Filter,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowLeftRight,
  Globe,
  Coins,
} from "lucide-react";

const TABS = [
  { key: "trading", label: "국내", href: "/transactions/trading" },
  { key: "overseas", label: "해외", href: "/transactions/overseas" },
  { key: "dividends", label: "배당", href: "/transactions/dividends" },
];

export default function MobileTransactionList({
  type = "trading", // "trading" | "overseas" | "dividends"
  transactions = [],
  loading = false,
  user = null,
  currentPage = 1,
  setCurrentPage,
  onOpenFilter,
  onOpenRegister,
  isFilterActive = false,
  onResetFilter,
  onEdit,
}) {
  const ITEMS_PER_PAGE = 8;

  const displayTotalCount = transactions ? transactions.length : 0;
  const displayTotalPages = Math.ceil(displayTotalCount / ITEMS_PER_PAGE) || 1;
  const displayList = (transactions || []).slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // 상단 탭 네비게이션 제어 (< 국내 >)
  const currentIndex = Math.max(0, TABS.findIndex((t) => t.key === type));
  const currentTab = TABS[currentIndex] || TABS[0];
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < TABS.length - 1;

  // 날짜 포맷 (YY.MM.DD)
  const formatShortDate = (dateStr) => {
    if (!dateStr) return "-";
    const cleaned = dateStr.replace(/-/g, ".").replace(/\//g, ".");
    return cleaned.length >= 8 && cleaned.startsWith("20") ? cleaned.slice(2) : cleaned;
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

  // 통화 기호 매핑
  const getCurrencySymbol = (currency) => {
    const symbolMap = {
      KRW: "₩",
      USD: "$",
      EUR: "€",
      JPY: "¥",
      CNY: "¥",
      GBP: "£",
      HKD: "HK$",
    };
    return symbolMap[currency] || (currency ? `${currency} ` : "$ ");
  };

  // 단가(금액) 포맷
  // 국내: 원단위 소수점 없음 (예: 74,200원)
  // 해외: 해당 통화 기호 + 소수점 2자리 (예: $ 150.25)
  const formatPrice = (price, currency) => {
    if (price === null || price === undefined || price === "") return "-";
    const num = typeof price === "number" ? price : parseFloat(price);
    if (isNaN(num)) return price;

    const isKRW = !currency || currency === "KRW";
    if (isKRW) {
      return `${Math.round(num).toLocaleString("ko-KR")}원`;
    }
    const sym = getCurrencySymbol(currency);
    return `${sym} ${num.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // 총금액 포맷
  // 국내: 원단위 소수점 없음 (예: 742,000원)
  // 해외: 해당 통화 기호 + 소수점 2자리 (예: $ 1,502.50)
  const formatTotalAmount = (amount, quantity, price, currency) => {
    let num = typeof amount === "number" ? amount : parseFloat(amount);
    if (isNaN(num)) {
      const q = typeof quantity === "number" ? quantity : parseFloat(quantity);
      const p = typeof price === "number" ? price : parseFloat(price);
      if (!isNaN(q) && !isNaN(p)) {
        num = q * p;
      }
    }
    if (isNaN(num)) return "-";

    const isKRW = !currency || currency === "KRW";
    if (isKRW) {
      return `${Math.round(num).toLocaleString("ko-KR")}원`;
    }
    const sym = getCurrencySymbol(currency);
    return `${sym} ${num.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div style={{ maxWidth: "100vw", overflowX: "hidden" }} className="flex flex-col gap-0 bg-slate-50 pb-1">
      <div className="flex flex-col gap-3 px-3 pt-3 pb-1" style={{ maxWidth: "100%" }}>

        {/* 비로그인 안내 (대시보드와 동일한 단일 박스) */}
        {!user && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-5 rounded-2xl text-sm text-center font-medium mt-2">
            로그인 후 보유 자산을 확인할 수 있습니다.
          </div>
        )}

        {user && (
          <>
            {/* ── 1. 상단 헤더 & 탭 이동 바 (배당금 현황과 동일한 디자인 룩) ── */}
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm animate-fade-in">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 flex items-center justify-center rounded-xl border shadow-xs ${
                    type === "trading"
                      ? "bg-blue-50 text-blue-600 border-blue-100/70"
                      : type === "overseas"
                      ? "bg-emerald-50 text-emerald-600 border-emerald-100/70"
                      : "bg-indigo-50 text-indigo-600 border-indigo-100/70"
                  }`}
                >
                  {type === "trading" && <ArrowLeftRight size={18} strokeWidth={2.5} />}
                  {type === "overseas" && <Globe size={18} strokeWidth={2.5} />}
                  {type === "dividends" && <Coins size={18} strokeWidth={2.5} />}
                </div>
                <div>
                  <h1 className="text-base font-extrabold text-slate-800 tracking-tight leading-tight">
                    거래 내역
                  </h1>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {type === "trading"
                      ? "국내 주식 매매 내역"
                      : type === "overseas"
                      ? "해외 주식 매매 내역"
                      : "배당금 입금 내역"}
                  </span>
                </div>
              </div>

              {/* 우측: < 국내 > 화살표로 국내 <-> 해외 <-> 배당 이동 */}
              <div className="flex items-center gap-1">
                {canGoPrev ? (
                  <Link
                    href={TABS[currentIndex - 1].href}
                    className="p-1 text-slate-600 hover:text-slate-900 active:scale-90 transition-all cursor-pointer"
                    aria-label="이전 탭"
                  >
                    <ChevronLeft size={18} strokeWidth={2.5} />
                  </Link>
                ) : (
                  <button
                    disabled
                    className="p-1 text-slate-200 cursor-not-allowed"
                    aria-label="이전 탭 없음"
                  >
                    <ChevronLeft size={18} strokeWidth={2.5} />
                  </button>
                )}

                <span className="text-[15px] font-black text-slate-800 tracking-tight min-w-[44px] text-center select-none">
                  {currentTab.label}
                </span>

                {canGoNext ? (
                  <Link
                    href={TABS[currentIndex + 1].href}
                    className="p-1 text-slate-600 hover:text-slate-900 active:scale-90 transition-all cursor-pointer"
                    aria-label="다음 탭"
                  >
                    <ChevronRight size={18} strokeWidth={2.5} />
                  </Link>
                ) : (
                  <button
                    disabled
                    className="p-1 text-slate-200 cursor-not-allowed"
                    aria-label="다음 탭 없음"
                  >
                    <ChevronRight size={18} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>

            {/* ── 2. 서브 바: 건수 표시 및 [초기화] [필터] [등록] 버튼 ── */}
            <div className="flex items-center justify-between px-1 pt-1 pb-1">
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-1.5 h-3.5 rounded-full ${
                    type === "trading"
                      ? "bg-blue-600"
                      : type === "overseas"
                      ? "bg-emerald-600"
                      : "bg-indigo-600"
                  }`}
                />
                <span className="text-xs font-black text-slate-800">
                  {type === "trading"
                    ? "국내 거래내역"
                    : type === "overseas"
                    ? "해외 거래내역"
                    : "배당금 입금내역"}
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  총 <span className="font-extrabold text-slate-700">{displayTotalCount}</span>건
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {isFilterActive && onResetFilter && (
                  <button
                    type="button"
                    onClick={onResetFilter}
                    className="h-8 w-8 inline-flex items-center justify-center bg-white text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 shadow-2xs active:scale-95 transition-all cursor-pointer"
                    title="필터 초기화"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenFilter}
                  className={`h-8 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer ${
                    isFilterActive
                      ? "bg-indigo-600 text-white border border-indigo-600 shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-2xs"
                  }`}
                >
                  <Filter size={13} strokeWidth={2.2} />
                  <span>필터</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenRegister}
                  className={`h-8 px-2.5 inline-flex items-center justify-center gap-1 rounded-xl text-xs font-black text-white shadow-sm active:scale-95 transition-all cursor-pointer ${
                    type === "trading"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : type === "overseas"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  <span>등록</span>
                </button>
              </div>
            </div>

            {/* ── 3. 피드형 거래내역 목록 (타입 A 모던 뱅킹 피드형) ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-slate-400 text-sm">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="font-bold text-slate-600 text-xs">거래내역을 불러오는 중...</span>
                  <span className="text-[11px] text-slate-400">잠시만 기다려주세요</span>
                </div>
              ) : displayList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                  {user ? "등록된 거래내역이 없습니다." : "로그인 후 거래내역을 확인할 수 있습니다."}
                </div>
              ) : (
                <div key={`tx-page-${currentPage}`} className="divide-y divide-slate-100">
                  {displayList.map((tx, idx) => {
                    const isBuy = tx.trade_type === "BUY" || tx.type === "매수";
                    const stockName = tx.security?.name || tx.stock_name || tx.stock || "-";
                    const rawCode = tx.security?.code || tx.stock_code || tx.stockCode || "";
                    const stockCode = formatStockCode(rawCode);
                    const currency = tx.currency || (type === "overseas" ? "USD" : "KRW");
                    const isKRW = currency === "KRW";

                    // 수량 포맷
                    const qtyNum = typeof tx.quantity === "number" ? tx.quantity : parseFloat(tx.quantity);
                    const formattedQuantity = !isNaN(qtyNum) ? qtyNum.toLocaleString("ko-KR") : (tx.quantity || "-");

                    // 단가 포맷 (국내: 원단위 소수점 없음, 해외: 해당 통화 기호 + 소수점 2자리)
                    const formattedPrice = formatPrice(tx.price, currency);

                    // 총금액 포맷 (2줄 수직 중앙 배치)
                    const formattedTotalAmount = formatTotalAmount(tx.amount, tx.quantity, tx.price, currency);

                    // 배당 탭인 경우 전용 카드 포맷
                    if (type === "dividends") {
                      // 외화 배당 단가 (주당 한글명 및 '-' 표시 제거)
                      const hasDivAmount =
                        tx.dividend_amount !== null &&
                        tx.dividend_amount !== undefined &&
                        tx.dividend_amount !== "" &&
                        tx.dividend_amount !== "-";
                      const divAmountFormatted = hasDivAmount ? formatPrice(tx.dividend_amount, currency) : "";
                      const cleanDivAmount = divAmountFormatted === "-" ? "" : divAmountFormatted;

                      const totalDivKRW =
                        typeof tx.total_dividend === "number"
                          ? `${Math.round(tx.total_dividend).toLocaleString("ko-KR")}원`
                          : (tx.total_dividend && tx.total_dividend !== "-" ? `${tx.total_dividend}` : "");

                      return (
                        <div
                          key={tx.id || idx}
                          onClick={() => onEdit && onEdit(tx)}
                          className={`p-3.5 flex items-center justify-between gap-2.5 hover:bg-slate-50/80 active:bg-slate-100 transition-colors cursor-pointer opacity-0 animate-feed-lift stagger-${(idx % 12) + 1}`}
                        >
                          {/* 1열: 일자 / 통화 (가운데 정렬) */}
                          <div className="w-[54px] shrink-0 flex flex-col items-center justify-center gap-1 text-center">
                            <span className="text-[12px] font-bold text-slate-500 tabular-nums whitespace-nowrap leading-tight text-center tracking-tight">
                              {formatShortDate(tx.date)}
                            </span>
                            <div className="flex justify-center w-full">
                              <span
                                className={`inline-flex items-center justify-center px-1.5 py-[1px] rounded text-[9px] font-black leading-tight ${
                                  isKRW
                                    ? "bg-blue-50 text-blue-600 border border-blue-100/70"
                                    : "bg-emerald-50 text-emerald-600 border border-emerald-100/70"
                                }`}
                              >
                                {currency}
                              </span>
                            </div>
                          </div>

                          {/* 2열: 종목명 / 종목코드 & 배당정보 (주당 및 '-' 제거) */}
                          <div className="flex flex-col justify-center min-w-0 pr-2 gap-1 flex-1">
                            <span className="text-[13.5px] font-bold text-slate-900 truncate tracking-tight leading-tight">
                              {stockName}
                            </span>
                            {/* 2줄: [종목코드 44px 좌측] [수량 빈자리 48px] [배당단가 68px 우측] */}
                            <div className="flex items-center gap-2 text-[11px] min-w-0 leading-tight">
                              {/* 종목코드: 국내/해외와 동일한 44px 좌측 정렬 */}
                              <span className="w-[44px] shrink-0 font-mono text-slate-400 text-[10.5px] text-left tabular-nums">
                                {stockCode}
                              </span>

                              {/* 수량 빈자리: 국내/해외의 수량(48px) 자리 확보 */}
                              <span className="w-[48px] shrink-0" aria-hidden="true" />

                              {/* 배당금(단가): 국내/해외 단가와 완벽히 동일한 68px 우측 정렬 */}
                              <span className="w-[68px] shrink-0 tabular-nums font-medium text-slate-500 text-right whitespace-nowrap">
                                {cleanDivAmount}
                              </span>
                            </div>
                          </div>

                          {/* 3열: 총 배당금(원) (수직 중앙 배치) */}
                          <div className="text-right shrink-0 pl-1 flex flex-col justify-center items-end">
                            <div className="text-[14px] font-black text-emerald-600 tabular-nums tracking-tight">
                              {totalDivKRW}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // 1. 국내 및 해외 거래내역:
                    // 1열: 일자 / 구분 (w-[52px] 고정으로 종목명-종목코드 좌측 정렬 라인 일치)
                    // 2열: 종목명 / 종목코드 수량 단가 (동일한 좌측 라인에서 시작)
                    // 3열: 총금액 (2줄 수직 중앙 배치)
                    return (
                      <div
                        key={tx.id || idx}
                        onClick={() => onEdit && onEdit(tx)}
                        className={`p-3.5 flex items-center justify-between gap-2.5 hover:bg-slate-50/80 active:bg-slate-100 transition-colors cursor-pointer opacity-0 animate-feed-lift stagger-${(idx % 12) + 1}`}
                      >
                        {/* 1열: 일자 / 구분 (가운데 정렬) */}
                        <div className="w-[54px] shrink-0 flex flex-col items-center justify-center gap-1 text-center">
                          <span className="text-[12px] font-bold text-slate-500 tabular-nums whitespace-nowrap leading-tight text-center tracking-tight">
                            {formatShortDate(tx.date)}
                          </span>
                          <div className="flex justify-center w-full">
                            <span
                              className={`inline-flex items-center justify-center px-1.5 py-[1px] rounded text-[9px] font-black leading-tight ${
                                isBuy
                                  ? "bg-rose-50 text-rose-600 border border-rose-100/70"
                                  : "bg-blue-50 text-blue-600 border border-blue-100/70"
                              }`}
                            >
                              {isBuy ? "매수" : "매도"}
                            </span>
                          </div>
                        </div>

                        {/* 2열: 종목명 / 종목코드 수량 금액 */}
                        <div className="flex flex-col justify-center min-w-0 pr-2 gap-1 flex-1">
                          {/* 1줄: 종목명 (좌측정렬) */}
                          <span className="text-[13.5px] font-bold text-slate-900 truncate tracking-tight leading-tight">
                            {stockName}
                          </span>

                          {/* 2줄: [종목코드 6자리 좌측] [수량 최대5자리 우측] [단가 100만/1000.00 우측] */}
                          <div className="flex items-center gap-2 text-[11px] min-w-0 leading-tight">
                            {/* 종목코드: 6자리 고정 폭, 좌측 정렬 (종목명 좌측과 일치) */}
                            <span className="w-[44px] shrink-0 font-mono text-slate-400 text-[10.5px] text-left tabular-nums">
                              {stockCode}
                            </span>

                            {/* 수량: 최대 5자리 기준 고정 폭, 우측 정렬 */}
                            <span className="w-[48px] shrink-0 tabular-nums font-semibold text-slate-700 text-right">
                              {formattedQuantity}주
                            </span>

                            {/* 단가: 국내 100만원 / 해외 1000.00 기준 고정 폭, 우측 정렬 */}
                            <span className="w-[68px] shrink-0 tabular-nums font-medium text-slate-500 text-right whitespace-nowrap">
                              {formattedPrice}
                            </span>
                          </div>
                        </div>

                        {/* 3열: 총금액 (2줄의 높이 합산 수직 중앙에 배치) */}
                        <div className="text-right shrink-0 pl-1 flex flex-col justify-center items-end">
                          <div className="text-[14px] font-black text-slate-900 tabular-nums tracking-tight">
                            {formattedTotalAmount}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── 4. 페이지네이션 (대시보드와 동일한 컴팩트 중앙 정렬) ── */}
            {displayTotalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-3 pb-0.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage && setCurrentPage((p) => Math.max(1, p - 1))}
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
                  <span className="text-slate-400">{displayTotalPages}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage && setCurrentPage((p) => Math.min(displayTotalPages, p + 1))}
                  disabled={currentPage === displayTotalPages}
                  className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
                    currentPage === displayTotalPages
                      ? "text-slate-200 cursor-not-allowed"
                      : "text-slate-500 hover:bg-slate-100 active:scale-95 cursor-pointer"
                  }`}
                  aria-label="다음 페이지"
                >
                  <ChevronRight size={16} strokeWidth={2.5} />
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
