"use client";

import React, { useState, useRef, useMemo } from "react";
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
  Calendar,
} from "lucide-react";

// ── 종목 한글 매핑 ──
const STOCK_KR_NAMES = {
  'AAPL': '애플',
  'MSFT': '마이크로소프트',
  'NVDA': '엔비디아',
  'GOOGL': '알파벳 A',
  'TSLA': '테슬라',
};

// ── 금괴(Gold Bar) 전용 아이콘 ──
function GoldBarIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.5 8.5L8 6H16L18.5 8.5H5.5Z" fill="#FFFBEB" fillOpacity="0.95" />
      <path d="M5.5 8.5H18.5L20 15H4L5.5 8.5Z" fill="#FEF08A" />
      <path d="M4 15H20L18 18.5H6L4 15Z" fill="#D97706" />
      <path d="M8 6H16L18.5 8.5L20 15L18 18.5H6L4 15L5.5 8.5L8 6Z" stroke="#78350F" strokeWidth="1.2" strokeLinejoin="round" />
      <line x1="5.5" y1="8.5" x2="18.5" y2="8.5" stroke="#78350F" strokeWidth="1" />
      <line x1="4" y1="15" x2="20" y2="15" stroke="#78350F" strokeWidth="1" />
      <text x="12" y="13" textAnchor="middle" fontSize="3.3" fontWeight="900" fill="#78350F" letterSpacing="0.4">999.9</text>
    </svg>
  );
}

// ── 로고 로드 실패 캐시 (실패한 URL은 다시 시도하지 않아 성능 저하 방지) ──
const failedImageUrls = new Set();

const StockLogo = React.memo(function StockLogo({ code, name, isKRW }) {
  const [hasError, setHasError] = useState(false);
  const cleanCode = (code || '').replace(/\.(KS|KQ|US|kospi|kosdaq)$/i, '').trim().toUpperCase();
  const isGold = (name || '').includes('금현물') || cleanCode === 'GOLD';

  if (isGold) {
    return (
      <div 
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 border border-amber-300 shadow-sm shadow-amber-500/20"
        title="KRX 금현물"
      >
        <GoldBarIcon className="w-5 h-5 drop-shadow-xs" />
      </div>
    );
  }

  // 국내(KRW)는 6자리 숫자 코드(005930 등), 해외(USD 등)는 티커 심볼(AAPL 등) 기준으로 처리
  const formattedCode = isKRW && /^\d+$/.test(cleanCode) ? cleanCode.padStart(6, '0') : cleanCode;
  const logoUrl = formattedCode ? `https://static.toss.im/png-icons/securities/icn-sec-fill-${formattedCode}.png` : null;
  const isFailed = !logoUrl || failedImageUrls.has(logoUrl);

  // ETF 여부 판별 (종목명에 ETF 또는 주요 ETF 브랜드가 포함된 경우)
  const isETF = (name || '').toUpperCase().includes('ETF') ||
                /^(KODEX|TIGER|ACE|RISE|SOL|PLUS|KOSEF|ARIRANG|WOORI|TIMEFOLIO)/i.test(name || '');

  if (isFailed || hasError) {
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
        onError={() => {
          if (logoUrl) failedImageUrls.add(logoUrl);
          setHasError(true);
        }}
        className="w-full h-full object-cover rounded-lg"
        loading="lazy"
      />
    </div>
  );
});

const TABS = [
  { key: "trading", label: "매매", href: "/transactions/trading" },
  { key: "dividends", label: "배당", href: "/transactions/dividends" },
];

