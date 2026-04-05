"use client";

import { useState, useEffect, useRef } from "react";

import { Edit2, Trash2, Filter, RotateCcw, Plus, X, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check, ChevronDown, Coins, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAssets } from "@/contexts/AssetContext";
import { TransactionManager, TRANSACTION_TYPES, TRADE_TYPES, CURRENCIES } from "@/lib/transactionManager";



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
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null });
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', type: 'error', focusRef: null });
  const [stockDeleteConfirm, setStockDeleteConfirm] = useState({ isOpen: false, id: null, name: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
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
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isAccountTypeDropdownOpen, setIsAccountTypeDropdownOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({ institution: '', type: '' });
  const [accountDeleteConfirm, setAccountDeleteConfirm] = useState({ isOpen: false, name: '' });


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
  const [isSectorDropdownOpen, setIsSectorDropdownOpen] = useState(false);
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [stockForm, setStockForm] = useState({ name: '', code: '', sector: '', currency: 'KRW', exchange_code: '' });

  const calendarRef = useRef(null);
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

  const [accountFocusedIndex, setAccountFocusedIndex] = useState(-1);
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
    if (isAccountDropdownOpen && accountFocusedIndex >= 0 && accountListRef.current) {
      const container = accountListRef.current;
      const focusedItem = container.children[accountFocusedIndex];
      if (focusedItem) {
        focusedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [accountFocusedIndex, isAccountDropdownOpen]);

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
      if (isFilterFromCalendarOpen && filterFromCalendarRef.current && !filterFromCalendarRef.current.contains(event.target)) {
        setIsFilterFromCalendarOpen(false);
      }
      if (isFilterToCalendarOpen && filterToCalendarRef.current && !filterToCalendarRef.current.contains(event.target)) {
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
      showAlert("입력 오류", "배당일을 입력해 주세요.", "error", yearRef);
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
        showAlert("등록 완료", "배당이 성공적으로 등록되었습니다.", "success");
      }

      setIsModalOpen(false);
    } catch (error) {
      console.error('배당 처리 중 오류:', error);
      showAlert("오류", error.message || "배당 처리 중 문제가 발생했습니다.", "error");
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
      // 원 단위에서 반올림 (10원 단위로 처리)
      const roundedTotal = Math.round(krwTotal / 10) * 10;

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
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
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
  }, [isModalOpen, formData.currency]);

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

  const handleStockSearch = async (val) => {
    const searchTerm = (val || '').trim();
    
    setIsFilterStockDropdownOpen(true);
    setIsSearchingStock(true);
    try {
      const results = await TransactionManager.searchStocksByName(searchTerm, null);
      const currencyOrder = (c) => c === 'KRW' ? 0 : c === 'USD' ? 1 : 2;
      const sorted = [...results].sort((a, b) => currencyOrder(a.currency) - currencyOrder(b.currency));
      setStockSearchResults(sorted);
      if (sorted.length > 0) setStockFocusedIndex(0);
      else setStockFocusedIndex(-1);
    } catch (err) {
      console.error('종목 검색 오류:', err);
      setStockSearchResults([]);
      setStockFocusedIndex(-1);
    } finally {
      setIsSearchingStock(false);
    }
  };

  const handleFilterDateChange = (field, value) => {
    const digits = value.replace(/[^0-9]/g, '');
    if (digits.length <= 6) {
      setTempFilters(prev => ({ ...prev, [field]: digits }));
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

  const filteredTransactions = transactions.filter(tx => {
    // 1. 거래구분 필터
    if (activeFilters.type !== '전체') {
      const typeStr = (tx.trade_type === TRADE_TYPES.BUY || tx.type === '매수') ? '매수' : '매도';
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
            로그인 후 본인의 배당내역을 관리할 수 있습니다.
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
                } else {
                   setTempFilters({ ...activeFilters });
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
                <tr key={tx.id} className={`hover:bg-slate-50/80 transition-colors group opacity-0 animate-row-fade stagger-${i + 1}`}>
                  <td className="px-6 py-4 text-sm text-slate-500 text-center">{formatDisplayDate(tx.date)}</td>
                  <td className="px-6 py-4 text-sm text-slate-700 font-medium text-center">
                    {accountNameById[tx.account_id] || tx.account || ''}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-[2px] h-8 rounded-full flex-shrink-0 ${getCurrencyStyle(tx.currency || 'KRW').accent}`}></div>
                      <div className="flex flex-col max-w-[240px]">
                        <span className="text-sm text-slate-900 font-semibold leading-snug break-words">{tx.security?.name || tx.stock_name || tx.stock || '-'}</span>
                        <span className="text-[12px] text-slate-400 font-mono mt-0.5">{tx.security?.code || tx.stock_code || tx.stockCode || ''}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getCurrencyBadgeStyles(tx.currency || 'KRW')}`}>
                      {tx.currency || 'KRW'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600 text-right">
                    {typeof tx.dividend_amount === 'number' ?
                      (tx.currency === 'KRW' ?
                        '' :
                        `${getCurrencySymbol(tx.currency)} ${tx.dividend_amount.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) :
                      tx.dividend_amount
                    }&nbsp;&nbsp;&nbsp;
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">
                    {typeof tx.total_dividend === 'number' ? tx.total_dividend.toLocaleString('ko-KR') : tx.total_dividend}&nbsp;&nbsp;&nbsp;
                  </td>
                  <td className="px-6 py-4 text-center">
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
                    <tr key={`empty-${i}`} className={`opacity-0 animate-row-fade stagger-${paginatedTransactions.length + i + 1}`}>
                      <td colSpan="7" className="px-6 py-[27px]">&nbsp;</td>
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

      {/* Add Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 1000 }}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={toggleModal}></div>

          <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800">{editingId ? '수정' : '등록'}</h3>
              <button onClick={toggleModal} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-bold text-slate-500 mb-1.5 ml-1">배당일</label>
                <div className="flex items-center gap-2 w-full">
                  <input
                    ref={yearRef}
                    type="text" maxLength={4} placeholder="YYYY"
                    value={formData.year}
                    onChange={(e) => setFormData(prev => ({ ...prev, year: e.target.value.replace(/[^0-9]/g, '') }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Tab') {
                        if (formData.year.length === 2) {
                          setFormData(prev => ({ ...prev, year: `20${prev.year}` }));
                        }
                      }
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (formData.year.length === 4 || formData.year.length === 2) {
                          const yearVal = formData.year.length === 2 ? `20${formData.year}` : formData.year;
                          if (formData.month && formData.day) {
                            const lastDay = new Date(parseInt(yearVal), parseInt(formData.month), 0).getDate();
                            if (parseInt(formData.day) > lastDay) {
                              const newDay = lastDay.toString().padStart(2, '0');
                              setFormData(prev => ({ ...prev, day: newDay }));
                              fetchRate({ day: newDay });
                              return;
                            }
                          }
                          fetchRate();
                        }
                        monthRef.current?.focus();
                      }
                    }}
                    onBlur={() => {
                      let currentYear = formData.year;
                      if (currentYear.length === 2) {
                        currentYear = `20${currentYear}`;
                        setFormData(prev => ({ ...prev, year: currentYear }));
                      }

                      if (currentYear && currentYear.length !== 4) {
                        showAlert("입력 오류", "거래년도를 4자리로 입력해주세요.", 'error', yearRef);
                        return;
                      }

                      const today = new Date();
                      const inputYear = parseInt(currentYear);
                      if (inputYear > today.getFullYear()) {
                        showAlert("입력 오류", "미래 일자는 입력할 수 없습니다.", 'error', yearRef);
                        const now = new Date();
                        setFormData(prev => ({ ...prev, year: now.getFullYear().toString() }));
                        return;
                      }

                      if (currentYear && currentYear.length === 4) {
                        if (formData.month && formData.day) {
                          const lastDay = new Date(parseInt(currentYear), parseInt(formData.month), 0).getDate();
                          if (parseInt(formData.day) > lastDay) {
                            const newDay = lastDay.toString().padStart(2, '0');
                            setFormData(prev => ({ ...prev, day: newDay }));
                            fetchRate({ day: newDay });
                            return;
                          }
                        }
                        fetchRate();
                      }
                    }}
                    className="w-[160px] px-3 py-3 rounded-xl border border-slate-100 focus:outline-none focus:border-brand transition-all text-center font-bold bg-slate-50 shadow-sm"
                  />
                  <span className="text-slate-300 font-bold">/</span>
                  <input
                    ref={monthRef}
                    type="text" maxLength={2} placeholder="MM"
                    value={formData.month}
                    onChange={(e) => {
                      let val = e.target.value.replace(/[^0-9]/g, '');
                      if (val.length === 1 && parseInt(val) >= 2) val = '0' + val;
                      if (val.length === 2 && parseInt(val) > 12) return;
                      setFormData(prev => ({ ...prev, month: val }));
                    }}
                    onBlur={() => {
                      const today = new Date();
                      const inputYear = parseInt(formData.year);
                      const inputMonth = parseInt(formData.month);

                      if (inputYear === today.getFullYear() && inputMonth > (today.getMonth() + 1)) {
                        showAlert("입력 오류", "미래 일자는 입력할 수 없습니다.", 'error', monthRef);
                        setFormData(prev => ({ ...prev, month: (today.getMonth() + 1).toString().padStart(2, '0') }));
                        return;
                      }

                      if (formData.month && formData.month.length === 1) {
                        const padded = formData.month.padStart(2, '0');
                        setFormData(prev => ({ ...prev, month: padded }));

                        // 날짜 유효성 체크 및 자동 조정 (예: 3/31 -> 4/30)
                        if (formData.year && formData.day) {
                          const lastDay = new Date(parseInt(formData.year), parseInt(padded), 0).getDate();
                          if (parseInt(formData.day) > lastDay) {
                            const newDay = lastDay.toString().padStart(2, '0');
                            setFormData(prev => ({ ...prev, day: newDay, month: padded }));
                            fetchRate({ month: padded, day: newDay });
                            return;
                          }
                        }
                        fetchRate({ month: padded });
                      } else if (formData.month) {
                        // 날짜 유효성 체크 및 자동 조정
                        if (formData.year && formData.day) {
                          const lastDay = new Date(parseInt(formData.year), parseInt(formData.month), 0).getDate();
                          if (parseInt(formData.day) > lastDay) {
                            const newDay = lastDay.toString().padStart(2, '0');
                            setFormData(prev => ({ ...prev, day: newDay }));
                            fetchRate({ day: newDay });
                            return;
                          }
                        }
                        fetchRate();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (formData.year && formData.month && formData.day) {
                          const lastDay = new Date(parseInt(formData.year), parseInt(formData.month), 0).getDate();
                          if (parseInt(formData.day) > lastDay) {
                            const newDay = lastDay.toString().padStart(2, '0');
                            setFormData(prev => ({ ...prev, day: newDay }));
                            fetchRate({ day: newDay });
                            return;
                          }
                        }
                        fetchRate();
                      }
                    }}
                    className="w-[100px] px-3 py-3 rounded-xl border border-slate-100 focus:outline-none focus:border-brand transition-all text-center font-bold bg-slate-50 shadow-sm"
                  />
                  <span className="text-slate-300 font-bold">/</span>
                  <input
                    ref={dayRef}
                    type="text" maxLength={2} placeholder="DD"
                    value={formData.day}
                    onChange={(e) => setFormData(prev => ({ ...prev, day: e.target.value.replace(/[^0-9]/g, '') }))}
                    onBlur={() => {
                      const today = new Date();
                      const inputYear = parseInt(formData.year);
                      const inputMonth = parseInt(formData.month);
                      const inputDay = parseInt(formData.day);

                      if (inputYear === today.getFullYear() && inputMonth === (today.getMonth() + 1) && inputDay > today.getDate()) {
                        showAlert("입력 오류", "미래 일자는 입력할 수 없습니다.", 'error', dayRef);
                        setFormData(prev => ({ ...prev, day: today.getDate().toString().padStart(2, '0') }));
                        return;
                      }

                      if (formData.day && formData.day.length === 1) {
                        const padded = formData.day.padStart(2, '0');

                        // 날짜 유효성 체크 (해당 월의 마지막 날짜보다 큰 경우 조정)
                        if (formData.year && formData.month) {
                          const lastDay = new Date(parseInt(formData.year), parseInt(formData.month), 0).getDate();
                          if (parseInt(padded) > lastDay) {
                            const adjusted = lastDay.toString().padStart(2, '0');
                            setFormData(prev => ({ ...prev, day: adjusted }));
                            fetchRate({ day: adjusted });
                            return;
                          }
                        }

                        setFormData(prev => ({ ...prev, day: padded }));
                        fetchRate({ day: padded });
                      } else if (formData.day) {
                        // 날짜 유효성 체크
                        if (formData.year && formData.month) {
                          const lastDay = new Date(parseInt(formData.year), parseInt(formData.month), 0).getDate();
                          if (parseInt(formData.day) > lastDay) {
                            const adjusted = lastDay.toString().padStart(2, '0');
                            setFormData(prev => ({ ...prev, day: adjusted }));
                            fetchRate({ day: adjusted });
                            return;
                          }
                        }
                        fetchRate();
                      }
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === 'Tab' && !e.shiftKey) {
                        e.preventDefault();
                        setIsAccountDropdownOpen(true);
                        setAccountFocusedIndex(0);
                        setTimeout(() => accountRef.current?.focus(), 50);
                        return;
                      }
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (formData.year && formData.month && formData.day) {
                          const lastDay = new Date(parseInt(formData.year), parseInt(formData.month), 0).getDate();
                          if (parseInt(formData.day) > lastDay) {
                            const adjusted = lastDay.toString().padStart(2, '0');
                            setFormData(prev => ({ ...prev, day: adjusted }));
                            fetchRate({ day: adjusted });
                            return;
                          }
                        }
                        if (typeof fetchRate === 'function') fetchRate();
                        accountRef.current?.focus();
                      }
                    }}
                    className="w-[100px] px-3 py-3 rounded-xl border border-slate-100 focus:outline-none focus:border-brand transition-all text-center font-bold bg-slate-50 shadow-sm"
                  />

                  <div className="flex-1"></div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer shadow-sm ${isCalendarOpen
                        ? 'bg-brand text-white border-brand shadow-lg shadow-brand/20'
                        : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                    >
                      <Calendar size={20} />
                    </button>

                    {isCalendarOpen && (
                      <div
                        ref={calendarRef}
                        className="absolute right-0 top-full mt-2 z-[60] bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 animate-slide-up w-72"
                        style={{ transformOrigin: 'top right' }}
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
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-bold text-slate-500 mb-1.5 ml-1">계좌</label>
                <div className="flex gap-2">
                  <div className="relative flex-1" ref={accountDropdownRef}>
                    <div className="flex items-center">
                      <input
                        ref={accountRef}
                        type="text"
                        readOnly
                        placeholder="계좌 선택"
                        value={formData.account}
                        className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-100 focus:outline-none focus:border-brand transition-all font-bold text-slate-700 bg-slate-50 cursor-pointer text-center h-12 box-border shadow-sm hover:border-brand/30 hover:bg-white"
                        onClick={() => {
                          const next = !isAccountDropdownOpen;
                          setIsAccountDropdownOpen(next);
                          if (next) setAccountFocusedIndex(-1);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            if (!isAccountDropdownOpen) {
                              setIsAccountDropdownOpen(true);
                              setAccountFocusedIndex(0);
                            } else {
                              setAccountFocusedIndex(prev => Math.min(prev + 1, accounts.length - 1));
                            }
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            if (isAccountDropdownOpen) {
                              setAccountFocusedIndex(prev => Math.max(prev - 1, 0));
                            }
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            if (isAccountDropdownOpen && accountFocusedIndex >= 0 && accounts[accountFocusedIndex]) {
                              const acc = accounts[accountFocusedIndex];
                              setFormData(prev => ({ ...prev, account: acc.account_nm, account_id: acc.account_id }));
                              setIsAccountDropdownOpen(false);
                              setAccountFocusedIndex(-1);
                              setTimeout(() => stockRef.current?.focus(), 50);
                            } else {
                              setIsAccountDropdownOpen(!isAccountDropdownOpen);
                            }
                          } else if (e.key === 'Escape') {
                            setIsAccountDropdownOpen(false);
                            setAccountFocusedIndex(-1);
                          } else if (e.key === 'Tab' && !e.shiftKey) {
                            if (isAccountDropdownOpen) {
                              setIsAccountDropdownOpen(false);
                              setAccountFocusedIndex(-1);
                            }
                            e.preventDefault();
                            stockRef.current?.focus();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"
                      >
                        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isAccountDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {isAccountDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10">
                        <div ref={accountListRef} className="py-2 max-h-[286px] overflow-y-auto block overflow-x-hidden">
                          {isAccountsLoading ? (
                            <div className="px-4 py-2 text-sm text-slate-400 text-center">불러오는 중...</div>
                          ) : accounts.length === 0 ? (
                            <div className="px-4 py-2 text-sm text-slate-400 text-center">등록된 계좌가 없습니다</div>
                          ) : (
                            accounts.map((acc) => (
                              <button
                                key={acc.account_id}
                                type="button"
                                className={`w-full px-4 py-3 text-left transition-colors flex items-center ${accountFocusedIndex === accounts.indexOf(acc) ? 'bg-amber-50 text-amber-600' : 'hover:bg-slate-50'
                                  }`}
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, account: acc.account_nm, account_id: acc.account_id }));
                                  setIsAccountDropdownOpen(false);
                                  setAccountFocusedIndex(-1);
                                  setTimeout(() => stockRef.current?.focus(), 50);
                                }}
                              >
                                <span className={`font-bold text-sm ${accountFocusedIndex === accounts.indexOf(acc) ? 'text-amber-600' : 'text-slate-700'}`}>{acc.account_nm}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-end">
                    <div className="flex gap-2 w-[80px] flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setAccountForm({ institution: '', type: '' });
                          setIsAccountTypeDropdownOpen(false);
                          setIsAccountModalOpen(true);
                          setIsAccountDropdownOpen(false);
                        }}
                        className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all inline-flex items-center justify-center cursor-pointer"
                        title="계좌 추가"
                      >
                        <Plus size={20} />
                      </button>
                      <button
                        type="button"
                        disabled={!formData.account}
                        onClick={() => {
                          if (formData.account) {
                            setAccountDeleteConfirm({ isOpen: true, name: formData.account });
                          }
                        }}
                        className={`p-2 transition-all inline-flex items-center justify-center rounded-xl ${formData.account
                            ? 'text-red-500 hover:text-red-600 hover:bg-red-50 cursor-pointer'
                            : 'text-slate-200 cursor-not-allowed'
                          }`}
                        title="계좌 삭제"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-bold text-slate-500 mb-1.5 ml-1">종목</label>
                <div className="flex gap-2">
                  <div className="relative flex-1" ref={stockDropdownRef}>
                    {formData.security_id ? (
                      <div
                        onClick={() => {
                          setFormData(prev => ({ ...prev, security_id: '', stock: prev.stock ? prev.stock.replace(`[${prev.stockCode}] `, '') : '' }));
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
                        className="w-full pl-4 pr-10 py-1 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700 text-center flex items-center justify-center cursor-pointer transition-all hover:border-brand min-h-[48px] py-1.5 box-border shadow-sm hover:bg-white"
                      >
                        <span className="w-full break-all leading-tight text-sm block">
                          {formData.stock.replace(`[${formData.stockCode}] `, '')}
                          <span className="text-[12px] text-slate-400 font-medium tracking-tight ml-1">({formData.stockCode})</span>
                        </span>
                      </div>
                    ) : (
                      <input
                        ref={stockRef}
                        type="text" placeholder="종목명 입력 (엔터로 검색)"
                        value={formData.stock}
                        onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value.toUpperCase(), security_id: '' }))}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (isStockDropdownOpen && stockFocusedIndex >= 0 && searchedStocks[stockFocusedIndex]) {
                              const stock = searchedStocks[stockFocusedIndex];
                              setFormData(prev => ({
                                ...prev,
                                security_id: stock.security_id,
                                stock: `[${stock.code}] ${stock.name}`,
                                stockCode: stock.code,
                                currency: stock.currency || prev.currency,
                                dividendAmount: '0'
                              }));
                              setIsStockDropdownOpen(false);
                              setStockFocusedIndex(-1);
                              setTimeout(() => priceRef.current?.focus(), 50);
                            } else {
                              setIsSearchingStock(true);
                              setIsStockDropdownOpen(true);
                              setStockFocusedIndex(-1);
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
                                const currencyOrder = (c) => c === 'KRW' ? 0 : c === 'USD' ? 1 : 2;
                                const sorted = [...results].sort((a, b) => currencyOrder(a.currency) - currencyOrder(b.currency));
                                setSearchedStocks(sorted);
                                if (sorted.length > 0) setStockFocusedIndex(0);
                              } catch (err) {
                                console.error(err);
                                setSearchedStocks([]);
                              } finally {
                                setIsSearchingStock(false);
                              }
                            }
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            if (!isStockDropdownOpen) {
                              setIsStockDropdownOpen(true);
                              setStockFocusedIndex(0);
                            } else {
                              setStockFocusedIndex(prev => Math.min(prev + 1, searchedStocks.length - 1));
                            }
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            if (isStockDropdownOpen) {
                              setStockFocusedIndex(prev => Math.max(prev - 1, 0));
                            }
                          } else if (e.key === 'Escape') {
                            setIsStockDropdownOpen(false);
                            setStockFocusedIndex(-1);
                          }
                        }}
                        className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-100 focus:outline-none focus:border-brand transition-all font-bold text-slate-700 text-center h-12 box-border bg-slate-50 shadow-sm"
                      />
                    )}
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                      onClick={async () => {
                        const next = !isStockDropdownOpen;
                        if (next) {
                          setIsSearchingStock(true);
                          setIsStockDropdownOpen(true);
                          try {
                            let searchTerm = formData.stock ? formData.stock.trim() : '';
                            // [코드] 명 양식인 경우 파싱하여 검색
                            const match = searchTerm.match(/\[(.*?)\]/);
                            if (match && match[1]) {
                              searchTerm = match[1];
                            } else {
                              const parts = searchTerm.split('] ');
                              if (parts.length > 1) searchTerm = parts[1];
                            }
                            // 배당 페이지는 국내/해외 모든 종목을 조회할 수 있도록 null 전달
                            const results = await TransactionManager.searchStocksByName(searchTerm, null);
                            const currencyOrder = (c) => c === 'KRW' ? 0 : c === 'USD' ? 1 : 2;
                            const sorted = [...results].sort((a, b) => currencyOrder(a.currency) - currencyOrder(b.currency));
                            setSearchedStocks(sorted);
                          } catch {
                            setSearchedStocks([]);
                          } finally {
                            setIsSearchingStock(false);
                          }
                        } else {
                          setIsStockDropdownOpen(false);
                        }
                      }}
                    >
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                    {isStockDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 w-full bg-white border border-slate-100 rounded-xl shadow-lg z-10">
                        <div ref={stockListRef} className="py-2 max-h-[286px] overflow-y-auto block overflow-x-hidden">
                          {isSearchingStock ? (
                            <div className="px-4 py-3 text-sm text-slate-400 text-center">검색 중...</div>
                          ) : searchedStocks.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-slate-400 text-center">검색 결과가 없습니다</div>
                          ) : (
                            searchedStocks.map((stock) => (
                              <button
                                key={stock.security_id || stock.code}
                                type="button"
                                className={`w-full px-4 py-3 text-left transition-colors flex items-center cursor-pointer ${stockFocusedIndex === searchedStocks.indexOf(stock) ? 'bg-amber-50 text-amber-600' : 'hover:bg-slate-50'
                                  }`}
                                onMouseEnter={() => setStockFocusedIndex(searchedStocks.indexOf(stock))}
                                onClick={() => {
                                  setFormData(prev => ({
                                    ...prev,
                                    security_id: stock.security_id,
                                    stock: `[${stock.code}] ${stock.name}`,
                                    stockCode: stock.code,
                                    currency: stock.currency || prev.currency,
                                    dividendAmount: '0'
                                  }));
                                  setIsStockDropdownOpen(false);
                                  setStockFocusedIndex(-1);
                                  setTimeout(() => priceRef.current?.focus(), 50);
                                }}
                              >
                                <span className={`font-semibold text-sm leading-tight break-words ${stockFocusedIndex === searchedStocks.indexOf(stock) ? 'text-amber-600' : 'text-slate-700'}`}>
                                  {stock.name} <span className={`text-[13px] font-medium tracking-tight ${stockFocusedIndex === searchedStocks.indexOf(stock) ? 'text-amber-400' : 'text-slate-400'}`}>({stock.code})</span>
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-end">
                    <div className="flex gap-2 w-[80px] flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setStockForm({ name: '', code: '', sector: '', currency: 'KRW', exchange_code: '' });
                          setIsSectorDropdownOpen(false);
                          setIsStockModalOpen(true);
                        }}
                        className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all inline-flex items-center justify-center cursor-pointer"
                        title="종목 추가"
                      >
                        <Plus size={20} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (formData.security_id) {
                            setStockDeleteConfirm({
                              isOpen: true,
                              id: formData.security_id,
                              name: formData.stock.replace(`[${formData.stockCode}] `, '')
                            });
                          }
                        }}
                        className={`p-2 transition-all inline-flex items-center justify-center rounded-xl ${formData.security_id
                          ? 'text-red-500 hover:text-red-600 hover:bg-red-50 cursor-pointer pointer-events-auto'
                          : 'text-slate-200 cursor-not-allowed opacity-50'
                          }`}
                        title="종목 삭제"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-500 mb-1.5 ml-1">배당금(분배금)</label>
                    <div className="relative">
                      <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-bold transition-colors ${formData.currency ? getCurrencyBadgeStyles(formData.currency).split(' ')[1] : 'text-slate-400'}`}>
                        {CURRENCIES[formData.currency]?.symbol || '$'}
                      </span>
                      <input
                        ref={priceRef}
                        type="text" placeholder="0"
                        value={formData.dividendAmount}
                        onChange={(e) => handleNumberInput(e, 'dividendAmount')}
                        onKeyDown={(e) => {
                          if (e.key === 'Tab' && e.shiftKey) {
                            e.preventDefault();
                            // 종목 클릭 시와 동일하게 수정 가능 모드로 전환
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
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-100 focus:outline-none focus:border-brand transition-all font-bold text-slate-700 text-right bg-slate-50 shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="flex-shrink-0 w-[80px] flex items-end">
                    <input
                      type="text"
                      disabled
                      value={formData.currency || 'USD'}
                      className={`w-full px-2 py-3 rounded-xl border font-bold text-center cursor-default transition-all shadow-sm ${getCurrencyBadgeStyles(formData.currency || 'USD')}`}
                    />
                  </div>
                </div>
              </div>

              <div className="col-span-2 mt-4 space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3 shadow-sm">
                  {formData.currency !== 'KRW' && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-500">환율</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          disabled
                          value={formData.exchangeRate}
                          className="w-32 px-3 py-2 rounded-xl border-none bg-slate-50 text-right font-bold text-slate-700 cursor-default focus:outline-none"
                        />
                        <span className="text-xs font-bold text-slate-400">{formData.currency} / KRW</span>
                      </div>
                    </div>
                  )}

                  <div className={`flex justify-end items-center ${formData.currency !== 'KRW' ? 'pt-3 border-t border-slate-100' : ''}`}>
                    <span className="hidden">배당금(원)</span>
                    <div className="text-right flex items-baseline gap-1.5">
                      <span className="text-3xl font-black text-brand tabular-nums">{formData.totalDividend}</span>
                      <span className="text-lg font-bold text-slate-400">원</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-2 mt-6 flex gap-3">
                <button
                  type="button" onClick={toggleModal}
                  className="flex-1 py-4 rounded-xl bg-slate-50 text-slate-600 font-bold hover:bg-slate-100 border border-slate-100 transition-all cursor-pointer shadow-sm"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 rounded-xl bg-brand text-white font-bold hover:bg-brand-dark shadow-lg shadow-brand/30 transition-all cursor-pointer focus:outline-none"
                >
                  {editingId ? '수정 완료' : '등록 완료'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alert Modal (Custom UI replacement for browser alert) */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
            onClick={closeAlert}
          ></div>
          <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 animate-slide-up text-center border border-slate-100">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${alertModal.type === 'success' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'
              }`}>
              {alertModal.type === 'success' ? <Check size={32} /> : <X size={32} />}
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">{alertModal.title}</h3>
            <p className="text-slate-500 mb-8 leading-relaxed whitespace-pre-line">{alertModal.message}</p>
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
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setDeleteConfirm({ isOpen: false, id: null })}
          ></div>
          <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 animate-slide-up text-center border border-slate-100">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">정말 삭제하시겠습니까?</h3>
            <p className="text-slate-500 mb-8 leading-relaxed">이 작업은 취소할 수 없습니다.<br />거래 내역에서 영구적으로 삭제됩니다.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, id: null })}
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
        </div>
      )}

      {isStockModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 1100 }}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsStockModalOpen(false)}></div>

          <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800">종목 추가</h3>
              <button onClick={() => setIsStockModalOpen(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-visible">
              <div className="space-y-4">
                <div className="flex gap-3 items-end">
                  <div className="flex-1 relative" ref={searchDropdownRef}>
                    <label className="block text-sm font-bold text-slate-500 mb-1.5 ml-1">종목명</label>
                    <input
                      type="text"
                      placeholder="우측에서 검색해주세요"
                      value={stockForm.name}
                      readOnly={!stockForm.name || stockForm.name === '검색 중...'}
                      onChange={(e) => setStockForm(prev => ({ ...prev, name: e.target.value }))}
                      onFocus={() => setIsNameFocused(true)}
                      onBlur={() => setIsNameFocused(false)}
                      ref={stockModalNameRef}
                      className={`w-full px-4 py-3 rounded-xl border focus:outline-none transition-all font-bold text-center box-border shadow-sm ${!stockForm.name || stockForm.name === '검색 중...'
                          ? 'bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed'
                          : `bg-slate-50 border-slate-100 text-slate-700 hover:border-brand/50 focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand/10 ${isNameFocused ? 'cursor-text' : 'cursor-pointer'}`
                        }`}
                    />
                    {isSearchDropdownOpen && stockSearchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-lg z-[60] py-2 max-h-[112px] overflow-y-auto">
                        {stockSearchResults.map((res, i) => (
                          <button
                            key={`${res.code}-${i}`}
                            type="button"
                            className="w-full px-4 py-2 hover:bg-slate-50 text-left transition-colors flex justify-between items-center group"
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
                            <span className="font-bold text-slate-700 group-hover:text-brand">{res.name}</span>
                            <span className="text-xs font-bold text-slate-400">[{res.code}]{['KOSPI', 'KOSDAQ', 'KONEX'].includes(res.market) ? '' : ` ${res.market}`}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="w-[140px]">
                    <label className="block text-sm font-bold text-slate-500 mb-1.5 ml-1">종목코드(티커)</label>
                    <input
                      type="text"
                      placeholder="입력(엔터)"
                      value={stockForm.code}
                      onChange={(e) => {
                        const transliterated = transliterateKOtoEN(e.target.value);
                        if (transliterated.length <= 6) {
                          setStockForm(prev => ({ ...prev, code: transliterated }));
                        }
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && stockForm.code) {
                          e.preventDefault();
                          try {
                            setIsSearchDropdownOpen(false);
                            setStockForm(prev => ({ ...prev, name: '검색 중...' }));

                            // To search globally (both domestic and overseas), pass no flags
                            const res = await fetch(`/api/stock-info?code=${stockForm.code}`);
                            const data = await res.json();

                            if (res.ok && data.results && data.results.length > 0) {
                              // 중복 종목코드 제거
                              const uniqueResults = data.results.reduce((acc, current) => {
                                const exists = acc.find(item => item.code === current.code);
                                if (!exists) {
                                  acc.push(current);
                                }
                                return acc;
                              }, []);

                              if (uniqueResults.length === 1) {
                                // Single result - fill immediately
                                const item = uniqueResults[0];
                                setStockForm({
                                  ...stockForm,
                                  name: item.name.replace(/\s*[㈜|주식|코스닥|코스피]\s*$/g, ''),
                                  code: item.code,
                                  exchange_code: item.exchange_code || ''
                                });
                              } else {
                                // Multiple results - show dropdown
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
                      className="w-full px-4 py-3 rounded-xl border border-slate-100 focus:outline-none focus:border-brand transition-all font-bold text-slate-700 text-center bg-slate-50 shadow-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-500 mb-1.5 ml-1">섹터</label>
                    <div className="relative" ref={sectorRef}>
                      <input
                        type="text"
                        readOnly
                        placeholder="섹터 선택"
                        value={stockForm.sector}
                        className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-200 focus:outline-none focus:border-brand transition-all font-medium text-slate-700 bg-slate-50 cursor-pointer text-center shadow-sm"
                        onClick={() => setIsSectorDropdownOpen(!isSectorDropdownOpen)}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex items-center pr-3"
                        onClick={() => setIsSectorDropdownOpen(!isSectorDropdownOpen)}
                      >
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isSectorDropdownOpen && (
                        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10">
                          <div className="py-2 max-h-[210px] overflow-y-auto">
                            {sectorOptions.map((sector) => (
                              <button
                                key={sector}
                                type="button"
                                className="w-full px-4 py-2 pt-3 text-sm hover:bg-slate-50 transition-colors text-center"
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
                  </div>

                  <div className="w-[140px] flex-shrink-0">
                    <label className="block text-sm font-bold text-slate-500 mb-1.5 ml-1">통화</label>
                    <div className="relative" ref={currencyRef}>
                      <input
                        type="text"
                        readOnly
                        placeholder="통화 선택"
                        value={stockForm.currency}
                        className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-200 focus:outline-none focus:border-brand transition-all font-medium text-slate-700 bg-slate-50 cursor-pointer text-center shadow-sm"
                        onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex items-center pr-3"
                        onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
                      >
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isCurrencyDropdownOpen && (
                        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10">
                          <div className="py-2 max-h-[210px] overflow-y-auto">
                            {['KRW', 'USD', 'EUR', 'JPY', 'GBP', 'CNY', 'HKD'].map((cur) => {
                              const getCurrencySymbol = (currency) => {
                                switch (currency) {
                                  case 'KRW': return '₩';
                                  case 'USD': return '$';
                                  case 'EUR': return '€';
                                  case 'GBP': return '£';
                                  case 'JPY': return '¥';
                                  case 'CNY': return '¥';
                                  case 'HKD': return 'HK$';
                                  default: return currency;
                                }
                              };
                              return (
                                <button
                                  key={cur}
                                  type="button"
                                  className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center"
                                  onClick={() => {
                                    setStockForm(prev => ({ ...prev, currency: cur }));
                                    setIsCurrencyDropdownOpen(false);
                                  }}
                                >
                                  <span className="font-semibold text-sm text-slate-700">
                                    {cur} ({getCurrencySymbol(cur)})
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsStockModalOpen(false)}
                  className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all cursor-pointer shadow-sm"
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

                    // 중복 체크
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
                        currency: stockForm.currency,
                        exchange_code: stockForm.exchange_code || ''
                      });

                      // 신규 등록된 종목 자동 선택
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
                  className="flex-1 py-4 rounded-xl bg-brand text-white font-bold hover:bg-brand-dark transition-all shadow-sm cursor-pointer"
                >
                  등록
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Account Registration Modal */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsAccountModalOpen(false)}></div>

          <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800">등록</h3>
              <button onClick={() => setIsAccountModalOpen(false)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-visible">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1.5 ml-1">금융기관</label>
                  <input
                    type="text"
                    placeholder="금융기관 입력"
                    value={accountForm.institution}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, institution: e.target.value }))}
                    ref={institutionRef}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-brand transition-all font-medium text-slate-700 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1.5 ml-1">계좌구분</label>
                  <div className="relative" ref={accountTypeRef}>
                    <input
                      type="text"
                      readOnly
                      placeholder="구분 선택"
                      value={accountForm.type}
                      onChange={(e) => setAccountForm(prev => ({ ...prev, type: e.target.value.toUpperCase() }))}
                      ref={accountTypeInputRef}
                      className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-200 focus:outline-none focus:border-brand transition-all font-medium text-slate-700 bg-slate-50 cursor-pointer text-center shadow-sm"
                      onClick={() => setIsAccountTypeDropdownOpen(!isAccountTypeDropdownOpen)}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3"
                      onClick={() => setIsAccountTypeDropdownOpen(!isAccountTypeDropdownOpen)}
                    >
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    {/* 구분 드롭다운 메뉴 */}
                    {isAccountTypeDropdownOpen && (
                      <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10">
                        <div className="py-2 max-h-50 overflow-y-auto block overflow-x-hidden">
                          {['일반', 'ISA', 'IRP', 'DC', '연금저축', '기타'].map((type) => (
                            <button
                              key={type}
                              type="button"
                              className="w-full px-5 py-2 text-center hover:bg-slate-50 transition-colors"
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

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all cursor-pointer shadow-sm"
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
                      const newAccount = await TransactionManager.addAccount({
                        financial_institution: accountForm.institution.trim(),
                        type: accountForm.type.trim(),
                        account_nm: combined
                      });
                      if (newAccount) {
                        setFormData(prev => ({ ...prev, account: newAccount.account_nm, account_id: newAccount.account_id }));

                        await refreshAccounts();
                        setIsAccountModalOpen(false);
                        showAlert("등록 완료", "계좌가 성공적으로 등록되었습니다.", "success");
                      }
                    } catch (error) {
                      showAlert("오류", error.message || "계좌 등록 중 문제가 발생했습니다.", "error");
                    }
                  }}
                  className="flex-1 py-4 rounded-xl bg-brand text-white font-bold hover:bg-brand-dark transition-all shadow-sm cursor-pointer"
                >
                  등록
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Account Delete Confirmation Modal */}
      {accountDeleteConfirm.isOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setAccountDeleteConfirm({ isOpen: false, name: '' })}></div>
          <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 animate-slide-up text-center border border-slate-100">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">계좌를 삭제하시겠습니까?</h3>
            <p className="text-slate-500 mb-6 leading-relaxed">
              <span className="font-bold text-slate-700">&quot;{accountDeleteConfirm.name}&quot;</span> 계좌 정보가 삭제됩니다.
            </p>
            <p className="text-xs text-rose-400 mb-8 leading-relaxed">이 작업은 취소할 수 없으며, 거래 내역이 있는 경우 삭제가 제한될 수 있습니다.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setAccountDeleteConfirm({ isOpen: false, name: '' })}
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
        </div>
      )}

      {/* Stock Delete Confirmation Modal */}
      {stockDeleteConfirm.isOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setStockDeleteConfirm({ isOpen: false, id: null, name: '' })}
          ></div>
          <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 animate-slide-up text-center border border-slate-100">
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
                onClick={() => setStockDeleteConfirm({ isOpen: false, id: null, name: '' })}
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
        </div>
      )}

      {/* 조회 필터 모달 */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsFilterModalOpen(false)}
          ></div>
          <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Filter size={20} className="text-indigo-600" />
                <h3 className="text-xl font-bold text-slate-800">조회 조건</h3>
              </div>
              <button 
                onClick={() => setIsFilterModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X size={24} />
              </button>
            </div>

            {/* Filter Body */}
            <div className="p-6 flex-1 overflow-visible">
              <div className="space-y-4">
                {/* 기간 선택 */}
                <div className="relative z-20">
                  <label className="block text-sm font-bold text-slate-500 mb-1.5 ml-1">기간</label>
                  <div className="space-y-3 w-[320px]">
                    <div className="flex items-center gap-2 w-full">
                      <div className="relative flex-1">
                        <input 
                          ref={filterDateFromRef}
                          type="text" 
                          placeholder="YYMMDD"
                          value={tempFilters.dateFrom}
                          onChange={(e) => handleFilterDateChange('dateFrom', e.target.value)}
                          onFocus={(e) => {
                            handleFilterDateFocus('dateFrom', e.target.value);
                            setTimeout(() => e.target.select(), 50);
                          }}
                          onBlur={(e) => handleFilterDateBlur(e, 'dateFrom', e.target.value, filterDateFromRef)}
                          className="w-full pl-16 pr-16 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-brand transition-all font-bold text-slate-700 bg-slate-50 shadow-sm placeholder:text-slate-400 text-center"
                        />
                        <button 
                          type="button"
                          onClick={() => setIsFilterFromCalendarOpen(!isFilterFromCalendarOpen)}
                          className="absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand transition-colors cursor-pointer flex items-center justify-center"
                          style={{ right: '16px' }}
                        >
                          <Calendar size={18} />
                        </button>
                        {isFilterFromCalendarOpen && (
                          <div ref={filterFromCalendarRef} className="absolute left-0 top-full mt-2 z-[100] bg-white rounded-2xl shadow-2xl border border-slate-100 p-3 animate-slide-up w-72">
                            <CalendarUI 
                              initialYear={tempFilters.dateFrom && typeof tempFilters.dateFrom === 'string' && tempFilters.dateFrom.includes('-') ? parseInt(tempFilters.dateFrom.substring(0, 4)) : new Date().getFullYear()}
                              initialMonth={tempFilters.dateFrom && typeof tempFilters.dateFrom === 'string' && tempFilters.dateFrom.includes('-') ? parseInt(tempFilters.dateFrom.substring(5, 7)) : (new Date().getMonth() + 1)}
                              onSelect={(y, m, d) => {
                                const formatted = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                                setTempFilters(prev => ({ ...prev, dateFrom: formatted }));
                                setIsFilterFromCalendarOpen(false);
                              }}
                            />
                          </div>
                        )}
                      </div>

                      <span className="text-slate-300 font-bold shrink-0">~</span>

                      <div className="relative flex-1">
                        <input 
                          ref={filterDateToRef}
                          type="text" 
                          placeholder="YYMMDD"
                          value={tempFilters.dateTo}
                          onChange={(e) => handleFilterDateChange('dateTo', e.target.value)}
                          onFocus={(e) => {
                            handleFilterDateFocus('dateTo', e.target.value);
                            setTimeout(() => e.target.select(), 50);
                          }}
                          onBlur={(e) => handleFilterDateBlur(e, 'dateTo', e.target.value, filterDateToRef)}
                          className="w-full pl-16 pr-16 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-brand transition-all font-bold text-slate-700 bg-slate-50 shadow-sm placeholder:text-slate-400 text-center"
                        />
                        <button 
                          type="button"
                          onClick={() => setIsFilterToCalendarOpen(!isFilterToCalendarOpen)}
                          className="absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand transition-colors cursor-pointer flex items-center justify-center"
                          style={{ right: '16px' }}
                        >
                          <Calendar size={18} />
                        </button>
                        {isFilterToCalendarOpen && (
                          <div ref={filterToCalendarRef} className="absolute right-0 top-full mt-2 z-[100] bg-white rounded-2xl shadow-2xl border border-slate-100 p-3 animate-slide-up w-72">
                            <CalendarUI 
                              initialYear={tempFilters.dateTo && typeof tempFilters.dateTo === 'string' && tempFilters.dateTo.includes('-') ? parseInt(tempFilters.dateTo.substring(0, 4)) : new Date().getFullYear()}
                              initialMonth={tempFilters.dateTo && typeof tempFilters.dateTo === 'string' && tempFilters.dateTo.includes('-') ? parseInt(tempFilters.dateTo.substring(5, 7)) : (new Date().getMonth() + 1)}
                              onSelect={(y, m, d) => {
                                const formatted = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                                setTempFilters(prev => ({ ...prev, dateTo: formatted }));
                                setIsFilterToCalendarOpen(false);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 w-full">
                      {[
                        { label: '1개월', months: 1 },
                        { label: '3개월', months: 3 },
                        { label: '6개월', months: 6 },
                        { label: '1년', months: 12 }
                      ].map((item) => (
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
                          }}
                          className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-500 text-[14px] font-bold hover:bg-brand/5 hover:text-brand transition-all border border-slate-200 cursor-pointer shadow-sm"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="relative" ref={filterTypeDropdownRef} style={{ width: '74px' }}>
                    <label className="block text-sm font-bold text-slate-500 mb-1.5 ml-1">구분</label>
                    <div className="relative">
                      <button 
                        type="button"
                        onClick={() => setIsFilterTypeDropdownOpen(!isFilterTypeDropdownOpen)}
                        className="w-full px-1 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-brand transition-all font-bold text-slate-700 bg-slate-50 cursor-pointer shadow-sm text-center flex items-center justify-center gap-1 min-h-[48px]"
                      >
                        <span className={`text-[14px] ${
                          tempFilters.type === '매수' ? 'text-rose-500' : 
                          tempFilters.type === '매도' ? 'text-blue-500' : 'text-slate-600'
                        }`}>
                          {tempFilters.type === '전체' ? '전체' : tempFilters.type}
                        </span>
                      </button>
                      {isFilterTypeDropdownOpen && (
                        <div className="absolute top-0 left-0 w-full bg-white border border-slate-200 shadow-2xl z-[70] overflow-hidden animate-slide-up" style={{ borderRadius: '12px' }}>
                          {['전체', '매수', '매도'].map(type => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                setTempFilters(prev => ({ ...prev, type }));
                                setIsFilterTypeDropdownOpen(false);
                              }}
                              className={`w-full px-1 py-3 text-[14px] font-bold text-center hover:bg-slate-50 transition-colors cursor-pointer ${
                                type === '매수' ? 'text-rose-500' : 
                                type === '매도' ? 'text-blue-500' : 'text-slate-600'
                              }`}
                              style={{ minHeight: '48px' }}
                            >
                              {type === '전체' ? '전체' : type}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 relative min-w-0" ref={filterStockDropdownRef}>
                    <label className="block text-sm font-bold text-slate-500 mb-1.5 ml-1">종목</label>
                    <div className="relative">
                      {tempFilters.security_id ? (
                        <div 
                          onClick={() => {
                            let nameToEdit = tempFilters.stockName.split('(')[0];
                            if (nameToEdit.length > 43) {
                              nameToEdit = nameToEdit.substring(0, 43);
                            }
                            setTempFilters(prev => ({ ...prev, security_id: '', stockName: nameToEdit }));
                            // 입력창으로 전환 후 바로 전체 선택되도록 잠시 후 포커스
                            setTimeout(() => {
                              const input = filterStockDropdownRef.current?.querySelector('input');
                              if (input) {
                                input.focus();
                                input.select();
                              }
                            }, 50);
                          }}
                          className="w-full px-2 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700 h-12 flex overflow-hidden items-center justify-center cursor-pointer shadow-sm group hover:bg-white hover:border-brand transition-all"
                        >
                          <span className="w-full break-words whitespace-normal leading-tight text-sm text-center pointer-events-none flex whitespace-pre-wrap shrink-0 h-full overflow-hidden items-center justify-center">
                            {tempFilters.stockName.split('(')[0]}
                            <span className="text-[12px] text-slate-400 font-medium tracking-tight ml-1 inline-block shrink-0">({tempFilters.stockCode})</span>
                          </span>
                        </div>
                      ) : (
                        <>
                          <input 
                            type="text" 
                            placeholder="종목명 입력 (엔터로 검색)"
                            value={tempFilters.stockName || ''}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase();
                              setTempFilters(prev => ({ ...prev, stockName: val, security_id: '', stockCode: '' }));
                            }}
                            onKeyDown={(e) => {
                              if (e.nativeEvent.isComposing) return;
                              if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                if (!isFilterStockDropdownOpen) {
                                  handleStockSearch(tempFilters.stockName);
                                } else {
                                  setStockFocusedIndex(prev => Math.min(prev + 1, stockSearchResults.length - 1));
                                }
                              } else if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                if (!isFilterStockDropdownOpen) {
                                  handleStockSearch(tempFilters.stockName);
                                } else {
                                  setStockFocusedIndex(prev => Math.max(prev - 1, 0));
                                }
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (isFilterStockDropdownOpen && stockFocusedIndex >= 0 && stockSearchResults[stockFocusedIndex]) {
                                  const selected = stockSearchResults[stockFocusedIndex];
                                  setTempFilters(prev => ({ 
                                    ...prev, 
                                    stockName: `${selected.name}(${selected.code})`,
                                    stockCode: selected.code,
                                    security_id: selected.security_id
                                  }));
                                  setIsFilterStockDropdownOpen(false);
                                } else {
                                  handleStockSearch(tempFilters.stockName);
                                }
                              } else if (e.key === 'Tab') {
                                if (isFilterStockDropdownOpen) {
                                  setIsFilterStockDropdownOpen(false);
                                }
                              } else if (e.key === 'Escape') {
                                setIsFilterStockDropdownOpen(false);
                              }
                            }}
                            className="w-full pl-2 pr-11 py-3 rounded-xl border border-slate-200 focus:bg-white focus:border-brand transition-all font-bold text-[14px] text-slate-700 bg-slate-50 shadow-sm text-center h-[48px] placeholder:text-slate-400"
                          />
                          <button 
                            type="button"
                            onClick={() => handleStockSearch(tempFilters.stockName)}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-brand transition-colors cursor-pointer"
                          >
                            <Search size={18} />
                          </button>
                        </>
                      )}
                      
                      {isFilterModalOpen && isFilterStockDropdownOpen && (isSearchingStock || stockSearchResults.length > 0) && (
                        <div className="absolute bottom-full left-0 right-0 z-[100] w-full mb-1.5">
                          <div className="bg-white border border-slate-200 shadow-2xl animate-slide-up flex flex-col pointer-events-auto" style={{ borderRadius: '14px', overflow: 'hidden' }}>
                            <div ref={filterStockListRef} className="overflow-y-auto overflow-x-hidden py-1 block" style={{ maxHeight: '240px' }}>
                              {isSearchingStock ? (
                                <div className="p-4 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                                  <div className="w-4 h-4 border-2 border-slate-200 border-t-brand rounded-full animate-spin"></div>
                                  <span>검색 중...</span>
                                </div>
                              ) : (
                                [...stockSearchResults].reverse().map((stock, i) => {
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
                                      }}
                                      onMouseEnter={() => setStockFocusedIndex(originalIndex)}
                                      className={`w-full min-h-[48px] h-[48px] flex-shrink-0 px-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors pointer-events-auto cursor-pointer ${
                                        originalIndex === stockFocusedIndex ? 'bg-amber-50' : ''
                                      }`}
                                    >
                                      <div className="flex flex-col">
                                        <span className={`text-[13px] font-bold leading-tight ${originalIndex === stockFocusedIndex ? 'text-amber-600' : 'text-slate-700'}`}>
                                          <span className="text-[10px] mr-1 text-indigo-500">{stock.currency === 'KRW' ? '[국내]' : '[해외]'}</span>
                                          {stock.name}
                                          <span className={`text-[12px] font-medium ml-1.5 ${originalIndex === stockFocusedIndex ? 'text-amber-600 opacity-60' : 'text-slate-400'}`}>
                                            ({stock.code})
                                          </span>
                                        </span>
                                      </div>
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded-lg ${originalIndex === stockFocusedIndex ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
                                        {stock.exchange_nm}
                                      </span>
                                    </button>
                                  );
                                })
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => {
                      const todayStr = new Date().toLocaleDateString('en-CA');
                      const oneMonthAgo = new Date();
                      oneMonthAgo.setMonth(new Date().getMonth() - 1);
                      const initial = {
                        dateFrom: oneMonthAgo.toLocaleDateString('en-CA'),
                        dateTo: todayStr,
                        type: '전체',
                        stockName: '',
                        stockCode: '',
                        security_id: ''
                      };
                      setTempFilters(initial);
                      setStockSearchResults([]);
                      setIsFilterStockDropdownOpen(false);
                      showAlert("조건 초기화", "팝업의 조회 조건이 초기화 되었습니다.", "success");
                    }}
                    className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all cursor-pointer shadow-sm"
                  >
                    초기화
                  </button>
                  <button
                    onClick={() => {
                      setActiveFilters({ ...tempFilters });
                      setIsFilterModalOpen(false);
                      setCurrentPage(1);
                      showAlert("필터 적용", "설정한 필터가 적용되었습니다.", "success");
                    }}
                    className="flex-1 py-4 rounded-xl bg-brand text-white font-bold hover:bg-brand-dark transition-all shadow-sm cursor-pointer"
                  >
                    적용
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
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

  const days = [];

  // padding previous month
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    days.push({ day: prevMonthDays - i, current: false });
  }

  // current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, current: true });
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="font-bold text-slate-700">{currentYear}년 {currentMonth + 1}월</span>
        <div className="flex gap-1">
          <button type="button" onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => changeMonth(1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map(d => (
          <span key={d} className="text-[10px] font-bold text-slate-400 uppercase">{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <button
            key={i}
            type="button"
            onClick={() => d.current && onSelect(currentYear, currentMonth + 1, d.day)}
            className={`h-8 rounded-lg text-sm font-medium transition-all ${d.current
              ? 'text-slate-700 hover:bg-brand hover:text-white'
              : 'text-slate-200 pointer-events-none'
              } ${d.current && d.day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear()
                ? 'bg-slate-100'
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
