"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";

import { Edit2, Trash2, Filter, RotateCcw, Plus, X, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check, ChevronDown, Coins, Search, PlusCircle, Wallet, TrendingUp, Scale, CheckCircle2, ArrowUpDown, Globe, ArrowLeftRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAssets } from "@/contexts/AssetContext";
import { TransactionManager, TRANSACTION_TYPES, TRADE_TYPES, CURRENCIES } from "@/lib/transactionManager";
import { GUEST_DIVIDEND_TRANSACTIONS } from "@/lib/guestMockData";
import MobileTransactionList from "@/app/components/mobile/MobileTransactionList";
import useMobileKeyboardModal from "@/hooks/useMobileKeyboardModal";
import { useAnimatedModal } from "@/hooks/useAnimatedModal";

// ── 종목 한글 매핑 ──
const STOCK_KR_NAMES = {
  'AAPL': '애플',
  'MSFT': '마이크로소프트',
  'NVDA': '엔비디아',
  'GOOGL': '알파벳 A',
  'TSLA': '테슬라',
};

// ── 정렬 옵션 ──
const SORT_OPTIONS = [
  { value: "latest", label: "최신순" },
  { value: "oldest", label: "과거순" },
  { value: "amount_desc", label: "배당금 높은순" },
  { value: "amount_asc", label: "배당금 낮은순" },
  { value: "name_asc", label: "종목명 가나다순" },
];

// ── 종목 로고 컴포넌트 ──
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
        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
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
    <div className="w-9 h-9 rounded-xl shrink-0 overflow-hidden flex items-center justify-center bg-slate-100/60 shadow-2xs">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt={name || cleanCode}
        onError={() => setHasError(true)}
        className="w-full h-full object-cover rounded-xl"
        loading="lazy"
      />
    </div>
  );
}

// ── 통화 기호 헬퍼 ──
const getCurrencySymbol = (currency) => {
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

const formatForeignAmount = (val, currency = 'USD', showSign = false) => {
  if (val === undefined || val === null) return showSign ? '+0.00' : '0.00';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '-';
  const sym = getCurrencySymbol(currency);
  const isPos = num > 0;
  const isNeg = num < 0;
  const absNum = Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (showSign) {
    if (isPos) return `+${sym} ${absNum}`;
    if (isNeg) return `-${sym} ${absNum}`;
    return `${sym} 0.00`;
  }
  return `${sym} ${absNum}`;
};

const formatStockCode = (code) => {
  if (!code) return "";
  const str = String(code).trim();
  if (/^\d+$/.test(str)) {
    return str.padStart(6, "0");
  }
  return str;
};

// ── 상단 요약 카드 숫자 롤링 카운터 ──
function AnimatedDividendCounter({
  value,
  isForeign = false,
  showSign = false,
  duration = 800,
  isRate = false,
  decimals = 0,
  isCount = false
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);
  const prevIsForeignRef = useRef(isForeign);
  const hasAnimatedInitialRef = useRef(false);

  useEffect(() => {
    const endVal = Number(value) || 0;
    const isForeignChanged = prevIsForeignRef.current !== isForeign;
    const shouldStartFromZero = !hasAnimatedInitialRef.current || isForeignChanged;
    const startVal = shouldStartFromZero ? 0 : (Number(prevValueRef.current) || 0);

    if (endVal === 0 && startVal === 0) {
      prevValueRef.current = 0;
      prevIsForeignRef.current = isForeign;
      return;
    }

    hasAnimatedInitialRef.current = true;
    let startTime = null;
    let animationFrame;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      const current = startVal + (endVal - startVal) * easeProgress;
      setDisplayValue(current);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      } else {
        setDisplayValue(endVal);
        prevValueRef.current = endVal;
        prevIsForeignRef.current = isForeign;
      }
    };

    animationFrame = requestAnimationFrame(step);
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [value, isForeign, duration]);

  const safeVal = Number.isFinite(displayValue) ? displayValue : (Number(value) || 0);

  if (isRate || decimals > 0) {
    const fractionDigits = isRate ? 2 : decimals;
    return (
      <>
        {showSign && safeVal > 0 ? '+' : ''}
        {new Intl.NumberFormat('ko-KR', {
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: fractionDigits
        }).format(safeVal)}
      </>
    );
  }

  if (isForeign) {
    return <>{formatForeignAmount(safeVal, 'USD', showSign)}</>;
  }

  const rounded = Math.round(safeVal);
  return (
    <>
      {showSign && rounded > 0 ? '+' : ''}
      {new Intl.NumberFormat('ko-KR').format(rounded)}
    </>
  );
}

// 상단 카드 서브텍스트용 원화/외화 간결 포맷터
const formatSubKRW = (num) => {
  const val = Number(num) || 0;
  const abs = Math.abs(val);
  if (abs >= 100000000) {
    const eok = Math.floor(abs / 100000000);
    const man = Math.round((abs % 100000000) / 10000);
    return man > 0 ? `${eok}억 ${man.toLocaleString('ko-KR')}만원` : `${eok}억원`;
  }
  if (abs >= 10000) {
    return `${Math.round(abs / 10000).toLocaleString('ko-KR')}만원`;
  }
  return `${Math.round(abs).toLocaleString('ko-KR')}원`;
};

