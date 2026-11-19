"use client";

import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAssets } from "@/contexts/AssetContext";
import {
  LayoutDashboard,
  List,
  Globe,
  LayoutList,
  PieChart as PieChartIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ArrowUpDown,
  Check,
  CheckCircle2,
  Coins,
  Wallet,
  Target,
  Trophy,
  Pencil,
  Sparkles,
  X,
  Clock,
  Calendar,
  TrendingUp
} from "lucide-react";
import MobileDashboard from "@/app/components/mobile/MobileDashboard";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ReferenceLine
} from "recharts";

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
        className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold shrink-0 ${
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
    <div className="w-9 h-9 rounded-lg shrink-0 overflow-hidden flex items-center justify-center bg-slate-100/60">
      <img
        src={logoUrl}
        alt={name || cleanCode}
        onError={() => setHasError(true)}
        className="w-full h-full object-cover rounded-lg"
        loading="lazy"
      />
    </div>
  );
}

const formatStockCode = (code) => {
  if (!code) return "";
  const str = String(code).trim();
  if (/^\d+$/.test(str)) {
    return str.padStart(6, "0");
  }
  return str;
};

const formatForeignAmount = (val, currency = 'USD', showSign = false) => {
  if (val === undefined || val === null || isNaN(val)) return '-';
  const num = Number(val);
  const sym = currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : (currency === 'JPY' ? '¥' : '$'));
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

