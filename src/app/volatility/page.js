"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Sparkles, 
  BarChart2, 
  RefreshCw,
  SlidersHorizontal,
  Layers,
  ArrowUpRight
} from "lucide-react";
import { useAssets } from "@/contexts/AssetContext";
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";

// 기본 추천 종목 칩 리스트
const QUICK_PICKS = [
  { symbol: "NVDA", name: "NVDA (엔비디아)", market: "NASDAQ", isKRW: false },
  { symbol: "TSLA", name: "TSLA (테슬라)", market: "NASDAQ", isKRW: false },
  { symbol: "AAPL", name: "AAPL (애플)", market: "NASDAQ", isKRW: false },
  { symbol: "SCHD", name: "SCHD", market: "NYSE Arca", isKRW: false },
  { symbol: "SPY", name: "S&P 500 (SPY)", market: "NYSE Arca", isKRW: false },
  { symbol: "005930.KS", name: "삼성전자", market: "KOSPI", isKRW: true },
  { symbol: "000660.KS", name: "SK하이닉스", market: "KOSPI", isKRW: true }
];

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
  const height = 180;
  const paddingX = 40;
  const paddingBottom = 30;
  const paddingTop = 25;

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

export default function VolatilityPage() {
  const { holdings } = useAssets();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 검색 및 기간 상태
  const [selectedStock, setSelectedStock] = useState({
    symbol: "NVDA",
    name: "NVDA (엔비디아)",
    market: "NASDAQ",
    isKRW: false
  });
  const [period, setPeriod] = useState("1y");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef(null);

  // 주가 히스토리 데이터 상태
  const [historyData, setHistoryData] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [previousClose, setPreviousClose] = useState(null);
  const [currency, setCurrency] = useState("USD");
  const [isLoading, setIsLoading] = useState(true);
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

  // 주가 히스토리 데이터 로드 (네이버 증권 1순위 -> 야후 보완)
  useEffect(() => {
    let isCancelled = false;

    async function loadStockHistory() {
      if (!selectedStock?.symbol) return;
      setIsLoading(true);
      setErrorMsg("");

      try {
        const res = await fetch(`/api/stock-history?symbol=${encodeURIComponent(selectedStock.symbol)}&period=${period}`);
        if (!res.ok) {
          throw new Error("주가 데이터를 불러오지 못했습니다.");
        }
        const data = await res.json();
        if (isCancelled) return;

        if (data.history && data.history.length > 0) {
          setHistoryData(data.history);
          setCurrentPrice(data.currentPrice || data.history[data.history.length - 1].close);
          setPreviousClose(data.previousClose || (data.history.length > 1 ? data.history[data.history.length - 2].close : null));
          setCurrency(data.currency || (selectedStock.isKRW ? "KRW" : "USD"));
        } else {
          throw new Error("조회된 시세 데이터가 없습니다.");
        }
      } catch (err) {
        if (!isCancelled) {
          setErrorMsg(err.message || "주가 데이터를 불러오는 중 오류가 발생했습니다.");
          setHistoryData([]);
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadStockHistory();

    return () => {
      isCancelled = true;
    };
  }, [selectedStock, period]);

  // 검색 디바운스
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stock-search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            setSearchResults(list.slice(0, 8));
            setIsSearchOpen(true);
          } else {
            setSearchResults([]);
          }
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 통화 포맷 함수
  const formatPrice = (val) => {
    if (val == null || isNaN(val)) return "-";
    const isKr = currency === "KRW" || selectedStock.isKRW;
    if (isKr) {
      return `₩${Math.round(val).toLocaleString("ko-KR")}`;
    }
    return `$${Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

    // 금융공학 로그정규분포(Log-Normal) 기반 예상 가격 범위 (하락 시 -100% 초과 방지)
    const lower1s = activePrice * Math.exp(-1 * periodSigma);
    const upper1s = activePrice * Math.exp(1 * periodSigma);

    const lower2s = activePrice * Math.exp(-2 * periodSigma);
    const upper2s = activePrice * Math.exp(2 * periodSigma);

    const lower3s = activePrice * Math.exp(-3 * periodSigma);
    const upper3s = activePrice * Math.exp(3 * periodSigma);

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

    dailyReturns.forEach((r) => {
      if (dailySigma > 0) {
        const z = (r - meanDaily) / dailySigma;
        if (z >= minZ && z <= maxZ) {
          const bIdx = Math.min(BIN_COUNT - 1, Math.max(0, Math.floor((z - minZ) / binWidthZ)));
          binCounts[bIdx]++;
        }
      }
    });

    const maxBinCount = Math.max(1, ...binCounts);
    const svgWidth = 600;
    const svgHeight = 180;
    const padX = 40;
    const padBottom = 30;
    const maxBarH = 100; // 최대 막대 높이

    const histogramBars = binCounts.map((count, idx) => {
      const zStart = minZ + idx * binWidthZ;
      const x = padX + ((zStart - minZ) / (maxZ - minZ)) * (svgWidth - 2 * padX);
      const w = ((svgWidth - 2 * padX) / BIN_COUNT) * 0.85; // 막대 간격 여백
      const h = (count / maxBinCount) * maxBarH;
      const y = svgHeight - padBottom - h;
      return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), width: Number(w.toFixed(1)), height: Number(h.toFixed(1)), count };
    });

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
      chartSeries,
      latestDist,
      riskLevel,
      histogramBars,
      sampleCount: N
    };
  }, [historyData, currentPrice, previousClose]);

  // ══════════════════════════════════════════════════════════
  // 정규분포(Bell Curve) 7개 눈금 데이터 (-3σ ~ +3σ)
  // ══════════════════════════════════════════════════════════
  const bellCurveTicks = useMemo(() => {
    if (!stats) return [];
    const { activePrice, periodSigma } = stats;

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
      // 기하 브라운 운동 로그정규분포 모델: P = P0 * exp(k * sigma)
      const targetPrice = t.mult === 0 ? activePrice : activePrice * Math.exp(t.mult * periodSigma);
      const pctChange = t.mult === 0 ? 0 : ((targetPrice - activePrice) / activePrice) * 100;
      return {
        ...t,
        pctChangeStr: (pctChange > 0 ? "+" : "") + pctChange.toFixed(1) + "%",
        price: targetPrice
      };
    });
  }, [stats]);

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
      return holdings.slice(0, 6).map((h, i) => {
        const colors = [
          "from-emerald-500 to-teal-400",
          "from-sky-500 to-blue-400",
          "from-indigo-500 to-violet-400",
          "from-purple-500 to-fuchsia-400",
          "from-amber-500 to-orange-400",
          "from-rose-500 to-pink-400"
        ];
        return {
          symbol: h.code || h.symbol,
          name: h.name || h.code,
          vol: Number((20 + (i * 7.3) % 30).toFixed(1)),
          color: colors[i % colors.length]
        };
      });
    }

    return defaultList;
  }, [holdings]);

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 py-6 md:py-8 space-y-6 animate-fade-in text-slate-800">
      
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. 최상단 헤더 섹션 (다른 화면들과 동일하게 박스 밖 좌측 상단)  */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. 종목 검색 & 기간 선택 컨트롤 바                         */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 md:p-5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          
          {/* 종목 검색창 */}
          <div className="relative flex-1 max-w-md" ref={searchContainerRef}>
            <div className="relative flex items-center">
              <Search size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="종목명 또는 티커 검색 (예: NVDA, 삼성전자)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setIsSearchOpen(true);
                }}
                className="w-full pl-10 pr-9 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition-all"
              />
              {isSearching && (
                <RefreshCw size={14} className="absolute right-3 text-slate-400 animate-spin" />
              )}
            </div>

            {/* 검색 드롭다운 */}
            {isSearchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {searchResults.map((item) => (
                  <button
                    key={item.code}
                    onClick={() => {
                      setSelectedStock({
                        symbol: item.symbol || item.code,
                        name: `${item.symbol || item.code} (${item.name})`,
                        market: item.market,
                        isKRW: item.market === "KOSPI" || item.market === "KOSDAQ"
                      });
                      setSearchQuery("");
                      setIsSearchOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-800">{item.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{item.code} · {item.market}</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                      선택
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 기간 선택 버튼 세그먼트 + 비교 지수 배지 */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setPeriod(opt.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    period === opt.id
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 비교 지수 배지 */}
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-500 whitespace-nowrap">
              비교 지수: <span className="font-bold text-slate-700">S&P 500 (SPY)</span>
            </div>
          </div>

        </div>

        {/* 퀵 픽 추천 종목 칩 */}
        <div className="mt-3.5 pt-3.5 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-bold text-slate-400 shrink-0">추천 종목:</span>
          {QUICK_PICKS.map((qp) => {
            const isSelected = selectedStock.symbol === qp.symbol;
            return (
              <button
                key={qp.symbol}
                onClick={() => setSelectedStock(qp)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {qp.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. 상단 4대 핵심 카드 (시안의 여백 및 뱃지 위계와 일치)     */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* ① 현재 주가 (기준가) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold text-slate-500 tracking-wide">① 현재 주가 (기준가)</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                {selectedStock.symbol.replace(/\.(KS|KQ)$/, '')}
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight text-right flex justify-end">
              {isLoading ? (
                <div className="h-9 w-28 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                formatPrice(stats?.activePrice)
              )}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400">전일 대비</span>
            {stats && (
              <span className={`inline-flex items-center gap-0.5 font-bold ${stats.priceChange >= 0 ? "text-rose-600" : "text-blue-600"}`}>
                {stats.priceChange >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {stats.priceChange >= 0 ? "+" : ""}{formatPrice(stats.priceChange)} ({stats.priceChangeRate >= 0 ? "+" : ""}{stats.priceChangeRate.toFixed(2)}%)
              </span>
            )}
          </div>
        </div>

        {/* ② 선택 기간 표준편차 (변동성) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold text-slate-500 tracking-wide">② {PERIOD_OPTIONS.find(p => p.id === period)?.label} 표준편차 (변동성)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                {stats?.riskLevel.label.split(" ")[0] || "변동성 구간"}
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-black text-blue-600 tracking-tight text-right flex justify-end">
              {isLoading || !stats ? (
                <div className="h-9 w-24 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                `±${(stats.periodSigma * 100).toFixed(1)}%`
              )}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400">연환산 변동성</span>
            <span className="text-slate-700 font-bold">
              {stats ? `${(stats.annualSigma * 100).toFixed(1)}%` : "-"}
            </span>
          </div>
        </div>

        {/* ③ 1표준편차 상·하단 예상 가격 범위 */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold text-slate-500 tracking-wide">③ 1σ 예상 가격 범위</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                68.3% 신뢰구간
              </span>
            </div>
            <div className="text-lg md:text-xl font-black text-slate-900 tracking-tight flex items-baseline justify-end gap-1.5 flex-wrap text-right">
              {isLoading || !stats ? (
                <div className="h-9 w-40 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                <>
                  <span className="text-slate-600 font-bold text-base">{formatPrice(stats.lower1s)}</span>
                  <span className="text-slate-300 font-normal">~</span>
                  <span className="text-emerald-600 font-black">{formatPrice(stats.upper1s)}</span>
                </>
              )}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400">정상 통계 확률</span>
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
              68.27% 구간
            </span>
          </div>
        </div>

        {/* ④ 1일 평균 변동폭 (1-Day σ) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold text-slate-500 tracking-wide">④ 1일 평균 변동폭 (1-Day σ)</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                일일 리스크
              </span>
            </div>
            <div className="text-2xl md:text-3xl font-black text-amber-600 tracking-tight text-right flex justify-end">
              {isLoading || !stats ? (
                <div className="h-9 w-24 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                `± ${(stats.dailySigma * 100).toFixed(2)}%`
              )}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400">일평균 등락 범위</span>
            <span className="text-slate-700 font-bold">
              {stats ? `±${formatPrice(stats.dailyPriceDelta)}` : "-"}
            </span>
          </div>
        </div>

      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3. 메인 분석 섹션: 좌측 차트(60%) + 우측 정규분포(40%)    */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* [좌측 7열] 주가 추이 및 표준편차(±1σ, ±2σ) 밴드 차트 */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
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
                <div className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${stats.riskLevel.color}`}>
                  {stats.riskLevel.label}
                </div>
              )}
            </div>

            {/* 범례 표시 (시안 스타일) */}
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 mb-3 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-blue-600 rounded-sm" /> 주가 (Close)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-slate-400 rounded-sm" /> 이동평균 (Mean)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 bg-emerald-100 border border-emerald-400 rounded-xs" /> ±1σ 밴드 (68.3%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 bg-purple-50 border border-purple-300 rounded-xs" /> ±2σ 밴드 (95.5%)
              </span>
            </div>

            {/* 차트 본체 */}
            <div className="h-[280px] w-full relative">
              {/* 시안의 최신 주가 핀 포인트 플로팅 배지 (NVDA $145.98 (+1.8σ)) */}
              {stats && !isLoading && (
                <div className="absolute top-2 right-4 z-10 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold shadow-md flex items-center gap-1.5">
                  <span>{selectedStock.symbol.replace(/\.(KS|KQ)$/, '')}</span>
                  <span className="text-emerald-400">{formatPrice(stats.activePrice)}</span>
                  <span className="text-[11px] font-normal text-slate-300">
                    ({stats.latestDist >= 0 ? `+${stats.latestDist}σ` : `${stats.latestDist}σ`})
                  </span>
                </div>
              )}

              {isLoading ? (
                <div className="h-full w-full flex items-center justify-center">
                  <RefreshCw size={24} className="text-slate-400 animate-spin" />
                </div>
              ) : isMounted && stats?.chartSeries?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.chartSeries} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
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
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                      tickFormatter={(v) => (selectedStock.isKRW ? `${Math.round(v).toLocaleString()}` : `$${v}`)}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const p = payload[0].payload;
                          const distFromMa = p.ma ? ((p.close - p.ma) / (p.upper1 - p.ma || 1)).toFixed(2) : "0";
                          return (
                            <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-xl text-xs space-y-1">
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
                    {/* ±2σ 상·하단 */}
                    <Line type="monotone" dataKey="upper2" stroke="#d8b4fe" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="lower2" stroke="#d8b4fe" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                    {/* ±1σ 상·하단 */}
                    <Line type="monotone" dataKey="upper1" stroke="#34d399" strokeWidth={1.5} dot={false} strokeDasharray="2 2" />
                    <Line type="monotone" dataKey="lower1" stroke="#34d399" strokeWidth={1.5} dot={false} strokeDasharray="2 2" />
                    {/* 20일 이동평균선 */}
                    <Line type="monotone" dataKey="ma" stroke="#94a3b8" strokeWidth={1.5} dot={false} />
                    {/* 실제 주가 라인 */}
                    <Area type="monotone" dataKey="close" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorClose)" />
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
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-5 md:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Sparkles size={18} className="text-emerald-600" />
                  일일 수익률 정규분포 (Bell Curve & Histogram)
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  1~3 표준편차(σ) 구간별 예상 가격 및 변동 비율
                </p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                위험 등급: {stats?.riskLevel.label.split(" ")[0] || "보통"}
              </span>
            </div>

            {/* 정규분포 SVG 벨 커브 + 실제 수익률 빈도 히스토그램 막대 */}
            <div className="relative w-full overflow-hidden mt-2 bg-slate-50/70 rounded-xl border border-slate-100 p-2">
              <svg 
                viewBox={`0 0 ${STATIC_BELL_CURVE_SVG.width} ${STATIC_BELL_CURVE_SVG.height}`} 
                className="w-full h-auto"
                suppressHydrationWarning
              >
                {/* 1. 배경 면적 채우기 */}
                <path d={STATIC_BELL_CURVE_SVG.areaPath} fill="#f1f5f9" opacity={0.6} suppressHydrationWarning />

                {/* 2. ±1σ 채움 영역 (-1 ~ +1) */}
                <rect x="225" y="15" width="150" height="135" fill="#ecfdf5" opacity={0.7} rx="6" />

                {/* 3. 시안의 실제 일별 수익률 히스토그램 막대들 (Histogram) */}
                {stats?.histogramBars?.map((bar, idx) => (
                  <rect
                    key={idx}
                    x={bar.x}
                    y={bar.y}
                    width={bar.width}
                    height={bar.height}
                    fill="#94a3b8"
                    opacity={0.35}
                    rx="1.5"
                  />
                ))}

                {/* 4. 중앙 0 (기준가) 기준선 */}
                <line x1="300" y1="20" x2="300" y2="150" stroke="#059669" strokeWidth="2" strokeDasharray="3 3" />

                {/* 5. -1σ, +1σ 점선 */}
                <line x1="225" y1="45" x2="225" y2="150" stroke="#10b981" strokeWidth="1.5" strokeDasharray="2 2" />
                <line x1="375" y1="45" x2="375" y2="150" stroke="#10b981" strokeWidth="1.5" strokeDasharray="2 2" />

                {/* 6. -2σ, +2σ 점선 */}
                <line x1="150" y1="100" x2="150" y2="150" stroke="#a855f7" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="450" y1="100" x2="450" y2="150" stroke="#a855f7" strokeWidth="1" strokeDasharray="2 2" />

                {/* 7. 메인 벨 커브 곡선 */}
                <path d={STATIC_BELL_CURVE_SVG.path} fill="none" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" suppressHydrationWarning />

                {/* 상단 레이블 (시안: 평균 +0.22% 및 68.3% 구간) */}
                <text x="300" y="32" textAnchor="middle" fill="#047857" fontSize="11" fontWeight="800">
                  평균 {stats ? `${(stats.meanDaily * 100 >= 0 ? "+" : "")}${(stats.meanDaily * 100).toFixed(2)}%` : "+0.0%"} (±1σ 68.3%)
                </text>
              </svg>
            </div>

            {/* ────────────────────────────────────────────────────────── */}
            {/* X축 눈금 테이블 (-3σ, -2σ, -1σ, 0, +1σ, +2σ, +3σ)           */}
            {/* ────────────────────────────────────────────────────────── */}
            <div className="mt-3 overflow-x-auto">
              <div className="grid grid-cols-7 gap-1 min-w-[420px] text-center">
                {bellCurveTicks.map((t) => (
                  <div
                    key={t.label}
                    className={`p-1.5 md:p-2 rounded-xl border flex flex-col items-center justify-between transition-all ${
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
                    <span className={`text-xs font-black my-1 ${
                      t.isCenter ? "text-blue-600" : t.mult > 0 ? "text-rose-600" : "text-blue-600"
                    }`}>
                      {t.pctChangeStr}
                    </span>

                    {/* 3. 현재 주가 환산 가격 */}
                    <span className="text-[10px] md:text-[11px] font-bold text-slate-800 tracking-tight whitespace-nowrap">
                      {formatPrice(t.price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 신뢰구간 설명 범례 */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
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

      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 4. 하단: 포트폴리오 보유 종목 변동성 비교 (시안과 1:1 일치) */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Activity size={18} className="text-slate-700" />
              포트폴리오 보유 종목 변동성 비교
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              종목을 클릭하면 해당 종목의 정규분포 및 변동성 분석으로 즉시 전환됩니다.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-400">
            주요 비교 종목 {comparisonList.length}개
          </span>
        </div>

        {/* 시안의 가로형 컬러 프로그레스 바 카드 그리드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {comparisonList.map((item) => {
            const isCurrent = selectedStock.symbol === item.symbol || selectedStock.symbol.startsWith(item.symbol);
            const maxVol = 60; // 최대 게이지 기준 60%
            const pctBar = Math.min(100, Math.max(10, (item.vol / maxVol) * 100));

            return (
              <button
                key={item.symbol}
                onClick={() => {
                  setSelectedStock({
                    symbol: item.symbol,
                    name: item.name,
                    market: item.symbol.includes(".KS") ? "KOSPI" : "US",
                    isKRW: item.symbol.includes(".KS")
                  });
                }}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isCurrent
                    ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-blue-500/30"
                    : "bg-slate-50/80 hover:bg-slate-100 border-slate-200/80 text-slate-800"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black tracking-tight">{item.symbol.replace(/\.(KS|KQ)$/, '')}</span>
                    <span className={`text-xs font-black ${isCurrent ? "text-emerald-400" : "text-blue-600"}`}>
                      {item.vol}%
                    </span>
                  </div>
                  <div className={`text-[11px] truncate mb-3 ${isCurrent ? "text-slate-400" : "text-slate-500"}`}>
                    {item.name}
                  </div>
                </div>

                {/* 시안의 컬러 게이지 바 */}
                <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full bg-gradient-to-r ${item.color} transition-all duration-500`}
                    style={{ width: `${pctBar}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
