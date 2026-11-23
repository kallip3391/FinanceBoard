"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Calendar,
  Search,
} from "lucide-react";
import { TransactionManager } from "@/lib/transactionManager";
import { CalendarUI, getStockType } from "./TradingModal";

// 툴바 날짜 포맷터 (YYYY - MM - DD)
const formatToolbarDate = (dateStr) => {
  if (!dateStr) return '';
  const clean = dateStr.replace(/[^0-9]/g, '');
  if (clean.length === 8) {
    return `${clean.substring(0, 4)} - ${clean.substring(4, 6)} - ${clean.substring(6, 8)}`;
  }
  return dateStr;
};

/**
 * ── 독립 격리 매매 필터 모달 컴포넌트 ──
 * 모든 임시 필터 상태(tempFilters)를 자체 격리하여
 * 필터 칩 클릭, 기간 변경, 종목 검색 시 부모 페이지(TransactionsPage) 리렌더링 차단.
 */
function TradingFilterModal({
  isOpen,
  isClosing,
  onClose,
  activeFilters,
  currencyFilter = 'ALL',
  tradeTypeFilter = 'ALL',
  onApply,
}) {
  const [mounted, setMounted] = useState(false);

  // 로컬 임시 필터 상태
  const [tempFilters, setTempFilters] = useState({
    dateFrom: '',
    dateTo: '',
    type: '전체',
    stockName: '',
    stockCode: '',
    security_id: '',
    currencyFilter: 'ALL',
  });

  const [selectedQuickPeriod, setSelectedQuickPeriod] = useState(null);
  const [isFilterFromCalendarOpen, setIsFilterFromCalendarOpen] = useState(false);
  const [isFilterToCalendarOpen, setIsFilterToCalendarOpen] = useState(false);
  const [isFilterStockDropdownOpen, setIsFilterStockDropdownOpen] = useState(false);
  const [stockSearchResults, setStockSearchResults] = useState([]);
  const [isSearchingStock, setIsSearchingStock] = useState(false);
  const [focusedStockIndex, setFocusedStockIndex] = useState(-1);

  const filterDateFromRef = useRef(null);
  const filterDateToRef = useRef(null);
  const filterFromCalendarRef = useRef(null);
  const filterToCalendarRef = useRef(null);
  const filterStockDropdownRef = useRef(null);
  const filterStockListRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 모달이 열릴 때 부모의 현재 activeFilters로 로컬 상태 초기화
  useEffect(() => {
    if (isOpen) {
      const typeLabel = tradeTypeFilter === 'BUY' ? '매수' : tradeTypeFilter === 'SELL' ? '매도' : (activeFilters?.type || '전체');
      setTempFilters({
        dateFrom: activeFilters?.dateFrom || '',
        dateTo: activeFilters?.dateTo || '',
        type: typeLabel,
        stockName: activeFilters?.stockName || '',
        stockCode: activeFilters?.stockCode || '',
        security_id: activeFilters?.security_id || '',
        currencyFilter: currencyFilter || 'ALL',
      });
      setSelectedQuickPeriod(null);
      setIsFilterFromCalendarOpen(false);
      setIsFilterToCalendarOpen(false);
      setIsFilterStockDropdownOpen(false);
    }
  }, [isOpen, activeFilters, currencyFilter, tradeTypeFilter]);

  // 바깥 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        filterFromCalendarRef.current &&
        !filterFromCalendarRef.current.contains(e.target) &&
        filterDateFromRef.current &&
        !filterDateFromRef.current.contains(e.target)
      ) {
        setIsFilterFromCalendarOpen(false);
      }
      if (
        filterToCalendarRef.current &&
        !filterToCalendarRef.current.contains(e.target) &&
        filterDateToRef.current &&
        !filterDateToRef.current.contains(e.target)
      ) {
        setIsFilterToCalendarOpen(false);
      }
      if (
        filterStockDropdownRef.current &&
        !filterStockDropdownRef.current.contains(e.target)
      ) {
        setIsFilterStockDropdownOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 종목 검색 실행
  const handleStockSearch = useCallback(async (term) => {
    let cleanTerm = (term || '').trim();
    const match = cleanTerm.match(/\[(.*?)\]/);
    if (match && match[1]) {
      cleanTerm = match[1];
    } else {
      const parts = cleanTerm.split('] ');
      if (parts.length > 1) cleanTerm = parts[1];
    }

    if (!cleanTerm) {
      setStockSearchResults([]);
      setIsFilterStockDropdownOpen(false);
      return;
    }

    setIsSearchingStock(true);
    setIsFilterStockDropdownOpen(true);
    setFocusedStockIndex(-1);

    try {
      const results = await TransactionManager.searchStocksByName(cleanTerm, null);
      setStockSearchResults(results || []);
      if (results && results.length > 0) setFocusedStockIndex(0);
    } catch (err) {
      console.error(err);
      setStockSearchResults([]);
    } finally {
      setIsSearchingStock(false);
    }
  }, []);

  const handleApply = () => {
    onApply(tempFilters);
    onClose();
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[9990] bg-black/50 backdrop-blur-xs flex flex-col justify-end md:justify-center md:items-center p-0 md:p-4 transition-opacity ${
        isClosing ? 'animate-fade-out pointer-events-none' : 'animate-fade-in'
      }`}
      onClick={onClose}
    >
      <div
        className={`relative bg-white w-full max-w-lg rounded-t-3xl md:rounded-3xl shadow-2xl border-t md:border border-slate-100 overflow-hidden max-h-[90vh] md:max-h-[85vh] flex flex-col ${
          isClosing ? 'animate-sheet-down md:animate-modal-out pointer-events-none' : 'animate-sheet-up md:animate-page-slide pointer-events-auto'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모바일 상단 드래그 핸들 */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto my-3 shrink-0 md:hidden" />

        {/* 헤더 */}
        <div className="flex-shrink-0 flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-slate-800 tracking-tight">거래내역 상세 필터</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* 바디 */}
        <div className="px-5 py-4 flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="space-y-4">
            {/* 1. 조회 기간 선택 */}
            <div className="relative z-20">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-black text-slate-600 tracking-tight ml-0.5">조회 기간</label>
                {tempFilters.dateFrom && tempFilters.dateTo && (
                  <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md tabular-nums">
                    {formatToolbarDate(tempFilters.dateFrom)} ~ {formatToolbarDate(tempFilters.dateTo)}
                  </span>
                )}
              </div>
              <div className="space-y-2.5 w-full">
                {/* 퀵 기간 칩 버튼 */}
                <div className="grid grid-cols-4 gap-2 w-full">
                  {[
                    { label: '1개월', months: 1 },
                    { label: '3개월', months: 3 },
                    { label: '6개월', months: 6 },
                    { label: '1년', months: 12 },
                  ].map((item) => {
                    const isSelected = selectedQuickPeriod === item.label;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          const today = new Date();
                          const fromDate = new Date();
                          fromDate.setMonth(today.getMonth() - item.months);
                          setTempFilters(prev => ({
                            ...prev,
                            dateFrom: fromDate.toLocaleDateString('en-CA'),
                            dateTo: today.toLocaleDateString('en-CA'),
                          }));
                          setSelectedQuickPeriod(item.label);
                        }}
                        className={`py-2.5 rounded-xl font-extrabold text-xs transition-transform duration-75 shadow-2xs cursor-pointer active:scale-95 text-center ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-sm border border-blue-600'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-transparent font-bold'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {/* 날짜 선택 버튼 행 */}
                <div className="flex items-center gap-2 w-full">
                  {/* 시작일 */}
                  <div className="relative flex-1">
                    <button
                      ref={filterDateFromRef}
                      type="button"
                      onClick={() => {
                        setIsFilterToCalendarOpen(false);
                        setIsFilterFromCalendarOpen(prev => !prev);
                      }}
                      className={`w-full px-3 py-2.5 rounded-xl border transition-all text-center text-xs font-bold tabular-nums h-11 flex items-center justify-center relative cursor-pointer shadow-2xs ${
                        isFilterFromCalendarOpen
                          ? 'border-blue-600 bg-white ring-2 ring-blue-100 text-blue-600'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-slate-700'
                      }`}
                    >
                      <span className="truncate pr-4 tabular-nums">
                        {tempFilters.dateFrom ? formatToolbarDate(tempFilters.dateFrom) : '시작일'}
                      </span>
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <Calendar size={16} />
                      </span>
                    </button>
                    {isFilterFromCalendarOpen && (
                      <div
                        ref={filterFromCalendarRef}
                        className="absolute left-0 top-full mt-1.5 z-[100] bg-white rounded-2xl shadow-2xl border border-slate-100 p-2.5 w-[245px]"
                        style={{ backgroundColor: '#ffffff' }}
                      >
                        <CalendarUI
                          initialYear={
                            tempFilters.dateFrom && typeof tempFilters.dateFrom === 'string' && tempFilters.dateFrom.includes('-')
                              ? parseInt(tempFilters.dateFrom.substring(0, 4))
                              : new Date().getFullYear()
                          }
                          initialMonth={
                            tempFilters.dateFrom && typeof tempFilters.dateFrom === 'string' && tempFilters.dateFrom.includes('-')
                              ? parseInt(tempFilters.dateFrom.substring(5, 7))
                              : new Date().getMonth() + 1
                          }
                          onSelect={(y, m, d) => {
                            const formatted = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                            setTempFilters(prev => ({ ...prev, dateFrom: formatted }));
                            setSelectedQuickPeriod(null);
                            setIsFilterFromCalendarOpen(false);
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <span className="text-slate-300 font-bold shrink-0 text-xs">~</span>

                  {/* 종료일 */}
                  <div className="relative flex-1">
                    <button
                      ref={filterDateToRef}
                      type="button"
                      onClick={() => {
                        setIsFilterFromCalendarOpen(false);
                        setIsFilterToCalendarOpen(prev => !prev);
                      }}
                      className={`w-full px-3 py-2.5 rounded-xl border transition-all text-center text-xs font-bold tabular-nums h-11 flex items-center justify-center relative cursor-pointer shadow-2xs ${
                        isFilterToCalendarOpen
                          ? 'border-blue-600 bg-white ring-2 ring-blue-100 text-blue-600'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-slate-700'
                      }`}
                    >
                      <span className="truncate pr-4 tabular-nums">
                        {tempFilters.dateTo ? formatToolbarDate(tempFilters.dateTo) : '종료일'}
                      </span>
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <Calendar size={16} />
                      </span>
                    </button>
                    {isFilterToCalendarOpen && (
                      <div
                        ref={filterToCalendarRef}
                        className="absolute right-0 top-full mt-1.5 z-[100] bg-white rounded-2xl shadow-2xl border border-slate-100 p-2.5 w-[245px]"
                        style={{ backgroundColor: '#ffffff' }}
                      >
                        <CalendarUI
                          initialYear={
                            tempFilters.dateTo && typeof tempFilters.dateTo === 'string' && tempFilters.dateTo.includes('-')
                              ? parseInt(tempFilters.dateTo.substring(0, 4))
                              : new Date().getFullYear()
                          }
                          initialMonth={
                            tempFilters.dateTo && typeof tempFilters.dateTo === 'string' && tempFilters.dateTo.includes('-')
                              ? parseInt(tempFilters.dateTo.substring(5, 7))
                              : new Date().getMonth() + 1
                          }
                          onSelect={(y, m, d) => {
                            const formatted = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                            setTempFilters(prev => ({ ...prev, dateTo: formatted }));
                            setSelectedQuickPeriod(null);
                            setIsFilterToCalendarOpen(false);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. 거래 구분 선택 (전체, 매수, 매도) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5">거래 구분</label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/70">
                {[
                  { val: '전체', label: '전체' },
                  { val: '매수', label: '매수', dot: 'text-rose-500' },
                  { val: '매도', label: '매도', dot: 'text-blue-500' },
                ].map(opt => {
                  const isActive = tempFilters.type === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setTempFilters(prev => ({ ...prev, type: opt.val }))}
                      className={`py-2.5 rounded-xl text-xs transition-transform duration-75 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs font-black'
                          : 'text-slate-500 hover:text-slate-700 font-bold'
                      }`}
                    >
                      {opt.dot && <span className={`${isActive ? 'text-white' : opt.dot} text-[9px]`}>●</span>}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. 시장 구분 (전체, 국내, 해외, 기타) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5">시장 구분</label>
              <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/70">
                {[
                  { val: 'ALL', label: '전체' },
                  { val: 'KRW', label: '국내', color: 'bg-blue-600', dot: 'text-blue-500' },
                  { val: 'OVERSEAS', label: '해외', color: 'bg-amber-500', dot: 'text-amber-500' },
                  { val: 'OTHER', label: '기타', color: 'bg-emerald-600', dot: 'text-emerald-500' },
                ].map(opt => {
                  const isActive = tempFilters.currencyFilter === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setTempFilters(prev => ({ ...prev, currencyFilter: opt.val }))}
                      className={`py-2.5 rounded-xl text-xs transition-transform duration-75 active:scale-95 cursor-pointer flex items-center justify-center gap-1 min-h-[44px] ${
                        isActive
                          ? `${opt.color || 'bg-slate-800'} text-white shadow-xs font-black`
                          : 'text-slate-500 hover:text-slate-700 font-bold'
                      }`}
                    >
                      {opt.dot && !isActive && <span className={`${opt.dot} text-[9px]`}>●</span>}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. 종목 검색 */}
            <div className="space-y-1.5 relative" ref={filterStockDropdownRef}>
              <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5">종목 검색</label>
              <div className="relative w-full">
                {tempFilters.security_id ? (
                  <div className="w-full px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/60 font-bold text-slate-800 h-12 flex items-center justify-between shadow-xs">
                    <div
                      onClick={() => {
                        const nameToEdit = tempFilters.stockName.split('(')[0];
                        setTempFilters(prev => ({ ...prev, security_id: '', stockName: nameToEdit }));
                      }}
                      className="flex items-center gap-2 truncate cursor-pointer flex-1"
                      title="클릭하여 수정"
                    >
                      <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></div>
                      <span className="text-sm font-extrabold text-slate-800 truncate">
                        {tempFilters.stockName.split('(')[0]}
                      </span>
                      <span className="text-xs text-indigo-600 font-semibold shrink-0">
                        ({tempFilters.stockCode})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTempFilters(prev => ({ ...prev, security_id: '', stockName: '', stockCode: '' }));
                        setStockSearchResults([]);
                        setIsFilterStockDropdownOpen(false);
                      }}
                      className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer shrink-0 ml-2"
                      title="종목 선택 해제"
                    >
                      <X size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                ) : (
                  <div className="relative w-full">
                    {/* 네이티브 다이렉트 인풋 */}
                    <input
                      type="text"
                      placeholder="종목명 입력 (엔터로 검색)"
                      value={tempFilters.stockName || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTempFilters(prev => ({ ...prev, stockName: val, security_id: '', stockCode: '' }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (e.nativeEvent?.isComposing) return;
                          handleStockSearch(tempFilters.stockName);
                        } else if (e.key === 'Escape') {
                          setIsFilterStockDropdownOpen(false);
                        }
                      }}
                      className="w-full pl-4 pr-11 py-3 rounded-xl border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-bold text-sm text-slate-700 bg-slate-50 shadow-2xs text-center h-12 placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleStockSearch(tempFilters.stockName)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                      title="종목 검색"
                    >
                      <Search size={18} />
                    </button>
                  </div>
                )}

                {isFilterStockDropdownOpen && stockSearchResults.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 z-[100] w-full mb-1.5">
                    <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden animate-slide-up flex flex-col pointer-events-auto">
                      <div
                        ref={filterStockListRef}
                        className="overflow-y-auto overflow-x-hidden py-1 block max-h-[220px]"
                      >
                        {stockSearchResults.map((stock, i) => (
                          <button
                            key={stock.security_id || i}
                            type="button"
                            onClick={() => {
                              setTempFilters(prev => ({
                                ...prev,
                                stockName: `${stock.name}(${stock.code})`,
                                stockCode: stock.code,
                                security_id: stock.security_id,
                              }));
                              setIsFilterStockDropdownOpen(false);
                            }}
                            className="w-full min-h-[48px] h-[48px] flex-shrink-0 px-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors pointer-events-auto cursor-pointer"
                          >
                            <div className="flex flex-col">
                              <span className="text-[13px] font-bold leading-tight text-slate-700">
                                {stock.name}
                                <span className="text-[12px] font-medium ml-1.5 text-slate-400">
                                  ({stock.code})
                                </span>
                              </span>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-lg bg-slate-50 text-slate-400">
                              {stock.exchange_nm || (getStockType(stock) === 'OTHER' ? '기타' : (stock.currency === 'KRW' ? '국내' : '해외'))}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 하단 액션 버튼 바 */}
        <div className="flex-shrink-0 p-4 bg-white border-t border-slate-100 flex items-center z-30 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <button
            type="button"
            onClick={handleApply}
            className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-black text-sm flex items-center justify-center gap-1 shadow-md shadow-amber-200/50 active:scale-95 transition-transform duration-75 cursor-pointer"
          >
            <span>적용하기</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default React.memo(TradingFilterModal);