function MobileTransactionList({
  type = "trading", // "trading" | "dividends"
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
  currencyFilter = "ALL",
  onSelectCurrencyFilter = null,
}) {
  const ITEMS_PER_PAGE = 6;

  const displayTotalCount = transactions ? transactions.length : 0;
  const displayTotalPages = Math.ceil(displayTotalCount / ITEMS_PER_PAGE) || 1;
  const displayList = useMemo(() => {
    return (transactions || []).slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [transactions, currentPage]);

  // 상단 탭 네비게이션 제어 (< 국내 >)
  const currentIndex = Math.max(0, TABS.findIndex((t) => t.key === type));
  const currentTab = TABS[currentIndex] || TABS[0];
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < TABS.length - 1;

  // 스와이프 제스처 핸들링 (좌우 스와이프로 페이지 이동)
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);

  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    if (!e.changedTouches || e.changedTouches.length === 0) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const diffX = touchStartXRef.current - touchEndX;
    const diffY = touchStartYRef.current - touchEndY;

    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // 세로 스크롤 의도가 강한 경우(diffY가 더 큰 경우)는 페이지 넘김 방지
    // 수평 이동 거리가 45px 이상이고 수직 이동보다 현저히 큰 경우에만 스와이프로 인식
    if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY) * 1.3) {
      if (diffX > 0) {
        // 좌측으로 스와이프 (우 -> 좌) => 다음 페이지
        if (currentPage < displayTotalPages) {
          setCurrentPage && setCurrentPage((p) => Math.min(displayTotalPages, p + 1));
        }
      } else {
        // 우측으로 스와이프 (좌 -> 우) => 이전 페이지
        if (currentPage > 1) {
          setCurrentPage && setCurrentPage((p) => Math.max(1, p - 1));
        }
      }
    }
  };

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
    return symbolMap[currency] || (currency ? `${currency}` : "$");
  };

  // 단가(금액) 포맷
  // 국내: 원단위 소수점 없음 (예: 74,200원)
  // 해외: 해당 통화 기호(색상 강조) + 소수점 2자리 (예: $150.25)
  const formatPrice = (price, currency) => {
    if (price === null || price === undefined || price === "") return "-";
    const num = typeof price === "number" ? price : parseFloat(price);
    if (isNaN(num)) return price;

    const isKRW = !currency || currency === "KRW";
    if (isKRW) {
      return (
        <span className="whitespace-nowrap text-blue-600 font-medium">
          {Math.round(num).toLocaleString("ko-KR")}원
        </span>
      );
    }
    const sym = getCurrencySymbol(currency);
    return (
      <span className="inline-flex items-baseline justify-end whitespace-nowrap text-amber-600 font-medium">
        <span className="font-bold mr-0.5">{sym}</span>
        <span>{num.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </span>
    );
  };

  // 총금액 포맷 (수량 x 금액, 원래대로 단색 선명한 볼드 표기)
  // 국내: 원단위 소수점 없음 (예: 742,000원)
  // 해외: 해당 통화 기호 + 소수점 2자리 (예: $1,502.50)
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
    return `${sym}${num.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
                  className={`w-9 h-9 flex items-center justify-center rounded-xl text-white shadow-xs shrink-0 ${
                    type === "trading"
                      ? "bg-gradient-to-br from-blue-500 to-indigo-600"
                      : type === "dividends"
                      ? "bg-gradient-to-br from-amber-500 to-orange-500"
                      : "bg-gradient-to-br from-indigo-500 to-purple-600"
                  }`}
                >
                  {type === "trading" && <ArrowLeftRight size={18} strokeWidth={2.5} />}
                  {type === "overseas" && <Globe size={18} strokeWidth={2.5} />}
                  {type === "dividends" && <Coins size={18} strokeWidth={2.5} />}
                </div>
                <div>
                  <h1 className="text-base font-extrabold text-slate-800 tracking-tight leading-tight">
                    거래내역
                  </h1>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {type === "trading"
                      ? "국내/해외/기타 주식 매매 내역"
                      : "배당금 입금 내역"}
                  </span>
                </div>
              </div>

              {/* 우측: < 매매 > 화살표로 매매 <-> 배당 이동 */}
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

            {/* ── 2. 거래내역 메인 카드 (서브 바 + 개별 카드 리스트 - 스와이프 지원) ── */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-3.5 sm:p-4 flex flex-col gap-3">
              {/* 서브 바: 건수 표시 및 [초기화] [필터] [등록] 버튼 */}
              <div className="flex items-center justify-between">
                <div className="h-8 flex items-center gap-2">
                  <div
                    className={`w-1.5 h-4.5 rounded-full ${
                      type === "trading"
                        ? "bg-blue-600"
                        : type === "overseas"
                        ? "bg-emerald-600"
                        : "bg-indigo-600"
                    }`}
                  />
                  <span className="text-[15px] font-black text-slate-800 leading-none tracking-tight">
                    상세내역
                  </span>
                  <span className="text-[12px] font-bold text-slate-400 leading-none">
                    총 <span className="font-extrabold text-slate-700">{displayTotalCount}</span>건
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {isFilterActive && onResetFilter && (
                    <button
                      type="button"
                      onClick={onResetFilter}
                      className="h-8 w-8 inline-flex items-center justify-center bg-white hover:bg-amber-50 text-slate-500 hover:text-amber-600 border border-slate-200 hover:border-amber-200 rounded-xl shadow-2xs active:scale-95 transition-transform duration-75 cursor-pointer"
                      title="필터 초기화"
                    >
                      <RotateCcw size={14} strokeWidth={2.2} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onOpenFilter}
                    className={`h-8 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-xl text-xs transition-transform duration-75 shadow-2xs active:scale-95 cursor-pointer ${
                      isFilterActive
                        ? "bg-amber-500 hover:bg-amber-600 text-white font-black border border-amber-400 shadow-sm shadow-amber-500/20"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 font-bold shadow-2xs"
                    }`}
                  >
                    <Filter size={13} strokeWidth={2.2} />
                    <span>필터</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenRegister}
                    className={`h-8 px-2.5 inline-flex items-center justify-center gap-1 rounded-xl text-xs font-black text-white shadow-sm active:scale-95 transition-transform duration-75 cursor-pointer ${
                      type === "trading"
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                  >
                    <Plus size={14} strokeWidth={2.5} />
                    <span>등록</span>
                  </button>
                </div>
              </div>

              {/* 거래내역 개별 카드 목록 (월별 배당 종목 조회와 동일한 레이아웃 - 스와이프 제스처 지원) */}
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
                <div 
                  key={`tx-list-${type}-${currentPage}`}
                  className="flex flex-col gap-2.5 touch-pan-y"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  {(() => {
                    const dateThemeColor =
                      type === "trading"
                        ? "text-blue-600"
                        : type === "overseas"
                        ? "text-emerald-600"
                        : "text-indigo-600";

                    return displayList.map((tx, idx) => {
                      const isBuy = tx.trade_type === "BUY" || tx.type === "매수";
                      
                      // 1. transactions 테이블 transaction_type 기준 (domestic, overseas, other)
                      const txType = (tx.transaction_type || '').toLowerCase();
                      const isDomestic = txType === 'domestic' || (!txType && (tx.currency === 'KRW' || !tx.currency));
                      const isOverseas = txType === 'overseas' || (!txType && tx.currency && tx.currency !== 'KRW');
                      const isOther = txType === 'other';

                      // 2. security 테이블의 code & name 기준
                      const rawCode = tx.security?.code || tx.stock_code || tx.stockCode || "";
                      const stockCode = isDomestic ? formatStockCode(rawCode) : rawCode.toUpperCase();
                      const rawName = tx.security?.name || tx.stock_name || tx.stock || "-";
                      const stockName = STOCK_KR_NAMES[rawCode.toUpperCase()] || rawName;

                      const currency = tx.currency || tx.security?.currency || (isOverseas ? "USD" : "KRW");
                      const isKRW = currency === "KRW" || isDomestic;

                      // 수량 포맷
                      const qtyNum = typeof tx.quantity === "number" ? tx.quantity : parseFloat(tx.quantity);
                      const formattedQuantity = !isNaN(qtyNum) ? qtyNum.toLocaleString("ko-KR") : (tx.quantity || "-");

                      // 단가 포맷 (국내: 원단위 소수점 없음, 해외: 해당 통화 기호 + 소수점 2자리)
                      const formattedPrice = formatPrice(tx.price, currency);

                      // 총금액 포맷
                      const formattedTotalAmount = formatTotalAmount(tx.amount, tx.quantity, tx.price, currency);

                      // 배당 탭인 경우
                      if (type === "dividends") {
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
                            key={tx.id || `div-${idx}`}
                            onClick={() => onEdit && onEdit(tx)}
                            className={`p-3 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-colors cursor-pointer flex items-center gap-2.5 active:scale-[0.99] opacity-0 animate-feed-lift stagger-${(idx % 12) + 1}`}
                          >
                            {/* 1열: 종목 로고 */}
                            <StockLogo code={stockCode} name={stockName} isKRW={isKRW} />

                            {/* 2열: 우측 상세 컨텐츠 */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              {/* 1행: 종목명 (좌) & 날짜 (우측상단 - 2안 캘린더 아이콘 결합형) */}
                              <div className="flex justify-between items-center leading-tight">
                                <p className="text-[13px] font-bold text-slate-900 truncate pr-2">
                                  {stockName}
                                </p>
                                <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${dateThemeColor} tabular-nums shrink-0`}>
                                  <Calendar size={11} strokeWidth={2.2} className="shrink-0" />
                                  <span>{formatShortDate(tx.date)}</span>
                                </span>
                              </div>

                              {/* 2행: 종목코드(8자리 고정폭) + 국내/해외 배지 + 외화(우측정렬 녹색) + 총배당금(원화) */}
                              <div className="flex items-center justify-between mt-1 text-[11px] leading-tight">
                                {/* 좌: 종목코드(8자리 고정폭) + 국내/해외 구분 */}
                                <div className="flex items-center gap-0 shrink-0">
                                  <span className="font-mono text-slate-400 w-[7ch] shrink-0 truncate">
                                    {stockCode}
                                  </span>
                                  <span
                                    className={`text-[9px] font-bold px-1 py-0.5 rounded border shrink-0 text-center leading-none ${
                                      isKRW
                                        ? "bg-blue-50 text-blue-600 border-blue-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                    }`}
                                  >
                                    {isKRW ? "국내" : "해외"}
                                  </span>
                                </div>

                                {/* 중: 외화 표시 (420px 이하 숨김) */}
                                <div className="w-auto min-[421px]:w-[122px] flex justify-end items-center pr-2 shrink-0 hide-under-420 max-[420px]:hidden">
                                  {!isKRW && cleanDivAmount ? (
                                    <span className="text-[11px] font-medium text-slate-500 tabular-nums truncate">
                                      {cleanDivAmount}
                                    </span>
                                  ) : null}
                                </div>

                                {/* 우: 총 배당금 (국내/해외 총금액과 동일한 폰트 및 색상) */}
                                <div className="shrink-0 text-right whitespace-nowrap ml-auto pl-1">
                                  <span className="text-xs font-black text-slate-900 tabular-nums whitespace-nowrap inline-block">
                                    {totalDivKRW}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // 국내 및 해외 거래내역:
                      return (
                        <div
                          key={tx.id || `trade-${idx}`}
                          onClick={() => onEdit && onEdit(tx)}
                          className={`p-3 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-colors cursor-pointer flex items-center gap-2.5 active:scale-[0.99] opacity-0 animate-feed-lift stagger-${(idx % 12) + 1}`}
                        >
                          {/* 1열: 종목 로고 */}
                          <StockLogo code={stockCode} name={stockName} isKRW={isKRW} />

                          {/* 2열: 우측 상세 컨텐츠 */}
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            {/* 1행: 종목명 (좌) & 날짜 (우측상단 - 2안 캘린더 아이콘 결합형) */}
                            <div className="flex justify-between items-center leading-tight">
                              <p className="text-[13px] font-bold text-slate-900 truncate pr-2">
                                {stockName}
                              </p>
                              <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${dateThemeColor} tabular-nums shrink-0`}>
                                <Calendar size={11} strokeWidth={2.2} className="shrink-0" />
                                <span>{formatShortDate(tx.date)}</span>
                              </span>
                            </div>

                            {/* 2행: 종목코드(8자리 고정폭) + 매수/매도 배지 + 수량(우측라인) + 매수가(우측라인) + 총금액 */}
                            <div className="flex items-center justify-between mt-1 text-[11px] leading-tight">
                              {/* 좌: 종목코드(7자리 고정폭) + 시장 구분(국내/해외/기타) + 매수/매도 구분 */}
                              <div className="flex items-center gap-0 shrink-0">
                                <span className="font-mono text-slate-400 w-[7ch] shrink-0 truncate">
                                  {stockCode}
                                </span>
                                {(() => {
                                  const rowType = isOther ? 'OTHER' : (isOverseas ? 'OVERSEAS' : 'DOMESTIC');
                                  return (
                                    <span
                                      className={`text-[9px] font-bold px-1 py-0.5 rounded border shrink-0 text-center leading-none mr-1 ${
                                        rowType === 'OTHER'
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                          : rowType === 'OVERSEAS'
                                          ? "bg-amber-50 text-amber-700 border-amber-200"
                                          : "bg-blue-50 text-blue-600 border-blue-200"
                                      }`}
                                    >
                                      {rowType === 'OTHER' ? "기타" : rowType === 'OVERSEAS' ? "해외" : "국내"}
                                    </span>
                                  );
                                })()}
                                <span
                                  className={`text-[9px] font-bold px-1 py-0.5 rounded border shrink-0 text-center leading-none ${
                                    isBuy
                                      ? "bg-rose-50 text-rose-600 border-rose-200"
                                      : "bg-blue-50 text-blue-600 border-blue-200"
                                  }`}
                                >
                                  {isBuy ? "매수" : "매도"}
                                </span>
                              </div>

                              {/* 중: 수량(우측라인 맞춤) + 매수가(우측라인 맞춤, 420px 이하 숨김) */}
                              <div className="w-auto min-[421px]:w-[122px] flex items-center justify-end gap-1.5 pr-2 shrink-0">
                                <span className="w-[44px] text-right text-slate-700 font-semibold tabular-nums truncate">
                                  {formattedQuantity}{(stockName || '').includes('금현물') || stockCode === 'GOLD' ? 'g' : '주'}
                                </span>
                                <span className="w-[64px] text-right font-medium tabular-nums truncate hide-under-420 max-[420px]:hidden whitespace-nowrap">
                                  {formattedPrice}
                                </span>
                              </div>

                              {/* 우: 총금액 */}
                              <div className="shrink-0 text-right whitespace-nowrap ml-auto pl-1">
                                <span className="text-xs font-black text-slate-900 tabular-nums whitespace-nowrap inline-block">
                                  {formattedTotalAmount}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* ── 3. 페이지 인디케이터 (각 거래내역 테마 색상 동기화) ── */}
            {displayTotalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 font-bold text-xs pt-2 pb-0.5">
                <span
                  className={`font-black ${
                    type === "trading"
                      ? "text-blue-600"
                      : type === "overseas"
                      ? "text-emerald-600"
                      : "text-indigo-600"
                  }`}
                >
                  {currentPage}
                </span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-400 font-bold">{displayTotalPages}</span>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

export default React.memo(MobileTransactionList);
