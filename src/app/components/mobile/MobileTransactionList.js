"use client";

import { useState } from "react";
import Link from "next/link";
import { Filter, RotateCcw, ChevronLeft, ChevronRight, Plus, Edit2, Trash2, X } from "lucide-react";

export default function MobileTransactionList({
  type = "trading", // "trading" | "overseas" | "dividends"
  transactions = [],
  paginatedTransactions = [],
  loading = false,
  user = null,
  currentPage = 1,
  setCurrentPage,
  totalPages = 1,
  onOpenFilter,
  onOpenRegister,
  isFilterActive = false,
  onResetFilter,
  onEdit,
  onDelete,
  accountNameById = {},
  formatCurrency,
  getCurrencyStyle,
}) {
  const ITEMS_PER_PAGE = 10;

  const displayTotalCount = transactions ? transactions.length : 0;
  const displayTotalPages = totalPages;
  const displayList = paginatedTransactions || [];

  // 날짜 포맷 (YY.MM.DD)
  const formatShortDate = (dateStr) => {
    if (!dateStr) return "-";
    const cleaned = dateStr.replace(/-/g, '.').replace(/\//g, '.');
    return cleaned.length >= 8 && cleaned.startsWith('20') ? cleaned.slice(2) : cleaned;
  };

  // 통화 텍스트 색상 (웹버전 배지 스타일과 통일)
  const getCurrencyTextColor = (currency) => {
    const map = {
      'KRW': 'text-blue-600',
      'USD': 'text-emerald-600',
      'JPY': 'text-rose-600',
      'EUR': 'text-indigo-600',
      'HKD': 'text-amber-600',
      'CNY': 'text-red-600',
      'GBP': 'text-violet-600',
    };
    return map[currency] || 'text-slate-600';
  };

  // 통화 기호
  const getCurrencySymbol = (currency) => {
    const symbolMap = {
      'USD': '$',
      'EUR': '€',
      'JPY': '¥',
      'CNY': '¥',
      'GBP': '£',
      'HKD': 'HK$',
    };
    return symbolMap[currency] || '$';
  };

  return (
    <div style={{ maxWidth: "100vw", overflowX: "hidden" }} className="flex flex-col gap-0 bg-slate-50 min-h-full pb-20">
      <div className="flex flex-col gap-3 px-3 py-3" style={{ maxWidth: "100%" }}>

        {/* ── 1. 상단 네비게이션 & 액션 영역 (전체 버튼 h-8 높이 동일 통일) ── */}
        <div className="flex items-center justify-between gap-2 pt-1 pb-1">
          {/* 좌측: [국내] [해외] [배당] 웹버전 스타일 버튼 */}
          <div className="flex items-center gap-1.5">
            <Link
              href="/transactions/trading"
              className={`h-8 px-3 inline-flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                type === "trading"
                  ? "bg-brand text-white shadow-md shadow-brand/20"
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm"
              }`}
            >
              국내
            </Link>
            <Link
              href="/transactions/overseas"
              className={`h-8 px-3 inline-flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                type === "overseas"
                  ? "bg-brand text-white shadow-md shadow-brand/20"
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm"
              }`}
            >
              해외
            </Link>
            <Link
              href="/transactions/dividends"
              className={`h-8 px-3 inline-flex items-center justify-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                type === "dividends"
                  ? "bg-brand text-white shadow-md shadow-brand/20"
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm"
              }`}
            >
              배당
            </Link>
          </div>

          {/* 우측: [초기화] [필터] [등록] 버튼 (h-8 일치) */}
          <div className="flex items-center gap-1.5">
            {isFilterActive && onResetFilter && (
              <button
                type="button"
                onClick={onResetFilter}
                className="h-8 w-8 inline-flex items-center justify-center bg-white text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm active:scale-95 transition-all cursor-pointer"
                title="필터 초기화"
              >
                <RotateCcw size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={onOpenFilter}
              className={`h-8 px-3 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer ${
                isFilterActive
                  ? "bg-indigo-600 text-white border border-indigo-600 shadow-sm"
                  : "bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100/80"
              }`}
            >
              <Filter size={14} strokeWidth={2.2} />
              <span>필터</span>
            </button>
            <button
              type="button"
              onClick={onOpenRegister}
              className="h-8 px-3 inline-flex items-center justify-center gap-1 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-500 text-white border border-amber-300 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>등록</span>
            </button>
          </div>
        </div>

        {/* ── 2. 거래내역 카드 (대시보드 패밀리 룩) ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm" style={{ overflow: "hidden" }}>
          
          {/* 섹션 헤더 (제목 좌측 바: 국내 bg-blue-500, 해외 bg-emerald-500, 배당 bg-indigo-500) */}
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <div
                className={`w-1 h-4 rounded-full ${
                  type === "trading"
                    ? "bg-blue-500"
                    : (type === "overseas" ? "bg-emerald-500" : "bg-indigo-500")
                }`}
              />
              <span className="text-sm font-bold text-slate-700">
                {type === "trading"
                  ? "국내 주식 거래내역"
                  : (type === "overseas" ? "해외 주식 거래내역" : "배당금 입금내역")}
              </span>
            </div>
            <span className="text-xs text-slate-400 font-medium tabular-nums">
              총 <span className="font-bold text-slate-700">{displayTotalCount}</span>건
            </span>
          </div>

          {/* 테이블 컨테이너 */}
          <div className="px-3 py-3">
            <div className="border border-slate-200 rounded-xl" style={{ overflow: "hidden", width: "100%" }}>
              
              {/* 테이블 헤더 */}
              <div className="bg-slate-50 border-b border-slate-200 flex" style={{ width: "100%" }}>
                {/* 종목명 열 */}
                <div style={{ width: 92, flexShrink: 0 }} className="px-2 py-2 flex items-center justify-center text-center">
                  <span className="text-[10px] font-semibold text-slate-500">종목명</span>
                </div>
                {/* 나머지 3개 열 (비율 조절: 일자/구분 25%, 수량/단가 31%, 거래금액 44%) */}
                <div className="flex-1 min-w-0" style={{ display: "grid", gridTemplateColumns: "25% 31% 44%" }}>
                  {/* 1열: 일자 / (구분 또는 통화) */}
                  <div className="px-1 py-1.5 text-center flex flex-col items-center justify-center">
                    <span className="text-[9px] font-semibold text-slate-500 leading-tight block">일자</span>
                    <span className="text-[9px] text-slate-400 leading-tight block mt-0.5">
                      {type === "dividends" ? "통화" : "구분"}
                    </span>
                  </div>
                  {/* 2열: 배당금 또는 수량/단가 */}
                  <div className="px-1 py-1.5 text-center flex flex-col items-center justify-center translate-x-2">
                    <span className="text-[9px] font-semibold text-slate-500 leading-tight block">
                      {type === "dividends" ? "배당금" : "수량"}
                    </span>
                    {type !== "dividends" && (
                      <span className="text-[9px] text-slate-400 leading-tight block mt-0.5">단가</span>
                    )}
                  </div>
                  {/* 3열: 배당금(원) 또는 거래금액 */}
                  <div className="px-1 py-1.5 text-center flex flex-col items-center justify-center">
                    <span className="text-[9px] font-semibold text-slate-500 leading-tight block">
                      {type === "dividends" ? "배당금(원)" : "거래금액"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 로딩 상태 및 빈 상태 */}
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-slate-400 text-sm">
                  <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="font-medium text-slate-500 text-xs">거래내역을 불러오는 중...</span>
                </div>
              ) : displayList.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs font-medium">
                  {user ? "등록된 거래내역이 없습니다." : "로그인 후 거래내역을 확인할 수 있습니다."}
                </div>
              ) : (
                /* 거래 행 목록 (스태거 페이드인 애니메이션) */
                <div key={`tx-page-${currentPage}`} className="divide-y divide-slate-100">
                  {displayList.map((tx, idx) => {
                    const isBuy = tx.trade_type === 'BUY' || tx.type === '매수';
                    const stockName = tx.security?.name || tx.stock_name || tx.stock || '-';
                    const stockCode = tx.security?.code || tx.stock_code || tx.stockCode || '';
                    const accountName = accountNameById[tx.account_id] || tx.account || '';

                    // 금액 계산
                    const formattedQuantity = typeof tx.quantity === 'number'
                      ? tx.quantity.toLocaleString('ko-KR')
                      : tx.quantity;

                    const formattedPrice = typeof tx.price === 'number'
                      ? (formatCurrency ? formatCurrency(tx.price, tx.currency || (type === 'overseas' ? 'USD' : 'KRW')) : tx.price.toLocaleString('ko-KR'))
                      : tx.price;

                    const formattedAmount = typeof tx.amount === 'number'
                      ? (formatCurrency ? formatCurrency(tx.amount, tx.currency || (type === 'overseas' ? 'USD' : 'KRW')) : tx.amount.toLocaleString('ko-KR'))
                      : tx.amount;

                    // 해외 원화 환산금액
                    const krwAmount = tx.exchange_total_rate
                      ? `₩ ${Number(tx.exchange_total_rate).toLocaleString('ko-KR')}`
                      : tx.exchange_rate && typeof tx.amount === 'number'
                      ? `₩ ${Math.round(tx.amount * tx.exchange_rate).toLocaleString('ko-KR')}`
                      : null;

                    return (
                      <div
                        key={tx.id || idx}
                        onClick={() => onEdit && onEdit(tx)}
                        className={`flex items-stretch opacity-0 animate-row-fade stagger-${idx + 1} hover:bg-slate-50/80 active:bg-slate-100 transition-colors cursor-pointer`}
                        style={{ width: "100%" }}
                      >
                        {/* 종목명 (좌측 92px, 3번: 계좌 숨김) */}
                        <div style={{ width: 92, flexShrink: 0 }} className="pl-2 pr-1 py-2 bg-slate-50/40 flex items-center gap-1.5 text-left">
                          {getCurrencyStyle && (
                            <div className={`w-[2px] h-6 rounded-full flex-shrink-0 ${getCurrencyStyle(tx.currency || (type === 'overseas' ? 'USD' : 'KRW')).accent}`} />
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-bold text-slate-800 leading-tight line-clamp-1 break-all">
                              {stockName}
                            </span>
                            <span className="text-[8px] text-slate-400 font-mono mt-0.5 truncate leading-tight">
                              {stockCode || ""}
                            </span>
                          </div>
                        </div>

                        {/* 우측 3개 열 (비율 조절: 일자/구분 25%, 수량/단가 31%, 거래금액 44%) */}
                        <div className="flex-1 min-w-0" style={{ display: "grid", gridTemplateColumns: "25% 31% 44%" }}>
                          {/* 1열: 일자 / (구분 또는 통화) */}
                          <div className="px-1 py-1.5 text-center flex flex-col items-center justify-center">
                            <span className="text-[11px] font-semibold text-slate-700 tabular-nums leading-tight block">
                              {formatShortDate(tx.date)}
                            </span>
                            {type === "dividends" ? (
                              <span className={`text-[9.5px] font-bold mt-0.5 leading-tight ${getCurrencyTextColor(tx.currency || 'KRW')}`}>
                                {tx.currency || "KRW"}
                              </span>
                            ) : (
                              <span
                                className={`text-[9.5px] font-bold mt-0.5 leading-tight ${
                                  isBuy ? "text-rose-500" : "text-blue-500"
                                }`}
                              >
                                {isBuy ? "매수" : "매도"}
                              </span>
                            )}
                          </div>

                          {/* 2열: 배당금 또는 수량/단가 */}
                          <div className={`py-1.5 flex flex-col justify-center ${type === "dividends" && tx.currency === 'KRW' ? "px-1 text-center items-center translate-x-2" : "pl-0.5 pr-3.5 text-right"}`}>
                            {type === "dividends" ? (
                              <span className={`text-[11px] font-semibold tabular-nums leading-tight block ${tx.currency === 'KRW' ? "text-center text-slate-400" : "text-slate-800"}`}>
                                {tx.currency !== 'KRW'
                                  ? (typeof tx.dividend_amount === 'number'
                                      ? `${getCurrencySymbol(tx.currency || 'USD')} ${tx.dividend_amount.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                      : (tx.dividend_amount || '-'))
                                  : '-'}
                              </span>
                            ) : (
                              <>
                                <span className="text-[11px] font-semibold text-slate-800 tabular-nums leading-tight block">
                                  {formattedQuantity}주
                                </span>
                                <span className="text-[9.5px] font-medium text-slate-500 tabular-nums leading-tight block mt-0.5">
                                  {formattedPrice}
                                </span>
                              </>
                            )}
                          </div>

                          {/* 3열: 배당금(원) 또는 거래금액 */}
                          <div className="pl-0.5 pr-6 py-1.5 text-right flex flex-col justify-center">
                            {type === "dividends" ? (
                              <span className="text-[11px] font-bold text-emerald-600 tabular-nums leading-tight block">
                                {typeof tx.total_dividend === 'number'
                                  ? `${tx.total_dividend.toLocaleString('ko-KR')}원`
                                  : (tx.total_dividend || '-')}
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-slate-900 tabular-nums leading-tight block">
                                {formattedAmount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>

            {/* 페이지네이션 (대시보드와 100% 동일한 컴팩트 중앙 정렬) */}
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

          </div>
        </div>

      </div>
    </div>
  );
}
