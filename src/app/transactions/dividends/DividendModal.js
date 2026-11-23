"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Calendar,
  ChevronDown,
  Search,
  Check,
  Edit2,
  PlusCircle,
} from "lucide-react";
import { TransactionManager } from "@/lib/transactionManager";
import { CalendarUI, getCurrencySymbol } from "../trading/TradingModal";
import useMobileKeyboardModal from "@/hooks/useMobileKeyboardModal";

/**
 * ── 독립 격리 배당 등록/수정 모달 컴포넌트 ──
 * 모든 상태(formData, dropdown, input)를 자체 격리하여
 * 부모 페이지(DividendsPage)의 4,100줄 리렌더링을 완전히 차단.
 * 한글 IME composition 두두둑 끊김 현상과 고속 입력 밀림 현상을 원천 방지함.
 */
function DividendModal({
  isOpen,
  isClosing,
  onClose,
  editingDividend,
  accounts = [],
  accountNameById = {},
  isAccountsLoading = false,
  onSave,
  showAlert,
}) {
  const [mounted, setMounted] = useState(false);

  // 로컬 폼 상태
  const [formData, setFormData] = useState({
    year: '',
    month: '',
    day: '',
    account: '',
    account_id: '',
    stock: '',
    stockCode: '',
    security_id: '',
    currency: 'KRW',
    dividendAmount: '',
    exchangeRate: '1',
    totalDividend: '',
    exchange_code: '',
  });

  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [focusedAccountIndex, setFocusedAccountIndex] = useState(-1);
  const [isStockDropdownOpen, setIsStockDropdownOpen] = useState(false);
  const [searchedStocks, setSearchedStocks] = useState([]);
  const [isSearchingStock, setIsSearchingStock] = useState(false);
  const [focusedStockIndex, setFocusedStockIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  // 모바일 가상 키보드 스크롤 대응 훅
  const formRef = useMobileKeyboardModal(isOpen);

  // Refs
  const calendarButtonRef = useRef(null);
  const calendarRef = useRef(null);
  const accountRef = useRef(null);
  const accountDropdownRef = useRef(null);
  const accountListRef = useRef(null);
  const stockRef = useRef(null);
  const stockDropdownRef = useRef(null);
  const stockListRef = useRef(null);
  const priceRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 총 배당금 및 원화 환산 계산 헬퍼
  const calcTotalDividend = (divAmountStr, cur, exRateStr) => {
    const preTax = Number((divAmountStr || '').replace(/,/g, '')) || 0;
    const exRate = Number((exRateStr || '1').replace(/,/g, '')) || 1;
    if (preTax > 0) {
      const krwTotal = cur === 'KRW' ? preTax : preTax * exRate;
      const roundedTotal = cur === 'KRW' ? Math.round(krwTotal) : Math.round(krwTotal / 10) * 10;
      return roundedTotal.toLocaleString('ko-KR');
    }
    return '';
  };

  // 모달 오픈 시 폼 데이터 초기화
  useEffect(() => {
    if (!isOpen) {
      setIsCalendarOpen(false);
      setIsAccountDropdownOpen(false);
      setIsStockDropdownOpen(false);
      return;
    }

    if (editingDividend) {
      const item = editingDividend;
      const [year, month, day] = item.date.includes('-')
        ? item.date.split('-')
        : ['20' + item.date.split('/')[0], item.date.split('/')[1], item.date.split('/')[2]];
      const itemCurrency = item.currency || item.security?.currency || 'KRW';
      const isOverseas = itemCurrency !== 'KRW';

      const numAmount = item.dividend_amount !== undefined && item.dividend_amount !== null && item.dividend_amount !== ''
        ? Number(String(item.dividend_amount).replace(/,/g, ''))
        : NaN;
      const formattedAmount = !isNaN(numAmount)
        ? (isOverseas
            ? numAmount.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : numAmount.toLocaleString('ko-KR'))
        : (item.dividend_amount?.toString() || '');

      const totDiv = calcTotalDividend(formattedAmount, itemCurrency, item.exchange_rate ? item.exchange_rate.toString() : '1');

      setFormData({
        year,
        month,
        day,
        account: accountNameById[item.account_id] || item.account || '',
        account_id: item.account_id || '',
        stock: item.security?.name || item.stock_name || item.stock || '',
        stockCode: item.security?.code || item.stock_code || item.stockCode || '',
        security_id: item.security_id || '',
        currency: itemCurrency,
        dividendAmount: formattedAmount,
        exchangeRate: item.exchange_rate ? item.exchange_rate.toString() : '1',
        totalDividend: totDiv,
        exchange_code: item.security?.exchange_code || item.exchange_code || '',
      });
      setSelectedAccountId(item.account_id || null);
    } else {
      const now = new Date();
      setFormData({
        year: now.getFullYear().toString(),
        month: (now.getMonth() + 1).toString().padStart(2, '0'),
        day: now.getDate().toString().padStart(2, '0'),
        account: '',
        account_id: '',
        stock: '',
        stockCode: '',
        security_id: '',
        currency: 'KRW',
        dividendAmount: '',
        exchangeRate: '1',
        totalDividend: '',
        exchange_code: '',
      });
      setSelectedAccountId(null);
    }
  }, [isOpen, editingDividend, accountNameById]);

  // 환율 자동 조회 (모달 내부에서만 처리하여 외부 리렌더링 차단)
  useEffect(() => {
    if (!isOpen) return;
    if (formData.currency === 'KRW') {
      if (formData.exchangeRate !== '1') {
        const tot = calcTotalDividend(formData.dividendAmount, 'KRW', '1');
        setFormData(prev => ({ ...prev, exchangeRate: '1', totalDividend: tot }));
      }
      return;
    }

    const { year, month, day, currency } = formData;
    if (year && year.length === 4 && month && day && currency && currency !== 'KRW') {
      const today = new Date();
      const inputDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      if (inputDate > today) return;

      const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      TransactionManager.getExchangeRate(dateStr, currency, 'KRW')
        .then(rate => {
          if (rate) {
            const rateStr = rate.toString();
            setFormData(prev => {
              if (prev.exchangeRate === rateStr) return prev;
              const tot = calcTotalDividend(prev.dividendAmount, prev.currency, rateStr);
              return { ...prev, exchangeRate: rateStr, totalDividend: tot };
            });
          }
        })
        .catch(err => console.error('환율 조회 실패:', err));
    }
  }, [isOpen, formData.currency, formData.year, formData.month, formData.day]);

  // 바깥 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        calendarRef.current &&
        !calendarRef.current.contains(e.target) &&
        calendarButtonRef.current &&
        !calendarButtonRef.current.contains(e.target)
      ) {
        setIsCalendarOpen(false);
      }
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target)) {
        setIsAccountDropdownOpen(false);
      }
      if (stockDropdownRef.current && !stockDropdownRef.current.contains(e.target)) {
        setIsStockDropdownOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 날짜 선택
  const handleDateSelect = (y, m, d) => {
    setFormData(prev => ({
      ...prev,
      year: y.toString(),
      month: m.toString().padStart(2, '0'),
      day: d.toString().padStart(2, '0'),
    }));
    setIsCalendarOpen(false);
  };

  // 종목 검색 실행
  const executeStockSearch = useCallback(async (term) => {
    let cleanTerm = (term || '').trim();
    const match = cleanTerm.match(/\[(.*?)\]/);
    if (match && match[1]) {
      cleanTerm = match[1];
    } else {
      const parts = cleanTerm.split('] ');
      if (parts.length > 1) cleanTerm = parts[1];
    }

    if (!cleanTerm) {
      setSearchedStocks([]);
      return;
    }

    setIsSearchingStock(true);
    setIsStockDropdownOpen(true);
    setFocusedStockIndex(-1);

    try {
      const results = await TransactionManager.searchStocksByName(cleanTerm, null);
      setSearchedStocks(results || []);
      if (results && results.length > 0) setFocusedStockIndex(0);
    } catch (err) {
      console.error(err);
      setSearchedStocks([]);
    } finally {
      setIsSearchingStock(false);
    }
  }, []);

  // 종목 선택 적용
  const handleSelectStock = (stock) => {
    const stockCur =
      stock.currency ||
      (['KOSPI', 'KOSDAQ', 'KONEX', 'KRX'].includes(stock.market) || stock.exchange_code === 'KRX' ? 'KRW' : 'USD');

    setFormData(prev => {
      const tot = calcTotalDividend(prev.dividendAmount, stockCur, prev.exchangeRate);
      return {
        ...prev,
        security_id: stock.security_id,
        stock: `[${stock.code}] ${stock.name}`,
        stockCode: stock.code,
        exchange_code: stock.exchange_code || '',
        currency: stockCur,
        totalDividend: tot,
      };
    });
    setIsStockDropdownOpen(false);
    setFocusedStockIndex(-1);
    setTimeout(() => priceRef.current?.focus(), 50);
  };

  // 배당금 입력 변경 (0ms 동기 처리, 디바운스 없음)
  const handleDividendAmountChange = (e) => {
    let raw = e.target.value.replace(/,/g, '');
    const isOverseas = formData.currency && formData.currency !== 'KRW';
    let formatted = "";

    if (isOverseas) {
      if (/[^0-9.]/.test(raw)) return;
      const parts = raw.split('.');
      if (parts.length > 2) return;
      if (parts[1] && parts[1].length > 2) return;
      if (parts[0].length > 12) return;
      if (parts[0] !== "") {
        formatted = Number(parts[0]).toLocaleString('ko-KR');
      }
      if (raw.includes('.') || parts[1] !== undefined) {
        formatted += "." + (parts[1] || "");
      }
    } else {
      const digitsOnly = raw.replace(/[^\d]/g, '');
      if (digitsOnly.length > 12) return;
      formatted = digitsOnly === '' ? '' : Number(digitsOnly).toLocaleString('ko-KR');
    }

    setFormData(prev => {
      const tot = calcTotalDividend(formatted, prev.currency, prev.exchangeRate);
      return { ...prev, dividendAmount: formatted, totalDividend: tot };
    });
  };

  // 폼 제출
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (loading) return;

    if (!formData.year || !formData.month || !formData.day) {
      showAlert("입력 오류", "배당일을 선택해주세요.", "error");
      return;
    }
    if (!formData.account_id) {
      showAlert("입력 오류", "계좌를 선택해주세요.", "error");
      return;
    }
    if (!formData.security_id) {
      showAlert("입력 오류", "종목을 검색하여 선택해주세요.", "error");
      return;
    }
    if (!formData.dividendAmount) {
      showAlert("입력 오류", "배당금을 입력해주세요.", "error");
      return;
    }

    setLoading(true);
    try {
      await onSave({
        ...formData,
        editingId: editingDividend ? editingDividend.id : null,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              {editingDividend ? <Edit2 size={16} strokeWidth={2.5} /> : <PlusCircle size={18} strokeWidth={2.5} />}
            </div>
            <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">
              {editingDividend ? '배당 수정' : '배당 등록'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* 폼 바디 */}
        <form ref={formRef} onSubmit={handleSubmit} className="p-5 md:p-6 overflow-y-auto overscroll-contain flex-1 space-y-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {/* 1. 배당일 & 계좌 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">배당일</label>
              <button
                ref={calendarButtonRef}
                type="button"
                onClick={() => setIsCalendarOpen(prev => !prev)}
                className={`w-full h-12 px-3.5 rounded-2xl border transition-all relative flex items-center justify-center text-xs font-extrabold cursor-pointer shadow-xs ${
                  isCalendarOpen
                    ? 'border-blue-600 bg-white ring-2 ring-blue-100 text-blue-600'
                    : 'border-slate-200 bg-slate-50/70 hover:bg-white text-slate-800'
                }`}
              >
                <span className="text-center font-extrabold text-xs">
                  {formData.year && formData.month && formData.day
                    ? `${formData.year}-${formData.month.toString().padStart(2, '0')}-${formData.day.toString().padStart(2, '0')}`
                    : '배당일 선택'}
                </span>
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Calendar size={18} className={isCalendarOpen ? 'text-blue-500' : 'text-slate-400'} />
                </span>
              </button>

              {isCalendarOpen && (
                <div
                  ref={calendarRef}
                  className="absolute left-0 top-full mt-1.5 z-[100] bg-white rounded-2xl shadow-2xl border border-slate-100 p-2.5 animate-slide-up w-[245px]"
                  style={{ backgroundColor: '#ffffff' }}
                >
                  <CalendarUI
                    initialYear={parseInt(formData.year) || new Date().getFullYear()}
                    initialMonth={parseInt(formData.month) || (new Date().getMonth() + 1)}
                    onSelect={handleDateSelect}
                  />
                </div>
              )}
            </div>

            <div className="relative" ref={accountDropdownRef}>
              <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">계좌</label>
              <button
                ref={accountRef}
                type="button"
                onClick={() => setIsAccountDropdownOpen(prev => !prev)}
                className={`w-full h-12 px-3.5 rounded-2xl border transition-all flex items-center justify-between text-xs cursor-pointer shadow-xs text-left ${
                  isAccountDropdownOpen
                    ? 'border-blue-500 ring-2 ring-blue-100 bg-white text-blue-600'
                    : 'border-slate-200 bg-slate-50/70 hover:bg-white text-slate-800'
                }`}
              >
                <span className={`truncate text-xs tracking-tight ${formData.account ? 'text-slate-800 font-bold' : 'text-slate-400 font-medium'}`}>
                  {formData.account || '계좌선택'}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${
                    isAccountDropdownOpen ? 'rotate-180 text-blue-500' : ''
                  }`}
                />
              </button>
              {isAccountDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/70 z-50 p-1.5 animate-fade-in">
                  <div ref={accountListRef} className="py-1 max-h-52 overflow-y-auto space-y-0.5">
                    {isAccountsLoading ? (
                      <div className="px-3 py-2 text-xs font-semibold text-slate-400 text-center tracking-tight">불러오는 중...</div>
                    ) : accounts.length === 0 ? (
                      <div className="px-3 py-2 text-xs font-semibold text-slate-400 text-center tracking-tight">등록된 계좌가 없습니다</div>
                    ) : (
                      accounts.map((acc, index) => {
                        const isSelected = selectedAccountId === acc.account_id || formData.account === acc.account_nm;
                        const isFocused = focusedAccountIndex === index;
                        return (
                          <button
                            key={acc.account_id}
                            type="button"
                            className={`w-full px-2.5 py-2 text-xs rounded-xl transition-all flex items-center justify-between cursor-pointer tracking-tight ${
                              isSelected
                                ? 'bg-blue-50 text-blue-600 font-black'
                                : isFocused
                                  ? 'bg-slate-100/80 text-slate-900 font-semibold'
                                  : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 font-semibold'
                            }`}
                            onMouseEnter={() => setFocusedAccountIndex(index)}
                            onClick={() => {
                              setFormData(prev => ({ ...prev, account: acc.account_nm, account_id: acc.account_id }));
                              setSelectedAccountId(acc.account_id);
                              setIsAccountDropdownOpen(false);
                              setTimeout(() => stockRef.current?.focus(), 50);
                            }}
                          >
                            <span className="truncate">{acc.account_nm}</span>
                            {isSelected && <Check size={14} className="text-blue-600 shrink-0 ml-1.5" strokeWidth={2.5} />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. 종목 & 배당금 (0ms 다이렉트 인풋) */}
          <div className="grid grid-cols-5 gap-3">
            <div className="relative col-span-3">
              <div className="flex items-center gap-1.5 ml-0.5 mb-1.5">
                <label className="block text-xs font-black text-slate-600 tracking-tight">종목</label>
                {formData.security_id && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 leading-none ${
                    formData.currency === 'KRW'
                      ? 'bg-blue-50 text-blue-600 border-blue-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {formData.currency === 'KRW' ? '국내' : '해외'}
                  </span>
                )}
              </div>
              <div className="relative" ref={stockDropdownRef}>
                {formData.security_id ? (
                  <div
                    onClick={() => {
                      setFormData(prev => ({ ...prev, security_id: '', stock: prev.stock.replace(`[${prev.stockCode}] `, '') }));
                      setTimeout(() => {
                        stockRef.current?.focus();
                        stockRef.current?.select();
                      }, 50);
                    }}
                    ref={stockRef}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsStockDropdownOpen(false);
                        setFormData(prev => ({ ...prev, security_id: '', stock: prev.stock ? prev.stock.replace(`[${prev.stockCode}] `, '') : '' }));
                        setTimeout(() => {
                          stockRef.current?.focus();
                          stockRef.current?.select();
                        }, 50);
                      } else if (e.key === 'Tab' && !e.shiftKey) {
                        e.preventDefault();
                        priceRef.current?.focus();
                      }
                    }}
                    className="w-full h-12 px-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white font-bold text-slate-800 text-xs flex items-center justify-between cursor-pointer transition-all hover:border-blue-400 shadow-xs"
                  >
                    <span className="truncate">
                      {formData.stock.replace(`[${formData.stockCode}] `, '')}
                      <span className="text-[11px] text-slate-400 font-medium ml-1">({formData.stockCode})</span>
                    </span>
                    <Search size={16} className="text-slate-400 shrink-0 ml-1.5" />
                  </div>
                ) : (
                  <div className="relative w-full">
                    {/* 네이티브 다이렉트 인풋 (부모 컴포넌트 간섭 없이 0ms 즉각 타이핑 & IME composition 보존) */}
                    <input
                      ref={stockRef}
                      type="text"
                      placeholder="종목명 입력 (엔터로 검색)"
                      value={formData.stock}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => ({ ...prev, stock: val, security_id: '' }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (isStockDropdownOpen && focusedStockIndex >= 0 && searchedStocks[focusedStockIndex]) {
                            handleSelectStock(searchedStocks[focusedStockIndex]);
                          } else {
                            executeStockSearch(formData.stock);
                          }
                        } else if (e.key === 'Tab') {
                          if (isStockDropdownOpen) {
                            setIsStockDropdownOpen(false);
                            setFocusedStockIndex(-1);
                          }
                          if (!e.shiftKey) {
                            e.preventDefault();
                            priceRef.current?.focus();
                          }
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          if (!isStockDropdownOpen) {
                            executeStockSearch(formData.stock);
                          } else {
                            setFocusedStockIndex(prev => Math.min(prev + 1, searchedStocks.length - 1));
                          }
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          if (isStockDropdownOpen) {
                            setFocusedStockIndex(prev => Math.max(prev - 1, 0));
                          }
                        } else if (e.key === 'Escape') {
                          setIsStockDropdownOpen(false);
                          setFocusedStockIndex(-1);
                        }
                      }}
                      className="w-full h-12 pl-3.5 pr-9 rounded-2xl border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-slate-800 text-xs bg-slate-50/70 focus:bg-white shadow-xs transition-all placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer text-slate-400 hover:text-slate-600"
                      onClick={() => {
                        if (isStockDropdownOpen) {
                          setIsStockDropdownOpen(false);
                        } else {
                          executeStockSearch(formData.stock);
                        }
                      }}
                    >
                      <Search size={16} />
                    </button>
                  </div>
                )}

                {isStockDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 w-full bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden">
                    <div ref={stockListRef} className="py-2 max-h-[286px] overflow-y-auto block overflow-x-hidden">
                      {isSearchingStock ? (
                        <div className="px-4 py-2 text-sm text-slate-400 text-center">검색 중...</div>
                      ) : searchedStocks.length === 0 ? (
                        <div className="px-4 py-2 text-sm text-slate-400 text-center">검색 결과가 없습니다</div>
                      ) : (
                        searchedStocks.map((stock, index) => (
                          <button
                            key={stock.security_id || stock.code}
                            type="button"
                            className={`w-full px-3 py-2 text-left transition-colors flex items-center justify-between cursor-pointer ${
                              focusedStockIndex === index ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50'
                            }`}
                            onMouseEnter={() => setFocusedStockIndex(index)}
                            onClick={() => handleSelectStock(stock)}
                          >
                            <span className={`font-semibold text-xs leading-tight break-words truncate mr-2 ${focusedStockIndex === index ? 'text-blue-600' : 'text-slate-700'}`}>
                              {stock.name} <span className={`text-[11px] font-medium tracking-tight ${focusedStockIndex === index ? 'text-blue-400' : 'text-slate-400'}`}>({stock.code})</span>
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${
                              (stock.currency === 'KRW' || stock.exchange_code === 'KRX')
                                ? 'bg-blue-50 text-blue-600 border-blue-200' 
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {(stock.currency === 'KRW' || stock.exchange_code === 'KRX') ? '국내' : '해외'}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">배당금</label>
              <div className="flex items-center w-full h-12 px-3 rounded-2xl border border-slate-200 focus-within:border-blue-500 focus-within:bg-white transition-all bg-slate-50/70 gap-1 shadow-xs">
                <input
                  ref={priceRef}
                  placeholder="0"
                  value={formData.dividendAmount}
                  inputMode={formData.currency && formData.currency !== 'KRW' ? "decimal" : "numeric"}
                  onChange={handleDividendAmountChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      priceRef.current?.blur();
                      handleSubmit(e);
                    }
                  }}
                  className={`flex-1 bg-transparent outline-none text-right text-xs min-w-0 placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs placeholder:text-right ${
                    !formData.dividendAmount || formData.dividendAmount === '0' ? 'text-slate-400 font-medium' : 'text-slate-800 font-bold'
                  }`}
                />
                {formData.currency && formData.currency !== 'KRW' ? (
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md font-bold shrink-0 leading-none">
                    {getCurrencySymbol(formData.currency)}
                  </span>
                ) : (
                  <span className="text-slate-400 font-medium text-xs shrink-0">원</span>
                )}
              </div>
            </div>
          </div>

          {/* 3. 총 배당금 */}
          {formData.currency && formData.currency !== 'KRW' ? (
            <div className="px-5 py-3 rounded-2xl bg-slate-50/60 border border-slate-200/80 space-y-2 shadow-xs">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-slate-600 tracking-tight ml-0.5">적용 환율</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-slate-700 text-sm tabular-nums">
                    {formData.exchangeRate ? Number(formData.exchangeRate).toLocaleString('ko-KR', { maximumFractionDigits: 2 }) : '-'}
                  </span>
                  <span className="text-xs font-bold text-slate-400">원</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-600 tracking-tight ml-0.5">총 배당금</span>
                  {formData.totalDividend && (
                    <span className="text-[11px] font-semibold text-slate-400 ml-0.5">
                      ≈ {formData.totalDividend}원
                    </span>
                  )}
                </div>
                <div className="text-right flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-amber-600 tabular-nums">{formData.dividendAmount || '0'}</span>
                  <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md font-bold leading-none">
                    {getCurrencySymbol(formData.currency)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">총 배당금</label>
              <div className="px-5 rounded-2xl bg-slate-50/60 border border-slate-200/80 shadow-xs flex justify-end items-center h-14">
                <div className="text-right flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-blue-600 tabular-nums">
                    {formData.totalDividend || '0'}
                  </span>
                  <span className="text-sm font-bold text-slate-400">원</span>
                </div>
              </div>
            </div>
          )}

          {/* 4. Footer 버튼 */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 h-12 rounded-2xl font-bold text-sm transition-all shadow-md ${
                loading 
                  ? 'bg-slate-300 text-white cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/25 active:scale-[0.98] cursor-pointer'
              }`}
            >
              {loading ? '처리 중...' : (editingDividend ? '수정' : '등록')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default React.memo(DividendModal);
