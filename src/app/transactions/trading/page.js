"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Edit2, Trash2, Filter, RotateCcw, X, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check, ArrowLeftRight, Plus, Search, ChevronDown, PlusCircle, Wallet, ArrowUpDown, CheckCircle2, TrendingUp, Scale, Award, Coins } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAssets } from "@/contexts/AssetContext";
import { TransactionManager, TRANSACTION_TYPES, TRADE_TYPES } from "@/lib/transactionManager";
import { GUEST_DOMESTIC_TRANSACTIONS, GUEST_OVERSEAS_TRANSACTIONS } from "@/lib/guestMockData";
import MobileTransactionList from "@/app/components/mobile/MobileTransactionList";
import { useAnimatedModal } from "@/hooks/useAnimatedModal";
import TradingModal, { getStockType } from "./TradingModal";
import TradingFilterModal from "./TradingFilterModal";

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

// ── 금괴(Gold Bar) 전용 아이콘 ──
function GoldBarIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 금괴 윗면 (빛 반사 하이라이트) */}
      <path d="M5.5 8.5L8 6H16L18.5 8.5H5.5Z" fill="#FFFBEB" fillOpacity="0.95" />
      {/* 금괴 전면 */}
      <path d="M5.5 8.5H18.5L20 15H4L5.5 8.5Z" fill="#FEF08A" />
      {/* 금괴 하단/측면 베이스 */}
      <path d="M4 15H20L18 18.5H6L4 15Z" fill="#D97706" />
      {/* 외곽선 및 패싯 라인 */}
      <path d="M8 6H16L18.5 8.5L20 15L18 18.5H6L4 15L5.5 8.5L8 6Z" stroke="#78350F" strokeWidth="1.2" strokeLinejoin="round" />
      <line x1="5.5" y1="8.5" x2="18.5" y2="8.5" stroke="#78350F" strokeWidth="1" />
      <line x1="4" y1="15" x2="20" y2="15" stroke="#78350F" strokeWidth="1" />
      {/* 999.9 순금 각인 */}
      <text x="12" y="13" textAnchor="middle" fontSize="3.3" fontWeight="900" fill="#78350F" letterSpacing="0.4">999.9</text>
    </svg>
  );
}

// ── 로고 로드 실패 캐시 (실패한 URL은 다시 시도하지 않아 성능 저하 방지) ──
const failedImageUrls = new Set();

// ── 종목 로고 컴포넌트 ──
const StockLogo = React.memo(function StockLogo({ code, name, isKRW }) {
  const [hasError, setHasError] = useState(false);
  const cleanCode = (code || '').replace(/\.(KS|KQ|US|kospi|kosdaq)$/i, '').trim().toUpperCase();
  const isGold = (name || '').includes('금현물') || cleanCode === 'GOLD';

  if (isGold) {
    return (
      <div 
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 border border-amber-300 shadow-sm shadow-amber-500/20"
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

  const isETF = (name || '').toUpperCase().includes('ETF') ||
                /^(KODEX|TIGER|ACE|RISE|SOL|PLUS|KOSEF|ARIRANG|WOORI|TIMEFOLIO)/i.test(name || '');

  if (isFailed || hasError) {
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
        onError={() => {
          if (logoUrl) failedImageUrls.add(logoUrl);
          setHasError(true);
        }}
        className="w-full h-full object-cover rounded-xl"
        loading="lazy"
      />
    </div>
  );
});

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

const calculateAmountAndKRW = (qtyStr, priceStr, currency, rateStr) => {
  const qty = parseFloat((qtyStr || '').replace(/,/g, '')) || 0;
  const price = parseFloat((priceStr || '').replace(/,/g, '')) || 0;
  const isOverseas = currency && currency !== 'KRW';

  let amount = '';
  let totalKRW = '';

  if (qty > 0 && price > 0) {
    const total = qty * price;
    if (isOverseas) {
      // 해외 거래의 경우 소수점 2자리 포맷팅
      const fixedTotal = total.toFixed(2);
      const [intPart, decPart] = fixedTotal.split('.');
      amount = Number(intPart).toLocaleString('ko-KR') + "." + decPart;
    } else {
      // 국내 거래(KRW)이므로 소수점 없이 반올림 처리
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

// ── 고성능 종목 검색 입력 컴포넌트 (부모 5000줄 전체 리렌더링 차단 & 한글 IME 끊김/두두둑 버퍼링 완벽 해결) ──
const FastStockInput = React.memo(React.forwardRef(function FastStockInput(
  { value, onChange, onEnter, onTab, onArrowDown, onArrowUp, onEscape, className, placeholder },
  ref
) {
  const [localVal, setLocalVal] = useState(value || '');
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    setLocalVal(value || '');
  }, [value]);

  const handleChange = (e) => {
    const next = e.target.value.toUpperCase();
    setLocalVal(next);

    // 부모 대형 컴포넌트 리렌더링으로 인한 타이핑 렉 방지 (입력 멈춘 후 부모 동기화)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onChange(next);
    }, 250);
  };

  const handleBlur = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    onChange(localVal);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      onChange(localVal);
      if (onEnter) onEnter(e, localVal);
    } else if (e.key === 'Tab') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      onChange(localVal);
      if (onTab) onTab(e);
    } else if (e.key === 'ArrowDown') {
      if (onArrowDown) onArrowDown(e);
    } else if (e.key === 'ArrowUp') {
      if (onArrowUp) onArrowUp(e);
    } else if (e.key === 'Escape') {
      if (onEscape) onEscape(e);
    }
  };

  return (
    <input
      ref={ref}
      type="text"
      placeholder={placeholder}
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
    />
  );
}));