const formatSubUSD = (num) => {
  const val = Number(num) || 0;
  return `$ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};



const getCurrencyBadgeStyles = (currency) => {
  const styles = {
    'KRW': 'bg-blue-50 text-blue-600 border-blue-200',
    'USD': 'bg-emerald-50 text-emerald-600 border-emerald-200',
    'JPY': 'bg-rose-50 text-rose-600 border-rose-200',
    'EUR': 'bg-indigo-50 text-indigo-600 border-indigo-200',
    'HKD': 'bg-amber-50 text-amber-600 border-amber-200',
    'CNY': 'bg-red-50 text-red-600 border-red-200',
    'GBP': 'bg-violet-50 text-violet-600 border-violet-200'
  };
  return styles[currency] || 'bg-slate-50 text-slate-400 border-slate-100';
};


// Korean IME → English keyboard mapping (standard Korean QWERTY layout)
const KO_TO_EN = {
  'ㅂ': 'q', 'ㅈ': 'w', 'ㄷ': 'e', 'ㄱ': 'r', 'ㅅ': 't', 'ㅛ': 'y', 'ㅕ': 'u', 'ㅑ': 'i', 'ㅐ': 'o', 'ㅔ': 'p',
  'ㅁ': 'a', 'ㄴ': 's', 'ㅇ': 'd', 'ㄹ': 'f', 'ㅎ': 'g', 'ㅗ': 'h', 'ㅓ': 'j', 'ㅏ': 'k', 'ㅣ': 'l',
  'ㅋ': 'z', 'ㅌ': 'x', 'ㅊ': 'c', 'ㅍ': 'v', 'ㅠ': 'b', 'ㅜ': 'n', 'ㅡ': 'm',
  'ㅃ': 'Q', 'ㅉ': 'W', 'ㄸ': 'E', 'ㄲ': 'R', 'ㅆ': 'T', 'ㅒ': 'O', 'ㅖ': 'P',
};

// Hangul Deconstruction for Transliteration
const CHOSEONG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const JUNGSEONG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const JONGSEONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

const transliterateKOtoEN = (text) => {
  if (!text) return "";
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Hangul range
    if (code >= 0xac00 && code <= 0xd7a3) {
      const hangulCode = code - 0xac00;
      const jong = hangulCode % 28;
      const jung = ((hangulCode - jong) / 28) % 21;
      const cho = Math.floor(((hangulCode - jong) / 28) / 21);

      const choEn = KO_TO_EN[CHOSEONG[cho]] || CHOSEONG[cho];

      const jungK = JUNGSEONG[jung];
      let jungEn = KO_TO_EN[jungK] || jungK;
      if (jungK === 'ㅘ') jungEn = 'hk';
      else if (jungK === 'ㅙ') jungEn = 'ho';
      else if (jungK === 'ㅚ') jungEn = 'hl';
      else if (jungK === 'ㅝ') jungEn = 'nj';
      else if (jungK === 'ㅞ') jungEn = 'np';
      else if (jungK === 'ㅟ') jungEn = 'nl';
      else if (jungK === 'ㅢ') jungEn = 'ml';

      const jongK = JONGSEONG[jong];
      let jongEn = "";
      if (jongK) {
        const complexJong = {
          'ㄳ': 'rt', 'ㄵ': 'sw', 'ㄶ': 'sg', 'ㄺ': 'fr', 'ㄻ': 'fa', 'ㄼ': 'fq', 'ㄽ': 'ft', 'ㄾ': 'fx', 'ㄿ': 'fv', 'ㅀ': 'fg', 'ㅄ': 'aq'
        };
        jongEn = complexJong[jongK] || KO_TO_EN[jongK] || jongK;
      }

      result += (choEn + jungEn + jongEn);
    } else {
      result += (KO_TO_EN[text[i]] || text[i]);
    }
  }
  return result.toUpperCase();
};

export default function TransactionsPage() {

  const { user } = useAuth();
  const { refreshAssets, dividendTransactions, isTransactionsLoading, refreshTransactions, accounts, accountNameById, isAccountsLoading, refreshAccounts } = useAssets();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const modalFormRef = useMobileKeyboardModal(isModalOpen);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const filterScrollRef = useMobileKeyboardModal(isFilterModalOpen);

  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null });
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', type: 'error', focusRef: null });
  const [stockDeleteConfirm, setStockDeleteConfirm] = useState({ isOpen: false, id: null, name: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 9;

  const [isStockDropdownOpen, setIsStockDropdownOpen] = useState(false);
  const [searchedStocks, setSearchedStocks] = useState([]);
  const [isSearchingStock, setIsSearchingStock] = useState(false);
  const [stockSearchResults, setStockSearchResults] = useState([]);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const searchDropdownRef = useRef(null);
  const accountDropdownRef = useRef(null);
  const accountTypeRef = useRef(null);
  const institutionRef = useRef(null);
  const accountTypeInputRef = useRef(null);

  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [isAccountTypeDropdownOpen, setIsAccountTypeDropdownOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({ institution: '', type: '' });
  const [accountDeleteConfirm, setAccountDeleteConfirm] = useState({ isOpen: false, name: '' });

  const { mounted: isModalMounted, isClosing: isModalClosing } = useAnimatedModal(isModalOpen);
  const { mounted: isFilterMounted, isClosing: isFilterClosing } = useAnimatedModal(isFilterModalOpen);
  const { mounted: isStockMounted, isClosing: isStockClosing } = useAnimatedModal(isStockModalOpen);
  const { mounted: isAccountMounted, isClosing: isAccountClosing } = useAnimatedModal(isAccountModalOpen);
  const { mounted: alertMounted, isClosing: alertClosing } = useAnimatedModal(alertModal.isOpen);
  const { mounted: deleteMounted, isClosing: deleteClosing } = useAnimatedModal(deleteConfirm.isOpen);
  const { mounted: stockDeleteMounted, isClosing: stockDeleteClosing } = useAnimatedModal(stockDeleteConfirm.isOpen);
  const { mounted: accountDeleteMounted, isClosing: accountDeleteClosing } = useAnimatedModal(accountDeleteConfirm.isOpen);

  useEffect(() => {
    const isAnyModalOpen = isFilterMounted || isModalMounted || isStockMounted || isAccountMounted || alertMounted || deleteMounted || stockDeleteMounted || accountDeleteMounted;
    if (isAnyModalOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    };
  }, [isFilterMounted, isModalMounted, isStockMounted, isAccountMounted, alertMounted, deleteMounted, stockDeleteMounted, accountDeleteMounted]);


  const getCurrencyStyle = (currency) => {
    switch (currency) {
      case 'KRW': return { accent: 'bg-blue-500' };
      case 'USD': return { accent: 'bg-emerald-500' };
      case 'JPY': return { accent: 'bg-rose-500' };
      case 'EUR': return { accent: 'bg-indigo-500' };
      case 'HKD': return { accent: 'bg-amber-500' };
      case 'CNY': return { accent: 'bg-red-500' };
      case 'GBP': return { accent: 'bg-violet-500' };
      default: return { accent: 'bg-slate-400' };
    }
  };
  
  const formatCurrency = (val, cur='KRW') => {
    if (val === undefined || val === null) return '0';
    if (cur === 'KRW') return new Intl.NumberFormat('ko-KR').format(Math.round(val));
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };
  const [isSectorDropdownOpen, setIsSectorDropdownOpen] = useState(false);
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [stockForm, setStockForm] = useState({ name: '', code: '', sector: '', currency: 'KRW', exchange_code: '' });

  const calendarRef = useRef(null);
  const calendarButtonRef = useRef(null);
  const currencyRef = useRef(null);
  const stockRef = useRef(null);

  const sectorRef = useRef(null);
  const stockModalNameRef = useRef(null);
  const stockModalCodeRef = useRef(null);
  const stockDropdownRef = useRef(null);
  const priceRef = useRef(null);
  const yearRef = useRef(null);
  const accountListRef = useRef(null);
  const stockListRef = useRef(null);
  const accountRef = useRef(null);
  const monthRef = useRef(null);
  const dayRef = useRef(null);

  const [focusedAccountIndex, setFocusedAccountIndex] = useState(-1);
  const [stockFocusedIndex, setStockFocusedIndex] = useState(-1);

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
    exchangeRate: '',
    totalDividend: '',
    exchange_code: ''
  });

  const sectorOptions = ['에너지', '부동산', '소재', '산업재', '운송물류', '경기소비재', '필수소비재', '헬스케어', '금융', 'IT', '첨단기술', '통신', '유틸리티', '기타', '리츠', '채권', 'ETF'];

  const [activeFilters, setActiveFilters] = useState({
    dateFrom: '',
    dateTo: '',
    type: '전체',
    stockName: '',
    stockCode: '',
    security_id: ''
  });

  const [tempFilters, setTempFilters] = useState({
    dateFrom: '',
    dateTo: '',
    type: '전체',
    stockName: '',
    stockCode: '',
    security_id: ''
  });

  const [currencyFilter, setCurrencyFilter] = useState("ALL"); // ALL, KRW, OVERSEAS
  const [sortBy, setSortBy] = useState("latest");
  const [searchQuery, setSearchQuery] = useState("");
  const [exchangeRates, setExchangeRates] = useState({ USD: 1350, JPY: 9, EUR: 1450 });
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef(null);

  // 툴바 접힘/펼침 필터 패널 상태
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true);
  const { mounted: isFilterPanelMounted, isClosing: isFilterPanelClosing } = useAnimatedModal(isFilterPanelOpen, 220);

  const [inputDateFrom, setInputDateFrom] = useState('');
  const [inputDateTo, setInputDateTo] = useState('');
  const [dateFromError, setDateFromError] = useState('');
  const [dateToError, setDateToError] = useState('');
  const [isToolbarFromCalendarOpen, setIsToolbarFromCalendarOpen] = useState(false);
  const [isToolbarToCalendarOpen, setIsToolbarToCalendarOpen] = useState(false);
  const toolbarDateFromRef = useRef(null);
  const toolbarDateFromBtnRef = useRef(null);
  const toolbarDateToRef = useRef(null);
  const toolbarDateToBtnRef = useRef(null);
  const toolbarDateToInputRef = useRef(null);

  const [isFilterFromCalendarOpen, setIsFilterFromCalendarOpen] = useState(false);
  const [isFilterToCalendarOpen, setIsFilterToCalendarOpen] = useState(false);
  const [isFilterTypeDropdownOpen, setIsFilterTypeDropdownOpen] = useState(false);
  const [isFilterStockDropdownOpen, setIsFilterStockDropdownOpen] = useState(false);

  const filterDateFromRef = useRef(null);
  const filterDateToRef = useRef(null);
  const filterFromCalendarRef = useRef(null);
  const filterToCalendarRef = useRef(null);
  const filterTypeDropdownRef = useRef(null);
  const filterStockDropdownRef = useRef(null);
  const filterStockListRef = useRef(null);

  // 툴바 날짜 입력 포맷터 (YYYY - MM - DD)
  const formatToolbarDate = (dateStr) => {
    if (!dateStr) return '';
    const clean = dateStr.replace(/[^0-9]/g, '');
    if (clean.length === 8) {
      return `${clean.substring(0, 4)} - ${clean.substring(4, 6)} - ${clean.substring(6, 8)}`;
    }
    return dateStr;
  };

  // activeFilters 날짜와 inputDate 동기화
  useEffect(() => {
    setInputDateFrom(activeFilters.dateFrom ? formatToolbarDate(activeFilters.dateFrom) : '');
    if (!activeFilters.dateFrom) setDateFromError('');
  }, [activeFilters.dateFrom]);

  useEffect(() => {
    setInputDateTo(activeFilters.dateTo ? formatToolbarDate(activeFilters.dateTo) : '');
    if (!activeFilters.dateTo) setDateToError('');
  }, [activeFilters.dateTo]);

  // 날짜 입력 변경 (숫자만, 최대 8자리)
  const handleDateInputChange = (val, type) => {
    const clean = val.replace(/[^0-9]/g, '').slice(0, 8);
    if (type === 'from') {
      setInputDateFrom(clean);
      if (dateFromError) setDateFromError('');
      if (clean.length === 8) {
        const y = parseInt(clean.substring(0, 4), 10);
        const m = parseInt(clean.substring(4, 6), 10);
        const d = parseInt(clean.substring(6, 8), 10);
        const isValid = y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
        if (isValid) {
          const isoFormatted = `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
          const displayFormatted = `${clean.substring(0, 4)} - ${clean.substring(4, 6)} - ${clean.substring(6, 8)}`;
          setInputDateFrom(displayFormatted);
          setActiveFilters(prev => ({ ...prev, dateFrom: isoFormatted }));
          setCurrentPage(1);
          setTimeout(() => {
            toolbarDateToInputRef.current?.focus();
          }, 10);
        }
      }
    } else {
      setInputDateTo(clean);
      if (dateToError) setDateToError('');
      if (clean.length === 8) {
        const y = parseInt(clean.substring(0, 4), 10);
        const m = parseInt(clean.substring(4, 6), 10);
        const d = parseInt(clean.substring(6, 8), 10);
        const isValid = y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
        if (isValid) {
          const isoFormatted = `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
          const displayFormatted = `${clean.substring(0, 4)} - ${clean.substring(4, 6)} - ${clean.substring(6, 8)}`;
          setInputDateTo(displayFormatted);
          setActiveFilters(prev => ({ ...prev, dateTo: isoFormatted }));
          setCurrentPage(1);
        }
      }
    }
  };

  // 포커스 시: 기존 날짜가 있으면 하이픈 제거 후 숫자만 표시
  const handleDateInputFocus = (type, e) => {
    if (type === 'from') {
      const clean = (inputDateFrom || '').replace(/[^0-9]/g, '');
      setInputDateFrom(clean);
    } else {
      const clean = (inputDateTo || '').replace(/[^0-9]/g, '');
      setInputDateTo(clean);
    }
    e.target.select?.();
  };

  // 커밋 (블러, 엔터, 탭): 8자리 포맷팅 및 조회
  const handleDateInputCommit = (type) => {
    setIsToolbarFromCalendarOpen(false);
    setIsToolbarToCalendarOpen(false);
    const rawVal = (type === 'from' ? inputDateFrom : inputDateTo) || '';
    const clean = rawVal.replace(/[^0-9]/g, '');

    if (!clean) {
      if (type === 'from') {
        setInputDateFrom('');
        setDateFromError('');
        setActiveFilters(prev => ({ ...prev, dateFrom: '' }));
      } else {
        setInputDateTo('');
        setDateToError('');
        setActiveFilters(prev => ({ ...prev, dateTo: '' }));
      }
      setCurrentPage(1);
      return;
    }

    if (clean.length === 8) {
      const y = parseInt(clean.substring(0, 4), 10);
      const m = parseInt(clean.substring(4, 6), 10);
      const d = parseInt(clean.substring(6, 8), 10);

      const isValid = y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
      if (isValid) {
        const isoFormatted = `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
        const displayFormatted = `${clean.substring(0, 4)} - ${clean.substring(4, 6)} - ${clean.substring(6, 8)}`;
        if (type === 'from') {
          setInputDateFrom(displayFormatted);
          setDateFromError('');
          setActiveFilters(prev => ({ ...prev, dateFrom: isoFormatted }));
          setTimeout(() => {
            toolbarDateToInputRef.current?.focus();
          }, 10);
        } else {
          setInputDateTo(displayFormatted);
          setDateToError('');
          setActiveFilters(prev => ({ ...prev, dateTo: isoFormatted }));
        }
        setCurrentPage(1);
        return;
      } else {
        if (type === 'from') {
          setInputDateFrom(clean);
          setDateFromError('올바른 날짜를 입력해주세요.');
        } else {
          setInputDateTo(clean);
          setDateToError('올바른 날짜를 입력해주세요.');
        }
        return;
      }
    }

    if (type === 'from') {
      setInputDateFrom(clean);
      setDateFromError('8자리 숫자로 입력해주세요 (예: 20261112)');
    } else {
      setInputDateTo(clean);
      setDateToError('8자리 숫자로 입력해주세요 (예: 20261112)');
    }
  };

  const handleDateInputKeyDown = (e, type) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleDateInputCommit(type);
      if (type === 'from') {
        toolbarDateToInputRef.current?.focus();
      } else {
        e.target.blur();
      }
    } else if (e.key === 'Tab') {
      if (type === 'from' && !e.shiftKey) {
        e.preventDefault();
        handleDateInputCommit(type);
        toolbarDateToInputRef.current?.focus();
      } else {
        handleDateInputCommit(type);
      }
    }
  };

  const handleClearDateAndSearch = () => {
    setInputDateFrom('');
    setInputDateTo('');
    setDateFromError('');
    setDateToError('');
    setSearchQuery('');
    setIsToolbarFromCalendarOpen(false);
    setIsToolbarToCalendarOpen(false);
    setIsSortDropdownOpen(false);
    setActiveFilters(prev => ({ ...prev, dateFrom: '', dateTo: '', stockName: '', security_id: '' }));
    setCurrentPage(1);
  };

  // 배당내역 통합 (게스트 모드 포함)
  const allTransactions = useMemo(() => {
    if (!user) return [];
    const dt = dividendTransactions || [];
    return dt;
  }, [user, dividendTransactions]);

  // 전역 상태가 변경되면 로컬 필터링용 데이터 업데이트
  useEffect(() => {
    setTransactions(allTransactions);
    setLoading(isTransactionsLoading);
  }, [allTransactions, isTransactionsLoading]);

  // 사용자 데이터 로드
  useEffect(() => {
    if (user && dividendTransactions.length === 0) {
      refreshTransactions();
    }
  }, [user]);

  // 환율 조회
  useEffect(() => {
    TransactionManager.getLatestExchangeRates()
      .then(rates => {
        if (rates) setExchangeRates(prev => ({ ...prev, ...rates }));
      })
      .catch(err => console.error("환율 로드 오류:", err));
  }, []);

  // 검색/필터 변경 시 페이지 1로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, currencyFilter, sortBy, activeFilters.dateFrom, activeFilters.dateTo, activeFilters.type]);

  // 모달 키보드 이벤트 핸들러 (확인창 엔터/스페이스, 삭제창 엔터/ESC, 취소 ESC)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // ESC 키 공통 처리 (열려있는 모달 중 우선순위가 높은 순서대로 닫기)
      if (e.key === 'Escape') {
        if (alertModal.isOpen) {
          e.preventDefault();
          closeAlert();
          return;
        }
        if (deleteConfirm.isOpen) {
          e.preventDefault();
          setDeleteConfirm({ isOpen: false, id: null });
          return;
        }
        if (stockDeleteConfirm.isOpen) {
          e.preventDefault();
          setStockDeleteConfirm({ isOpen: false, id: null, name: '' });
          return;
        }
        if (accountDeleteConfirm.isOpen) {
          e.preventDefault();
          setAccountDeleteConfirm({ isOpen: false, name: '' });
          return;
        }
        if (isStockModalOpen) {
          e.preventDefault();
          setIsStockModalOpen(false);
          return;
        }
        if (isAccountModalOpen) {
          e.preventDefault();
          setIsAccountModalOpen(false);
          return;
        }
        if (isFilterModalOpen) {
          e.preventDefault();
          setIsFilterModalOpen(false);
          return;
        }
        if (isModalOpen) {
          e.preventDefault();
          setIsModalOpen(false);
          return;
        }
      }

      // Enter/Space 키 처리
      if (e.key === 'Enter' || e.key === ' ') {
        if (alertModal.isOpen) {
          e.preventDefault();
          closeAlert();
        }
      }

      // Deletion Enter 처리
      if (e.key === 'Enter') {
        if (deleteConfirm.isOpen) {
          e.preventDefault();
          confirmDelete();
        } else if (stockDeleteConfirm.isOpen) {
          e.preventDefault();
          confirmStockDelete();
        } else if (accountDeleteConfirm.isOpen) {
          e.preventDefault();
          confirmAccountDelete();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [alertModal.isOpen, deleteConfirm.isOpen, stockDeleteConfirm.isOpen, accountDeleteConfirm.isOpen, isModalOpen, isAccountModalOpen, isStockModalOpen, isFilterModalOpen]);

  // 드롭다운 스크롤 자동 이동 (계좌)
  useEffect(() => {
    if (isAccountDropdownOpen && focusedAccountIndex >= 0 && accountListRef.current) {
      const container = accountListRef.current;
      const focusedItem = container.children[focusedAccountIndex];
      if (focusedItem) {
        focusedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedAccountIndex, isAccountDropdownOpen]);

  useEffect(() => {
    if (isStockDropdownOpen && stockFocusedIndex >= 0 && stockListRef.current) {
      const container = stockListRef.current;
      const focusedItem = container.children[stockFocusedIndex];
      if (focusedItem) {
        focusedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [stockFocusedIndex, isStockDropdownOpen]);

  // 드롭다운 스크롤 자동 이동 (필터 모달 종목)
  useEffect(() => {
    if (isFilterStockDropdownOpen && stockFocusedIndex >= 0 && filterStockListRef.current) {
      const container = filterStockListRef.current;
      const visualIndex = stockSearchResults.length - 1 - stockFocusedIndex;
      const focusedItem = container.children[visualIndex];
      if (focusedItem) {
        focusedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [stockFocusedIndex, isFilterStockDropdownOpen, stockSearchResults.length]);


  const loadAccounts = async () => {
    await refreshAccounts();
  };

  const loadTransactions = async () => {
    await refreshTransactions();
  };

  useEffect(() => {
    const handleClickOutsideSearchDropdown = (event) => {
      if (isSearchDropdownOpen && searchDropdownRef.current && !searchDropdownRef.current.contains(event.target)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideSearchDropdown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideSearchDropdown);
    };
  }, [isSearchDropdownOpen]);

  // 외부 클릭 감지하여 드롭다운 닫기
  useEffect(() => {
    const handleClickOutsideSector = (event) => {
      if (isSectorDropdownOpen && sectorRef.current && !sectorRef.current.contains(event.target)) {
        setIsSectorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideSector);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideSector);
    };
  }, [isSectorDropdownOpen]);

  useEffect(() => {
    const handleClickOutsideAccount = (event) => {
      if (isAccountDropdownOpen && accountDropdownRef.current && !accountDropdownRef.current.contains(event.target)) {
        setIsAccountDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideAccount);
    return () => document.removeEventListener('mousedown', handleClickOutsideAccount);
  }, [isAccountDropdownOpen]);

  useEffect(() => {
    const handleClickOutsideAccountType = (event) => {
      if (isAccountTypeDropdownOpen && accountTypeRef.current && !accountTypeRef.current.contains(event.target)) {
        setIsAccountTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideAccountType);
    return () => document.removeEventListener('mousedown', handleClickOutsideAccountType);
  }, [isAccountTypeDropdownOpen]);

  useEffect(() => {
    const handleClickOutsideCurrency = (event) => {
      if (isCurrencyDropdownOpen && currencyRef.current && !currencyRef.current.contains(event.target)) {
        setIsCurrencyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideCurrency);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideCurrency);
    };
  }, [isCurrencyDropdownOpen]);

  useEffect(() => {
    const handleClickOutsideStock = (event) => {
      if (isStockDropdownOpen && stockDropdownRef.current && !stockDropdownRef.current.contains(event.target)) {
        setIsStockDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideStock);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideStock);
    };
  }, [isStockDropdownOpen]);

  useEffect(() => {
    const handleClickOutsideFilter = (event) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setIsSortDropdownOpen(false);
      }
      if (toolbarDateFromRef.current && !toolbarDateFromRef.current.contains(event.target) && (!toolbarDateFromBtnRef.current || !toolbarDateFromBtnRef.current.contains(event.target))) {
        setIsToolbarFromCalendarOpen(false);
      }
      if (toolbarDateToRef.current && !toolbarDateToRef.current.contains(event.target) && (!toolbarDateToBtnRef.current || !toolbarDateToBtnRef.current.contains(event.target))) {
        setIsToolbarToCalendarOpen(false);
      }
      if (isFilterFromCalendarOpen && filterFromCalendarRef.current && !filterFromCalendarRef.current.contains(event.target) && (!filterDateFromRef.current || !filterDateFromRef.current.contains(event.target))) {
        setIsFilterFromCalendarOpen(false);
      }
      if (isFilterToCalendarOpen && filterToCalendarRef.current && !filterToCalendarRef.current.contains(event.target) && (!filterDateToRef.current || !filterDateToRef.current.contains(event.target))) {
        setIsFilterToCalendarOpen(false);
      }
      if (isFilterTypeDropdownOpen && filterTypeDropdownRef.current && !filterTypeDropdownRef.current.contains(event.target)) {
        setIsFilterTypeDropdownOpen(false);
      }
      if (isFilterStockDropdownOpen && filterStockDropdownRef.current && !filterStockDropdownRef.current.contains(event.target)) {
        setIsFilterStockDropdownOpen(false);
      }
    };

    const handleKeyDownGlobal = (event) => {
      if (event.key === 'Escape') {
        setIsToolbarFromCalendarOpen(false);
        setIsToolbarToCalendarOpen(false);
        setIsSortDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutsideFilter);
    document.addEventListener('keydown', handleKeyDownGlobal);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideFilter);
      document.removeEventListener('keydown', handleKeyDownGlobal);
    };
  }, []);

  const showAlert = (title, message, type = 'error', focusRef = null) => {
    setAlertModal({ isOpen: true, title, message, type, focusRef });
  };

  const closeAlert = () => {
    const { focusRef } = alertModal;
    setAlertModal(prev => ({ ...prev, isOpen: false }));
    if (focusRef && focusRef.current) {
      setTimeout(() => focusRef.current.focus(), 100);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.year || !formData.month || !formData.day) {
      showAlert("입력 오류", "배당일을 선택해 주세요.", "error", calendarButtonRef);
      return;
    }
    if (!formData.account_id) {
      showAlert("입력 오류", "계좌를 선택해 주세요.", "error");
      return;
    }
    if (!formData.security_id) {
      showAlert("입력 오류", "종목을 선택해 주세요.", "error", stockRef);
      return;
    }
    if (!formData.dividendAmount) {
      showAlert("입력 오류", "배당금을 입력해 주세요.", "error", priceRef);
      return;
    }

    try {
      setLoading(true);
      const dividendData = {
        transaction_type: TRANSACTION_TYPES.DIVIDEND,
        trade_type: TRADE_TYPES.DIV,
        date: `${formData.year}-${formData.month.padStart(2, '0')}-${formData.day.padStart(2, '0')}`,
        account_id: formData.account_id,
        security_id: formData.security_id,
        currency: formData.currency,
        dividend_amount: parseFloat(formData.dividendAmount.replace(/,/g, '')),
        exchange_rate: parseFloat((formData.exchangeRate || '1').replace(/,/g, '')),
        total_dividend: parseFloat(formData.totalDividend.replace(/,/g, ''))
      };

      if (editingId) {
        // Update existing transaction with alt_sync flag
        await TransactionManager.updateTransaction(editingId, {
          ...dividendData,
          alt_sync: true
        });
        await refreshTransactions();
        await refreshAssets();
        setIsModalOpen(false);
        setEditingId(null);
        showAlert("수정 완료", "변경 내용이 반영되었습니다.", "success");
      } else {
        await TransactionManager.addTransaction(dividendData);
        await refreshTransactions(); // 전역 거래 데이터 갱신
        await refreshAssets();      // 자산 요약 및 트렌드 갱신
        setIsModalOpen(false);
        setEditingId(null);
        showAlert("등록 완료", "배당이 성공적으로 등록되었습니다.", "success");
      }
    } catch (error) {
      console.error('배당 처리 중 오류:', error);
      showAlert("오류", error.message || "배당 처리 중 문제가 발생했습니다.", "error");
    } finally {
      setLoading(false);
    }
  };

  // 통화코드 매핑 함수
  const getCurrencySymbol = (currency) => {
    const symbolMap = {
      'USD': '$',
      'EUR': '€',
      'JPY': '¥',
      'CNY': '¥',
      'GBP': '£',
      'HKD': 'HK$'
      // KRW는 제외 (₩ 표시 안 함)
    };
    return symbolMap[currency] || '';
  };



  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    // Handle YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // Handle YY/MM/DD
    const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
    if (parts.length === 3) {
      let [y, m, d] = parts;
      if (y.length === 2) y = '20' + y;
      return `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    }
    return dateStr;
  };

  const toggleModal = () => {
    if (!isModalOpen) {
      const now = new Date();
      setEditingId(null);
      setFormData({
        year: now.getFullYear().toString(),
        month: (now.getMonth() + 1).toString().padStart(2, '0'),
        day: now.getDate().toString().padStart(2, '0'),
        account: '', account_id: '',
        stock: '', stockCode: '',
        security_id: '',
        currency: 'KRW',
        dividendAmount: '',
        exchangeRate: '', totalDividend: '',
        exchange_code: ''
      });
    }
    setIsModalOpen(!isModalOpen);
    setIsCalendarOpen(false);
  };

  const handleDateSelect = (y, m, d) => {
    const yStr = y.toString();
    const mStr = m.toString().padStart(2, '0');
    const dStr = d.toString().padStart(2, '0');
    setFormData(prev => ({
      ...prev,
      year: yStr,
      month: mStr,
      day: dStr
    }));
    setIsCalendarOpen(false);
    fetchRate({ year: yStr, month: mStr, day: dStr });
  };

  const handleNumberInput = (e, field) => {
    let rawValue = e.target.value.replace(/,/g, '');

    // 배당금(세전) 처리
    if (field === 'dividendAmount') {
      const [intPart, decPart] = rawValue.split('.');
      if (intPart && intPart.length > 11) return; // 정수부 최대 11자리

      if (formData.currency === 'KRW') {
        const digitsOnly = rawValue.replace(/[^\d]/g, '');
        if (digitsOnly.length > 11) return;
        const formatted = digitsOnly === '' ? '' : Number(digitsOnly).toLocaleString('ko-KR');
        setFormData(prev => ({ ...prev, [field]: formatted }));
        return;
      } else {
        if (rawValue !== '' && !/^\d*\.?\d{0,2}$/.test(rawValue)) return; // 소수부 최대 2자리
        if (rawValue === '' || rawValue === '.') {
          setFormData(prev => ({ ...prev, [field]: rawValue }));
          return;
        }
        const formattedInt = Number(intPart || 0).toLocaleString('ko-KR');
        const formattedValue = decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
        setFormData(prev => ({ ...prev, [field]: formattedValue }));
        return;
      }
    }

    // 기타 필드 (환율 등) - 정수부 11자리, 소수부 4자리 유지
    if (field === 'exchangeRate' || field === 'price' || field === 'quantity' || field === 'fee') {
      const [intPart, decPart] = rawValue.split('.');
      if (intPart && intPart.length > 11) return;
      if (rawValue !== '' && !/^\d*\.?\d{0,4}$/.test(rawValue)) return;

      if (rawValue === '' || rawValue === '.') {
        setFormData(prev => ({ ...prev, [field]: rawValue }));
        return;
      }
      const formattedInt = Number(intPart || 0).toLocaleString('ko-KR');
      const formattedValue = decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
      setFormData(prev => ({ ...prev, [field]: formattedValue }));
      return;
    }

    const digitsOnly = rawValue.replace(/[^\d]/g, '');
    if (digitsOnly.length > 11) return;
    const formatted = digitsOnly === '' ? '' : Number(digitsOnly).toLocaleString('ko-KR');
    setFormData(prev => ({ ...prev, [field]: formatted }));
  };

  useEffect(() => {
    const preTax = Number(formData.dividendAmount.replace(/,/g, '')) || 0;
    const exRate = Number((formData.exchangeRate || '1').replace(/,/g, '')) || 1;

    if (preTax > 0) {
      const krwTotal = formData.currency === 'KRW' ? preTax : (preTax * exRate);
      // KRW가 아닌 경우 (해외 배당) 기존대로 10원 단위 반올림
      // KRW인 경우 (국내 배당) 원 단위까지 모두 표시 (소수점만 반올림)
      const roundedTotal = formData.currency === 'KRW' 
        ? Math.round(krwTotal) 
        : Math.round(krwTotal / 10) * 10;

      setFormData(prev => ({
        ...prev,
        totalDividend: roundedTotal.toLocaleString('ko-KR')
      }));
    } else {
      setFormData(prev => ({ ...prev, totalDividend: '' }));
    }
  }, [formData.dividendAmount, formData.currency, formData.exchangeRate]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (calendarRef.current && !calendarRef.current.contains(event.target) && (!calendarButtonRef.current || !calendarButtonRef.current.contains(event.target))) {
        setIsCalendarOpen(false);
      }
      if (currencyRef.current && !currencyRef.current.contains(event.target)) {
        setIsCurrencyDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutsideStock = (event) => {
      if (isStockDropdownOpen && stockDropdownRef.current && !stockDropdownRef.current.contains(event.target)) {
        setIsStockDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideStock);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideStock);
    };
  }, [isStockDropdownOpen]);

  const fetchRate = async (specificDate = null) => {
    if (!isModalOpen) return;

    const monthStr = specificDate?.month || formData.month;
    const dayStr = specificDate?.day || formData.day;
    const yearStr = specificDate?.year || formData.year;

    if (formData.currency === 'KRW') {
      if (formData.exchangeRate !== '1') {
        setFormData(prev => ({ ...prev, exchangeRate: '1' }));
      }
      return;
    }

    if (yearStr && yearStr.length === 4 && monthStr && dayStr && formData.currency) {
      const today = new Date();
      const inputDate = new Date(`${yearStr}-${monthStr.toString().padStart(2, '0')}-${dayStr.toString().padStart(2, '0')}`);

      if (inputDate > today) {
        console.warn('Dividend fetchRate blocked: future date');
        return;
      }

      try {
        const paddedMonth = monthStr.toString().padStart(2, '0');
        const paddedDay = dayStr.toString().padStart(2, '0');
        const dateStr = `${yearStr}-${paddedMonth}-${paddedDay}`;
        const rate = await TransactionManager.getExchangeRate(dateStr, formData.currency, 'KRW');
        if (rate) {
          setFormData(prev => ({ ...prev, exchangeRate: rate.toFixed(2).toString() }));
        }
      } catch (error) {
        console.error('환율 조회 실패:', error);
      }
    }
  };

  useEffect(() => {
    fetchRate();
  }, [isModalOpen, formData.currency, formData.year, formData.month, formData.day]);

  useEffect(() => {
    const handleClickOutsideSector = (event) => {
      if (isSectorDropdownOpen && sectorRef.current && !sectorRef.current.contains(event.target)) {
        setIsSectorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideSector);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideSector);
    };
  }, [isSectorDropdownOpen]);

  useEffect(() => {
    const handleClickOutsideCurrency = (event) => {
      if (isCurrencyDropdownOpen && currencyRef.current && !currencyRef.current.contains(event.target)) {
        setIsCurrencyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideCurrency);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideCurrency);
    };
  }, [isCurrencyDropdownOpen]);

  const handleEdit = (tx) => {
    const rawDate = tx.transaction_date || tx.date || '';
    const [year, month, day] = rawDate.split('-');

    setEditingId(tx.id);
    const stockName = tx.security?.name || tx.stock_name || tx.stock || '';
    const stockCode = tx.security?.code || tx.stock_code || tx.stockCode || '';
    const accountNm = accountNameById[tx.account_id] || tx.account || '';

    // 통화 판별: 명시된 currency가 있으면 사용, 없거나 불분명하면 국내 주식 여부로 판별
    const isKRW = (tx.currency || 'KRW') === 'KRW' || 
                  ['KOSPI', 'KOSDAQ', 'KONEX', 'KRX'].includes(tx.security?.market) || 
                  tx.security?.exchange_code === 'KRX' || 
                  (stockCode && /^\d{6}$/.test(stockCode));
    const txCurrency = tx.currency || (isKRW ? 'KRW' : 'USD');

    // 배당금 산출: tx.dividend_amount가 있으면 사용, 없으면 total_dividend 또는 amount 사용
    const rawDividend = (tx.dividend_amount != null && tx.dividend_amount !== '' && Number(tx.dividend_amount) > 0)
      ? Number(tx.dividend_amount)
      : (txCurrency === 'KRW'
          ? (Number(tx.total_dividend) || Number(tx.amount) || 0)
          : (Number(tx.exchange_rate) && Number(tx.total_dividend) 
              ? (Number(tx.total_dividend) / Number(tx.exchange_rate)) 
              : (Number(tx.amount) || 0))
        );

    const rawTotalDividend = Number(tx.total_dividend) || (
      txCurrency === 'KRW' 
        ? rawDividend 
        : (Number(tx.exchange_rate) ? Math.round(rawDividend * Number(tx.exchange_rate)) : 0)
    );

    setSelectedAccountId(tx.account_id || null);

    setFormData({
      year: year || '',
      month: month || '',
      day: day || '',
      account: accountNm,
      account_id: tx.account_id || '',
      stock: stockCode ? `[${stockCode}] ${stockName}` : stockName,
      stockCode: stockCode,
      security_id: tx.security_id || '',
      currency: txCurrency,
      dividendAmount: rawDividend > 0 
        ? (txCurrency === 'KRW' 
            ? Math.round(rawDividend).toLocaleString('ko-KR') 
            : rawDividend.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) 
        : '',
      exchangeRate: txCurrency === 'KRW' ? '1' : (tx.exchange_rate ? tx.exchange_rate.toString() : ''),
      totalDividend: rawTotalDividend > 0 ? Math.round(rawTotalDividend).toLocaleString('ko-KR') : '',
      exchange_code: tx.security?.exchange_code || ''
    });

    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    try {
      await TransactionManager.softDeleteTransaction(deleteConfirm.id);
      await refreshTransactions();
      await refreshAssets();
      setDeleteConfirm({ isOpen: false, id: null });
      showAlert("삭제 완료", "배당이 성공적으로 삭제되었습니다.", "success");
    } catch (error) {
      console.error('배당 삭제 오류:', error);
      showAlert("오류", error.message || "배당 삭제 중 문제가 발생했습니다.", "error");
    }
  };

  const confirmStockDelete = async () => {
    try {
      if (!stockDeleteConfirm.id) return;
      await TransactionManager.deleteStock(stockDeleteConfirm.id);
      setStockDeleteConfirm({ isOpen: false, id: null, name: '' });
      setFormData(prev => ({ ...prev, security_id: '', stock: '', stockCode: '' }));
      showAlert("삭제 완료", "종목이 성공적으로 삭제되었습니다.", "success");
    } catch (e) {
      let msg = "종목 삭제 중 알 수 없는 문제가 발생했습니다.";
      if (e && (e.code === '23503' || (e.message && String(e.message).includes('foreign key constraint')))) {
        msg = (
          <>
            <span className="font-bold text-slate-800">&quot;{stockDeleteConfirm.name}&quot;</span> 종목이 거래내역에 존재합니다.{"\n"}
            거래내역에 포함된 경우 삭제가 불가합니다.
          </>
        );
      } else if (e && e.message) {
        msg = String(e.message);
      }
      showAlert("오류", msg, "error");
      setStockDeleteConfirm({ isOpen: false, id: null, name: '' });
    }
  };



  const confirmAccountDelete = async () => {
    if (!accountDeleteConfirm.name) return;

    try {
      const list = await TransactionManager.getAccounts();
      if (list.length <= 1) {
        setAccountDeleteConfirm({ isOpen: false, name: '' });
        showAlert("삭제 불가", "최소 1개의 계좌는 남겨두어야 합니다.", "error");
        return;
      }
    } catch (error) {
      setAccountDeleteConfirm({ isOpen: false, name: '' });
      showAlert("오류", error.message || "계좌 정보를 확인할 수 없습니다.", "error");
      return;
    }

    try {
      await TransactionManager.deleteAccountByName(accountDeleteConfirm.name.trim());
      setFormData(prev => ({ ...prev, account: '', account_id: '' }));
      await refreshAccounts();
      setAccountDeleteConfirm({ isOpen: false, name: '' });
      showAlert("삭제 완료", "계좌가 삭제되었습니다.", "success");
    } catch (err) {
      setAccountDeleteConfirm({ isOpen: false, name: '' });
      let msg = "계좌 삭제 중 문제가 발생했습니다.";
      if (err && (err.code === '23503' || (err.message && String(err.message).includes('foreign key constraint')))) {
        msg = (
          <>
            <span className="font-bold text-slate-800">&quot;{accountDeleteConfirm.name}&quot;</span> 계좌가 거래내역에 존재합니다.{"\n"}
            거래내역에 포함된 경우 삭제가 불가합니다.
          </>
        );
      } else if (err && err.message) {
        msg = String(err.message);
      }
      showAlert("오류", msg, "error");
    }
  };

  const [selectedQuickPeriod, setSelectedQuickPeriod] = useState('1개월');
  const [focusedStockIndex, setFocusedStockIndex] = useState(-1);

  const handleFilterStockEnter = async (val) => {
    const query = val ? val.trim() : '';
    if (!query) {
      setIsFilterStockDropdownOpen(false);
      return;
    }

    if (isFilterStockDropdownOpen && focusedStockIndex >= 0 && stockSearchResults[focusedStockIndex]) {
      const selected = stockSearchResults[focusedStockIndex];
      setTempFilters(prev => ({ 
        ...prev, 
        stockName: `${selected.name}(${selected.code})`,
        stockCode: selected.code,
        security_id: selected.security_id
      }));
      setIsFilterStockDropdownOpen(false);
      if (typeof document !== 'undefined') {
        document.activeElement?.blur();
      }
      return;
    }

    setIsSearchingStock(true);
    try {
      const results = await TransactionManager.searchStocksByName(query, null);
      if (results && results.length > 0) {
        const currencyOrder = (c) => c === 'KRW' ? 0 : c === 'USD' ? 1 : 2;
        const sorted = [...results].sort((a, b) => currencyOrder(a.currency) - currencyOrder(b.currency));
        const upperQuery = query.toUpperCase();
        const exactMatch = sorted.find(
          s => s.name?.toUpperCase() === upperQuery || s.code?.toUpperCase() === upperQuery
        );
        const target = exactMatch || (sorted.length === 1 ? sorted[0] : null);

        if (target) {
          setTempFilters(prev => ({ 
            ...prev, 
            stockName: `${target.name}(${target.code})`,
            stockCode: target.code,
            security_id: target.security_id
          }));
          setIsFilterStockDropdownOpen(false);
          setStockSearchResults([]);
        } else {
          setStockSearchResults(sorted);
          setFocusedStockIndex(0);
          setIsFilterStockDropdownOpen(true);
        }
      } else {
        setIsFilterStockDropdownOpen(false);
        setStockSearchResults([]);
      }
    } catch (err) {
      console.error('종목 검색 오류:', err);
      setStockSearchResults([]);
      setIsFilterStockDropdownOpen(false);
    } finally {
      setIsSearchingStock(false);
    }
  };

  const handleStockSearch = async (val) => {
    const searchTerm = (val || '').trim();
    
    setIsFilterStockDropdownOpen(true);
    setIsSearchingStock(true);
    try {
      const results = await TransactionManager.searchStocksByName(searchTerm, null);
      const currencyOrder = (c) => c === 'KRW' ? 0 : c === 'USD' ? 1 : 2;
      const sorted = [...results].sort((a, b) => currencyOrder(a.currency) - currencyOrder(b.currency));
      setStockSearchResults(sorted);
      if (sorted.length > 0) {
        setStockFocusedIndex(0);
        setFocusedStockIndex(0);
      } else {
        setStockFocusedIndex(-1);
        setFocusedStockIndex(-1);
      }
    } catch (err) {
      console.error('종목 검색 오류:', err);
      setStockSearchResults([]);
      setStockFocusedIndex(-1);
      setFocusedStockIndex(-1);
    } finally {
      setIsSearchingStock(false);
    }
  };

  const handleFilterDateChange = (field, value) => {
    const digits = value.replace(/[^0-9]/g, '');
    if (digits.length <= 6) {
      setTempFilters(prev => ({ ...prev, [field]: digits }));
      setSelectedQuickPeriod(null);
    }
  };

  const handleFilterDateFocus = (field, value) => {
    if (value && value.includes('-')) {
      const stripped = value.replace(/-/g, '').substring(2);
      setTempFilters(prev => ({ ...prev, [field]: stripped }));
    }
  };

  const handleFilterDateBlur = (event, field, value, ref) => {
    if (!value) return;
    if (event.relatedTarget && event.relatedTarget.getAttribute('data-quick-period') === 'true') return;
    if (value && typeof value === 'string' && value.includes('-')) return;

    const digits = value.replace(/[^0-9]/g, '');
    if (digits.length > 0 && digits.length < 6) {
      showAlert("입력 오류", "날짜는 6자리(YYMMDD)로 입력해주세요.", "error", ref);
      return;
    }

    if (digits.length === 6) {
      const yyStr = digits.substring(0, 2);
      const mmStr = digits.substring(2, 4);
      const ddStr = digits.substring(4, 6);
      const yy = parseInt(yyStr);
      const mm = parseInt(mmStr);
      const dd = parseInt(ddStr);
      
      const currentYearShort = new Date().getFullYear() % 100;
      if (yy > currentYearShort) {
        showAlert("입력 오류", "미래의 년도는 입력할 수 없습니다.", "error", ref);
        return;
      }
      if (mm < 1 || mm > 12) {
        showAlert("입력 오류", "월은 01~12 사이로 입력해주세요.", "error", ref);
        return;
      }
      if (dd < 1 || dd > 31) {
        showAlert("입력 오류", "일은 01~31 사이로 입력해주세요.", "error", ref);
        return;
      }
      setTempFilters(prev => ({ ...prev, [field]: `20${yyStr}-${mmStr}-${ddStr}` }));
    }
  };

  const filteredTransactions = useMemo(() => {
    const list = (transactions || []).filter(tx => {
      const isKRW = (tx.currency || 'KRW') === 'KRW';

      // 1. 통화 세그먼트 필터 (ALL, KRW, OVERSEAS)
      if (currencyFilter === 'KRW' && !isKRW) return false;
      if (currencyFilter === 'OVERSEAS' && isKRW) return false;

      // 2. 모달 필터 통화 (기존 activeFilters.type)
      if (activeFilters.type !== '전체') {
        const typeStr = tx.currency || 'KRW';
        if (typeStr !== activeFilters.type) return false;
      }

      // 3. 종목 검색어 필터 (툴바 searchQuery + activeFilters.stockName)
      const sName = (tx.security?.name || tx.stock_name || tx.stock || '');
      const sCode = (tx.security?.code || tx.stock_code || tx.stockCode || '');
      const displayName = STOCK_KR_NAMES[sCode] || sName;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toUpperCase();
        const matchName = sName.toUpperCase().includes(q) || displayName.toUpperCase().includes(q);
        const matchCode = sCode.toUpperCase().includes(q);
        if (!matchName && !matchCode) return false;
      }

      if (activeFilters.security_id) {
        if (tx.security_id !== activeFilters.security_id) return false;
      } else if (activeFilters.stockName) {
        const q = activeFilters.stockName.toUpperCase();
        const matchName = sName.toUpperCase().includes(q) || displayName.toUpperCase().includes(q);
        const matchCode = sCode.toUpperCase().includes(q);
        if (!matchName && !matchCode) return false;
      }

      // 4. 기간 필터 (시작일 / 종료일)
      const txDay = (tx.date || '').substring(0, 10);
      if (activeFilters.dateFrom && (!txDay || txDay < activeFilters.dateFrom)) return false;
      if (activeFilters.dateTo && (!txDay || txDay > activeFilters.dateTo)) return false;

      return true;
    });

    // 정렬 로직 적용
    return [...list].sort((a, b) => {
      const isKRWA = (a.currency || 'KRW') === 'KRW';
      const isKRWB = (b.currency || 'KRW') === 'KRW';
      const rateA = Number(a.exchange_rate || (exchangeRates && exchangeRates[a.currency]) || 1350);
      const rateB = Number(b.exchange_rate || (exchangeRates && exchangeRates[b.currency]) || 1350);
      const amtA = isKRWA
        ? Number(a.total_dividend || a.dividend_amount || 0)
        : Number(a.total_dividend || Math.round(Number(a.dividend_amount || 0) * rateA));
      const amtB = isKRWB
        ? Number(b.total_dividend || b.dividend_amount || 0)
        : Number(b.total_dividend || Math.round(Number(b.dividend_amount || 0) * rateB));
      const nameA = a.security?.name || a.stock_name || a.stock || '';
      const nameB = b.security?.name || b.stock_name || b.stock || '';

      switch (sortBy) {
        case 'oldest':
          return (a.date || '').localeCompare(b.date || '');
        case 'amount_desc':
          return amtB - amtA;
        case 'amount_asc':
          return amtA - amtB;
        case 'name_asc':
          return nameA.localeCompare(nameB, 'ko');
        case 'latest':
        default:
          return (b.date || '').localeCompare(a.date || '');
      }
    });
  }, [transactions, currencyFilter, activeFilters, searchQuery, sortBy, exchangeRates]);

  const summary = useMemo(() => {
    let targetTxs = filteredTransactions;

    let dividendAmountKRW = 0;
    let countKRW = 0;
    const uniqueStocksKRW = new Set();

    let dividendAmountForeign = 0;
    let dividendAmountForeignKRW = 0;
    let countForeign = 0;
    const uniqueStocksForeign = new Set();

    const uniqueStocksAll = new Set();

    targetTxs.forEach(tx => {
      const isKRW = (tx.currency || 'KRW') === 'KRW';
      const rate = Number(tx.exchange_rate || (exchangeRates && exchangeRates[tx.currency]) || 1350);
      const originalAmt = Number(tx.dividend_amount) || 0;
      const amtKRW = isKRW
        ? (Number(tx.total_dividend) || originalAmt)
        : (Number(tx.total_dividend) || Math.round(originalAmt * rate));
      const amtForeign = isKRW ? 0 : (originalAmt || (amtKRW / rate));
      const stockId = tx.security_id || tx.stock_code || tx.stock_name || tx.stock || '';

      if (stockId) uniqueStocksAll.add(stockId);

      if (isKRW) {
        dividendAmountKRW += amtKRW;
        countKRW += 1;
        if (stockId) uniqueStocksKRW.add(stockId);
      } else {
        dividendAmountForeign += amtForeign;
        dividendAmountForeignKRW += amtKRW;
        countForeign += 1;
        if (stockId) uniqueStocksForeign.add(stockId);
      }
    });

    const totalDividendAllKRW = dividendAmountKRW + dividendAmountForeignKRW;
    const totalCountAll = countKRW + countForeign;
    const avgPerCountKRW = countKRW > 0 ? Math.round(dividendAmountKRW / countKRW) : 0;
    const avgPerCountForeign = countForeign > 0 ? (dividendAmountForeign / countForeign) : 0;
    const avgRateForeign = dividendAmountForeign > 0
      ? (dividendAmountForeignKRW / dividendAmountForeign)
      : (Number(exchangeRates?.USD) || 1350);

    // 월 평균 계산 (국내)
    let krwMonthCount = 1;
    if (activeFilters.dateFrom && activeFilters.dateTo) {
      const fromY = parseInt(activeFilters.dateFrom.substring(0, 4), 10);
      const fromM = parseInt(activeFilters.dateFrom.substring(5, 7), 10);
      const toY = parseInt(activeFilters.dateTo.substring(0, 4), 10);
      const toM = parseInt(activeFilters.dateTo.substring(5, 7), 10);
      if (!isNaN(fromY) && !isNaN(fromM) && !isNaN(toY) && !isNaN(toM)) {
        krwMonthCount = Math.max(1, (toY - fromY) * 12 + (toM - fromM) + 1);
      }
    } else {
      const krwMonths = new Set();
      targetTxs.forEach(tx => {
        const isKRW = (tx.currency || 'KRW') === 'KRW';
        if (isKRW && tx.date) {
          krwMonths.add(tx.date.substring(0, 7));
        }
      });
      krwMonthCount = Math.max(1, krwMonths.size);
    }

    const monthlyAvgKRW = countKRW > 0 ? Math.round(dividendAmountKRW / krwMonthCount) : 0;
    const rawMonthlyAvgCount = countKRW > 0 ? (countKRW / krwMonthCount) : 0;
    const monthlyAvgCountKRWDisplay = rawMonthlyAvgCount % 1 === 0
      ? rawMonthlyAvgCount.toString()
      : rawMonthlyAvgCount.toFixed(1);

    return {
      totalDividendAllKRW,
      totalCountAll,
      uniqueStocksAllCount: uniqueStocksAll.size,

      // 국내
      dividendAmountKRW,
      countKRW,
      uniqueStocksKRWCount: uniqueStocksKRW.size,
      avgPerCountKRW,
      monthlyAvgKRW,
      monthlyAvgCountKRWDisplay,

      // 해외
      dividendAmountForeign,
      dividendAmountForeignKRW,
      countForeign,
      uniqueStocksForeignCount: uniqueStocksForeign.size,
      avgRateForeign,
      avgPerCountForeign,
    };
  }, [filteredTransactions, exchangeRates, activeFilters.dateFrom, activeFilters.dateTo]);

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE));
  const PAGES_PER_BLOCK = 10;
  const currentBlock = Math.floor((currentPage - 1) / PAGES_PER_BLOCK);
  const startPage = currentBlock * PAGES_PER_BLOCK + 1;
  const endPage = Math.min(startPage + PAGES_PER_BLOCK - 1, totalPages);

  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const isFilterActive = activeFilters.dateFrom || activeFilters.dateTo || activeFilters.stockName || activeFilters.security_id || activeFilters.type !== '전체';
  const isToolbarFilterActive = Boolean(
    inputDateFrom ||
    inputDateTo ||
    activeFilters.dateFrom ||
    activeFilters.dateTo ||
    searchQuery.trim()
  );

  return (
    <div className="animate-fade-in text-slate-900">
      {/* Mobile Transaction View */}
      <div className="mobile-only-block w-full">
        <MobileTransactionList
          type="dividends"
          transactions={filteredTransactions}
          paginatedTransactions={paginatedTransactions}
          loading={loading}
          user={user}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          totalPages={totalPages}
          onOpenFilter={() => {
            if (!activeFilters.dateFrom && !activeFilters.dateTo) {
              const todayStr = new Date().toLocaleDateString('en-CA');
              const oneMonthAgo = new Date();
              oneMonthAgo.setMonth(new Date().getMonth() - 1);
              setTempFilters({
                ...activeFilters,
                dateFrom: oneMonthAgo.toLocaleDateString('en-CA'),
                dateTo: todayStr
              });
              setSelectedQuickPeriod('1개월');
            } else {
              setTempFilters({ ...activeFilters });
              setSelectedQuickPeriod(null);
            }
            setIsFilterModalOpen(true);
          }}
          onOpenRegister={() => toggleModal()}
          isFilterActive={isFilterActive}
          onResetFilter={() => {
            const initial = {
              dateFrom: '',
              dateTo: '',
              type: '전체',
              stockName: '',
              stockCode: '',
              security_id: ''
            };
            setActiveFilters(initial);
            setTempFilters(initial);
            setCurrentPage(1);
            showAlert('필터 초기화', '모든 필터 조건이 초기화되었습니다.', 'success');
          }}
          onEdit={handleEdit}
          onDelete={handleDelete}
          accountNameById={accountNameById}
          formatCurrency={formatCurrency}
          getCurrencyStyle={getCurrencyStyle}
        />
      </div>

      {/* Desktop Transaction View */}
      <div className="desktop-only h-full flex-col pb-0 animate-fade-in">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 flex items-center justify-center bg-amber-50 text-amber-600 rounded-xl border border-amber-100/50 shadow-sm">
              <Coins size={20} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-800">거래 내역</h1>
                {user && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-white px-3 py-1 rounded-xl border border-slate-200/80 shadow-2xs">
                    <CheckCircle2 size={13} className="text-slate-400" />
                    <span>총 <span className="font-bold text-slate-800">{filteredTransactions.length}건</span></span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">국내 · 해외 주식 배당 내역</p>
            </div>
          </div>

          {/* Action Buttons & Badges */}
          <div className="flex items-center gap-4">
            {!user ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg text-sm">
                로그인 후 보유 자산을 확인할 수 있습니다.
              </div>
            ) : (
              <button
                onClick={() => toggleModal()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all bg-brand hover:bg-brand-dark text-white cursor-pointer"
              >
                <Plus size={15} strokeWidth={2.5} />
                <span>등록</span>
              </button>
            )}
          </div>
        </div>

        {/* 로딩 화면 */}
        {user && loading && (
          <div className="glass-card py-24 flex flex-col items-center justify-center gap-3 mb-6">
            <div className="w-9 h-9 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="font-bold text-slate-700 text-base">배당 내역을 불러오는 중...</span>
            <span className="text-sm text-slate-400">잠시만 기다려주세요</span>
          </div>
        )}

        {/* 로그인 완료 및 로딩 완료 후 본문 표시 */}
        {user && !loading && (
          <>
        {/* 상단 4대 핵심 요약 카드 (Glass Card) - 추천 A안 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* 카드 1 */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-slate-500">
                총 배당금
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                  {currencyFilter === "ALL" && `총 ${summary.totalCountAll}건`}
                  {currencyFilter === "KRW" && `국내 ${summary.countKRW}건`}
                  {currencyFilter === "OVERSEAS" && `해외 ${summary.countForeign}건`}
                </span>
                <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Coins size={12} strokeWidth={2.5} />
                </div>
              </div>
            </div>
            <div className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none">
              <span className="text-2xl font-black tabular-nums tracking-tight text-slate-800 cursor-default select-none">
                <AnimatedDividendCounter
                  key={`card1-${currencyFilter}`}
                  value={
                    currencyFilter === "ALL"
                      ? summary.totalDividendAllKRW
                      : (currencyFilter === "OVERSEAS" ? summary.dividendAmountForeign : summary.dividendAmountKRW)
                  }
                  isForeign={currencyFilter === "OVERSEAS"}
                  showSign={false}
                  duration={800}
                />
              </span>
              {currencyFilter !== "OVERSEAS" && (
                <span className="text-xs font-bold text-slate-400">원</span>
              )}
            </div>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-50 pt-2">
              <span
                key={`div-card1-sub-${currencyFilter}-${summary.dividendAmountKRW}-${summary.dividendAmountForeign}`}
                className="animate-fade-in inline-block"
              >
                {currencyFilter === "ALL" && (
                  <>국내 {formatSubKRW(summary.dividendAmountKRW)} · 해외 {formatSubUSD(summary.dividendAmountForeign)}</>
                )}
                {currencyFilter === "OVERSEAS" && (
                  <>원화환산 {formatSubKRW(summary.dividendAmountForeignKRW)}</>
                )}
                {currencyFilter === "KRW" && "-"}
              </span>
              <span className="font-semibold text-slate-500">
                조회기간 합계
              </span>
            </div>
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          </div>

          {/* 카드 2 */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-slate-500">
                {currencyFilter === "ALL" && "국내 배당금"}
                {currencyFilter === "KRW" && "평균 배당금"}
                {currencyFilter === "OVERSEAS" && "평균 배당금"}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                  {currencyFilter === "ALL" && `국내 ${summary.countKRW}건`}
                  {currencyFilter === "KRW" && "월 평균"}
                  {currencyFilter === "OVERSEAS" && "평균 수령액"}
                </span>
                <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  {currencyFilter === "KRW" ? <Calendar size={12} strokeWidth={2.5} /> : <TrendingUp size={12} strokeWidth={2.5} />}
                </div>
              </div>
            </div>
            <div className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none">
              <span className="text-2xl font-black tabular-nums tracking-tight text-slate-800 cursor-default select-none">
                {currencyFilter === "ALL" && (
                  <AnimatedDividendCounter
                    key="card2-all"
                    value={summary.dividendAmountKRW}
                    isForeign={false}
                    showSign={false}
                    duration={800}
                  />
                )}
                {currencyFilter === "KRW" && (
                  <AnimatedDividendCounter
                    key="card2-krw-monthly-avg"
                    value={summary.monthlyAvgKRW}
                    isForeign={false}
                    showSign={false}
                    duration={800}
                  />
                )}
                {currencyFilter === "OVERSEAS" && (
                  <AnimatedDividendCounter
                    key="card2-overseas-avg"
                    value={summary.avgPerCountForeign}
                    isForeign={true}
                    duration={800}
                  />
                )}
              </span>
              {currencyFilter === "ALL" && <span className="text-xs font-bold text-slate-400">원</span>}
              {currencyFilter === "KRW" && <span className="text-xs font-bold text-slate-400">원</span>}
            </div>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-50 pt-2">
              <span
                key={`div-card2-sub-${currencyFilter}-${summary.monthlyAvgCountKRWDisplay}`}
                className="animate-fade-in inline-block"
              >
                {currencyFilter === "KRW" ? `월 평균 ${summary.monthlyAvgCountKRWDisplay}건` : "-"}
              </span>
              <span className="font-semibold text-slate-500">
                {currencyFilter === "ALL" && "원화 배당금"}
                {currencyFilter === "KRW" && "월 평균 수령액"}
                {currencyFilter === "OVERSEAS" && "1회 평균 수령액"}
              </span>
            </div>
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
          </div>

          {/* 카드 3 */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-slate-500">
                {currencyFilter === "ALL" && "해외 배당금"}
                {currencyFilter === "KRW" && "평균 배당금"}
                {currencyFilter === "OVERSEAS" && "평균환율"}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                  {currencyFilter === "ALL" && `$ ${summary.dividendAmountForeign.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  {currencyFilter === "KRW" && "평균 수령액"}
                  {currencyFilter === "OVERSEAS" && "KRW"}
                </span>
                <div className="w-5 h-5 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center">
                  {currencyFilter === "OVERSEAS" ? (
                    <Scale size={12} strokeWidth={2.5} />
                  ) : currencyFilter === "KRW" ? (
                    <CheckCircle2 size={12} strokeWidth={2.5} />
                  ) : (
                    <Globe size={12} strokeWidth={2.5} />
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none">
              <span className="text-2xl font-black tabular-nums tracking-tight text-slate-800 cursor-default select-none">
                {currencyFilter === "ALL" && (
                  <AnimatedDividendCounter
                    key="card3-all"
                    value={summary.dividendAmountForeignKRW}
                    isForeign={false}
                    showSign={false}
                    duration={800}
                  />
                )}
                {currencyFilter === "KRW" && (
                  <AnimatedDividendCounter
                    key="card3-krw-avg"
                    value={summary.avgPerCountKRW}
                    isForeign={false}
                    duration={800}
                  />
                )}
                {currencyFilter === "OVERSEAS" && (
                  <AnimatedDividendCounter
                    key="card3-overseas-rate"
                    value={summary.avgRateForeign}
                    isRate={true}
                    duration={800}
                  />
                )}
              </span>
              {currencyFilter === "ALL" && <span className="text-xs font-bold text-slate-400">원</span>}
              {currencyFilter === "KRW" && <span className="text-xs font-bold text-slate-400">원</span>}
              {currencyFilter === "OVERSEAS" && <span className="text-xs font-bold text-slate-400">원</span>}
            </div>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-50 pt-2">
              <span
                key={`div-card3-sub-${currencyFilter}-${summary.countForeign}-${summary.avgRateForeign}`}
                className="animate-fade-in inline-block"
              >
                {currencyFilter === "ALL" && (
                  summary.countForeign > 0 
                    ? `평균환율 ${Math.round(summary.avgRateForeign || 0).toLocaleString('ko-KR')}원`
                    : '평균환율 -'
                )}
                {currencyFilter === "OVERSEAS" && `총 ${summary.countForeign}건`}
                {currencyFilter === "KRW" && "-"}
              </span>
              <span className="font-semibold text-slate-500">
                {currencyFilter === "ALL" && "원화 환산 배당금"}
                {currencyFilter === "KRW" && "1회 평균 수령액"}
                {currencyFilter === "OVERSEAS" && "조회기간 평균환율"}
              </span>
            </div>
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
          </div>

          {/* 카드 4 */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-slate-500">
                {currencyFilter === "ALL" && "수령 현황"}
                {currencyFilter === "KRW" && "수령 현황"}
                {currencyFilter === "OVERSEAS" && "수령 현황"}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                  {currencyFilter === "ALL" && `총 ${summary.uniqueStocksAllCount} 종목`}
                  {currencyFilter === "KRW" && `총 ${summary.uniqueStocksKRWCount} 종목`}
                  {currencyFilter === "OVERSEAS" && `총 ${summary.uniqueStocksForeignCount} 종목`}
                </span>
                <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <CheckCircle2 size={12} strokeWidth={2.5} />
                </div>
              </div>
            </div>
            <div className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none">
              <span className="text-2xl font-black tabular-nums tracking-tight text-slate-800 cursor-default select-none">
                {currencyFilter === "ALL" && (
                  <AnimatedDividendCounter
                    key="card4-all"
                    value={summary.totalCountAll}
                    isCount={true}
                    duration={800}
                  />
                )}
                {currencyFilter === "KRW" && (
                  <AnimatedDividendCounter
                    key="card4-krw-count"
                    value={summary.countKRW}
                    isCount={true}
                    duration={800}
                  />
                )}
                {currencyFilter === "OVERSEAS" && (
                  <AnimatedDividendCounter
                    key="card4-overseas-count"
                    value={summary.countForeign}
                    isCount={true}
                    duration={800}
                  />
                )}
              </span>
              {currencyFilter === "ALL" && <span className="text-xs font-bold text-slate-400">건</span>}
              {currencyFilter === "KRW" && <span className="text-xs font-bold text-slate-400">건</span>}
              {currencyFilter === "OVERSEAS" && <span className="text-xs font-bold text-slate-400">건</span>}
            </div>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-50 pt-2">
              <span
                key={`div-card4-sub-${currencyFilter}-${summary.countKRW}-${summary.countForeign}`}
                className="animate-fade-in inline-block"
              >
                {currencyFilter === "ALL" ? `국내 ${summary.countKRW}건 · 해외 ${summary.countForeign}건` : "-"}
              </span>
              <span className="font-semibold text-slate-500">
                조회기간 합계
              </span>
            </div>
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
          </div>
        </div>

        {/* 컨트롤 툴바: 날짜 범위 / 검색창 / 통화 탭 / 정렬 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-3.5 mb-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 relative z-30">
          {/* 좌측 그룹: 필터 접힘/펼침 버튼 + 상세 필터 인라인 영역 */}
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setIsFilterPanelOpen(prev => !prev)}
              className={`h-9 w-9 flex items-center justify-center rounded-xl border transition-all cursor-pointer shrink-0 select-none relative ${
                isFilterPanelOpen
                  ? 'bg-amber-500 border-amber-500 text-white hover:bg-amber-600 shadow-xs ring-2 ring-amber-200'
                  : isToolbarFilterActive
                    ? 'bg-amber-500 border-amber-500 text-white shadow-xs ring-2 ring-amber-200'
                    : 'bg-amber-50/90 border-amber-200/90 text-amber-600 hover:bg-amber-100 hover:border-amber-300 shadow-2xs'
              }`}
              title={isFilterPanelOpen ? "상세 필터 접기" : "상세 필터 펼치기"}
            >
              <ChevronLeft
                size={16}
                strokeWidth={2.5}
                className={`transition-transform duration-300 ${
                  isFilterPanelOpen ? 'text-white' : 'rotate-180 text-current'
                }`}
              />
              {isToolbarFilterActive && !isFilterPanelOpen && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
              )}
            </button>

            {/* 접힘/펼침 상세 필터 영역 */}
            {isFilterPanelMounted && (
              <div
                className={`flex flex-wrap items-center gap-3 transition-opacity duration-200 ${
                  isFilterPanelClosing ? 'animate-fade-out' : 'animate-fade-in'
                }`}
              >
                {/* 날짜 범위 선택 */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* 시작일 */}
                  <div className="relative z-30" ref={toolbarDateFromRef}>
                    <div className="h-9 flex items-center gap-1 border border-slate-200 rounded-xl px-2.5 bg-white shadow-2xs hover:border-slate-300 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10 transition-all">
                      <input
                        type="text"
                        value={inputDateFrom}
                        onChange={(e) => handleDateInputChange(e.target.value, 'from')}
                        onFocus={(e) => handleDateInputFocus('from', e)}
                        onBlur={() => handleDateInputCommit('from')}
                        onKeyDown={(e) => handleDateInputKeyDown(e, 'from')}
                        placeholder="YYYY-MM-DD"
                        maxLength={14}
                        className="w-[82px] text-xs text-slate-700 placeholder-slate-400 font-bold tabular-nums focus:outline-none bg-transparent tracking-tight text-center"
                      />
                      <button
                        type="button"
                        ref={toolbarDateFromBtnRef}
                        onClick={() => {
                          setIsToolbarToCalendarOpen(false);
                          setIsToolbarFromCalendarOpen(prev => !prev);
                        }}
                        className="p-0.5 text-slate-400 hover:text-brand transition-colors cursor-pointer shrink-0"
                        title="달력으로 시작일 선택"
                      >
                        <Calendar size={14} />
                      </button>
                    </div>

                    {dateFromError && (
                      <div className="absolute left-0 top-full mt-1.5 z-50 bg-white border border-rose-200 text-rose-600 shadow-lg rounded-xl px-2.5 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap animate-slide-up">
                        <span>{dateFromError}</span>
                        <button
                          type="button"
                          onClick={() => setDateFromError('')}
                          className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                          title="닫기"
                        >
                          <X size={12} strokeWidth={2.5} />
                        </button>
                      </div>
                    )}

                    {isToolbarFromCalendarOpen && (
                      <div
                        className="absolute left-0 top-full mt-1.5 z-[100] bg-white rounded-2xl shadow-2xl border border-slate-100 p-2.5 w-[245px]"
                        style={{ backgroundColor: '#ffffff' }}
                      >
                        <CalendarUI
                          initialYear={activeFilters.dateFrom && activeFilters.dateFrom.includes('-') ? parseInt(activeFilters.dateFrom.substring(0, 4)) : new Date().getFullYear()}
                          initialMonth={activeFilters.dateFrom && activeFilters.dateFrom.includes('-') ? parseInt(activeFilters.dateFrom.substring(5, 7)) : (new Date().getMonth() + 1)}
                          onSelect={(y, m, d) => {
                            const formatted = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                            setActiveFilters(prev => ({ ...prev, dateFrom: formatted }));
                            setInputDateFrom(formatToolbarDate(formatted));
                            setDateFromError('');
                            setIsToolbarFromCalendarOpen(false);
                            setCurrentPage(1);
                            setTimeout(() => {
                              toolbarDateToInputRef.current?.focus();
                            }, 50);
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <span className="text-slate-400 text-xs font-bold tabular-nums">~</span>

                  {/* 종료일 */}
                  <div className="relative z-30" ref={toolbarDateToRef}>
                    <div className="h-9 flex items-center gap-1 border border-slate-200 rounded-xl px-2.5 bg-white shadow-2xs hover:border-slate-300 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10 transition-all">
                      <input
                        ref={toolbarDateToInputRef}
                        type="text"
                        value={inputDateTo}
                        onChange={(e) => handleDateInputChange(e.target.value, 'to')}
                        onFocus={(e) => handleDateInputFocus('to', e)}
                        onBlur={() => handleDateInputCommit('to')}
                        onKeyDown={(e) => handleDateInputKeyDown(e, 'to')}
                        placeholder="YYYY-MM-DD"
                        maxLength={14}
                        className="w-[82px] text-xs text-slate-700 placeholder-slate-400 font-bold tabular-nums focus:outline-none bg-transparent tracking-tight text-center"
                      />
                      <button
                        type="button"
                        ref={toolbarDateToBtnRef}
                        onClick={() => {
                          setIsToolbarFromCalendarOpen(false);
                          setIsToolbarToCalendarOpen(prev => !prev);
                        }}
                        className="p-0.5 text-slate-400 hover:text-brand transition-colors cursor-pointer shrink-0"
                        title="달력으로 종료일 선택"
                      >
                        <Calendar size={14} />
                      </button>
                    </div>

                    {dateToError && (
                      <div className="absolute left-0 top-full mt-1.5 z-50 bg-white border border-rose-200 text-rose-600 shadow-lg rounded-xl px-2.5 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap animate-slide-up">
                        <span>{dateToError}</span>
                        <button
                          type="button"
                          onClick={() => setDateToError('')}
                          className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                          title="닫기"
                        >
                          <X size={12} strokeWidth={2.5} />
                        </button>
                      </div>
                    )}

                    {isToolbarToCalendarOpen && (
                      <div
                        className="absolute left-0 top-full mt-1.5 z-[100] bg-white rounded-2xl shadow-2xl border border-slate-100 p-2.5 w-[245px]"
                        style={{ backgroundColor: '#ffffff' }}
                      >
                        <CalendarUI
                          initialYear={activeFilters.dateTo && activeFilters.dateTo.includes('-') ? parseInt(activeFilters.dateTo.substring(0, 4)) : new Date().getFullYear()}
                          initialMonth={activeFilters.dateTo && activeFilters.dateTo.includes('-') ? parseInt(activeFilters.dateTo.substring(5, 7)) : (new Date().getMonth() + 1)}
                          onSelect={(y, m, d) => {
                            const formatted = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                            setActiveFilters(prev => ({ ...prev, dateTo: formatted }));
                            setInputDateTo(formatToolbarDate(formatted));
                            setDateToError('');
                            setIsToolbarToCalendarOpen(false);
                            setCurrentPage(1);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 종목명 또는 종목코드 검색 */}
                <div className="relative w-64 md:w-72 shrink-0">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="종목명 또는 종목코드 검색"
                    className="w-full h-9 pl-9 pr-7 rounded-xl text-xs text-slate-700 placeholder-slate-400 font-medium border border-slate-200 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* 필터 초기화 버튼 */}
                <button
                  type="button"
                  onClick={handleClearDateAndSearch}
                  className={`h-9 w-9 flex items-center justify-center rounded-xl border transition-all cursor-pointer shrink-0 ${
                    isToolbarFilterActive
                      ? 'bg-blue-50 border-blue-300 text-brand hover:bg-blue-100 hover:border-blue-400 shadow-xs ring-2 ring-blue-100'
                      : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:bg-slate-50 shadow-2xs'
                  }`}
                  title="검색 조건 초기화"
                >
                  <RotateCcw size={14} strokeWidth={2.2} />
                </button>
              </div>
            )}
          </div>

          {/* 우측 그룹: 통화 탭 + 정렬 드롭다운 */}
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <div className="flex bg-slate-100 p-0.5 rounded-xl h-9 items-center">
              <button
                onClick={() => setCurrencyFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currencyFilter === "ALL" ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => setCurrencyFilter("KRW")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currencyFilter === "KRW" ? 'bg-blue-500 text-white shadow-xs' : 'text-slate-500 hover:text-blue-600'
                }`}
              >
                국내
              </button>
              <button
                onClick={() => setCurrencyFilter("OVERSEAS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currencyFilter === "OVERSEAS" ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500 hover:text-amber-600'
                }`}
              >
                해외
              </button>
            </div>

            {/* 정렬 드롭다운 */}
            <div className="relative" ref={sortDropdownRef}>
              <button
                type="button"
                onClick={() => setIsSortDropdownOpen((prev) => !prev)}
                className={`h-9 flex items-center gap-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs select-none ${
                  isSortDropdownOpen
                    ? 'bg-blue-50/50 border-brand ring-2 ring-brand/10 text-brand shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/60 hover:text-slate-900'
                }`}
              >
                <ArrowUpDown size={13} className={isSortDropdownOpen ? 'text-brand' : 'text-slate-400'} />
                <span className="tracking-tight">{SORT_OPTIONS.find((opt) => opt.value === sortBy)?.label || "정렬 기준"}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${
                    isSortDropdownOpen ? 'rotate-180 text-brand' : 'text-slate-400'
                  }`}
                />
              </button>

              {isSortDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-44 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/70 z-50 p-1.5 animate-fade-in">
                  <div className="space-y-0.5">
                    {SORT_OPTIONS.map((opt) => {
                      const isSelected = sortBy === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setSortBy(opt.value);
                            setIsSortDropdownOpen(false);
                          }}
                          className={`w-full px-2.5 py-2 text-xs rounded-xl transition-all text-left flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-brand/10 text-brand font-black'
                              : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 font-semibold'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isSelected && <Check size={14} className="text-brand shrink-0" strokeWidth={2.5} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm mb-3">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-500">종목</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-500">배당일</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">배당금&nbsp;&nbsp;&nbsp;</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-500">계좌</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-500">옵션</th>
              </tr>
            </thead>
            <tbody key={`dividends-tx-${currentPage}-${currencyFilter}-${sortBy}`} className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-slate-200 border-t-brand rounded-full animate-spin"></div>
                      <span>배당내역을 불러오는 중...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <span>{user ? '등록된 배당내역이 없습니다.' : '로그인 후 배당내역을 확인할 수 있습니다.'}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx, i) => {
                  const isKRW = (tx.currency || 'KRW') === 'KRW';
                  const code = tx.stock_code || tx.security?.code || tx.stockCode || '';
                  const rawName = tx.stock_name || tx.security?.name || tx.stock || '';
                  const displayName = STOCK_KR_NAMES[code] || rawName;
                  const rate = Number(tx.exchange_rate || (exchangeRates && exchangeRates[tx.currency]) || 1350);
                  const originalAmt = Number(tx.dividend_amount) || 0;
                  const amountKRW = isKRW
                    ? (Number(tx.total_dividend) || originalAmt)
                    : (Number(tx.total_dividend) || Math.round(originalAmt * rate));
                  const foreignAmount = isKRW ? 0 : (originalAmt || (amountKRW / rate));

                  return (
                    <tr key={tx.id || `div-tx-${i}`} className={`h-[72px] hover:bg-slate-50/80 transition-colors group opacity-0 animate-row-fade stagger-${(i % 9) + 1}`}>
                      {/* 1. 종목 */}
                      <td className="px-6 py-2">
                        <div className="flex items-center gap-3 min-h-[52px]">
                          <StockLogo code={code} name={displayName} isKRW={isKRW} />
                          <div className="flex flex-col justify-center max-w-[240px]">
                            <p className="text-sm text-slate-900 font-bold leading-tight truncate">
                              {displayName}
                            </p>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="font-mono text-slate-400 font-medium text-[11px] w-[62px] shrink-0 truncate">
                                {formatStockCode(code)}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 text-center leading-none ${
                                  isKRW
                                    ? "bg-blue-50 text-blue-600 border-blue-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}
                              >
                                {isKRW ? "국내" : "해외"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. 배당일 */}
                      <td className="px-6 py-2 text-center text-sm font-bold text-slate-700 tabular-nums">
                        {formatDisplayDate(tx.date)}
                      </td>

                      {/* 3. 배당금 */}
                      <td className="px-6 py-2 text-right">
                        <div className="flex flex-col items-end justify-center">
                          {isKRW ? (
                            <span className="text-sm font-bold text-slate-900 tabular-nums">
                              {amountKRW.toLocaleString('ko-KR')}원
                            </span>
                          ) : (
                            <>
                              <span className="text-sm font-bold text-slate-900 tabular-nums">
                                {formatForeignAmount(foreignAmount, tx.currency || 'USD')}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-400 tabular-nums mt-0.5">
                                {amountKRW.toLocaleString('ko-KR')}원
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* 4. 계좌 */}
                      <td className="px-6 py-2 text-center text-sm font-medium text-slate-700">
                        {accountNameById[tx.account_id] || tx.account || ''}
                      </td>

                      {/* 5. 옵션 */}
                      <td className="px-6 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(tx)}
                            className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="수정"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }).concat(
                  paginatedTransactions.length > 0 && paginatedTransactions.length < ITEMS_PER_PAGE ?
                    [...Array(ITEMS_PER_PAGE - paginatedTransactions.length)].map((_, i) => (
                      <tr key={`empty-${i}`} className={`h-[72px] opacity-0 animate-row-fade stagger-${paginatedTransactions.length + i + 1}`}>
                        <td colSpan="5" className="px-6 py-2"><div className="min-h-[52px]">&nbsp;</div></td>
                      </tr>
                    )) : []
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-1 flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 10))}
              disabled={currentPage === 1}
              className={`p-2 rounded-xl transition-all ${currentPage === 1
                ? 'text-slate-200 cursor-not-allowed opacity-30'
                : 'text-slate-700 hover:bg-slate-100 hover:text-brand cursor-pointer'
                }`}
              title="10페이지 앞으로"
            >
              <ChevronsLeft size={20} />
            </button>

            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`p-2 rounded-xl transition-all ${currentPage === 1
                ? 'text-slate-200 cursor-not-allowed opacity-50'
                : 'text-slate-700 hover:bg-slate-100 hover:text-brand cursor-pointer'
                }`}
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-10 h-10 rounded-xl text-sm font-bold transition-all cursor-pointer ${currentPage === pageNum
                    ? 'bg-brand text-white shadow-lg shadow-brand/20'
                    : 'text-slate-500 hover:bg-slate-50'
                    }`}
                >
                  {pageNum}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`p-2 rounded-xl transition-all ${currentPage === totalPages
                ? 'text-slate-300 cursor-not-allowed opacity-50'
                : 'text-slate-700 hover:bg-slate-100 hover:text-brand cursor-pointer'
                }`}
            >
              <ChevronRight size={20} />
            </button>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 10))}
              disabled={currentPage > totalPages - 1}
              className={`p-2 rounded-xl transition-all ${currentPage > totalPages - 1
                ? 'text-slate-200 cursor-not-allowed opacity-30'
                : 'text-slate-700 hover:bg-slate-100 hover:text-brand cursor-pointer'
                }`}
              title="10페이지 뒤로"
            >
              <ChevronsRight size={20} />
            </button>
          </div>
        )}
          </>
        )}
      </div>

      {/* Add Transaction Modal */}
      {isModalMounted && mounted && createPortal(
        <div 
          className={`fixed inset-0 z-[9990] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 ${
            isModalClosing ? 'animate-fade-out pointer-events-none' : 'animate-fade-in'
          }`} 
          onClick={toggleModal}
        >
          <div 
            className={`relative bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col pointer-events-auto ${
              isModalClosing ? 'animate-modal-out' : 'animate-page-slide'
            }`} 
            onClick={(e) => e.stopPropagation()}
          >

            <div className="flex-shrink-0 flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  {editingId ? <Edit2 size={16} strokeWidth={2.5} /> : <PlusCircle size={18} strokeWidth={2.5} />}
                </div>
                <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">{editingId ? '수정' : '등록'}</h3>
              </div>
              <button 
                onClick={toggleModal} 
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            <form ref={modalFormRef} onSubmit={handleSubmit} className="p-5 md:p-6 overflow-y-auto overscroll-contain flex-1 space-y-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {/* 1. 배당일 & 계좌 (2열 나란히 배치, 거래내역-매매 등록 팝업 양식) */}
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
                      {formData.year && formData.month && formData.day ? `${formData.year}-${formData.month.toString().padStart(2, '0')}-${formData.day.toString().padStart(2, '0')}` : '배당일 선택'}
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
                    onClick={async () => {
                      const next = !isAccountDropdownOpen;
                      setIsAccountDropdownOpen(next);
                      if (next) await refreshAccounts();
                    }}
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

              {/* 2. 종목 & 배당금 (가로 비율 조정: 종목 확대 col-span-3, 배당금 축소 col-span-2) */}
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
                        <input
                          ref={stockRef}
                          type="text"
                          placeholder="종목명 입력 (엔터로 검색)"
                          value={formData.stock}
                          onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value.toUpperCase(), security_id: '' }))}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (isStockDropdownOpen && focusedStockIndex >= 0 && searchedStocks[focusedStockIndex]) {
                                const stock = searchedStocks[focusedStockIndex];
                                const stockCur = stock.currency || (['KOSPI', 'KOSDAQ', 'KONEX', 'KRX'].includes(stock.market) || stock.exchange_code === 'KRX' ? 'KRW' : 'USD');
                                setFormData(prev => ({
                                  ...prev,
                                  security_id: stock.security_id,
                                  stock: `[${stock.code}] ${stock.name}`,
                                  stockCode: stock.code,
                                  exchange_code: stock.exchange_code || '',
                                  currency: stockCur
                                }));
                                setIsStockDropdownOpen(false);
                                setFocusedStockIndex(-1);
                                setTimeout(() => priceRef.current?.focus(), 50);
                              } else {
                                setIsSearchingStock(true);
                                setIsStockDropdownOpen(true);
                                setFocusedStockIndex(-1);
                                try {
                                  let searchTerm = formData.stock.trim();
                                  const match = searchTerm.match(/\[(.*?)\]/);
                                  if (match && match[1]) {
                                    searchTerm = match[1];
                                  } else {
                                    const parts = searchTerm.split('] ');
                                    if (parts.length > 1) searchTerm = parts[1];
                                  }

                                  const results = await TransactionManager.searchStocksByName(searchTerm, null);
                                  setSearchedStocks(results);
                                  if (results.length > 0) setFocusedStockIndex(0);
                                } catch (err) {
                                  console.error(err);
                                  setSearchedStocks([]);
                                } finally {
                                  setIsSearchingStock(false);
                                }
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
                                setIsStockDropdownOpen(true);
                                setFocusedStockIndex(0);
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
                          onClick={async () => {
                            const next = !isStockDropdownOpen;
                            if (next) {
                              setIsSearchingStock(true);
                              setIsStockDropdownOpen(true);
                              try {
                                let searchTerm = formData.stock ? formData.stock.trim() : '';
                                const match = searchTerm.match(/\[(.*?)\]/);
                                if (match && match[1]) {
                                  searchTerm = match[1];
                                } else {
                                  const parts = searchTerm.split('] ');
                                  if (parts.length > 1) searchTerm = parts[1];
                                }

                                const results = await TransactionManager.searchStocksByName(searchTerm, null);
                                setSearchedStocks(results);
                              } catch (err) {
                                console.error(err);
                                setSearchedStocks([]);
                              } finally {
                                setIsSearchingStock(false);
                              }
                            } else {
                              setIsStockDropdownOpen(false);
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
                                onClick={() => {
                                  const stockCur = stock.currency || (['KOSPI', 'KOSDAQ', 'KONEX', 'KRX'].includes(stock.market) || stock.exchange_code === 'KRX' ? 'KRW' : 'USD');
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    stock: `[${stock.code}] ${stock.name}`, 
                                    stockCode: stock.code, 
                                    security_id: stock.security_id, 
                                    exchange_code: stock.exchange_code || '',
                                    currency: stockCur 
                                  }));
                                  setIsStockDropdownOpen(false);
                                  setTimeout(() => priceRef.current?.focus(), 50);
                                }}
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
                      type="text"
                      placeholder="0"
                      value={formData.dividendAmount}
                      onChange={(e) => handleNumberInput(e, 'dividendAmount')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          priceRef.current?.blur();
                        } else if (e.key === 'Tab' && e.shiftKey) {
                          e.preventDefault();
                          setIsStockDropdownOpen(false);
                          setFormData(prev => ({
                            ...prev,
                            security_id: '',
                            stock: prev.stock ? prev.stock.replace(`[${prev.stockCode}] `, '') : ''
                          }));
                          setTimeout(() => {
                            stockRef.current?.focus();
                            stockRef.current?.select();
                          }, 50);
                        }
                      }}
                      onBlur={(e) => {
                        const val = e.target.value.replace(/,/g, '');
                        if (val && !isNaN(parseFloat(val)) && formData.currency !== 'KRW') {
                          const formatted = parseFloat(val).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          setFormData(prev => ({ ...prev, dividendAmount: formatted }));
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

              {/* 3. 총 배당금 (매매 거래금액 카드와 동일 양식) */}
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
                  onClick={toggleModal}
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
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/25 cursor-pointer'
                  } focus:outline-none`}
                >
                  {loading ? '처리 중...' : (editingId ? '수정 완료' : '등록 완료')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {isStockMounted && mounted && createPortal(
        <div className={`fixed inset-0 z-[9995] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 transition-opacity ${isStockClosing ? 'animate-fade-out pointer-events-none' : 'animate-fade-in'}`} onClick={() => setIsStockModalOpen(false)}>
          <div className={`relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-visible max-h-[90vh] flex flex-col pointer-events-auto ${isStockClosing ? 'animate-modal-out' : 'animate-page-slide'}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-800">종목 추가</h3>
              <button onClick={() => setIsStockModalOpen(false)} className="p-1.5 -mr-1 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-visible">
              <div className="space-y-4">
                <div className="flex gap-3 items-end">
                  <div className="flex-1 relative" ref={searchDropdownRef}>
                    <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">종목명</label>
                    <input
                      type="text"
                      placeholder="우측에서 검색해주세요"
                      value={stockForm.name}
                      readOnly={!stockForm.name || stockForm.name === '검색 중...'}
                      onChange={(e) => setStockForm(prev => ({ ...prev, name: e.target.value }))}
                      onFocus={() => setIsNameFocused(true)}
                      onBlur={() => setIsNameFocused(false)}
                      ref={stockModalNameRef}
                      className={`w-full h-12 px-3.5 rounded-2xl border focus:outline-none transition-all font-bold text-xs text-center box-border shadow-xs placeholder:text-center placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs ${
                        !stockForm.name || stockForm.name === '검색 중...' 
                          ? 'bg-slate-100/70 border-slate-200 text-slate-400 cursor-not-allowed' 
                          : `bg-slate-50 border-slate-200 text-slate-800 hover:border-blue-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${isNameFocused ? 'cursor-text' : 'cursor-pointer'}`
                      }`}
                    />
                    {isSearchDropdownOpen && stockSearchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-[60] py-1.5 max-h-[140px] overflow-y-auto">
                        {stockSearchResults.map((res, i) => (
                          <button
                            key={`${res.code}-${i}`}
                            type="button"
                            className="w-full px-4 py-2 hover:bg-slate-50 text-left transition-colors flex justify-between items-center group cursor-pointer"
                            onClick={() => {
                              setStockForm({
                                ...stockForm,
                                name: res.name.replace(/\s*[㈜|주식|코스닥|코스피]\s*$/g, ''),
                                code: res.code,
                                exchange_code: res.exchange_code || ''
                              });
                              setIsSearchDropdownOpen(false);
                              setStockSearchResults([]);
                            }}
                          >
                            <span className="font-bold text-slate-700 group-hover:text-blue-600 text-xs">{res.name}</span>
                            <span className="text-[11px] font-bold text-slate-400">[{res.code}]{['KOSPI', 'KOSDAQ', 'KONEX'].includes(res.market) ? '' : ` ${res.market}`}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="w-[140px] shrink-0">
                    <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">종목코드</label>
                    <input
                      type="text"
                      placeholder="입력(엔터)"
                      value={stockForm.code}
                      onChange={(e) => {
                        const transliterated = transliterateKOtoEN(e.target.value);
                        if (transliterated.length <= 10) {
                          setStockForm(prev => ({ ...prev, code: transliterated }));
                        }
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && stockForm.code) {
                          e.preventDefault();
                          try {
                            setIsSearchDropdownOpen(false);
                            setStockForm(prev => ({ ...prev, name: '검색 중...' }));
                            
                            const res = await fetch(`/api/stock-info?code=${stockForm.code}`);
                            const data = await res.json();
                            
                            if (res.ok && data.results && data.results.length > 0) {
                              const uniqueResults = data.results.reduce((acc, current) => {
                                const exists = acc.find(item => item.code === current.code);
                                if (!exists) {
                                  acc.push(current);
                                }
                                return acc;
                              }, []);

                              if (uniqueResults.length === 1) {
                                const item = uniqueResults[0];
                                setStockForm({
                                  ...stockForm,
                                  name: item.name.replace(/\s*[㈜|주식|코스닥|코스피]\s*$/g, ''),
                                  code: item.code,
                                  exchange_code: item.exchange_code || ''
                                });
                              } else {
                                setStockSearchResults(uniqueResults);
                                setIsSearchDropdownOpen(true);
                                setStockForm(prev => ({ ...prev, name: '' }));
                              }
                            } else {
                              setStockForm(prev => ({ ...prev, name: '' }));
                              showAlert("조회불가", <span><strong className="font-bold text-slate-800">&quot;{stockForm.code}&quot;</strong> 종목을 찾을 수 없습니다.</span>, "error", stockModalCodeRef);
                            }
                          } catch (err) {
                            console.error('Fetch error:', err);
                            setStockForm(prev => ({ ...prev, name: '' }));
                            showAlert("검색 오류", "정보를 가져오는 중 일시적인 오류가 발생했습니다.", "error", stockModalCodeRef);
                          }
                        }
                      }}
                      ref={stockModalCodeRef}
                      className="w-full h-12 px-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-800 text-center bg-white shadow-xs transition-all uppercase placeholder:text-center placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs"
                    />
                  </div>
                </div>

                <div className="flex gap-3 items-end">
                  <div className="flex-1 relative" ref={sectorRef}>
                    <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">섹터</label>
                    <div
                      onClick={() => setIsSectorDropdownOpen(!isSectorDropdownOpen)}
                      className="w-full h-12 px-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/50 focus-within:border-blue-500 transition-all cursor-pointer flex items-center justify-center relative shadow-xs"
                    >
                      <input 
                        type="text" 
                        readOnly
                        placeholder="섹터 선택"
                        value={stockForm.sector}
                        className={`w-full bg-transparent outline-none cursor-pointer text-center text-xs placeholder:text-center ${
                          !stockForm.sector ? 'text-slate-400 font-medium placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs' : 'text-slate-800 font-bold'
                        }`}
                      />
                      <ChevronDown
                        size={16}
                        className={`text-slate-400 shrink-0 absolute right-3.5 pointer-events-none transition-transform ${isSectorDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </div>
                    {isSectorDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 overflow-hidden">
                        <div className="py-1.5 max-h-52 overflow-y-auto block overflow-x-hidden">
                          {sectorOptions.map((sector) => (
                            <button
                              key={sector}
                              type="button"
                              className="w-full px-4 py-2 text-xs hover:bg-blue-50 hover:text-blue-600 transition-colors text-center font-bold text-slate-700 cursor-pointer"
                              onClick={() => {
                                setStockForm(prev => ({ ...prev, sector }));
                                setIsSectorDropdownOpen(false);
                              }}
                            >
                              {sector}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-[140px] shrink-0">
                    <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">통화</label>
                    <div className="relative" ref={currencyRef}>
                      <div
                        onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                        className={`w-full h-12 px-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-center relative shadow-xs ${
                          stockForm.currency === 'USD' 
                            ? 'border-emerald-200 bg-emerald-50/70 text-emerald-600 hover:bg-emerald-100/50' 
                            : 'border-blue-200 bg-blue-50/70 text-blue-600 hover:bg-blue-100/50'
                        }`}
                      >
                        <span className="text-center text-xs font-bold tracking-wide">
                          {stockForm.currency || 'KRW'}
                        </span>
                        <ChevronDown
                          size={16}
                          className={`shrink-0 absolute right-3 pointer-events-none transition-transform ${
                            stockForm.currency === 'USD' ? 'text-emerald-500' : 'text-blue-500'
                          } ${isCurrencyDropdownOpen ? 'rotate-180' : ''}`}
                        />
                      </div>
                      {isCurrencyDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 overflow-hidden">
                          <div className="py-1.5 max-h-52 overflow-y-auto block overflow-x-hidden">
                            {[
                              { code: 'KRW', label: 'KRW', color: 'hover:bg-blue-50 hover:text-blue-600' },
                              { code: 'USD', label: 'USD', color: 'hover:bg-emerald-50 hover:text-emerald-600' }
                            ].map((curr) => (
                              <button
                                key={curr.code}
                                type="button"
                                className={`w-full px-3 py-2 text-xs transition-colors text-center font-bold cursor-pointer ${
                                  stockForm.currency === curr.code 
                                    ? (curr.code === 'USD' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600') 
                                    : `text-slate-700 ${curr.color}`
                                }`}
                                onClick={() => {
                                  setStockForm(prev => ({ ...prev, currency: curr.code }));
                                  setIsCurrencyDropdownOpen(false);
                                }}
                              >
                                {curr.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsStockModalOpen(false)}
                  className="flex-1 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!stockForm.name.trim()) {
                      showAlert("입력 오류", "종목명을 입력해 주세요.", "error", stockModalNameRef);
                      return;
                    }
                    if (!stockForm.code.trim()) {
                      showAlert("입력 오류", "종목코드를 입력해 주세요.", "error", stockModalCodeRef);
                      return;
                    }
                    if (!stockForm.sector.trim()) {
                      showAlert("입력 오류", "섹터를 선택해 주세요.", "error");
                      return;
                    }

                    try {
                      const isDuplicate = await TransactionManager.checkStockDuplicate(
                        stockForm.name.trim(),
                        stockForm.code.trim()
                      );
                      if (isDuplicate) {
                        showAlert("등록 오류", "이미 등록된 종목명 또는 종목코드입니다.", "error");
                        return;
                      }
                    } catch (err) {
                      console.error('중복 체크 오류:', err);
                    }
                    try {
                      const newStock = await TransactionManager.addStock({
                        name: stockForm.name.trim(),
                        code: stockForm.code.trim(),
                        sector: stockForm.sector.trim(),
                        currency: stockForm.currency.trim() || 'KRW',
                        exchange_code: stockForm.exchange_code || ''
                      });

                      if (newStock) {
                        setFormData(prev => ({
                          ...prev,
                          security_id: newStock.security_id || newStock.id,
                          stock: `[${newStock.code}] ${newStock.name}`,
                          stockCode: newStock.code,
                          currency: newStock.currency || prev.currency
                        }));
                      }

                      setStockForm({ name: '', code: '', sector: '', currency: 'KRW', exchange_code: '' });
                      setIsStockModalOpen(false);
                      showAlert("등록 완료", "종목이 성공적으로 등록되었습니다.", "success");
                    } catch (error) {
                      console.error('종목 등록 오류:', error);
                      showAlert("등록 오류", "종목 등록 중 오류가 발생했습니다.", "error");
                    }
                  }}
                  className="flex-1 h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-md shadow-blue-500/25 cursor-pointer"
                >
                  등록
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

            {/* Account Registration Modal */}
      {isAccountMounted && mounted && createPortal(
        <div className={`fixed inset-0 z-[9995] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 transition-opacity ${isAccountClosing ? 'animate-fade-out pointer-events-none' : 'animate-fade-in'}`} onClick={() => setIsAccountModalOpen(false)}>
          <div className={`relative bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 overflow-visible max-h-[90vh] flex flex-col pointer-events-auto ${isAccountClosing ? 'animate-modal-out' : 'animate-page-slide'}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-800">계좌등록</h3>
              <button onClick={() => setIsAccountModalOpen(false)} className="p-1.5 -mr-1 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-visible">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">금융기관</label>
                  <input
                    type="text"
                    placeholder="금융기관 입력"
                    value={accountForm.institution}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, institution: e.target.value }))}
                    ref={institutionRef}
                    className="w-full h-12 px-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-800 bg-white shadow-xs transition-all text-center placeholder:text-center placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">계좌구분</label>
                  <div className="relative" ref={accountTypeRef}>
                    <div
                      onClick={() => setIsAccountTypeDropdownOpen(!isAccountTypeDropdownOpen)}
                      className="w-full h-12 px-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/50 focus-within:border-blue-500 transition-all cursor-pointer flex items-center justify-center relative shadow-xs"
                    >
                      <input
                        type="text"
                        readOnly
                        placeholder="구분 선택"
                        value={accountForm.type}
                        onChange={(e) => setAccountForm(prev => ({ ...prev, type: e.target.value.toUpperCase() }))}
                        ref={accountTypeInputRef}
                        className={`w-full bg-transparent outline-none cursor-pointer text-center text-xs placeholder:text-center ${
                          !accountForm.type ? 'text-slate-400 font-medium placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs' : 'text-slate-800 font-bold'
                        }`}
                      />
                      <ChevronDown
                        size={16}
                        className={`text-slate-400 shrink-0 absolute right-3.5 pointer-events-none transition-transform ${isAccountTypeDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </div>
                    {isAccountTypeDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 overflow-hidden">
                        <div className="py-1.5 max-h-48 overflow-y-auto block overflow-x-hidden">
                          {['일반', 'ISA', 'IRP', 'DC', '연금저축', '기타'].map((type) => (
                            <button
                              key={type}
                              type="button"
                              className="w-full px-3 py-2 text-center hover:bg-blue-50 hover:text-blue-600 transition-colors font-bold text-slate-700 text-xs cursor-pointer"
                              onClick={() => {
                                setAccountForm(prev => ({ ...prev, type }));
                                setIsAccountTypeDropdownOpen(false);
                              }}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="flex-1 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!accountForm.institution.trim()) {
                      setIsAccountTypeDropdownOpen(false);
                      showAlert("입력 오류", "금융기관을 입력해 주세요.", "error", institutionRef);
                      return;
                    }
                    if (!accountForm.type.trim()) {
                      showAlert("입력 오류", "계좌구분을 입력 또는 선택해 주세요.", "error", accountTypeInputRef);
                      return;
                    }
                    const combined = `${accountForm.institution.trim()} (${accountForm.type.trim()})`;
                    const exists = await TransactionManager.isAccountNameExists(combined);
                    if (exists) {
                      showAlert("입력 오류", "이미 등록된 계좌명입니다.", "error", accountTypeInputRef);
                      return;
                    }
                    try {
                      await TransactionManager.addAccount({
                        financial_institution: accountForm.institution.trim(),
                        type: accountForm.type.trim(),
                        account_nm: combined
                      });
                      await refreshAccounts();
                      setFormData(prev => ({ ...prev, account: combined }));
                      setIsAccountModalOpen(false);
                      setAccountForm({ institution: '', type: '' });
                      showAlert("등록 완료", "계좌가 성공적으로 등록되었습니다.", "success");
                    } catch (error) {
                      console.error('계좌 등록 오류:', error);
                      showAlert("등록 오류", "계좌 등록 중 오류가 발생했습니다.", "error");
                    }
                  }}
                  className="flex-1 h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-md shadow-blue-500/25 cursor-pointer"
                >
                  등록
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Alert Modal (Custom UI replacement for browser alert) */}
      {mounted && alertMounted && createPortal(
        <div className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 ${alertClosing ? 'pointer-events-none' : ''}`}>
          <div
            className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm ${alertClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
            onClick={closeAlert}
          ></div>
          <div className={`relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center border border-slate-100 ${alertClosing ? 'animate-modal-out' : 'animate-slide-up'}`}>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${alertModal.type === 'success' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'
              }`}>
              {alertModal.type === 'success' ? <Check size={32} /> : <X size={32} />}
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">{alertModal.title}</h3>
            <div className="text-slate-500 mb-8 leading-relaxed whitespace-pre-line">
              {alertModal.message}
            </div>
            <button
              onClick={closeAlert}
              className={`w-full py-4 rounded-xl font-bold transition-all shadow-lg ${alertModal.type === 'success'
                ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-200'
                : 'bg-brand text-white hover:bg-brand-dark shadow-brand/20'
                }`}
            >
              확인
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {mounted && deleteMounted && createPortal(
        <div className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 ${deleteClosing ? 'pointer-events-none' : ''}`}>
          <div
            className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm ${deleteClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
            onClick={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
          ></div>
          <div className={`relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center border border-slate-100 ${deleteClosing ? 'animate-modal-out' : 'animate-slide-up'}`}>
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">정말 삭제하시겠습니까?</h3>
            <p className="text-slate-500 mb-8 leading-relaxed">이 작업은 취소할 수 없습니다.<br />거래 내역에서 영구적으로 삭제됩니다.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all border border-slate-200"
              >
                아니오
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-4 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 shadow-lg shadow-red-200 transition-all"
              >
                예
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Stock Delete Confirmation Modal */}
      {mounted && stockDeleteMounted && createPortal(
        <div className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 ${stockDeleteClosing ? 'pointer-events-none' : ''}`}>
          <div
            className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm ${stockDeleteClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
            onClick={() => setStockDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
          ></div>
          <div className={`relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center border border-slate-100 ${stockDeleteClosing ? 'animate-modal-out' : 'animate-slide-up'}`}>
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">종목을 삭제하시겠습니까?</h3>
            <p className="text-slate-500 mb-2 leading-relaxed">
              <span className="font-bold text-slate-700">&quot;{stockDeleteConfirm.name}&quot;</span> 종목이 삭제됩니다.
            </p>
            <p className="text-xs text-rose-400 mb-8 leading-relaxed">이 작업은 거래 내역에도 영향을 줄 수 있습니다.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setStockDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all border border-slate-200"
              >
                아니오
              </button>
              <button
                onClick={confirmStockDelete}
                className="flex-1 py-4 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 shadow-lg shadow-red-200 transition-all"
              >
                예
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Account Delete Confirmation Modal */}
      {mounted && accountDeleteMounted && createPortal(
        <div className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 ${accountDeleteClosing ? 'pointer-events-none' : ''}`}>
          <div
            className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm ${accountDeleteClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
            onClick={() => setAccountDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
          ></div>
          <div className={`relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center border border-slate-100 ${accountDeleteClosing ? 'animate-modal-out' : 'animate-slide-up'}`}>
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">계좌를 삭제하시겠습니까?</h3>
            <p className="text-slate-500 mb-2 leading-relaxed">
              <span className="font-bold text-slate-700">&quot;{accountDeleteConfirm.name}&quot;</span> 계좌가 삭제됩니다.
            </p>
            <p className="text-xs text-rose-400 mb-8 leading-relaxed">계좌의 모든 거래 내역에 영향을 줄 수 있습니다.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setAccountDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all border border-slate-200"
              >
                아니오
              </button>
              <button
                onClick={confirmAccountDelete}
                className="flex-1 py-4 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 shadow-lg shadow-red-200 transition-all"
              >
                예
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 조회 필터 모달 */}
      {/* Filter Modal (1안: 현대적 모던 바텀시트 / 배당금 상세 팝업과 동일한 효과 및 디자인) */}
      {mounted && isFilterMounted && createPortal(
        <div 
          className={`fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex flex-col justify-end md:justify-center md:items-center p-0 md:p-4 transition-opacity ${isFilterClosing ? 'animate-fade-out pointer-events-none' : 'animate-fade-in'}`}
          onClick={() => setIsFilterModalOpen(false)}
        >
          <div 
            className={`bg-white rounded-t-3xl md:rounded-3xl shadow-2xl border-t md:border border-slate-100 max-h-[85dvh] md:max-h-[85vh] flex flex-col w-full max-w-lg mx-auto overflow-hidden pointer-events-auto ${isFilterClosing ? 'animate-sheet-down md:animate-modal-out' : 'animate-sheet-up md:animate-page-slide'}`}
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* 모바일 상단 드래그 핸들 */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto my-3 shrink-0" />

            {/* Modal Header */}
            <div className="flex-shrink-0 flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Filter size={18} strokeWidth={2.5} />
                </div>
                <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">조회 조건 설정</h3>
              </div>
              <button 
                onClick={() => setIsFilterModalOpen(false)} 
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            <div ref={filterScrollRef} className="px-5 py-4 flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <div className="space-y-4">
                {/* 1. 조회 기간 선택 */}
                <div className="relative z-20">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-black text-slate-600 tracking-tight ml-0.5">조회 기간</label>
                    {tempFilters.dateFrom && tempFilters.dateTo && (
                      <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        {tempFilters.dateFrom} ~ {tempFilters.dateTo}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2.5 w-full">
                    {/* 상단: 퀵 기간 칩 버튼 (4개 균등 분할) */}
                    <div className="grid grid-cols-4 gap-2 w-full">
                      {[
                        { label: '1개월', months: 1 },
                        { label: '3개월', months: 3 },
                        { label: '6개월', months: 6 },
                        { label: '1년', months: 12 }
                      ].map((item) => {
                        const isSelected = selectedQuickPeriod === item.label;
                        return (
                          <button
                            key={item.label}
                            type="button"
                            data-quick-period="true"
                            onClick={() => {
                              const today = new Date();
                              const fromDate = new Date();
                              fromDate.setMonth(today.getMonth() - item.months);
                              setTempFilters(prev => ({
                                ...prev,
                                dateFrom: fromDate.toLocaleDateString('en-CA'),
                                dateTo: today.toLocaleDateString('en-CA')
                              }));
                              setSelectedQuickPeriod(item.label);
                            }}
                            className={`py-2.5 rounded-xl font-extrabold text-xs transition-all shadow-2xs cursor-pointer active:scale-95 text-center ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-sm border border-indigo-600'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-transparent font-bold'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* 하단: 날짜 선택 버튼 행 (1개월 버튼과 동일한 text-xs font-extrabold 사이즈, 터치 시 달력 오픈) */}
                    <div className="flex items-center gap-2 w-full">
                      {/* 시작일 버튼 */}
                      <div className="relative flex-1">
                        <button 
                          ref={filterDateFromRef}
                          type="button"
                          onClick={() => {
                            setIsFilterToCalendarOpen(false);
                            setIsFilterFromCalendarOpen(prev => !prev);
                          }}
                          className={`w-full px-3 py-2.5 rounded-xl border transition-all text-center text-xs font-extrabold h-11 flex items-center justify-center relative cursor-pointer shadow-2xs ${
                            isFilterFromCalendarOpen
                              ? 'border-blue-600 bg-white ring-2 ring-blue-100 text-blue-600'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-slate-700'
                          }`}
                        >
                          <span className="truncate pr-4">{tempFilters.dateFrom || '시작일'}</span>
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <Calendar size={16} />
                          </span>
                        </button>
                        {isFilterFromCalendarOpen && (
                          <div ref={filterFromCalendarRef} className="absolute left-0 top-full mt-1.5 z-[100] bg-white rounded-2xl shadow-2xl border border-slate-100 p-2.5 animate-slide-up w-[245px]" style={{ backgroundColor: '#ffffff' }}>
                            <CalendarUI 
                              initialYear={tempFilters.dateFrom && typeof tempFilters.dateFrom === 'string' && tempFilters.dateFrom.includes('-') ? parseInt(tempFilters.dateFrom.substring(0, 4)) : new Date().getFullYear()}
                              initialMonth={tempFilters.dateFrom && typeof tempFilters.dateFrom === 'string' && tempFilters.dateFrom.includes('-') ? parseInt(tempFilters.dateFrom.substring(5, 7)) : (new Date().getMonth() + 1)}
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

                      {/* 종료일 버튼 */}
                      <div className="relative flex-1">
                        <button 
                          ref={filterDateToRef}
                          type="button"
                          onClick={() => {
                            setIsFilterFromCalendarOpen(false);
                            setIsFilterToCalendarOpen(prev => !prev);
                          }}
                          className={`w-full px-3 py-2.5 rounded-xl border transition-all text-center text-xs font-extrabold h-11 flex items-center justify-center relative cursor-pointer shadow-2xs ${
                            isFilterToCalendarOpen
                              ? 'border-blue-600 bg-white ring-2 ring-blue-100 text-blue-600'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-slate-700'
                          }`}
                        >
                          <span className="truncate pr-4">{tempFilters.dateTo || '종료일'}</span>
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <Calendar size={16} />
                          </span>
                        </button>
                        {isFilterToCalendarOpen && (
                          <div ref={filterToCalendarRef} className="absolute right-0 top-full mt-1.5 z-[100] bg-white rounded-2xl shadow-2xl border border-slate-100 p-2.5 animate-slide-up w-[245px]" style={{ backgroundColor: '#ffffff' }}>
                            <CalendarUI 
                              initialYear={tempFilters.dateTo && typeof tempFilters.dateTo === 'string' && tempFilters.dateTo.includes('-') ? parseInt(tempFilters.dateTo.substring(0, 4)) : new Date().getFullYear()}
                              initialMonth={tempFilters.dateTo && typeof tempFilters.dateTo === 'string' && tempFilters.dateTo.includes('-') ? parseInt(tempFilters.dateTo.substring(5, 7)) : (new Date().getMonth() + 1)}
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

                {/* 2. 거래 구분 선택 (독립 한 줄 세그먼트 알약 버튼 - 등록 버튼 색상 매칭) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5">거래 구분</label>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/70">
                    {[
                      { val: '전체', label: '전체' },
                      { val: 'KRW', label: 'KRW (국내)', dot: 'text-blue-500' },
                      { val: 'USD', label: 'USD (해외)', dot: 'text-amber-500' }
                    ].map(opt => {
                      const isActive = tempFilters.type === opt.val;
                      return (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setTempFilters(prev => ({ ...prev, type: opt.val }))}
                          className={`py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] ${
                            isActive
                              ? 'bg-indigo-600 text-white shadow-xs font-black'
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

                {/* 3. 종목 검색 (한 줄에 다 차게 w-full, 퀵 칩 제외) */}
                <div className="space-y-1.5 relative" ref={filterStockDropdownRef}>
                  <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5">종목 검색</label>
                  <div className="relative w-full">
                    {tempFilters.security_id ? (
                      <div className="w-full px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/60 font-bold text-slate-800 h-12 flex items-center justify-between shadow-xs">
                        <div 
                          onClick={() => {
                            const nameToEdit = tempFilters.stockName.split('(')[0];
                            setTempFilters(prev => ({ ...prev, security_id: '', stockName: nameToEdit }));
                            setTimeout(() => {
                              const input = filterStockDropdownRef.current?.querySelector('input');
                              if (input) {
                                input.focus();
                                input.select();
                              }
                            }, 50);
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
                        <input 
                          type="text" 
                          placeholder="종목명 입력 (엔터로 검색)"
                          value={tempFilters.stockName || ''}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setTempFilters(prev => ({ ...prev, stockName: val, security_id: '', stockCode: '' }));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              if (!isFilterStockDropdownOpen) {
                                handleStockSearch(tempFilters.stockName);
                              } else {
                                setFocusedStockIndex(prev => Math.min(prev + 1, stockSearchResults.length - 1));
                              }
                            } else if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              if (!isFilterStockDropdownOpen) {
                                handleStockSearch(tempFilters.stockName);
                              } else {
                                setFocusedStockIndex(prev => Math.max(prev - 1, 0));
                              }
                            } else if (e.key === 'Enter') {
                              e.preventDefault();
                              if (e.nativeEvent?.isComposing) return;
                              handleFilterStockEnter(tempFilters.stockName);
                            } else if (e.key === 'Tab') {
                              if (isFilterStockDropdownOpen) {
                                setIsFilterStockDropdownOpen(false);
                              }
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
                    
                    {isFilterModalOpen && isFilterStockDropdownOpen && stockSearchResults.length > 0 && (
                      <div className="absolute bottom-full left-0 right-0 z-[100] w-full mb-1.5">
                        <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden animate-slide-up flex flex-col pointer-events-auto">
                          <div 
                            ref={filterStockListRef}
                            className="overflow-y-auto overflow-x-hidden py-1 block max-h-[220px]"
                          >
                            {[...stockSearchResults].reverse().map((stock, i) => {
                              const originalIndex = stockSearchResults.length - 1 - i;
                              return (
                                <button
                                  key={stock.security_id || originalIndex}
                                  type="button"
                                  onClick={() => {
                                    setTempFilters(prev => ({ 
                                      ...prev, 
                                      stockName: `${stock.name}(${stock.code})`,
                                      stockCode: stock.code,
                                      security_id: stock.security_id 
                                    }));
                                    setIsFilterStockDropdownOpen(false);
                                    if (typeof document !== 'undefined') {
                                      document.activeElement?.blur();
                                    }
                                  }}
                                  onMouseEnter={() => setFocusedStockIndex(originalIndex)}
                                  className={`w-full min-h-[48px] h-[48px] flex-shrink-0 px-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors pointer-events-auto cursor-pointer ${
                                    originalIndex === focusedStockIndex ? 'bg-indigo-50/70 text-indigo-700' : ''
                                  }`}
                                >
                                  <div className="flex flex-col">
                                    <span className={`text-[13px] font-bold leading-tight ${originalIndex === focusedStockIndex ? 'text-indigo-700' : 'text-slate-700'}`}>
                                      {stock.name}
                                      <span className={`text-[12px] font-medium ml-1.5 ${originalIndex === focusedStockIndex ? 'text-indigo-600 opacity-60' : 'text-slate-400'}`}>
                                        ({stock.code})
                                      </span>
                                    </span>
                                  </div>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-lg ${originalIndex === focusedStockIndex ? 'bg-indigo-100 text-indigo-700 font-bold' : 'bg-slate-50 text-slate-400'}`}>
                                    {stock.currency || 'KRW'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* 4. 하단 액션 버튼 바 (모바일 하단 항상 고정 노출) */}
            <div className="flex-shrink-0 p-4 bg-white border-t border-slate-100 flex items-center z-30 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
              <button
                type="button"
                onClick={() => {
                  setActiveFilters({ ...tempFilters });
                  setIsFilterModalOpen(false);
                  setCurrentPage(1);
                  showAlert("필터 적용", "설정한 필터가 적용되었습니다.", "success");
                }}
                className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-black text-sm flex items-center justify-center gap-1 shadow-md shadow-amber-200/50 active:scale-95 transition-all cursor-pointer"
              >
                <span>적용하기</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

// Simple Calendar Component
function CalendarUI({ initialYear, initialMonth, onSelect }) {
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
    <div className="select-none text-xs">
      <div className="flex justify-between items-center mb-2 px-1">
        <span className="font-extrabold text-slate-800 text-xs tracking-tight">{currentYear}년 {currentMonth + 1}월</span>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => changeYear(-1)} className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" title="1년 전">
            <ChevronsLeft size={13} />
          </button>
          <button type="button" onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" title="1개월 전">
            <ChevronLeft size={13} />
          </button>
          <button type="button" onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" title="1개월 후">
            <ChevronRight size={13} />
          </button>
          <button type="button" onClick={() => changeYear(1)} className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" title="1년 후">
            <ChevronsRight size={13} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, idx) => (
          <span key={d} className={`text-[10px] font-bold ${idx === 0 ? 'text-rose-400' : idx === 6 ? 'text-blue-400' : 'text-slate-400'}`}>
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d, i) => (
          <button
            key={i}
            type="button"
            onClick={() => d.current && onSelect(currentYear, currentMonth + 1, d.day)}
            className={`h-7 w-7 mx-auto rounded-lg text-xs font-bold transition-all flex items-center justify-center ${d.current
              ? 'text-slate-700 hover:bg-blue-600 hover:text-white cursor-pointer active:scale-95'
              : 'text-slate-200 pointer-events-none text-[11px]'
              } ${d.current && d.day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear()
                ? 'bg-blue-50 text-blue-600 font-black'
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
