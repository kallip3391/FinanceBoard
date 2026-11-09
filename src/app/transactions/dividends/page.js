"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { Edit2, Trash2, Filter, RotateCcw, Plus, X, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check, ChevronDown, Coins, Search, PlusCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAssets } from "@/contexts/AssetContext";
import { TransactionManager, TRANSACTION_TYPES, TRADE_TYPES, CURRENCIES } from "@/lib/transactionManager";
import MobileTransactionList from "@/app/components/mobile/MobileTransactionList";
import useMobileKeyboardModal from "@/hooks/useMobileKeyboardModal";
import { useAnimatedModal } from "@/hooks/useAnimatedModal";



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
  const ITEMS_PER_PAGE = 10;

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

  // 전역 상태가 변경되면 로컬 필터링용 데이터 업데이트
  useEffect(() => {
    if (user) {
      setTransactions(dividendTransactions || []);
      setLoading(isTransactionsLoading);
    } else {
      setTransactions([]);
      setLoading(false);
    }
  }, [user, dividendTransactions, isTransactionsLoading]);

  // 사용자 데이터 로드 - 불필요한 중복 요청 제거
  useEffect(() => {
    if (user && dividendTransactions.length === 0) {
      refreshTransactions();
    }
  }, [user]);

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
    document.addEventListener('mousedown', handleClickOutsideFilter);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideFilter);
    };
  }, [isFilterFromCalendarOpen, isFilterToCalendarOpen, isFilterTypeDropdownOpen, isFilterStockDropdownOpen]);

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
      showAlert("입력 오류", "배당금(분배금)을 입력해 주세요.", "error", priceRef);
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
    const accountNm = accountNameById[tx.account_id] || '';

    setFormData({
      year: year || '',
      month: month || '',
      day: day || '',
      account: accountNm,
      account_id: tx.account_id || '',
      stock: stockCode ? `[${stockCode}] ${stockName}` : stockName,
      stockCode: stockCode,
      security_id: tx.security_id || '',
      currency: tx.currency || 'USD',
      dividendAmount: tx.dividend_amount ? (tx.currency === 'KRW' ? tx.dividend_amount.toLocaleString('ko-KR') : tx.dividend_amount.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '',
      exchangeRate: tx.exchange_rate ? tx.exchange_rate.toString() : '',
      totalDividend: tx.total_dividend ? tx.total_dividend.toLocaleString('ko-KR') : '',
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

  const filteredTransactions = (transactions || []).filter(tx => {
    // 1. 통화 필터
    if (activeFilters.type !== '전체') {
      const typeStr = tx.currency || 'KRW';
      if (typeStr !== activeFilters.type) return false;
    }
    
    // 2. 종목명 필터
    if (activeFilters.security_id) {
      if (tx.security_id !== activeFilters.security_id) return false;
    } else if (activeFilters.stockName) {
      const sName = (tx.security?.name || tx.stock_name || tx.stock || '').toUpperCase();
      const sCode = (tx.security?.code || tx.stock_code || tx.stockCode || '').toUpperCase();
      const search = activeFilters.stockName.toUpperCase();
      if (!sName.includes(search) && !sCode.includes(search)) return false;
    }
    
    // 2. 기간 필터 (시작일)
    if (activeFilters.dateFrom && tx.date < activeFilters.dateFrom) return false;
    
    // 3. 기간 필터 (종료일)
    if (activeFilters.dateTo && tx.date > activeFilters.dateTo) return false;
    
    return true;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const PAGES_PER_BLOCK = 10;
  const currentBlock = Math.floor((currentPage - 1) / PAGES_PER_BLOCK);
  const startPage = currentBlock * PAGES_PER_BLOCK + 1;
  const endPage = Math.min(startPage + PAGES_PER_BLOCK - 1, totalPages);

  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const isFilterActive = activeFilters.dateFrom || activeFilters.dateTo || activeFilters.stockName || activeFilters.security_id || activeFilters.type !== '전체';

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
      <div className="desktop-only flex-col w-full">
        {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center bg-amber-50 text-amber-600 rounded-xl border border-amber-100/50 shadow-sm">
            <Coins size={20} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-baseline gap-2">
            배당 <span className="text-slate-400 text-lg font-normal">({filteredTransactions.length}건)</span>
          </h1>
        </div>

        {/* 로그인 상태 확인 */}
        {!user && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg text-sm">
            로그인 후 보유 자산을 확인할 수 있습니다.
          </div>
        )}

        {/* Action Buttons */}
        {user && (
          <div className="flex flex-wrap gap-2">
            {isFilterActive && (
              <button 
                onClick={() => {
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
                  showAlert("필터 초기화", "모든 필터 조건이 초기화되었습니다.", "success");
                }}
                className="flex items-center gap-2 bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 shadow-md px-4 py-2.5 rounded-xl font-medium transition-all focus:outline-none cursor-pointer"
              >
                <RotateCcw size={18} />
                필터 초기화
              </button>
            )}
            <button 
              onClick={() => {
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
              className={`flex items-center gap-2 border shadow-md px-4 py-2.5 rounded-xl font-semibold transition-all focus:outline-none cursor-pointer ${
                isFilterActive 
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-600" 
                  : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-100"
              }`}
            >
              <Filter size={18} />
              필터
            </button>
            <button
              onClick={() => toggleModal()}
              className="inline-flex items-center gap-1 whitespace-nowrap px-4 py-2.5 rounded-xl font-bold shadow-md transition-all border bg-amber-400 text-white hover:bg-amber-500 border-amber-300 cursor-pointer focus:outline-none"
            >
              등록
            </button>
          </div>
        )}
      </div>

      {/* Table Container */}
      {user && (
        <>
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-500">배당일</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-500">계좌</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-500">종목</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-500">통화</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">배당금&nbsp;&nbsp;&nbsp;</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">배당금(원)&nbsp;&nbsp;&nbsp;</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-slate-500">옵션</th>
            </tr>
          </thead>
          <tbody key={`dividends-tx-${currentPage}`} className="divide-y divide-slate-50">
            {loading ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-2 border-slate-200 border-t-amber-400 rounded-full animate-spin"></div>
                    <span>배당내역을 불러오는 중...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedTransactions.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <span>{user ? '등록된 배당내역이 없습니다.' : '로그인 후 배당내역을 확인할 수 있습니다.'}</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedTransactions.map((tx, i) => (
                <tr key={tx.id} className={`h-[72px] hover:bg-slate-50/80 transition-colors group opacity-0 animate-row-fade stagger-${i + 1}`}>
                  <td className="px-6 py-2 text-sm text-slate-500 text-center">{formatDisplayDate(tx.date)}</td>
                  <td className="px-6 py-2 text-sm text-slate-700 font-medium text-center">
                    {accountNameById[tx.account_id] || tx.account || ''}
                  </td>
                  <td className="px-6 py-2">
                    <div className="flex items-center gap-3 min-h-[52px]">
                      <div className={`w-[2px] h-9 rounded-full flex-shrink-0 ${getCurrencyStyle(tx.currency || 'KRW').accent}`}></div>
                      <div className="flex flex-col justify-center max-w-[280px]">
                        <span className="text-sm text-slate-900 font-semibold leading-tight line-clamp-2 break-all">{tx.security?.name || tx.stock_name || tx.stock || '-'}</span>
                        <span className="text-[12px] text-slate-400 font-mono mt-0.5">{tx.security?.code || tx.stock_code || tx.stockCode || ''}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-2 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getCurrencyBadgeStyles(tx.currency || 'KRW')}`}>
                      {tx.currency || 'KRW'}
                    </span>
                  </td>
                  <td className="px-6 py-2 text-sm font-medium text-slate-600 text-right">
                    {typeof tx.dividend_amount === 'number' ?
                      (tx.currency === 'KRW' ?
                        '' :
                        `${getCurrencySymbol(tx.currency)} ${tx.dividend_amount.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) :
                      tx.dividend_amount
                    }&nbsp;&nbsp;&nbsp;
                  </td>
                  <td className="px-6 py-2 text-sm font-bold text-slate-900 text-right">
                    {typeof tx.total_dividend === 'number' ? tx.total_dividend.toLocaleString('ko-KR') : tx.total_dividend}&nbsp;&nbsp;&nbsp;
                  </td>
                  <td className="px-6 py-2 text-center">
                    <div className="flex items-center justify-center gap-2 transition-all">
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
              )).concat(
                paginatedTransactions.length > 0 && paginatedTransactions.length < ITEMS_PER_PAGE ?
                  [...Array(ITEMS_PER_PAGE - paginatedTransactions.length)].map((_, i) => (
                    <tr key={`empty-${i}`} className={`h-[72px] opacity-0 animate-row-fade stagger-${paginatedTransactions.length + i + 1}`}>
                      <td colSpan="7" className="px-6 py-2"><div className="min-h-[52px]">&nbsp;</div></td>
                    </tr>
                  )) : []
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
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
            disabled={currentPage > totalPages - 1} // Can't jump if already near the end
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
        <div className={`fixed inset-0 z-[9990] bg-black/60 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4 transition-opacity ${isModalClosing ? 'animate-fade-out pointer-events-none' : 'animate-fade-in'}`} onClick={toggleModal}>
          <div className={`relative bg-white w-full max-w-lg rounded-t-3xl md:rounded-3xl shadow-2xl border-t md:border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col pointer-events-auto ${isModalClosing ? 'animate-sheet-down md:animate-modal-out' : 'animate-sheet-up md:animate-page-slide'}`} onClick={(e) => e.stopPropagation()}>
            {/* Mobile handle */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-2.5 mb-0.5 shrink-0 md:hidden" />

            <div className="flex-shrink-0 flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
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
              {/* 1. 배당일 (가운데 정렬) */}
              <div>
                <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">배당일</label>
                <div className="relative">
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
                    >
                      <CalendarUI
                        initialYear={parseInt(formData.year) || new Date().getFullYear()}
                        initialMonth={parseInt(formData.month) || (new Date().getMonth() + 1)}
                        onSelect={handleDateSelect}
                      />
                    </div>
                  )}
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
                      className="w-full h-12 px-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white focus:outline-none transition-all flex items-center justify-between text-xs cursor-pointer shadow-xs text-left"
                    >
                      <span className={`truncate ${formData.account ? 'text-slate-800 font-bold text-xs' : 'text-slate-400 font-medium text-xs'}`}>
                        {formData.account || '계좌선택'}
                      </span>
                      <ChevronDown size={18} className="text-slate-400 shrink-0 ml-2" />
                    </button>
                    {isAccountDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden">
                        <div ref={accountListRef} className="py-2 max-h-[286px] overflow-y-auto block overflow-x-hidden">
                          {isAccountsLoading ? (
                            <div className="px-4 py-2 text-sm text-slate-400 text-center">불러오는 중...</div>
                          ) : accounts.length === 0 ? (
                            <div className="px-4 py-2 text-sm text-slate-400 text-center">등록된 계좌가 없습니다</div>
                          ) : (
                            accounts.map((acc, index) => (
                              <button
                                key={acc.account_id}
                                type="button"
                                className={`w-full px-4 py-3 text-left transition-colors flex items-center cursor-pointer ${
                                  focusedAccountIndex === index ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50'
                                }`}
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, account: acc.account_nm, account_id: acc.account_id }));
                                  setIsAccountDropdownOpen(false);
                                  setTimeout(() => stockRef.current?.focus(), 50);
                                }}
                              >
                                <span className="font-bold text-sm text-slate-700">{acc.account_nm}</span>
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
                        setAccountForm({ institution: '', type: '' });
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
                <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">종목</label>
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
                            priceRef.current?.focus();
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
                                setFormData(prev => ({
                                  ...prev,
                                  security_id: stock.security_id,
                                  stock: `[${stock.code}] ${stock.name}`,
                                  stockCode: stock.code,
                                  exchange_code: stock.exchange_code || '',
                                  currency: stock.currency || prev.currency
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
                                className={`w-full px-4 py-3 text-left transition-colors flex items-center cursor-pointer ${
                                  focusedStockIndex === index ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50'
                                }`}
                                onMouseEnter={() => setFocusedStockIndex(index)}
                                onClick={() => {
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    stock: `[${stock.code}] ${stock.name}`, 
                                    stockCode: stock.code, 
                                    security_id: stock.security_id, 
                                    currency: stock.currency || prev.currency 
                                  }));
                                  setIsStockDropdownOpen(false);
                                  setTimeout(() => priceRef.current?.focus(), 50);
                                }}
                              >
                                <span className={`font-semibold text-sm leading-tight break-words ${focusedStockIndex === index ? 'text-blue-600' : 'text-slate-700'}`}>
                                  {stock.name} <span className={`text-[13px] font-medium tracking-tight ${focusedStockIndex === index ? 'text-blue-400' : 'text-slate-400'}`}>({stock.code})</span>
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
                        setStockForm({ name: '', code: '', sector: '', currency: 'KRW', exchange_code: '' });
                        setIsSectorDropdownOpen(false);
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

              {/* 4. 배당금(분배금) & 통화 (우측정렬, 폰트/색상 통일) */}
              <div>
                <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">배당금(분배금)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-blue-600 text-sm">
                      {CURRENCIES[formData.currency]?.symbol || (formData.currency === 'KRW' ? '₩' : '$')}
                    </span>
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
                      className={`w-full h-12 pl-10 pr-4 rounded-2xl border border-slate-200 focus:outline-none focus:border-blue-500 text-right text-xs bg-slate-50/70 focus:bg-white shadow-xs transition-all placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs placeholder:text-right ${
                        !formData.dividendAmount || formData.dividendAmount === '0' ? 'text-slate-400 font-medium' : 'text-slate-800 font-bold'
                      }`}
                    />
                  </div>

                  <div className="flex-shrink-0 w-24 flex items-center">
                    <span className="w-full h-12 rounded-2xl border font-bold text-center text-xs shadow-xs border-blue-200 bg-blue-50 text-blue-600 flex items-center justify-center">
                      {formData.currency || 'KRW'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. 총 배당금 하단 카드 */}
              <div className="px-4 py-3 rounded-2xl bg-slate-50/60 border border-slate-200/80 space-y-2 shadow-xs">
                {formData.currency !== 'KRW' && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-slate-600 tracking-tight ml-0.5">환율</span>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-700 text-sm tabular-nums">
                        {formData.exchangeRate || '-'}
                      </span>
                      <span className="text-xs font-bold text-slate-400">{formData.currency} / KRW</span>
                    </div>
                  </div>
                )}

                <div className={`flex justify-between items-center ${formData.currency !== 'KRW' ? 'pt-2 border-t border-slate-200/60' : ''}`}>
                  <span className="text-xs font-black text-slate-600 tracking-tight ml-0.5">총 배당금</span>
                  <div className="text-right flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-blue-600 tabular-nums">{formData.totalDividend || '0'}</span>
                    <span className="text-sm font-bold text-slate-400">원</span>
                  </div>
                </div>
              </div>

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
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/25 cursor-pointer'
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
                          <div ref={filterFromCalendarRef} className="absolute left-0 top-full mt-1.5 z-[100] bg-white rounded-2xl shadow-2xl border border-slate-100 p-2.5 animate-slide-up w-[245px]">
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
                          <div ref={filterToCalendarRef} className="absolute right-0 top-full mt-1.5 z-[100] bg-white rounded-2xl shadow-2xl border border-slate-100 p-2.5 animate-slide-up w-[245px]">
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
