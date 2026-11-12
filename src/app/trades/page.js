"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Briefcase,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Coins,
  Wallet,
  CheckCircle2,
  ChevronDown,
  ArrowUpDown,
  Check,
  RotateCcw
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { TransactionManager } from "@/lib/transactionManager";
import MobileDividendDashboard from "@/app/components/mobile/MobileDividendDashboard";
import { useAnimatedModal } from "@/hooks/useAnimatedModal";

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

// ── 상단 요약 카드 숫자 롤링 카운터 (배당금 차트와 동일한 easeOutQuart 800ms 효과) ──
function AnimatedTradeCounter({
  value,
  isForeign = false,
  showSign = false,
  duration = 800
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);
  const prevIsForeignRef = useRef(isForeign);
  const hasAnimatedInitialRef = useRef(false);

  useEffect(() => {
    const endVal = Number(value) || 0;
    // 최초 진입 시 또는 통화 단위 변경 시(KRW <-> USD) 0부터 롤링 시작
    const shouldStartFromZero = !hasAnimatedInitialRef.current || prevIsForeignRef.current !== isForeign;
    const startVal = shouldStartFromZero
      ? 0
      : (Number(prevValueRef.current) || 0);

    // 아직 데이터 로딩 전이라 endVal이 0이고 startVal도 0이면 대기
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
      // easeOutQuart
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


// ── 매매손익 샘플 데이터 (게스트 및 로컬 확인용) ──
const SAMPLE_TRADE_DATA = [
  {
    name: "삼성전자",
    code: "005930",
    currency: "KRW",
    quantity: 100,
    avgBuyPrice: 68000,
    avgSellPrice: 72500,
    realizedProfit: 450000,
    realizedRate: 6.62,
    dividend: 0,
    totalRealizedProfit: 450000,
  },
  {
    name: "애플",
    code: "AAPL",
    currency: "USD",
    quantity: 30,
    avgBuyPrice: 229500, // 원화 환산 매수가
    avgSellPrice: 244688,
    foreignAvgBuyPrice: 170.00,
    foreignAvgSellPrice: 181.25,
    realizedProfit: 450000,
    foreignRealizedProfit: 335.80,
    realizedRate: 6.62,
    dividend: 0,
    foreignDividend: 0,
    totalRealizedProfit: 450000,
    foreignTotalRealizedProfit: 335.80,
  },
  {
    name: "SK하이닉스",
    code: "000660",
    currency: "KRW",
    quantity: 30,
    avgBuyPrice: 175000,
    avgSellPrice: 192000,
    realizedProfit: 510000,
    realizedRate: 9.71,
    dividend: 0,
    totalRealizedProfit: 510000,
  },
  {
    name: "엔비디아",
    code: "NVDA",
    currency: "USD",
    quantity: 40,
    avgBuyPrice: 151875,
    avgSellPrice: 170708,
    foreignAvgBuyPrice: 112.50,
    foreignAvgSellPrice: 126.45,
    realizedProfit: 645000,
    foreignRealizedProfit: 481.30,
    realizedRate: 12.40,
    dividend: 28000,
    foreignDividend: 20.90,
    totalRealizedProfit: 673000,
    foreignTotalRealizedProfit: 502.20,
  },
  {
    name: "테슬라",
    code: "TSLA",
    currency: "USD",
    quantity: 15,
    avgBuyPrice: 334800,
    avgSellPrice: 320895,
    foreignAvgBuyPrice: 248.00,
    foreignAvgSellPrice: 237.70,
    realizedProfit: -148000,
    foreignRealizedProfit: -110.40,
    realizedRate: -4.15,
    dividend: 0,
    foreignDividend: 0,
    totalRealizedProfit: -148000,
    foreignTotalRealizedProfit: -110.40,
  },
  {
    name: "현대차",
    code: "005380",
    currency: "KRW",
    quantity: 20,
    avgBuyPrice: 220000,
    avgSellPrice: 245000,
    realizedProfit: 500000,
    realizedRate: 11.36,
    dividend: 0,
    totalRealizedProfit: 500000,
  },
  {
    name: "마이크로소프트",
    code: "MSFT",
    currency: "USD",
    quantity: 10,
    avgBuyPrice: 553500,
    avgSellPrice: 598860,
    foreignAvgBuyPrice: 410.00,
    foreignAvgSellPrice: 443.60,
    realizedProfit: 391000,
    foreignRealizedProfit: 291.80,
    realizedRate: 8.20,
    dividend: 35000,
    foreignDividend: 26.10,
    totalRealizedProfit: 426000,
    foreignTotalRealizedProfit: 317.90,
  },
  {
    name: "TIGER 미국배당다우존스",
    code: "458730",
    currency: "KRW",
    quantity: 500,
    avgBuyPrice: 10300,
    avgSellPrice: 10900,
    realizedProfit: 320000,
    realizedRate: 5.80,
    dividend: 0,
    totalRealizedProfit: 320000,
  },
  {
    name: "PLUS 고배당주",
    code: "161510",
    currency: "KRW",
    quantity: 400,
    avgBuyPrice: 12200,
    avgSellPrice: 13400,
    realizedProfit: 460000,
    realizedRate: 9.79,
    dividend: 0,
    totalRealizedProfit: 460000,
  },
  {
    name: "NAVER",
    code: "035420",
    currency: "KRW",
    quantity: 20,
    avgBuyPrice: 194000,
    avgSellPrice: 202000,
    realizedProfit: 135000,
    realizedRate: 4.12,
    dividend: 0,
    totalRealizedProfit: 135000,
  },
  {
    name: "카카오",
    code: "035720",
    currency: "KRW",
    quantity: 70,
    avgBuyPrice: 43500,
    avgSellPrice: 42500,
    realizedProfit: -68000,
    realizedRate: -2.30,
    dividend: 0,
    totalRealizedProfit: -68000,
  },
  {
    name: "기아",
    code: "000270",
    currency: "KRW",
    quantity: 40,
    avgBuyPrice: 94000,
    avgSellPrice: 102000,
    realizedProfit: 295000,
    realizedRate: 8.40,
    dividend: 0,
    totalRealizedProfit: 295000,
  },
];

// ── view_closed_trades_pnl 뷰 정규화 함수 ──
const normalizeTradeItem = (row) => {
  if (!row) return null;
  const isFromView = row['종목'] !== undefined || row['종목코드'] !== undefined;

  const name = isFromView ? (row['종목'] || '') : (row.name || '');
  const code = isFromView ? (row['종목코드'] || '') : (row.code || '');
  const currency = (isFromView ? row['통화'] : row.currency) || 'KRW';
  const isKRW = currency === 'KRW';
  const quantity = Number(isFromView ? row['수량'] : row.quantity) || 100;
  const sector = (isFromView ? row['섹터'] : row.sector) || '';

  // 원화 수치
  const avgBuyPrice = Number(isFromView ? row['평균매수_원화'] : row.avgBuyPrice) || 0;
  const avgSellPrice = Number(isFromView ? row['평균매도_원화'] : row.avgSellPrice) || 0;
  const realizedProfit = Number(isFromView ? row['손익_원화'] : row.realizedProfit) || 0;
  const dividend = Number(isFromView ? row['배당_원화'] : row.dividend) || 0;
  const totalRealizedProfit = Number(isFromView ? row['총손익_원화'] : (row.totalRealizedProfit ?? (realizedProfit + dividend))) || 0;

  const profitRate = isFromView && row['수익률_원화'] !== undefined && row['수익률_원화'] !== null
    ? Number(row['수익률_원화'])
    : (avgBuyPrice > 0 ? ((avgSellPrice - avgBuyPrice) / avgBuyPrice) * 100 : (Number(row.realizedRate) || 0));

  const totalRate = isFromView && row['총수익률_원화'] !== undefined && row['총수익률_원화'] !== null
    ? Number(row['총수익률_원화'])
    : (avgBuyPrice * quantity > 0 ? (totalRealizedProfit / (avgBuyPrice * quantity)) * 100 : profitRate);

  // 외화 수치
  const foreignAvgBuyPrice = Number(isFromView ? row['평균매수_외화'] : (row.foreignAvgBuyPrice ?? row.avgBuyPrice)) || 0;
  const foreignAvgSellPrice = Number(isFromView ? row['평균매도_외화'] : (row.foreignAvgSellPrice ?? row.avgSellPrice)) || 0;
  const foreignRealizedProfit = Number(isFromView ? row['손익_외화'] : row.foreignRealizedProfit) || 0;
  const foreignDividend = Number(isFromView ? row['배당_외화'] : row.foreignDividend) || 0;
  const foreignTotalRealizedProfit = Number(isFromView ? row['총손익_외화'] : (row.foreignTotalRealizedProfit ?? (foreignRealizedProfit + foreignDividend))) || 0;

  const foreignProfitRate = isFromView && row['수익률_외화'] !== undefined && row['수익률_외화'] !== null
    ? Number(row['수익률_외화'])
    : (foreignAvgBuyPrice > 0 ? ((foreignAvgSellPrice - foreignAvgBuyPrice) / foreignAvgBuyPrice) * 100 : profitRate);

  const foreignTotalRate = isFromView && row['총수익률_외화'] !== undefined && row['총수익률_외화'] !== null
    ? Number(row['총수익률_외화'])
    : (foreignAvgBuyPrice * quantity > 0 ? (foreignTotalRealizedProfit / (foreignAvgBuyPrice * quantity)) * 100 : foreignProfitRate);

  const buyCostKRW = avgBuyPrice * quantity;
  const buyCostForeign = foreignAvgBuyPrice * quantity;

  return {
    raw: row,
    name,
    code,
    currency,
    isKRW,
    quantity,
    sector,

    // 원화
    avgBuyPrice,
    avgSellPrice,
    realizedProfit,
    dividend,
    totalRealizedProfit,
    profitRate,
    realizedRate: totalRate,

    // 외화
    foreignAvgBuyPrice,
    foreignAvgSellPrice,
    foreignRealizedProfit,
    foreignDividend,
    foreignTotalRealizedProfit,
    foreignProfitRate,
    foreignTotalRate,

    // 원가
    buyCostKRW,
    buyCostForeign,
  };
};

const SORT_OPTIONS = [
  { value: "totalProfit_desc", label: "총실현손익 높은순" },
  { value: "totalProfit_asc", label: "총실현손익 낮은순" },
  { value: "rate_desc", label: "총수익률 높은순" },
  { value: "rate_asc", label: "총수익률 낮은순" },
  { value: "name_asc", label: "종목명 가나다순" },
];

export default function TradesPnLPage() {
  const { user } = useAuth();

  // 모바일 렌더링에 필요한 더미/기본 데이터
  const [closedTrades, setClosedTrades] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 검색 & 필터 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("ALL"); // ALL, KRW, OVERSEAS
  const [sortBy, setSortBy] = useState("totalProfit_desc"); // totalProfit_desc, totalProfit_asc, rate_desc, rate_asc, name_asc
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef(null);

  // 검색 패널 접힘/펼침 상태 (최초 로딩 시 기본 접힘 상태)
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const { mounted: isFilterPanelMounted, isClosing: isFilterPanelClosing } = useAnimatedModal(isFilterPanelOpen, 220);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (isFilterPanelOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isFilterPanelOpen]);

  // 드롭다운 외부 클릭 및 ESC 키 처리
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setIsSortDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isSortDropdownOpen) {
        setIsSortDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSortDropdownOpen]);

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 9;

  useEffect(() => {
    let isMounted = true;
    const fetchTrades = async () => {
      if (!user) {
        if (isMounted) {
          setClosedTrades([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      try {
        const isGuest = user.email === 'guest@example.com' || user.id === '00000000-0000-0000-0000-000000000000';

        if (isGuest) {
          if (isMounted) {
            setClosedTrades(SAMPLE_TRADE_DATA);
          }
          return;
        }

        const data = await TransactionManager.getClosedTradesPnL();
        if (isMounted) {
          if (data && data.length > 0) {
            setClosedTrades(data);
          } else {
            setClosedTrades(SAMPLE_TRADE_DATA);
          }
        }
      } catch (err) {
        console.warn("view_closed_trades_pnl 조회 오류:", err);
        if (isMounted) {
          setClosedTrades(SAMPLE_TRADE_DATA);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchTrades();
    return () => { isMounted = false; };
  }, [user]);

  const formatCurrency = (value) => new Intl.NumberFormat('ko-KR').format(value || 0);

  // 전체 정규화 리스트
  const allTradesList = useMemo(() => {
    return closedTrades.map(normalizeTradeItem).filter(Boolean);
  }, [closedTrades]);

  // 상단 요약 통계 (전체 / 국내 / 해외 탭 연동)
  const summary = useMemo(() => {
    let targetList = allTradesList;
    if (currencyFilter === "KRW") {
      targetList = allTradesList.filter(item => item.isKRW);
    } else if (currencyFilter === "OVERSEAS") {
      targetList = allTradesList.filter(item => !item.isKRW);
    }

    let sumTotalProfit = 0;
    let sumProfit = 0;
    let sumDividend = 0;
    let sumBuyCost = 0;

    let sumForeignTotalProfit = 0;
    let sumForeignProfit = 0;
    let sumForeignDividend = 0;
    let sumForeignBuyCost = 0;

    targetList.forEach(item => {
      sumTotalProfit += item.totalRealizedProfit;
      sumProfit += item.realizedProfit;
      sumDividend += item.dividend;
      sumBuyCost += item.buyCostKRW;

      sumForeignTotalProfit += (item.foreignTotalRealizedProfit || 0);
      sumForeignProfit += (item.foreignRealizedProfit || 0);
      sumForeignDividend += (item.foreignDividend || 0);
      sumForeignBuyCost += (item.buyCostForeign || 0);
    });

    const totalRate = sumBuyCost > 0 ? (sumTotalProfit / sumBuyCost) * 100 : 0;
    const profitRate = sumBuyCost > 0 ? (sumProfit / sumBuyCost) * 100 : 0;

    const foreignTotalRate = sumForeignBuyCost > 0 ? (sumForeignTotalProfit / sumForeignBuyCost) * 100 : 0;
    const foreignProfitRate = sumForeignBuyCost > 0 ? (sumForeignProfit / sumForeignBuyCost) * 100 : 0;

    return {
      sumTotalProfit,
      totalRate,
      sumProfit,
      profitRate,
      sumDividend,
      sumBuyCost,

      sumForeignTotalProfit,
      foreignTotalRate,
      sumForeignProfit,
      foreignProfitRate,
      sumForeignDividend,
      sumForeignBuyCost,

      count: targetList.length
    };
  }, [allTradesList, currencyFilter]);

  // 검색 및 필터링된 리스트
  const filteredList = useMemo(() => {
    let list = [...allTradesList];

    // 검색어 필터
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q)
      );
    }

    // 통화 필터
    if (currencyFilter === "KRW") {
      list = list.filter(item => item.isKRW);
    } else if (currencyFilter === "OVERSEAS") {
      list = list.filter(item => !item.isKRW);
    }

    // 정렬
    list.sort((a, b) => {
      if (sortBy === "totalProfit_desc") return b.totalRealizedProfit - a.totalRealizedProfit;
      if (sortBy === "totalProfit_asc") return a.totalRealizedProfit - b.totalRealizedProfit;
      if (sortBy === "rate_desc") return b.realizedRate - a.realizedRate;
      if (sortBy === "rate_asc") return a.realizedRate - b.realizedRate;
      if (sortBy === "name_asc") return a.name.localeCompare(b.name, 'ko');
      return 0;
    });

    return list;
  }, [allTradesList, searchQuery, currencyFilter, sortBy]);

  // 페이지네이션 계산
  const totalPages = Math.max(1, Math.ceil(filteredList.length / ITEMS_PER_PAGE));
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredList.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredList, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, currencyFilter, sortBy]);

  const startPage = Math.max(1, Math.floor((currentPage - 1) / 5) * 5 + 1);
  const endPage = Math.min(totalPages, startPage + 4);

  return (
    <>
      {/* 모바일 화면 (768px 미만) - 매매손익 탭으로 즉시 표시 */}
      <div className="mobile-only-block w-full">
        <MobileDividendDashboard
          user={user}
          loading={isLoading}
          formatCurrency={formatCurrency}
        />
      </div>

      {/* 데스크톱 화면 (768px 이상) 전용 */}
      <div className="desktop-only h-full flex-col pb-0 animate-fade-in">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl border border-blue-100/50 shadow-sm">
              <Briefcase size={20} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-800">매매손익 현황</h1>
                {user && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-white px-3 py-1 rounded-xl border border-slate-200/80 shadow-2xs">
                    <CheckCircle2 size={13} className="text-blue-500" />
                    <span>총 <span className="font-bold text-slate-800">{summary.count} 종목</span></span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">체결 완료된 매매 내역의 실현손익 및 누적 배당금을 종합 분석합니다.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {!user && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg text-sm">
                로그인 후 보유 자산을 확인할 수 있습니다.
              </div>
            )}
          </div>
        </div>

        {/* 로딩 화면 */}
        {user && isLoading && (
          <div className="glass-card py-24 flex flex-col items-center justify-center gap-3">
            <div className="w-9 h-9 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="font-bold text-slate-700 text-base">매매손익 내역을 불러오는 중...</span>
            <span className="text-sm text-slate-400">잠시만 기다려주세요</span>
          </div>
        )}

        {/* 로그인 완료 및 로딩 완료 후 본문 표시 */}
        {user && !isLoading && (
          <>
        {/* 상단 4대 핵심 요약 카드 (Glass Card) - 총매수금액, 실현손익, 누적배당금, 총실현손익 순서 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* 1. 총 매수금액 */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-slate-500">총 매수금액</span>
              <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                <Wallet size={12} strokeWidth={2.5} />
              </div>
            </div>
            <div className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none">
              <span className="text-2xl font-black tabular-nums tracking-tight text-slate-800 cursor-default select-none">
                <AnimatedTradeCounter
                  value={currencyFilter === "OVERSEAS" ? summary.sumForeignBuyCost : summary.sumBuyCost}
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
              <span>수량 × 평균매수가 합계</span>
              <span className="font-semibold text-slate-500">투자원금</span>
            </div>
            <div className="absolute top-0 left-0 w-1 h-full bg-slate-400"></div>
          </div>

          {/* 2. 순수 실현손익 */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-slate-500">실현손익</span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                (currencyFilter === "OVERSEAS" ? summary.sumForeignProfit : summary.sumProfit) > 0 
                  ? 'bg-red-50 text-red-600' 
                  : (currencyFilter === "OVERSEAS" ? summary.sumForeignProfit : summary.sumProfit) < 0 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'bg-slate-100 text-slate-600'
              }`}>
                {(currencyFilter === "OVERSEAS" ? summary.sumForeignProfit : summary.sumProfit) > 0 ? '+' : ''}
                {(currencyFilter === "OVERSEAS" ? summary.foreignProfitRate : summary.profitRate).toFixed(2)}%
              </span>
            </div>
            <div className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none">
              <span className={`text-2xl font-black tabular-nums tracking-tight cursor-default select-none ${
                (currencyFilter === "OVERSEAS" ? summary.sumForeignProfit : summary.sumProfit) > 0 
                  ? 'text-red-600' 
                  : (currencyFilter === "OVERSEAS" ? summary.sumForeignProfit : summary.sumProfit) < 0 
                    ? 'text-blue-600' 
                    : 'text-slate-800'
              }`}>
                <AnimatedTradeCounter
                  value={currencyFilter === "OVERSEAS" ? summary.sumForeignProfit : summary.sumProfit}
                  isForeign={currencyFilter === "OVERSEAS"}
                  showSign={true}
                  duration={800}
                />
              </span>
              {currencyFilter !== "OVERSEAS" && (
                <span className="text-xs font-bold text-slate-400">원</span>
              )}
            </div>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-50 pt-2">
              <span>매도금액 - 매수금액 합계</span>
              <span className="font-semibold text-slate-500">순수익률</span>
            </div>
            <div className={`absolute top-0 left-0 w-1 h-full ${
              (currencyFilter === "OVERSEAS" ? summary.sumForeignProfit : summary.sumProfit) > 0
                ? 'bg-red-500'
                : (currencyFilter === "OVERSEAS" ? summary.sumForeignProfit : summary.sumProfit) < 0
                  ? 'bg-blue-500'
                  : 'bg-slate-300'
            }`}></div>
          </div>

          {/* 3. 누적 배당금 */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-slate-500">누적 배당금</span>
              <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Coins size={12} strokeWidth={2.5} />
              </div>
            </div>
            <div className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none">
              <span className="text-2xl font-black tabular-nums tracking-tight text-emerald-600 cursor-default select-none">
                <AnimatedTradeCounter
                  value={currencyFilter === "OVERSEAS" ? summary.sumForeignDividend : summary.sumDividend}
                  isForeign={currencyFilter === "OVERSEAS"}
                  showSign={true}
                  duration={800}
                />
              </span>
              {currencyFilter !== "OVERSEAS" && (
                <span className="text-xs font-bold text-slate-400">원</span>
              )}
            </div>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-50 pt-2">
              <span>보유기간 배당금</span>
              <span className="font-semibold text-emerald-600">배당 수익</span>
            </div>
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
          </div>

          {/* 4. 총 실현손익 (손익 + 배당) */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-slate-500">총 실현손익</span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                (currencyFilter === "OVERSEAS" ? summary.sumForeignTotalProfit : summary.sumTotalProfit) > 0 
                  ? 'bg-red-50 text-red-600' 
                  : (currencyFilter === "OVERSEAS" ? summary.sumForeignTotalProfit : summary.sumTotalProfit) < 0 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'bg-slate-100 text-slate-600'
              }`}>
                {(currencyFilter === "OVERSEAS" ? summary.sumForeignTotalProfit : summary.sumTotalProfit) > 0 ? '+' : ''}
                {(currencyFilter === "OVERSEAS" ? summary.foreignTotalRate : summary.totalRate).toFixed(2)}%
              </span>
            </div>
            <div className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none">
              <span className={`text-2xl font-black tabular-nums tracking-tight cursor-default select-none ${
                (currencyFilter === "OVERSEAS" ? summary.sumForeignTotalProfit : summary.sumTotalProfit) > 0 
                  ? 'text-red-600' 
                  : (currencyFilter === "OVERSEAS" ? summary.sumForeignTotalProfit : summary.sumTotalProfit) < 0 
                    ? 'text-blue-600' 
                    : 'text-slate-800'
              }`}>
                <AnimatedTradeCounter
                  value={currencyFilter === "OVERSEAS" ? summary.sumForeignTotalProfit : summary.sumTotalProfit}
                  isForeign={currencyFilter === "OVERSEAS"}
                  showSign={true}
                  duration={800}
                />
              </span>
              {currencyFilter !== "OVERSEAS" && (
                <span className="text-xs font-bold text-slate-400">원</span>
              )}
            </div>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-50 pt-2">
              <span>매매손익 + 배당금 합계</span>
              <span className="font-semibold text-slate-500">총 수익률</span>
            </div>
            <div className={`absolute top-0 left-0 w-1 h-full ${
              (currencyFilter === "OVERSEAS" ? summary.sumForeignTotalProfit : summary.sumTotalProfit) > 0
                ? 'bg-red-500'
                : (currencyFilter === "OVERSEAS" ? summary.sumForeignTotalProfit : summary.sumTotalProfit) < 0
                  ? 'bg-blue-500'
                  : 'bg-slate-300'
            }`}></div>
          </div>
        </div>

        {/* 필터 및 검색 바 */}
        <div className="bg-white border border-slate-100 rounded-2xl p-3 mb-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
          {/* 좌측 그룹: 검색창 열기/닫기 토글 버튼 + 검색 입력창 */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setIsFilterPanelOpen(prev => !prev)}
              className={`h-9 w-9 flex items-center justify-center rounded-xl border transition-all cursor-pointer relative shrink-0 ${
                isFilterPanelOpen
                  ? 'bg-indigo-500 border-indigo-500 text-white shadow-xs ring-2 ring-indigo-200'
                  : 'bg-indigo-50/90 border-indigo-200/90 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300 shadow-2xs'
              }`}
              title={isFilterPanelOpen ? "검색창 접기" : "검색창 열기"}
            >
              <ChevronLeft
                size={16}
                strokeWidth={2.5}
                className={`transition-transform duration-300 ${
                  isFilterPanelOpen ? 'text-white' : 'rotate-180 text-current'
                }`}
              />
              {searchQuery && !isFilterPanelOpen && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white"></span>
              )}
            </button>

            {/* 열렸을 때 표시되는 검색창 (나타날 때와 사라질 때 애니메이션 적용) */}
            {isFilterPanelMounted && (
              <div
                className={`flex items-center gap-2 transition-opacity duration-200 ${
                  isFilterPanelClosing ? 'animate-fade-out' : 'animate-fade-in'
                }`}
              >
                <div className="relative w-64 md:w-72 shrink-0">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="종목명 또는 종목코드 검색"
                    className="w-full h-9 pl-9 pr-7 rounded-xl text-xs text-slate-700 placeholder-slate-400 font-medium border border-slate-200 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* 검색 초기화 버튼 (회오리 아이콘 RotateCcw) */}
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    if (searchInputRef.current) {
                      searchInputRef.current.focus();
                    }
                  }}
                  className={`h-9 w-9 flex items-center justify-center rounded-xl border transition-all cursor-pointer shrink-0 ${
                    searchQuery
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

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            {/* 국내/해외 탭 필터 */}
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
            </div>

            {/* 정렬 드롭다운 (커스텀 프리미엄 팝업) */}
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
                <div className="absolute top-full right-0 mt-2 w-48 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/70 z-50 p-1.5 animate-fade-in">
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

        {/* 매매손익 상세 테이블 (거래내역 - 배당 화면 스타일 준용) */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm mb-3">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-500">종목</th>
                <th className="px-4 py-4 text-center text-sm font-semibold text-slate-500">수량</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">평균 매수가</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">평균 매도가</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">실현손익</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">배당금</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">총 실현손익</th>
              </tr>
            </thead>
            <tbody key={`trades-list-${currentPage}-${currencyFilter}-${sortBy}`} className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-slate-200 border-t-brand rounded-full animate-spin"></div>
                      <span className="text-sm font-medium">매매손익 내역을 불러오는 중...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedList.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-sm font-medium">검색 조건에 맞는 매매손익 내역이 없습니다.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedList.map((item, i) => {
                  const isProfit = item.totalRealizedProfit > 0;
                  const isLoss = item.totalRealizedProfit < 0;
                  const isPureProfit = item.realizedProfit > 0;
                  const isPureLoss = item.realizedProfit < 0;

                  const fProfitRate = Number(item.foreignProfitRate) || 0;
                  const fTotalRate = Number(item.foreignTotalRate) || 0;
                  const kProfitRate = Number(item.profitRate) || 0;
                  const kTotalRate = Number(item.realizedRate) || 0;
                  const showOverseasAmount = currencyFilter === "OVERSEAS" && !item.isKRW;

                  return (
                    <tr
                      key={`trade-${item.code}-${i}`}
                      className={`h-[72px] hover:bg-slate-50/80 transition-colors group opacity-0 animate-row-fade stagger-${(i % 10) + 1}`}
                    >
                      {/* 1열: 종목 (로고 + 이름 + 코드 + 통화배지) */}
                      <td className="px-6 py-2">
                        <div className="flex items-center gap-3 min-h-[52px]">
                          <StockLogo code={item.code} name={item.name} isKRW={item.isKRW} />
                          <div className="flex flex-col justify-center max-w-[240px]">
                            <p className="text-sm text-slate-900 font-bold leading-tight truncate">
                              {item.name}
                            </p>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="font-mono text-slate-400 font-medium text-[11px] w-[62px] shrink-0 truncate">
                                {formatStockCode(item.code)}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 text-center leading-none ${
                                  item.isKRW
                                    ? "bg-blue-50 text-blue-600 border-blue-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}
                              >
                                {item.isKRW ? "국내" : "해외"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2열: 수량 */}
                      <td className="px-4 py-2 text-center text-sm font-bold text-slate-700 tabular-nums">
                        {item.quantity.toLocaleString()}주
                      </td>

                      {/* 3열: 평균 매수가 */}
                      <td className="px-6 py-2 text-right">
                        <div className="flex flex-col items-end justify-center">
                          {showOverseasAmount ? (
                            <span className="text-sm font-bold text-slate-800 tabular-nums">
                              {formatForeignAmount(item.foreignAvgBuyPrice, item.currency)}
                            </span>
                          ) : !item.isKRW && item.foreignAvgBuyPrice > 0 ? (
                            <>
                              <span className="text-sm font-bold text-slate-800 tabular-nums">
                                {formatForeignAmount(item.foreignAvgBuyPrice, item.currency)}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-400 tabular-nums mt-0.5">
                                {formatCurrency(item.avgBuyPrice)}원
                              </span>
                            </>
                          ) : (
                            <span className="text-sm font-bold text-slate-800 tabular-nums">
                              {formatCurrency(item.avgBuyPrice)}원
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4열: 평균 매도가 */}
                      <td className="px-6 py-2 text-right">
                        <div className="flex flex-col items-end justify-center">
                          {showOverseasAmount ? (
                            <span className="text-sm font-bold text-slate-800 tabular-nums">
                              {formatForeignAmount(item.foreignAvgSellPrice, item.currency)}
                            </span>
                          ) : !item.isKRW && item.foreignAvgSellPrice > 0 ? (
                            <>
                              <span className="text-sm font-bold text-slate-800 tabular-nums">
                                {formatForeignAmount(item.foreignAvgSellPrice, item.currency)}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-400 tabular-nums mt-0.5">
                                {formatCurrency(item.avgSellPrice)}원
                              </span>
                            </>
                          ) : (
                            <span className="text-sm font-bold text-slate-800 tabular-nums">
                              {formatCurrency(item.avgSellPrice)}원
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5열: 실현손익 (해외 탭: 외화금액+외화수익률 / 전체 및 국내 탭: 원화금액+원화수익률) */}
                      <td className="px-6 py-2 text-right">
                        <div className="flex flex-col items-end justify-center">
                          <span className={`text-sm font-bold tabular-nums ${
                            isPureProfit ? 'text-red-600' : isPureLoss ? 'text-blue-600' : 'text-slate-800'
                          }`}>
                            {showOverseasAmount
                              ? formatForeignAmount(item.foreignRealizedProfit, item.currency, true)
                              : `${item.realizedProfit > 0 ? '+' : ''}${formatCurrency(item.realizedProfit)}원`}
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className={`text-[11px] font-extrabold tabular-nums ${
                              isPureProfit ? 'text-red-600' : isPureLoss ? 'text-blue-600' : 'text-slate-500'
                            }`}>
                              ({showOverseasAmount
                                ? `${fProfitRate > 0 ? '+' : ''}${fProfitRate.toFixed(2)}%`
                                : `${kProfitRate > 0 ? '+' : ''}${kProfitRate.toFixed(2)}%`})
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 6열: 배당금 (해외 탭: 외화 배당금 / 전체 및 국내 탭: 원화 배당금) */}
                      <td className="px-6 py-2 text-right">
                        <div className="flex flex-col items-end justify-center">
                          {showOverseasAmount ? (
                            <span className={`text-sm font-bold tabular-nums ${
                              item.foreignDividend > 0 ? 'text-emerald-600' : 'text-slate-400'
                            }`}>
                              {item.foreignDividend > 0
                                ? `+${formatForeignAmount(item.foreignDividend, item.currency)}`
                                : formatForeignAmount(0, item.currency)}
                            </span>
                          ) : (
                            <span className={`text-sm font-bold tabular-nums ${
                              item.dividend > 0 ? 'text-emerald-600' : 'text-slate-400'
                            }`}>
                              {item.dividend > 0 ? `+${formatCurrency(item.dividend)}원` : '0원'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 7열: 총 실현손익 (해외 탭: 외화금액+외화총수익률 / 전체 및 국내 탭: 원화금액+원화총수익률) */}
                      <td className="px-6 py-2 text-right bg-slate-50/30">
                        <div className="flex flex-col items-end justify-center">
                          <span className={`text-base font-black tabular-nums tracking-tight ${
                            isProfit ? 'text-red-600' : isLoss ? 'text-blue-600' : 'text-slate-800'
                          }`}>
                            {showOverseasAmount
                              ? formatForeignAmount(item.foreignTotalRealizedProfit, item.currency, true)
                              : `${item.totalRealizedProfit > 0 ? '+' : ''}${formatCurrency(item.totalRealizedProfit)}원`}
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className={`text-xs font-black tabular-nums ${
                              isProfit ? 'text-red-600' : isLoss ? 'text-blue-600' : 'text-slate-500'
                            }`}>
                              ({showOverseasAmount
                                ? `${fTotalRate > 0 ? '+' : ''}${fTotalRate.toFixed(2)}%`
                                : `${kTotalRate > 0 ? '+' : ''}${kTotalRate.toFixed(2)}%`})
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }).concat(
                  paginatedList.length > 0 && paginatedList.length < ITEMS_PER_PAGE ?
                    [...Array(ITEMS_PER_PAGE - paginatedList.length)].map((_, i) => (
                      <tr key={`empty-${i}`} className={`h-[72px] opacity-0 animate-row-fade stagger-${paginatedList.length + i + 1}`}>
                        <td colSpan="7" className="px-6 py-2"><div className="min-h-[52px]">&nbsp;</div></td>
                      </tr>
                    )) : []
                )
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 컨트롤 */}
        {totalPages > 1 && (
          <div className="mt-1 flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className={`p-2 rounded-xl transition-all ${
                currentPage === 1
                  ? 'text-slate-200 cursor-not-allowed opacity-30'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-brand cursor-pointer'
              }`}
              title="첫 페이지"
            >
              <ChevronsLeft size={20} />
            </button>

            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`p-2 rounded-xl transition-all ${
                currentPage === 1
                  ? 'text-slate-200 cursor-not-allowed opacity-50'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-brand cursor-pointer'
              }`}
              title="이전 페이지"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-10 h-10 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                    currentPage === pageNum
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
              className={`p-2 rounded-xl transition-all ${
                currentPage === totalPages
                  ? 'text-slate-300 cursor-not-allowed opacity-50'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-brand cursor-pointer'
              }`}
              title="다음 페이지"
            >
              <ChevronRight size={20} />
            </button>

            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className={`p-2 rounded-xl transition-all ${
                currentPage === totalPages
                  ? 'text-slate-200 cursor-not-allowed opacity-30'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-brand cursor-pointer'
              }`}
              title="마지막 페이지"
            >
              <ChevronsRight size={20} />
            </button>
          </div>
        )}
        </>
        )}
      </div>
    </>
  );
}
