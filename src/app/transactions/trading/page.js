"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Edit2, Trash2, Filter, RotateCcw, X, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check, ArrowLeftRight, Plus, Search, ChevronDown, PlusCircle, Wallet, ArrowUpDown, CheckCircle2, TrendingUp, Scale, Award } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAssets } from "@/contexts/AssetContext";
import { TransactionManager, TRANSACTION_TYPES, TRADE_TYPES } from "@/lib/transactionManager";
import { GUEST_DOMESTIC_TRANSACTIONS, GUEST_OVERSEAS_TRANSACTIONS } from "@/lib/guestMockData";
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
  { value: "amount_desc", label: "거래금액 높은순" },
  { value: "amount_asc", label: "거래금액 낮은순" },
  { value: "price_desc", label: "단가 높은순" },
  { value: "price_asc", label: "단가 낮은순" },
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
function AnimatedTradeCounter({
  value,
  isForeign = false,
  showSign = false,
  duration = 800,
  isRate = false,
  decimals = 0
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);
  const prevIsForeignRef = useRef(isForeign);
  const hasAnimatedInitialRef = useRef(false);

  useEffect(() => {
    const endVal = Number(value) || 0;
    const shouldStartFromZero = !hasAnimatedInitialRef.current || prevIsForeignRef.current !== isForeign;
    const startVal = shouldStartFromZero
      ? 0
      : (Number(prevValueRef.current) || 0);

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

// ── 최근 매수일/최근 매도일 날짜 롤링 효과 (YYYY.MM.DD) ──
function AnimatedDateText({ dateStr, duration = 800 }) {
  const [displayDate, setDisplayDate] = useState(dateStr || '-');
  const prevDateRef = useRef(dateStr);

  useEffect(() => {
    if (!dateStr || dateStr === '-') {
      setDisplayDate('-');
      prevDateRef.current = '-';
      return;
    }

    const parts = String(dateStr).split('.');
    if (parts.length !== 3) {
      setDisplayDate(dateStr);
      prevDateRef.current = dateStr;
      return;
    }

    const year = parts[0];
    const targetMonth = Number(parts[1]) || 1;
    const targetDay = Number(parts[2]) || 1;

    let startMonth = 1;
    let startDay = 1;
    if (prevDateRef.current && prevDateRef.current.includes('.')) {
      const prevParts = prevDateRef.current.split('.');
      if (prevParts.length === 3) {
        startMonth = Number(prevParts[1]) || 1;
        startDay = Number(prevParts[2]) || 1;
      }
    }

    let startTime = null;
    let animationFrame;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4);

      const curMonth = Math.round(startMonth + (targetMonth - startMonth) * ease);
      const curDay = Math.round(startDay + (targetDay - startDay) * ease);

      setDisplayDate(
        `${year}.${String(curMonth).padStart(2, '0')}.${String(curDay).padStart(2, '0')}`
      );

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      } else {
        setDisplayDate(dateStr);
        prevDateRef.current = dateStr;
      }
    };

    animationFrame = requestAnimationFrame(step);
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [dateStr, duration]);

  return <>{displayDate}</>;
}

// 상단 카드 서브텍스트용 원화/외화 간결 포맷터
const formatSubKRW = (num) => {
  const val = Number(num) || 0;
  const abs = Math.abs(val);
  if (abs >= 100000000) {
    const eok = Math.floor(abs / 100000000);
    const man = Math.round((abs % 100000000) / 10000);
    return `${val < 0 ? '-' : ''}${eok}억${man > 0 ? ` ${man.toLocaleString('ko-KR')}만` : ''}원`;
  }
  if (abs >= 10000) {
    const man = Math.round(abs / 10000);
    return `${val < 0 ? '-' : ''}${man.toLocaleString('ko-KR')}만원`;
  }
  return `${val.toLocaleString('ko-KR')}원`;
};

const formatSubUSD = (num) => {
  const val = Number(num) || 0;
  const sign = val < 0 ? '-' : '';
  return `${sign}$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}`;
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
  const { refreshAssets, domesticTransactions, overseasTransactions, isTransactionsLoading, refreshTransactions, accounts, accountNameById, isAccountsLoading, refreshAccounts } = useAssets();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const modalFormRef = useMobileKeyboardModal(isModalOpen);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null });
  const [stockDeleteConfirm, setStockDeleteConfirm] = useState({ isOpen: false, id: null, name: '' });
  const [accountDeleteConfirm, setAccountDeleteConfirm] = useState({ isOpen: false, name: '' });
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', type: 'error', focusRef: null });
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 9;
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isFilterFromCalendarOpen, setIsFilterFromCalendarOpen] = useState(false);
  const [isFilterToCalendarOpen, setIsFilterToCalendarOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isAccountTypeDropdownOpen, setIsAccountTypeDropdownOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockMarketType, setStockMarketType] = useState('DOMESTIC'); // 'DOMESTIC' | 'OVERSEAS'
  const [isSectorDropdownOpen, setIsSectorDropdownOpen] = useState(false);
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({ institution: '', type: '일반' });
  const [stockForm, setStockForm] = useState({ name: '', code: '', sector: '', currency: 'KRW', exchange_code: '' });
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  // ── 상단 툴바 및 필터 상태 ──
  const [currencyFilter, setCurrencyFilter] = useState("ALL"); // ALL, KRW, OVERSEAS
  const [tradeTypeFilter, setTradeTypeFilter] = useState("ALL"); // ALL, BUY, SELL
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(true); // 최초 로딩 시 열린 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isToolbarFromCalendarOpen, setIsToolbarFromCalendarOpen] = useState(false);
  const [isToolbarToCalendarOpen, setIsToolbarToCalendarOpen] = useState(false);
  const [exchangeRates, setExchangeRates] = useState({ KRW: 1, USD: 1350 });

  const toolbarDateFromRef = useRef(null);
  const toolbarDateFromBtnRef = useRef(null);
  const toolbarDateToRef = useRef(null);
  const toolbarDateToBtnRef = useRef(null);
  const toolbarDateToInputRef = useRef(null);
  const sortDropdownRef = useRef(null);
  
  // 필터 관련 상태 추가 (확정된 필터 / 임시 필터 분리)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const filterScrollRef = useMobileKeyboardModal(isFilterModalOpen);

  const { mounted: isModalMounted, isClosing: isModalClosing } = useAnimatedModal(isModalOpen);
  const { mounted: isFilterMounted, isClosing: isFilterClosing } = useAnimatedModal(isFilterModalOpen);
  const { mounted: isStockMounted, isClosing: isStockClosing } = useAnimatedModal(isStockModalOpen);
  const { mounted: isAccountMounted, isClosing: isAccountClosing } = useAnimatedModal(isAccountModalOpen);
  const { mounted: alertMounted, isClosing: alertClosing } = useAnimatedModal(alertModal.isOpen);
  const { mounted: deleteMounted, isClosing: deleteClosing } = useAnimatedModal(deleteConfirm.isOpen);
  const { mounted: stockDeleteMounted, isClosing: stockDeleteClosing } = useAnimatedModal(stockDeleteConfirm.isOpen);
  const { mounted: accountDeleteMounted, isClosing: accountDeleteClosing } = useAnimatedModal(accountDeleteConfirm.isOpen);
  const { mounted: isFilterPanelMounted, isClosing: isFilterPanelClosing } = useAnimatedModal(isFilterPanelOpen, 220);

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
  const [isFilterTypeDropdownOpen, setIsFilterTypeDropdownOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    dateFrom: '',
    dateTo: '',
    type: '전체',
    stockName: ''
  });
  const [inputDateFrom, setInputDateFrom] = useState('');
  const [inputDateTo, setInputDateTo] = useState('');
  const [dateFromError, setDateFromError] = useState('');
  const [dateToError, setDateToError] = useState('');

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

  // 포커스 시: 기존 날짜가 있으면 하이픈 제거 후 숫자만 표시하여 편리하게 수정
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

  // 커밋 (블러, 엔터, 탭): 8자리 포맷팅 및 조회, 8자리가 아니면 숫자 유지 및 X로 닫을 수 있는 확인 창 표시
  const handleDateInputCommit = (type) => {
    setIsToolbarFromCalendarOpen(false);
    setIsToolbarToCalendarOpen(false);
    const rawVal = (type === 'from' ? inputDateFrom : inputDateTo) || '';
    const clean = rawVal.replace(/[^0-9]/g, '');

    // 1. 빈 값인 경우 -> 필터 해제
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

    // 2. 정확히 8자리인 경우 -> YYYY-MM-DD 포맷 및 조회 적용 (화면에는 YYYY - MM - DD)
    if (clean.length === 8) {
      const y = parseInt(clean.substring(0, 4), 10);
      const m = parseInt(clean.substring(4, 6), 10);
      const d = parseInt(clean.substring(6, 8), 10);

      // 날짜 유효성 검증
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
        // 8자리지만 유효하지 않은 날짜인 경우
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

    // 3. 8자리가 안 되는 경우 (1~7자리) -> - 없이 숫자 그대로 유지, 확인 창 표시
    if (type === 'from') {
      setInputDateFrom(clean);
      setDateFromError('8자리 숫자로 입력해주세요 (예: 20261112)');
    } else {
      setInputDateTo(clean);
      setDateToError('8자리 숫자로 입력해주세요 (예: 20261112)');
    }
  };

  // 엔터 및 탭 키 처리 (시작일에서 탭/엔터 시 종료일 입력창으로 이동)
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

  // 툴바 날짜 및 종목명 검색어 초기화 (회오리 버튼)
  const handleClearDateAndSearch = () => {
    setInputDateFrom('');
    setInputDateTo('');
    setDateFromError('');
    setDateToError('');
    setSearchQuery('');
    setTradeTypeFilter('ALL');
    setIsToolbarFromCalendarOpen(false);
    setIsToolbarToCalendarOpen(false);
    setIsSortDropdownOpen(false);
    setActiveFilters(prev => ({
      ...prev,
      dateFrom: '',
      dateTo: ''
    }));
    setCurrentPage(1);
  };
  const [isFilterStockDropdownOpen, setIsFilterStockDropdownOpen] = useState(false);
  const [tempFilters, setTempFilters] = useState({ ...activeFilters });
  const accountTypeRef = useRef(null);
  const accountDropdownRef = useRef(null);
  const calendarRef = useRef(null);
  const calendarButtonRef = useRef(null);
  const filterFromCalendarRef = useRef(null);
  const filterToCalendarRef = useRef(null);
  const institutionRef = useRef(null);
  const accountTypeInputRef = useRef(null);
  const sectorRef = useRef(null);
  const currencyRef = useRef(null);
  const stockModalNameRef = useRef(null);
  const stockModalCodeRef = useRef(null);
  const stockRef = useRef(null);
  const stockCodeRef = useRef(null);
  const quantityRef = useRef(null);
  const priceRef = useRef(null);
  const accountListRef = useRef(null);
  const stockListRef = useRef(null);
  const accountRef = useRef(null);
   const filterDateFromRef = useRef(null);
  const filterDateToRef = useRef(null);
  const typeDropdownRef = useRef(null);
  const filterStockDropdownRef = useRef(null);
  const filterStockListRef = useRef(null);

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
    exchangeRate: '',
    totalKRW: '',
    exchange_code: ''
  });

  const [focusedAccountIndex, setFocusedAccountIndex] = useState(-1);
  const [focusedStockIndex, setFocusedStockIndex] = useState(-1);
  const [selectedQuickPeriod, setSelectedQuickPeriod] = useState('1개월');

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
        const upperQuery = query.toUpperCase();
        const exactMatch = results.find(
          s => s.name?.toUpperCase() === upperQuery || s.code?.toUpperCase() === upperQuery
        );
        const target = exactMatch || (results.length === 1 ? results[0] : null);

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
          setStockSearchResults(results);
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

  // ── 종목 추가 모달: 국내/해외 마켓 전환 ──
  const handleStockMarketTypeChange = (type) => {
    if (type === stockMarketType) return;
    setStockMarketType(type);
    setStockSearchResults([]);
    setIsSearchDropdownOpen(false);
    setIsSectorDropdownOpen(false);
    setIsCurrencyDropdownOpen(false);
    setStockForm(prev => ({
      ...prev,
      name: '',
      code: '',
      exchange_code: '',
      currency: type === 'DOMESTIC' ? 'KRW' : (prev.currency === 'KRW' ? 'USD' : prev.currency || 'USD')
    }));
  };

  // ── 종목 추가 모달: 코드/티커 자동 조회 ──
  const searchStockByCode = async (codeToSearch = stockForm.code) => {
    const trimmedCode = (codeToSearch || '').trim();
    if (!trimmedCode) {
      showAlert("입력 안내", stockMarketType === 'DOMESTIC' ? "종목코드를 입력해 주세요." : "티커(종목코드)를 입력해 주세요.", "warning", stockModalCodeRef);
      return;
    }
    
    try {
      setIsSearchDropdownOpen(false);
      setStockForm(prev => ({ ...prev, name: '검색 중...' }));
      
      const isOverseas = stockMarketType === 'OVERSEAS';
      const apiUrl = isOverseas
        ? `/api/stock-info?code=${encodeURIComponent(trimmedCode)}&overseasOnly=true&domesticOnly=false`
        : `/api/stock-info?code=${encodeURIComponent(trimmedCode)}&overseasOnly=false&domesticOnly=true`;

      const res = await fetch(apiUrl);
      const data = await res.json();
      
      if (res.ok && data.results && data.results.length > 0) {
        // 엄격한 국내 / 해외 마켓 필터링 (혼입 방지)
        const filteredResults = data.results.filter(item => {
          const upperMarket = (item.market || '').toUpperCase();
          const upperSymbol = (item.symbol || '').toUpperCase();
          const isKorean = ['KOSPI', 'KOSDAQ', 'KONEX', 'KSC', 'KOE', 'KS', 'KQ'].includes(upperMarket) ||
                           upperSymbol.endsWith('.KS') || upperSymbol.endsWith('.KQ') ||
                           /^\d{6}$/.test(item.code);
          return isOverseas ? !isKorean : isKorean;
        });

        // 중복 종목코드 제거
        const uniqueResults = filteredResults.reduce((acc, current) => {
          const exists = acc.find(item => item.code === current.code);
          if (!exists) {
            acc.push(current);
          }
          return acc;
        }, []);

        if (uniqueResults.length === 1) {
          const item = uniqueResults[0];
          setStockForm(prev => ({
            ...prev,
            name: item.name.replace(/\s*[㈜|주식|코스닥|코스피]\s*$/g, ''),
            code: item.code,
            exchange_code: item.exchange_code || ''
          }));
        } else if (uniqueResults.length > 1) {
          setStockSearchResults(uniqueResults);
          setIsSearchDropdownOpen(true);
          setStockForm(prev => ({ ...prev, name: '' }));
        } else {
          setStockForm(prev => ({ ...prev, name: '' }));
          showAlert("조회불가", <span>{stockMarketType === 'DOMESTIC' ? '국내 종목' : '해외 종목'}에서 <strong className="font-bold text-slate-800">&quot;{trimmedCode}&quot;</strong>을(를) 찾을 수 없습니다.</span>, "error", stockModalCodeRef);
        }
      } else {
        setStockForm(prev => ({ ...prev, name: '' }));
        showAlert("조회불가", <span>{stockMarketType === 'DOMESTIC' ? '국내 종목' : '해외 종목'}에서 <strong className="font-bold text-slate-800">&quot;{trimmedCode}&quot;</strong>을(를) 찾을 수 없습니다.</span>, "error", stockModalCodeRef);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setStockForm(prev => ({ ...prev, name: '' }));
      showAlert("검색 오류", "정보를 가져오는 중 일시적인 오류가 발생했습니다.", "error", stockModalCodeRef);
    }
  };

  // ── 종목 추가 모달: 최종 등록 ──
  const handleAddStockSubmit = async () => {
    if (!stockForm.name.trim()) {
      showAlert("입력 오류", "종목명을 입력해 주세요.", "error", stockModalNameRef);
      return;
    }
    if (!stockForm.code.trim()) {
      showAlert("입력 오류", stockMarketType === 'DOMESTIC' ? "종목코드를 입력해 주세요." : "티커를 입력해 주세요.", "error", stockModalCodeRef);
      return;
    }
    if (!stockForm.sector.trim()) {
      showAlert("입력 오류", "섹터를 선택해 주세요.", "error");
      return;
    }
    if (stockMarketType === 'DOMESTIC' && stockForm.currency.trim() !== 'KRW') {
      showAlert("입력 오류", "국내 종목은 KRW 통화만 등록 가능합니다.", "error");
      return;
    }
    if (stockMarketType === 'OVERSEAS' && !stockForm.currency.trim()) {
      showAlert("입력 오류", "통화를 선택해 주세요.", "error");
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
        currency: stockForm.currency.trim(),
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

      setStockForm({ 
        name: '', 
        code: '', 
        sector: '', 
        currency: stockMarketType === 'DOMESTIC' ? 'KRW' : 'USD', 
        exchange_code: '' 
      });
      setIsStockModalOpen(false);
      showAlert("등록 완료", "종목이 성공적으로 등록되었습니다.", "success");
    } catch (error) {
      console.error('종목 등록 오류:', error);
      showAlert("등록 오류", "종목 등록 중 오류가 발생했습니다.", "error");
    }
  };

  const [isStockDropdownOpen, setIsStockDropdownOpen] = useState(false);
  const [searchedStocks, setSearchedStocks] = useState([]);
  const [isSearchingStock, setIsSearchingStock] = useState(false);
  const stockDropdownRef = useRef(null);
  const [stockSearchResults, setStockSearchResults] = useState([]);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const searchDropdownRef = useRef(null);
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

  const handleStockSearch = async (val) => {
    const searchTerm = val ? val.trim() : '';
    // 빈 칸이어도 전체 조회를 위해 검색 허용 (등록 팝업과 동일)
    
    setIsSearchingStock(true);
    setIsFilterStockDropdownOpen(true);
    try {
      const results = await TransactionManager.searchStocksByName(searchTerm, null);
      setStockSearchResults(results);
      if (results.length > 0) setFocusedStockIndex(0);
      else setFocusedStockIndex(-1);
    } catch (err) {
      console.error('종목 검색 오류:', err);
      setStockSearchResults([]);
    } finally {
      setIsSearchingStock(false);
    }
  };

  // 국내/해외 거래내역 통합 (게스트 모드 포함)
  const allTransactions = useMemo(() => {
    if (!user) return [];
    const dt = domesticTransactions || [];
    const ot = overseasTransactions || [];
    return [...dt, ...ot];
  }, [user, domesticTransactions, overseasTransactions]);

  // 전역 상태가 변경되면 로컬 필터링용 데이터 업데이트
  useEffect(() => {
    setTransactions(allTransactions);
    setLoading(isTransactionsLoading);
  }, [allTransactions, isTransactionsLoading]);

  // 사용자 데이터 로드
  useEffect(() => {
    if (user) {
      if (domesticTransactions.length === 0 && overseasTransactions.length === 0) {
        refreshTransactions();
      }
    }
  }, [user, domesticTransactions.length, overseasTransactions.length]);

  // 환율 조회
  useEffect(() => {
    TransactionManager.getLatestExchangeRates()
      .then(rates => {
        if (rates) setExchangeRates(prev => ({ ...prev, ...rates }));
      })
      .catch(err => console.error("환율 로드 오류:", err));
  }, []);

  // URL query param (?filter=OVERSEAS 등) 반영
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const filterParam = params.get('filter');
      if (filterParam === 'OVERSEAS' || filterParam === 'KRW' || filterParam === 'ALL') {
        setCurrencyFilter(filterParam);
      }
    }
  }, []);

  // 검색/필터 변경 시 페이지 1로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, currencyFilter, sortBy, activeFilters.dateFrom, activeFilters.dateTo, activeFilters.type, tradeTypeFilter]);

  // 외부 클릭 감지 로직 통합 관리 (모든 드롭다운 및 달력 팝오버)
  useEffect(() => {
    const handleClickOutsideAll = (event) => {
      // 0. 툴바 정렬 드롭다운
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setIsSortDropdownOpen(false);
      }
      // 0-1. 툴바 시작일 달력
      if (toolbarDateFromRef.current && !toolbarDateFromRef.current.contains(event.target) && (!toolbarDateFromBtnRef.current || !toolbarDateFromBtnRef.current.contains(event.target))) {
        setIsToolbarFromCalendarOpen(false);
      }
      // 0-2. 툴바 종료일 달력
      if (toolbarDateToRef.current && !toolbarDateToRef.current.contains(event.target) && (!toolbarDateToBtnRef.current || !toolbarDateToBtnRef.current.contains(event.target))) {
        setIsToolbarToCalendarOpen(false);
      }
      // 1. 계좌 선택 드롭다운
      if (isAccountDropdownOpen && accountDropdownRef.current && !accountDropdownRef.current.contains(event.target)) {
        setIsAccountDropdownOpen(false);
      }
      // 2. 계좌 유형 드롭다운
      if (isAccountTypeDropdownOpen && accountTypeRef.current && !accountTypeRef.current.contains(event.target)) {
        setIsAccountTypeDropdownOpen(false);
      }
      // 3. 섹터 드롭다운
      if (isSectorDropdownOpen && sectorRef.current && !sectorRef.current.contains(event.target)) {
        setIsSectorDropdownOpen(false);
      }
      // 4. 통화 드롭다운
      if (isCurrencyDropdownOpen && currencyRef.current && !currencyRef.current.contains(event.target)) {
        setIsCurrencyDropdownOpen(false);
      }
      // 5. 종목 검색 드롭다운
      if (isStockDropdownOpen && stockDropdownRef.current && !stockDropdownRef.current.contains(event.target)) {
        setIsStockDropdownOpen(false);
      }
      // 6. 상단 검색창 드롭다운
      if (isSearchDropdownOpen && searchDropdownRef.current && !searchDropdownRef.current.contains(event.target)) {
        setIsSearchDropdownOpen(false);
      }
      // 7. 등록 모달 달력
      if (isCalendarOpen && calendarRef.current && !calendarRef.current.contains(event.target) && (!calendarButtonRef.current || !calendarButtonRef.current.contains(event.target))) {
        setIsCalendarOpen(false);
      }
      // 8. 필터 모달 시작 달력
      if (isFilterFromCalendarOpen && filterFromCalendarRef.current && !filterFromCalendarRef.current.contains(event.target) && (!filterDateFromRef.current || !filterDateFromRef.current.contains(event.target))) {
        setIsFilterFromCalendarOpen(false);
      }
      // 9. 필터 모달 종료 달력
      if (isFilterToCalendarOpen && filterToCalendarRef.current && !filterToCalendarRef.current.contains(event.target) && (!filterDateToRef.current || !filterDateToRef.current.contains(event.target))) {
        setIsFilterToCalendarOpen(false);
      }
      // 10. 필터 모달 구분 드롭다운
      if (isFilterTypeDropdownOpen && typeDropdownRef.current && !typeDropdownRef.current.contains(event.target)) {
        setIsFilterTypeDropdownOpen(false);
      }
      // 11. 필터 모달 종목 드롭다운
      if (isFilterStockDropdownOpen && filterStockDropdownRef.current && !filterStockDropdownRef.current.contains(event.target)) {
        setIsFilterStockDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutsideAll);
    const handleKeyDownGlobal = (event) => {
      if (event.key === 'Escape') {
        setIsToolbarFromCalendarOpen(false);
        setIsToolbarToCalendarOpen(false);
        setIsSortDropdownOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDownGlobal);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideAll);
      document.removeEventListener('keydown', handleKeyDownGlobal);
    };
  }, [
    isSortDropdownOpen, isToolbarFromCalendarOpen, isToolbarToCalendarOpen,
    isAccountDropdownOpen, isAccountTypeDropdownOpen, isSectorDropdownOpen, 
    isCurrencyDropdownOpen, isStockDropdownOpen, isSearchDropdownOpen, 
    isCalendarOpen, isFilterFromCalendarOpen, isFilterToCalendarOpen, isFilterTypeDropdownOpen, isFilterStockDropdownOpen
  ]);

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

  // 드롭다운 스크롤 자동 이동 (종목)
  useEffect(() => {
    if (isStockDropdownOpen && focusedStockIndex >= 0 && stockListRef.current) {
      const container = stockListRef.current;
      const focusedItem = container.children[focusedStockIndex];
      if (focusedItem) {
        focusedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedStockIndex, isStockDropdownOpen]);

  // 드롭다운 스크롤 자동 이동 (필터 모달 종목)
  useEffect(() => {
    if (isFilterStockDropdownOpen && focusedStockIndex >= 0 && filterStockListRef.current) {
      const container = filterStockListRef.current;
      // 역순 렌더링이므로 자식 인덱스를 계산해서 접근
      // index 0 -> 최하단 자식 (container.children.length - 1)
      // index N -> 최상단 자식 (0)
      const visualIndex = stockSearchResults.length - 1 - focusedStockIndex;
      const focusedItem = container.children[visualIndex];
      if (focusedItem) {
        focusedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedStockIndex, isFilterStockDropdownOpen, stockSearchResults.length]);

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
  }, [alertModal.isOpen, deleteConfirm.isOpen, stockDeleteConfirm.isOpen, accountDeleteConfirm.isOpen, isModalOpen, isAccountModalOpen, isStockModalOpen]);

  const showAlert = (title, message, type = 'error', focusRef = null) => {
    setAlertModal({ isOpen: true, title, message, type, focusRef });
  };

  const closeAlert = () => {
    const { focusRef } = alertModal;
    setAlertModal(prev => ({ ...prev, isOpen: false }));
    if (focusRef && focusRef.current) {
      setTimeout(() => {
        focusRef.current.focus();
        if (typeof focusRef.current.select === 'function') {
          focusRef.current.select();
        }
      }, 100);
    }
  };

  // Input Refs for Validation


  const sectorOptions = [
    '에너지',
    '부동산',
    '소재',
    '산업재',
    '운송물류',
    '경기소비재',
    '필수소비재',
    '헬스케어',
    '금융',
    'IT',
    '첨단기술',
    '통신',
    '유틸리티',
    '기타',
    '리츠',
    '채권',
    'ETF'
  ];

  const formatCurrency = (value, currency = 'USD') => {
    if (value === null || value === undefined) return '-';
    const symbolMap = { 'KRW': '₩', 'USD': '$', 'EUR': '€', 'JPY': '¥', 'CNY': '¥', 'GBP': '£', 'HKD': 'HK$' };
    const symbol = symbolMap[currency] || currency;
    
    // 해외 거래의 경우 소수점 2자리 항상 표시 (원화 제외)
    if (currency !== 'KRW') {
      return `${symbol} ${value.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${symbol} ${value.toLocaleString()}`;
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
      setSelectedAccountId(null);
      const initialCurrency = currencyFilter === 'OVERSEAS' ? 'USD' : 'KRW';
      setFormData({
        year: now.getFullYear().toString(),
        month: (now.getMonth() + 1).toString().padStart(2, '0'),
        day: now.getDate().toString().padStart(2, '0'),
        account: '', stock: '', stockCode: '', security_id: '',
        type: '매수', quantity: '', price: '', amount: '', currency: initialCurrency,
        exchangeRate: '', totalKRW: '', exchange_code: ''
      });
    }
    setIsModalOpen(!isModalOpen);
    setIsCalendarOpen(false);
    setFocusedAccountIndex(-1);
    setFocusedStockIndex(-1);
  };

  const handleDateSelect = (y, m, d) => {
    setFormData(prev => ({
      ...prev,
      year: y.toString(),
      month: m.toString().padStart(2, '0'),
      day: d.toString().padStart(2, '0')
    }));
    setIsCalendarOpen(false);
  };

  const handleNumberInput = (e, field) => {
    let rawValue = e.target.value.replace(/,/g, '');

    if (rawValue === '') {
      setFormData(prev => ({ ...prev, [field]: '' }));
      return;
    }

    const isOverseas = formData.currency && formData.currency !== 'KRW';

    if (field === 'price' && isOverseas) {
      // 숫자와 마침표만 허용
      if (/[^0-9.]/.test(rawValue)) return;

      // 마침표 중복 체크
      const parts = rawValue.split('.');
      if (parts.length > 2) return;

      // 소수점 2자리 제한
      if (parts[1] && parts[1].length > 2) return;

      // 자릿수 제한 (정수부)
      if (parts[0].length > 12) return;

      // 포맷팅 처리 (단가: 소수점 2자리 유지)
      let formatted = "";
      if (parts[0] !== "") {
        formatted = Number(parts[0]).toLocaleString('ko-KR');
      }
      if (rawValue.includes('.') || (parts[1] !== undefined)) {
        formatted += "." + (parts[1] || "");
      }

      setFormData(prev => ({ ...prev, [field]: formatted }));
    } else {
      // 국내 단가 및 수량 등 일반 숫자 (정수만)
      const digitsOnly = rawValue.replace(/[^\d]/g, '');
      const maxLength = field === 'price' ? 12 : 6;
      if (digitsOnly.length > maxLength) return;
      const formatted = digitsOnly === '' ? '' : Number(digitsOnly).toLocaleString('ko-KR');
      setFormData(prev => ({ ...prev, [field]: formatted }));
    }
  };

  useEffect(() => {
    const qty = parseFloat(formData.quantity.replace(/,/g, '')) || 0;
    const price = parseFloat(formData.price.replace(/,/g, '')) || 0;
    const isOverseas = formData.currency && formData.currency !== 'KRW';

    if (qty > 0 && price > 0) {
      const total = qty * price;
      if (isOverseas) {
        // 해외 거래의 경우 소수점 2자리 포맷팅
        const fixedTotal = total.toFixed(2);
        const [intPart, decPart] = fixedTotal.split('.');
        const formatted = Number(intPart).toLocaleString('ko-KR') + "." + decPart;
        setFormData(prev => ({ ...prev, amount: formatted }));
      } else {
        // 국내 거래(KRW)이므로 소수점 없이 반올림 처리
        const formatted = Math.round(total).toLocaleString('ko-KR');
        setFormData(prev => ({ ...prev, amount: formatted }));
      }
    } else {
      setFormData(prev => ({ ...prev, amount: '' }));
    }
  }, [formData.quantity, formData.price, formData.currency]);

  // 환율 자동 조회
  const fetchRate = async (specificDate = null) => {
    if (!isModalOpen) return;
    
    // 월/일이 한 자리인 경우 padStart 처리한 임시 객체 사용 (상태 업데이트 전 즉시 반영 위함)
    const monthStr = specificDate?.month || formData.month;
    const dayStr = specificDate?.day || formData.day;
    const yearStr = specificDate?.year || formData.year;
    
    if (formData.currency === 'KRW') {
      setFormData(prev => ({ ...prev, exchangeRate: '1' }));
      return;
    }

    if (yearStr && yearStr.length === 4 && monthStr && dayStr && formData.currency) {
      const today = new Date();
      const inputDate = new Date(`${yearStr}-${monthStr.toString().padStart(2, '0')}-${dayStr.toString().padStart(2, '0')}`);
      
      if (inputDate > today) {
        console.warn('fetchRate blocked: future date');
        return;
      }

      console.log('fetchRate triggered:', { date: `${yearStr}-${monthStr}-${dayStr}`, currency: formData.currency });
      try {
        const paddedMonth = monthStr.toString().padStart(2, '0');
        const paddedDay = dayStr.toString().padStart(2, '0');
        const dateStr = `${yearStr}-${paddedMonth}-${paddedDay}`;
        const rate = await TransactionManager.getExchangeRate(dateStr, formData.currency, 'KRW');
        if (rate) {
          setFormData(prev => ({ ...prev, exchangeRate: rate.toString() }));
        }
      } catch (error) {
        console.error('환율 조회 실패:', error);
      }
    }
  };

  useEffect(() => {
    fetchRate();
  }, [isModalOpen, formData.currency, formData.year, formData.month, formData.day]);

  // 원화 환산 금액 계산
  useEffect(() => {
    const amountVal = parseFloat(formData.amount.replace(/,/g, '')) || 0;
    const rateVal = parseFloat((formData.exchangeRate || '0').replace(/,/g, '')) || 0;

    if (amountVal > 0) {
      const krw = amountVal * rateVal;
      // 원 단위 반올림 (10원 단위로 처리)
      const rounded = Math.round(krw / 10) * 10;
      setFormData(prev => ({ ...prev, totalKRW: rounded.toLocaleString('ko-KR') }));
    } else {
      setFormData(prev => ({ ...prev, totalKRW: '' }));
    }
  }, [formData.amount, formData.exchangeRate]);

  // Handle clicking outside of calendar 상단 통합으로 인한 중복 제거

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.year || !formData.month || !formData.day) {
      showAlert("입력 오류", "거래일자를 선택해주세요.", 'error', calendarButtonRef);
      return;
    }
    const inputDate = new Date(`${formData.year}-${formData.month.toString().padStart(2, '0')}-${formData.day.toString().padStart(2, '0')}`);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (inputDate > today) {
      showAlert("입력 오류", "미래 일자는 입력할 수 없습니다.", 'error', calendarButtonRef);
      return;
    }
    if (!formData.stock.trim()) {
      showAlert("입력 오류", "종목명을 입력해주세요.", 'error', stockRef);
      return;
    }
    if (!formData.stockCode.trim()) {
      showAlert("입력 오류", "종목코드를 입력해주세요.", 'error', stockCodeRef);
      return;
    }
    if (!selectedAccountId) {
      showAlert("입력 오류", "계좌를 선택해 주세요.", "error");
      return;
    }
    if (!formData.quantity || formData.quantity === '0') {
      showAlert("입력 오류", "수량을 입력해주세요.", 'error', quantityRef);
      return;
    }
    if (!formData.price || formData.price === '0') {
      showAlert("입력 오류", "단가를 입력해주세요.", 'error', priceRef);
      return;
    }

    try {
      setLoading(true);
      const dateStr = `${formData.year}-${formData.month}-${formData.day}`;

      const isKRWCurrency = (formData.currency || 'KRW') === 'KRW';
      const qty = parseFloat(formData.quantity.replace(/,/g, ''));
      const price = isKRWCurrency ? Math.round(parseFloat(formData.price.replace(/,/g, ''))) : parseFloat(formData.price.replace(/,/g, ''));
      const amount = isKRWCurrency ? Math.round(parseFloat(formData.amount.replace(/,/g, ''))) : parseFloat(formData.amount.replace(/,/g, ''));

      let exchangeRate = 1;
      let exchangeTotalRate = amount;
      if (!isKRWCurrency) {
        exchangeRate = parseFloat((formData.exchangeRate || '1').replace(/,/g, '')) || 1;
        exchangeTotalRate = Math.round((amount * exchangeRate) / 10) * 10;
      }

      const transactionData = {
        transaction_type: isKRWCurrency ? TRANSACTION_TYPES.DOMESTIC : TRANSACTION_TYPES.OVERSEAS,
        date: dateStr,
        currency: formData.currency || 'KRW',
        trade_type: formData.type === '매수' ? TRADE_TYPES.BUY : TRADE_TYPES.SELL,
        quantity: qty,
        price: price,
        amount: amount,
        exchange_rate: exchangeRate,
        exchange_total_rate: exchangeTotalRate,
        account_id: selectedAccountId,
        security_id: formData.security_id || null
      };


      if (editingId) {
        // Update existing transaction with alt_sync flag
        await TransactionManager.updateTransaction(editingId, { 
          ...transactionData,
          alt_sync: true 
        });
        await refreshTransactions();
        await refreshAssets();
        setIsModalOpen(false);
        setEditingId(null);
        showAlert("수정 완료", "변경 내용이 반영되었습니다.", "success");
      } else {
        // Add new transaction
        await TransactionManager.addTransaction(transactionData);
        await refreshTransactions(); // 전역 거래 데이터 갱신
        await refreshAssets();      // 자산 요약 및 트렌드 갱신
        setIsModalOpen(false);
        setEditingId(null);
        showAlert("등록 완료", "거래가 성공적으로 등록되었습니다.", "success");
      }
    } catch (error) {
      console.error('거래 저장 오류:', error);
      const errMsg = error?.message || '';
      const errDetails = error?.details || '';
      const errCode = error?.code || '';
      const fullMsg = `저장 오류: ${errMsg} ${errDetails ? '(' + errDetails + ')' : ''} [코드: ${errCode || '알수없음'}]`;
      showAlert("오류", fullMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tx) => {
    const [year, month, day] = tx.date.includes('-') ? tx.date.split('-') : ['20' + tx.date.split('/')[0], tx.date.split('/')[1], tx.date.split('/')[2]];
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

    setEditingId(tx.id);
    setFormData({
      year: year,
      month: month,
      day: day,
      account: accountNameById[tx.account_id] || tx.account || '',
      stock: tx.security?.name || tx.stock_name || tx.stock || '',
      stockCode: tx.security?.code || tx.stock_code || tx.stockCode || '',
      security_id: tx.security_id || '',
      type: tx.trade_type === TRADE_TYPES.BUY || tx.trade_type === 'BUY' || tx.type === '매수' ? '매수' : '매도',
      quantity: typeof tx.quantity === 'number' ? tx.quantity.toLocaleString('ko-KR') : (tx.quantity?.toString() || ''),
      price: formattedPrice,
      amount: formattedAmount,
      currency: txCurrency,
      exchangeRate: tx.exchange_rate ? tx.exchange_rate.toString() : '',
      totalKRW: tx.exchange_total_rate ? tx.exchange_total_rate.toLocaleString('ko-KR') : '',
      exchange_code: tx.security?.exchange_code || ''
    });
    setSelectedAccountId(tx.account_id || null);
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
      showAlert("삭제 완료", "거래가 성공적으로 삭제되었습니다.", "success");
    } catch (error) {
      console.error('거래 삭제 오류:', error);
      showAlert("오류", error.message || "거래 삭제 중 문제가 발생했습니다.", "error");
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
    if (!accountDeleteConfirm.name || !accountDeleteConfirm.name.trim()) {
      setAccountDeleteConfirm({ isOpen: false, name: '' });
      return;
    }
    
    try {
      const list = await TransactionManager.getAccounts();
      if (!list || list.length <= 1) {
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
      setFormData(prev => ({ ...prev, account: '' }));
      setSelectedAccountId(null);
      if (isAccountDropdownOpen) {
        await refreshAccounts();
      }
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

  // 필터링 및 정렬된 거래 내역
  const filteredTransactions = useMemo(() => {
    let list = (transactions || []).filter(tx => {
      // 1. 거래구분 필터 (툴바 매수/매도 & 모달 필터)
      const isBuy = tx.trade_type === TRADE_TYPES.BUY || tx.trade_type === 'BUY' || tx.type === '매수';
      if (tradeTypeFilter === 'BUY' && !isBuy) return false;
      if (tradeTypeFilter === 'SELL' && isBuy) return false;
      if (activeFilters.type && activeFilters.type !== '전체') {
        const typeStr = isBuy ? '매수' : '매도';
        if (typeStr !== activeFilters.type) return false;
      }

      // 2. 통화 필터 (currencyFilter: ALL, KRW, OVERSEAS)
      const isKRW = (tx.currency || 'KRW') === 'KRW';
      if (currencyFilter === 'KRW' && !isKRW) return false;
      if (currencyFilter === 'OVERSEAS' && isKRW) return false;

      // 3. 종목 검색어 필터 (상단 검색창 searchQuery)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toUpperCase();
        const sName = (tx.security?.name || tx.stock_name || tx.stock || '').toUpperCase();
        const sCode = (tx.security?.code || tx.stock_code || tx.stockCode || '').toUpperCase();
        const krName = (STOCK_KR_NAMES[sCode] || '').toUpperCase();
        if (!sName.includes(q) && !sCode.includes(q) && !krName.includes(q)) return false;
      }

      // 4. 종목명 필터 (필터 모달)
      if (activeFilters.security_id) {
        if (tx.security_id !== activeFilters.security_id) return false;
      } else if (activeFilters.stockName) {
        const sName = (tx.security?.name || tx.stock_name || tx.stock || '').toUpperCase();
        const sCode = (tx.security?.code || tx.stock_code || tx.stockCode || '').toUpperCase();
        const search = activeFilters.stockName.toUpperCase();
        if (!sName.includes(search) && !sCode.includes(search)) return false;
      }
      
      // 5. 기간 필터 (시작일자 포함 이후 전체 자료 & 종료일자 포함 이전 전체 자료)
      const txDay = (tx.date || '').substring(0, 10);
      if (activeFilters.dateFrom && (!txDay || txDay < activeFilters.dateFrom)) return false;
      if (activeFilters.dateTo && (!txDay || txDay > activeFilters.dateTo)) return false;
      
      return true;
    });

    // 정렬
    list.sort((a, b) => {
      if (sortBy === 'latest') return (b.date || '').localeCompare(a.date || '') || (b.id || 0) - (a.id || 0);
      if (sortBy === 'oldest') return (a.date || '').localeCompare(b.date || '') || (a.id || 0) - (b.id || 0);

      const getAmountKRW = (tx) => {
        const isK = (tx.currency || 'KRW') === 'KRW';
        if (isK) return Number(tx.amount) || 0;
        return Number(tx.exchange_total_rate) || Math.round((Number(tx.amount) || 0) * (Number(tx.exchange_rate) || 1350));
      };
      const getPriceKRW = (tx) => {
        const isK = (tx.currency || 'KRW') === 'KRW';
        if (isK) return Number(tx.price) || 0;
        return Math.round((Number(tx.price) || 0) * (Number(tx.exchange_rate) || 1350));
      };

      if (sortBy === 'amount_desc') return getAmountKRW(b) - getAmountKRW(a);
      if (sortBy === 'amount_asc') return getAmountKRW(a) - getAmountKRW(b);
      if (sortBy === 'price_desc') return getPriceKRW(b) - getPriceKRW(a);
      if (sortBy === 'price_asc') return getPriceKRW(a) - getPriceKRW(b);
      if (sortBy === 'name_asc') {
        const nameA = a.security?.name || a.stock_name || a.stock || '';
        const nameB = b.security?.name || b.stock_name || b.stock || '';
        return nameA.localeCompare(nameB, 'ko');
      }
      return 0;
    });

    return list;
  }, [transactions, activeFilters, currencyFilter, searchQuery, sortBy, tradeTypeFilter]);

  // 상단 4대 카드용 요약 계산 (추천 A안: 자금 흐름 & 포지션 중심)
  const summary = useMemo(() => {
    let targetTxs = filteredTransactions;

    let buyAmountKRW = 0;
    let sellAmountKRW = 0;
    let buyCountKRW = 0;
    let sellCountKRW = 0;
    let buyQtyKRW = 0;
    let sellQtyKRW = 0;

    let buyAmountForeign = 0;
    let sellAmountForeign = 0;
    let buyCountForeign = 0;
    let sellCountForeign = 0;
    let buyQtyForeign = 0;
    let sellQtyForeign = 0;
    let buyAmountForeignKRW = 0;
    let sellAmountForeignKRW = 0;

    const stockMap = {};
    let latestTx = null;

    targetTxs.forEach(tx => {
      const isKRW = (tx.currency || 'KRW') === 'KRW';
      const isBuy = tx.trade_type === TRADE_TYPES.BUY || tx.trade_type === 'BUY' || tx.type === '매수';
      const qty = Number(tx.quantity) || 0;
      const rate = Number(tx.exchange_rate || tx.exchangeRate || (exchangeRates && exchangeRates[tx.currency]) || 1350);
      const amt = Number(tx.amount) || ((Number(tx.price) || 0) * qty);
      const amtKRW = isKRW ? amt : (Number(tx.exchange_total_rate) || Math.round(amt * rate));

      if (isKRW) {
        if (isBuy) {
          buyAmountKRW += amt;
          buyCountKRW += 1;
          buyQtyKRW += qty;
        } else {
          sellAmountKRW += amt;
          sellCountKRW += 1;
          sellQtyKRW += qty;
        }
      } else {
        if (isBuy) {
          buyAmountForeign += amt;
          buyAmountForeignKRW += amtKRW;
          buyCountForeign += 1;
          buyQtyForeign += qty;
        } else {
          sellAmountForeign += amt;
          sellAmountForeignKRW += amtKRW;
          sellCountForeign += 1;
          sellQtyForeign += qty;
        }
      }

      // 종목별 누적 집계
      const code = tx.stock_code || tx.security?.code || tx.stockCode || '';
      const rawName = tx.stock_name || tx.security?.name || tx.stock || '';
      const name = STOCK_KR_NAMES[code] || rawName || code;
      const stockKey = code || name;

      if (stockKey) {
        if (!stockMap[stockKey]) {
          stockMap[stockKey] = {
            key: stockKey,
            code,
            name,
            amountKRW: 0,
            amountForeign: 0,
            qty: 0,
            count: 0,
            isKRW,
            currency: tx.currency || 'KRW'
          };
        }
        stockMap[stockKey].amountKRW += amtKRW;
        if (!isKRW) {
          stockMap[stockKey].amountForeign += amt;
        }
        stockMap[stockKey].qty += qty;
        stockMap[stockKey].count += 1;
      }

      // 최신 거래일 및 거래 종목 찾기
      if (tx.date) {
        const txDateStr = String(tx.date).substring(0, 10);
        if (!latestTx || txDateStr.localeCompare(latestTx.dateStr) > 0 || (txDateStr === latestTx.dateStr && (tx.id || 0) > (latestTx.id || 0))) {
          latestTx = {
            dateStr: txDateStr,
            name,
            qty,
            id: tx.id || 0
          };
        }
      }
    });

    // 전체(ALL) 통합 지표
    const totalBuyKRW = buyAmountKRW + buyAmountForeignKRW;
    const totalSellKRW = sellAmountKRW + sellAmountForeignKRW;
    const totalNetBuyKRW = totalBuyKRW - totalSellKRW;
    const totalTurnoverKRW = totalBuyKRW + totalSellKRW;
    const totalBuyCount = buyCountKRW + buyCountForeign;
    const totalSellCount = sellCountKRW + sellCountForeign;
    const totalTxCount = targetTxs.length;

    // 국내(KRW) 지표
    const krwNetBuy = buyAmountKRW - sellAmountKRW;
    const krwTurnover = buyAmountKRW + sellAmountKRW;

    // 해외(OVERSEAS) 지표
    const foreignNetBuy = buyAmountForeign - sellAmountForeign;
    const foreignTotalAmt = buyAmountForeign + sellAmountForeign;
    const foreignTotalKRW = buyAmountForeignKRW + sellAmountForeignKRW;
    const avgForeignRate = foreignTotalAmt > 0
      ? (foreignTotalKRW / foreignTotalAmt)
      : (Number(exchangeRates?.USD) || 1350);

    // 종목 수 & 1위 종목 추출
    const stockList = Object.values(stockMap);
    const distinctStocksCount = stockList.length;

    let topStock = null;
    if (stockList.length > 0) {
      stockList.sort((a, b) => {
        if (currencyFilter === 'OVERSEAS') {
          return b.amountForeign - a.amountForeign;
        }
        return b.amountKRW - a.amountKRW;
      });
      topStock = stockList[0];
    }

    let topStockShare = '0.0';
    let topStockSub = '-';
    if (topStock) {
      let baseAmount = 0;
      if (currencyFilter === 'OVERSEAS') {
        baseAmount = tradeTypeFilter === 'SELL' ? sellAmountForeign : (tradeTypeFilter === 'BUY' ? buyAmountForeign : foreignTotalAmt);
        if (baseAmount > 0) {
          topStockShare = ((topStock.amountForeign / baseAmount) * 100).toFixed(1);
        }
        topStockSub = `${formatForeignAmount(topStock.amountForeign, topStock.currency || 'USD')} · ${topStock.qty.toLocaleString('ko-KR')}주`;
      } else if (currencyFilter === 'KRW') {
        baseAmount = tradeTypeFilter === 'SELL' ? sellAmountKRW : (tradeTypeFilter === 'BUY' ? buyAmountKRW : krwTurnover);
        if (baseAmount > 0) {
          topStockShare = ((topStock.amountKRW / baseAmount) * 100).toFixed(1);
        }
        topStockSub = `${formatSubKRW(topStock.amountKRW)} · ${topStock.qty.toLocaleString('ko-KR')}주`;
      } else {
        baseAmount = tradeTypeFilter === 'SELL' ? totalSellKRW : (tradeTypeFilter === 'BUY' ? totalBuyKRW : totalTurnoverKRW);
        if (baseAmount > 0) {
          topStockShare = ((topStock.amountKRW / baseAmount) * 100).toFixed(1);
        }
        topStockSub = `${formatSubKRW(topStock.amountKRW)} · ${topStock.qty.toLocaleString('ko-KR')}주`;
      }
    }

    // 최신 거래일 포맷
    let latestTxDateFormatted = '-';
    let latestTxSub = '-';
    if (latestTx && latestTx.dateStr) {
      latestTxDateFormatted = latestTx.dateStr.replace(/-/g, '.');
      latestTxSub = `${latestTx.name} ${Number(latestTx.qty || 0).toLocaleString('ko-KR')}주`;
    }

    return {
      // 전체
      totalBuyKRW,
      totalSellKRW,
      totalNetBuyKRW,
      totalTurnoverKRW,
      totalBuyCount,
      totalSellCount,
      totalTxCount,

      // 국내
      buyAmountKRW,
      sellAmountKRW,
      krwNetBuy,
      krwTurnover,
      buyCountKRW,
      sellCountKRW,
      buyQtyKRW,
      sellQtyKRW,

      // 해외
      buyAmountForeign,
      sellAmountForeign,
      buyAmountForeignKRW,
      sellAmountForeignKRW,
      foreignNetBuy,
      foreignTotalAmt,
      foreignTotalKRW,
      avgForeignRate,
      buyCountForeign,
      sellCountForeign,
      buyQtyForeign,
      sellQtyForeign,

      // 종목 수 & 1위 종목 & 최신 거래일
      distinctStocksCount,
      topStockName: topStock ? topStock.name : '-',
      topStockShare,
      topStockSub,
      latestTxDate: latestTxDateFormatted,
      latestTxSub,
    };
  }, [filteredTransactions, exchangeRates, currencyFilter, tradeTypeFilter]);

  // Pagination Logic (필터링된 데이터를 기준으로 계산)
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE));
  const PAGES_PER_BLOCK = 10;
  const currentBlock = Math.floor((currentPage - 1) / PAGES_PER_BLOCK);
  const startPage = currentBlock * PAGES_PER_BLOCK + 1;
  const endPage = Math.min(startPage + PAGES_PER_BLOCK - 1, totalPages);

  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const isFilterActive = false; // 화면 조작(기간, 종목명, 통화 등) 시 필터 버튼 모양을 변경하지 않음
  const isToolbarFilterActive = Boolean(
    inputDateFrom ||
    inputDateTo ||
    activeFilters.dateFrom ||
    activeFilters.dateTo ||
    searchQuery.trim() ||
    tradeTypeFilter !== 'ALL'
  );

  return (
    <div className="animate-fade-in text-slate-900">
      {/* Mobile Transaction View */}
      <div className="mobile-only-block w-full">
        <MobileTransactionList
          type="trading"
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
            } else {
              setTempFilters({ ...activeFilters, dateTo: new Date().toLocaleDateString('en-CA') });
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
            setSearchQuery('');
            setCurrencyFilter('ALL');
            setSortBy('latest');
            setStockSearchResults([]);
            setIsFilterStockDropdownOpen(false);
            setCurrentPage(1);
            showAlert("필터초기화", "설정된 필터가 초기화 되었습니다.", "success");
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
            <div className="w-9 h-9 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100/50 shadow-sm">
              <ArrowLeftRight size={20} strokeWidth={2.5} />
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
              <p className="text-xs text-slate-400 font-medium mt-0.5">국내 · 해외 주식 매매 내역</p>
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
            <div className="w-9 h-9 border-3 border-brand border-t-transparent rounded-full animate-spin" />
            <span className="font-bold text-slate-700 text-base">거래 내역을 불러오는 중...</span>
            <span className="text-sm text-slate-400">잠시만 기다려주세요</span>
          </div>
        )}

        {/* 로그인 완료 및 로딩 완료 후 본문 표시 */}
        {user && !loading && (
          <>
        {/* 상단 4대 핵심 요약 카드 (Glass Card) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {tradeTypeFilter === "ALL" ? (
            <>
              {/* 1. 총 매수금액 */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-slate-500">총 매수금액</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                      매수 {currencyFilter === "ALL" ? summary.totalBuyCount : (currencyFilter === "OVERSEAS" ? summary.buyCountForeign : summary.buyCountKRW)}건
                    </span>
                    <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Wallet size={12} strokeWidth={2.5} />
                    </div>
                  </div>
                </div>
                <div className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none">
                  <span className="text-2xl font-black tabular-nums tracking-tight text-slate-800 cursor-default select-none">
                    <AnimatedTradeCounter
                      key={`buy-${currencyFilter}-${tradeTypeFilter}-${activeFilters.dateFrom || ''}-${activeFilters.dateTo || ''}`}
                      value={
                        currencyFilter === "ALL"
                          ? summary.totalBuyKRW
                          : (currencyFilter === "OVERSEAS" ? summary.buyAmountForeign : summary.buyAmountKRW)
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
                    key={`buy-sub-${currencyFilter}-${tradeTypeFilter}-${summary.buyAmountKRW}-${summary.buyAmountForeign}`}
                    className="animate-fade-in inline-block"
                  >
                    {currencyFilter === "ALL" && (
                      <>국내 {formatSubKRW(summary.buyAmountKRW)} · 해외 {formatSubUSD(summary.buyAmountForeign)}</>
                    )}
                    {currencyFilter === "KRW" && (
                      <>체결수량 {summary.buyQtyKRW.toLocaleString('ko-KR')}주</>
                    )}
                    {currencyFilter === "OVERSEAS" && (
                      <>약 {formatSubKRW(summary.buyAmountForeignKRW)}</>
                    )}
                  </span>
                  <span className="font-semibold text-slate-500">
                    매수 투자금액
                  </span>
                </div>
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
              </div>

              {/* 2. 총 매도금액 */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-slate-500">총 매도금액</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">
                      매도 {currencyFilter === "ALL" ? summary.totalSellCount : (currencyFilter === "OVERSEAS" ? summary.sellCountForeign : summary.sellCountKRW)}건
                    </span>
                    <div className="w-5 h-5 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                      <TrendingUp size={12} strokeWidth={2.5} />
                    </div>
                  </div>
                </div>
                <div className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none">
                  <span className="text-2xl font-black tabular-nums tracking-tight text-slate-800 cursor-default select-none">
                    <AnimatedTradeCounter
                      key={`sell-${currencyFilter}-${tradeTypeFilter}-${activeFilters.dateFrom || ''}-${activeFilters.dateTo || ''}`}
                      value={
                        currencyFilter === "ALL"
                          ? summary.totalSellKRW
                          : (currencyFilter === "OVERSEAS" ? summary.sellAmountForeign : summary.sellAmountKRW)
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
                    key={`sell-sub-${currencyFilter}-${tradeTypeFilter}-${summary.sellAmountKRW}-${summary.sellAmountForeign}`}
                    className="animate-fade-in inline-block"
                  >
                    {currencyFilter === "ALL" && (
                      <>국내 {formatSubKRW(summary.sellAmountKRW)} · 해외 {formatSubUSD(summary.sellAmountForeign)}</>
                    )}
                    {currencyFilter === "KRW" && (
                      <>체결수량 {summary.sellQtyKRW.toLocaleString('ko-KR')}주</>
                    )}
                    {currencyFilter === "OVERSEAS" && (
                      <>약 {formatSubKRW(summary.sellAmountForeignKRW)}</>
                    )}
                  </span>
                  <span className="font-semibold text-slate-500">
                    매도 투자금액
                  </span>
                </div>
                <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
              </div>

              {/* 3. 순 매수금액 */}
              {(() => {
                const currentNetBuy = currencyFilter === "ALL"
                  ? summary.totalNetBuyKRW
                  : (currencyFilter === "OVERSEAS" ? summary.foreignNetBuy : summary.krwNetBuy);
                const isPositive = currentNetBuy >= 0;
                return (
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-slate-500">순 매수금액</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                          {isPositive ? (currencyFilter === "OVERSEAS" ? "달러 투입" : "투입 자금") : (currencyFilter === "OVERSEAS" ? "달러 회수" : "현금 회수")}
                        </span>
                        <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <Scale size={12} strokeWidth={2.5} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none">
                      <span className="text-2xl font-black tabular-nums tracking-tight text-indigo-600 cursor-default select-none">
                        <AnimatedTradeCounter
                          key={`net-${currencyFilter}-${tradeTypeFilter}-${activeFilters.dateFrom || ''}-${activeFilters.dateTo || ''}`}
                          value={currentNetBuy}
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
                        key={`net-sub-${currencyFilter}-${tradeTypeFilter}-${summary.krwNetBuy}-${summary.foreignNetBuy}`}
                        className="animate-fade-in inline-block"
                      >
                        {currencyFilter === "ALL" && (
                          <>국내 {formatSubKRW(summary.krwNetBuy)} · 해외 {formatSubUSD(summary.foreignNetBuy)}</>
                        )}
                        {currencyFilter === "KRW" && (
                          <>매수금액 - 매도금액</>
                        )}
                        {currencyFilter === "OVERSEAS" && (
                          <>약 {formatSubKRW(summary.buyAmountForeignKRW - summary.sellAmountForeignKRW)}</>
                        )}
                      </span>
                      <span className="font-semibold text-indigo-600">
                        순 투자금액
                      </span>
                    </div>
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                  </div>
                );
              })()}

              {/* 4. 총 거래대금 (전체/국내) OR 매매 거래환율 (해외) */}
              {currencyFilter === "OVERSEAS" ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-slate-500">매매 거래환율</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                        USD / KRW
                      </span>
                    </div>
                  </div>
                  <div className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none">
                    <span className="text-2xl font-black tabular-nums tracking-tight text-emerald-600 cursor-default select-none">
                      <AnimatedTradeCounter
                        key={`foreign-rate-${currencyFilter}-${tradeTypeFilter}-${activeFilters.dateFrom || ''}-${activeFilters.dateTo || ''}`}
                        value={summary.avgForeignRate}
                        isForeign={false}
                        isRate={true}
                        showSign={false}
                        duration={800}
                      />
                    </span>
                    <span className="text-xs font-bold text-slate-400">원</span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-50 pt-2">
                    <span
                      key={`rate-sub-${currencyFilter}-${summary.buyCountForeign + summary.sellCountForeign}`}
                      className="animate-fade-in inline-block"
                    >
                      총 {summary.buyCountForeign + summary.sellCountForeign}건 기준
                    </span>
                    <span className="font-semibold text-emerald-600">매매 평균환율</span>
                  </div>
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                </div>
              ) : (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-slate-500">총 거래대금</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        총 {currencyFilter === "ALL" ? summary.totalTxCount : (summary.buyCountKRW + summary.sellCountKRW)}건
                      </span>
                      <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                        <ArrowUpDown size={12} strokeWidth={2.5} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none">
                    <span className="text-2xl font-black tabular-nums tracking-tight text-slate-800 cursor-default select-none">
                      <AnimatedTradeCounter
                        key={`turnover-${currencyFilter}-${tradeTypeFilter}-${activeFilters.dateFrom || ''}-${activeFilters.dateTo || ''}`}
                        value={currencyFilter === "ALL" ? summary.totalTurnoverKRW : summary.krwTurnover}
                        isForeign={false}
                        showSign={false}
                        duration={800}
                      />
                    </span>
                    <span className="text-xs font-bold text-slate-400">원</span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-50 pt-2">
                    <span
                      key={`turnover-sub-${currencyFilter}-${summary.totalTxCount}`}
                      className="animate-fade-in inline-block"
                    >
                      {currencyFilter === "ALL" ? (
                        <>국내 {summary.buyCountKRW + summary.sellCountKRW}건 · 해외 {summary.buyCountForeign + summary.sellCountForeign}건</>
                      ) : (
                        <>매수 {summary.buyCountKRW}건 · 매도 {summary.sellCountKRW}건</>
                      )}
                    </span>
                    <span className="font-semibold text-slate-500">회전 규모</span>
                  </div>
                  <div className="absolute top-0 left-0 w-1 h-full bg-slate-700"></div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* ── 매수(BUY) / 매도(SELL) 선택 시 전용 4대 카드 ── */}

              {/* 1. 총 매수금액 / 총 매도금액 */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-slate-500">
                    {tradeTypeFilter === 'BUY' ? '총 매수금액' : '총 매도금액'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                      tradeTypeFilter === 'BUY' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {tradeTypeFilter === 'BUY' ? '매수' : '매도'}{' '}
                      {currencyFilter === "ALL"
                        ? (tradeTypeFilter === 'BUY' ? summary.totalBuyCount : summary.totalSellCount)
                        : (currencyFilter === "OVERSEAS"
                            ? (tradeTypeFilter === 'BUY' ? summary.buyCountForeign : summary.sellCountForeign)
                            : (tradeTypeFilter === 'BUY' ? summary.buyCountKRW : summary.sellCountKRW))}건
                    </span>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      tradeTypeFilter === 'BUY' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {tradeTypeFilter === 'BUY' ? (
                        <Wallet size={12} strokeWidth={2.5} />
                      ) : (
                        <TrendingUp size={12} strokeWidth={2.5} />
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none">
                  <span className="text-2xl font-black tabular-nums tracking-tight text-slate-800 cursor-default select-none">
                    <AnimatedTradeCounter
                      key={`sub-amt-${currencyFilter}-${tradeTypeFilter}-${activeFilters.dateFrom || ''}-${activeFilters.dateTo || ''}`}
                      value={
                        tradeTypeFilter === 'BUY'
                          ? (currencyFilter === "ALL" ? summary.totalBuyKRW : (currencyFilter === "OVERSEAS" ? summary.buyAmountForeign : summary.buyAmountKRW))
                          : (currencyFilter === "ALL" ? summary.totalSellKRW : (currencyFilter === "OVERSEAS" ? summary.sellAmountForeign : summary.sellAmountKRW))
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
                    key={`sub-card1-${currencyFilter}-${tradeTypeFilter}`}
                    className="animate-fade-in inline-block"
                  >
                    {currencyFilter === "ALL" && (
                      tradeTypeFilter === 'BUY'
                        ? <>국내 {formatSubKRW(summary.buyAmountKRW)} · 해외 {formatSubUSD(summary.buyAmountForeign)}</>
                        : <>국내 {formatSubKRW(summary.sellAmountKRW)} · 해외 {formatSubUSD(summary.sellAmountForeign)}</>
                    )}
                    {currencyFilter === "KRW" && (
                      tradeTypeFilter === 'BUY'
                        ? <>체결수량 {summary.buyQtyKRW.toLocaleString('ko-KR')}주</>
                        : <>체결수량 {summary.sellQtyKRW.toLocaleString('ko-KR')}주</>
                    )}
                    {currencyFilter === "OVERSEAS" && (
                      tradeTypeFilter === 'BUY'
                        ? <>약 {formatSubKRW(summary.buyAmountForeignKRW)}</>
                        : <>약 {formatSubKRW(summary.sellAmountForeignKRW)}</>
                    )}
                  </span>
                  <span className="font-semibold text-slate-500">
                    {tradeTypeFilter === 'BUY' ? '매수 투자금액' : '매도 투자금액'}
                  </span>
                </div>
                <div className={`absolute top-0 left-0 w-1 h-full ${
                  tradeTypeFilter === 'BUY' ? 'bg-blue-500' : 'bg-rose-500'
                }`}></div>
              </div>

              {/* 2. 거래현황 */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-slate-500">거래현황</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                      총 {summary.distinctStocksCount} 종목
                    </span>
                    <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <CheckCircle2 size={12} strokeWidth={2.5} />
                    </div>
                  </div>
                </div>
                <div className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none">
                  <span className="text-2xl font-black tabular-nums tracking-tight text-slate-800 cursor-default select-none">
                    <AnimatedTradeCounter
                      key={`status-count-${currencyFilter}-${tradeTypeFilter}-${activeFilters.dateFrom || ''}-${activeFilters.dateTo || ''}`}
                      value={
                        currencyFilter === "ALL"
                          ? (tradeTypeFilter === 'BUY' ? summary.totalBuyCount : summary.totalSellCount)
                          : (currencyFilter === "OVERSEAS"
                              ? (tradeTypeFilter === 'BUY' ? summary.buyCountForeign : summary.sellCountForeign)
                              : (tradeTypeFilter === 'BUY' ? summary.buyCountKRW : summary.sellCountKRW))
                      }
                      isForeign={false}
                      showSign={false}
                      duration={800}
                    />
                  </span>
                  <span className="text-xs font-bold text-slate-400">건</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-50 pt-2">
                  <span
                    key={`sub-card2-${currencyFilter}-${tradeTypeFilter}`}
                    className="animate-fade-in inline-block"
                  >
                    {currencyFilter === "ALL" && (
                      tradeTypeFilter === 'BUY'
                        ? <>국내 {summary.buyCountKRW}건 · 해외 {summary.buyCountForeign}건</>
                        : <>국내 {summary.sellCountKRW}건 · 해외 {summary.sellCountForeign}건</>
                    )}
                    {currencyFilter === "KRW" && (
                      tradeTypeFilter === 'BUY'
                        ? <>국내 체결수량 {summary.buyQtyKRW.toLocaleString('ko-KR')}주</>
                        : <>국내 체결수량 {summary.sellQtyKRW.toLocaleString('ko-KR')}주</>
                    )}
                    {currencyFilter === "OVERSEAS" && (
                      tradeTypeFilter === 'BUY'
                        ? <>해외 체결수량 {summary.buyQtyForeign.toLocaleString('ko-KR')}주</>
                        : <>해외 체결수량 {summary.sellQtyForeign.toLocaleString('ko-KR')}주</>
                    )}
                  </span>
                  <span className="font-semibold text-slate-500">
                    조회기간 합계
                  </span>
                </div>
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
              </div>

              {/* 3. 누적 매수 1위 / 누적 매도 1위 */}
              <div
                key={`card3-stock-${tradeTypeFilter}-${currencyFilter}`}
                className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-slate-500">
                    {tradeTypeFilter === 'BUY' ? '누적 매수 1위' : '누적 매도 1위'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">
                      비중{' '}
                      <AnimatedTradeCounter
                        key={`top-share-${currencyFilter}-${tradeTypeFilter}-${summary.topStockShare}`}
                        value={summary.topStockShare}
                        decimals={1}
                        duration={800}
                      />%
                    </span>
                    <div className="w-5 h-5 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center">
                      <Award size={12} strokeWidth={2.5} />
                    </div>
                  </div>
                </div>
                <div
                  key={`top-stock-main-${currencyFilter}-${tradeTypeFilter}-${summary.topStockName}`}
                  className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none min-h-[32px] animate-summary-pop"
                >
                  <span className="text-2xl font-black text-slate-800 tracking-tight truncate max-w-[220px]" title={summary.topStockName}>
                    {summary.topStockName}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-50 pt-2">
                  <span
                    key={`top-sub-${currencyFilter}-${tradeTypeFilter}-${summary.topStockSub}`}
                    className="truncate max-w-[170px] animate-fade-in inline-block"
                    title={summary.topStockSub}
                  >
                    {summary.topStockSub}
                  </span>
                  <span className="font-semibold text-slate-500 shrink-0">
                    {tradeTypeFilter === 'BUY' ? '최대 투자' : '최대 매도'}
                  </span>
                </div>
                <div className="absolute top-0 left-0 w-1 h-full bg-violet-500"></div>
              </div>

              {/* 4. 최근 매수일 / 최근 매도일 */}
              <div
                key={`card4-latest-${tradeTypeFilter}-${currencyFilter}`}
                className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-slate-500">
                    {tradeTypeFilter === 'BUY' ? '최근 매수일' : '최근 매도일'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      최근 체결
                    </span>
                    <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                      <Calendar size={12} strokeWidth={2.5} />
                    </div>
                  </div>
                </div>
                <div
                  key={`latest-date-main-${currencyFilter}-${tradeTypeFilter}-${summary.latestTxDate}`}
                  className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none min-h-[32px] animate-summary-pop"
                >
                  <span className="text-2xl font-black tabular-nums tracking-tight text-slate-800 cursor-default select-none">
                    <AnimatedDateText dateStr={summary.latestTxDate} duration={800} />
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-50 pt-2">
                  <span
                    key={`latest-sub-${currencyFilter}-${tradeTypeFilter}-${summary.latestTxSub}`}
                    className="truncate max-w-[180px] animate-fade-in inline-block"
                    title={summary.latestTxSub}
                  >
                    {summary.latestTxSub}
                  </span>
                  <span className="font-semibold text-slate-500 shrink-0">
                    {tradeTypeFilter === 'BUY' ? '최종 매수' : '최종 매도'}
                  </span>
                </div>
                <div className="absolute top-0 left-0 w-1 h-full bg-slate-700"></div>
              </div>
            </>
          )}
        </div>

        {/* 컨트롤 툴바: 날짜 범위 / 검색창 / 통화 탭 / 정렬 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-3.5 mb-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 relative z-30">
          {/* 좌측 그룹: 필터 토글 버튼 + [날짜 범위 / 종목 검색 / 거래구분 / 초기화] */}
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            {/* 필터 패널 열기/닫기 토글 버튼 (날짜 좌측) */}
            <button
              type="button"
              onClick={() => setIsFilterPanelOpen(prev => !prev)}
              className={`h-9 w-9 flex items-center justify-center rounded-xl border transition-all cursor-pointer shrink-0 select-none relative ${
                isFilterPanelOpen
                  ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 shadow-xs ring-2 ring-indigo-200'
                  : isToolbarFilterActive
                    ? 'bg-indigo-500 border-indigo-500 text-white shadow-xs ring-2 ring-indigo-200'
                    : 'bg-indigo-50/90 border-indigo-200/90 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300 shadow-2xs'
              }`}
              title={isFilterPanelOpen ? "필터 접기" : "필터 열기"}
            >
              <ChevronLeft
                size={16}
                strokeWidth={2.5}
                className={`transition-transform duration-300 ${
                  isFilterPanelOpen ? 'text-white' : 'rotate-180 text-current'
                }`}
              />
              {isToolbarFilterActive && !isFilterPanelOpen && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white"></span>
              )}
            </button>

            {/* 접힘/펼침 상세 필터 영역 (나타날 때와 사라질 때 모두 부드러운 애니메이션 적용) */}
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

                  {/* 8자리 미만 등 유효성 확인 알림 (팝업 대신 X 닫기 버튼이 있는 확인 창) */}
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

                  {/* 8자리 미만 등 유효성 확인 알림 (팝업 대신 X 닫기 버튼이 있는 확인 창) */}
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

              {/* 매수 / 매도 선택 세그먼트 (전체 / 매수 / 매도) */}
              <div className="flex bg-slate-100 p-0.5 rounded-xl h-9 items-center shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setTradeTypeFilter("ALL");
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tradeTypeFilter === "ALL" ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  전체
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTradeTypeFilter("BUY");
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tradeTypeFilter === "BUY" ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-500 hover:text-rose-600'
                  }`}
                >
                  매수
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTradeTypeFilter("SELL");
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tradeTypeFilter === "SELL" ? 'bg-blue-500 text-white shadow-xs' : 'text-slate-500 hover:text-blue-600'
                  }`}
                >
                  매도
                </button>
              </div>

              {/* 날짜 & 종목명 입력 내용 클리어 버튼 (회오리 아이콘 RotateCcw) */}
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
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-500">거래일</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-500">구분</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-500">수량</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">단가&nbsp;&nbsp;&nbsp;</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">거래금액&nbsp;&nbsp;&nbsp;</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-500">계좌</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-500">옵션</th>
              </tr>
            </thead>
            <tbody key={`unified-tx-${currentPage}-${currencyFilter}-${tradeTypeFilter}-${sortBy}-${activeFilters.dateFrom || ''}-${activeFilters.dateTo || ''}`} className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-slate-200 border-t-brand rounded-full animate-spin"></div>
                      <span>거래내역을 불러오는 중...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <span>{user ? '등록된 거래내역이 없습니다.' : '로그인 후 거래내역을 확인할 수 있습니다.'}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx, i) => {
                  const isKRW = (tx.currency || 'KRW') === 'KRW';
                  const code = tx.stock_code || tx.security?.code || tx.stockCode || '';
                  const rawName = tx.stock_name || tx.security?.name || tx.stock || '';
                  const displayName = STOCK_KR_NAMES[code] || rawName;
                  const rate = Number(tx.exchange_rate || tx.exchangeRate || (exchangeRates && exchangeRates[tx.currency]) || 1350);
                  const unitPriceOriginal = Number(tx.price) || 0;
                  const unitPriceKRW = isKRW ? unitPriceOriginal : Math.round(unitPriceOriginal * rate);
                  const amountOriginal = Number(tx.amount) || (unitPriceOriginal * (Number(tx.quantity) || 0));
                  const amountKRW = isKRW ? amountOriginal : (Number(tx.exchange_total_rate) || Math.round(amountOriginal * rate));
                  const isBuy = tx.trade_type === TRADE_TYPES.BUY || tx.trade_type === 'BUY' || tx.type === '매수';

                  return (
                    <tr key={tx.id || `tx-${i}`} className={`h-[72px] hover:bg-slate-50/80 transition-colors group opacity-0 animate-row-fade stagger-${(i % 9) + 1}`}>
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

                      {/* 2. 거래일 (수량과 같은 폰트, 크기) */}
                      <td className="px-6 py-2 text-center text-sm font-bold text-slate-700 tabular-nums">
                        {formatDisplayDate(tx.date)}
                      </td>

                      {/* 3. 구분 */}
                      <td className="px-6 py-2 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          isBuy ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'
                        }`}>
                          {isBuy ? '매수' : '매도'}
                        </span>
                      </td>

                      {/* 4. 수량 */}
                      <td className="px-6 py-2 text-center text-sm font-bold text-slate-700 tabular-nums">
                        {Number(tx.quantity || 0).toLocaleString('ko-KR')}주
                      </td>

                      {/* 5. 단가 */}
                      <td className="px-6 py-2 text-right">
                        <div className="flex flex-col items-end justify-center">
                          {currencyFilter === "OVERSEAS" ? (
                            <span className="text-sm font-bold text-slate-900 tabular-nums">
                              {formatForeignAmount(unitPriceOriginal, tx.currency || 'USD')}
                            </span>
                          ) : isKRW ? (
                            <span className="text-sm font-bold text-slate-900 tabular-nums">
                              {unitPriceKRW.toLocaleString('ko-KR')}원
                            </span>
                          ) : (
                            <>
                              <span className="text-sm font-bold text-slate-900 tabular-nums">
                                {formatForeignAmount(unitPriceOriginal, tx.currency || 'USD')}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-400 tabular-nums mt-0.5">
                                {unitPriceKRW.toLocaleString('ko-KR')}원
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* 6. 거래금액 */}
                      <td className="px-6 py-2 text-right">
                        <div className="flex flex-col items-end justify-center">
                          {currencyFilter === "OVERSEAS" ? (
                            <span className="text-sm font-bold text-slate-900 tabular-nums">
                              {formatForeignAmount(amountOriginal, tx.currency || 'USD')}
                            </span>
                          ) : isKRW ? (
                            <span className="text-sm font-bold text-slate-900 tabular-nums">
                              {amountKRW.toLocaleString('ko-KR')}원
                            </span>
                          ) : (
                            <>
                              <span className="text-sm font-bold text-slate-900 tabular-nums">
                                {formatForeignAmount(amountOriginal, tx.currency || 'USD')}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-400 tabular-nums mt-0.5">
                                {amountKRW.toLocaleString('ko-KR')}원
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* 7. 계좌 */}
                      <td className="px-6 py-2 text-center text-sm font-medium text-slate-700">
                        {accountNameById[tx.account_id] || tx.account || ''}
                      </td>

                      {/* 8. 옵션 */}
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
                      <td colSpan="8" className="px-6 py-2"><div className="min-h-[52px]">&nbsp;</div></td>
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
              {/* 1. 거래일 & 구분 (2열 나란히 배치, 거래일 가운데 정렬) */}
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
                      {formData.year && formData.month && formData.day ? `${formData.year}-${formData.month.toString().padStart(2, '0')}-${formData.day.toString().padStart(2, '0')}` : '거래일 선택'}
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
                        setAccountForm({ institution: '', type: '일반' });
                        setIsAccountTypeDropdownOpen(false);
                        setIsAccountModalOpen(true);
                        setIsAccountDropdownOpen(false);
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
                        if (formData.account) {
                          setAccountDeleteConfirm({ isOpen: true, name: formData.account });
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
                <div className="flex items-center gap-2">
                  <div className="relative flex-1" ref={stockDropdownRef}>
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
                                setTimeout(() => quantityRef.current?.focus(), 50);
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
                                quantityRef.current?.focus();
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
                          className="w-full h-12 pl-4 pr-10 rounded-2xl border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-slate-800 text-xs bg-slate-50/70 focus:bg-white shadow-xs transition-all placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 flex items-center pr-3.5 cursor-pointer text-slate-400 hover:text-slate-600"
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
                                onClick={() => {
                                  const stockCur = stock.currency || (['KOSPI', 'KOSDAQ', 'KONEX', 'KRX'].includes(stock.market) || stock.exchange_code === 'KRX' ? 'KRW' : 'USD');
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    stock: `[${stock.code}] ${stock.name}`, 
                                    stockCode: stock.code, 
                                    security_id: stock.security_id, 
                                    currency: stockCur 
                                  }));
                                  setIsStockDropdownOpen(false);
                                  setTimeout(() => quantityRef.current?.focus(), 50);
                                }}
                              >
                                <span className={`font-semibold text-sm leading-tight break-words truncate mr-2 ${focusedStockIndex === index ? 'text-blue-600' : 'text-slate-700'}`}>
                                  {stock.name} <span className={`text-[13px] font-medium tracking-tight ${focusedStockIndex === index ? 'text-blue-400' : 'text-slate-400'}`}>({stock.code})</span>
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${
                                  (stock.currency === 'KRW' || stock.exchange_code === 'KRX')
                                    ? 'bg-blue-50 text-blue-600 border-blue-200' 
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {stock.currency === 'KRW' || stock.exchange_code === 'KRX' ? '국내' : '해외'}
                                </span>
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
                        setStockMarketType(initialMarket);
                        setStockForm({ 
                          name: '', 
                          code: '', 
                          sector: '', 
                          currency: initialMarket === 'DOMESTIC' ? 'KRW' : (formData.currency && formData.currency !== 'KRW' ? formData.currency : 'USD'),
                          exchange_code: '' 
                        });
                        setStockSearchResults([]);
                        setIsSearchDropdownOpen(false);
                        setIsSectorDropdownOpen(false);
                        setIsCurrencyDropdownOpen(false);
                        setIsStockModalOpen(true);
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
                        if (formData.security_id) {
                          setStockDeleteConfirm({ isOpen: true, id: formData.security_id, name: formData.stock.replace(`[${formData.stockCode}] `, '') });
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

              {/* 4. 수량 & 단가 (수량 크기 축소 col-span-2, 단가 크기 확대 col-span-3, 우측정렬, 폰트/색상 통일) */}
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">수량</label>
                  <input
                    ref={quantityRef}
                    type="text"
                    placeholder="0"
                    value={formData.quantity}
                    onChange={(e) => handleNumberInput(e, 'quantity')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        priceRef.current?.focus();
                        priceRef.current?.select();
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
                    className={`w-full h-12 px-4 rounded-2xl border border-slate-200 focus:outline-none focus:border-blue-500 text-right text-xs bg-slate-50/70 focus:bg-white shadow-xs transition-all placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs placeholder:text-right ${
                      !formData.quantity || formData.quantity === '0' ? 'text-slate-400 font-medium' : 'text-slate-800 font-bold'
                    }`}
                  />
                </div>

                <div className="col-span-3">
                  <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">단가</label>
                  <div className="flex items-center w-full h-12 px-4 rounded-2xl border border-slate-200 focus-within:border-blue-500 focus-within:bg-white transition-all bg-slate-50/70 gap-1.5 shadow-xs">
                    <input
                      ref={priceRef}
                      type="text"
                      placeholder="0"
                      value={formData.price}
                      onChange={(e) => handleNumberInput(e, 'price')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          priceRef.current?.blur();
                        }
                      }}
                      onBlur={(e) => {
                        if (formData.currency && formData.currency !== 'KRW') {
                          const val = e.target.value.replace(/,/g, '');
                          if (val && !isNaN(parseFloat(val))) {
                            const formatted = parseFloat(val).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            setFormData(prev => ({ ...prev, price: formatted }));
                          }
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

              {/* 5. 거래금액 (국내: 원 / 해외: 환율 및 통화 기호, 원화 환산) */}
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
        <div 
          className={`fixed inset-0 z-[9995] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 transition-opacity ${
            isStockClosing ? 'animate-fade-out pointer-events-none' : 'animate-fade-in'
          }`} 
          onClick={() => setIsStockModalOpen(false)}
        >
          <div 
            className={`relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-visible max-h-[90vh] flex flex-col pointer-events-auto ${
              isStockClosing ? 'animate-modal-out' : 'animate-page-slide'
            }`} 
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 flex-shrink-0 bg-white rounded-t-3xl">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                  stockMarketType === 'DOMESTIC' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  <PlusCircle size={18} strokeWidth={2.5} />
                </div>
                <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">종목 추가</h3>
              </div>
              <button 
                onClick={() => setIsStockModalOpen(false)} 
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-5 md:p-6 flex-1 overflow-visible space-y-4">
              {/* 1. 국내 / 해외 선택 세그먼트 버튼 (높이 및 바닥화면 테마 색상 적용) */}
              <div className="grid grid-cols-2 p-1.5 bg-slate-100/90 rounded-2xl gap-1.5">
                <button
                  type="button"
                  onClick={() => handleStockMarketTypeChange('DOMESTIC')}
                  className={`h-11 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    stockMarketType === 'DOMESTIC'
                      ? 'bg-blue-500 text-white shadow-xs'
                      : 'text-slate-500 hover:text-blue-600 font-bold'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${stockMarketType === 'DOMESTIC' ? 'bg-white' : 'bg-slate-300'}`} />
                  국내 종목
                </button>
                <button
                  type="button"
                  onClick={() => handleStockMarketTypeChange('OVERSEAS')}
                  className={`h-11 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    stockMarketType === 'OVERSEAS'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-500 hover:text-amber-600 font-bold'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${stockMarketType === 'OVERSEAS' ? 'bg-white' : 'bg-slate-300'}`} />
                  해외 종목
                </button>
              </div>

              {/* 2. 종목코드(티커) & 종목명 */}
              <div className="grid grid-cols-5 gap-3 items-end">
                {/* 종목코드 / 티커 */}
                <div className="col-span-2 relative">
                  <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">
                    {stockMarketType === 'DOMESTIC' ? '종목코드' : '티커(코드)'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={stockMarketType === 'DOMESTIC' ? '6자리' : '예: AAPL'}
                      value={stockForm.code}
                      onChange={(e) => {
                        const transliterated = transliterateKOtoEN(e.target.value).toUpperCase();
                        const maxLen = stockMarketType === 'DOMESTIC' ? 6 : 10;
                        if (transliterated.length <= maxLen) {
                          setStockForm(prev => ({ ...prev, code: transliterated }));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && stockForm.code) {
                          e.preventDefault();
                          searchStockByCode(stockForm.code);
                        }
                      }}
                      ref={stockModalCodeRef}
                      className={`w-full h-12 pl-3 pr-8 rounded-2xl border border-slate-200 focus:outline-none font-bold text-xs text-slate-800 text-center bg-white shadow-xs transition-all placeholder:text-center placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs uppercase ${
                        stockMarketType === 'DOMESTIC' ? 'focus:border-blue-500' : 'focus:border-amber-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => searchStockByCode(stockForm.code)}
                      className={`absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors cursor-pointer ${
                        stockMarketType === 'DOMESTIC' ? 'hover:text-blue-600' : 'hover:text-amber-600'
                      }`}
                      title="종목 조회"
                    >
                      <Search size={14} />
                    </button>
                  </div>
                </div>

                {/* 종목명 */}
                <div className="col-span-3 relative" ref={searchDropdownRef}>
                  <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">종목명</label>
                  <input
                    type="text"
                    placeholder={stockForm.name ? '' : (stockMarketType === 'DOMESTIC' ? '좌측 코드 입력 후 조회' : '좌측 티커 입력 후 조회')}
                    value={stockForm.name}
                    readOnly={stockForm.name === '검색 중...'}
                    onChange={(e) => setStockForm(prev => ({ ...prev, name: e.target.value }))}
                    onFocus={() => setIsNameFocused(true)}
                    onBlur={() => setIsNameFocused(false)}
                    ref={stockModalNameRef}
                    className={`w-full h-12 px-3.5 rounded-2xl border focus:outline-none transition-all font-bold text-xs text-center box-border shadow-xs placeholder:text-center placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs ${
                      stockForm.name === '검색 중...' 
                        ? 'bg-slate-100/70 border-slate-200 text-slate-400 cursor-not-allowed' 
                        : `bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 focus:bg-white ${
                            stockMarketType === 'DOMESTIC' 
                              ? 'focus:border-blue-500 focus:ring-2 focus:ring-blue-100' 
                              : 'focus:border-amber-500 focus:ring-2 focus:ring-amber-100'
                          } ${isNameFocused ? 'cursor-text' : 'cursor-pointer'}`
                    }`}
                  />
                  {/* 검색 결과 다중 건 드롭다운 (정렬 드롭다운 스타일 적용) */}
                  {isSearchDropdownOpen && stockSearchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/70 z-[60] p-1.5 max-h-[160px] overflow-y-auto animate-fade-in">
                      <div className="space-y-0.5">
                        {stockSearchResults.map((res, i) => (
                          <button
                            key={`${res.code}-${i}`}
                            type="button"
                            className="w-full px-2.5 py-2 text-xs rounded-xl hover:bg-slate-100/70 text-left transition-all flex justify-between items-center group cursor-pointer tracking-tight"
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
                            <span className={`font-semibold text-slate-700 text-xs tracking-tight truncate mr-2 ${
                              stockMarketType === 'DOMESTIC' ? 'group-hover:text-blue-600' : 'group-hover:text-amber-600'
                            }`}>{res.name}</span>
                            <span className="text-[11px] font-semibold text-slate-400 shrink-0 tracking-tight">[{res.code}]{['KOSPI', 'KOSDAQ', 'KONEX'].includes(res.market) ? '' : ` ${res.market}`}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. 섹터 & 통화 */}
              <div className="grid grid-cols-5 gap-3 items-end">
                {/* 섹터 (3칸) */}
                <div className="col-span-3 relative" ref={sectorRef}>
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
                      className={`w-full bg-transparent outline-none cursor-pointer text-center text-xs tracking-tight placeholder:text-center ${
                        !stockForm.sector ? 'text-slate-400 font-bold placeholder:text-slate-400 placeholder:font-bold placeholder:text-xs placeholder:tracking-tight' : 'text-slate-800 font-bold'
                      }`}
                    />
                    <ChevronDown
                      size={14}
                      className={`text-slate-400 shrink-0 absolute right-3.5 pointer-events-none transition-transform duration-200 ${
                        isSectorDropdownOpen ? 'rotate-180 text-blue-500' : ''
                      }`}
                    />
                  </div>
                  {isSectorDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/70 z-50 p-1.5 animate-fade-in">
                      <div className="py-1 max-h-52 overflow-y-auto space-y-0.5">
                        {sectorOptions.map((sector) => {
                          const isSelected = stockForm.sector === sector;
                          return (
                            <button
                              key={sector}
                              type="button"
                              className={`w-full px-2.5 py-2 text-xs rounded-xl transition-all flex items-center justify-between cursor-pointer tracking-tight ${
                                isSelected
                                  ? 'bg-blue-50 text-blue-600 font-black'
                                  : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 font-semibold'
                              }`}
                              onClick={() => {
                                setStockForm(prev => ({ ...prev, sector }));
                                setIsSectorDropdownOpen(false);
                              }}
                            >
                              <span>{sector}</span>
                              {isSelected && <Check size={14} className="text-blue-600 shrink-0" strokeWidth={2.5} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 통화 (2칸 - 가운데 정렬 적용) */}
                <div className="col-span-2 relative" ref={currencyRef}>
                  <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">통화</label>
                  {stockMarketType === 'DOMESTIC' ? (
                    <div className="w-full h-12 px-3.5 rounded-2xl border border-blue-200 bg-blue-50/70 flex items-center justify-center shadow-xs cursor-default">
                      <span className="text-center text-xs font-bold text-blue-600 tracking-tight flex items-center justify-center gap-1">
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md font-bold">₩</span> KRW
                      </span>
                    </div>
                  ) : (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                        className="w-full h-12 px-3.5 rounded-2xl border border-amber-200 bg-amber-50/60 hover:bg-amber-50 focus:border-amber-500 transition-all cursor-pointer flex items-center justify-center relative shadow-xs"
                      >
                        <span className="text-xs font-bold text-amber-700 tracking-tight flex items-center justify-center gap-1.5">
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md font-bold">
                            {stockForm.currency === 'USD' ? '$' : stockForm.currency === 'EUR' ? '€' : stockForm.currency === 'JPY' ? '¥' : stockForm.currency === 'GBP' ? '£' : stockForm.currency === 'CNY' ? '¥' : stockForm.currency === 'HKD' ? 'HK$' : stockForm.currency}
                          </span>
                          {stockForm.currency || 'USD'}
                        </span>
                        <ChevronDown
                          size={14}
                          className={`text-amber-500 shrink-0 absolute right-3 pointer-events-none transition-transform duration-200 ${isCurrencyDropdownOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {isCurrencyDropdownOpen && (
                        <div className="absolute top-full right-0 w-36 mt-1.5 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/70 z-50 p-1.5 animate-fade-in">
                          <div className="py-1 max-h-52 overflow-y-auto space-y-0.5">
                            {[
                              { code: 'USD', symbol: '$' },
                              { code: 'EUR', symbol: '€' },
                              { code: 'JPY', symbol: '¥' },
                              { code: 'GBP', symbol: '£' },
                              { code: 'CNY', symbol: '¥' },
                              { code: 'HKD', symbol: 'HK$' },
                            ].map((c) => {
                              const isSelected = stockForm.currency === c.code;
                              return (
                                <button
                                  key={c.code}
                                  type="button"
                                  className={`w-full px-2.5 py-2 text-xs rounded-xl transition-all flex items-center justify-between cursor-pointer tracking-tight ${
                                    isSelected
                                      ? 'bg-amber-50 text-amber-700 font-black'
                                      : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 font-semibold'
                                  }`}
                                  onClick={() => {
                                    setStockForm(prev => ({ ...prev, currency: c.code }));
                                    setIsCurrencyDropdownOpen(false);
                                  }}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md font-bold">
                                      {c.symbol}
                                    </span>
                                    <span className="tracking-tight">{c.code}</span>
                                  </div>
                                  {isSelected && <Check size={14} className="text-amber-600 shrink-0" strokeWidth={2.5} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 4. 안내 문구 */}
              <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                <p className="text-[11px] font-medium text-slate-500 text-center leading-relaxed">
                  {stockMarketType === 'DOMESTIC' ? (
                    <>
                      <strong className="text-slate-700 font-bold">국내 종목:</strong> 종목코드 입력 후 <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-600">Enter</kbd>를 누르면 종목정보가 조회됩니다.
                    </>
                  ) : (
                    <>
                      <strong className="text-slate-700 font-bold">해외 종목:</strong> 영문 티커(예: AAPL) 입력 후 <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-600">Enter</kbd>를 누르면 종목명이 조회됩니다.
                    </>
                  )}
                </p>
              </div>

              {/* 5. 취소 / 등록 버튼 */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsStockModalOpen(false)}
                  className="flex-1 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleAddStockSubmit}
                  className={`flex-1 h-12 rounded-2xl text-white font-bold text-sm transition-all shadow-md cursor-pointer ${
                    stockMarketType === 'DOMESTIC'
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'
                      : 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/25'
                  }`}
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
        <div 
          className={`fixed inset-0 z-[9995] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 transition-opacity ${
            isAccountClosing ? 'animate-fade-out pointer-events-none' : 'animate-fade-in'
          }`} 
          onClick={() => setIsAccountModalOpen(false)}
        >
          <div 
            className={`relative bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 overflow-visible max-h-[90vh] flex flex-col pointer-events-auto ${
              isAccountClosing ? 'animate-modal-out' : 'animate-page-slide'
            }`} 
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 flex-shrink-0 bg-white rounded-t-3xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Wallet size={18} strokeWidth={2.5} />
                </div>
                <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">계좌등록</h3>
              </div>
              <button 
                onClick={() => setIsAccountModalOpen(false)} 
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-5 md:p-6 flex-1 overflow-visible space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* 금융기관 */}
                <div>
                  <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">금융기관</label>
                  <input
                    type="text"
                    placeholder="예: 토스, 키움"
                    value={accountForm.institution}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, institution: e.target.value }))}
                    ref={institutionRef}
                    className="w-full h-12 px-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-800 bg-white shadow-xs transition-all text-center placeholder:text-center placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs"
                  />
                </div>

                {/* 계좌구분 */}
                <div className="relative" ref={accountTypeRef}>
                  <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">계좌구분</label>
                  <div
                    onClick={() => setIsAccountTypeDropdownOpen(!isAccountTypeDropdownOpen)}
                    className="w-full h-12 px-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/50 focus-within:border-blue-500 transition-all cursor-pointer flex items-center justify-center relative shadow-xs"
                  >
                    <input
                      type="text"
                      readOnly
                      placeholder="구분 선택"
                      value={accountForm.type || '일반'}
                      ref={accountTypeInputRef}
                      className="w-full bg-transparent outline-none cursor-pointer text-center text-xs text-slate-800 font-bold tracking-tight"
                    />
                    <ChevronDown
                      size={14}
                      className={`text-slate-400 shrink-0 absolute right-3.5 pointer-events-none transition-transform duration-200 ${
                        isAccountTypeDropdownOpen ? 'rotate-180 text-blue-500' : ''
                      }`}
                    />
                  </div>
                  {isAccountTypeDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/70 z-50 p-1.5 animate-fade-in">
                      <div className="py-1 max-h-48 overflow-y-auto space-y-0.5">
                        {['일반', 'ISA', 'IRP', 'DC', '연금저축', '기타'].map((type) => {
                          const isSelected = (accountForm.type || '일반') === type;
                          return (
                            <button
                              key={type}
                              type="button"
                              className={`w-full px-2.5 py-2 text-xs rounded-xl transition-all flex items-center justify-between cursor-pointer tracking-tight ${
                                isSelected
                                  ? 'bg-blue-50 text-blue-600 font-black'
                                  : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 font-semibold'
                              }`}
                              onClick={() => {
                                setAccountForm(prev => ({ ...prev, type }));
                                setIsAccountTypeDropdownOpen(false);
                              }}
                            >
                              <span>{type}</span>
                              {isSelected && <Check size={14} className="text-blue-600 shrink-0" strokeWidth={2.5} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 안내 문구 */}
              <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                <p className="text-[11px] font-medium text-slate-500 text-center leading-relaxed">
                  등록될 계좌명:{' '}
                  <strong className="text-slate-800 font-bold">
                    {accountForm.institution.trim() 
                      ? `${accountForm.institution.trim()} (${accountForm.type || '계좌구분'})`
                      : '금융기관 (계좌구분)'}
                  </strong>
                </p>
              </div>

              {/* 하단 취소 / 등록 버튼 */}
              <div className="pt-2 flex gap-3">
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
                    const selectedType = (accountForm.type || '일반').trim();
                    const combined = `${accountForm.institution.trim()} (${selectedType})`;
                    const exists = await TransactionManager.isAccountNameExists(combined);
                    if (exists) {
                      showAlert("입력 오류", "이미 등록된 계좌명입니다.", "error", institutionRef);
                      return;
                    }
                    try {
                      await TransactionManager.addAccount({
                        financial_institution: accountForm.institution.trim(),
                        type: selectedType,
                        account_nm: combined
                      });
                      await refreshAccounts();
                      setFormData(prev => ({ ...prev, account: combined }));
                      setIsAccountModalOpen(false);
                      setAccountForm({ institution: '', type: '일반' });
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
                      <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md tabular-nums">
                        {formatToolbarDate(tempFilters.dateFrom)} ~ {formatToolbarDate(tempFilters.dateTo)}
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
                                ? 'bg-blue-600 text-white shadow-sm border border-blue-600'
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
                          className={`w-full px-3 py-2.5 rounded-xl border transition-all text-center text-xs font-bold tabular-nums h-11 flex items-center justify-center relative cursor-pointer shadow-2xs ${
                            isFilterFromCalendarOpen
                              ? 'border-blue-600 bg-white ring-2 ring-blue-100 text-blue-600'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-slate-700'
                          }`}
                        >
                          <span className="truncate pr-4 tabular-nums">{tempFilters.dateFrom ? formatToolbarDate(tempFilters.dateFrom) : '시작일'}</span>
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
                          className={`w-full px-3 py-2.5 rounded-xl border transition-all text-center text-xs font-bold tabular-nums h-11 flex items-center justify-center relative cursor-pointer shadow-2xs ${
                            isFilterToCalendarOpen
                              ? 'border-blue-600 bg-white ring-2 ring-blue-100 text-blue-600'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-slate-700'
                          }`}
                        >
                          <span className="truncate pr-4 tabular-nums">{tempFilters.dateTo ? formatToolbarDate(tempFilters.dateTo) : '종료일'}</span>
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
                      { val: '매수', label: '매수', dot: 'text-rose-500' },
                      { val: '매도', label: '매도', dot: 'text-blue-500' }
                    ].map(opt => {
                      const isActive = tempFilters.type === opt.val;
                      return (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setTempFilters(prev => ({ ...prev, type: opt.val }))}
                          className={`py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] ${
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
                                    {stock.exchange_nm || '국내'}
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
    <div className="select-none text-xs bg-white rounded-xl" style={{ backgroundColor: '#ffffff' }}>
      <div className="flex justify-between items-center mb-2 px-1 bg-white" style={{ backgroundColor: '#ffffff' }}>
        <span className="font-bold tabular-nums text-slate-800 text-xs tracking-tight">{currentYear}년 {currentMonth + 1}월</span>
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