// ── 상단 요약 카드 숫자 롤링 카운터 (배당금/매매손익 차트와 동일한 easeOutQuart 800ms 효과) ──
function AnimatedTradeCounter({
  value,
  isForeign = false,
  showSign = false,
  duration = 800,
  formatType = 'default' // 'default' | 'koreanWon' | 'percent'
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);
  const prevIsForeignRef = useRef(isForeign);
  const hasAnimatedInitialRef = useRef(false);

  useEffect(() => {
    const endVal = Number(value) || 0;
    // 최초 진입 시 또는 통화 단위 변경 시(KRW <-> USD) 0부터 롤링 시작
    const isCurrencySwitched = prevIsForeignRef.current !== isForeign;
    const shouldStartFromZero = !hasAnimatedInitialRef.current || isCurrencySwitched;
    const startVal = shouldStartFromZero
      ? 0
      : (Number(prevValueRef.current) || 0);

    // 아직 데이터 로딩 전이라 value가 없는 경우만 대기
    if (value === undefined || value === null) {
      return;
    }

    if (isCurrencySwitched) {
      setDisplayValue(startVal);
    }

    if (endVal === 0 && startVal === 0) {
      setDisplayValue(0);
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

  if (isForeign) {
    return <>{formatForeignAmount(safeVal, 'USD', showSign)}</>;
  }

  if (formatType === 'koreanWon') {
    return <>{showSign && safeVal > 0 ? '+' : ''}{formatKoreanWon(Math.round(safeVal))}</>;
  }

  if (formatType === 'percent') {
    return <>{showSign && safeVal > 0 ? '+' : ''}{safeVal.toFixed(1)}%</>;
  }

  const rounded = Math.round(safeVal);
  return (
    <>
      {showSign && rounded > 0 ? '+' : ''}
      {new Intl.NumberFormat('ko-KR').format(rounded)}
    </>
  );
}

const SORT_OPTIONS = [
  { value: "region", label: "지역순" },
  { value: "totalProfit_desc", label: "총손익 높은순" },
  { value: "totalProfit_asc", label: "총손익 낮은순" },
  { value: "profit_desc", label: "평가손익 높은순" },
  { value: "profit_asc", label: "평가손익 낮은순" },
  { value: "rate_desc", label: "수익률 높은순" },
  { value: "rate_asc", label: "수익률 낮은순" },
  { value: "eval_desc", label: "평가금액 높은순" },
  { value: "name_asc", label: "종목명 가나다순" },
];

// 한글 금액 포맷터 (예: 3억 5,000만원)
function formatKoreanWon(amount) {
  if (!amount || amount === 0) return "0원";
  const abs = Math.abs(amount);
  const eok = Math.floor(abs / 100000000);
  const man = Math.floor((abs % 100000000) / 10000);
  const rest = Math.floor(abs % 10000);

  let parts = [];
  if (eok > 0) parts.push(`${eok}억`);
  if (man > 0) parts.push(`${man.toLocaleString()}만`);
  if (parts.length === 0 && rest > 0) parts.push(`${rest.toLocaleString()}`);

  const sign = amount < 0 ? "-" : "";
  return `${sign}${parts.join(" ")}원`;
}

const emptySubscribe = () => () => {};

export default function HoldingsPage() {
  const { user } = useAuth();
  const { holdings, holdingsByAccount, summary, trendData, isTrendLoading, refreshTrendData, domesticTransactions, overseasTransactions } = useAssets();
  const [selectedPeriod, setSelectedPeriod] = useState("1년");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [chartTab, setChartTab] = useState("allocation"); // "allocation" (자산 비중) | "trend" (자산 추이) | "goal" (목표 달성)
  const [targetGoal, setTargetGoal] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("targetAssetGoal");
        if (saved && !isNaN(Number(saved)) && Number(saved) > 0) {
          return Number(saved);
        }
      } catch (e) {
        console.error("Failed to read targetAssetGoal from localStorage:", e);
      }
    }
    return 1000000000;
  });
  const [goalPaceMode, setGoalPaceMode] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("goalPaceMode");
        if (saved === "all" || saved === "1y") {
          return saved;
        }
      } catch (e) {
        console.error("Failed to read goalPaceMode from localStorage:", e);
      }
    }
    return "all"; // 기본값: 전체 기간
  });
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isGoalModalClosing, setIsGoalModalClosing] = useState(false);
  const [goalInputTemp, setGoalInputTemp] = useState("1000000000");
  const [holdingTab, setHoldingTab] = useState("stock"); // "stock" | "account"
  const [stockViewMode, setStockViewMode] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("stockViewMode") || "card" : "card"));
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [chartReady, setChartReady] = useState(false);
  const [currentStockPage, setCurrentStockPage] = useState(1);
  const [loadedPeriods, setLoadedPeriods] = useState(new Set(['3개월', '6개월', '1년', '3년']));
  const [currencyFilter, setCurrencyFilter] = useState("ALL"); // ALL, KRW, OVERSEAS
  const [sortBy, setSortBy] = useState("region");
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef(null);

  const STOCKS_PER_PAGE = 6;
  const LIST_PER_PAGE = 5;

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

  // 컴포넌트 마운트 후 레이아웃 안정화 시점에 차트 렌더링 활성화 (ResponsiveContainer 크기 계산 오류 방지)
  useEffect(() => {
    const timer = setTimeout(() => {
      setChartReady(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('stockViewMode', stockViewMode);
      setCurrentStockPage(1);
    }
  }, [stockViewMode, isClient]);

  // 로그아웃 시 선택된 계좌 초기화
  useEffect(() => {
    if (!user) {
      setSelectedAccount("");
    }
  }, [user]);

  // 종목별 / 계좌별 보유현황 필터 & 정렬 & 페이지네이션 계산
  const filteredHoldings = useMemo(() => {
    let list = holdingTab === "account"
      ? (selectedAccount ? (holdingsByAccount[selectedAccount] || []) : [])
      : (holdings || []);

    if (currencyFilter === "KRW") {
      list = list.filter(h => h.currency === "KRW");
    } else if (currencyFilter === "OVERSEAS") {
      list = list.filter(h => h.currency !== "KRW");
    }
    return list;
  }, [holdingTab, holdings, holdingsByAccount, selectedAccount, currencyFilter]);

  const holdingsSummary = useMemo(() => {
    let totalEvalKRW = 0;
    let totalCostKRW = 0;
    let totalProfitKRW = 0;
    let totalDivKRW = 0;

    let foreignTotalProfitUSD = 0;
    let foreignDivUSD = 0;
    let foreignCostUSD = 0;
    let foreignEvalUSD = 0;

    filteredHoldings.forEach(h => {
      totalEvalKRW += (h.evaluationAmountKRW || 0);
      totalCostKRW += (h.totalCostKRW || 0);
      totalProfitKRW += (h.profitAmountKRW || 0);
      totalDivKRW += (h.dividend || 0);

      if (h.currency !== 'KRW') {
        const curPrice = h.currentPrice || h.purchasePrice || 0;
        const buyPrice = h.purchasePrice || 0;
        const qty = h.totalQuantity || 0;
        const costUSD = buyPrice * qty;
        const evalUSD = curPrice * qty;
        const profitUSD = evalUSD - costUSD;
        foreignCostUSD += costUSD;
        foreignEvalUSD += evalUSD;
        foreignTotalProfitUSD += profitUSD;
        const fDiv = Number(h.foreignDividend) || (h.dividend && Number(h.exchangeRate) ? (Number(h.dividend) / Number(h.exchangeRate)) : 0);
        foreignDivUSD += fDiv;
      }
    });

    const isOverseas = currencyFilter === "OVERSEAS";

    const totalProfitRate = totalCostKRW > 0 ? (totalProfitKRW / totalCostKRW) * 100 : 0;
    const totalReturnRate = totalCostKRW > 0 ? ((totalProfitKRW + totalDivKRW) / totalCostKRW) * 100 : 0;

    const foreignProfitRate = foreignCostUSD > 0 ? (foreignTotalProfitUSD / foreignCostUSD) * 100 : 0;
    const foreignReturnRate = foreignCostUSD > 0 ? ((foreignTotalProfitUSD + foreignDivUSD) / foreignCostUSD) * 100 : 0;

    return {
      count: filteredHoldings.length,
      totalEvalKRW,
      totalCostKRW,
      totalProfitKRW,
      totalDivKRW,
      totalSumProfitKRW: totalProfitKRW + totalDivKRW,
      totalProfitRate,
      totalReturnRate,
      foreignCostUSD,
      foreignEvalUSD,
      foreignProfitUSD: foreignTotalProfitUSD,
      foreignDivUSD,
      foreignSumProfitUSD: foreignTotalProfitUSD + foreignDivUSD,
      foreignProfitRate,
      foreignReturnRate,
      isOverseas
    };
  }, [filteredHoldings, currencyFilter]);

  // 목표 자산 트래커 관련 계산 및 함수
  const totalEvalAmount = useMemo(() => {
    if (summary && summary.totalEvaluation > 0) return summary.totalEvaluation;
    return (holdings || []).reduce((acc, h) => acc + (h.evaluationAmountKRW || 0), 0);
  }, [summary, holdings]);

  const totalCostAmount = useMemo(() => {
    if (summary && summary.totalCost > 0) return summary.totalCost;
    return (holdings || []).reduce((acc, h) => acc + (h.totalCostKRW || 0), 0);
  }, [summary, holdings]);

  const totalProfitAmount = useMemo(() => {
    if (summary && summary.totalProfit !== undefined) return summary.totalProfit;
    return totalEvalAmount - totalCostAmount;
  }, [summary, totalEvalAmount, totalCostAmount]);

  const goalStats = useMemo(() => {
    const goal = targetGoal || 1000000000;
    const progressPercent = goal > 0 ? Number(((totalEvalAmount / goal) * 100).toFixed(1)) : 0;
    const remaining = Math.max(0, goal - totalEvalAmount);
    const exceeded = Math.max(0, totalEvalAmount - goal);
    const isReached = totalEvalAmount >= goal;
    const profitContribution = (goal > 0 && totalProfitAmount > 0)
      ? Number(((totalProfitAmount / goal) * 100).toFixed(1))
      : 0;

    // ── 현재 페이스(월평균 자산 증가액) 및 목표 달성 예상 시점 계산 ──
    // 1) 최근 1년 기준 페이스
    let oneYearPace = 0;
    const validTrend = (trendData || [])
      .filter(d => (d.eval || d.value) > 0 && d.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (validTrend.length >= 2) {
      const startIndex = Math.max(0, validTrend.length - 365);
      const firstPt = validTrend[startIndex];
      const lastPt = validTrend[validTrend.length - 1];

      const days = (new Date(lastPt.date).getTime() - new Date(firstPt.date).getTime()) / (1000 * 60 * 60 * 24);
      const firstVal = firstPt.eval || firstPt.value || 0;
      const lastVal = lastPt.eval || lastPt.value || totalEvalAmount;
      const growth = lastVal - firstVal;

      if (days >= 14 && growth > 0) {
        oneYearPace = (growth / days) * 30.4375;
      }
    }

    // 2) 투자 시작일(0원)부터 현재까지 전체 기간 기준 페이스
    let allPace = 0;
    const allDates = [...(domesticTransactions || []), ...(overseasTransactions || [])]
      .map(t => t.date)
      .filter(Boolean)
      .sort();

    if (allDates.length > 0 && totalEvalAmount > 0) {
      const firstTx = new Date(allDates[0]);
      const now = new Date();
      const days = Math.max(14, (now.getTime() - firstTx.getTime()) / (1000 * 60 * 60 * 24));
      allPace = (totalEvalAmount / days) * 30.4375;
    } else if (validTrend.length >= 2 && totalEvalAmount > 0) {
      const firstPt = validTrend[0];
      const lastPt = validTrend[validTrend.length - 1];
      const days = Math.max(14, (new Date(lastPt.date).getTime() - new Date(firstPt.date).getTime()) / (1000 * 60 * 60 * 24));
      allPace = (totalEvalAmount / days) * 30.4375;
    }

    // 선택된 모드에 따른 활성 페이스 결정 (기본값: 전체 기간)
    const activeMonthlyPace = goalPaceMode === "1y"
      ? (oneYearPace > 0 ? oneYearPace : allPace)
      : (allPace > 0 ? allPace : oneYearPace);

    // 3) 달성 예상 시점 계산 (xx년 x월)
    let projectedDateText = "분석 중";
    let durationText = "";
    let projectedSubText = "데이터 축적 중";

    if (isReached) {
      projectedDateText = "달성 완료! 🎉";
      projectedSubText = "목표 초과 달성 중";
    } else if (activeMonthlyPace > 0) {
      const monthsNeeded = Math.ceil(remaining / activeMonthlyPace);
      if (monthsNeeded > 600) {
        projectedDateText = "50년 이상";
        projectedSubText = "납입/수익률 확대 필요";
      } else {
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() + monthsNeeded);
        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth() + 1;

        projectedDateText = `${targetYear}년 ${targetMonth}월`;
        durationText = monthsNeeded < 12 
          ? `${monthsNeeded}개월 후` 
          : `${Math.floor(monthsNeeded / 12)}년 ${monthsNeeded % 12 > 0 ? `${monthsNeeded % 12}개월 ` : ''}후`;
        projectedSubText = `약 ${durationText}`;
      }
    } else {
      projectedDateText = "페이스 산출 중";
      projectedSubText = "추이 데이터 축적 필요";
    }

    return {
      goal,
      progressPercent,
      remaining,
      exceeded,
      isReached,
      profitContribution,
      monthlyPace: activeMonthlyPace,
      allPace,
      oneYearPace,
      projectedDateText,
      durationText,
      projectedSubText,
    };
  }, [targetGoal, totalEvalAmount, totalProfitAmount, trendData, domesticTransactions, overseasTransactions, goalPaceMode]);

  const handlePaceModeChange = (mode) => {
    setGoalPaceMode(mode);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("goalPaceMode", mode);
      } catch (e) {
        console.error("Failed to save goalPaceMode to localStorage:", e);
      }
    }
  };

  const handleCloseGoalModal = () => {
    if (isGoalModalClosing) return;
    setIsGoalModalClosing(true);
    setTimeout(() => {
      setIsGoalModalOpen(false);
      setIsGoalModalClosing(false);
    }, 200);
  };

  // 목표 금액 변경 모달 ESC 키 닫기 감지
  useEffect(() => {
    if (!isGoalModalOpen) return;
    const handleModalKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCloseGoalModal();
      }
    };
    window.addEventListener("keydown", handleModalKeyDown);
    return () => window.removeEventListener("keydown", handleModalKeyDown);
  }, [isGoalModalOpen, isGoalModalClosing]);

  const handleSaveGoal = (val) => {
    const raw = typeof val === 'string' ? val.replace(/[^0-9]/g, '') : val;
    const num = Number(raw);
    if (!isNaN(num) && num > 0) {
      setTargetGoal(num);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("targetAssetGoal", num.toString());
        } catch (e) {
          console.error("Failed to save targetAssetGoal:", e);
        }
      }
      handleCloseGoalModal();
    }
  };

  const handleQuickSetGoal = (amount) => {
    setTargetGoal(amount);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("targetAssetGoal", amount.toString());
      } catch (e) {
        console.error("Failed to save targetAssetGoal:", e);
      }
    }
  };

  const sortedHoldings = useMemo(() => {
    let list = [...filteredHoldings];
    list.sort((a, b) => {
      const aTotalProfit = (a.profitAmountKRW || 0) + (a.dividend || 0);
      const bTotalProfit = (b.profitAmountKRW || 0) + (b.dividend || 0);
      const aRate = parseFloat(a.returnRate) || 0;
      const bRate = parseFloat(b.returnRate) || 0;

      if (sortBy === "region") {
        const aIsKRW = a.currency === "KRW" ? 0 : 1;
        const bIsKRW = b.currency === "KRW" ? 0 : 1;
        if (aIsKRW !== bIsKRW) {
          return aIsKRW - bIsKRW; // 국내(KRW) 우선, 해외 나중
        }
        const aEval = a.evaluationAmountKRW ?? ((a.currentPrice || a.purchasePrice || 0) * (a.totalQuantity || 0));
        const bEval = b.evaluationAmountKRW ?? ((b.currentPrice || b.purchasePrice || 0) * (b.totalQuantity || 0));
        return bEval - aEval; // 동일 지역 내 평가금액(현재가 × 수량) 높은순
      }
      if (sortBy === "totalProfit_desc") return bTotalProfit - aTotalProfit;
      if (sortBy === "totalProfit_asc") return aTotalProfit - bTotalProfit;
      if (sortBy === "profit_desc") return (b.profitAmountKRW || 0) - (a.profitAmountKRW || 0);
      if (sortBy === "profit_asc") return (a.profitAmountKRW || 0) - (b.profitAmountKRW || 0);
      if (sortBy === "rate_desc") return bRate - aRate;
      if (sortBy === "rate_asc") return aRate - bRate;
      if (sortBy === "eval_desc") return (b.evaluationAmountKRW || 0) - (a.evaluationAmountKRW || 0);
      if (sortBy === "name_asc") return (a.name || "").localeCompare(b.name || "", 'ko');
      return 0;
    });
    return list;
  }, [filteredHoldings, sortBy]);

  const ITEMS_PER_PAGE = stockViewMode === 'card' ? STOCKS_PER_PAGE : LIST_PER_PAGE;
  const totalStockPages = Math.max(1, Math.ceil(sortedHoldings.length / ITEMS_PER_PAGE));
  const paginatedHoldings = useMemo(() => {
    const start = (currentStockPage - 1) * ITEMS_PER_PAGE;
    return sortedHoldings.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedHoldings, currentStockPage, ITEMS_PER_PAGE]);

  useEffect(() => {
    setCurrentStockPage(1);
  }, [currencyFilter, sortBy, stockViewMode, holdingTab, selectedAccount]);

  // 대시보드 진입 시 별도의 refreshAssets() 호출 불필요 (이미 Context에서 처리됨)

  useEffect(() => {
    if (Object.keys(holdingsByAccount || {}).length > 0 && (!selectedAccount || !holdingsByAccount[selectedAccount])) {
      setSelectedAccount(Object.keys(holdingsByAccount)[0]);
    }
  }, [holdingsByAccount, selectedAccount]);

  // 기간 변경 시 필요한 데이터 추가 로드 (하이브리드 방식)
  useEffect(() => {
    let days = 365;
    switch (selectedPeriod) {
      case "3개월": days = 90; break;
      case "6개월": days = 180; break;
      case "1년": days = 365; break;
      case "3년": days = 1095; break;
      case "전체": days = Infinity; break;
    }
    
    // 1년 이상인 경우에만 추가 로드 시도 (AssetContext 내부에서 중복 체크함)
    if (days > 365 || days === Infinity) {
      refreshTrendData(days);
    }
  }, [selectedPeriod, refreshTrendData]);

  // 로딩 완료 후 해당 기간 로드 완료 처리
  useEffect(() => {
    if (!isTrendLoading && trendData.length > 0) {
      setLoadedPeriods(prev => {
        const next = new Set(prev);
        // 현재 선택된 기간 추가
        next.add(selectedPeriod);
        
        // 만약 3년치(1095일) 이상 데이터가 있다면 하위 기간들은 모두 로드된 것으로 간주
        if (trendData.length >= 700) { // 대략 2년 이상 데이터가 있으면 3년 이하 기간들 프리패스
          next.add("3개월");
          next.add("6개월");
          next.add("1년");
          next.add("3년");
        }
        return next;
      });
    }
  }, [isTrendLoading, trendData.length, selectedPeriod]);

  // 긴 기간 여부 계산 (3년/전체는 포인트가 많아 linear 보간 사용)
  const isLongPeriod = selectedPeriod === "3년" || selectedPeriod === "전체";

  const sectorData = useMemo(() => {
    return holdings.reduce((acc, h) => {
      const sector = h.sector || "기타";
      const amount = h.evaluationAmountKRW || 0;
      if (amount > 0) {
        const idx = acc.findIndex(item => item.name === sector);
        if (idx > -1) acc[idx].value += amount;
        else acc.push({ name: sector, value: amount });
      }
      return acc;
    }, []).sort((a, b) => b.value - a.value);
  }, [holdings]);

  const currencyData = useMemo(() => {
    return holdings.reduce((acc, h) => {
      const isKRW = (h.currency || "KRW") === "KRW";
      const name = isKRW ? "국내" : "해외";
      const amount = h.evaluationAmountKRW || 0;
      if (amount > 0) {
        const idx = acc.findIndex(item => item.name === name);
        if (idx > -1) acc[idx].value += amount;
        else acc.push({ name: name, value: amount });
      }
      return acc;
    }, []).sort((a, b) => b.value - a.value);
  }, [holdings]);

  const stockDataRaw = useMemo(() => {
    return holdings.reduce((acc, h) => {
      const displayName = h.code ? `${h.name} (${h.code})` : (h.name || "알수없음");
      const amount = h.evaluationAmountKRW || 0;
      if (amount > 0) {
        const idx = acc.findIndex(item => item.name === displayName);
        if (idx > -1) acc[idx].value += amount;
        else acc.push({ 
          name: displayName, 
          value: amount,
          code: h.code,
          currency: h.currency,
          sector: h.sector
        });
      }
      return acc;
    }, []).sort((a, b) => b.value - a.value);
  }, [holdings]);

  const stockData = stockDataRaw.length > 10
    ? [
      ...stockDataRaw.slice(0, 10),
      { name: "기타", value: stockDataRaw.slice(10).reduce((sum, item) => sum + item.value, 0) }
    ]
    : stockDataRaw;

  const PIE_COLORS = [
    '#4F46E5', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
    '#6366F1', '#14B8A6', '#84CC16', '#7C3AED'
  ];

  const formatCurrency = (value, currency = 'KRW') => {
    if (value === undefined || value === null) return "0";
    if (currency === 'QTY') return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 4 }).format(value);
    if (currency === 'KRW') {
      const roundedValue = Math.round(value / 10) * 10;
      return new Intl.NumberFormat('ko-KR').format(roundedValue);
    }
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };

  const getCurrencySymbol = (currency) => {
    switch (currency) {
      case 'KRW': return '₩ ';
      case 'USD': return '$ ';
      case 'EUR': return '€ ';
      case 'GBP': return '£ ';
      case 'JPY': return '¥ ';
      case 'CNY': return '¥ ';
      case 'HKD': return 'HK$ ';
      default: return '';
    }
  };

  const getCurrencyStyle = (currency) => {
    switch (currency) {
      case 'KRW': return { border: 'border-blue-200', bg: 'bg-blue-50/30', accent: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50' };
      case 'USD': return { border: 'border-emerald-200', bg: 'bg-emerald-50/30', accent: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50' };
      case 'JPY': return { border: 'border-rose-200', bg: 'bg-rose-50/30', accent: 'bg-rose-500', text: 'text-rose-600', light: 'bg-rose-50' };
      case 'EUR': return { border: 'border-indigo-200', bg: 'bg-indigo-50/30', accent: 'bg-indigo-500', text: 'text-indigo-600', light: 'bg-indigo-50' };
      case 'GBP': return { border: 'border-violet-200', bg: 'bg-violet-50/30', accent: 'bg-violet-500', text: 'text-violet-600', light: 'bg-violet-50' };
      case 'HKD': return { border: 'border-amber-200', bg: 'bg-amber-50/30', accent: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50' };
      case 'CNY': return { border: 'border-red-200', bg: 'bg-red-50/30', accent: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50' };
      default: return { border: 'border-slate-200', bg: 'bg-slate-50/30', accent: 'bg-slate-400', text: 'text-slate-600', light: 'bg-slate-50' };
    }
  };

  const CustomPieTooltip = ({ active, payload, total }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percent = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
      return (
        <div className="bg-white/95 backdrop-blur-md p-3 border border-slate-100 rounded-xl shadow-xl">
          <p className="text-sm font-bold text-slate-800 mb-1 flex items-baseline">
            {data.name.includes(' (') ? data.name.split(' (')[0] : data.name}
            {data.name.includes(' (') && (
              <span className="text-[11px] text-slate-400 ml-1.5 font-bold">
                ({data.name.split(' (')[1]}
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].fill }}></span>
            <span className="text-xs font-bold text-slate-600">
              {formatCurrency(data.value, 'KRW')}원 ({percent}%)
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomDashboardLegend = ({ data, colors, total }) => {
    return (
      <div className="mt-2 w-full h-[108px] overflow-y-auto pr-2 custom-scrollbar shrink-0">
        <div className="flex flex-col gap-2">
          {data.map((item, index) => {
            const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
            const displayTitle = (item.currency === 'USD' && item.sector === 'ETF' && item.code)
              ? item.code
              : (item.name.includes(' (') ? item.name.split(' (')[0] : item.name);
            return (
              <div 
                key={index} 
                className="flex items-center justify-between group py-1 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors rounded-lg px-2 animate-legend-item"
                style={{ animationDelay: `${750 + index * 60}ms` }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: colors[index % colors.length] }}></div>
                  <span className="text-sm font-bold text-slate-700 group-hover:text-brand transition-colors truncate">{displayTitle}</span>
                </div>
                <div className="flex items-center justify-end gap-1.5 flex-shrink-0 w-[185px]">
                  <div className="w-[65px] flex justify-end">
                    <span className="text-[12px] font-black text-brand shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>{percent}%</span>
                  </div>
                  <span className="text-[14px] font-black text-slate-700 w-[110px] text-right shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.value, 'KRW')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const formatTrendCurrency = (value) => {
    if (value === 0) return "0";
    const absValue = Math.abs(value);
    if (absValue >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
    if (absValue >= 10000) return `${(value / 10000).toFixed(0)}만`;
    return new Intl.NumberFormat("ko-KR").format(value);
  };

  // 트렌드 데이터 가공 (useMemo로 최적화 및 연도 표시 그룹화 로직 포함)
  // 트렌드 데이터에 필요한 정보(가공된 데이터셋 + 그라데이션 오프셋) 통합 계산
  const chartDataObj = useMemo(() => {
    // 만약 DB 트렌드 데이터가 비어있지만 현재 보유 자산이 있는 경우, 보유 자산 요약 기반 기준점 생성
    let effectiveTrendData = trendData || [];
    if (effectiveTrendData.length === 0 && summary && (summary.totalEvaluation > 0 || (summary.totalCost && summary.totalCost > 0))) {
      const todayStr = new Date().toISOString().split('T')[0];
      const cost = Number(summary.totalCost || (summary.totalEvaluation - summary.totalProfit) || 0);
      const evalAmt = Number(summary.totalEvaluation || cost);
      const rate = Number(summary.avgProfitRate || 0);
      
      const allTxDates = [...(domesticTransactions || []), ...(overseasTransactions || [])]
        .map(tx => tx.date)
        .filter(Boolean)
        .sort();
      const firstDate = allTxDates.length > 0 ? allTxDates[0] : null;

      if (firstDate && firstDate < todayStr) {
        effectiveTrendData = [
          { date: firstDate, invest: cost, eval: cost, profitRate: 0 },
          { date: todayStr, invest: cost, eval: evalAmt, profitRate: rate }
        ];
      } else {
        // eslint-disable-next-line react-hooks/purity
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        effectiveTrendData = [
          { date: yesterday, invest: cost, eval: cost, profitRate: 0 },
          { date: todayStr, invest: cost, eval: evalAmt, profitRate: rate }
        ];
      }
    }

    // 초기 로딩 시에도 객체 구조를 유지하여 undefined 에러 방지
    if (!effectiveTrendData || effectiveTrendData.length === 0) {
      return { data: [], off: 0.5 };
    }

    const now = new Date();
    let days = 365;
    switch (selectedPeriod) {
      case "3개월": days = 90; break;
      case "6개월": days = 180; break;
      case "1년": days = 365; break;
      case "3년": days = 1095; break;
      case "전체": days = Infinity; break;
    }

    let startDateStr = "0000-00-00";
    if (days !== Infinity) {
      const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
      startDateStr = startDate.toISOString().split('T')[0];
    }

    const range = effectiveTrendData.filter(d => (d.date || '') >= startDateStr);
    const sourceData = range.length > 0 ? range : effectiveTrendData;

    // 속성 매핑 정규화 (invest/buy, eval/value, profitRate/rate 상호 완벽 호환)
    const normalizedData = sourceData.map(d => {
      const invest = Number(d.invest !== undefined ? d.invest : (d.buy !== undefined ? d.buy : 0));
      const evalAmt = Number(d.eval !== undefined ? d.eval : (d.value !== undefined ? d.value : 0));
      const profitRate = Number(
        d.profitRate !== undefined 
          ? d.profitRate 
          : (d.rate !== undefined 
              ? d.rate 
              : (invest > 0 ? ((evalAmt - invest) / invest) * 100 : 0))
      );

      return {
        ...d,
        invest,
        eval: evalAmt,
        profitRate,
        displayDate: d.date ? d.date.replace(/-/g, '.') : ''
      };
    });

    // 기간별 맞춤 포인트 수 정의 (3개월: 60개, 6개월: 100개, 1년: 200개, 3년: 600개, 전체: 800개)
    const TARGET_POINTS_MAP = {
      "3개월": 60,
      "6개월": 100,
      "1년": 200,
      "3년": 600,
      "전체": 800
    };
    const targetPoints = TARGET_POINTS_MAP[selectedPeriod] || 60;
    let sampledData = normalizedData;

    if (normalizedData.length >= 2) {
      sampledData = [];
      const total = normalizedData.length;
      const startTime = new Date(normalizedData[0].date).getTime();
      const endTime = new Date(normalizedData[total - 1].date).getTime();
      const timespan = Math.max(endTime - startTime, 86400000);

      const seenDates = new Set();
      for (let i = 0; i < targetPoints; i++) {
        const progress = i / (targetPoints - 1);
        const targetTime = new Date(startTime + timespan * progress);
        let dateStr = targetTime.toISOString().split('T')[0];

        // 날짜 중복 방지 (안전장치)
        if (seenDates.has(dateStr)) {
          const offsetTime = new Date(startTime + timespan * progress + i * 3600000);
          dateStr = offsetTime.toISOString().split('T')[0];
        }
        seenDates.add(dateStr);

        const t = progress * (total - 1);
        const low = Math.floor(t);
        const high = Math.min(total - 1, Math.ceil(t));
        const ratio = t - low;

        const dLow = normalizedData[low];
        const dHigh = normalizedData[high];

        const invest = Math.round(dLow.invest + (dHigh.invest - dLow.invest) * ratio);
        const evalAmt = Math.round(dLow.eval + (dHigh.eval - dLow.eval) * ratio);
        const profitRate = Number((dLow.profitRate + (dHigh.profitRate - dLow.profitRate) * ratio).toFixed(2));

        sampledData.push({
          date: dateStr,
          displayDate: dateStr.replace(/-/g, '.'),
          invest,
          eval: evalAmt,
          profitRate
        });
      }
    }

    // 그라데이션 오프셋 계산 (수익률 0 지점 찾기, NaN 방지)
    const profitRates = sampledData.map(d => d.profitRate);
    const maxProfit = profitRates.length > 0 ? Math.max(...profitRates, 0) : 0;
    const minProfit = profitRates.length > 0 ? Math.min(...profitRates, 0) : 0;
    let off = 0.5;
    if (maxProfit > minProfit) {
      off = maxProfit / (maxProfit - minProfit);
    }
    if (isNaN(off) || !isFinite(off)) {
      off = 0.5;
    }

    return {
      data: sampledData,
      off: off
    };
  }, [trendData, selectedPeriod, summary, domesticTransactions, overseasTransactions]);

  // chartData 구조 분해
  const finalChartData = chartDataObj.data;
  const profitOffset = chartDataObj.off;

  // X축에 실제로 표시할 틱(레이블)들을 사용자 요청 기준에 따라 정밀 정렬
  const axisTicks = useMemo(() => {
    if (!finalChartData || finalChartData.length === 0) return [];
    
    let ticks = [];
    const len = finalChartData.length;

    // 5~7개의 균등한 X축 눈금 생성
    const tickCount = selectedPeriod === "3개월" ? 5 : (selectedPeriod === "6개월" ? 6 : 7);
    const step = (len - 1) / (tickCount - 1);
    
    for (let i = 0; i < tickCount; i++) {
      const idx = Math.min(len - 1, Math.round(i * step));
      ticks.push(finalChartData[idx].date);
    }
    
    ticks = Array.from(new Set(ticks)).sort();
    return ticks;
  }, [finalChartData, selectedPeriod]);

  const yearMarkTicks = useMemo(() => {
    const marks = {};
    axisTicks.forEach(t => {
      const yr = t.split('-')[0];
      if (!marks[yr]) marks[yr] = t;
    });
    return marks;
  }, [axisTicks]);

  // 각 연도의 첫 번째 데이터 연도 경계선 지점 계산 (세로 수직선용)
  const yearSeparators = useMemo(() => {
    if (!finalChartData || finalChartData.length === 0) return [];
    
    const separators = [];
    const seenYears = new Set();
    const firstYear = finalChartData[0].date.split('-')[0];
    seenYears.add(firstYear);

    finalChartData.forEach((d) => {
      const yr = d.date.split('-')[0];
      if (!seenYears.has(yr)) {
        separators.push({ val: d.date, yr: yr });
        seenYears.add(yr);
      }
    });

    return separators;
  }, [finalChartData]);

  const CustomXAxisTick = ({ x, y, payload }) => {
    if (!payload.value) return null;
    const [year, month, day] = payload.value.split('-');
    const showYear = yearMarkTicks[year] === payload.value;
    
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={10} dy={5} textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight={600}>
          {`${month}.${day}`}
        </text>
        {showYear && (
          <text x={0} y={25} dy={5} textAnchor="middle" fill="#334155" fontSize={12} fontWeight="bold">
            {year}년
          </text>
        )}
      </g>
    );
  };

  const TrendTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const orderConfig = { "투자금액": 1, "평가금액": 2, "수익": 3 };
      const sortedPayload = [...payload].sort((a, b) => (orderConfig[a.name] || 99) - (orderConfig[b.name] || 99));
      
      return (
        <div className="bg-white/90 backdrop-blur-md p-3 border border-slate-100 rounded-xl shadow-xl min-w-[180px]">
          <div className="flex justify-between items-center mb-2 border-b border-slate-50 pb-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
          </div>
          <div className="space-y-1.5">
            {sortedPayload.map((entry, index) => (
              <div key={index} className="flex items-center justify-between gap-8">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: entry.color }}></div>
                  <span className="text-[13px] font-bold text-slate-600">{entry.name}</span>
                </div>
                <span className="font-black text-slate-800 tracking-tight text-[14px] tabular-nums">
                  {new Intl.NumberFormat("ko-KR").format(entry.value)}원
                </span>
              </div>
            ))}
            {!payload.find(p => p.dataKey === "profitRate") && payload[0]?.payload?.profitRate !== undefined && (
              <div className="pt-2 mt-2 border-t border-slate-50 flex items-center justify-between gap-8">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-amber-500 shadow-sm"></div>
                  <span className="text-[13px] font-bold text-slate-600">수익률</span>
                </div>
                <span className={`font-black tracking-tight text-[14px] tabular-nums ${payload[0].payload.profitRate >= 0 ? "text-rose-500" : "text-blue-500"}`}>
                  {payload[0].payload.profitRate > 0 ? "+" : ""}{Number(payload[0].payload.profitRate || 0).toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (!isClient) return null;

  return (
    <>
      {/* ── 모바일 화면 (768px 미만) ── */}
      <div className="mobile-only-block">
        <MobileDashboard />
      </div>

      {/* ── 데스크톱 화면 (768px 이상) ── */}
      <div className="desktop-only flex-col gap-10 w-full min-w-0 animate-fade-in">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl border border-blue-100/50 shadow-sm">
              <LayoutDashboard size={20} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">대시보드</h1>
          </div>
          {user && (
            <p className="text-slate-500 text-sm pl-12">보유 중인 모든 종목의 상세 수익 현황과 계좌별 분배를 확인할 수 있는 대시보드입니다.</p>
          )}
        </div>

        {!user && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg text-sm">
            로그인 후 보유 자산을 확인할 수 있습니다.
          </div>
        )}
      </div>

      {user && summary?.isLoading ? (
        <div className="glass-card py-24 flex flex-col items-center justify-center gap-3">
          <div className="w-9 h-9 border-3 border-brand border-t-transparent rounded-full animate-spin" />
          <span className="font-bold text-slate-700 text-base">자산을 불러오고 있습니다...</span>
          <span className="text-sm text-slate-400">잠시만 기다려주세요</span>
        </div>
      ) : user ? (
        <>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* 좌측: 아이콘 + 타이틀 + 뱃지 + 서브텍스트 (탭 전환 시 부드러운 애니메이션 효과) */}
            <div key={chartTab} className="flex items-start gap-3 animate-header-switch">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs mt-0.5 ${
                chartTab === "allocation"
                  ? "bg-indigo-50 text-indigo-600 border-indigo-100/70"
                  : chartTab === "trend"
                    ? "bg-emerald-50 text-emerald-600 border-emerald-100/70"
                    : "bg-blue-50 text-blue-600 border-blue-100/70"
              }`}>
                {chartTab === "allocation" && <PieChartIcon size={20} strokeWidth={2.5} />}
                {chartTab === "trend" && <TrendingUp size={20} strokeWidth={2.5} />}
                {chartTab === "goal" && <Trophy size={20} strokeWidth={2.5} />}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                    {chartTab === "allocation" ? "자산 비중" : chartTab === "trend" ? "자산 추이" : "목표 자산 트래커"}
                  </h2>
                  {chartTab === "allocation" && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                      섹터 · 지역 · 종목별
                    </span>
                  )}
                  {chartTab === "trend" && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      투자 흐름 & 수익률
                    </span>
                  )}
                  {chartTab === "goal" && (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      goalStats.isReached
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : 'bg-blue-50 text-blue-600 border border-blue-200'
                    }`}>
                      {goalStats.isReached ? '🎉 목표 초과 달성!' : `달성률 ${goalStats.progressPercent}%`}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {chartTab === "allocation" && "보유 자산의 섹터별, 국가/통화별, 종목별 분산 투자 비중을 분석합니다."}
                  {chartTab === "trend" && "투자 원금 대비 총 자산의 성장 흐름과 수익률 변동 추이를 확인합니다."}
                  {chartTab === "goal" && "설정하신 목표 금액 대비 현재 포트폴리오 평가금액 기준 진행률입니다."}
                </p>
              </div>
            </div>

            {/* 중앙: 자산 추이 기간 선택 버튼 (가운데 정렬) */}
            {chartTab === "trend" ? (
              <div className="flex-1 flex justify-center max-w-full overflow-x-auto py-1 md:py-0 animate-fade-in">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {["3개월", "6개월", "1년", "3년", "전체"].map((p) => (
                    <button
                      key={p}
                      onClick={() => setSelectedPeriod(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        selectedPeriod === p
                          ? "bg-white text-slate-800 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="hidden md:block flex-1" />
            )}

            {/* 우측 3단 탭 전환 (자산 비중 | 자산 추이 | 목표 달성) */}
            <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 self-start md:self-auto">
              <button
                onClick={() => setChartTab("allocation")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  chartTab === "allocation"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                자산 비중
              </button>
              <button
                onClick={() => setChartTab("trend")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  chartTab === "trend"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                자산 추이
              </button>
              <button
                onClick={() => setChartTab("goal")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  chartTab === "goal"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                목표 달성
              </button>
            </div>
          </div>

          {chartTab === "allocation" ? (
            holdings.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="glass-card p-6 flex flex-col items-center justify-between h-[500px]">
                  <div className="flex items-center gap-2 self-start mb-2 pb-2 border-b-2 border-slate-100 w-full shrink-0"><PieChartIcon size={24} className="text-brand" /><h3 className="text-[18px] font-black text-slate-800 uppercase tracking-tighter">섹터</h3></div>
                  <div className="w-full h-[270px] shrink-0 flex items-center justify-center">
                    {isClient && chartReady && (
                      <ResponsiveContainer width="100%" height={270} minWidth={0}>
                        <PieChart><Pie data={sectorData} cx="50%" cy="50%" innerRadius={0} outerRadius={115} paddingAngle={2} cornerRadius={3} dataKey="value" stroke="none" startAngle={90} endAngle={-270} isAnimationActive={true} animationDuration={750} animationEasing="ease-out">{sectorData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip content={<CustomPieTooltip total={sectorData.reduce((acc, cur) => acc + cur.value, 0)} />} /></PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <CustomDashboardLegend data={sectorData} colors={PIE_COLORS} total={sectorData.reduce((acc, cur) => acc + cur.value, 0)} />
                </div>
                <div className="glass-card p-6 flex flex-col items-center justify-between h-[500px]">
                  <div className="flex items-center gap-2 self-start mb-2 pb-2 border-b-2 border-slate-100 w-full shrink-0"><Globe size={24} className="text-brand" /><h3 className="text-[18px] font-black text-slate-800 uppercase tracking-tighter">지역</h3></div>
                  <div className="w-full h-[270px] shrink-0 flex items-center justify-center">
                    {isClient && chartReady && (
                      <ResponsiveContainer width="100%" height={270} minWidth={0}>
                        <PieChart><Pie data={currencyData} cx="50%" cy="50%" innerRadius={0} outerRadius={115} paddingAngle={2} cornerRadius={3} dataKey="value" stroke="none" startAngle={90} endAngle={-270} isAnimationActive={true} animationDuration={750} animationEasing="ease-out">{currencyData.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 4) % PIE_COLORS.length]} />)}</Pie><Tooltip content={<CustomPieTooltip total={currencyData.reduce((acc, cur) => acc + cur.value, 0)} />} /></PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <CustomDashboardLegend data={currencyData} colors={PIE_COLORS.slice(4).concat(PIE_COLORS.slice(0, 4))} total={currencyData.reduce((acc, cur) => acc + cur.value, 0)} />
                </div>
                <div className="glass-card p-6 flex flex-col items-center justify-between h-[500px]">
                  <div className="flex items-center gap-2 self-start mb-2 pb-2 border-b-2 border-slate-100 w-full shrink-0"><LayoutList size={24} className="text-brand" /><h3 className="text-[18px] font-black text-slate-800 uppercase tracking-tighter">종목</h3></div>
                  <div className="w-full h-[270px] shrink-0 flex items-center justify-center">
                    {isClient && chartReady && (
                      <ResponsiveContainer width="100%" height={270} minWidth={0}>
                        <PieChart><Pie data={stockData} cx="50%" cy="50%" innerRadius={0} outerRadius={115} paddingAngle={2} cornerRadius={3} dataKey="value" stroke="none" startAngle={90} endAngle={-270} isAnimationActive={true} animationDuration={750} animationEasing="ease-out">{stockData.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 8) % PIE_COLORS.length]} />)}</Pie><Tooltip content={<CustomPieTooltip total={stockData.reduce((acc, cur) => acc + cur.value, 0)} />} /></PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <CustomDashboardLegend data={stockData} colors={PIE_COLORS.slice(8).concat(PIE_COLORS.slice(0, 8))} total={stockData.reduce((acc, cur) => acc + cur.value, 0)} />
                </div>
              </div>
            ) : (
              <div className="glass-card p-12 text-center text-slate-400 font-medium h-[500px] flex items-center justify-center">
                보유 중인 자산이 없습니다.
              </div>
            )
          ) : chartTab === "trend" ? (
            <div className="glass-card overflow-hidden flex flex-col min-w-0 h-[500px]">
            {isTrendLoading || !chartReady ? (
              <div className="w-full h-full p-6 flex flex-col justify-between animate-pulse select-none">
                {/* 상단 차트 영역 스켈레톤 */}
                <div className="h-[270px] w-full flex flex-col justify-between border-b border-slate-100/80 pb-4 relative">
                  <div className="flex justify-between items-center text-xs text-slate-300 font-mono">
                    <span className="w-12 h-3.5 bg-slate-100 rounded-md"></span>
                    <span className="w-16 h-3.5 bg-slate-100 rounded-md"></span>
                  </div>
                  <div className="w-full h-full flex items-center justify-center relative">
                    <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none">
                      <div className="w-full border-t border-slate-100/90"></div>
                      <div className="w-full border-t border-slate-100/90"></div>
                      <div className="w-full border-t border-slate-100/90"></div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold z-10 bg-white/85 px-4 py-2 rounded-xl backdrop-blur-xs border border-slate-200/60 shadow-xs">
                      <div className="w-3.5 h-3.5 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                      <span>자산 트렌드를 불러오는 중...</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-300 font-mono">
                    <span className="w-10 h-3.5 bg-slate-100 rounded-md"></span>
                    <span className="w-14 h-3.5 bg-slate-100 rounded-md"></span>
                  </div>
                </div>

                {/* 하단 수익률 차트 영역 스켈레톤 */}
                <div className="h-[150px] w-full flex flex-col justify-between pt-2">
                  <div className="w-full h-full flex items-center justify-between relative py-2">
                    <div className="absolute inset-0 flex flex-col justify-around pointer-events-none">
                      <div className="w-full border-t border-slate-100/90"></div>
                      <div className="w-full border-t border-slate-100/90"></div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="w-12 h-3 bg-slate-100 rounded"></span>
                    <span className="w-12 h-3 bg-slate-100 rounded"></span>
                    <span className="w-12 h-3 bg-slate-100 rounded"></span>
                    <span className="w-12 h-3 bg-slate-100 rounded"></span>
                    <span className="w-12 h-3 bg-slate-100 rounded"></span>
                  </div>
                </div>
              </div>
            ) : finalChartData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-20 text-slate-400 text-center h-full">
                조회된 트렌드 데이터가 없습니다.
              </div>
            ) : (
              <div className="flex-1 w-full p-2 pb-0 flex flex-col justify-between min-h-0 min-w-0 overflow-hidden animate-fade-in">
                  <div className="h-[285px] w-full min-w-0 relative flex-shrink-0" style={{ minWidth: "100%", height: "285px" }}>
                    {isClient && chartReady && (
                      <ResponsiveContainer width="100%" height={285} debounce={100} minWidth={0}>
                        <AreaChart data={finalChartData} syncId="assetTrend" margin={{ top: 10, right: 2, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorEval" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                            <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.05}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <filter id="shadow" height="200%">
                            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#3b82f6" floodOpacity="0.15" />
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" hide padding={{ left: 0, right: 0 }} />
                        <YAxis 
                          yAxisId="left"
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700, textAnchor: "middle" }} 
                          tickFormatter={formatTrendCurrency} 
                          width={50}
                          dx={-10}
                        />
                        <YAxis 
                          yAxisId="right" 
                          orientation="right" 
                          width={50} 
                          tick={false} 
                          axisLine={false} 
                          tickLine={false} 
                        />
                        <Tooltip 
                          content={<TrendTooltip />} 
                          cursor={{ stroke: '#e2e8f0', strokeWidth: 2 }} 
                          position={{ y: 0 }}
                        />
                        {yearSeparators.map(sep => (
                          <ReferenceLine 
                            key={`top-sep-${sep.val}`}
                            x={sep.val} 
                            stroke="#94a3b8" 
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            isFront={true}
                            alwaysShow={true}
                            label={{ 
                              position: 'top', 
                              value: `${sep.yr}년`, 
                              fill: '#475569', 
                              fontSize: 12, 
                              fontWeight: 700,
                              offset: 15
                            }}
                          />
                        ))}
                        {/* 1. 매수금액 (회색선) - 키 고정으로 기간 변경 시 차트가 움직이는 모핑 효과 */}
                        <Area 
                          key="asset-invest-line"
                          yAxisId="left"
                          type="monotone" 
                          dataKey="invest" 
                          stroke="#64748b" 
                          strokeWidth={1.5} 
                          strokeOpacity={0.8}
                          fill="transparent"
                          name="매수금액" 
                          activeDot={{ r: 3, fill: '#64748b' }}
                          isAnimationActive={true}
                          animationDuration={800}
                          animationEasing="ease-in-out"
                        />
                        {/* 2. 평가금액 (파란색 면) - 키 고정으로 기간 변경 시 차트가 움직이는 모핑 효과 */}
                        <Area 
                          key="asset-eval-area"
                          yAxisId="left"
                          type="monotone" 
                          dataKey="eval" 
                          stroke="#3b82f6" 
                          strokeWidth={1.5} 
                          fill="url(#colorEval)" 
                          name="평가금액" 
                          activeDot={{ r: 5, strokeWidth: 0, fill: '#3b82f6' }}
                          isAnimationActive={true}
                          animationDuration={800}
                          animationEasing="ease-in-out"
                          filter="url(#shadow)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* 차트 상/하단 구분선 (가시성 강화) */}
                <div className="mx-6 h-[1px] bg-gradient-to-r from-transparent via-slate-300/80 to-transparent shrink-0"></div>

                {/* 하단: 수익률 차트 (37.5%) */}
                <div className="h-[165px] w-full min-w-0 relative flex-shrink-0" style={{ minWidth: "100%", height: "165px" }}>
                  {isClient && chartReady && (
                    <ResponsiveContainer width="100%" height={165} debounce={100} minWidth={0}>
                      <AreaChart data={finalChartData} syncId="assetTrend" margin={{ top: 0, right: 2, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset={profitOffset} stopColor="#2dd4bf" stopOpacity={0.45} />
                            <stop offset={profitOffset} stopColor="#2dd4bf" stopOpacity={0.05} />
                            <stop offset={profitOffset} stopColor="#fb7185" stopOpacity={0.05} />
                            <stop offset={profitOffset} stopColor="#fb7185" stopOpacity={0.45} />
                          </linearGradient>
                          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="1.5" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={<CustomXAxisTick />} 
                          ticks={axisTicks}
                          height={50}
                          padding={{ left: 0, right: 0 }}
                          interval={0}
                        />
                        <YAxis 
                          yAxisId="left" 
                          width={50} 
                          tick={false} 
                          axisLine={false} 
                          tickLine={false} 
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: "#f43f5e", fontSize: 10, fontWeight: 700, textAnchor: "middle" }} 
                          tickFormatter={(v) => `${v}%`} 
                          width={50}
                          dx={15}
                        />
                        <Tooltip 
                          content={() => null} 
                        />
                        
                        {yearSeparators.map(sep => (
                          <ReferenceLine 
                            key={`bottom-sep-${sep.val}`}
                            x={sep.val} 
                            stroke="#94a3b8" 
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            isFront={true}
                            alwaysShow={true}
                          />
                        ))}
                        {/* 수익률 차트 */}
                        <Area 
                          key={`profit-rate-fill-${selectedPeriod}`}
                          yAxisId="right"
                          type={isLongPeriod ? "linear" : "monotone"} 
                          dataKey="profitRate" 
                          stroke="#94a3b8" 
                          strokeWidth={1.5} 
                          strokeOpacity={0.6}
                          fill="url(#colorProfit)"
                          baseValue={0}
                          name="수익률" 
                          activeDot={{ r: 5, strokeWidth: 0, fill: '#ff4d6d', filter: 'url(#glow)' }}
                          isAnimationActive={true}
                          animationDuration={700}
                          animationBegin={0}
                          animationEasing="ease-out"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* 목표 자산 달성 현황 카드 (chartTab === "goal") */
          <div className="glass-card p-6 md:p-8 flex flex-col justify-between h-[500px] overflow-hidden animate-fade-in">
            {/* 본문: 대형 원형 게이지 & 세부 진행률/2x2 지표 카드 */}
            <div className="flex-1 py-1 flex flex-col lg:flex-row items-center justify-between gap-8 min-h-0">
              {/* 좌측: 자산비중 도넛 크기(260px)에 맞춘 대형 원형 프로그레스 게이지 */}
              <div className="flex flex-col items-center justify-center relative lg:w-[300px] shrink-0">
                <div className="relative w-[250px] h-[250px] md:w-[260px] md:h-[260px] flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 260 260">
                    <defs>
                      <linearGradient id="goalProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        {goalStats.isReached ? (
                          <>
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#059669" />
                          </>
                        ) : (
                          <>
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#6366f1" />
                          </>
                        )}
                      </linearGradient>
                    </defs>
                    {/* 트랙 배경원 */}
                    <circle
                      cx="130"
                      cy="130"
                      r="110"
                      fill="transparent"
                      stroke="#f1f5f9"
                      strokeWidth="18"
                    />
                    {/* 진행률 원 */}
                    <circle
                      cx="130"
                      cy="130"
                      r="110"
                      fill="transparent"
                      stroke="url(#goalProgressGrad)"
                      strokeWidth="18"
                      strokeDasharray={2 * Math.PI * 110}
                      strokeDashoffset={(2 * Math.PI * 110) * (1 - Math.min(goalStats.progressPercent, 100) / 100)}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                    <span className="text-xs font-semibold text-slate-400 mb-0.5">목표 달성률</span>
                    <div key={`gauge-pct-${targetGoal}`} className="flex items-baseline justify-center gap-0.5 my-1 animate-summary-pop">
                      <span className={`text-4xl font-black tracking-tight ${goalStats.isReached ? 'text-emerald-600' : 'text-slate-800'}`}>
                        <AnimatedTradeCounter value={goalStats.progressPercent} formatType="percent" duration={700} />
                      </span>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full mt-1.5 ${
                      goalStats.isReached ? 'bg-emerald-100/80 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {goalStats.isReached ? '🎉 목표 도달' : `${formatKoreanWon(goalStats.remaining)} 남음`}
                    </span>
                  </div>
                </div>
              </div>

              {/* 우측: 빠른 목표 선택 & 금액 변경 + 진행 바 + 2x2 지표 카드 */}
              <div className="flex-1 w-full flex flex-col justify-between gap-3 min-h-0">
                {/* 상단: 빠른 목표 선택 + 20억원 뒤에 목표 금액 변경 버튼 */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Sparkles size={13} className="text-amber-500" />
                    <span>목표 선택:</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[100000000, 300000000, 500000000, 1000000000, 2000000000].map((amt) => {
                      const isCurrent = targetGoal === amt;
                      return (
                        <button
                          key={amt}
                          onClick={() => handleQuickSetGoal(amt)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 active:scale-95'
                          }`}
                        >
                          {formatKoreanWon(amt)}
                        </button>
                      );
                    })}
                    {/* 20억원 뒤에 금액 변경 버튼 배치 */}
                    <button
                      onClick={() => {
                        setGoalInputTemp(String(targetGoal));
                        setIsGoalModalClosing(false);
                        setIsGoalModalOpen(true);
                      }}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 shadow-2xs transition-all cursor-pointer active:scale-95 ml-1"
                    >
                      <Pencil size={12} className="text-slate-500" />
                      <span>금액 변경</span>
                    </button>
                  </div>
                </div>

                {/* 진행 바 */}
                <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm flex-wrap gap-1">
                    <span className="font-semibold text-slate-600">
                      현재 자산:{" "}
                      <span key={`header-asset-${totalEvalAmount}`} className="inline-block animate-summary-pop">
                        <strong className="text-slate-800 font-bold">
                          <AnimatedTradeCounter value={totalEvalAmount} duration={700} />원
                        </strong>{" "}
                        <span className="text-slate-500 font-medium">
                          (<AnimatedTradeCounter value={totalEvalAmount} formatType="koreanWon" duration={700} />)
                        </span>
                      </span>
                    </span>
                    <span className="font-semibold text-slate-600">
                      목표:{" "}
                      <span key={`header-goal-${targetGoal}`} className="inline-block animate-summary-pop">
                        <strong className="text-blue-600 font-bold">
                          <AnimatedTradeCounter value={goalStats.goal} duration={700} />원
                        </strong>{" "}
                        <span className="text-blue-500 font-medium">
                          (<AnimatedTradeCounter value={goalStats.goal} formatType="koreanWon" duration={700} />)
                        </span>
                      </span>
                    </span>
                  </div>
                  <div className="h-3 w-full bg-slate-200/70 rounded-full overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${
                        goalStats.isReached
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500'
                      }`}
                      style={{ width: `${Math.min(goalStats.progressPercent, 100)}%` }}
                    />
                  </div>
                  {/* 현재 페이스 기준 달성 예상 한 줄 안내 */}
                  <div className="flex items-center justify-between text-[11px] pt-0.5 text-slate-500 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Clock size={12} className="text-blue-500 shrink-0" />
                      <span className="shrink-0">현재 페이스 기준:</span>
                      <div key={`pace-date-full-${targetGoal}-${goalPaceMode}`} className="inline-flex items-center gap-1 animate-summary-pop flex-wrap">
                        <strong className="text-blue-600 font-bold">
                          {goalStats.isReached ? '목표 달성 완료!' : `${goalStats.projectedDateText} 달성 예상`}
                        </strong>
                        {!goalStats.isReached && goalStats.durationText && (
                          <span className="text-slate-400 font-normal">
                            ({goalStats.durationText})
                          </span>
                        )}
                      </div>
                    </div>
                    {!goalStats.isReached && goalStats.monthlyPace > 0 && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* 전체 / 1년 미니 토글 캡슐 (위치 고정) */}
                        <div className="inline-flex bg-slate-200/80 p-0.5 rounded-md text-[10px] font-bold shrink-0">
                          <button
                            type="button"
                            onClick={() => handlePaceModeChange("all")}
                            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                              goalPaceMode === "all"
                                ? "bg-white text-blue-600 shadow-2xs font-extrabold"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                            title="투자 시작일(0원)부터 현재까지 전체 기간 평균 증가 속도"
                          >
                            전체
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePaceModeChange("1y")}
                            className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                              goalPaceMode === "1y"
                                ? "bg-white text-blue-600 shadow-2xs font-extrabold"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                            title="최근 1년 동안의 실제 자산 증가 속도"
                          >
                            1년
                          </button>
                        </div>
                        {/* 금액 길이에 따른 알약 위치 흔들림 방지 (고정폭 120px & 우측 정렬) */}
                        <span className="text-[11px] text-slate-500 font-medium w-[120px] inline-block text-right whitespace-nowrap">
                          월평균 :{" "}
                          <strong key={`pace-val-${goalPaceMode}`} className="text-slate-700 font-bold inline-block animate-summary-pop tabular-nums">
                            +{formatKoreanWon(Math.round(goalStats.monthlyPace))}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4대 핵심 지표 2열 배치 (1줄: 목표자산/남은금액, 2줄: 수익금기여도/달성예상시점) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* 1행 1열: 목표 자산 */}
                  <div className="bg-white rounded-xl p-3 border border-slate-200/70 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-bold text-slate-500">목표 자산</span>
                      <Trophy size={14} className="text-blue-500" />
                    </div>
                    <div key={`goal-num-${targetGoal}`} className="my-1 animate-summary-pop text-right">
                      <span className="text-lg font-black text-slate-800">
                        <AnimatedTradeCounter value={goalStats.goal} duration={700} />원
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 truncate">
                      <AnimatedTradeCounter value={goalStats.goal} formatType="koreanWon" duration={700} />
                    </span>
                  </div>

                  {/* 1행 2열: 남은 금액 / 초과 달성 */}
                  <div className="bg-white rounded-xl p-3 border border-slate-200/70 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-bold text-slate-500">
                        {goalStats.isReached ? '초과 달성액' : '남은 금액'}
                      </span>
                      <Coins size={14} className="text-amber-500" />
                    </div>
                    <div key={`remain-num-${targetGoal}`} className="my-1 animate-summary-pop text-right">
                      <span className={`text-lg font-black ${goalStats.isReached ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {goalStats.isReached && '+'}
                        <AnimatedTradeCounter 
                          value={goalStats.isReached ? goalStats.exceeded : goalStats.remaining} 
                          duration={700} 
                        />원
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 truncate">
                      {goalStats.isReached ? (
                        <>+<AnimatedTradeCounter value={goalStats.exceeded} formatType="koreanWon" duration={700} /> 초과 달성</>
                      ) : (
                        <AnimatedTradeCounter value={goalStats.remaining} formatType="koreanWon" duration={700} />
                      )}
                    </span>
                  </div>

                  {/* 2행 1열: 투자 수익금 기여율 */}
                  <div className="bg-white rounded-xl p-3 border border-slate-200/70 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-xs font-bold text-slate-500">수익금 기여도</span>
                      <Sparkles size={14} className="text-indigo-500" />
                    </div>
                    <div key={`profit-num-${targetGoal}`} className="my-1 animate-summary-pop flex items-baseline justify-end gap-1">
                      <span className={`text-lg font-black ${totalProfitAmount > 0 ? 'text-blue-600' : totalProfitAmount < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                        <AnimatedTradeCounter value={goalStats.profitContribution} formatType="percent" duration={700} />
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">목표 기여</span>
                    </div>
                    <span className="text-[11px] text-slate-400 truncate">
                      누적 손익 {totalProfitAmount > 0 ? '+' : ''}{(totalProfitAmount || 0).toLocaleString()}원
                    </span>
                  </div>

                  {/* 2행 2열: 현재 페이스 기준 달성 예상 시점 */}
                  <div className="bg-white rounded-xl p-3 border border-slate-200/70 shadow-2xs flex flex-col justify-between relative overflow-hidden">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className={`text-xs font-bold ${
                        goalStats.isReached ? 'text-emerald-600' : 'text-blue-600'
                      }`}>
                        달성 예상 시점
                      </span>
                      <Calendar size={14} className={goalStats.isReached ? 'text-emerald-500' : 'text-blue-600'} />
                    </div>
                    <div key={`projected-num-${targetGoal}-${goalPaceMode}`} className="my-1 animate-summary-pop text-right">
                      <span className={`text-lg font-black ${goalStats.isReached ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {goalStats.projectedDateText}
                      </span>
                    </div>
                    <span key={`projected-sub-${targetGoal}-${goalPaceMode}`} className="text-[11px] text-slate-500 truncate font-medium inline-block animate-summary-pop">
                      {goalStats.projectedSubText}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 하단 푸터: 로컬 스토리지 안내 */}
            <div className="shrink-0 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <Wallet size={14} className="text-slate-400" />
                <span>목표 금액은 브라우저에 자동 저장되어 다음 접속 시에도 동일하게 유지됩니다.</span>
              </div>
              <span className="hidden sm:inline text-xs text-slate-400">기본값: 10억 원</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* 좌측: 아이콘 + 타이틀 + 뱃지 + 서브텍스트 (탭 전환 시 부드러운 애니메이션 효과) */}
          <div key={holdingTab} className="flex items-start gap-3 animate-header-switch">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs mt-0.5 ${
              holdingTab === "account"
                ? "bg-amber-50 text-amber-600 border-amber-100/70"
                : "bg-sky-50 text-sky-600 border-sky-100/70"
            }`}>
              {holdingTab === "account" ? (
                <Wallet size={20} strokeWidth={2.5} />
              ) : (
                <LayoutList size={20} strokeWidth={2.5} />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                  {holdingTab === "account" ? "계좌별 보유현황" : "종목별 보유현황"}
                </h2>
                {user && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    holdingTab === "account"
                      ? "bg-amber-50 text-amber-700 border-amber-200/60"
                      : "bg-sky-50 text-sky-700 border-sky-200/60"
                  }`}>
                    {holdingTab === "account"
                      ? `총 ${Object.keys(holdingsByAccount || {}).length}개 계좌 관리`
                      : `총 ${holdingsSummary.count}개 종목 보유`}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {holdingTab === "account"
                  ? "등록된 증권 계좌별 자산 분배 현황과 각 계좌의 상세 포트폴리오를 관리합니다."
                  : "보유 중인 국내 및 해외 개별 종목의 실시간 평가손익과 상세 수익률을 확인합니다."}
              </p>
            </div>
          </div>

          {/* 우측: 탭 전환 (종목별 | 계좌별) */}
          <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 self-start md:self-auto">
            <button
              onClick={() => {
                setHoldingTab("stock");
                setCurrencyFilter("ALL");
                setCurrentStockPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                holdingTab === "stock"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              종목별
            </button>
            <button
              onClick={() => {
                setHoldingTab("account");
                setCurrencyFilter("ALL");
                const accounts = Object.keys(holdingsByAccount || {});
                if (accounts.length > 0) {
                  setSelectedAccount(accounts[0]);
                }
                setCurrentStockPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                holdingTab === "account"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              계좌별
            </button>
          </div>
        </div>

        {/* 상단 4대 핵심 요약 카드 (통합 합계) */}
        {user && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
            {/* 1. 총 손익 (손익 + 배당) */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-slate-500">총 손익</span>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                  (holdingsSummary.isOverseas ? holdingsSummary.foreignSumProfitUSD : holdingsSummary.totalSumProfitKRW) > 0 
                    ? 'bg-red-50 text-red-600' 
                    : (holdingsSummary.isOverseas ? holdingsSummary.foreignSumProfitUSD : holdingsSummary.totalSumProfitKRW) < 0 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'bg-slate-100 text-slate-600'
                }`}>
                  {(holdingsSummary.isOverseas ? holdingsSummary.foreignSumProfitUSD : holdingsSummary.totalSumProfitKRW) > 0 ? '+' : ''}
                  {(holdingsSummary.isOverseas ? holdingsSummary.foreignReturnRate : holdingsSummary.totalReturnRate).toFixed(2)}%
                </span>
              </div>
              <div className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none">
                <span className={`text-2xl font-black tabular-nums tracking-tight cursor-default select-none ${
                  (holdingsSummary.isOverseas ? holdingsSummary.foreignSumProfitUSD : holdingsSummary.totalSumProfitKRW) > 0 
                    ? 'text-red-600' 
                    : (holdingsSummary.isOverseas ? holdingsSummary.foreignSumProfitUSD : holdingsSummary.totalSumProfitKRW) < 0 
                      ? 'text-blue-600' 
                      : 'text-slate-800'
                }`}>
                  <AnimatedTradeCounter
                    key={`card1-${holdingTab}-${selectedAccount}-${currencyFilter}-${holdingsSummary.isOverseas ? 'usd' : 'krw'}`}
                    value={holdingsSummary.isOverseas ? holdingsSummary.foreignSumProfitUSD : holdingsSummary.totalSumProfitKRW}
                    isForeign={holdingsSummary.isOverseas}
                    showSign={true}
                    duration={800}
                  />
                </span>
                {!holdingsSummary.isOverseas && (
                  <span className="text-xs font-bold text-slate-400">원</span>
                )}
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-50 pt-2">
                <span>총매수금액 + 총손익</span>
                <span className="font-semibold text-slate-500">
                  <AnimatedTradeCounter
                    key={`card1-sub-${holdingTab}-${selectedAccount}-${currencyFilter}-${holdingsSummary.isOverseas ? 'usd' : 'krw'}`}
                    value={holdingsSummary.isOverseas 
                      ? (holdingsSummary.foreignCostUSD + holdingsSummary.foreignSumProfitUSD) 
                      : (holdingsSummary.totalCostKRW + holdingsSummary.totalSumProfitKRW)}
                    isForeign={holdingsSummary.isOverseas}
                    duration={800}
                  />
                  {!holdingsSummary.isOverseas && "원"}
                </span>
              </div>
              <div className={`absolute top-0 left-0 w-1 h-full ${
                (holdingsSummary.isOverseas ? holdingsSummary.foreignSumProfitUSD : holdingsSummary.totalSumProfitKRW) > 0 
                  ? 'bg-red-500' 
                  : (holdingsSummary.isOverseas ? holdingsSummary.foreignSumProfitUSD : holdingsSummary.totalSumProfitKRW) < 0 
                    ? 'bg-blue-500' 
                    : 'bg-slate-300'
              }`}></div>
            </div>

            {/* 2. 평가손익 */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-slate-500">평가손익</span>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                  (holdingsSummary.isOverseas ? holdingsSummary.foreignProfitUSD : holdingsSummary.totalProfitKRW) > 0 
                    ? 'bg-red-50 text-red-600' 
                    : (holdingsSummary.isOverseas ? holdingsSummary.foreignProfitUSD : holdingsSummary.totalProfitKRW) < 0 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'bg-slate-100 text-slate-600'
                }`}>
                  {(holdingsSummary.isOverseas ? holdingsSummary.foreignProfitUSD : holdingsSummary.totalProfitKRW) > 0 ? '+' : ''}
                  {(holdingsSummary.isOverseas ? holdingsSummary.foreignProfitRate : holdingsSummary.totalProfitRate).toFixed(2)}%
                </span>
              </div>
              <div className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none">
                <span className={`text-2xl font-black tabular-nums tracking-tight cursor-default select-none ${
                  (holdingsSummary.isOverseas ? holdingsSummary.foreignProfitUSD : holdingsSummary.totalProfitKRW) > 0 
                    ? 'text-red-600' 
                    : (holdingsSummary.isOverseas ? holdingsSummary.foreignProfitUSD : holdingsSummary.totalProfitKRW) < 0 
                      ? 'text-blue-600' 
                      : 'text-slate-800'
                }`}>
                  <AnimatedTradeCounter
                    key={`card2-${holdingTab}-${selectedAccount}-${currencyFilter}-${holdingsSummary.isOverseas ? 'usd' : 'krw'}`}
                    value={holdingsSummary.isOverseas ? holdingsSummary.foreignProfitUSD : holdingsSummary.totalProfitKRW}
                    isForeign={holdingsSummary.isOverseas}
                    showSign={true}
                    duration={800}
                  />
                </span>
                {!holdingsSummary.isOverseas && (
                  <span className="text-xs font-bold text-slate-400">원</span>
                )}
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-50 pt-2">
                <span>총매수금액 + 평가손익</span>
                <span className="font-semibold text-slate-500">
                  <AnimatedTradeCounter
                    key={`card2-sub-${holdingTab}-${selectedAccount}-${currencyFilter}-${holdingsSummary.isOverseas ? 'usd' : 'krw'}`}
                    value={holdingsSummary.isOverseas 
                      ? (holdingsSummary.foreignCostUSD + holdingsSummary.foreignProfitUSD) 
                      : (holdingsSummary.totalCostKRW + holdingsSummary.totalProfitKRW)}
                    isForeign={holdingsSummary.isOverseas}
                    duration={800}
                  />
                  {!holdingsSummary.isOverseas && "원"}
                </span>
              </div>
              <div className={`absolute top-0 left-0 w-1 h-full ${
                (holdingsSummary.isOverseas ? holdingsSummary.foreignProfitUSD : holdingsSummary.totalProfitKRW) > 0 
                  ? 'bg-red-500' 
                  : (holdingsSummary.isOverseas ? holdingsSummary.foreignProfitUSD : holdingsSummary.totalProfitKRW) < 0 
                    ? 'bg-blue-500' 
                    : 'bg-slate-300'
              }`}></div>
            </div>

            {/* 3. 누적 배당금 */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-slate-500">누적 배당금</span>
                <Coins size={16} className="text-emerald-500" />
              </div>
              <div className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none">
                <span className="text-2xl font-black text-emerald-600 tabular-nums tracking-tight cursor-default select-none">
                  <AnimatedTradeCounter
                    key={`card3-${holdingTab}-${selectedAccount}-${currencyFilter}-${holdingsSummary.isOverseas ? 'usd' : 'krw'}`}
                    value={holdingsSummary.isOverseas ? holdingsSummary.foreignDivUSD : holdingsSummary.totalDivKRW}
                    isForeign={holdingsSummary.isOverseas}
                    showSign={true}
                    duration={800}
                  />
                </span>
                {!holdingsSummary.isOverseas && (
                  <span className="text-xs font-bold text-slate-400">원</span>
                )}
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-50 pt-2">
                <span>보유기간 배당금</span>
                <span className="font-semibold text-slate-500">배당 수익</span>
              </div>
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
            </div>

            {/* 4. 총 매수금액 */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default select-none">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-slate-500">총 매수금액</span>
                <Wallet size={16} className="text-slate-400" />
              </div>
              <div className="flex items-baseline justify-end gap-1 mt-1 cursor-default select-none">
                <span className="text-2xl font-black text-slate-800 tabular-nums tracking-tight cursor-default select-none">
                  <AnimatedTradeCounter
                    key={`card4-${holdingTab}-${selectedAccount}-${currencyFilter}-${holdingsSummary.isOverseas ? 'usd' : 'krw'}`}
                    value={holdingsSummary.isOverseas ? holdingsSummary.foreignCostUSD : holdingsSummary.totalCostKRW}
                    isForeign={holdingsSummary.isOverseas}
                    showSign={false}
                    duration={800}
                  />
                </span>
                {!holdingsSummary.isOverseas && (
                  <span className="text-xs font-bold text-slate-400">원</span>
                )}
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-50 pt-2">
                <span>수량 × 평균매수가 합계</span>
                <span className="font-semibold text-slate-500">투자원금</span>
              </div>
              <div className="absolute top-0 left-0 w-1 h-full bg-slate-400"></div>
            </div>
          </div>
        )}

        {/* 컨트롤 & 필터 바 */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-1">
          {/* 좌측: 카드형 / 리스트형 뷰모드 토글 */}
          <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setStockViewMode("card")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                stockViewMode === 'card' 
                  ? 'bg-white text-slate-800 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutDashboard size={14} />
              <span>카드형</span>
            </button>
            <button
              onClick={() => setStockViewMode("table")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                stockViewMode === 'table' 
                  ? 'bg-white text-slate-800 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List size={14} />
              <span>리스트형</span>
            </button>
          </div>

          {/* 중간: 계좌 목록 (계좌별 탭 선택 시 노출) */}
          {holdingTab === "account" && Object.keys(holdingsByAccount || {}).length > 0 && (
            <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full">
              {Object.keys(holdingsByAccount).map((acc) => (
                <button
                  key={acc}
                  onClick={() => {
                    setSelectedAccount(acc);
                    setCurrentStockPage(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedAccount === acc
                      ? 'bg-white text-slate-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {acc}
                </button>
              ))}
            </div>
          )}

          {/* 우측: 전체/국내/해외 탭 + 정렬 드롭다운 */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end shrink-0">
            <div className="flex bg-slate-100 p-1 rounded-xl">
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
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs select-none ${
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

        {/* 메인 뷰: 카드형 / 리스트형 */}
        {stockViewMode === "card" ? (
          <div className="flex flex-col">
            <div key={`stock-grid-${holdingTab}-${selectedAccount}-${currentStockPage}-${currencyFilter}-${sortBy}`} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {paginatedHoldings.length === 0 ? (
                <div className="col-span-full h-[416px] flex items-center justify-center rounded-2xl border border-slate-100 bg-white shadow-sm text-slate-400 text-sm font-medium">
                  조회된 보유 종목이 없습니다.
                </div>
              ) : (
                <>
                  {paginatedHoldings.map((h, i) => {
                    const s = getCurrencyStyle(h.currency);
                    const isKRW = h.currency === 'KRW';
                    return (
                      <div key={`stock-card-${h.code || ''}-${h.name || ''}-${i}`} className={`relative bg-white p-4 pt-5 rounded-2xl border ${s.border} hover:shadow-lg transition-all h-[200px] flex flex-col justify-between opacity-0 animate-page-slide stagger-${i + 1} overflow-hidden`}>
                        <div className={`absolute top-0 left-0 right-0 h-1.5 ${s.accent}`}></div>
                        <div className="flex justify-between items-start gap-4">
                           <div className="flex-1 min-w-0 flex items-start gap-2">
                             <StockLogo code={h.code} name={h.name} isKRW={isKRW} />
                             <div className="flex-1 min-w-0">
                               <div className="font-bold text-slate-800 truncate mb-0.5" title={h.name}>{h.name}</div>
                               <div className="text-[12px] text-slate-400 font-mono truncate">{formatStockCode(h.code)}</div>
                             </div>
                           </div>
                           <div className="text-right shrink-0">
                             <div className="text-lg font-bold text-slate-800 whitespace-nowrap">{h.currentPrice ? `${getCurrencySymbol(h.currency)}${formatCurrency(h.currentPrice, h.currency)}` : '-'}</div><div className="text-xs text-slate-500">현재가</div>
                           </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm"><div className="text-slate-600">보유수량</div><div className="font-medium">{formatCurrency(h.totalQuantity, 'QTY')}주</div></div>
                          <div className="flex justify-between items-center text-sm"><div className="text-slate-600">매수가</div><div className="font-medium">{getCurrencySymbol(h.currency)}{formatCurrency(h.purchasePrice, h.currency)}</div></div>
                          <div className="pt-2 border-t flex justify-between items-center"><div className="text-sm font-bold text-brand-dark">평가액</div><div className="text-xl font-black text-brand-dark">{formatCurrency(h.evaluationAmountKRW, 'KRW')}</div></div>
                        </div>
                      </div>
                    );
                  })}
                  {paginatedHoldings.length < STOCKS_PER_PAGE &&
                    [...Array(STOCKS_PER_PAGE - paginatedHoldings.length)].map((_, i) => (
                      <div
                        key={`empty-card-${i}`}
                        className={`relative bg-white p-4 pt-5 rounded-2xl border border-slate-200/80 transition-all h-[200px] flex flex-col justify-between opacity-0 animate-page-slide stagger-${paginatedHoldings.length + i + 1} overflow-hidden select-none pointer-events-none`}
                      >
                        {/* 상단 회색 바 */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-300"></div>

                        {/* 상단: 로고 / 종목명 / 현재가 */}
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 min-w-0 flex items-start gap-2">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold shrink-0 bg-slate-100 text-slate-300 text-xs">
                              -
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-slate-300 truncate mb-0.5">-</div>
                              <div className="text-[12px] text-slate-300 font-mono truncate">-</div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg font-bold text-slate-300 whitespace-nowrap">-</div>
                            <div className="text-xs text-slate-400">현재가</div>
                          </div>
                        </div>

                        {/* 하단: 보유수량 / 매수가 / 평가액 (중간에 매수가와 평가액 사이 줄 포함) */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <div className="text-slate-500">보유수량</div>
                            <div className="font-medium text-slate-400">-</div>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <div className="text-slate-500">매수가</div>
                            <div className="font-medium text-slate-400">-</div>
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                            <div className="text-sm font-bold text-slate-500">평가액</div>
                            <div className="text-xl font-black text-slate-400">-</div>
                          </div>
                        </div>
                      </div>
                    ))}
                </>
              )}
            </div>

            {/* 페이지네이션 */}
            {totalStockPages > 1 && (
              <div className="mt-1 flex items-center justify-center gap-2 select-none">
                <button
                  onClick={() => setCurrentStockPage(1)}
                  disabled={currentStockPage === 1}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    currentStockPage === 1
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer active:scale-95'
                  }`}
                >
                  <ChevronsLeft size={18} />
                </button>
                <button
                  onClick={() => setCurrentStockPage(prev => Math.max(1, prev - 1))}
                  disabled={currentStockPage === 1}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    currentStockPage === 1
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer active:scale-95'
                  }`}
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="flex items-center gap-1.5 mx-1">
                  {Array.from({ length: totalStockPages }, (_, idx) => idx + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentStockPage(pageNum)}
                      className={`w-10 h-10 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                        currentStockPage === pageNum
                          ? 'bg-brand text-white shadow-md shadow-brand/20'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setCurrentStockPage(prev => Math.min(totalStockPages, prev + 1))}
                  disabled={currentStockPage >= totalStockPages}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    currentStockPage >= totalStockPages
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer active:scale-95'
                  }`}
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  onClick={() => setCurrentStockPage(totalStockPages)}
                  disabled={currentStockPage >= totalStockPages}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    currentStockPage >= totalStockPages
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer active:scale-95'
                  }`}
                >
                  <ChevronsRight size={18} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm mb-6 h-[416px]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="h-[54px] bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-500">종목</th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-slate-500">수량</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">평균 매수가</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">현재가</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">평가손익</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">배당금</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-500">총 손익</th>
                  </tr>
                </thead>
                <tbody key={`holdings-list-${holdingTab}-${selectedAccount}-${currentStockPage}-${currencyFilter}-${sortBy}`} className="divide-y divide-slate-50">
                  {paginatedHoldings.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="h-[360px] text-center text-slate-400 text-sm font-medium">
                        조회된 보유 종목이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    paginatedHoldings.map((h, i) => {
                      const isKRW = h.currency === 'KRW';
                      const showOverseasAmount = currencyFilter === "OVERSEAS";

                      const buyPrice = Number(h.purchasePrice) || 0;
                      const currentPrice = Number(h.currentPrice || h.purchasePrice) || 0;
                      const qty = Number(h.totalQuantity) || 0;
                      const exRate = Number(h.exchangeRate) || 1;

                      // 원화 환산 가격
                      const buyPriceKRW = Math.round(isKRW ? buyPrice : buyPrice * exRate);
                      const currentPriceKRW = Math.round(isKRW ? currentPrice : currentPrice * exRate);

                      // 외화 손익 계산
                      const foreignCost = buyPrice * qty;
                      const foreignEval = currentPrice * qty;
                      const foreignProfit = foreignEval - foreignCost;
                      const foreignDiv = Number(h.foreignDividend) || 0;
                      const foreignTotalProfit = foreignProfit + foreignDiv;

                      // 수익률
                      const profitRate = parseFloat(h.returnRate) || 0;
                      const totalReturnRate = parseFloat(h.totalReturnRate) || 0;
                      const foreignProfitRate = foreignCost > 0 ? (foreignProfit / foreignCost) * 100 : 0;
                      const foreignTotalReturnRate = foreignCost > 0 ? (foreignTotalProfit / foreignCost) * 100 : 0;

                      const isProfit = (h.profitAmountKRW || 0) > 0;
                      const isLoss = (h.profitAmountKRW || 0) < 0;
                      const totalProfitVal = (h.profitAmountKRW || 0) + (h.dividend || 0);
                      const isTotalProfit = totalProfitVal > 0;
                      const isTotalLoss = totalProfitVal < 0;

                      return (
                        <tr
                          key={`stock-row-${h.code || ''}-${h.name || ''}-${i}`}
                          className="h-[72px] hover:bg-slate-50/80 transition-colors opacity-0 animate-row-fade"
                          style={{ animationDelay: `${i * 35}ms` }}
                        >
                          {/* 1열: 종목 */}
                          <td className="px-6 py-2">
                            <div className="flex items-center gap-3 min-h-[52px]">
                              <StockLogo code={h.code} name={h.name} isKRW={isKRW} />
                              <div className="flex flex-col justify-center max-w-[240px]">
                                <p className="text-sm text-slate-900 font-bold leading-tight truncate" title={h.name}>
                                  {h.name}
                                </p>
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="font-mono text-slate-400 font-medium text-[11px] w-[62px] shrink-0 truncate">
                                    {formatStockCode(h.code)}
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

                          {/* 2열: 수량 */}
                          <td className="px-4 py-2.5 text-center">
                            <span className="text-sm font-bold text-slate-700 tabular-nums">
                              {formatCurrency(qty, 'QTY')}주
                            </span>
                          </td>

                          {/* 3열: 평균 매수가 */}
                          <td className="px-6 py-2.5 text-right">
                            <div className="flex flex-col items-end justify-center">
                              {showOverseasAmount ? (
                                <span className="text-sm font-bold text-slate-700 tabular-nums">
                                  {formatForeignAmount(buyPrice, h.currency)}
                                </span>
                              ) : (
                                <>
                                  {!isKRW ? (
                                    <>
                                      <span className="text-sm font-bold text-slate-700 tabular-nums">
                                        {formatForeignAmount(buyPrice, h.currency)}
                                      </span>
                                      <span className="text-[11px] font-semibold text-slate-400 tabular-nums mt-0.5">
                                        {formatCurrency(buyPriceKRW)}원
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-sm font-bold text-slate-700 tabular-nums">
                                      {formatCurrency(buyPrice)}원
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </td>

                          {/* 4열: 현재가 */}
                          <td className="px-6 py-2.5 text-right">
                            <div className="flex flex-col items-end justify-center">
                              {showOverseasAmount ? (
                                <span className="text-sm font-bold text-slate-700 tabular-nums">
                                  {formatForeignAmount(currentPrice, h.currency)}
                                </span>
                              ) : (
                                <>
                                  {!isKRW ? (
                                    <>
                                      <span className="text-sm font-bold text-slate-700 tabular-nums">
                                        {formatForeignAmount(currentPrice, h.currency)}
                                      </span>
                                      <span className="text-[11px] font-semibold text-slate-400 tabular-nums mt-0.5">
                                        {formatCurrency(currentPriceKRW)}원
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-sm font-bold text-slate-700 tabular-nums">
                                      {formatCurrency(currentPrice)}원
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </td>

                          {/* 5열: 평가손익 */}
                          <td className="px-6 py-2.5 text-right">
                            <div className="flex flex-col items-end justify-center">
                              <span className={`text-sm font-bold tabular-nums ${
                                isProfit ? 'text-red-600' : isLoss ? 'text-blue-600' : 'text-slate-600'
                              }`}>
                                {showOverseasAmount
                                  ? formatForeignAmount(foreignProfit, h.currency, true)
                                  : `${isProfit ? '+' : ''}${formatCurrency(h.profitAmountKRW)}원`}
                              </span>
                              <span className={`text-[11px] font-semibold tabular-nums mt-0.5 ${
                                isProfit ? 'text-red-600/80' : isLoss ? 'text-blue-600/80' : 'text-slate-400'
                              }`}>
                                ({showOverseasAmount
                                  ? `${foreignProfitRate > 0 ? '+' : ''}${foreignProfitRate.toFixed(2)}%`
                                  : `${profitRate > 0 ? '+' : ''}${profitRate.toFixed(2)}%`})
                              </span>
                            </div>
                          </td>

                          {/* 6열: 배당금 */}
                          <td className="px-6 py-2.5 text-right">
                            <div className="flex flex-col items-end justify-center">
                              {showOverseasAmount ? (
                                <span className={`text-sm font-bold tabular-nums ${
                                  foreignDiv > 0 ? 'text-emerald-600' : 'text-slate-400'
                                }`}>
                                  {foreignDiv > 0
                                    ? `+${formatForeignAmount(foreignDiv, h.currency)}`
                                    : formatForeignAmount(0, h.currency)}
                                </span>
                              ) : (
                                <span className={`text-sm font-bold tabular-nums ${
                                  (h.dividend || 0) > 0 ? 'text-emerald-600' : 'text-slate-400'
                                }`}>
                                  {(h.dividend || 0) > 0 ? `+${formatCurrency(h.dividend)}원` : '0원'}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 7열: 총 손익 */}
                          <td className="px-6 py-2.5 text-right bg-slate-50/30">
                            <div className="flex flex-col items-end justify-center">
                              <span className={`text-base font-black tabular-nums tracking-tight ${
                                isTotalProfit ? 'text-red-600' : isTotalLoss ? 'text-blue-600' : 'text-slate-800'
                              }`}>
                                {showOverseasAmount
                                  ? formatForeignAmount(foreignTotalProfit, h.currency, true)
                                  : `${isTotalProfit ? '+' : ''}${formatCurrency(totalProfitVal)}원`}
                              </span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className={`text-xs font-black tabular-nums ${
                                  isTotalProfit ? 'text-red-600' : isTotalLoss ? 'text-blue-600' : 'text-slate-500'
                                }`}>
                                  ({showOverseasAmount
                                    ? `${foreignTotalReturnRate > 0 ? '+' : ''}${foreignTotalReturnRate.toFixed(2)}%`
                                    : `${totalReturnRate > 0 ? '+' : ''}${totalReturnRate.toFixed(2)}%`})
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    }).concat(
                      paginatedHoldings.length > 0 && paginatedHoldings.length < ITEMS_PER_PAGE ?
                      [...Array(ITEMS_PER_PAGE - paginatedHoldings.length)].map((_, i) => (
                        <tr
                          key={`empty-${i}`}
                          className={`h-[72px] opacity-0 animate-row-fade stagger-${paginatedHoldings.length + i + 1} pointer-events-none select-none`}
                        >
                          <td colSpan="7" className="px-6 py-2">
                            <div className="min-h-[52px]">&nbsp;</div>
                          </td>
                        </tr>
                      )) : []
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {totalStockPages > 1 && (
              <div className="mt-1 flex items-center justify-center gap-2 select-none">
                <button
                  onClick={() => setCurrentStockPage(1)}
                  disabled={currentStockPage === 1}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    currentStockPage === 1
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer active:scale-95'
                  }`}
                >
                  <ChevronsLeft size={18} />
                </button>
                <button
                  onClick={() => setCurrentStockPage(prev => Math.max(1, prev - 1))}
                  disabled={currentStockPage === 1}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    currentStockPage === 1
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer active:scale-95'
                  }`}
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="flex items-center gap-1.5 mx-1">
                  {Array.from({ length: totalStockPages }, (_, idx) => idx + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentStockPage(pageNum)}
                      className={`w-10 h-10 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                        currentStockPage === pageNum
                          ? 'bg-brand text-white shadow-md shadow-brand/20'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setCurrentStockPage(prev => Math.min(totalStockPages, prev + 1))}
                  disabled={currentStockPage >= totalStockPages}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    currentStockPage >= totalStockPages
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer active:scale-95'
                  }`}
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  onClick={() => setCurrentStockPage(totalStockPages)}
                  disabled={currentStockPage >= totalStockPages}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    currentStockPage >= totalStockPages
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer active:scale-95'
                  }`}
                >
                  <ChevronsRight size={18} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      </>
      ) : null}

      {/* 데스크톱 섹션 닫기 */}
      </div>

      {/* 목표 금액 수정 모달 */}
      {isGoalModalOpen && (
        <div 
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs ${
            isGoalModalClosing ? 'animate-fade-out pointer-events-none' : 'animate-fade-in'
          }`}
          onClick={handleCloseGoalModal}
        >
          <div 
            className={`bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 flex flex-col gap-5 ${
              isGoalModalClosing ? 'animate-modal-out' : 'animate-page-slide'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Trophy size={18} className="text-brand" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">목표 자산 금액 변경</h3>
                  <span className="text-[11px] text-slate-400">나만의 포트폴리오 목표 금액을 설정하세요</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseGoalModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* 모달 본문 */}
            <div className="flex flex-col gap-3">
              <label className="text-xs font-semibold text-slate-500">금액 입력(원 단위)</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={goalInputTemp ? Number(goalInputTemp.replace(/[^0-9]/g, '')).toLocaleString('ko-KR') : ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    setGoalInputTemp(raw);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (Number(goalInputTemp) > 0) {
                        handleSaveGoal(goalInputTemp);
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      handleCloseGoalModal();
                    }
                  }}
                  placeholder="예: 1,000,000,000"
                  className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                  autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none select-none">
                  원
                </span>
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-slate-400">목표 금액:</span>
                <span className="text-sm font-bold text-blue-600">
                  {formatKoreanWon(Number(goalInputTemp) || 0)}
                </span>
              </div>

              {/* 빠른 증감 버튼 */}
              <div className="flex flex-wrap gap-1.5 pt-2">
                {[
                  { label: "+1,000만", add: 10000000 },
                  { label: "+5,000만", add: 50000000 },
                  { label: "+1억", add: 100000000 },
                  { label: "+5억", add: 500000000 },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      const current = Number(goalInputTemp) || 0;
                      setGoalInputTemp(String(Math.max(0, current + item.add)));
                    }}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 rounded-lg text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setGoalInputTemp("1000000000")}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 rounded-lg text-xs font-semibold text-slate-400 transition-colors cursor-pointer ml-auto"
                >
                  기본값 (10억)
                </button>
              </div>
            </div>

            {/* 모달 액션 버튼 */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCloseGoalModal}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => handleSaveGoal(goalInputTemp)}
                disabled={!Number(goalInputTemp) || Number(goalInputTemp) <= 0}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-xs transition-all cursor-pointer active:scale-95"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
