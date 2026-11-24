"use client";

import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Sparkles, 
  BarChart2, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Check, 
  X,
  AlertCircle, 
  HelpCircle,
  Sliders,
  Wallet,
  ShieldCheck,
  Calendar,
  ExternalLink,
  ChevronDown,
  Info
} from "lucide-react";
import { useAssets } from "@/contexts/AssetContext";
import { useAnimatedModal } from "@/hooks/useAnimatedModal";
import BacktestDashboard from "./BacktestDashboard";

export default function BacktestPage() {
  const { holdings } = useAssets();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ── 포트폴리오 빌더 상태 (초기 완전 빈 상태로 시작) ──
  const [portfolio, setPortfolio] = useState([]);
  const [initialAmount, setInitialAmount] = useState(10000000); // 1,000만 원
  const [monthlyContribution, setMonthlyContribution] = useState(500000); // 월 50만 원
  const [period, setPeriod] = useState("5y");
  const [rebalancing, setRebalancing] = useState("none"); // 기본값: 리밸런싱 없음
  const [isRebalancingOpen, setIsRebalancingOpen] = useState(false);
  const rebalancingRef = useRef(null);
  const [benchmarks, setBenchmarks] = useState(["SPY", "QQQ"]);

  // ── 실제 백테스트 실행 시 확정된 금액 설정 (대시보드 불필요 렌더링 방지용) ──
  const [executedConfig, setExecutedConfig] = useState({
    initialAmount: 10000000,
    monthlyContribution: 500000,
    period: "5y",
    executedAt: 0
  });

  // ── 매매-등록 팝업 스타일의 커스텀 알림 모달 상태 ──
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: "", message: "", type: "error", align: "center" });
  const { mounted: alertMounted, isClosing: alertClosing } = useAnimatedModal(alertModal.isOpen);
  const alertOpenedAtRef = useRef(0);

  const showAlert = (title, message, type = "error", align = "center") => {
    alertOpenedAtRef.current = Date.now();
    setAlertModal({ isOpen: true, title, message, type, align });
  };

  const closeAlert = () => {
    setAlertModal(prev => ({ ...prev, isOpen: false }));
  };

  // 모달 키보드 이벤트 핸들러 (ESC 키로 즉시 닫기, Enter/Space는 250ms 이후 사용자의 의도적인 입력 시에만 닫기)
  useEffect(() => {
    if (!alertModal.isOpen) return;
    const handleModalKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeAlert();
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        // 엔터키로 종목 추가 시 발생한 직전 엔터 입력에 의해 모달이 즉시 닫히는 현상(키 중복) 방지
        if (Date.now() - alertOpenedAtRef.current > 250) {
          e.preventDefault();
          closeAlert();
        }
      }
    };
    window.addEventListener("keydown", handleModalKeyDown);
    return () => window.removeEventListener("keydown", handleModalKeyDown);
  }, [alertModal.isOpen]);

  // 비교 벤치마크 체크/체크해제 토글 함수
  const toggleBenchmark = (sym) => {
    setBenchmarks(prev => 
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
    );
  };

  const REBALANCING_OPTIONS = [
    { id: "none", label: "리밸런싱 없음", eng: "Buy & Hold" },
    { id: "monthly", label: "월별", eng: "Monthly" },
    { id: "quarterly", label: "분기별", eng: "Quarterly" },
    { id: "annually", label: "연간", eng: "Annually" }
  ];

  const currentRebalancingOption = REBALANCING_OPTIONS.find(o => o.id === rebalancing) || REBALANCING_OPTIONS[0];

  // 종목 검색 상태
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [hoveredStockTooltip, setHoveredStockTooltip] = useState(null);
  const searchContainerRef = useRef(null);
  const dropdownListRef = useRef(null);

  // ── 백테스트 결과 상태 ──
  const [loading, setLoading] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [insufficientStocks, setInsufficientStocks] = useState([]);

  // 외부 클릭 시 검색 드롭다운 & 리밸런싱 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setIsSearchOpen(false);
        setSelectedSearchIndex(0);
      }
      if (rebalancingRef.current && !rebalancingRef.current.contains(event.target)) {
        setIsRebalancingOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 종목 검색 실행 함수
  const executeSearch = async (query) => {
    const trimmed = (query || "").trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return [];
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/stock-search?q=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          setSearchResults(list.slice(0, 8));
          setIsSearchOpen(true);
          return list;
        }
      }
      setSearchResults([]);
      return [];
    } catch {
      setSearchResults([]);
      return [];
    } finally {
      setIsSearching(false);
    }
  };

  // 검색어 입력 변경 (한글, 영문 대문자, 숫자 허용 & 소문자 입력 시 대문자 자동 변환)
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

  // 붙여넣기(Ctrl+V) 처리: 한글/영문(대문자)/숫자 추출하여 즉시 삽입
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

  // 키보드로 선택된 항목이 스크롤 영역 밖으로 나갈 때 자동으로 스크롤 추적
  useEffect(() => {
    if (isSearchOpen && dropdownListRef.current) {
      const selectedItem = dropdownListRef.current.children[selectedSearchIndex];
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedSearchIndex, isSearchOpen]);

  // 키보드 네비게이션 및 엔터 검색/선택 핸들러
  const handleSearchKeyDown = async (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End"].includes(e.key)) {
      return;
    }

    // 1. 이미 검색 리스트가 열려 있는 경우 방향키로 선택 항목 이동
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

    // 2. 엔터키 입력 처리 (한글 IME 조합 중 엔터 중복 방지)
    if (e.key === "Enter") {
      if (e.nativeEvent && e.nativeEvent.isComposing) return;
      e.preventDefault();
      e.stopPropagation();
      const trimmed = searchQuery.trim();
      if (!trimmed) return;

      // 이미 검색 결과가 나와 있고 첫 번째(또는 선택된) 항목이 있는 상태에서 엔터 -> 종목 추가
      if (isSearchOpen && searchResults.length > 0) {
        const target = searchResults[selectedSearchIndex] || searchResults[0];
        addStock(target);
        return;
      }

      // 종목명/티커 입력 후 첫 번째 엔터 -> 종목 검색 실행
      const list = await executeSearch(trimmed);
      if (list && list.length > 0) {
        setSelectedSearchIndex(0);
        setIsSearchOpen(true);
      } else {
        showAlert("검색 결과 없음", `"${trimmed}" 검색 결과가 없습니다.\n티커 또는 종목명을 다시 확인해주세요.`, "error");
      }
      return;
    }
  };

  // 총 비중 합계
  const totalWeight = useMemo(() => {
    return portfolio.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  }, [portfolio]);

  // 종목 비중 변경
  const updateWeight = (index, newWeight) => {
    let val = newWeight;
    if (newWeight !== "") {
      val = Math.max(0, Math.min(100, Number(newWeight) || 0));
    }
    setPortfolio(prev => {
      const next = [...prev];
      next[index] = { ...next[index], weight: val };
      return next;
    });
  };

  // 종목 삭제
  const removeStock = (index) => {
    const target = portfolio[index];
    setPortfolio(prev => prev.filter((_, i) => i !== index));
    if (target) {
      setInsufficientStocks(prev => prev.filter(sym => sym !== target.symbol && sym !== target.code));
    }
    setErrorMsg("");
  };

  // 종목 추가
  const addStock = (stock) => {
    setErrorMsg("");
    if (portfolio.some(p => p.symbol === stock.code || p.symbol === stock.symbol || p.code === stock.code)) {
      setIsSearchOpen(false);
      showAlert("종목 추가 안내", "이미 포트폴리오에 추가된 종목입니다.", "warning");
      return;
    }
    if (portfolio.length >= 10) {
      setIsSearchOpen(false);
      showAlert("종목 추가 한도", "포트폴리오는 최대 10개 종목까지 추가할 수 있습니다.", "warning");
      return;
    }

    const isDomestic = stock.market === "KOSPI" || stock.market === "KOSDAQ" || /^\d{6}/.test(stock.code);
    const sym = isDomestic && !stock.code.includes(".") ? `${stock.code}.KS` : (stock.symbol || stock.code);
    const themeColor = isDomestic ? "#3b82f6" : "#f59e0b"; // 국내: 파란색, 해외: 노란색(호박색)

    // 첫 번째 종목이면 100%, 기존 종목이 있고 비중 여유가 있으면 남은 비중 할당
    let initialWeight = 0;
    if (portfolio.length === 0) {
      initialWeight = 100;
    } else if (totalWeight < 100) {
      initialWeight = Math.max(0, 100 - totalWeight);
    }

    const newStock = {
      symbol: sym,
      code: stock.code,
      name: stock.name,
      market: stock.market || (isDomestic ? "KOSPI" : "US"),
      currency: isDomestic ? "KRW" : "USD",
      weight: initialWeight,
      color: themeColor
    };

    setPortfolio(prev => [...prev, newStock]);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedSearchIndex(0);
    setIsSearchOpen(false);
  };

  // 균등 배분 버튼
  const handleEqualWeight = () => {
    if (portfolio.length === 0) return;
    const equalVal = Math.floor(100 / portfolio.length);
    const remainder = 100 - (equalVal * portfolio.length);

    setPortfolio(prev => prev.map((item, idx) => ({
      ...item,
      weight: idx === 0 ? equalVal + remainder : equalVal
    })));
  };

  // 내 보유 자산 불러오기
  const handleLoadHoldings = () => {
    if (!holdings || holdings.length === 0) {
      showAlert("보유 자산 없음", "현재 등록된 보유 자산이 없습니다.", "warning");
      return;
    }

    // 평가금액 기준 비중 계산
    const totalVal = holdings.reduce((sum, h) => sum + (h.evaluation_amount || 0), 0);
    if (totalVal <= 0) return;

    const colors = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4", "#6366f1"];
    const topHoldings = holdings.slice(0, 8); // 최대 상위 8개
    let allocated = 0;

    const loaded = topHoldings.map((h, i) => {
      const isLast = i === topHoldings.length - 1;
      const rawPct = Math.round(((h.evaluation_amount || 0) / totalVal) * 100);
      const weight = isLast ? (100 - allocated) : rawPct;
      allocated += weight;

      const isDomestic = h.currency === "KRW" || /^\d{6}/.test(h.code);
      const sym = isDomestic && !h.code.includes(".") ? `${h.code}.KS` : h.code;
      const themeColor = isDomestic ? "#3b82f6" : "#f59e0b"; // 국내: 파란색, 해외: 노란색(호박색)

      return {
        symbol: sym,
        code: h.code,
        name: h.name || h.code,
        market: h.market || (isDomestic ? "KOSPI" : "US"),
        currency: h.currency || (isDomestic ? "KRW" : "USD"),
        weight: Math.max(0, weight),
        color: themeColor
      };
    });

    setPortfolio(loaded);
    setInsufficientStocks([]);
    setErrorMsg("");
  };

  // ── 백테스트 실행 함수 ──
  const runBacktest = async () => {
    if (portfolio.length === 0) {
      showAlert("입력 오류", "포트폴리오에 최소 1개 이상의 종목을 추가해주세요.", "error");
      return;
    }
    if (totalWeight !== 100) {
      showAlert("비중 설정 오류", `종목 비중의 총합이 100%가 되어야 합니다.\n(현재 합계: ${totalWeight}%)`, "error");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setInsufficientStocks([]);

    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolio: portfolio.map(p => ({ ...p, weight: Number(p.weight) || 0 })),
          initialAmount: Number(initialAmount) || 0,
          monthlyContribution: Number(monthlyContribution) || 0,
          period,
          rebalancing,
          benchmarks
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setErrorMsg("거래일이 부족한 종목이 있습니다.");
        if (errJson.excludedStocks && errJson.excludedStocks.length > 0) {
          setInsufficientStocks(errJson.excludedStocks.map(s => s.symbol || s.code));
        }
        showAlert(
          "백테스트 종목확인",
          errJson.error || "백테스트를 위한 거래일 부족한 종목이 있습니다.\n(최소 20영업일 이상)\n조회 가능한 종목만 적용하겠습니다.\n\n상장 기간이 부족한 종목을 제외해 주세요.",
          "error",
          "left"
        );
        return;
      }

      const data = await res.json();
      setResultData(data);
      setExecutedConfig({
        initialAmount: Number(initialAmount) || 0,
        monthlyContribution: Number(monthlyContribution) || 0,
        period,
        executedAt: Date.now()
      });

      // 거래일 부족으로 자동 제외된 종목이 있는 경우
      if (data.excludedStocks && data.excludedStocks.length > 0) {
        setErrorMsg("거래일이 부족한 종목이 있습니다.");
        setInsufficientStocks(data.excludedStocks.map(s => s.symbol || s.code));
        const stockListText = data.excludedStocks.map((s, idx) => `  ${idx + 1}. ${s.name} : ${s.firstDate}`).join("\n");
        showAlert(
          "백테스트 종목확인",
          `백테스트를 위한 거래일 부족한 종목이 있습니다.\n(최소 20영업일 이상)\n조회 가능한 종목만 적용하겠습니다.\n\n[상장 기간 부족 종목 ( ${data.excludedStocks.length}개)]\n${stockListText}\n\n상장 기간이 부족한 종목을 제외해 주세요.`,
          "warning",
          "left"
        );
      } else {
        setErrorMsg("");
        setInsufficientStocks([]);
      }
    } catch (err) {
      setErrorMsg("거래일이 부족한 종목이 있습니다.");
      showAlert("백테스트 종목확인", err.message || "거래일이 부족한 종목이 있습니다.", "error", "left");
    } finally {
      setLoading(false);
    }
  };

  // 통화 포맷 함수 (useCallback으로 메모이제이션하여 대시보드 리렌더링 방지)
  const formatWon = useCallback((val) => {
    if (val == null || isNaN(val)) return "-";
    const num = Math.round(val);
    if (Math.abs(num) >= 100000000) {
      return `₩${(num / 100000000).toFixed(2)}억`;
    }
    if (Math.abs(num) >= 10000) {
      return `₩${(num / 10000).toLocaleString()}만`;
    }
    return `₩${num.toLocaleString()}`;
  }, []);

  const summary = resultData?.summary;

  return (
    <div className="w-full max-w-[1680px] mx-auto px-4 py-6 md:py-8 space-y-6 animate-fade-in text-slate-800">
      
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. 최상단 헤더 섹션 (다른 화면들과 동일한 박스 밖 좌측 상단)  */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
            <Layers size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              포트폴리오 백테스트 & 벤치마크 분석
            </h1>
            <p className="text-xs md:text-sm font-medium text-slate-500 mt-0.5">
              맞춤 자산 배분 비중 기반 과거 수익률, MDD 및 시장 지수(S&P 500, QQQ) 상관관계 분석
            </p>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. 메인 화면 레이아웃 (좌측 26% 빌더 + 우측 74% 대시보드)   */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ══════════════════════════════════════════════════════════ */}
        {/* [좌측] 포트폴리오 비중 및 백테스트 설정 패널              */}
        {/* ══════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4.5 space-y-3.5 lg:h-[935px] lg:min-h-[935px] lg:max-h-[935px] flex flex-col self-start">
          
          {/* 패널 타이틀 & 종목 수 뱃지 */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              <Sliders size={16} className="text-indigo-600" />
              포트폴리오 구성
            </h2>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-lg transition-all ${
                portfolio.length > 0
                  ? "bg-indigo-50 text-indigo-600 border border-indigo-200 font-black shadow-2xs"
                  : "bg-slate-100 text-slate-400 border border-slate-200/80"
              }`}
            >
              총 {portfolio.length} 종목
            </span>
          </div>

          {/* 종목 검색 및 추가 입력창 */}
          <div className="relative" ref={searchContainerRef}>
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
                className="w-full pl-3.5 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold transition-all uppercase placeholder:normal-case placeholder:font-normal"
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
                      addStock(searchResults[selectedSearchIndex] || searchResults[0]);
                      return;
                    }
                    const list = await executeSearch(trimmed);
                    if (list && list.length > 0) {
                      setSelectedSearchIndex(0);
                      setIsSearchOpen(true);
                    } else {
                      showAlert("검색 결과 없음", `"${trimmed}" 검색 결과가 없습니다.\n티커 또는 종목명을 다시 확인해주세요.`, "error");
                    }
                  }}
                  className="absolute right-2.5 p-0.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
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
                className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 max-h-[192px] overflow-y-auto text-xs"
              >
                {searchResults.map((item, idx) => {
                  const isSelected = selectedSearchIndex === idx;
                  const isItemDomestic = item.currency === "KRW" || /^\d{6}/.test(item.code) || item.market === "KOSPI" || item.market === "KOSDAQ";
                  return (
                    <button
                      key={`${item.code}-${idx}`}
                      onClick={() => addStock(item)}
                      onMouseEnter={() => setSelectedSearchIndex(idx)}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-indigo-50/90 text-indigo-950 font-bold border-l-3 border-indigo-600 pl-2.5"
                          : "hover:bg-slate-50 text-slate-800"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="truncate max-w-[160px] text-xs font-bold">{item.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[9px] font-bold px-1 py-0.2 rounded shrink-0 ${
                            isItemDomestic 
                              ? "bg-blue-50 text-blue-600 border border-blue-200/60" 
                              : "bg-amber-50 text-amber-700 border border-amber-200/60"
                          }`}>
                            {isItemDomestic ? "국내" : "해외"}
                          </span>
                          <span className={`text-[10px] font-mono ${isSelected ? "text-indigo-600" : "text-slate-400"}`}>
                            {item.code} · {item.market}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center">
                        {isSelected ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-600 text-white font-black shadow-2xs flex items-center gap-1">
                            선택됨 <span className="text-[9px] opacity-80">↵</span>
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold">
                            추가
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 종목별 비중 슬라이더 카드 리스트 (좌측 935px 고정 높이에 맞춰 flex-1 유동 확장 및 5개 이상 시 스크롤) */}
          <div 
            className="flex-1 min-h-[220px] overflow-y-auto pr-1 space-y-2.5"
            onScroll={() => setHoveredStockTooltip(null)}
          >
            {portfolio.length === 0 ? (
              <div className="h-full w-full text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 flex flex-col items-center justify-center space-y-3 p-4">
                <div className="w-11 h-11 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center shadow-2xs">
                  <Plus size={22} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700">추가된 종목이 없습니다</p>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    상단 검색창에서 종목을 검색하여 추가하거나,<br />
                    아래 &apos;내 보유자산 불러오기&apos;를 눌러보세요.
                  </p>
                </div>
              </div>
            ) : (
              portfolio.map((item, idx) => {
                const isDomestic = item.currency === "KRW" || /^\d{6}/.test(item.code) || item.market === "KOSPI" || item.market === "KOSDAQ";
                const themeColor = isDomestic ? "#3b82f6" : "#f59e0b"; // 국내: 파란색(#3b82f6), 해외: 노란/호박색(#f59e0b)
                const weightVal = Math.max(0, Math.min(100, Number(item.weight) || 0));
                const isInsufficient = insufficientStocks.some(sym => sym === item.symbol || sym === item.code || (item.code && sym.startsWith(item.code)));

                return (
                  <div 
                    key={item.symbol} 
                    className={`p-3 rounded-xl border transition-all ${
                      isInsufficient
                        ? "border-rose-300 bg-rose-50/80 hover:bg-rose-50 ring-1 ring-rose-200/60 shadow-xs"
                        : "border-slate-100 bg-slate-50/60 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded border shrink-0 text-center leading-none ${
                          isDomestic 
                            ? "bg-blue-50 text-blue-600 border border-blue-200/60" 
                            : "bg-amber-50 text-amber-700 border border-amber-200/60"
                        }`}>
                          {isDomestic ? "국내" : "해외"}
                        </span>
                        <span
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredStockTooltip({
                              name: item.name || item.code,
                              code: item.code || item.symbol,
                              isDomestic,
                              top: rect.top,
                              left: rect.left
                            });
                          }}
                          onMouseLeave={() => setHoveredStockTooltip(null)}
                          className={`text-[11px] font-black truncate flex-1 cursor-default transition-colors ${
                            isInsufficient ? "text-rose-900 hover:text-rose-600" : "text-slate-800 hover:text-indigo-600"
                          }`}
                        >
                          {item.name || item.code}
                        </span>
                        {!isDomestic && (
                          <span
                            className="w-[44px] shrink-0 font-mono font-bold text-[11px] text-amber-600 text-right tracking-tight ml-auto"
                            title={`티커: ${item.code || item.symbol}`}
                          >
                            {(item.code || item.symbol || "").toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={3}
                          value={item.weight}
                          onFocus={(e) => e.target.select?.()}
                          onClick={(e) => e.target.select?.()}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/[^0-9]/g, "");
                            updateWeight(idx, clean);
                          }}
                          placeholder="0"
                          className="w-[30px] pl-0.5 pr-1 py-0.5 text-right placeholder:text-right font-black text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden"
                          style={{ borderColor: weightVal > 0 ? themeColor : undefined }}
                        />
                        <span className="text-[11px] font-bold text-slate-500">%</span>
                        <button
                          onClick={() => removeStock(idx)}
                          className={`p-1 transition-colors cursor-pointer ml-0.5 ${
                            isInsufficient ? "text-rose-400 hover:text-rose-600" : "text-slate-300 hover:text-rose-500"
                          }`}
                          title="종목 삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* 슬라이더 바 (국내: 파란색, 해외: 노란색 - 트랙 채움 및 동그란 버튼 색상 동일 적용) */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={weightVal}
                      onChange={(e) => updateWeight(idx, Number(e.target.value))}
                      style={{
                        background: `linear-gradient(to right, ${themeColor} 0%, ${themeColor} ${weightVal}%, #e2e8f0 ${weightVal}%, #e2e8f0 100%)`,
                        accentColor: themeColor
                      }}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer transition-all"
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* 비중 합계 표시 & 균등 배분 버튼 */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500">총 비중 합계:</span>
              <span className={`font-black text-sm flex items-center gap-1 ${
                totalWeight === 100 ? "text-emerald-600" : "text-rose-600"
              }`}>
                {totalWeight === 100 ? <Check size={14} className="stroke-[3]" /> : <AlertCircle size={14} />}
                {totalWeight}% {totalWeight === 100 ? "(정상)" : "(100% 필요)"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={handleEqualWeight}
                className="py-1 px-2 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer text-center"
              >
                균등 배분 ({Math.floor(100 / (portfolio.length || 1))}%)
              </button>
              <button
                onClick={handleLoadHoldings}
                className="py-1 px-2 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors cursor-pointer text-center"
              >
                내 보유자산 불러오기
              </button>
            </div>
          </div>

          {/* 투자 금액 설정 (초기 투자금액 & 월 적립금액 좌우 2열 배치) */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1 truncate" title="초기 투자금액">
                초기 투자금액
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={initialAmount !== "" && initialAmount !== undefined ? Number(initialAmount).toLocaleString("ko-KR") : ""}
                  onFocus={(e) => e.target.select?.()}
                  onClick={(e) => e.target.select?.()}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, "");
                    setInitialAmount(clean === "" ? "" : Number(clean));
                  }}
                  placeholder="0"
                  className="w-full pl-2.5 pr-6 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 text-right"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">원</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1 truncate" title="월 적립금액">
                월 적립금액
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={monthlyContribution !== "" && monthlyContribution !== undefined ? Number(monthlyContribution).toLocaleString("ko-KR") : ""}
                  onFocus={(e) => e.target.select?.()}
                  onClick={(e) => e.target.select?.()}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, "");
                    setMonthlyContribution(clean === "" ? "" : Number(clean));
                  }}
                  placeholder="0"
                  className="w-full pl-2.5 pr-6 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 text-right"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">원</span>
              </div>
            </div>
          </div>

          {/* 분석 기간 선택 */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1.5">
              <span>분석 기간</span>
              {summary?.commonStartDate && (
                <span className="text-[10px] text-emerald-600 font-semibold truncate max-w-[140px]" title={`상장일: ${summary.commonStartDate}`}>
                  시작: {summary.commonStartDate}
                </span>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1 p-0.5 bg-slate-100 rounded-xl">
              {["1y", "3y", "5y", "10y", "max"].map((pId) => (
                <button
                  key={pId}
                  onClick={() => setPeriod(pId)}
                  className={`py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    period === pId 
                      ? "bg-indigo-600 text-white font-black shadow-xs" 
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {pId === "max" ? "전체" : pId.replace("y", "년")}
                </button>
              ))}
            </div>
            {summary?.limitingSymbol && (
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                *최초 상장일({summary.limitingSymbol}) 기준 공통 시작일 자동 적용
              </p>
            )}
          </div>

          {/* 리밸런싱 주기 선택 (세련된 커스텀 드롭다운) */}
          <div className="pt-2 border-t border-slate-100 relative" ref={rebalancingRef}>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">리밸런싱 주기</label>
            <button
              type="button"
              onClick={() => setIsRebalancingOpen(prev => !prev)}
              className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer focus:outline-hidden focus:border-indigo-500 shadow-2xs"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-slate-800">{currentRebalancingOption?.label}</span>
                <span className="text-[11px] font-normal text-slate-400">({currentRebalancingOption?.eng})</span>
              </div>
              <ChevronDown
                size={14}
                className={`text-slate-400 transition-transform duration-200 ${isRebalancingOpen ? "rotate-180 text-indigo-600" : ""}`}
              />
            </button>

            {/* 커스텀 드롭다운 메뉴 (리밸런싱없음 -> 월별 -> 분기별 -> 연간) */}
            {isRebalancingOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1 space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                {REBALANCING_OPTIONS.map((opt) => {
                  const isSelected = rebalancing === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setRebalancing(opt.id);
                        setIsRebalancingOpen(false);
                      }}
                      className={`w-full px-2.5 py-2 text-xs font-bold rounded-lg flex items-center justify-between transition-colors cursor-pointer text-left ${
                        isSelected
                          ? "bg-indigo-50 text-indigo-700 font-black border border-indigo-100"
                          : "text-slate-700 hover:bg-slate-100 hover:text-indigo-600"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{opt.label}</span>
                        <span className={`text-[10px] font-normal ${isSelected ? "text-indigo-500 font-semibold" : "text-slate-400"}`}>
                          ({opt.eng})
                        </span>
                      </div>
                      {isSelected && (
                        <Check size={14} className="text-indigo-600 stroke-[3]" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 비교 벤치마크 (S&P 500 & 나스닥 100 자유 체크/체크해제) */}
          <div className="pt-2 border-t border-slate-100">
            <span className="block text-[11px] font-bold text-slate-500 mb-1.5">비교 벤치마크</span>
            <div className="flex items-center gap-3.5 text-xs font-semibold text-slate-700">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={benchmarks.includes("SPY")} 
                  onChange={() => toggleBenchmark("SPY")}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer accent-indigo-600" 
                />
                <span className={benchmarks.includes("SPY") ? "text-slate-800 font-bold transition-colors" : "text-slate-400 font-medium transition-colors"}>
                  S&P 500 (SPY)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={benchmarks.includes("QQQ")} 
                  onChange={() => toggleBenchmark("QQQ")}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer accent-indigo-600" 
                />
                <span className={benchmarks.includes("QQQ") ? "text-slate-800 font-bold transition-colors" : "text-slate-400 font-medium transition-colors"}>
                  나스닥 100 (QQQ)
                </span>
              </label>
            </div>
          </div>

          {/* 백테스트 실행하기 메인 액션 버튼 */}
          <button
            onClick={runBacktest}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-black text-sm tracking-tight shadow-md shadow-indigo-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>백테스트 계산 중...</span>
              </>
            ) : (
              <>
                <span>🚀 백테스트 실행하기</span>
              </>
            )}
          </button>

          {errorMsg && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold leading-relaxed">
              ⚠️ {errorMsg}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* [우측] 백테스트 분석 결과 대시보드 (React.memo 메모이제이션) */}
        {/* ══════════════════════════════════════════════════════════ */}
        <BacktestDashboard
          resultData={resultData}
          loading={loading}
          benchmarks={benchmarks}
          executedConfig={executedConfig}
          isMounted={isMounted}
          formatWon={formatWon}
        />

      </div>

      {/* ── 종목명 호버 커스텀 툴팁 (모던 다크 글래스모피즘 + createPortal로 문서 레이아웃 간섭 0%) ── */}
      {isMounted && hoveredStockTooltip && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none -translate-y-full pb-2 transition-all duration-150 animate-in fade-in zoom-in-95"
          style={{ top: hoveredStockTooltip.top - 6, left: hoveredStockTooltip.left }}
        >
          <div className="relative bg-slate-900/95 text-white text-xs px-3 py-1.5 rounded-xl shadow-2xl backdrop-blur-md border border-slate-700/70 flex items-center gap-2 whitespace-nowrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
              hoveredStockTooltip.isDomestic 
                ? "bg-blue-500/20 text-blue-300 border border-blue-400/30" 
                : "bg-amber-500/20 text-amber-300 border border-amber-400/30"
            }`}>
              {hoveredStockTooltip.isDomestic ? "국내" : "해외"}
            </span>
            <span className="font-bold text-white tracking-tight">
              {hoveredStockTooltip.name}
            </span>
            {hoveredStockTooltip.code && (
              <span className="font-mono text-[10px] text-slate-400 border-l border-slate-700/80 pl-2">
                {hoveredStockTooltip.code.toUpperCase()}
              </span>
            )}
            {/* 하단 툴팁 화살표 */}
            <div className="absolute top-full left-5 -mt-[1px] w-0 h-0 border-x-4 border-x-transparent border-t-[5px] border-t-slate-900/95" />
          </div>
        </div>,
        document.body
      )}

      {/* ── 매매-등록 팝업 스타일의 커스텀 알림/오류 모달 ── */}
      {isMounted && alertMounted && createPortal(
        <div className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 ${alertClosing ? 'pointer-events-none' : ''}`}>
          <div
            className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm ${alertClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
            onClick={closeAlert}
          ></div>
          <div className={`relative bg-white w-full max-w-sm rounded-3xl shadow-2xl p-7 text-center border border-slate-100 ${alertClosing ? 'animate-modal-out' : 'animate-slide-up'}`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 ${
              alertModal.type === 'success' 
                ? 'bg-emerald-50 text-emerald-500' 
                : alertModal.type === 'warning'
                ? 'bg-amber-50 text-amber-500'
                : 'bg-rose-50 text-rose-500'
            }`}>
              {alertModal.type === 'success' ? (
                <Check size={28} strokeWidth={2.5} />
              ) : alertModal.type === 'warning' ? (
                <AlertCircle size={28} strokeWidth={2.5} />
              ) : (
                <X size={28} strokeWidth={2.5} />
              )}
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-3">{alertModal.title}</h3>
            <div className={`text-slate-600 text-xs md:text-sm mb-6 leading-relaxed whitespace-pre-wrap font-medium ${alertModal.align === 'left' ? 'text-left px-1.5' : 'text-center'}`}>
              {typeof alertModal.message === 'string' ? (
                alertModal.message.split('\n').map((line, idx) => {
                  const isBracketHeader = line.trim().startsWith('[') && line.trim().endsWith(']');
                  return (
                    <div
                      key={idx}
                      className={isBracketHeader ? 'text-center font-bold text-slate-800' : ''}
                    >
                      {line || '\u00A0'}
                    </div>
                  );
                })
              ) : (
                alertModal.message
              )}
            </div>
            <button
              type="button"
              onClick={closeAlert}
              className={`w-full py-3.5 rounded-xl font-bold transition-all shadow-md cursor-pointer ${
                alertModal.type === 'success'
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-200'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              확인
            </button>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