const FastFilterStockInput = React.memo(React.forwardRef(function FastFilterStockInput(
  { value, onChange, onEnter, onTab, onArrowDown, onArrowUp, onEscape, className, placeholder },
  ref
) {
  const [localVal, setLocalVal] = useState(value || '');
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    setLocalVal(value || '');
  }, [value]);

  const handleChange = (e) => {
    const next = e.target.value.toUpperCase();
    setLocalVal(next);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onChange(next);
    }, 250);
  };

  const handleBlur = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    onChange(localVal);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      onChange(localVal);
      if (onEnter) onEnter(e, localVal);
    } else if (e.key === 'Tab') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      onChange(localVal);
      if (onTab) onTab(e);
    } else if (e.key === 'ArrowDown') {
      if (onArrowDown) onArrowDown(e);
    } else if (e.key === 'ArrowUp') {
      if (onArrowUp) onArrowUp(e);
    } else if (e.key === 'Escape') {
      if (onEscape) onEscape(e);
    }
  };

  return (
    <input
      ref={ref}
      type="text"
      placeholder={placeholder}
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
    />
  );
}));

// ── 고성능 숫자 입력 컴포넌트 (수량, 단가 연속 고속 입력 시 밀림/버벅임 완벽 방지) ──
const FastNumberInput = React.memo(React.forwardRef(function FastNumberInput(
  { value, onChange, onBlur, onKeyDown, className, placeholder, inputMode = "numeric", isDecimal = false, maxLength = 12, ...props },
  ref
) {
  const [localVal, setLocalVal] = useState(value || '');
  const timerRef = useRef(null);

  useEffect(() => {
    setLocalVal(value || '');
  }, [value]);

  const handleChange = (e) => {
    let raw = e.target.value.replace(/,/g, '');
    let formatted = "";

    if (isDecimal) {
      if (/[^0-9.]/.test(raw)) return;
      const parts = raw.split('.');
      if (parts.length > 2) return;
      if (parts[1] && parts[1].length > 2) return;
      if (parts[0].length > maxLength) return;
      if (parts[0] !== "") {
        formatted = Number(parts[0]).toLocaleString('ko-KR');
      }
      if (raw.includes('.') || (parts[1] !== undefined)) {
        formatted += "." + (parts[1] || "");
      }
    } else {
      const digitsOnly = raw.replace(/[^\d]/g, '');
      if (digitsOnly.length > maxLength) return;
      formatted = digitsOnly === '' ? '' : Number(digitsOnly).toLocaleString('ko-KR');
    }

    // 1. 로컬 인풋 즉시 갱신 (0ms 지연 없음)
    setLocalVal(formatted);

    // 2. 부모 대형 컴포넌트 리렌더링 디바운스 (연속 빠른 입력 시 끊김 완벽 방지)
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange(formatted);
    }, 120);
  };

  const handleInputBlur = (e) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onChange(localVal);
    if (onBlur) onBlur(e);
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode={inputMode}
      placeholder={placeholder}
      value={localVal}
      onChange={handleChange}
      onBlur={handleInputBlur}
      onKeyDown={onKeyDown}
      className={className}
      {...props}
    />
  );
}));

