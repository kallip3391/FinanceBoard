"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Calendar,
  ChevronDown,
  Plus,
  Trash2,
  Search,
  Check,
  Edit2,
  PlusCircle,
} from "lucide-react";
import { TransactionManager, TRADE_TYPES } from "@/lib/transactionManager";
import useMobileKeyboardModal from "@/hooks/useMobileKeyboardModal";

// ── 통화 기호 헬퍼 ──
export const getCurrencySymbol = (currency) => {
  switch (currency) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'JPY': return '¥';
    case 'CNY': return '¥';
    case 'GBP': return '£';
    case 'HKD': return 'HK$';
    default: return currency ? `${currency} ` : '$';
  }
};

// ── 종목 구분 헬퍼 ──
export const getStockType = (item) => {
  if (!item) return 'DOMESTIC';
  const txType = item.transaction_type || '';
  if (txType === 'other') return 'OTHER';
  if (txType === 'overseas') return 'OVERSEAS';
  if (txType === 'domestic') return 'DOMESTIC';

  const name = item.stock_name || item.security?.name || item.name || item.stock || '';
  const code = item.stock_code || item.security?.code || item.code || item.stockCode || '';
  const exchangeCode = item.security?.exchange_code || item.exchange_code || '';
  const marketType = item.security?.market_type || item.market_type || '';
  const currency = item.currency || item.security?.currency || '';

  if (
    marketType === 'OTHER' ||
    exchangeCode === 'OTHER' ||
    name.includes('금현물') ||
    (code && code.toUpperCase() === 'GOLD' && currency === 'KRW')
  ) {
    return 'OTHER';
  }
  if (currency && currency !== 'KRW') {
    return 'OVERSEAS';
  }
  return 'DOMESTIC';
};

// ── 금액 및 원화환산 계산 ──
export const calculateAmountAndKRW = (qtyStr, priceStr, currency, rateStr) => {
  const qty = parseFloat((qtyStr || '').replace(/,/g, '')) || 0;
  const price = parseFloat((priceStr || '').replace(/,/g, '')) || 0;
  const isOverseas = currency && currency !== 'KRW';

  let amount = '';
  let totalKRW = '';

  if (qty > 0 && price > 0) {
    const total = qty * price;
    if (isOverseas) {
      const fixedTotal = total.toFixed(2);
      const [intPart, decPart] = fixedTotal.split('.');
      amount = Number(intPart).toLocaleString('ko-KR') + "." + decPart;
    } else {
      amount = Math.round(total).toLocaleString('ko-KR');
    }

    const amountVal = parseFloat(amount.replace(/,/g, '')) || 0;
    const rateVal = parseFloat((rateStr || '0').replace(/,/g, '')) || 0;
    if (amountVal > 0) {
      const krw = amountVal * (isOverseas ? rateVal : 1);
      const rounded = Math.round(krw / 10) * 10;
      totalKRW = rounded.toLocaleString('ko-KR');
    }
  }

  return { amount, totalKRW };
};

