"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Sparkles, 
  BarChart2, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import { useAssets } from "@/contexts/AssetContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAnimatedDataModal } from "@/hooks/useAnimatedModal";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

// 기간 옵션 (시안: [1개월] [3개월] [6개월] [1년] [3년])
const PERIOD_OPTIONS = [
  { id: "1m", label: "1개월", days: 21 },
  { id: "3m", label: "3개월", days: 63 },
  { id: "6m", label: "6개월", days: 126 },
  { id: "1y", label: "1년", days: 252 },
  { id: "3y", label: "3년", days: 756 }
];

// 정규분포 벨 커브 SVG 정적 패스 생성 (Hydration 불일치 방지 및 소수점 1자리 최적화)
function generateStaticBellCurveSvg() {
  const width = 600;
  const height = 200;
  const paddingX = 40;
  const paddingBottom = 31;
  const paddingTop = 20;

  const points = [];
  const minZ = -3.5;
  const maxZ = 3.5;
  const step = 0.1;

  for (let z = minZ; z <= maxZ + 0.001; z += step) {
    const yVal = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z);
    const x = paddingX + ((z - minZ) / (maxZ - minZ)) * (width - 2 * paddingX);
    const maxF = 0.3989;
    const y = height - paddingBottom - (yVal / maxF) * (height - paddingTop - paddingBottom);
    points.push({ x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) });
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }

  const areaD = `${d} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

  return { path: d, areaPath: areaD, width, height, paddingX, paddingBottom, paddingTop };
}

const STATIC_BELL_CURVE_SVG = generateStaticBellCurveSvg();

// YYYY-MM-DD 날짜 문자열을 롤링 애니메이션용 UTC 일수(epoch day)로 변환
function parseDateToEpochDays(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return null;
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function formatEpochDaysToDate(days) {
  if (days == null || isNaN(days)) return "-";
  const ms = Math.round(days) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

// 카드형 숫자 롤링 카운터 (다른 화면 카드형과 동일한 부드러운 easeOutQuad 롤링)
function AnimatedRollingNumber({ value, formatFn, decimals = 1, prefix = "", suffix = "", emptyText = "-", duration = 650 }) {
  const spanRef = useRef(null);
  const prevValueRef = useRef(null);
  const isFirstMountRef = useRef(true);
  const formatRef = useRef(null);

  const format = useCallback((num) => {
    if (num == null || isNaN(num)) return emptyText;
    if (formatFn) return formatFn(num);
    return `${prefix}${num.toFixed(decimals)}${suffix}`;
  }, [formatFn, decimals, prefix, suffix, emptyText]);

  useEffect(() => {
    formatRef.current = format;
  }, [format]);

  useEffect(() => {
    const fmt = formatRef.current || format;
    if (value == null || isNaN(Number(value))) {
      if (spanRef.current) spanRef.current.textContent = emptyText;
      prevValueRef.current = null;
      return;
    }

    const endVal = Number(value);

    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      if (spanRef.current) spanRef.current.textContent = fmt(endVal);
      prevValueRef.current = endVal;
      return;
    }

    const startVal = prevValueRef.current != null ? prevValueRef.current : endVal;
    if (startVal === endVal) {
      if (spanRef.current) spanRef.current.textContent = fmt(endVal);
      return;
    }

    let startTime = null;
    let animationFrame;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeProgress = 1 - (1 - progress) * (1 - progress);
      const current = startVal + (endVal - startVal) * easeProgress;
      const activeFmt = formatRef.current || format;

      if (spanRef.current) {
        spanRef.current.textContent = activeFmt(current);
      }

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      } else {
        if (spanRef.current) spanRef.current.textContent = activeFmt(endVal);
        prevValueRef.current = endVal;
      }
    };

    animationFrame = requestAnimationFrame(step);
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const initialNum = value != null && !isNaN(Number(value)) ? Number(value) : null;
  return <span ref={spanRef}>{format(initialNum)}</span>;
}

// 주가 추이 차트 X축 날짜 눈금 컴포넌트 (기간 변경 시 순차 페이드-업 효과)
function VolatilityXAxisTick({ x, y, payload, index, loadedPeriod }) {
  const val = payload?.value;
  if (!val) return null;
  const label =
    loadedPeriod === "1m" || loadedPeriod === "3m"
      ? `${val.slice(5, 7)}.${val.slice(8, 10)}`
      : `${val.slice(2, 4)}.${val.slice(5, 7)}`;

  return (
    <g key={`${loadedPeriod}-${val}`} transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={12}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize={11}
        fontWeight={600}
        className="animate-legend-item"
        style={{
          animationDuration: "650ms",
          animationDelay: `${(index || 0) * 50}ms`
        }}
      >
        {label}
      </text>
    </g>
  );
}

// 주가 추이 차트 Y축 금액 눈금 컴포넌트 (기간 변경 시 순차 페이드-업 효과)
function VolatilityYAxisTick({ x, y, payload, index, isKr, loadedPeriod }) {
  const v = payload?.value;
  if (v == null || isNaN(v)) return null;
  const label = isKr
    ? `${Math.round(v).toLocaleString("ko-KR")}원`
    : `$ ${Number(v).toLocaleString("en-US")}`;

  return (
    <g key={`y-${loadedPeriod}-${index}-${Math.round(v)}`} transform={`translate(${x},${y})`}>
      <text
        x={-4}
        y={4}
        textAnchor="end"
        fill="#94a3b8"
        fontSize={11}
        fontWeight={600}
        className="animate-legend-item"
        style={{
          animationDuration: "650ms",
          animationDelay: `${(index || 0) * 45}ms`
        }}
      >
        {label}
      </text>
    </g>
  );
}

export default function VolatilityPage() {
  const { user } = useAuth();
  const { holdings } = useAssets();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 검색 및 기간 상태 (초기 진입 시 미선택 -> 종목 선택/검색 시 분석 출력)
  const [selectedStock, setSelectedStock] = useState(null);
  const [period, setPeriod] = useState("1y");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [compPage, setCompPage] = useState(0);
  const [hoveredBadgeTooltip, setHoveredBadgeTooltip] = useState(null);
  const [hoveredBarIdx, setHoveredBarIdx] = useState(null);
  const [hoveredSigmaTooltip, setHoveredSigmaTooltip] = useState(null);
  const searchContainerRef = useRef(null);
  const dropdownListRef = useRef(null);

  // 주가 히스토리 데이터 상태 (종목 선택 시 3년치를 1회 조회하고, 기간 변경 시 클라이언트에서 즉시 필터링)
  const [rawHistoryData, setRawHistoryData] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [previousClose, setPreviousClose] = useState(null);
  const [currency, setCurrency] = useState("USD");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 외부 클릭 시 검색창 닫기
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 주가 히스토리 데이터 로드 (종목 변경 시에만 3년치 1회 조회 -> 기간 버튼 전환은 즉시 응답)
  useEffect(() => {
    let isCancelled = false;

    async function loadStockHistory() {
      if (!selectedStock?.symbol) return;
      setIsLoading(true);
      setErrorMsg("");

      try {
        const res = await fetch(`/api/stock-history?symbol=${encodeURIComponent(selectedStock.symbol)}&period=3y`);
        if (!res.ok) {
          throw new Error("주가 데이터를 불러오지 못했습니다.");
        }
        const data = await res.json();
        if (isCancelled) return;

        if (data.history && data.history.length > 0) {
          setRawHistoryData(data.history);
          setCurrentPrice(data.currentPrice || data.history[data.history.length - 1].close);
          setPreviousClose(data.previousClose || (data.history.length > 1 ? data.history[data.history.length - 2].close : null));
          setCurrency(data.currency || (selectedStock.isKRW ? "KRW" : "USD"));
        } else {
          throw new Error("조회된 시세 데이터가 없습니다.");
        }
      } catch (err) {
        if (!isCancelled) {
          setErrorMsg(err.message || "주가 데이터를 불러오는 중 오류가 발생했습니다.");
          setRawHistoryData([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadStockHistory();

    return () => {
      isCancelled = true;
    };
  }, [selectedStock]);

  // 선택된 기간(1개월~3년)에 맞게 3년치 캐시 데이터에서 즉시 슬라이싱
  const historyData = useMemo(() => {
    if (!rawHistoryData || rawHistoryData.length === 0) return [];
    if (period === "3y") return rawHistoryData;

    const latestDateStr = rawHistoryData[rawHistoryData.length - 1]?.date;
    if (!latestDateStr) return rawHistoryData;

    const cutoff = new Date(latestDateStr);
    if (period === "1m") cutoff.setMonth(cutoff.getMonth() - 1);
    else if (period === "3m") cutoff.setMonth(cutoff.getMonth() - 3);
    else if (period === "6m") cutoff.setMonth(cutoff.getMonth() - 6);
    else cutoff.setFullYear(cutoff.getFullYear() - 1);

    const cutoffStr = cutoff.toISOString().split("T")[0];
    const filtered = rawHistoryData.filter((d) => d.date >= cutoffStr);
    return filtered.length >= 5 ? filtered : rawHistoryData;
  }, [rawHistoryData, period]);

  // 검색 실행 함수 (직접 호출 및 엔터 시 즉시 조회 지원)
  const executeSearch = useCallback(async (queryText) => {
    const trimmed = queryText.trim();
    if (!trimmed) return [];
    setIsSearching(true);
    try {
      const res = await fetch(`/api/stock-search?q=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const list = await res.json();
        const sliced = Array.isArray(list) ? list.slice(0, 8) : [];
        setSearchResults(sliced);
        return sliced;
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
    return [];
  }, []);

  // 종목 선택 헬퍼
  const selectStockFromSearch = (item) => {
    const isItemDomestic = item.currency === "KRW" || /^\d{6}/.test(item.code) || item.market === "KOSPI" || item.market === "KOSDAQ";
    setSelectedStock({
      symbol: item.symbol || item.code,
      name: `${item.symbol || item.code} (${item.name})`,
      market: item.market,
      isKRW: isItemDomestic,
      fromSearch: true
    });
    setSearchQuery("");
    setSearchResults([]);
    setSelectedSearchIndex(0);
    setIsSearchOpen(false);
  };

  // 키보드로 선택된 항목이 스크롤 영역 밖으로 나갈 때 자동으로 스크롤 추적
  useEffect(() => {
    if (isSearchOpen && dropdownListRef.current) {
      const selectedItem = dropdownListRef.current.children[selectedSearchIndex];
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedSearchIndex, isSearchOpen]);

  // 검색 입력 핸들러 (영문 자동 대문자 변환 + 허용 문자 필터링)
  const handleSearchInputChange = (e) => {
    const raw = e.target.value;
    const clean = raw.replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s]/g, "");
    const upperClean = clean.replace(/[a-z]/g, (ch) => ch.toUpperCase());
    setSearchQuery(upperClean);
    if (isSearchOpen) {
      setIsSearchOpen(false);
      setSearchResults([]);
      setSelectedSearchIndex(0);
    }
  };

  // 붙여넣기(Ctrl+V) 처리
  const handleSearchPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData("text") || "";
    const clean = text.replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s]/g, "");
    const upperClean = clean.replace(/[a-z]/g, (ch) => ch.toUpperCase());
    if (!upperClean) return;

    const input = e.currentTarget;
    const start = input.selectionStart ?? searchQuery.length;
    const end = input.selectionEnd ?? searchQuery.length;
    const nextVal = searchQuery.slice(0, start) + upperClean + searchQuery.slice(end);
    setSearchQuery(nextVal);

    if (isSearchOpen) {
      setIsSearchOpen(false);
      setSearchResults([]);
      setSelectedSearchIndex(0);
    }

    requestAnimationFrame(() => {
      if (input) {
        input.setSelectionRange(start + upperClean.length, start + upperClean.length);
      }
    });
  };

  // 키보드 네비게이션 및 엔터 검색/선택 핸들러
  const handleSearchKeyDown = async (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End"].includes(e.key)) {
      return;
    }

    if (isSearchOpen && searchResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSearchIndex((prev) => Math.min(searchResults.length - 1, prev + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSearchIndex((prev) => Math.max(0, prev - 1));
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsSearchOpen(false);
        return;
      }
    }

    if (e.key === "Enter") {
      if (e.nativeEvent && e.nativeEvent.isComposing) return;
      e.preventDefault();
      e.stopPropagation();
      const trimmed = searchQuery.trim();
      if (!trimmed) return;

      if (isSearchOpen && searchResults.length > 0) {
        selectStockFromSearch(searchResults[selectedSearchIndex] || searchResults[0]);
        return;
      }

      const list = await executeSearch(trimmed);
      if (list && list.length > 0) {
        setSelectedSearchIndex(0);
        setIsSearchOpen(true);
      }
    }
  };

  // 통화 포맷 함수
  const formatPrice = (val) => {
    if (val == null || isNaN(val)) return "-";
    const isKr = currency === "KRW" || selectedStock?.isKRW;
    if (isKr) {
      return `${Math.round(val).toLocaleString("ko-KR")}원`;
    }
    return `$ ${Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // ══════════════════════════════════════════════════════════
  // 통계 지표 계산 (로그정규분포 모델 및 히스토그램 빈도)
  // ══════════════════════════════════════════════════════════
  const stats = useMemo(() => {
    if (!historyData || historyData.length < 5) return null;

    // 1. 일별 수익률 계산
    const dailyReturns = [];
    for (let i = 1; i < historyData.length; i++) {
      const prev = historyData[i - 1].close;
      const cur = historyData[i].close;
      if (prev > 0) {
        dailyReturns.push((cur - prev) / prev);
      }
    }

    const N = dailyReturns.length;
    if (N < 3) return null;

    // 일평균 수익률 및 일일 표준편차
    const meanDaily = dailyReturns.reduce((acc, r) => acc + r, 0) / N;
    const varianceDaily = dailyReturns.reduce((acc, r) => acc + Math.pow(r - meanDaily, 2), 0) / (N - 1);
    const dailySigma = Math.sqrt(varianceDaily);

    // 선택 기간 표준편차 (Square Root of Time Rule)
    const periodSigma = dailySigma * Math.sqrt(N);
    const annualSigma = dailySigma * Math.sqrt(252);

    const activePrice = currentPrice || historyData[historyData.length - 1].close;

    // 현재 주가 기준 일일 표준편차(±1σ, ±2σ, ±3σ) 예상 가격 범위
    const lower1s = Math.max(0, activePrice * (1 - 1 * dailySigma));
    const upper1s = activePrice * (1 + 1 * dailySigma);

    const lower2s = Math.max(0, activePrice * (1 - 2 * dailySigma));
    const upper2s = activePrice * (1 + 2 * dailySigma);

    const lower3s = Math.max(0, activePrice * (1 - 3 * dailySigma));
    const upper3s = activePrice * (1 + 3 * dailySigma);

    // 1일 평균 변동 금액
    const dailyPriceDelta = activePrice * dailySigma;

    // 전일 대비 등락
    const prev = previousClose || (historyData.length > 1 ? historyData[historyData.length - 2].close : activePrice);
    const priceChange = activePrice - prev;
    const priceChangeRate = prev > 0 ? (priceChange / prev) * 100 : 0;

    // 롤링 20일 볼린저/표준편차 밴드 차트 데이터 생성
    let latestDist = 0;
    const chartSeries = historyData.map((d, idx) => {
      const windowStart = Math.max(0, idx - 19);
      const windowSlice = historyData.slice(windowStart, idx + 1);
      const sliceCloses = windowSlice.map((s) => s.close);
      const ma = sliceCloses.reduce((a, b) => a + b, 0) / sliceCloses.length;

      let std = 0;
      if (sliceCloses.length > 1) {
        const varSum = sliceCloses.reduce((a, b) => a + Math.pow(b - ma, 2), 0) / (sliceCloses.length - 1);
        std = Math.sqrt(varSum);
      }

      const upper1 = Number((ma + std).toFixed(2));
      const lower1 = Number(Math.max(0, ma - std).toFixed(2));
      const upper2 = Number((ma + 2 * std).toFixed(2));
      const lower2 = Number(Math.max(0, ma - 2 * std).toFixed(2));

      if (idx === historyData.length - 1 && std > 0) {
        latestDist = Number(((d.close - ma) / std).toFixed(1));
      }

      return {
        date: d.date.slice(5),
        fullDate: d.date,
        close: d.close,
        ma: Number(ma.toFixed(2)),
        upper1,
        lower1,
        upper2,
        lower2
      };
    });

    // 위험 등급 판정
    let riskLevel = { label: "적정 변동성 (Moderate)", color: "text-blue-700 bg-blue-50 border-blue-200" };
    if (annualSigma < 0.18) {
      riskLevel = { label: "저변동성 (Low)", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    } else if (annualSigma < 0.3) {
      riskLevel = { label: "적정 변동성 (Moderate)", color: "text-blue-700 bg-blue-50 border-blue-200" };
    } else if (annualSigma < 0.5) {
      riskLevel = { label: "다소 높은 변동성 (High)", color: "text-amber-700 bg-amber-50 border-amber-200" };
    } else {
      riskLevel = { label: "초고변동성 (Very High)", color: "text-rose-700 bg-rose-50 border-rose-200" };
    }

    // 일일 수익률 히스토그램 빈도 계산 (SVG 벨 커브 아래에 함께 렌더링할 17개 막대)
    const BIN_COUNT = 17;
    const minZ = -3.4;
    const maxZ = 3.4;
    const binWidthZ = (maxZ - minZ) / BIN_COUNT;
    const binCounts = new Array(BIN_COUNT).fill(0);

    let within1SigmaCount = 0;
    let above2SigmaCount = 0;
    let below2SigmaCount = 0;
    const dailyReturnRecords = [];

    for (let i = 1; i < historyData.length; i++) {
      const prevClose = historyData[i - 1].close;
      const curClose = historyData[i].close;
      if (prevClose > 0) {
        const r = (curClose - prevClose) / prevClose;
        dailyReturnRecords.push({
          date: historyData[i].date,
          pct: r * 100,
          close: curClose
        });
        if (dailySigma > 0) {
          if (Math.abs(r) <= dailySigma) within1SigmaCount++;
          if (r > 2 * dailySigma) above2SigmaCount++;
          if (r < -2 * dailySigma) below2SigmaCount++;
        }
      }
    }

    dailyReturns.forEach((r) => {
      if (dailySigma > 0) {
        const z = (r - meanDaily) / dailySigma;
        if (z >= minZ && z <= maxZ) {
          const bIdx = Math.min(BIN_COUNT - 1, Math.max(0, Math.floor((z - minZ) / binWidthZ)));
          binCounts[bIdx]++;
        }
      }
    });

    // 기간 최대 낙폭(MDD), 최고가, 최저가, 최대 급등/급락 TOP 3
    let runningPeak = historyData[0].close;
    let periodMdd = 0;
    let periodHigh = historyData[0].close;
    let periodLow = historyData[0].close;
    historyData.forEach((d) => {
      if (d.close > runningPeak) runningPeak = d.close;
      if (runningPeak > 0) {
        const dd = ((d.close - runningPeak) / runningPeak) * 100;
        if (dd < periodMdd) periodMdd = dd;
      }
      if (d.close > periodHigh) periodHigh = d.close;
      if (d.close < periodLow) periodLow = d.close;
    });

    const topGains = [...dailyReturnRecords].sort((a, b) => b.pct - a.pct).slice(0, 3);
    const topDrops = [...dailyReturnRecords].sort((a, b) => a.pct - b.pct).slice(0, 3);
    const within1SigmaRate = N > 0 ? (within1SigmaCount / N) * 100 : 0;
    const firstClose = historyData[0].close;
    const periodReturnRate = firstClose > 0 ? ((activePrice - firstClose) / firstClose) * 100 : 0;

    const maxBinCount = Math.max(1, ...binCounts);
    const svgWidth = 600;
    const svgHeight = 200;
    const padX = 40;
    const padBottom = 31;
    const maxBarH = 116; // 최대 막대 높이

    const histogramBars = binCounts.map((count, idx) => {
      const zStart = minZ + idx * binWidthZ;
      const zEnd = zStart + binWidthZ;
      const zCenter = zStart + binWidthZ / 2;
      const x = padX + ((zStart - minZ) / (maxZ - minZ)) * (svgWidth - 2 * padX);
      const w = ((svgWidth - 2 * padX) / BIN_COUNT) * 0.85; // 막대 간격 여백
      const h = (count / maxBinCount) * maxBarH;
      const y = svgHeight - padBottom - h;
      const minPct = (meanDaily + zStart * dailySigma) * 100;
      const maxPct = (meanDaily + zEnd * dailySigma) * 100;
      const color =
        Math.abs(zCenter) <= 1.0
          ? "#10b981" // ±1σ 구간: 에메랄드
          : Math.abs(zCenter) <= 2.0
            ? "#a855f7" // ±1σ~±2σ 구간: 보라
            : zCenter > 0
              ? "#f43f5e" // +2σ 초과 급등 구간: 로즈
              : "#3b82f6"; // -2σ 미만 급락 구간: 블루
      return {
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1)),
        width: Number(w.toFixed(1)),
        height: Number(h.toFixed(1)),
        count,
        color,
        minPct,
        maxPct
      };
    });

    const overallPeak = Math.max(periodHigh, activePrice);
    const currentDrawdown = overallPeak > 0 ? ((activePrice - overallPeak) / overallPeak) * 100 : 0;

    // 차트 렌더링 성능 최적화를 위해 280개 초과 시(예: 3년 조회) 통계 계산은 전체 유지하고 차트 점만 다운샘플링
    let sampledChartSeries = chartSeries;
    if (chartSeries.length > 280) {
      const step = Math.ceil(chartSeries.length / 260);
      sampledChartSeries = chartSeries.filter((item, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === chartSeries.length - 1;
        const isMonthStart = idx > 0 && item.fullDate.slice(0, 7) !== chartSeries[idx - 1].fullDate.slice(0, 7);
        return isFirst || isLast || isMonthStart || idx % step === 0;
      });
    }

    return {
      activePrice,
      priceChange,
      priceChangeRate,
      meanDaily,
      dailySigma,
      dailyPriceDelta,
      periodSigma,
      annualSigma,
      lower1s,
      upper1s,
      lower2s,
      upper2s,
      lower3s,
      upper3s,
      chartSeries: sampledChartSeries,
      latestDist,
      riskLevel,
      histogramBars,
      sampleCount: N,
      periodMdd,
      currentDrawdown,
      periodHigh,
      periodLow,
      periodReturnRate,
      within1SigmaRate,
      above2SigmaCount,
      below2SigmaCount,
      topGains,
      topDrops
    };
  }, [historyData, currentPrice, previousClose]);

  // 호버 팝업 열림/닫힘 애니메이션 상태
  const hoveredBarData = useMemo(() => {
    if (hoveredBarIdx === null || !stats?.histogramBars?.[hoveredBarIdx]) return null;
    return { idx: hoveredBarIdx, bar: stats.histogramBars[hoveredBarIdx] };
  }, [hoveredBarIdx, stats]);
  const { data: activeBarTooltip, isOpen: isBarTooltipOpen, isClosing: isBarTooltipClosing } = useAnimatedDataModal(hoveredBarData, 200);
  const { data: activeBadgeTooltip, isOpen: isBadgeTooltipOpen, isClosing: isBadgeTooltipClosing } = useAnimatedDataModal(hoveredBadgeTooltip, 200);
  const { data: activeSigmaTooltip, isOpen: isSigmaTooltipOpen, isClosing: isSigmaTooltipClosing } = useAnimatedDataModal(hoveredSigmaTooltip, 200);

  // ══════════════════════════════════════════════════════════
  // 정규분포(Bell Curve) 7개 눈금 데이터 (-3σ ~ +3σ)
  // ══════════════════════════════════════════════════════════
  const bellCurveTicks = useMemo(() => {
    if (!stats) return [];
    const { activePrice, dailySigma } = stats;

    const ticks = [
      { sigma: -3, label: "-3σ", prob: "0.1%", mult: -3 },
      { sigma: -2, label: "-2σ", prob: "2.3%", mult: -2 },
      { sigma: -1, label: "-1σ", prob: "15.9%", mult: -1 },
      { sigma: 0, label: "0 (기준가)", prob: "50.0%", mult: 0, isCenter: true },
      { sigma: 1, label: "+1σ", prob: "84.1%", mult: 1 },
      { sigma: 2, label: "+2σ", prob: "97.7%", mult: 2 },
      { sigma: 3, label: "+3σ", prob: "99.9%", mult: 3 }
    ];

    return ticks.map((t) => {
      // 현재 주가 ± (k * 일일 표준편차)
      const targetPrice = t.mult === 0 ? activePrice : Math.max(0, activePrice * (1 + t.mult * dailySigma));
      const pctChange = t.mult === 0 ? 0 : ((targetPrice - activePrice) / activePrice) * 100;
      return {
        ...t,
        pctChange,
        pctChangeStr: (pctChange > 0 ? "+" : "") + pctChange.toFixed(1) + "%",
        price: targetPrice
      };
    });
  }, [stats]);

  // 주가 추이 차트 X축 눈금 계산
  const xTicks = useMemo(() => {
    const series = stats?.chartSeries || [];
    if (series.length < 2) return [];

    if (period === "1m" || period === "3m") {
      const targetCount = 5;
      const step = Math.max(1, Math.floor((series.length - 1) / targetCount));
      const ticks = [];
      for (let i = step; i < series.length - 1; i += step) {
        ticks.push(series[i].fullDate);
      }
      return ticks;
    }

    // 6개월, 1년, 3년: 월 첫 거래일 중 기간별 간격으로 선택 (첫 시작 부근 겹침 방지)
    const monthStep = period === "3y" ? 6 : period === "1y" ? 2 : 1;
    const seenMonths = [];
    const monthFirstDate = {};
    series.forEach((item, idx) => {
      const ym = item.fullDate.slice(0, 7);
      if (!monthFirstDate[ym]) {
        monthFirstDate[ym] = { fullDate: item.fullDate, idx };
        seenMonths.push(ym);
      }
    });

    const ticks = [];
    for (let i = 1; i < seenMonths.length; i += monthStep) {
      const info = monthFirstDate[seenMonths[i]];
      if (info && info.idx > 4) {
        ticks.push(info.fullDate);
      }
    }
    return ticks;
  }, [stats, period]);

  // 하단 비교용 종목 데이터 리스트 (시안: NVDA, TSLA, AAPL, SCHD, S&P 500)
  const comparisonList = useMemo(() => {
    const defaultList = [
      { symbol: "NVDA", name: "NVDA (엔비디아)", vol: 42.8, color: "from-emerald-500 to-teal-400" },
      { symbol: "TSLA", name: "TSLA (테슬라)", vol: 48.1, color: "from-sky-500 to-blue-400" },
      { symbol: "AAPL", name: "AAPL (애플)", vol: 22.3, color: "from-indigo-500 to-violet-400" },
      { symbol: "SCHD", name: "SCHD", vol: 14.2, color: "from-purple-500 to-fuchsia-400" },
      { symbol: "SPY", name: "S&P 500 (SPY)", vol: 15.6, color: "from-amber-500 to-orange-400" }
    ];

    if (holdings && holdings.length > 0) {
      return holdings.map((h, i) => {
        const colors = [
          "from-emerald-500 to-teal-400",
          "from-sky-500 to-blue-400",
          "from-indigo-500 to-violet-400",
          "from-purple-500 to-fuchsia-400",
          "from-amber-500 to-orange-400"
        ];
        const sym = h.code || h.symbol;
        const isKRW = h.currency === "KRW" || /^\d{6}/.test(sym) || h.market === "KOSPI" || h.market === "KOSDAQ";
        return {
          symbol: sym,
          name: h.name || h.code,
          market: h.market || (isKRW ? "KOSPI" : "US"),
          isKRW,
          vol: Number((20 + (i * 7.3) % 30).toFixed(1)),
          color: colors[i % colors.length]
        };
      });
    }

    return defaultList.map((d) => ({ ...d, market: "US", isKRW: false }));
  }, [holdings]);

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 py-4 md:p-0 space-y-6 animate-fade-in text-slate-800">
      
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. 최상단 헤더 섹션 (다른 화면들과 동일하게 박스 밖 좌측 상단)  */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-page-slide">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shadow-md shadow-rose-500/20 shrink-0">
            <TrendingUp size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              종목 변동성 & 위험(표준편차) 분석
            </h1>
            <p className="text-xs md:text-sm font-medium text-slate-500 mt-0.5">
              과거 가격 데이터를 기반으로 한 변동성 지표 및 정규분포 분석
            </p>
          </div>
        </div>

        {!user && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg text-sm">
            로그인 후 확인할 수 있습니다.
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. 상단 통합 바 + 조회 전/후 영역 (조회 전 935px 높이 통일) */}
      {/* ────────────────────────────────────────────────────────── */}
      {user && (
      <div className={!selectedStock || isLoading ? "lg:h-[935px] lg:min-h-[935px] lg:max-h-[935px] flex flex-col gap-6" : "space-y-6"}>
      <div className="relative z-30 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6 animate-card-entrance stagger-1 shrink-0">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Activity size={18} className="text-slate-700" />
              포트폴리오 보유 종목 변동성 비교
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              종목을 클릭하면 해당 종목의 정규분포 및 변동성 분석으로 즉시 전환됩니다.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* 검색창 좌측: 현재 선택/검색된 종목 칩 */}
            {selectedStock && (() => {
              const cleanCode = selectedStock.symbol.replace(/\.(KS|KQ)$/, "");
              const parenMatch = selectedStock.name.match(/^[^\s(]+\s*\((.+)\)$/);
              const displayName = parenMatch ? parenMatch[1] : selectedStock.name;
              const isSearched = Boolean(selectedStock.fromSearch);

              return (
                <div
                  key={`chip-stock-${selectedStock.symbol}`}
                  className="flex items-center justify-between gap-2 w-full sm:w-[255px] xl:w-[285px] px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 animate-header-switch shrink-0"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${
                        isSearched
                          ? "bg-rose-100 text-rose-700"
                          : "bg-slate-200/80 text-slate-700"
                      }`}
                    >
                      {isSearched ? <Search size={10} /> : <Activity size={10} />}
                      {isSearched ? "검색" : "보유"}
                    </span>
                    <span className="font-black truncate" title={`${displayName} (${cleanCode})`}>
                      {displayName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`text-[11px] font-bold ${
                        selectedStock.isKRW ? "text-blue-600" : "text-amber-600"
                      }`}
                    >
                      {cleanCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStock(null);
                        setRawHistoryData([]);
                        setErrorMsg("");
                      }}
                      className="p-0.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="선택 해제"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 종목 검색창 (백테스트 포트폴리오 구성 검색창과 동일한 형태) */}
            <div className="relative flex-1 sm:w-64 xl:w-72" ref={searchContainerRef}>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="+ 종목명 / 티커 / 종목코드 입력 후 Enter..."
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  onKeyDown={handleSearchKeyDown}
                  onPaste={handleSearchPaste}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck="false"
                  className="w-full pl-3.5 pr-8 py-1.5 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-semibold transition-all uppercase placeholder:normal-case placeholder:font-normal placeholder:text-xs placeholder:text-slate-400"
                />
                {isSearching ? (
                  <RefreshCw size={14} className="absolute right-2.5 text-slate-400 animate-spin" />
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      const trimmed = searchQuery.trim();
                      if (!trimmed) return;
                      if (isSearchOpen && searchResults.length > 0) {
                        selectStockFromSearch(searchResults[selectedSearchIndex] || searchResults[0]);
                        return;
                      }
                      const list = await executeSearch(trimmed);
                      if (list && list.length > 0) {
                        setSelectedSearchIndex(0);
                        setIsSearchOpen(true);
                      }
                    }}
                    className="absolute right-2.5 p-0.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    title="검색"
                  >
                    <Search size={14} />
                  </button>
                )}
              </div>

              {/* 검색 드롭다운 (최대 4개 노출, 5개 이상 시 스크롤 발생) */}
              {isSearchOpen && searchResults.length > 0 && (
                <div
                  ref={dropdownListRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[100] overflow-hidden divide-y divide-slate-100 max-h-[192px] overflow-y-auto text-xs"
                >
                  {searchResults.map((item, idx) => {
                    const isSelected = selectedSearchIndex === idx;
                    const isItemDomestic = item.currency === "KRW" || /^\d{6}/.test(item.code) || item.market === "KOSPI" || item.market === "KOSDAQ";
                    return (
                      <button
                        key={`${item.code}-${idx}`}
                        onClick={() => selectStockFromSearch(item)}
                        onMouseEnter={() => setSelectedSearchIndex(idx)}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-rose-50/90 text-rose-950 font-bold border-l-3 border-rose-600 pl-2.5"
                            : "hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="truncate max-w-[180px] text-xs font-bold">{item.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[9px] font-bold px-1 py-0.2 rounded shrink-0 ${
                              isItemDomestic
                                ? "bg-blue-50 text-blue-600 border border-blue-200/60"
                                : "bg-amber-50 text-amber-700 border border-amber-200/60"
                            }`}>
                              {isItemDomestic ? "국내" : "해외"}
                            </span>
                            <span className={`text-[10px] font-mono ${isSelected ? "text-rose-600" : "text-slate-400"}`}>
                              {item.code} · {item.market}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center">
                          {isSelected ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-600 text-white font-black shadow-2xs flex items-center gap-1">
                              선택됨 <span className="text-[9px] opacity-80">↵</span>
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold">
                              선택
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 기간 선택 버튼 세그먼트 (백테스트 분석 기간 선택창과 동일한 형태 + 로즈 테마) */}
            <div className="grid grid-cols-5 gap-1 p-0.5 bg-slate-100 rounded-xl self-start sm:self-auto">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setPeriod(opt.id)}
                  className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap text-center ${
                    period === opt.id
                      ? "bg-rose-600 text-white font-black shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 보유 종목 변동성 비교 카드 5열 + 좌/우 페이지 이동 버튼 */}
        {(() => {
          const ITEMS_PER_PAGE = 5;
          const totalCompPages = Math.max(1, Math.ceil(comparisonList.length / ITEMS_PER_PAGE));
          const safeCompPage = Math.min(compPage, totalCompPages - 1);
          const currentCompItems = comparisonList.slice(
            safeCompPage * ITEMS_PER_PAGE,
            (safeCompPage + 1) * ITEMS_PER_PAGE
          );
          const emptySlotsCount = Math.max(0, ITEMS_PER_PAGE - currentCompItems.length);

          return (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={safeCompPage <= 0}
                onClick={() => setCompPage((p) => Math.max(0, p - 1))}
                className={`w-9 h-[96px] rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                  safeCompPage <= 0
                    ? "bg-slate-50/70 border-slate-100 text-slate-300 cursor-not-allowed"
                    : "bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-600 hover:text-rose-700 shadow-xs cursor-pointer active:scale-95"
                }`}
                aria-label="이전 5개 종목"
                title="이전 5개 종목"
              >
                <ChevronLeft size={20} strokeWidth={2.5} />
              </button>

              <div key={`comp-grid-${safeCompPage}`} className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {currentCompItems.map((item, idx) => {
                  const isCurrent = Boolean(
                    selectedStock && (selectedStock.symbol === item.symbol || selectedStock.symbol.startsWith(item.symbol))
                  );
                  const maxVol = 60;
                  const pctBar = Math.min(100, Math.max(10, (item.vol / maxVol) * 100));
                  const cleanCode = item.symbol.replace(/\.(KS|KQ)$/, "");
                  const topLabel = item.isKRW ? item.name : cleanCode;
                  const bottomLabel = item.isKRW ? cleanCode : item.name;

                  return (
                    <button
                      key={`${item.symbol}-${idx}`}
                      onClick={() => {
                        setSelectedStock({
                          symbol: item.symbol,
                          name: item.name,
                          market: item.market || (item.isKRW ? "KOSPI" : "US"),
                          isKRW: Boolean(item.isKRW)
                        });
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[96px] opacity-0 animate-summary-pop stagger-${idx + 1} ${
                        isCurrent
                          ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-blue-500/30"
                          : "bg-slate-50/80 hover:bg-slate-100 border-slate-200/80 text-slate-800"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span className="text-sm font-black tracking-tight truncate">{topLabel}</span>
                          <span className={`text-xs font-black shrink-0 ${isCurrent ? "text-emerald-400" : "text-blue-600"}`}>
                            {item.vol}%
                          </span>
                        </div>
                        <div className={`text-xs truncate mb-2.5 ${isCurrent ? "text-slate-400" : "text-slate-500"}`}>
                          {bottomLabel}
                        </div>
                      </div>

                      <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${item.color} transition-all duration-500`}
                          style={{ width: `${pctBar}%` }}
                        />
                      </div>
                    </button>
                  );
                })}

                {/* 5개 미만 페이지일 때 나머지 빈칸 틀 유지 */}
                {Array.from({ length: emptySlotsCount }).map((_, emptyIdx) => (
                  <div
                    key={`empty-slot-${emptyIdx}`}
                    className={`p-3.5 rounded-xl border border-dashed border-slate-200/80 bg-slate-50/40 min-h-[96px] opacity-0 animate-fade-in stagger-${currentCompItems.length + emptyIdx + 1}`}
                  />
                ))}
              </div>

              <button
                type="button"
                disabled={safeCompPage >= totalCompPages - 1}
                onClick={() => setCompPage((p) => Math.min(totalCompPages - 1, p + 1))}
                className={`w-9 h-[96px] rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                  safeCompPage >= totalCompPages - 1
                    ? "bg-slate-50/70 border-slate-100 text-slate-300 cursor-not-allowed"
                    : "bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-600 hover:text-rose-700 shadow-xs cursor-pointer active:scale-95"
                }`}
                aria-label="다음 5개 종목"
                title="다음 5개 종목"
              >
                <ChevronRight size={20} strokeWidth={2.5} />
              </button>
            </div>
          );
        })()}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3. 조회 전 안내 화면 vs 조회 후 변동성 대시보드            */}
      {/* ────────────────────────────────────────────────────────── */}
      {!selectedStock ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 md:p-12 shadow-xs text-center flex flex-col items-center justify-center flex-1 min-h-[460px] animate-card-entrance stagger-2">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 shadow-2xs">
            <Activity size={32} className="stroke-[2.2]" />
          </div>
          <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight mb-2">
            종목을 선택하거나 검색하여 변동성을 분석해보세요
          </h3>
          <p className="text-xs md:text-sm text-slate-500 max-w-lg leading-relaxed mb-8">
            과거 일별 주가 시세 데이터를 기반으로 1일 평균 변동폭(1-Day σ), 1σ 예상 가격 범위, 표준편차 밴드 및 일일 수익률 정규분포 분석을 제공합니다.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl text-left">
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70 space-y-1.5 opacity-0 animate-feed-lift stagger-1 hover:-translate-y-0.5 hover:border-rose-200/80 transition-all">
              <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 text-xs font-black flex items-center justify-center">1</div>
              <h4 className="text-xs font-bold text-slate-800">보유 종목 선택</h4>
              <p className="text-[11px] text-slate-500 leading-normal">
                상단 &apos;포트폴리오 보유 종목 변동성 비교&apos; 카드에서 분석할 종목을 클릭하세요.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70 space-y-1.5 opacity-0 animate-feed-lift stagger-2 hover:-translate-y-0.5 hover:border-rose-200/80 transition-all">
              <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 text-xs font-black flex items-center justify-center">2</div>
              <h4 className="text-xs font-bold text-slate-800">종목 직접 검색</h4>
              <p className="text-[11px] text-slate-500 leading-normal">
                상단 검색창에 종목명, 티커(NVDA) 또는 종목코드(005930)를 입력해 조회하세요.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/70 space-y-1.5 opacity-0 animate-feed-lift stagger-3 hover:-translate-y-0.5 hover:border-rose-200/80 transition-all">
              <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 text-xs font-black flex items-center justify-center">3</div>
              <h4 className="text-xs font-bold text-slate-800">표준편차 &amp; 리스크 분석</h4>
              <p className="text-[11px] text-slate-500 leading-normal">
                선택한 기간의 ±1σ 예상 가격 범위, 정규분포 및 급등락 일수를 한눈에 확인하세요.
              </p>
            </div>
          </div>
        </div>
      ) : isLoading || !stats ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 md:p-12 shadow-xs text-center flex flex-col items-center justify-center flex-1 min-h-[460px] animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 shadow-sm animate-pulse">
            <RefreshCw size={32} className="animate-spin text-rose-600" />
          </div>
          <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight mb-2">
            종목 변동성 데이터 분석 중...
          </h3>
          <p className="text-xs md:text-sm text-slate-500 max-w-md leading-relaxed">
            선택하신 종목의 과거 일별 주가 시세와 표준편차·정규분포 지표를 계산하고 있습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-in">
          {/* 4대 핵심 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* ① 현재 주가 (기준가) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all sm:h-[124px] animate-card-entrance">
          <div>
            <div className="flex items-center justify-between gap-3 text-slate-500 mb-1.5">
              <span className="text-xs font-bold text-slate-500 tracking-wide shrink-0 whitespace-nowrap">① 현재 주가</span>
              {(() => {
                const badgeText = selectedStock.isKRW
                  ? selectedStock.name.replace(/^[^\s(]+\s*\((.+)\)$/, "$1")
                  : selectedStock.symbol.replace(/\.(KS|KQ)$/, "");
                return (
                  <span
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      if (el.scrollWidth > el.clientWidth) {
                        const rect = el.getBoundingClientRect();
                        const showBelow = rect.top < 60;
                        setHoveredBadgeTooltip({
                          text: badgeText,
                          top: showBelow ? rect.bottom + 8 : rect.top - 8,
                          right: window.innerWidth - rect.right,
                          showBelow
                        });
                      }
                    }}
                    onMouseLeave={() => setHoveredBadgeTooltip(null)}
                    className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 min-w-0 truncate uppercase cursor-default"
                  >
                    {badgeText}
                  </span>
                );
              })()}
            </div>
            <div className="text-lg md:text-xl font-black text-slate-900 tracking-tight tabular-nums text-right flex justify-end whitespace-nowrap">
              <AnimatedRollingNumber value={stats?.activePrice} formatFn={formatPrice} />
            </div>
          </div>
          <div className="mt-2 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400">전일 대비</span>
            {stats && (
              <span className={`inline-flex items-center gap-0.5 font-bold ${stats.priceChange >= 0 ? "text-rose-600" : "text-blue-600"}`}>
                {stats.priceChange >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {stats.priceChange >= 0 ? "+" : "-"}{formatPrice(Math.abs(stats.priceChange))} ({stats.priceChangeRate >= 0 ? "+" : ""}{stats.priceChangeRate.toFixed(2)}%)
              </span>
            )}
          </div>
        </div>

        {/* ② 선택 기간 최대 낙폭 (MDD) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all sm:h-[124px] animate-card-entrance stagger-1">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-bold text-slate-500 tracking-wide shrink-0 whitespace-nowrap">② 최대 낙폭 (MDD)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 whitespace-nowrap inline-flex items-center">
                <span>고점 대비 :</span>
                <span
                  key={`mdd-period-${period}`}
                  className="inline-block w-[30px] text-right animate-header-switch"
                  style={{ animationDuration: "1.1s" }}
                >
                  {PERIOD_OPTIONS.find(p => p.id === period)?.label}
                </span>
              </span>
            </div>
            <div className="text-lg md:text-xl font-black text-blue-600 tracking-tight tabular-nums text-right flex justify-end whitespace-nowrap">
              <AnimatedRollingNumber value={stats?.periodMdd} decimals={1} suffix="%" />
            </div>
          </div>
          <div className="mt-2 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400">현재 낙폭 (고점 대비)</span>
            <span className="text-blue-600 font-bold">
              <AnimatedRollingNumber value={stats?.currentDrawdown} decimals={1} suffix="%" />
            </span>
          </div>
        </div>

        {/* ③ 1표준편차 상·하단 예상 가격 범위 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all sm:h-[124px] animate-card-entrance stagger-2">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-bold text-slate-500 tracking-wide">③ 1σ 예상 가격 범위</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                68.3% 구간
              </span>
            </div>
            <div className="text-lg md:text-xl font-black text-slate-900 tracking-tight tabular-nums flex items-baseline justify-end gap-1 whitespace-nowrap text-right">
              {stats ? (
                <>
                  <span className="text-emerald-600 font-black">
                    <AnimatedRollingNumber value={stats.lower1s} formatFn={formatPrice} />
                  </span>
                  <span className="text-emerald-600 font-black">~</span>
                  <span className="text-emerald-600 font-black">
                    <AnimatedRollingNumber value={stats.upper1s} formatFn={formatPrice} />
                  </span>
                </>
              ) : (
                <span className="text-slate-400">-</span>
              )}
            </div>
          </div>
          <div className="mt-2 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs font-semibold">
            <span className="text-slate-400 shrink-0">2σ 범위 (95.5%)</span>
            <span className="font-bold text-emerald-600 tabular-nums whitespace-nowrap truncate">
              {stats ? (
                <>
                  <AnimatedRollingNumber value={stats.lower2s} formatFn={formatPrice} />
                  {" ~ "}
                  <AnimatedRollingNumber value={stats.upper2s} formatFn={formatPrice} />
                </>
              ) : "-"}
            </span>
          </div>
        </div>

        {/* ④ 1일 평균 변동폭 (1-Day σ) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all sm:h-[124px] animate-card-entrance stagger-3">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-bold text-slate-500 tracking-wide">④ 1일 평균 변동폭 (1-Day σ)</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                일일 리스크
              </span>
            </div>
            <div className="text-lg md:text-xl font-black text-amber-600 tracking-tight tabular-nums text-right flex justify-end whitespace-nowrap">
              <AnimatedRollingNumber
                value={stats ? stats.dailySigma * 100 : null}
                decimals={2}
                prefix="± "
                suffix="%"
              />
            </div>
          </div>
          <div className="mt-2 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400">일평균 등락 범위</span>
            <span className="text-amber-600 font-bold">
              <AnimatedRollingNumber
                value={stats?.dailyPriceDelta}
                formatFn={(val) => `± ${formatPrice(val)}`}
              />
            </span>
          </div>
        </div>

      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3. 메인 분석 섹션: 좌측 차트(60%) + 우측 정규분포(40%)    */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* [좌측 7열] 주가 추이 및 표준편차(±1σ, ±2σ) 밴드 차트 */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-4 md:px-6 md:pt-4 md:pb-3 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <BarChart2 size={18} className="text-blue-600" />
                  주가 추이 및 표준편차(±1σ, ±2σ) 밴드 차트
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  20일 이동평균선을 기준으로 한 정상 변동성 채널(±1σ 68.3%, ±2σ 95.5%)
                </p>
              </div>

              {stats && (
                <div
                  key={`risk-badge-${period}-${stats.riskLevel.label}`}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border animate-header-switch ${stats.riskLevel.color}`}
                  style={{ animationDuration: "1.1s" }}
                >
                  {stats.riskLevel.label}
                </div>
              )}
            </div>

            {/* 범례 표시 (시안 스타일) */}
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 mb-2 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-blue-600 rounded-sm" /> 주가 (Close)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-slate-400 rounded-sm" /> 이동평균 (Mean)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 bg-emerald-100 border border-emerald-500 rounded-xs" /> ±1σ 밴드 (68.3%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 bg-purple-100 border border-purple-400 rounded-xs" /> ±2σ 밴드 (95.5%)
              </span>
            </div>

            {/* 차트 본체 */}
            <div className="h-[248px] w-full relative">
              {isLoading ? (
                <div className="h-full w-full flex items-center justify-center">
                  <RefreshCw size={24} className="text-slate-400 animate-spin" />
                </div>
              ) : isMounted && stats?.chartSeries?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.chartSeries} margin={{ top: 15, right: 10, left: 6, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="band2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f3e8ff" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#f3e8ff" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="fullDate"
                      ticks={xTicks}
                      tick={<VolatilityXAxisTick loadedPeriod={period} />}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                    />
                    <YAxis
                      width={64}
                      domain={['auto', 'auto']}
                      tick={
                        <VolatilityYAxisTick
                          isKr={currency === "KRW" || selectedStock?.isKRW}
                          loadedPeriod={period}
                        />
                      }
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                    />
                    <Tooltip
                      animationDuration={180}
                      wrapperStyle={{ transition: "transform 180ms ease-out, opacity 200ms ease-out, visibility 200ms ease-out" }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const p = payload[0].payload;
                          const distFromMa = p.ma ? ((p.close - p.ma) / (p.upper1 - p.ma || 1)).toFixed(2) : "0";
                          return (
                            <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-xl text-xs space-y-1 animate-tooltip-in">
                              <p className="font-bold text-slate-700 border-b border-slate-100 pb-1">{p.fullDate}</p>
                              <p className="text-blue-600 font-black text-sm">종가: {formatPrice(p.close)}</p>
                              <p className="text-slate-500 font-medium">20일 평균: {formatPrice(p.ma)}</p>
                              <p className="text-emerald-600 font-semibold">±1σ 밴드: {formatPrice(p.lower1)} ~ {formatPrice(p.upper1)}</p>
                              <p className="text-purple-600 font-semibold">±2σ 밴드: {formatPrice(p.lower2)} ~ {formatPrice(p.upper2)}</p>
                              <div className="pt-1 text-[11px] font-bold text-slate-400">
                                밴드 위치: <span className={distFromMa >= 0 ? "text-rose-500" : "text-blue-500"}>{distFromMa > 0 ? `+${distFromMa}σ` : `${distFromMa}σ`}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {/* ±2σ 상·하단 (Area fill="none"으로 좌표 보간 물결 모핑 유지) */}
                    <Area type="monotone" dataKey="upper2" stroke="#a855f7" strokeOpacity={0.65} strokeWidth={1.2} strokeDasharray="5 4" fill="none" fillOpacity={0} dot={false} animationDuration={950} animationEasing="ease-out" />
                    <Area type="monotone" dataKey="lower2" stroke="#a855f7" strokeOpacity={0.65} strokeWidth={1.2} strokeDasharray="5 4" fill="none" fillOpacity={0} dot={false} animationDuration={950} animationEasing="ease-out" />
                    {/* ±1σ 상·하단 */}
                    <Area type="monotone" dataKey="upper1" stroke="#10b981" strokeOpacity={0.75} strokeWidth={1.4} strokeDasharray="4 3" fill="none" fillOpacity={0} dot={false} animationDuration={950} animationEasing="ease-out" />
                    <Area type="monotone" dataKey="lower1" stroke="#10b981" strokeOpacity={0.75} strokeWidth={1.4} strokeDasharray="4 3" fill="none" fillOpacity={0} dot={false} animationDuration={950} animationEasing="ease-out" />
                    {/* 20일 이동평균선 */}
                    <Area type="monotone" dataKey="ma" stroke="#94a3b8" strokeWidth={1.5} fill="none" fillOpacity={0} dot={false} animationDuration={950} animationEasing="ease-out" />
                    {/* 실제 주가 라인 */}
                    <Area type="monotone" dataKey="close" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorClose)" animationDuration={1000} animationEasing="ease-out" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs font-medium">
                  {errorMsg || "표시할 차트 데이터가 없습니다."}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* [우측 5열] 일일 수익률 정규분포 (Bell Curve & Histogram) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-4 md:px-6 md:pt-4 md:pb-3 shadow-xs flex flex-col justify-between animate-card-entrance stagger-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Sparkles size={18} className="text-emerald-600" />
                  일일 수익률 정규분포 (Bell Curve & Histogram)
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  1~3 표준편차(σ) 구간별 예상 가격 및 변동 비율
                </p>
              </div>
              <span
                key={`bell-risk-badge-${period}-${stats?.riskLevel?.label || ""}`}
                className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 animate-header-switch"
                style={{ animationDuration: "1.1s" }}
              >
                위험 등급: {stats?.riskLevel.label.split(" ")[0] || "보통"}
              </span>
            </div>

            {/* 정규분포 SVG 벨 커브 + 실제 수익률 빈도 히스토그램 막대 */}
            <div
              className="relative w-full overflow-hidden mt-1.5 bg-slate-50/70 rounded-xl border border-slate-100 p-1.5"
              onMouseLeave={() => setHoveredBarIdx(null)}
            >
              {isBarTooltipOpen && activeBarTooltip && (() => {
                const { bar } = activeBarTooltip;
                const leftPct = Math.min(82, Math.max(18, ((bar.x + bar.width / 2) / 600) * 100));
                const fmtPct = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
                return (
                  <div
                    style={{ left: `${leftPct}%` }}
                    className="absolute top-2 -translate-x-1/2 z-20 pointer-events-none transition-[left] duration-200 ease-out"
                  >
                    <div className={`bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 shadow-xl text-xs whitespace-nowrap ${isBarTooltipClosing ? "animate-tooltip-out" : "animate-tooltip-in"}`}>
                      <p className="font-bold text-slate-700">
                        일간 변동: <span className="text-slate-900 font-black">{fmtPct(bar.minPct)} ~ {fmtPct(bar.maxPct)}</span>
                      </p>
                    </div>
                  </div>
                );
              })()}
              <svg 
                viewBox={`0 0 ${STATIC_BELL_CURVE_SVG.width} ${STATIC_BELL_CURVE_SVG.height}`} 
                className="w-full max-h-[154px] h-auto"
                onMouseLeave={() => setHoveredBarIdx(null)}
                suppressHydrationWarning
              >
                {/* 1. 배경 면적 채우기 */}
                <path d={STATIC_BELL_CURVE_SVG.areaPath} fill="#f1f5f9" opacity={0.6} suppressHydrationWarning />

                {/* 2. ±1σ 채움 영역 (-1 ~ +1) */}
                <rect x="225" y="15" width="150" height="154" fill="#ecfdf5" opacity={0.7} rx="6" />

                {/* 3. 시안의 실제 일별 수익률 히스토그램 막대들 (Histogram) */}
                {stats?.histogramBars?.map((bar, idx) => (
                  <g
                    key={idx}
                    onMouseEnter={() => setHoveredBarIdx(idx)}
                    className="cursor-pointer"
                    style={{
                      transformOrigin: "0px 169px",
                      animation: `bellBarRise 0.55s cubic-bezier(0.16, 1, 0.3, 1) ${0.14 + idx * 0.03}s both`
                    }}
                  >
                    <rect
                      x={bar.x}
                      y={bar.y}
                      width={bar.width}
                      height={bar.height}
                      fill={bar.color || "#10b981"}
                      opacity={hoveredBarIdx === idx ? 0.85 : 0.42}
                      rx="2"
                      className="transition-all duration-700 ease-out"
                    />
                    <rect
                      x={bar.x}
                      y={15}
                      width={bar.width}
                      height={154}
                      fill="transparent"
                    />
                  </g>
                ))}

                <g className="pointer-events-none">
                {/* 4. 중앙 0 (기준가) 기준선 */}
                <line x1="300" y1="20" x2="300" y2="169" stroke="#059669" strokeWidth="2" strokeDasharray="3 3" />

                {/* 5. -1σ, +1σ 점선 */}
                <line x1="225" y1="48" x2="225" y2="169" stroke="#10b981" strokeWidth="1.5" strokeDasharray="2 2" />
                <line x1="375" y1="48" x2="375" y2="169" stroke="#10b981" strokeWidth="1.5" strokeDasharray="2 2" />

                {/* 6. -2σ, +2σ 점선 */}
                <line x1="150" y1="111" x2="150" y2="169" stroke="#a855f7" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="450" y1="111" x2="450" y2="169" stroke="#a855f7" strokeWidth="1" strokeDasharray="2 2" />

                {/* 6-2. -3σ, +3σ 기준선 */}
                <line x1="75" y1="157" x2="75" y2="169" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="525" y1="157" x2="525" y2="169" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />

                {/* 7. 메인 벨 커브 곡선 */}
                <path
                  d={STATIC_BELL_CURVE_SVG.path}
                  pathLength="1"
                  fill="none"
                  stroke="#0ea5e9"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="animate-bell-curve-draw"
                  suppressHydrationWarning
                />

                {/* 8. 차트 하단 구간별 σ 눈금 (좌측 3 2 1 / 중앙 0 / 우측 1 2 3) */}
                <text x="75" y="187" textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="700">-3σ</text>
                <text x="150" y="187" textAnchor="middle" fill="#9333ea" fontSize="11" fontWeight="700">-2σ</text>
                <text x="225" y="187" textAnchor="middle" fill="#059669" fontSize="11" fontWeight="800">-1σ</text>
                <text x="300" y="187" textAnchor="middle" fill="#2563eb" fontSize="11" fontWeight="800">0</text>
                <text x="375" y="187" textAnchor="middle" fill="#059669" fontSize="11" fontWeight="800">+1σ</text>
                <text x="450" y="187" textAnchor="middle" fill="#9333ea" fontSize="11" fontWeight="700">+2σ</text>
                <text x="525" y="187" textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="700">+3σ</text>
                </g>
              </svg>
            </div>

            {/* ────────────────────────────────────────────────────────── */}
            {/* X축 눈금 테이블 (-3σ, -2σ, -1σ, 0, +1σ, +2σ, +3σ)           */}
            {/* ────────────────────────────────────────────────────────── */}
            <div className="mt-1.5 overflow-x-auto py-1 px-0.5">
              <div className="grid grid-cols-7 gap-1 min-w-[420px] text-center">
                {bellCurveTicks.map((t, idx) => {
                  const tailProb = Math.abs(t.sigma) === 1 ? "15.9%" : Math.abs(t.sigma) === 2 ? "2.3%" : Math.abs(t.sigma) === 3 ? "0.1%" : "50.0%";
                  const rangeProb = Math.abs(t.sigma) === 1 ? "68.3%" : Math.abs(t.sigma) === 2 ? "95.5%" : Math.abs(t.sigma) === 3 ? "99.7%" : "50.0%";
                  const zoneLabel = t.isCenter
                    ? "현재 기준가"
                    : Math.abs(t.sigma) === 1
                    ? "정상 구간 (±1σ)"
                    : Math.abs(t.sigma) === 2
                    ? "주의 구간 (±2σ)"
                    : "극단 구간 (±3σ)";
                  const desc = t.isCenter
                    ? "현재 주가 기준점 (변동률 0%)"
                    : `±${Math.abs(t.sigma)}σ 범위 안 머무를 확률: ${rangeProb}`;
                  const subDesc = t.isCenter
                    ? null
                    : t.sigma < 0
                    ? `${t.label} 이하 하락 확률: 약 ${tailProb}`
                    : `${t.label} 이상 상승 확률: 약 ${tailProb}`;

                  return (
                  <div
                    key={t.label}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const showBelow = rect.top < 130;
                      setHoveredSigmaTooltip({
                        label: t.label,
                        zoneLabel,
                        desc,
                        subDesc,
                        priceText: formatPrice(t.price),
                        pctText: t.pctChangeStr,
                        top: showBelow ? rect.bottom + 8 : rect.top - 8,
                        left: Math.min(window.innerWidth - 150, Math.max(150, rect.left + rect.width / 2)),
                        showBelow
                      });
                    }}
                    onMouseLeave={() => setHoveredSigmaTooltip(null)}
                    className={`p-1.5 md:p-2 rounded-xl border flex flex-col items-center justify-between transition-all cursor-default hover:-translate-y-0.5 hover:shadow-md opacity-0 animate-summary-pop stagger-${idx + 3} ${
                      t.isCenter
                        ? "bg-blue-50/80 border-blue-200 shadow-xs"
                        : Math.abs(t.sigma) === 1
                        ? "bg-emerald-50/60 border-emerald-200"
                        : Math.abs(t.sigma) === 2
                        ? "bg-purple-50/40 border-purple-100"
                        : "bg-slate-50/80 border-slate-100"
                    }`}
                  >
                    {/* 1. 눈금 명칭 */}
                    <span className={`text-[11px] font-black tracking-tight ${
                      t.isCenter ? "text-blue-700 font-extrabold" : t.sigma > 0 ? "text-emerald-700" : t.sigma < 0 ? "text-blue-700" : "text-slate-600"
                    }`}>
                      {t.label}
                    </span>

                    {/* 2. 변동 비율(%) */}
                    <span className={`text-xs font-black my-1 tabular-nums ${
                      t.isCenter ? "text-blue-600" : t.mult > 0 ? "text-rose-600" : "text-blue-600"
                    }`}>
                      <AnimatedRollingNumber
                        value={t.pctChange}
                        formatFn={(val) => `${val > 0 ? "+" : ""}${val.toFixed(1)}%`}
                      />
                    </span>

                    {/* 3. 현재 주가 환산 가격 */}
                    <span className="text-[10px] md:text-[11px] font-bold text-slate-800 tracking-tight tabular-nums whitespace-nowrap">
                      <AnimatedRollingNumber value={t.price} formatFn={formatPrice} />
                    </span>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 신뢰구간 설명 범례 (좌측 밴드 차트 X축선과 동일 높이 정렬: border-t 1px + pt-[13px] + text-xs 16px = 30px) */}
          <div className="mt-1.5 pt-[13px] border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="font-semibold text-slate-700">±1σ (68.27%)</span>: 정상 주가 구간
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="font-semibold text-slate-700">±2σ (95.45%)</span>: 과열/침체 한계선
            </div>
          </div>
        </div>

      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 4. 하단 추천 섹션: 기간 리스크 요약 & 이상 변동일 분석     */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 md:px-6 md:py-4 animate-card-entrance stagger-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* 좌측 5열: 제목 + 3개 요약 카드 (실제 ±1σ 안착 비율 제외, 중앙 정렬 3열) */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div className="mb-2">
              <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <BarChart2 size={18} className="text-blue-600" />
                기간 리스크 요약 &amp; 이상 변동일 분석
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                선택 기간({PERIOD_OPTIONS.find(p => p.id === period)?.label}) 동안의 이상 변동일, 누적 수익률 및 일간 급등·급락 TOP 3
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              {/* 1. ±2σ 이상 급변동일 */}
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 flex flex-col items-center justify-between text-center opacity-0 animate-summary-pop stagger-5">
                <span className="text-xs font-bold text-slate-500">±2σ 이상 급변동일</span>
                <div className="my-2 flex items-baseline justify-center gap-1 text-base font-black whitespace-nowrap">
                  <span className="text-rose-600">
                    급등 <AnimatedRollingNumber value={stats ? stats.above2SigmaCount : 0} decimals={0} suffix="일" />
                  </span>
                  <span className="text-slate-300">/</span>
                  <span className="text-blue-600">
                    급락 <AnimatedRollingNumber value={stats ? stats.below2SigmaCount : 0} decimals={0} suffix="일" />
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">1일 2σ 초과 이탈 횟수</span>
              </div>

              {/* 2. 기간 누적 수익률 */}
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 flex flex-col items-center justify-between text-center opacity-0 animate-summary-pop stagger-6">
                <span className="text-xs font-bold text-slate-500">기간 누적 수익률</span>
                <div className={`my-2 text-xl font-black tabular-nums ${!stats ? "text-slate-400" : stats.periodReturnRate >= 0 ? "text-rose-600" : "text-blue-600"}`}>
                  <AnimatedRollingNumber
                    value={stats?.periodReturnRate}
                    formatFn={(val) => `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`}
                  />
                </div>
                <span className="text-[11px] text-slate-400">기간 시작일 대비 등락률</span>
              </div>

              {/* 3. 기간 최고 / 최저 종가 */}
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 flex flex-col items-center justify-between text-center opacity-0 animate-summary-pop stagger-7">
                <span className="text-xs font-bold text-slate-500">기간 최고 / 최저 종가</span>
                <div className="my-1.5 w-full space-y-0.5 px-1">
                  <div className="text-xs font-bold text-rose-600 flex items-center justify-between gap-2">
                    <span className="text-slate-400 font-medium">최고</span>
                    <span className="tabular-nums whitespace-nowrap">
                      <AnimatedRollingNumber value={stats?.periodHigh} formatFn={formatPrice} />
                    </span>
                  </div>
                  <div className="text-xs font-bold text-blue-600 flex items-center justify-between gap-2">
                    <span className="text-slate-400 font-medium">최저</span>
                    <span className="tabular-nums whitespace-nowrap">
                      <AnimatedRollingNumber value={stats?.periodLow} formatFn={formatPrice} />
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400">기간 내 종가 기준 범위</span>
              </div>
            </div>
          </div>

          {/* 우측 7열: 일간 최대 급등 / 급락 TOP 3 */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-rose-50/40 border border-rose-200/60 flex flex-col justify-between animate-card-entrance stagger-6">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-rose-700 flex items-center gap-1.5">
                  <TrendingUp size={14} /> 최대 일간 상승 TOP 3
                </span>
              </div>
              <div className="space-y-1.5">
                {stats?.topGains?.length > 0 ? stats.topGains.map((g, idx) => {
                  const dateDays = parseDateToEpochDays(g.date);
                  return (
                    <div key={`gain-${idx}`} className={`flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-rose-100 text-xs opacity-0 animate-feed-lift stagger-${idx + 7}`}>
                      <span className="font-mono text-slate-500 font-semibold tabular-nums">
                        {dateDays != null ? (
                          <AnimatedRollingNumber value={dateDays} formatFn={formatEpochDaysToDate} />
                        ) : g.date}
                      </span>
                      <div className="flex items-center gap-2.5">
                        <span className="text-slate-600 font-medium tabular-nums text-right">
                          <AnimatedRollingNumber value={g.close} formatFn={formatPrice} />
                        </span>
                        <span className="font-black text-rose-600 tabular-nums w-[64px] text-right shrink-0">
                          <AnimatedRollingNumber
                            value={g.pct}
                            formatFn={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`}
                          />
                        </span>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-xs text-slate-400 py-4 text-center">데이터 없음</div>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/40 border border-blue-200/60 flex flex-col justify-between animate-card-entrance stagger-7">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-blue-700 flex items-center gap-1.5">
                  <TrendingDown size={14} /> 최대 일간 하락 TOP 3
                </span>
              </div>
              <div className="space-y-1.5">
                {stats?.topDrops?.length > 0 ? stats.topDrops.map((d, idx) => {
                  const dateDays = parseDateToEpochDays(d.date);
                  return (
                    <div key={`drop-${idx}`} className={`flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-blue-100 text-xs opacity-0 animate-feed-lift stagger-${idx + 8}`}>
                      <span className="font-mono text-slate-500 font-semibold tabular-nums">
                        {dateDays != null ? (
                          <AnimatedRollingNumber value={dateDays} formatFn={formatEpochDaysToDate} />
                        ) : d.date}
                      </span>
                      <div className="flex items-center gap-2.5">
                        <span className="text-slate-600 font-medium tabular-nums text-right">
                          <AnimatedRollingNumber value={d.close} formatFn={formatPrice} />
                        </span>
                        <span className="font-black text-blue-600 tabular-nums w-[64px] text-right shrink-0">
                          <AnimatedRollingNumber
                            value={d.pct}
                            formatFn={(v) => `${v.toFixed(2)}%`}
                          />
                        </span>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-xs text-slate-400 py-4 text-center">데이터 없음</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
        </div>
      )}
      </div>
      )}

      {/* 잘린 종목명 뱃지 마우스 오버 툴팁 */}
      {isBadgeTooltipOpen && activeBadgeTooltip && (
        <div
          style={{ top: activeBadgeTooltip.top, right: activeBadgeTooltip.right }}
          className={`fixed z-[9999] pointer-events-none transition-[top,right] duration-150 ease-out ${activeBadgeTooltip.showBelow ? "" : "-translate-y-full"}`}
        >
          <div className={`bg-slate-900/95 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xl border border-slate-700/80 whitespace-nowrap ${isBadgeTooltipClosing ? "animate-tooltip-out" : "animate-tooltip-in"}`}>
            {activeBadgeTooltip.text}
          </div>
        </div>
      )}

      {/* -3σ ~ +3σ 구간 카드 마우스 오버 툴팁 */}
      {isSigmaTooltipOpen && activeSigmaTooltip && (
        <div
          style={{ top: activeSigmaTooltip.top, left: activeSigmaTooltip.left }}
          className={`fixed z-[9999] pointer-events-none -translate-x-1/2 transition-[top,left] duration-150 ease-out ${activeSigmaTooltip.showBelow ? "" : "-translate-y-full"}`}
        >
          <div className={`bg-slate-900/95 backdrop-blur-md text-white text-xs px-3.5 py-2.5 rounded-xl shadow-2xl border border-slate-700/80 whitespace-nowrap space-y-1 ${isSigmaTooltipClosing ? "animate-tooltip-out" : "animate-tooltip-in"}`}>
            <div className="flex items-center justify-between gap-3 border-b border-slate-700/70 pb-1">
              <span className="font-black text-emerald-400">{activeSigmaTooltip.label}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                {activeSigmaTooltip.zoneLabel}
              </span>
            </div>
            <p className="text-[11px] text-slate-200 font-medium">{activeSigmaTooltip.desc}</p>
            {activeSigmaTooltip.subDesc && (
              <p className="text-[11px] text-slate-300 font-medium">{activeSigmaTooltip.subDesc}</p>
            )}
            <p className="text-[11px] text-slate-300 font-bold">
              예상가: <span className="text-white">{activeSigmaTooltip.priceText}</span> ({activeSigmaTooltip.pctText})
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