export default function TransactionsPage() {

  const { user } = useAuth();
  const { refreshAssets, domesticTransactions, overseasTransactions, otherTransactions, isTransactionsLoading, refreshTransactions, accounts, accountNameById, isAccountsLoading, refreshAccounts } = useAssets();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
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
  const [stockMarketType, setStockMarketType] = useState('DOMESTIC'); // 'DOMESTIC' | 'OVERSEAS' | 'OTHER'
  const [isSectorDropdownOpen, setIsSectorDropdownOpen] = useState(false);
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({ institution: '', type: '일반' });
  const [stockForm, setStockForm] = useState({ name: '', code: '', sector: '', currency: 'KRW', exchange_code: '' });
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [isStockSubmitting, setIsStockSubmitting] = useState(false);

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
    if (typeof window === 'undefined') return;

    const isAnyModalOpen = isFilterMounted || isModalMounted || isStockMounted || isAccountMounted || alertMounted || deleteMounted || stockDeleteMounted || accountDeleteMounted;

    if (isAnyModalOpen) {
      // 팝업 열림 시: 모바일 바닥 화면 스크롤 잠금 및 상단(top: 0) 고정하여 키보드 호출 시 바닥 밀림 원천 차단
      document.body.style.overflow = 'hidden';
      if (window.innerWidth < 768) {
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.top = '0px';
      }
    } else {
      // 팝업 닫힘 시: 바닥 화면 고정 해제 후 최상단(0,0)으로 확실하게 복원
      const wasFixed = document.body.style.position === 'fixed';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      if (wasFixed || window.innerWidth < 768) {
        window.scrollTo(0, 0);
        setTimeout(() => window.scrollTo(0, 0), 30);
      }
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
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
  const accountTypeRef = useRef(null);
  const accountDropdownRef = useRef(null);
  const calendarRef = useRef(null);
  const calendarButtonRef = useRef(null);
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
  const typeDropdownRef = useRef(null);

  // ── 종목 추가 모달: 국내/해외/기타 마켓 전환 ──
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
      exchange_code: type === 'OTHER' ? 'KRX' : '',
      currency: type === 'OVERSEAS' ? (prev.currency === 'KRW' ? 'USD' : prev.currency || 'USD') : 'KRW'
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
    if (isStockSubmitting) return;

    if (!stockForm.name.trim()) {
      showAlert("입력 오류", "종목명을 입력해 주세요.", "error", stockModalNameRef);
      return;
    }
    if (!stockForm.code.trim()) {
      showAlert("입력 오류", stockMarketType === 'DOMESTIC' ? "종목코드를 입력해 주세요." : stockMarketType === 'OVERSEAS' ? "티커를 입력해 주세요." : "종목코드를 입력해 주세요.", "error", stockModalCodeRef);
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
    if (stockMarketType === 'OTHER' && !stockForm.currency.trim()) {
      stockForm.currency = 'KRW';
    }

    try {
      setIsStockSubmitting(true);
      const isDuplicate = await TransactionManager.checkStockDuplicate(
        stockForm.name.trim(),
        stockForm.code.trim()
      );
      if (isDuplicate) {
        showAlert("등록 오류", "이미 등록된 종목명 또는 종목코드입니다.", "error");
        return;
      }

      const isOther = stockMarketType === 'OTHER';
      const newStock = await TransactionManager.addStock({
        name: stockForm.name.trim(),
        code: stockForm.code.trim(),
        sector: stockForm.sector.trim(),
        currency: stockForm.currency.trim(),
        exchange_code: isOther ? 'OTHER' : (stockForm.exchange_code || ''),
        market_type: stockMarketType
      });

      if (newStock) {
        setFormData(prev => {
          const stockCur = newStock.currency || prev.currency;
          const { amount, totalKRW } = calculateAmountAndKRW(prev.quantity, prev.price, stockCur, prev.exchangeRate);
          return {
            ...prev,
            security_id: newStock.security_id || newStock.id,
            stock: `[${newStock.code}] ${newStock.name}`,
            stockCode: newStock.code,
            exchange_code: newStock.exchange_code || (isOther ? 'OTHER' : ''),
            market_type: newStock.market_type || stockMarketType,
            currency: stockCur,
            amount,
            totalKRW
          };
        });
      }

      setStockForm({ 
        name: '', 
        code: '', 
        sector: '', 
        currency: stockMarketType === 'OVERSEAS' ? 'USD' : 'KRW', 
        exchange_code: '' 
      });
      setIsStockModalOpen(false);
      showAlert("등록 완료", "종목이 성공적으로 등록되었습니다.", "success");
    } catch (error) {
      console.error('종목 등록 오류:', error);
      const errMsg = error?.message || error?.details || (typeof error === 'string' ? error : '종목 등록 중 오류가 발생했습니다.');
      showAlert("등록 오류", errMsg, "error");
    } finally {
      setIsStockSubmitting(false);
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



  // 국내/해외/기타 거래내역 통합 (게스트 모드 포함)
  const allTransactions = useMemo(() => {
    if (!user) return [];
    const dt = domesticTransactions || [];
    const ot = overseasTransactions || [];
    const other = otherTransactions || [];
    // 제목(종목명)이 누락된 불완전한 테스트 자료 자동 필터링
    return [...dt, ...ot, ...other].filter(tx => Boolean(tx.stock_name || tx.security?.name || tx.stock));
  }, [user, domesticTransactions, overseasTransactions, otherTransactions]);

  // 전역 상태가 변경되면 로컬 필터링용 데이터 업데이트
  useEffect(() => {
    setTransactions(allTransactions);
    setLoading(isTransactionsLoading);
  }, [allTransactions, isTransactionsLoading]);

  // 사용자 데이터 로드
  useEffect(() => {
    if (user) {
      if (domesticTransactions.length === 0 && overseasTransactions.length === 0 && (otherTransactions || []).length === 0) {
        refreshTransactions();
      }
    }
  }, [user, domesticTransactions.length, overseasTransactions.length, (otherTransactions || []).length]);

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
      // 1. 계좌 추가 모달 유형 드롭다운
      if (isAccountTypeDropdownOpen && accountTypeRef.current && !accountTypeRef.current.contains(event.target)) {
        setIsAccountTypeDropdownOpen(false);
      }
      // 2. 종목 추가 모달 섹터 드롭다운
      if (isSectorDropdownOpen && sectorRef.current && !sectorRef.current.contains(event.target)) {
        setIsSectorDropdownOpen(false);
      }
      // 3. 종목 추가 모달 통화 드롭다운
      if (isCurrencyDropdownOpen && currencyRef.current && !currencyRef.current.contains(event.target)) {
        setIsCurrencyDropdownOpen(false);
      }
      // 4. 종목 추가 모달 상단 검색창 드롭다운
      if (isSearchDropdownOpen && searchDropdownRef.current && !searchDropdownRef.current.contains(event.target)) {
        setIsSearchDropdownOpen(false);
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
    isAccountTypeDropdownOpen, isSectorDropdownOpen, 
    isCurrencyDropdownOpen, isSearchDropdownOpen
  ]);

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
    '정보기술',
    '금융',
    '헬스케어',
    '소재',
    '산업재',
    '에너지',
    '경기소비재',
    '필수소비재',
    '유틸리티',
    '통신서비스',
    '부동산',
    '리츠',
    '채권',
    '기타',
    'ETF 지수',
    'ETF 배당',
    'ETF 테마',
    'ETF 기타'
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

  const toggleModal = useCallback(() => {
    setEditingTransaction(null);
    setIsModalOpen(prev => !prev);
  }, []);

  const handleOpenRegister = useCallback(() => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  }, []);

  const handleEdit = useCallback((tx) => {
    setEditingTransaction(tx);
    setIsModalOpen(true);
  }, []);

  const handleSaveTransaction = async (data) => {
    const isKRWCurrency = (data.currency || 'KRW') === 'KRW';
    const qty = parseFloat((data.quantity || '0').replace(/,/g, ''));
    const price = isKRWCurrency
      ? Math.round(parseFloat((data.price || '0').replace(/,/g, '')))
      : parseFloat((data.price || '0').replace(/,/g, ''));
    const parsedAmount = parseFloat((data.amount || '').replace(/,/g, ''));
    const calcAmount = isKRWCurrency ? Math.round(qty * price) : Number((qty * price).toFixed(2));
    const amount = (!isNaN(parsedAmount) && parsedAmount > 0)
      ? (isKRWCurrency ? Math.round(parsedAmount) : parsedAmount)
      : calcAmount;

    let exchangeRate = 1;
    let exchangeTotalRate = amount;
    if (!isKRWCurrency) {
      exchangeRate = parseFloat((data.exchangeRate || '1').replace(/,/g, '')) || 1;
      exchangeTotalRate = Math.round((amount * exchangeRate) / 10) * 10;
    }

    const isOtherStock = getStockType(data) === 'OTHER' || data.transaction_type === 'other';
    const txType = isOtherStock 
      ? TRANSACTION_TYPES.OTHER 
      : (isKRWCurrency ? TRANSACTION_TYPES.DOMESTIC : TRANSACTION_TYPES.OVERSEAS);

    const rawStockName = (data.stock || '').replace(/\[.*?\]\s*/, '').trim();
    const transactionData = {
      transaction_type: txType,
      date: `${data.year}-${data.month.padStart(2, '0')}-${data.day.padStart(2, '0')}`,
      currency: data.currency || 'KRW',
      trade_type: data.type === '매수' ? TRADE_TYPES.BUY : TRADE_TYPES.SELL,
      quantity: qty,
      price: price,
      amount: amount,
      exchange_rate: exchangeRate,
      exchange_total_rate: exchangeTotalRate,
      account_id: data.selectedAccountId || accounts.find(a => a.account_nm === data.account)?.account_id,
      security_id: data.security_id || null,
      stock_name: rawStockName,
      stock_code: data.stockCode || '',
      stock: data.stock || '',
      security: {
        security_id: data.security_id,
        name: rawStockName,
        code: data.stockCode || '',
        currency: data.currency || 'KRW',
        exchange_code: data.exchange_code || (isOtherStock ? 'OTHER' : ''),
        market_type: isOtherStock ? 'OTHER' : (isKRWCurrency ? 'DOMESTIC' : 'OVERSEAS')
      }
    };

    if (data.editingId) {
      await TransactionManager.updateTransaction(data.editingId, { 
        ...transactionData,
        alt_sync: true 
      });
      await refreshTransactions();
      await refreshAssets();
      showAlert("수정 완료", "변경 내용이 반영되었습니다.", "success");
    } else {
      await TransactionManager.addTransaction(transactionData);
      await refreshTransactions();
      await refreshAssets();
      showAlert("등록 완료", "거래가 성공적으로 등록되었습니다.", "success");
    }
  };

  const handleApplyFilter = useCallback((filters) => {
    setActiveFilters(prev => ({
      ...prev,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      type: filters.type,
      stockName: filters.stockName,
      stockCode: filters.stockCode,
      security_id: filters.security_id,
      currencyFilter: filters.currencyFilter
    }));
    if (filters.currencyFilter) {
      setCurrencyFilter(filters.currencyFilter);
    }
    if (filters.type) {
      if (filters.type === '매수') setTradeTypeFilter('BUY');
      else if (filters.type === '매도') setTradeTypeFilter('SELL');
      else setTradeTypeFilter('ALL');
    }
    setCurrentPage(1);
  }, []);

  const handleDelete = useCallback((id) => {
    setDeleteConfirm({ isOpen: true, id });
  }, []);

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

  // 필터링 및 정렬된 거래 내역 (allTransactions로부터 즉시 계산하여 1회차 렌더 지연 완벽 제거)
  const filteredTransactions = useMemo(() => {
    let list = (allTransactions || []).filter(tx => {
      // 1. 거래구분 필터 (툴바 매수/매도 & 모달 필터)
      const isBuy = tx.trade_type === TRADE_TYPES.BUY || tx.trade_type === 'BUY' || tx.type === '매수';
      if (tradeTypeFilter === 'BUY' && !isBuy) return false;
      if (tradeTypeFilter === 'SELL' && isBuy) return false;
      if (activeFilters.type && activeFilters.type !== '전체') {
        const typeStr = isBuy ? '매수' : '매도';
        if (typeStr !== activeFilters.type) return false;
      }

      // 2. 거래유형(시장) 필터 (transactions 테이블 transaction_type 기준: domestic, overseas, other)
      const txType = (tx.transaction_type || '').toLowerCase();
      if (currencyFilter === 'KRW' || currencyFilter === 'DOMESTIC') {
        if (txType !== 'domestic') return false;
      } else if (currencyFilter === 'OVERSEAS') {
        if (txType !== 'overseas') return false;
      } else if (currencyFilter === 'OTHER') {
        if (txType !== 'other') return false;
      }

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

    // 거래유형(시장) 우선순위: 국내(1) -> 해외(2) -> 기타(3)
    const getMarketPriority = (tx) => {
      const type = (tx.transaction_type || '').toLowerCase();
      if (type === 'domestic') return 1;
      if (type === 'overseas') return 2;
      if (type === 'other') return 3;
      if (tx.currency === 'KRW' || !tx.currency) return 1;
      return 2;
    };

    // 정렬
    list.sort((a, b) => {
      if (sortBy === 'latest') {
        const dateDiff = (b.date || '').localeCompare(a.date || '');
        if (dateDiff !== 0) return dateDiff;
        const priorityDiff = getMarketPriority(a) - getMarketPriority(b);
        if (priorityDiff !== 0) return priorityDiff;
        return (b.id || 0) - (a.id || 0);
      }
      if (sortBy === 'oldest') {
        const dateDiff = (a.date || '').localeCompare(b.date || '');
        if (dateDiff !== 0) return dateDiff;
        const priorityDiff = getMarketPriority(a) - getMarketPriority(b);
        if (priorityDiff !== 0) return priorityDiff;
        return (a.id || 0) - (b.id || 0);
      }

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
  }, [allTransactions, activeFilters, currencyFilter, searchQuery, sortBy, tradeTypeFilter]);

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

  const isFilterActive = Boolean(
    inputDateFrom ||
    inputDateTo ||
    activeFilters.dateFrom ||
    activeFilters.dateTo ||
    (activeFilters.type && activeFilters.type !== '전체') ||
    activeFilters.stockName ||
    activeFilters.security_id ||
    currencyFilter !== 'ALL' ||
    tradeTypeFilter !== 'ALL' ||
    searchQuery.trim()
  );
  const isToolbarFilterActive = isFilterActive;

  const handleSelectCurrencyFilter = useCallback((val) => {
    setCurrencyFilter(val);
    setCurrentPage(1);
  }, []);

  const handleOpenFilter = useCallback(() => {
    setIsFilterModalOpen(true);
  }, []);

  const handleResetFilter = useCallback(() => {
    const initial = {
      dateFrom: '',
      dateTo: '',
      type: '전체',
      stockName: '',
      stockCode: '',
      security_id: '',
      currencyFilter: 'ALL'
    };
    setActiveFilters(initial);
    setInputDateFrom('');
    setInputDateTo('');
    setSearchQuery('');
    setCurrencyFilter('ALL');
    setTradeTypeFilter('ALL');
    setSortBy('latest');
    setStockSearchResults([]);
    setCurrentPage(1);
    showAlert('필터 초기화', '모든 필터 조건이 초기화되었습니다.', 'success');
  }, [showAlert]);

  const mobileTransactionView = useMemo(() => (
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
        currencyFilter={currencyFilter}
        onSelectCurrencyFilter={handleSelectCurrencyFilter}
        onOpenFilter={handleOpenFilter}
        onOpenRegister={handleOpenRegister}
        isFilterActive={isFilterActive}
        onResetFilter={handleResetFilter}
        onEdit={handleEdit}
        onDelete={handleDelete}
        accountNameById={accountNameById}
        formatCurrency={formatCurrency}
        getCurrencyStyle={getCurrencyStyle}
      />
    </div>
  ), [
    filteredTransactions,
    paginatedTransactions,
    loading,
    user,
    currentPage,
    totalPages,
    currencyFilter,
    handleSelectCurrencyFilter,
    handleOpenFilter,
    handleOpenRegister,
    isFilterActive,
    handleResetFilter,
    handleEdit,
    handleDelete,
    accountNameById
  ]);

  const desktopTransactionView = useMemo(() => (
    <div className="desktop-only h-full flex-col pb-0 animate-fade-in">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <ArrowLeftRight size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">거래내역</h1>
                {user && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-white px-3 py-1 rounded-xl border border-slate-200/80 shadow-2xs">
                    <CheckCircle2 size={13} className="text-slate-400" />
                    <span>총 <span className="font-bold text-slate-800">{filteredTransactions.length}건</span></span>
                  </div>
                )}
              </div>
              <p className="text-xs md:text-sm font-medium text-slate-500 mt-0.5">국내 · 해외 주식 매매 내역</p>
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
                    {currencyFilter === "OTHER" && (
                      <>체결수량 {summary.buyQtyKRW.toLocaleString('ko-KR')}g</>
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
                    {currencyFilter === "OTHER" && (
                      <>체결수량 {summary.sellQtyKRW.toLocaleString('ko-KR')}g</>
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
                        {currencyFilter === "OTHER" && (
                          <>매수금액 - 매도금액</>
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
                        총 {currencyFilter === "ALL" || currencyFilter === "OTHER" ? summary.totalTxCount : (summary.buyCountKRW + summary.sellCountKRW)}건
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
                      ) : currencyFilter === "OTHER" ? (
                        <>기타 총 {summary.totalTxCount}건 매매</>
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
                type="button"
                onClick={() => setCurrencyFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currencyFilter === "ALL" ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                전체
              </button>
              <button
                type="button"
                onClick={() => setCurrencyFilter("KRW")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currencyFilter === "KRW" ? 'bg-blue-500 text-white shadow-xs' : 'text-slate-500 hover:text-blue-600'
                }`}
              >
                국내
              </button>
              <button
                type="button"
                onClick={() => setCurrencyFilter("OVERSEAS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currencyFilter === "OVERSEAS" ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500 hover:text-amber-600'
                }`}
              >
                해외
              </button>
              <button
                type="button"
                onClick={() => setCurrencyFilter("OTHER")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currencyFilter === "OTHER" ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-500 hover:text-emerald-600'
                }`}
              >
                기타
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
                              {(() => {
                                const rowType = getStockType(tx);
                                return (
                                  <span
                                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 text-center leading-none ${
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
                        {Number(tx.quantity || 0).toLocaleString('ko-KR')}{(displayName || '').includes('금현물') || code === 'GOLD' ? 'g' : '주'}
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
  ), [
    filteredTransactions,
    paginatedTransactions,
    loading,
    user,
    summary,
    currencyFilter,
    tradeTypeFilter,
    isFilterPanelOpen,
    isFilterPanelMounted,
    isFilterPanelClosing,
    searchQuery,
    sortBy,
    isSortDropdownOpen,
    isToolbarFromCalendarOpen,
    isToolbarToCalendarOpen,
    currentPage,
    totalPages,
    startPage,
    endPage,
    activeFilters,
    inputDateFrom,
    inputDateTo,
    isToolbarFilterActive,
    accountNameById,
    handleEdit,
    handleDelete,
    toggleModal
  ]);

  return (
    <div className="animate-fade-in text-slate-900">
      {/* Mobile Transaction View */}
      {mobileTransactionView}

      {/* Desktop Transaction View */}
      {desktopTransactionView}

      {/* Add Transaction Modal */}
      <TradingModal
        isOpen={isModalMounted}
        isClosing={isModalClosing}
        onClose={() => setIsModalOpen(false)}
        editingTransaction={editingTransaction}
        accounts={accounts}
        accountNameById={accountNameById}
        isAccountsLoading={isAccountsLoading}
        currencyFilter={currencyFilter}
        onSave={handleSaveTransaction}
        onOpenAddAccount={() => {
          setAccountForm({ institution: '', type: '일반' });
          setIsAccountTypeDropdownOpen(false);
          setIsAccountModalOpen(true);
        }}
        onDeleteAccount={(accName) => setAccountDeleteConfirm({ isOpen: true, name: accName })}
        onOpenAddStock={(ctx) => {
          setStockMarketType(ctx.marketType);
          setStockForm({
            name: '',
            code: '',
            sector: '',
            currency: ctx.currency,
            exchange_code: ''
          });
          setStockSearchResults([]);
          setIsSearchDropdownOpen(false);
          setIsSectorDropdownOpen(false);
          setIsCurrencyDropdownOpen(false);
          setIsStockModalOpen(true);
        }}
        onDeleteStock={(secId, name) => setStockDeleteConfirm({ isOpen: true, id: secId, name })}
        showAlert={showAlert}
      />

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
                  stockMarketType === 'DOMESTIC' ? 'bg-blue-50 text-blue-600' : stockMarketType === 'OVERSEAS' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
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
              {/* 1. 국내 / 해외 / 기타 선택 세그먼트 버튼 (높이 및 바닥화면 테마 색상 적용) */}
              <div className="grid grid-cols-3 p-1.5 bg-slate-100/90 rounded-2xl gap-1.5">
                <button
                  type="button"
                  onClick={() => handleStockMarketTypeChange('DOMESTIC')}
                  className={`h-11 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
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
                  className={`h-11 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    stockMarketType === 'OVERSEAS'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-500 hover:text-amber-600 font-bold'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${stockMarketType === 'OVERSEAS' ? 'bg-white' : 'bg-slate-300'}`} />
                  해외 종목
                </button>
                <button
                  type="button"
                  onClick={() => handleStockMarketTypeChange('OTHER')}
                  className={`h-11 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    stockMarketType === 'OTHER'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-slate-500 hover:text-emerald-600 font-bold'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${stockMarketType === 'OTHER' ? 'bg-white' : 'bg-slate-300'}`} />
                  기타 종목
                </button>
              </div>

              {/* 2. 종목코드(티커) & 종목명 (기타 마켓일 경우 종목명 좌측, 종목코드 우측으로 위치 교체 및 직접 입력) */}
              {stockMarketType === 'OTHER' ? (
                <div className="grid grid-cols-5 gap-3 items-end">
                  {/* 종목명 (좌측 3칸) */}
                  <div className="col-span-3 relative">
                    <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">종목명</label>
                    <input
                      type="text"
                      placeholder="예 : KRX 금현물 등"
                      value={stockForm.name}
                      onChange={(e) => setStockForm(prev => ({ ...prev, name: e.target.value }))}
                      ref={stockModalNameRef}
                      className="w-full h-12 px-3.5 rounded-2xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 font-bold text-xs text-center text-slate-800 shadow-xs transition-all placeholder:text-center placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs"
                    />
                  </div>

                  {/* 종목코드 (우측 2칸) */}
                  <div className="col-span-2 relative">
                    <label className="block text-xs font-black text-slate-600 tracking-tight ml-0.5 mb-1.5">종목코드</label>
                    <input
                      type="text"
                      placeholder="GOLD"
                      value={stockForm.code}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setStockForm(prev => ({ ...prev, code: val }));
                      }}
                      ref={stockModalCodeRef}
                      className="w-full h-12 px-3 rounded-2xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 font-bold text-xs text-center text-slate-800 shadow-xs transition-all placeholder:text-center placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs uppercase"
                    />
                  </div>
                </div>
              ) : (
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
              )}

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
                  ) : stockMarketType === 'OTHER' ? (
                    <div className="w-full h-12 px-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 flex items-center justify-center shadow-xs cursor-default">
                      <span className="text-center text-xs font-bold text-emerald-600 tracking-tight flex items-center justify-center gap-1">
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-bold">₩</span> KRW
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
                  ) : stockMarketType === 'OVERSEAS' ? (
                    <>
                      <strong className="text-slate-700 font-bold">해외 종목:</strong> 영문 티커(예: AAPL) 입력 후 <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-600">Enter</kbd>를 누르면 종목명이 조회됩니다.
                    </>
                  ) : (
                    <>
                      <strong className="text-slate-700 font-bold">기타 종목:</strong> 금현물 등 자산의 종목명, 종목코드, 섹터 입력 후 등록합니다.
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
                  disabled={isStockSubmitting}
                  onClick={handleAddStockSubmit}
                  className={`flex-1 h-12 rounded-2xl text-white font-bold text-sm transition-all shadow-md ${
                    isStockSubmitting
                      ? 'bg-slate-300 text-white cursor-not-allowed'
                      : stockMarketType === 'DOMESTIC'
                        ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25 cursor-pointer'
                        : stockMarketType === 'OVERSEAS'
                          ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/25 cursor-pointer'
                          : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25 cursor-pointer'
                  }`}
                >
                  {isStockSubmitting ? '처리 중...' : '등록'}
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
      {/* Filter Modal */}
      <TradingFilterModal
        isOpen={isFilterMounted}
        isClosing={isFilterClosing}
        onClose={() => setIsFilterModalOpen(false)}
        activeFilters={activeFilters}
        currencyFilter={currencyFilter}
        tradeTypeFilter={tradeTypeFilter}
        onApply={handleApplyFilter}
      />
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