// ── 심플 캘린더 컴포넌트 ──
export function CalendarUI({ initialYear, initialMonth, onSelect }) {
  const [viewDate, setViewDate] = useState(new Date(initialYear, initialMonth - 1, 1));

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

  const changeMonth = (offset) => {
    setViewDate(new Date(currentYear, currentMonth + offset, 1));
  };

  const changeYear = (offset) => {
    setViewDate(new Date(currentYear + offset, currentMonth, 1));
  };

  const days = [];
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    days.push({ day: prevMonthDays - i, current: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, current: true });
  }

  return (
    <div className="select-none text-xs bg-white rounded-xl" style={{ backgroundColor: '#ffffff' }}>
      <div className="flex justify-between items-center mb-2 px-1 bg-white" style={{ backgroundColor: '#ffffff' }}>
        <span className="font-bold tabular-nums text-slate-800 text-xs tracking-tight">{currentYear}년 {currentMonth + 1}월</span>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => changeYear(-1)} className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" title="1년 전">
            «
          </button>
          <button type="button" onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" title="1개월 전">
            ‹
          </button>
          <button type="button" onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" title="1개월 후">
            ›
          </button>
          <button type="button" onClick={() => changeYear(1)} className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" title="1년 후">
            »
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center mb-1 bg-white" style={{ backgroundColor: '#ffffff' }}>
        {['일', '월', '화', '수', '목', '금', '토'].map((d, idx) => (
          <span key={d} className={`text-[10px] font-bold ${idx === 0 ? 'text-rose-400' : idx === 6 ? 'text-blue-400' : 'text-slate-400'}`}>
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5 bg-white" style={{ backgroundColor: '#ffffff' }}>
        {days.map((d, i) => (
          <button
            key={i}
            type="button"
            onClick={() => d.current && onSelect(currentYear, currentMonth + 1, d.day)}
            className={`h-7 w-7 mx-auto rounded-lg text-xs font-bold tabular-nums transition-all flex items-center justify-center ${d.current
              ? 'text-slate-700 hover:bg-blue-600 hover:text-white cursor-pointer active:scale-95'
              : 'text-slate-200 pointer-events-none'
              } ${d.current && d.day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear()
                ? 'bg-blue-50 text-blue-600'
                : ''
              }`}
          >
            {d.day}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * ── 독립 격리 매매 등록/수정 모달 컴포넌트 ──
 * 모든 상태(formData, dropdown, input)를 자체 격리하여
 * 부모 페이지(TransactionsPage)의 5,000줄 리렌더링을 완전히 차단.
 * 한글 IME composition 두두둑 끊김 현상과 고속 입력 밀림 현상을 원천 방지함.
 */
function TradingModal({
  isOpen,
  isClosing,
  onClose,
  editingTransaction,
  accounts = [],
  accountNameById = {},
  isAccountsLoading = false,
  currencyFilter = 'ALL',
  onSave,
  onOpenAddAccount,
  onDeleteAccount,
  onOpenAddStock,
  onDeleteStock,
  showAlert,
}) {
  const [mounted, setMounted] = useState(false);

  // 로컬 폼 상태
  const [formData, setFormData] = useState({
    year: '',
    month: '',
    day: '',
    account: '',
    stock: '',
    stockCode: '',
    security_id: '',
    type: '매수',
    quantity: '',
    price: '',
    amount: '',
    currency: 'KRW',
    exchangeRate: '1',
    totalKRW: '',
    exchange_code: '',
    market_type: '',
    transaction_type: '',
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
  const quantityRef = useRef(null);
  const priceRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 모달 오픈 시 폼 데이터 초기화
  useEffect(() => {
    if (!isOpen) {
      setIsCalendarOpen(false);
      setIsAccountDropdownOpen(false);
      setIsStockDropdownOpen(false);
      return;
    }

    if (editingTransaction) {
      const tx = editingTransaction;
      const [year, month, day] = tx.date.includes('-')
        ? tx.date.split('-')
        : ['20' + tx.date.split('/')[0], tx.date.split('/')[1], tx.date.split('/')[2]];
      const txCurrency = tx.currency || tx.security?.currency || 'KRW';
      const isOverseas = txCurrency !== 'KRW';

      const numPrice = tx.price !== undefined && tx.price !== null && tx.price !== ''
        ? Number(String(tx.price).replace(/,/g, ''))
        : NaN;
      const formattedPrice = !isNaN(numPrice)
        ? (isOverseas
            ? numPrice.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : numPrice.toLocaleString('ko-KR'))
        : (tx.price?.toString() || '');

      const numAmount = tx.amount !== undefined && tx.amount !== null && tx.amount !== ''
        ? Number(String(tx.amount).replace(/,/g, ''))
        : NaN;
      const formattedAmount = !isNaN(numAmount)
        ? (isOverseas
            ? numAmount.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : numAmount.toLocaleString('ko-KR'))
        : (tx.amount?.toString() || '');

      setFormData({
        year,
        month,
        day,
        account: accountNameById[tx.account_id] || tx.account || '',
        stock: tx.security?.name || tx.stock_name || tx.stock || '',
        stockCode: tx.security?.code || tx.stock_code || tx.stockCode || '',
        security_id: tx.security_id || '',
        type: tx.trade_type === TRADE_TYPES.BUY || tx.trade_type === 'BUY' || tx.type === '매수' ? '매수' : '매도',
        quantity: typeof tx.quantity === 'number' ? tx.quantity.toLocaleString('ko-KR') : (tx.quantity?.toString() || ''),
        price: formattedPrice,
        amount: formattedAmount,
        currency: txCurrency,
        exchangeRate: tx.exchange_rate ? tx.exchange_rate.toString() : '1',
        totalKRW: tx.exchange_total_rate ? tx.exchange_total_rate.toLocaleString('ko-KR') : '',
        exchange_code: tx.security?.exchange_code || tx.exchange_code || '',
        market_type: tx.security?.market_type || tx.market_type || '',
        transaction_type: tx.transaction_type || '',
      });
      setSelectedAccountId(tx.account_id || null);
    } else {
      const now = new Date();
      const initialCurrency = currencyFilter === 'OVERSEAS' ? 'USD' : 'KRW';
      setFormData({
        year: now.getFullYear().toString(),
        month: (now.getMonth() + 1).toString().padStart(2, '0'),
        day: now.getDate().toString().padStart(2, '0'),
        account: '',
        stock: '',
        stockCode: '',
        security_id: '',
        type: '매수',
        quantity: '',
        price: '',
        amount: '',
        currency: initialCurrency,
        exchangeRate: initialCurrency === 'KRW' ? '1' : '',
        totalKRW: '',
        exchange_code: '',
        market_type: '',
        transaction_type: '',
      });
      setSelectedAccountId(null);
    }
  }, [isOpen, editingTransaction, accountNameById, currencyFilter]);

  // 환율 자동 조회 (모달 내부에서만 처리하여 외부 리렌더링 차단)
  useEffect(() => {
    if (!isOpen) return;
    if (formData.currency === 'KRW') {
      if (formData.exchangeRate !== '1') {
        const { amount, totalKRW } = calculateAmountAndKRW(formData.quantity, formData.price, 'KRW', '1');
        setFormData(prev => ({ ...prev, exchangeRate: '1', amount, totalKRW }));
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
              const { amount, totalKRW } = calculateAmountAndKRW(prev.quantity, prev.price, prev.currency, rateStr);
              return { ...prev, exchangeRate: rateStr, amount, totalKRW };
            });
          }
        })
        .catch(err => console.error('환율 조회 실패:', err));
    }
  }, [isOpen, formData.currency, formData.year, formData.month, formData.day]);

  // 바깥 클릭 감지 (달력, 계좌, 종목 드롭다운)
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
    const isOther =
      stock.market_type === 'OTHER' ||
      stock.exchange_code === 'OTHER' ||
      (stock.name || '').includes('금현물') ||
      (stock.code || '').toUpperCase() === 'GOLD';
    const stockCur =
      stock.currency ||
      (['KOSPI', 'KOSDAQ', 'KONEX', 'KRX'].includes(stock.market) || stock.exchange_code === 'KRX' ? 'KRW' : 'USD');

    setFormData(prev => {
      const { amount, totalKRW } = calculateAmountAndKRW(prev.quantity, prev.price, stockCur, prev.exchangeRate);
      return {
        ...prev,
        security_id: stock.security_id,
        stock: `[${stock.code}] ${stock.name}`,
        stockCode: stock.code,
        exchange_code: stock.exchange_code || (isOther ? 'OTHER' : ''),
        market_type: isOther ? 'OTHER' : (stockCur === 'KRW' ? 'DOMESTIC' : 'OVERSEAS'),
        currency: stockCur,
        amount,
        totalKRW,
      };
    });
    setIsStockDropdownOpen(false);
    setFocusedStockIndex(-1);
    setTimeout(() => quantityRef.current?.focus(), 50);
  };

  // 수량 입력 변경 (0ms 동기 처리, 디바운스 없음)
  const handleQuantityChange = (e) => {
    const raw = e.target.value.replace(/,/g, '');
    const digitsOnly = raw.replace(/[^\d]/g, '');
    if (digitsOnly.length > 6) return;
    const formatted = digitsOnly === '' ? '' : Number(digitsOnly).toLocaleString('ko-KR');

    setFormData(prev => {
      const { amount, totalKRW } = calculateAmountAndKRW(formatted, prev.price, prev.currency, prev.exchangeRate);
      return { ...prev, quantity: formatted, amount, totalKRW };
    });
  };

  // 단가 입력 변경 (0ms 동기 처리, 디바운스 없음)
  const handlePriceChange = (e) => {
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
      const { amount, totalKRW } = calculateAmountAndKRW(prev.quantity, formatted, prev.currency, prev.exchangeRate);
      return { ...prev, price: formatted, amount, totalKRW };
    });
  };

  // 폼 제출
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (loading) return;

    if (!formData.year || !formData.month || !formData.day) {
      showAlert("입력 오류", "거래일을 선택해주세요.", "error");
      return;
    }
    if (!formData.account) {
      showAlert("입력 오류", "계좌를 선택해주세요.", "error");
      return;
    }
    if (!formData.stock.trim() || !formData.stockCode.trim()) {
      showAlert("입력 오류", "종목을 검색하여 선택해주세요.", "error");
      return;
    }
    if (!formData.quantity || formData.quantity === '0') {
      showAlert("입력 오류", "수량을 입력해주세요.", "error");
      return;
    }
    if (!formData.price || formData.price === '0') {
      showAlert("입력 오류", "단가를 입력해주세요.", "error");
      return;
    }

    setLoading(true);
    try {
      await onSave({
        ...formData,
        editingId: editingTransaction ? editingTransaction.id : null,
        selectedAccountId,
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
          isClosing ? 'max-md:animate-sheet-down md:animate-modal-out pointer-events-none' : 'max-md:animate-sheet-up md:animate-page-slide pointer-events-auto'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모바일 상단 드래그 핸들 */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto my-3 shrink-0 md:hidden" />

        {/* 헤더 */}
        <div className="flex-shrink-0 flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              {editingTransaction ? <Edit2 size={16} strokeWidth={2.5} /> : <PlusCircle size={18} strokeWidth={2.5} />}
            </div>
            <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">
              {editingTransaction ? '수정' : '등록'}
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
          {/* 1. 거래일 & 구분 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">거래일</label>
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
                    : '거래일 선택'}
                </span>
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Calendar size={18} className={isCalendarOpen ? 'text-blue-500' : 'text-slate-400'} />
                </span>
              </button>

              {isCalendarOpen && (
                <div
                  ref={calendarRef}
                  className="absolute left-0 top-full mt-1.5 z-[100] bg-white rounded-2xl shadow-2xl border border-slate-100 p-2.5 w-[245px]"
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

            <div>
              <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">구분</label>
              <div className="h-12 p-1 bg-slate-100/90 rounded-2xl flex items-center gap-1 border border-slate-200/50">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type: '매수' }))}
                  className={`flex-1 h-full rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    formData.type === '매수'
                      ? 'bg-rose-500 text-white shadow-xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <span className={formData.type === '매수' ? 'text-white' : 'text-rose-500'}>●</span>
                  매수
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type: '매도' }))}
                  className={`flex-1 h-full rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    formData.type === '매도'
                      ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <span className={formData.type === '매도' ? 'text-white' : 'text-blue-500'}>●</span>
                  매도
                </button>
              </div>
            </div>
          </div>

          {/* 2. 계좌 */}
          <div>
            <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">계좌</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1" ref={accountDropdownRef}>
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
                                setFormData(prev => ({ ...prev, account: acc.account_nm }));
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

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsAccountDropdownOpen(false);
                    if (onOpenAddAccount) onOpenAddAccount();
                  }}
                  className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all inline-flex items-center justify-center cursor-pointer"
                  title="계좌 추가"
                >
                  <Plus size={22} />
                </button>
                <button
                  type="button"
                  disabled={!formData.account}
                  onClick={() => {
                    if (formData.account && onDeleteAccount) {
                      onDeleteAccount(formData.account);
                    }
                  }}
                  className={`p-2 transition-all inline-flex items-center justify-center rounded-xl ${
                    formData.account 
                      ? 'text-slate-300 hover:text-red-500 hover:bg-red-50 cursor-pointer' 
                      : 'text-slate-200 cursor-not-allowed'
                  }`}
                  title="계좌 삭제"
                >
                  <Trash2 size={22} />
                </button>
              </div>
            </div>
          </div>

          {/* 3. 종목 */}
          <div>
            <div className="flex items-center gap-1.5 ml-0.5 mb-1.5">
              <label className="block text-xs font-black text-slate-600 tracking-tight">종목</label>
              {formData.security_id && (() => {
                const stType = getStockType(formData);
                return (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 leading-none ${
                    stType === 'OTHER'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : stType === 'OVERSEAS'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-blue-50 text-blue-600 border-blue-200'
                  }`}>
                    {stType === 'OTHER' ? '기타' : stType === 'OVERSEAS' ? '해외' : '국내'}
                  </span>
                );
              })()}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1" ref={stockDropdownRef}>
                {formData.security_id ? (
                  <div
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        security_id: '',
                        stock: prev.stock.replace(`[${prev.stockCode}] `, ''),
                      }));
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
                        setFormData(prev => ({
                          ...prev,
                          security_id: '',
                          stock: prev.stock ? prev.stock.replace(`[${prev.stockCode}] `, '') : '',
                        }));
                        setTimeout(() => {
                          stockRef.current?.focus();
                          stockRef.current?.select();
                        }, 50);
                      } else if (e.key === 'Tab' && !e.shiftKey) {
                        e.preventDefault();
                        quantityRef.current?.focus();
                      }
                    }}
                    className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white font-bold text-slate-800 text-xs flex items-center justify-between cursor-pointer transition-all hover:border-blue-400 shadow-xs"
                  >
                    <span className="truncate">
                      {formData.stock.replace(`[${formData.stockCode}] `, '')}
                      <span className="text-[11px] text-slate-400 font-medium ml-1">({formData.stockCode})</span>
                    </span>
                    <Search size={18} className="text-slate-400 shrink-0 ml-2" />
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
                            quantityRef.current?.focus();
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
                      className="w-full h-12 pl-4 pr-10 rounded-2xl border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-slate-800 text-xs bg-slate-50/70 focus:bg-white shadow-xs transition-all placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 cursor-pointer text-slate-400 hover:text-slate-600"
                      onClick={() => {
                        if (isStockDropdownOpen) {
                          setIsStockDropdownOpen(false);
                        } else {
                          executeStockSearch(formData.stock);
                        }
                      }}
                    >
                      <Search size={18} />
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
                            className={`w-full px-4 py-3 text-left transition-colors flex items-center justify-between cursor-pointer ${
                              focusedStockIndex === index ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50'
                            }`}
                            onMouseEnter={() => setFocusedStockIndex(index)}
                            onClick={() => handleSelectStock(stock)}
                          >
                            <span className={`font-semibold text-sm leading-tight break-words truncate mr-2 ${focusedStockIndex === index ? 'text-blue-600' : 'text-slate-700'}`}>
                              {stock.name} <span className={`text-[13px] font-medium tracking-tight ${focusedStockIndex === index ? 'text-blue-400' : 'text-slate-400'}`}>({stock.code})</span>
                            </span>
                            {(() => {
                              const itemType = getStockType(stock);
                              return (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${
                                  itemType === 'OTHER'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : itemType === 'OVERSEAS'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-blue-50 text-blue-600 border-blue-200'
                                }`}>
                                  {itemType === 'OTHER' ? '기타' : itemType === 'OVERSEAS' ? '해외' : '국내'}
                                </span>
                              );
                            })()}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const isOverseasContext = (formData.currency && formData.currency !== 'KRW') || currencyFilter === 'OVERSEAS';
                    const initialMarket = isOverseasContext ? 'OVERSEAS' : 'DOMESTIC';
                    if (onOpenAddStock) {
                      onOpenAddStock({
                        marketType: initialMarket,
                        currency: initialMarket === 'DOMESTIC' ? 'KRW' : (formData.currency && formData.currency !== 'KRW' ? formData.currency : 'USD')
                      });
                    }
                  }}
                  className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all inline-flex items-center justify-center cursor-pointer"
                  title="종목 추가"
                >
                  <Plus size={22} />
                </button>
                <button
                  type="button"
                  disabled={!formData.security_id}
                  onClick={() => {
                    if (formData.security_id && onDeleteStock) {
                      onDeleteStock(formData.security_id, formData.stock.replace(`[${formData.stockCode}] `, ''));
                    }
                  }}
                  className={`p-2 transition-all inline-flex items-center justify-center rounded-xl ${
                    formData.security_id 
                      ? 'text-slate-300 hover:text-red-500 hover:bg-red-50 cursor-pointer' 
                      : 'text-slate-200 cursor-not-allowed'
                  }`}
                  title="종목 삭제"
                >
                  <Trash2 size={22} />
                </button>
              </div>
            </div>
          </div>

          {/* 4. 수량 & 단가 (0ms 즉시 입력 & 숫자 포맷) */}
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">수량</label>
              <div className="flex items-center w-full h-12 px-4 rounded-2xl border border-slate-200 focus-within:border-blue-500 focus-within:bg-white transition-all bg-slate-50/70 gap-1.5 shadow-xs">
                <input
                  ref={quantityRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formData.quantity}
                  onChange={handleQuantityChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      priceRef.current?.focus();
                      priceRef.current?.select();
                    }
                  }}
                  className={`flex-1 bg-transparent outline-none text-right text-xs min-w-0 placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs placeholder:text-right ${
                    !formData.quantity || formData.quantity === '0' ? 'text-slate-400 font-medium' : 'text-slate-800 font-bold'
                  }`}
                />
                <span className="text-slate-400 font-medium text-xs shrink-0">
                  {(formData.stock || '').includes('금현물') || formData.stockCode === 'GOLD' ? 'g' : '주'}
                </span>
              </div>
            </div>

            <div className="col-span-3">
              <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">단가</label>
              <div className="flex items-center w-full h-12 px-4 rounded-2xl border border-slate-200 focus-within:border-blue-500 focus-within:bg-white transition-all bg-slate-50/70 gap-1.5 shadow-xs">
                <input
                  ref={priceRef}
                  type="text"
                  inputMode={formData.currency && formData.currency !== 'KRW' ? "decimal" : "numeric"}
                  placeholder="0"
                  value={formData.price}
                  onChange={handlePriceChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      priceRef.current?.blur();
                      handleSubmit(e);
                    }
                  }}
                  className={`flex-1 bg-transparent outline-none text-right text-xs min-w-0 placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs placeholder:text-right ${
                    !formData.price || formData.price === '0' ? 'text-slate-400 font-medium' : 'text-slate-800 font-bold'
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

          {/* 5. 거래금액 */}
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
                  <span className="text-xs font-black text-slate-600 tracking-tight ml-0.5">거래금액</span>
                  {formData.totalKRW && (
                    <span className="text-[11px] font-semibold text-slate-400 ml-0.5">
                      ≈ {formData.totalKRW}원
                    </span>
                  )}
                </div>
                <div className="text-right flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-amber-600 tabular-nums">{formData.amount || '0'}</span>
                  <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md font-bold leading-none">
                    {getCurrencySymbol(formData.currency)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">거래금액</label>
              <div className="px-5 rounded-2xl bg-slate-50/60 border border-slate-200/80 shadow-xs flex justify-end items-center h-14">
                <div className="text-right flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-blue-600 tabular-nums">
                    {formData.amount || '0'}
                  </span>
                  <span className="text-sm font-bold text-slate-400">원</span>
                </div>
              </div>
            </div>
          )}

          {/* 6. Footer 버튼 */}
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
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 active:scale-[0.98] cursor-pointer'
              }`}
            >
              {loading ? '저장 중...' : (editingTransaction ? '수정' : '등록')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default React.memo(TradingModal);
