"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Sprout, Calendar, X, TrendingUp, Briefcase } from "lucide-react";
import { TransactionManager } from "@/lib/transactionManager";

function StockLogo({ code, name, isKRW }) {
  const [hasError, setHasError] = useState(false);
  const cleanCode = (code || '').replace(/\.(KS|KQ|US|kospi|kosdaq)$/i, '').trim();
  const logoUrl = cleanCode ? `https://static.toss.im/png-icons/securities/icn-sec-fill-${cleanCode}.png` : null;

  // ETF 여부 판별 (종목명에 ETF 또는 주요 ETF 브랜드가 포함된 경우)
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

// ── 외화 포맷 헬퍼 함수 ──
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
    if (isPos) return `+${sym}${absNum}`;
    if (isNeg) return `-${sym}${absNum}`;
    return `${sym}0.00`;
  }
  return `${sym}${absNum}`;
};

// ── 매매손익 샘플 데이터 (국내 및 외화 종목 지원) ──
const SAMPLE_TRADE_DATA = [
  // 1페이지 (국내 + 외화 복합 구성)
  {
    name: "삼성전자",
    code: "005930",
    currency: "KRW",
    realizedTotal: 7250000,
    realizedRate: 6.62,
    avgBuyPrice: 68000,
    avgSellPrice: 72500,
    realizedProfit: 450000,
    dividend: 0,
    totalRealizedProfit: 450000,
  },
  {
    name: "애플",
    code: "AAPL",
    currency: "USD",
    realizedTotal: 7250000,
    foreignRealizedTotal: 5410.45,
    realizedRate: 6.62,
    avgBuyPrice: 170.00,
    avgSellPrice: 181.25,
    realizedProfit: 450000,
    foreignRealizedProfit: 335.80,
    dividend: 0,
    foreignDividend: 0,
    totalRealizedProfit: 450000,
    foreignTotalRealizedProfit: 335.80,
  },
  {
    name: "SK하이닉스",
    code: "000660",
    currency: "KRW",
    realizedTotal: 5760000,
    realizedRate: 9.71,
    avgBuyPrice: 175000,
    avgSellPrice: 192000,
    realizedProfit: 510000,
    dividend: 0,
    totalRealizedProfit: 510000,
  },
  {
    name: "엔비디아",
    code: "NVDA",
    currency: "USD",
    realizedTotal: 5840000,
    foreignRealizedTotal: 4358.20,
    realizedRate: 12.40,
    avgBuyPrice: 112.50,
    avgSellPrice: 126.45,
    realizedProfit: 645000,
    foreignRealizedProfit: 481.30,
    dividend: 28000,
    foreignDividend: 20.90,
    totalRealizedProfit: 673000,
    foreignTotalRealizedProfit: 502.20,
  },
  // 2페이지
  {
    name: "테슬라",
    code: "TSLA",
    currency: "USD",
    realizedTotal: 3420000,
    foreignRealizedTotal: 2552.20,
    realizedRate: -4.15,
    avgBuyPrice: 248.00,
    avgSellPrice: 237.70,
    realizedProfit: -148000,
    foreignRealizedProfit: -110.40,
    dividend: 0,
    foreignDividend: 0,
    totalRealizedProfit: -148000,
    foreignTotalRealizedProfit: -110.40,
  },
  {
    name: "현대차",
    code: "005380",
    currency: "KRW",
    realizedTotal: 4900000,
    realizedRate: 11.36,
    avgBuyPrice: 220000,
    avgSellPrice: 245000,
    realizedProfit: 500000,
    dividend: 0,
    totalRealizedProfit: 500000,
  },
  {
    name: "마이크로소프트",
    code: "MSFT",
    currency: "USD",
    realizedTotal: 5160000,
    foreignRealizedTotal: 3850.75,
    realizedRate: 8.20,
    avgBuyPrice: 410.00,
    avgSellPrice: 443.60,
    realizedProfit: 391000,
    foreignRealizedProfit: 291.80,
    dividend: 35000,
    foreignDividend: 26.10,
    totalRealizedProfit: 426000,
    foreignTotalRealizedProfit: 317.90,
  },
  {
    name: "TIGER 미국배당다우존스",
    code: "458730",
    currency: "KRW",
    realizedTotal: 5840000,
    realizedRate: 5.80,
    avgBuyPrice: 10300,
    avgSellPrice: 10900,
    realizedProfit: 320000,
    dividend: 0,
    totalRealizedProfit: 320000,
  },
  // 3페이지
  {
    name: "PLUS 고배당주",
    code: "161510",
    currency: "KRW",
    realizedTotal: 5160000,
    realizedRate: 9.79,
    avgBuyPrice: 12200,
    avgSellPrice: 13400,
    realizedProfit: 460000,
    dividend: 0,
    totalRealizedProfit: 460000,
  },
  {
    name: "NAVER",
    code: "035420",
    currency: "KRW",
    realizedTotal: 3420000,
    realizedRate: 4.12,
    avgBuyPrice: 194000,
    avgSellPrice: 202000,
    realizedProfit: 135000,
    dividend: 0,
    totalRealizedProfit: 135000,
  },
  {
    name: "카카오",
    code: "035720",
    currency: "KRW",
    realizedTotal: 2890000,
    realizedRate: -2.30,
    avgBuyPrice: 43500,
    avgSellPrice: 42500,
    realizedProfit: -68000,
    dividend: 0,
    totalRealizedProfit: -68000,
  },
  {
    name: "기아",
    code: "000270",
    currency: "KRW",
    realizedTotal: 3820000,
    realizedRate: 8.40,
    avgBuyPrice: 94000,
    avgSellPrice: 102000,
    realizedProfit: 295000,
    dividend: 0,
    totalRealizedProfit: 295000,
  },
];

// ── view_closed_trades_pnl 뷰 컬럼 매핑 & 정규화 함수 ──
const normalizeTradeItem = (row) => {
  if (!row) return null;
  // 한글 컬럼명 (view_closed_trades_pnl) 판별
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

  // 수익률_원화 (실현손익 수익률) & 총수익률_원화 (총실현손익 수익률)
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

  // 수익률_외화 & 총수익률_외화
  const foreignProfitRate = isFromView && row['수익률_외화'] !== undefined && row['수익률_외화'] !== null
    ? Number(row['수익률_외화'])
    : (foreignAvgBuyPrice > 0 ? ((foreignAvgSellPrice - foreignAvgBuyPrice) / foreignAvgBuyPrice) * 100 : profitRate);

  const foreignTotalRate = isFromView && row['총수익률_외화'] !== undefined && row['총수익률_외화'] !== null
    ? Number(row['총수익률_외화'])
    : (foreignAvgBuyPrice * quantity > 0 ? (foreignTotalRealizedProfit / (foreignAvgBuyPrice * quantity)) * 100 : foreignProfitRate);

  // 총 매수원가 (합계 계산용)
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
    realizedTotal: totalRealizedProfit,
    profitRate,
    realizedRate: totalRate,

    // 외화
    foreignAvgBuyPrice,
    foreignAvgSellPrice,
    foreignRealizedProfit,
    foreignDividend,
    foreignTotalRealizedProfit,
    foreignRealizedTotal: foreignTotalRealizedProfit,
    foreignProfitRate,
    foreignTotalRate,

    // 원가
    buyCostKRW,
    buyCostForeign,
  };
};

export default function MobileDividendDashboard({
  user,
  loading,
  groupedData = {},
  availableYears = [],
  selectedYear,
  setSelectedYear,
  formatCurrency
}) {
  const [selectedMonthModal, setSelectedMonthModal] = useState(null);
  // 'dividends' (배당) | 'trades' (매매) 탭 상태 (기본값: 'dividends')
  const [settlementTab, setSettlementTab] = useState('dividends');

  // ── 매매손익 DB 조회 상태 및 정규화 데이터 ──
  const [closedTrades, setClosedTrades] = useState([]);
  const [isTradesLoading, setIsTradesLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;

    const fetchClosedTrades = async () => {
      setIsTradesLoading(true);
      try {
        const data = await TransactionManager.getClosedTradesPnL();
        if (isMounted && data && data.length > 0) {
          setClosedTrades(data);
        }
      } catch (err) {
        console.warn("view_closed_trades_pnl 조회 실패:", err);
      } finally {
        if (isMounted) setIsTradesLoading(false);
      }
    };

    fetchClosedTrades();
    return () => { isMounted = false; };
  }, [user?.id]);

  // DB 뷰 데이터가 있으면 뷰 데이터 매핑, 없을 경우 샘플 데이터 매핑
  const tradesList = useMemo(() => {
    if (closedTrades && closedTrades.length > 0) {
      return closedTrades.map(normalizeTradeItem).filter(Boolean);
    }
    return SAMPLE_TRADE_DATA.map(normalizeTradeItem).filter(Boolean);
  }, [closedTrades]);

  // ── 상단 총실현손익 요약 카드 집계 ──
  // 총실현손익 : SUM(총손익_원화)
  // 총실현손익 수익률 : SUM(총손익_원화) / SUM(수량 X 평균매수_원화) X 100
  // 실현손익 : SUM(손익_원화)
  // 실현손익 수익률 : SUM(손익_원화) / SUM(수량 X 평균매수_원화) X 100
  // 배당금 : SUM(배당_원화)
  const tradeSummary = useMemo(() => {
    let sumTotalProfitKRW = 0; // SUM(총손익_원화)
    let sumProfitKRW = 0;      // SUM(손익_원화)
    let sumDividendKRW = 0;    // SUM(배당_원화)
    let sumBuyCostKRW = 0;     // SUM(수량 X 평균매수_원화)

    tradesList.forEach((item) => {
      sumTotalProfitKRW += (item.totalRealizedProfit || 0);
      sumProfitKRW += (item.realizedProfit || 0);
      sumDividendKRW += (item.dividend || 0);
      sumBuyCostKRW += (item.buyCostKRW || 0);
    });

    const totalRealizedRate = sumBuyCostKRW > 0
      ? (sumTotalProfitKRW / sumBuyCostKRW) * 100
      : 0;

    const realizedRate = sumBuyCostKRW > 0
      ? (sumProfitKRW / sumBuyCostKRW) * 100
      : 0;

    return {
      totalRealizedProfit: sumTotalProfitKRW,
      totalRealizedRate,
      realizedProfit: sumProfitKRW,
      realizedRate,
      totalDividend: sumDividendKRW,
    };
  }, [tradesList]);

  // ── 매매손익 화면 상태 및 스와이프 핸들러 ──
  const [selectedTradeModal, setSelectedTradeModal] = useState(null);
  const [tradePage, setTradePage] = useState(1);
  const tradePageSize = 4;
  const totalTradePages = Math.max(1, Math.ceil(tradesList.length / tradePageSize));

  useEffect(() => {
    if (tradePage > totalTradePages) {
      setTradePage(1);
    }
  }, [totalTradePages, tradePage]);

  const currentTradeItems = useMemo(() => {
    const start = (tradePage - 1) * tradePageSize;
    return tradesList.slice(start, start + tradePageSize);
  }, [tradePage, tradePageSize, tradesList]);

  // 매매내역 종목 리스트 좌우 스와이프 핸들러
  const tradeTouchStartX = useRef(null);
  const tradeTouchStartY = useRef(null);

  const handleTradeTouchStart = (e) => {
    tradeTouchStartX.current = e.touches[0].clientX;
    tradeTouchStartY.current = e.touches[0].clientY;
  };

  const handleTradeTouchEnd = (e) => {
    if (tradeTouchStartX.current === null || tradeTouchStartY.current === null) return;
    if (e.changedTouches.length === 0) return;

    const diffX = e.changedTouches[0].clientX - tradeTouchStartX.current;
    const diffY = e.changedTouches[0].clientY - tradeTouchStartY.current;

    // 수평 이동 판별 (40px 이상 이동 및 수직 이동의 1.2배 이상)
    if (Math.abs(diffX) > Math.abs(diffY) * 1.2 && Math.abs(diffX) > 40) {
      if (diffX < 0) {
        // 왼쪽으로 스와이프: 다음 페이지
        setTradePage((prev) => Math.min(totalTradePages, prev + 1));
      } else {
        // 오른쪽으로 스와이프: 이전 페이지
        setTradePage((prev) => Math.max(1, prev - 1));
      }
    }

    tradeTouchStartX.current = null;
    tradeTouchStartY.current = null;
  };

  // 매매손익 모달 상단 드래그 닫기 핸들러
  const tradeModalTouchStartY = useRef(null);
  const handleTradeModalTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      tradeModalTouchStartY.current = e.touches[0].clientY;
    }
  };
  const handleTradeModalTouchEnd = (e) => {
    if (tradeModalTouchStartY.current === null) return;
    const diffY = e.changedTouches[0].clientY - tradeModalTouchStartY.current;
    tradeModalTouchStartY.current = null;
    if (diffY > 40) {
      setSelectedTradeModal(null);
    }
  };

  // 연도 이동 제약 계산 (우측: 현재년도 최대, 좌측: 배당이 있는 첫 연도 최소)
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const minYear = useMemo(() => {
    if (availableYears.length > 0) {
      const parsed = availableYears.map(y => parseInt(y, 10)).filter(n => !isNaN(n));
      if (parsed.length > 0) return Math.min(...parsed);
    }
    return currentYear;
  }, [availableYears, currentYear]);

  const selectedYearNum = parseInt(selectedYear, 10) || currentYear;
  const canGoPrev = selectedYearNum > minYear;
  const canGoNext = selectedYearNum < currentYear;

  // 연도 변경 핸들러
  const handlePrevYear = () => {
    if (canGoPrev) {
      setSelectedYear((selectedYearNum - 1).toString());
    }
  };

  const handleNextYear = () => {
    if (canGoNext) {
      setSelectedYear((selectedYearNum + 1).toString());
    }
  };

  // 하단 월별 카드 그리드 좌우 스와이프 연도 이동 핸들러
  const cardsTouchStartX = useRef(null);
  const cardsTouchStartY = useRef(null);

  const handleCardsTouchStart = (e) => {
    cardsTouchStartX.current = e.touches[0].clientX;
    cardsTouchStartY.current = e.touches[0].clientY;
  };

  const handleCardsTouchEnd = (e) => {
    if (cardsTouchStartX.current === null || cardsTouchStartY.current === null) return;
    if (e.changedTouches.length === 0) return;

    const diffX = e.changedTouches[0].clientX - cardsTouchStartX.current;
    const diffY = e.changedTouches[0].clientY - cardsTouchStartY.current;

    // 수평 움직임이 수직보다 확실히 크고 (1.2배 이상), 최소 40px 이상 이동 시 스와이프 감지
    if (Math.abs(diffX) > Math.abs(diffY) * 1.2 && Math.abs(diffX) > 40) {
      if (diffX > 0) {
        // 오른쪽으로 스와이프 (->) : 이전 연도
        if (canGoPrev) handlePrevYear();
      } else {
        // 왼쪽으로 스와이프 (<-) : 다음 연도
        if (canGoNext) handleNextYear();
      }
    }

    cardsTouchStartX.current = null;
    cardsTouchStartY.current = null;
  };

  // 선택된 연도의 12개월 데이터 가공 (국내/해외 구분 & 종목 리스트)
  const monthly12Data = useMemo(() => {
    const yearObj = groupedData[selectedYear] || { total: 0, count: 0, months: {} };

    const list = Array.from({ length: 12 }, (_, i) => {
      const mStr = (i + 1).toString().padStart(2, '0');
      const monthObj = yearObj.months?.[mStr];
      const items = monthObj?.items || [];

      let krw = 0;
      let overseas = 0;

      items.forEach(st => {
        if (st.currency === 'KRW') {
          krw += (Number(st.total) || 0);
        } else {
          overseas += (Number(st.total) || 0);
        }
      });

      const total = krw + overseas;

      return {
        month: `${i + 1}월`,
        mNum: i + 1,
        mStr,
        KRW: krw,
        OVERSEAS: overseas,
        total,
        count: monthObj?.count || 0,
        items
      };
    });

    const maxTotal = list.reduce((max, item) => (item.total > max ? item.total : max), 0);

    return {
      months: list,
      maxTotal,
      yearTotal: yearObj.total || 0,
      yearCount: yearObj.count || 0
    };
  }, [groupedData, selectedYear]);

  const yearTotal = monthly12Data.yearTotal;
  const avgMonthly = Math.round(yearTotal / 12);

  // 모바일 바텀시트 열기
  const handleCardClick = (mItem) => {
    if (mItem.total > 0 && mItem.items.length > 0) {
      setSelectedMonthModal(mItem);
    }
  };

  return (
    <div style={{ maxWidth: "100vw", overflowX: "hidden" }} className="flex flex-col gap-0 bg-slate-50 pb-1">
      <div className="flex flex-col gap-3 px-3 pt-3 pb-1" style={{ maxWidth: "100%" }}>

        {/* 비로그인 안내 (대시보드와 동일한 단일 박스) */}
        {!user && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-5 rounded-2xl text-sm text-center font-medium mt-2">
            로그인 후 보유 자산을 확인할 수 있습니다.
          </div>
        )}

        {/* 로그인 후 로딩 상태 */}
        {user && loading && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="font-bold text-slate-700 text-sm">배당 내역을 불러오는 중...</span>
            <span className="text-xs text-slate-400">잠시만 기다려주세요</span>
          </div>
        )}

        {/* 로그인 완료 및 로딩 완료 시 화면 표시 */}
        {user && !loading && (
          <>
            {/* ── 상단 헤더 & 배당/매매 전환 바 (거래내역 상단과 동일한 animate-fade-in 효과 적용) ── */}
            <div key={`settlement-header-${settlementTab}`} className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm animate-fade-in">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 flex items-center justify-center rounded-xl border shadow-xs transition-colors ${
                  settlementTab === 'dividends'
                    ? "bg-emerald-50 text-emerald-600 border-emerald-100/60"
                    : "bg-blue-50 text-blue-600 border-blue-100/60"
                }`}>
                  {settlementTab === 'dividends' ? (
                    <Sprout size={18} strokeWidth={2.5} />
                  ) : (
                    <TrendingUp size={18} strokeWidth={2.5} />
                  )}
                </div>
                <div>
                  <h1 className="text-base font-extrabold text-slate-800 tracking-tight leading-tight">
                    {settlementTab === 'dividends' ? '배당금 현황' : '매매손익 현황'}
                  </h1>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {settlementTab === 'dividends' ? '1년 기준 월별 배당 분석' : '실현손익 및 매매 내역 분석'}
                  </span>
                </div>
              </div>

              {/* 우측 상단: < 배당 > / < 매매 > 화면 전환 버튼 (배경 없이 깔끔한 텍스트 & 화살표) */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSettlementTab('dividends')}
                  disabled={settlementTab === 'dividends'}
                  className={`p-1 transition-all ${
                    settlementTab === 'trades'
                      ? "text-slate-600 hover:text-slate-900 active:scale-90 cursor-pointer"
                      : "text-slate-200 cursor-not-allowed"
                  }`}
                  aria-label="배당금 현황으로 이동"
                  title={settlementTab === 'trades' ? "배당금 현황으로 이동" : "현재 배당금 현황입니다"}
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
                <span className="text-[15px] font-black text-slate-800 tracking-tight min-w-[42px] text-center select-none">
                  {settlementTab === 'dividends' ? '배당' : '매매'}
                </span>
                <button
                  onClick={() => setSettlementTab('trades')}
                  disabled={settlementTab === 'trades'}
                  className={`p-1 transition-all ${
                    settlementTab === 'dividends'
                      ? "text-slate-600 hover:text-slate-900 active:scale-90 cursor-pointer"
                      : "text-slate-200 cursor-not-allowed"
                  }`}
                  aria-label="매매손익 현황으로 이동"
                  title={settlementTab === 'dividends' ? "매매손익 현황으로 이동" : "현재 매매손익 현황입니다"}
                >
                  <ChevronRight size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* ── 배당금 현황 화면 ── */}
            {settlementTab === 'dividends' && (
              <>

            {/* ── 섹션 1: 상단 1년 차트 & 연간 총 배당금 요약 ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 relative overflow-hidden animate-fade-in">
          {/* 상단 통계 수치 바 */}
          <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-100">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                <span className="text-xs font-black text-emerald-600">&lt;{selectedYear}년&gt;</span> 총 배당금
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
                  {formatCurrency(yearTotal)}
                </span>
                <span className="text-sm font-bold text-slate-500">원</span>
              </div>
            </div>

            <div className="text-right flex flex-col items-end">
              <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">월평균</span>
              <span className="text-sm font-black text-emerald-600 tabular-nums">
                {formatCurrency(avgMonthly)}원
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 font-medium">
                총 {monthly12Data.yearCount}건
              </span>
            </div>
          </div>

          {/* 차트 범례 및 안내 */}
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] text-slate-400 font-medium">
              💡 막대를 터치하면 국내/해외 금액이 표시됩니다
            </span>
            <div className="flex items-center gap-2.5 text-[11px] font-bold">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                <span className="text-slate-600">국내</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                <span className="text-slate-600">해외</span>
              </span>
            </div>
          </div>

          {/* 12개월 스택 바 차트 (연도 변경 시 처음 진입한 것처럼 바닥에서 솟아오르도록 key 지정) */}
          <div key={`chart-wrap-${selectedYear}`} className="h-[180px] w-full min-w-0 pt-1">
            <ResponsiveContainer width="100%" height={180} minWidth={0}>
              <BarChart
                key={`barchart-${selectedYear}`}
                data={monthly12Data.months}
                barCategoryGap="18%"
                margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  height={24}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                  tickFormatter={(v) => (v >= 10000 ? `${Math.round(v / 10000)}만` : v > 0 ? v : '')}
                />
                {/* 국내/해외 구분 Recharts 툴팁 (웹화면과 100% 동일한 디자인) */}
                <Tooltip
                  cursor={{ fill: '#f8fafc', opacity: 0.8 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const hasKRW = data.KRW > 0;
                      const hasOVERSEAS = data.OVERSEAS > 0;
                      const hasTotal = data.total > 0;

                      return (
                        <div className="bg-white/95 backdrop-blur-md p-3 border border-slate-200 rounded-2xl shadow-xl min-w-[170px] z-50">
                          <p className="text-xs font-black text-slate-800 mb-2 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                            <Calendar size={13} className="text-emerald-600 stroke-[2.5]" />
                            {selectedYear}년 {data.mNum}월
                          </p>
                          <div className="space-y-1.5 mb-2">
                            {hasKRW && (
                              <div className="flex justify-between items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                  <span className="text-[11px] font-bold text-slate-600">국내</span>
                                </div>
                                <span className="text-xs font-black text-slate-800 tabular-nums">
                                  {formatCurrency(data.KRW)}원
                                </span>
                              </div>
                            )}
                            {hasOVERSEAS && (
                              <div className="flex justify-between items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                  <span className="text-[11px] font-bold text-slate-600">해외</span>
                                </div>
                                <span className="text-xs font-black text-slate-800 tabular-nums">
                                  {formatCurrency(data.OVERSEAS)}원
                                </span>
                              </div>
                            )}
                            {!hasTotal && (
                              <span className="text-xs font-semibold text-slate-400 block py-0.5">
                                배당 내역 없음
                              </span>
                            )}
                          </div>
                          <div className="pt-1.5 border-t border-slate-100 flex justify-between items-center">
                            <span className="text-[11px] font-bold text-slate-500">월 총합</span>
                            <span className="text-xs font-black text-emerald-600 tabular-nums">
                              {formatCurrency(data.total)}원
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  key={`bar-krw-${selectedYear}`}
                  dataKey="KRW" 
                  name="국내" 
                  stackId="a" 
                  fill="#3b82f6" 
                  radius={[0, 0, 0, 0]} 
                  isAnimationActive={true}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
                <Bar 
                  key={`bar-overseas-${selectedYear}`}
                  dataKey="OVERSEAS" 
                  name="해외" 
                  stackId="a" 
                  fill="#f59e0b" 
                  radius={[3, 3, 0, 0]} 
                  isAnimationActive={true}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── 1월 ~ 12월 2열 카드 그리드 (좌우 스와이프 제스처 지원) ── */}
        <div
          key={`mcards-grid-${selectedYear}`}
          onTouchStart={handleCardsTouchStart}
          onTouchEnd={handleCardsTouchEnd}
          className="grid grid-cols-2 gap-x-2.5 gap-y-2 touch-pan-y"
        >
          {monthly12Data.months.map((mItem, idx) => {
            const hasData = mItem.total > 0;
            const isMaxMonth = hasData && mItem.total === monthly12Data.maxTotal && monthly12Data.maxTotal > 0;

            return (
              <div
                key={`mcard-${selectedYear}-${mItem.mNum}`}
                onClick={() => handleCardClick(mItem)}
                style={{
                  animationDelay: `${idx * 35}ms`,
                  animationFillMode: 'forwards',
                }}
                className={`relative overflow-hidden rounded-2xl p-3.5 transition-all duration-200 border opacity-0 animate-page-slide ${
                  hasData
                    ? isMaxMonth
                      ? 'bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 border-emerald-300 shadow-[0_4px_12px_-2px_rgba(16,185,129,0.12)] cursor-pointer active:scale-95'
                      : 'bg-white border-slate-200/90 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)] hover:border-blue-300 cursor-pointer active:scale-95'
                    : 'bg-slate-50/60 border border-dashed border-slate-200/70 opacity-40'
                }`}
              >
                {/* 좌측 포인트 바 (최대는 녹색, 일반은 파란색) */}
                <div
                  className={`absolute top-0 left-0 w-1 h-full ${
                    hasData
                      ? isMaxMonth
                        ? 'bg-emerald-500'
                        : 'bg-blue-500'
                      : 'bg-slate-200'
                  }`}
                />

                {/* 상단: MONTH 파란색 영문 표시 + 월 숫자 및 우측 '최대' 배지 */}
                <div className="flex justify-between items-start mb-2 pl-1">
                  <div className="flex flex-col">
                    <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${hasData ? 'text-blue-600' : 'text-slate-300'}`}>
                      MONTH
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[16px] font-black leading-tight ${hasData ? (isMaxMonth ? 'text-emerald-800' : 'text-slate-800') : 'text-slate-400'}`}>
                        {mItem.mNum}월
                      </span>
                      {isMaxMonth && (
                        <span className="text-[9px] font-black text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-full tracking-tight shrink-0 shadow-2xs">
                          최대
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 1. 종목 좌측 표시 선: 파란색, 최고(최대)인 항목만 녹색 표시 */}
                  {hasData ? (
                    <div className="flex items-center gap-1.5">
                      <div className={`w-[2.5px] h-3 rounded-full shrink-0 ${isMaxMonth ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                      <span className={`text-xs font-bold ${isMaxMonth ? 'text-emerald-800 font-extrabold' : 'text-slate-700'}`}>
                        {mItem.items.length}종목
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-300 font-semibold px-1 py-0.5">-</span>
                  )}
                </div>

                {/* 하단: 금액 표시 (카드 높이 균일 유지) */}
                <div className="flex flex-col items-end pl-1">
                  {/* 배당금 금액 숫자 */}
                  <div className="flex items-baseline gap-0.5">
                    <span
                      className={`text-base font-black tabular-nums tracking-tight ${
                        hasData
                          ? isMaxMonth
                            ? 'text-emerald-700'
                            : 'text-slate-800'
                          : 'text-slate-300'
                      }`}
                    >
                      {formatCurrency(mItem.total)}
                    </span>
                    <span className={`text-[11px] font-bold ${hasData ? 'text-slate-500' : 'text-slate-300'}`}>
                      원
                    </span>
                  </div>

                  {/* 2. 국내/해외 표시 (차트 범례 스타일과 동일: 컬러 도트 + 텍스트) */}
                  {hasData && (
                    <div className="flex items-center gap-2 mt-1">
                      {mItem.KRW > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block shrink-0"></span>
                          국내
                        </span>
                      )}
                      {mItem.OVERSEAS > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block shrink-0"></span>
                          해외
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </>
        )}

        {/* ── 매매손익 현황 메인 화면 (거래내역 상세내역과 동일한 animate-feed-lift 캐스케이드 적용) ── */}
        {settlementTab === 'trades' && (
          <div className="space-y-3">
            {/* 1. 상단 총 실현손익 요약 카드 (거래내역 스타일 피드 리프트) */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 opacity-0 animate-feed-lift stagger-1">
              <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-100">
                <div className="flex items-center">
                  <span className="text-[13.5px] font-black text-slate-700 tracking-tight">
                    총 실현손익
                  </span>
                </div>
                <div className="text-right flex flex-col items-end">
                  <div className="flex items-baseline gap-0.5">
                    <span className={`text-2xl font-black tracking-tight tabular-nums ${tradeSummary.totalRealizedProfit > 0 ? 'text-red-600' : tradeSummary.totalRealizedProfit < 0 ? 'text-blue-600' : 'text-slate-900'}`}>
                      {tradeSummary.totalRealizedProfit > 0 ? '+' : ''}{formatCurrency(tradeSummary.totalRealizedProfit, 'KRW')}
                    </span>
                    <span className={`text-sm font-bold ml-0.5 ${tradeSummary.totalRealizedProfit > 0 ? 'text-red-600' : tradeSummary.totalRealizedProfit < 0 ? 'text-blue-600' : 'text-slate-900'}`}>원</span>
                  </div>
                  <span className={`text-[13.5px] font-extrabold tabular-nums mt-0.5 leading-tight ${tradeSummary.totalRealizedProfit > 0 ? 'text-red-600' : tradeSummary.totalRealizedProfit < 0 ? 'text-blue-600' : 'text-slate-500'}`}>
                    ({tradeSummary.totalRealizedProfit > 0 ? '+' : ''}{tradeSummary.totalRealizedRate.toFixed(2)}%)
                  </span>
                </div>
              </div>

              {/* 하단 2개 컬럼 카드 (실현손익 & 배당금 - 금액 같은 줄 맞춤 및 수익률 아래쪽 우측 정렬) */}
              <div className="grid grid-cols-2 gap-2.5 text-center">
                {/* 좌측: 실현손익 (수익률을 금액 아래쪽 우측 '원'에 맞춰 배치, 제목 색상 총실현손익과 동일한 text-slate-700 적용) */}
                <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-100/80 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-slate-700 block mb-1 text-center">
                    실현손익
                  </span>
                  <div className="flex flex-col items-end w-fit mx-auto">
                    <span className={`text-[15px] font-black tabular-nums leading-tight ${tradeSummary.realizedProfit > 0 ? 'text-red-600' : tradeSummary.realizedProfit < 0 ? 'text-blue-600' : 'text-slate-900'}`}>
                      {tradeSummary.realizedProfit > 0 ? '+' : ''}{formatCurrency(tradeSummary.realizedProfit, 'KRW')}<span className="text-[11px] font-bold ml-0.5">원</span>
                    </span>
                    <span className={`text-[10px] font-bold tabular-nums mt-0.5 leading-tight ${tradeSummary.realizedProfit > 0 ? 'text-red-600' : tradeSummary.realizedProfit < 0 ? 'text-blue-600' : 'text-slate-500'}`}>
                      ({tradeSummary.realizedProfit > 0 ? '+' : ''}{tradeSummary.realizedRate.toFixed(2)}%)
                    </span>
                  </div>
                </div>

                {/* 우측: 배당금 (내용은 emerald로 원복, 제목 색상 총실현손익과 동일한 text-slate-700 적용) */}
                <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-100/80 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-slate-700 block mb-1 text-center">
                    배당금
                  </span>
                  <div className="flex flex-col items-end w-fit mx-auto">
                    <span className={`text-[15px] font-black tabular-nums leading-tight ${tradeSummary.totalDividend > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {tradeSummary.totalDividend > 0 ? `+${formatCurrency(tradeSummary.totalDividend, 'KRW')}` : '0'}<span className="text-[11px] font-bold ml-0.5">원</span>
                    </span>
                    <span className="text-[10px] font-bold text-transparent tabular-nums mt-0.5 leading-tight select-none pointer-events-none" aria-hidden="true">
                      &nbsp;
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. 거래내역 스타일의 메인 카드 박스 (종목 리스트 + 페이지네이션 전체를 테두리 박스로 감쌈) */}
            <div
              onTouchStart={handleTradeTouchStart}
              onTouchEnd={handleTradeTouchEnd}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col gap-2.5 touch-pan-y opacity-0 animate-feed-lift stagger-2"
            >
              {/* 종목 리스트 (데이터가 0건일 때 빈화면 Empty State 표시) */}
              {tradesList.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
                    <Briefcase size={22} strokeWidth={2} />
                  </div>
                  <p className="text-[13.5px] font-bold text-slate-700">체결 완료된 매매손익 내역이 없습니다</p>
                  <p className="text-xs text-slate-400 mt-1">보유 종목을 매도하면 실현손익이 이곳에 표시됩니다</p>
                </div>
              ) : (
                <>
                  <div key={`trade-page-${tradePage}`} className="space-y-1.5">
                    {currentTradeItems.map((item, idx) => {
                      const isKRW = item.isKRW;
                      const isProfit = item.totalRealizedProfit > 0;
                      const isLoss = item.totalRealizedProfit < 0;

                      return (
                        <div
                          key={`trade-item-${tradePage}-${item.code}-${idx}`}
                          onClick={() => setSelectedTradeModal(item)}
                          className={`py-2.5 px-3 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-colors flex items-center gap-2.5 cursor-pointer active:scale-[0.99] opacity-0 animate-feed-lift stagger-${(idx % 12) + 1}`}
                        >
                          {/* 좌측: 로고 */}
                          <StockLogo code={item.code} name={item.name} isKRW={isKRW} />

                          {/* 우측: 2행 구성 (1행: 종목명 & 원화 총실현손익, 2행: 코드/해외배지 & 외화손익(수익률) & 원화수익률) */}
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            {/* 1행: 종목명 (좌) & 원화 총실현손익 금액 (우) - 대시보드 폰트 스타일(13px font-bold, 13px font-black) 일치 */}
                            <div className="flex justify-between items-center leading-tight">
                              <p className="text-[13px] font-bold text-slate-900 truncate pr-2">
                                {item.name}
                              </p>
                              <span className={`text-[13px] font-black tabular-nums shrink-0 whitespace-nowrap ${isProfit ? 'text-red-600' : isLoss ? 'text-blue-600' : 'text-slate-900'}`}>
                                {item.totalRealizedProfit > 0 ? '+' : ''}{formatCurrency(item.totalRealizedProfit, 'KRW')}
                                <span className="text-[10px] font-bold ml-0.5">원</span>
                              </span>
                            </div>

                            {/* 2행: 종목코드+배지 (좌), 외화 손익+수익률 (중), 원화 수익률 (우) 동일 라인 - 대시보드 폰트 스타일 일치 */}
                            <div className="flex justify-between items-center mt-1 text-[11px] leading-tight">
                              {/* 좌: 종목코드 + 국내/해외 배지 */}
                              <div className="flex items-center gap-1.5 shrink-0 text-slate-400 font-medium">
                                <span className="font-mono">{item.code}</span>
                                <span
                                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md border ${
                                    isKRW
                                      ? "bg-blue-50 text-blue-600 border-blue-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  }`}
                                >
                                  {isKRW ? "국내" : "해외"}
                                </span>
                              </div>

                              {/* 가운데: 외화 종목인 경우 외화 총손익(수익률) */}
                              {!isKRW && (
                                <div className="px-1 text-center flex-1">
                                  <span className={`text-[11px] font-bold tabular-nums whitespace-nowrap ${item.foreignTotalRealizedProfit > 0 ? 'text-red-600' : item.foreignTotalRealizedProfit < 0 ? 'text-blue-600' : 'text-slate-500'}`}>
                                    {formatForeignAmount(item.foreignTotalRealizedProfit, item.currency, true)} ({item.foreignTotalRealizedProfit > 0 ? '+' : ''}{item.foreignTotalRate.toFixed(2)}%)
                                  </span>
                                </div>
                              )}

                              {/* 우: 원화 총수익률 */}
                              <span className={`text-[11px] font-bold tabular-nums shrink-0 text-right whitespace-nowrap ${isProfit ? 'text-red-600' : isLoss ? 'text-blue-600' : 'text-slate-500'}`}>
                                ({item.totalRealizedProfit > 0 ? '+' : ''}{item.realizedRate.toFixed(2)}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 하단 페이지네이션 인디케이터 (1 / 3) - 카드 박스 내부 하단에 배치 */}
                  <div className="flex justify-center items-center pt-1 pb-0.5 text-xs font-bold gap-1 select-none">
                    <span className="text-blue-600 font-black">{tradePage}</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-slate-400 font-medium">{totalTradePages}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        </>
        )}

      </div>

      {/* ── 종목별 상세 바텀시트 모달 ── */}
      {selectedMonthModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-xs flex flex-col justify-end transition-opacity"
          onClick={() => setSelectedMonthModal(null)}
        >
          <div
            className="bg-white rounded-t-3xl p-5 shadow-2xl border-t border-slate-100 max-h-[75vh] flex flex-col animate-page-slide"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 드래그 핸들 (탭하여 닫기) */}
            <div
              onClick={() => setSelectedMonthModal(null)}
              className="w-full py-1.5 flex items-center justify-center cursor-pointer active:opacity-60 transition-opacity mb-2 shrink-0"
              title="상단바를 누르면 닫힙니다"
            >
              <div className="w-12 h-1.5 bg-slate-300 rounded-full hover:bg-slate-400 transition-colors" />
            </div>

            {/* 바텀시트 헤더 */}
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-100 shrink-0">
              <div>
                <span className="text-xs font-bold text-slate-400 block">
                  {selectedYear}년 배당 내역
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="text-lg font-black text-slate-800 tracking-tight">
                    {selectedMonthModal.mNum}월 배당 종목
                  </h3>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    총 {selectedMonthModal.items.length}개 종목
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold block">월 총 배당금</span>
                  <span className="text-base font-black text-emerald-600 tabular-nums tracking-tight">
                    {formatCurrency(selectedMonthModal.total)}원
                  </span>
                </div>
                <button
                  onClick={() => setSelectedMonthModal(null)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label="닫기"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* 종목별 리스트 (스크롤 가능 - 하단 여백 추가로 마지막 종목 잘림 방지) */}
            <div className="overflow-y-auto space-y-2.5 pr-1 pb-10 flex-1">
              {selectedMonthModal.items.map((st, idx) => {
                const isKRW = st.currency === 'KRW';
                return (
                  <div
                    key={`modal-st-${idx}`}
                    className="flex justify-between items-center p-3 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <StockLogo code={st.code} name={st.name} isKRW={isKRW} />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                          {st.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400 font-medium">
                          {st.code && <span className="font-mono">{st.code}</span>}
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 ${
                              isKRW
                                ? 'bg-blue-50 text-blue-600 border-blue-200'
                                : 'bg-amber-50 text-amber-600 border-amber-200'
                            }`}
                          >
                            {isKRW ? '국내' : '해외'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <span className="text-xs font-black text-slate-900 tabular-nums">
                        {formatCurrency(st.total)}원
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 매매손익 종목별 상세 바텀시트 모달 (Image 2 시안 100% 구현) ── */}
      {selectedTradeModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-xs flex flex-col justify-end transition-opacity"
          onClick={() => setSelectedTradeModal(null)}
        >
          <div
            className="bg-white rounded-t-3xl p-4 sm:p-5 shadow-2xl border-t border-slate-100 max-h-[85vh] flex flex-col animate-page-slide"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 드래그 핸들 바 */}
            <div
              onClick={() => setSelectedTradeModal(null)}
              onTouchStart={handleTradeModalTouchStart}
              onTouchEnd={handleTradeModalTouchEnd}
              className="w-full py-1.5 flex items-center justify-center cursor-pointer active:opacity-60 transition-opacity mb-2 shrink-0"
              title="상단바를 누르거나 아래로 밀어서 닫기"
            >
              <div className="w-12 h-1.5 bg-slate-300 rounded-full hover:bg-slate-400 transition-colors" />
            </div>

            {/* 바텀시트 헤더 (보유종목현황 -> 매매손익 현황, 총20개 종목 -> 삭제) */}
            <div className="flex justify-between items-center mb-3 pb-2.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs shrink-0">
                  <Briefcase size={15} strokeWidth={2.5} />
                </div>
                <h3 className="text-base font-black text-slate-800 tracking-tight">
                  매매손익 현황
                </h3>
              </div>
              <button
                onClick={() => setSelectedTradeModal(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="닫기"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* 상세 종목 카드 (Image 2 구조 - 국내/외화 완벽 대응) */}
            <div className="overflow-y-auto pb-8 flex-1">
              <div className="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-100 shadow-2xs">
                {(() => {
                  const isModalKRW = selectedTradeModal.isKRW;
                  const modalProfit = selectedTradeModal.totalRealizedProfit > 0;
                  const modalLoss = selectedTradeModal.totalRealizedProfit < 0;
                  const modalTotalProfit = selectedTradeModal.totalRealizedProfit;
                  const modalForeignProfit = selectedTradeModal.foreignRealizedProfit;
                  const modalForeignTotalProfit = selectedTradeModal.foreignTotalRealizedProfit;
                  const modalForeignDiv = selectedTradeModal.foreignDividend;

                  return (
                    <>
                      {/* 상단 종목 정보 행 (1행: 종목명 & 원화총실현손익+ChevronUp, 2행: 코드/해외배지 & 외화손익(수익률) & 원화수익률) */}
                      <div className="flex items-center gap-2.5 select-none">
                        <StockLogo
                          code={selectedTradeModal.code}
                          name={selectedTradeModal.name}
                          isKRW={isModalKRW}
                        />
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          {/* 1행: 종목명 (좌) & 원화 총실현손익 금액 + 닫기버튼 (우) - 대시보드 폰트 스타일(13px font-bold, 13px font-black) 일치 */}
                          <div className="flex justify-between items-center leading-tight">
                            <p className="text-[13px] font-bold text-slate-900 truncate pr-2">
                              {selectedTradeModal.name}
                            </p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[13px] font-black tabular-nums whitespace-nowrap ${modalProfit ? 'text-red-600' : modalLoss ? 'text-blue-600' : 'text-slate-900'}`}>
                                {modalTotalProfit > 0 ? '+' : ''}{formatCurrency(modalTotalProfit, 'KRW')}
                                <span className="text-[10px] font-bold ml-0.5">원</span>
                              </span>
                              <div className="p-0.5 text-slate-400">
                                <ChevronUp size={16} strokeWidth={2.5} />
                              </div>
                            </div>
                          </div>

                          {/* 2행: 종목코드+배지 (좌), 외화 손익+수익률 (중), 원화 수익률 (우) 동일 라인 - 대시보드 폰트 스타일 일치 */}
                          <div className="flex justify-between items-center mt-1 text-[11px] leading-tight">
                            {/* 좌: 코드 + 국내/해외 배지 */}
                            <div className="flex items-center gap-1.5 shrink-0 text-slate-400 font-medium">
                              <span className="font-mono">{selectedTradeModal.code}</span>
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md border ${
                                  isModalKRW
                                    ? "bg-blue-50 text-blue-600 border-blue-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}
                              >
                                {isModalKRW ? "국내" : "해외"}
                              </span>
                            </div>

                            {/* 가운데: 외화 종목인 경우 외화 총손익(수익률) */}
                            {!isModalKRW && (
                              <div className="px-1 text-center flex-1">
                                <span className={`text-[11px] font-bold tabular-nums whitespace-nowrap ${modalForeignTotalProfit > 0 ? 'text-red-600' : modalForeignTotalProfit < 0 ? 'text-blue-600' : 'text-slate-500'}`}>
                                  {formatForeignAmount(modalForeignTotalProfit, selectedTradeModal.currency, true)} ({modalForeignTotalProfit > 0 ? '+' : ''}{selectedTradeModal.foreignTotalRate.toFixed(2)}%)
                                </span>
                              </div>
                            )}

                            {/* 우: 원화 총수익률 (ChevronUp 너비 16px + gap 6px = 22px 만큼 우측 여백을 주어 1행의 금액 끝자리와 정렬) */}
                            <span className={`text-[11px] font-bold tabular-nums shrink-0 text-right whitespace-nowrap pr-[22px] ${modalProfit ? 'text-red-600' : modalLoss ? 'text-blue-600' : 'text-slate-500'}`}>
                              ({modalTotalProfit > 0 ? '+' : ''}{selectedTradeModal.realizedRate.toFixed(2)}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 4열 세부 그리드 (외화/원화 다단 지원, 4열 동일 선상 정렬) */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 animate-fade-in">
                        <div className="bg-white rounded-xl border border-slate-100/90 px-1 py-3 shadow-2xs grid grid-cols-4 gap-1 text-center items-start">
                          {/* 1열: 평균 매수가 & 평균 매도가 (외화 종목일 때 외화로 표기, 2열 외화 실현손익과 동일 선상 정렬) */}
                          <div className="flex flex-col items-center justify-start min-w-0">
                            <span className="text-[10px] text-slate-400 font-medium leading-tight">평균 매수가</span>
                            <span className="text-[11px] font-bold text-slate-800 tabular-nums mt-1 whitespace-nowrap leading-tight">
                              {isModalKRW
                                ? `${formatCurrency(selectedTradeModal.avgBuyPrice, 'KRW')}`
                                : formatForeignAmount(selectedTradeModal.foreignAvgBuyPrice, selectedTradeModal.currency)
                              }
                              {isModalKRW && <span className="text-[9.5px] font-bold ml-0.5">원</span>}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium leading-tight mt-1">평균 매도가</span>
                            <span className="text-[11px] font-bold text-slate-800 tabular-nums mt-1 whitespace-nowrap leading-tight">
                              {isModalKRW
                                ? `${formatCurrency(selectedTradeModal.avgSellPrice, 'KRW')}`
                                : formatForeignAmount(selectedTradeModal.foreignAvgSellPrice, selectedTradeModal.currency)
                              }
                              {isModalKRW && <span className="text-[9.5px] font-bold ml-0.5">원</span>}
                            </span>
                          </div>

                          {/* 2열: 실현손익 (윗부분: 원화, 아랫부분: 외화) */}
                          <div className="flex flex-col items-center justify-start min-w-0">
                            <span className="text-[10px] text-slate-400 font-medium leading-tight">실현손익</span>
                            <div className="flex flex-col items-end w-fit mx-auto mt-1">
                              {/* 윗부분: 원화 */}
                              <span className={`text-[11px] font-bold tabular-nums whitespace-nowrap leading-tight ${selectedTradeModal.realizedProfit > 0 ? 'text-red-600' : selectedTradeModal.realizedProfit < 0 ? 'text-blue-600' : 'text-slate-700'}`}>
                                {selectedTradeModal.realizedProfit > 0 ? '+' : ''}{formatCurrency(selectedTradeModal.realizedProfit, 'KRW')}<span className="text-[9.5px] font-bold ml-0.5">원</span>
                              </span>
                              <span className={`text-[10px] font-bold tabular-nums mt-0.5 leading-tight whitespace-nowrap ${selectedTradeModal.realizedProfit > 0 ? 'text-red-600' : selectedTradeModal.realizedProfit < 0 ? 'text-blue-600' : 'text-slate-700'}`}>
                                ({selectedTradeModal.realizedProfit > 0 ? '+' : ''}{selectedTradeModal.profitRate.toFixed(2)}%)
                              </span>

                              {/* 아랫부분: 외화 (외화 종목인 경우 Image 2 반영) */}
                              {!isModalKRW && (
                                <div className="flex flex-col items-end mt-1.5">
                                  <span className={`text-[11px] font-bold tabular-nums whitespace-nowrap leading-tight ${modalForeignProfit > 0 ? 'text-red-600' : modalForeignProfit < 0 ? 'text-blue-600' : 'text-slate-700'}`}>
                                    {formatForeignAmount(modalForeignProfit, selectedTradeModal.currency, true)}
                                  </span>
                                  <span className={`text-[10px] font-bold tabular-nums mt-0.5 leading-tight whitespace-nowrap ${modalForeignProfit > 0 ? 'text-red-600' : modalForeignProfit < 0 ? 'text-blue-600' : 'text-slate-700'}`}>
                                    ({modalForeignProfit > 0 ? '+' : ''}{selectedTradeModal.foreignProfitRate.toFixed(2)}%)
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 3열: 배당금 (윗부분: 한화, 아랫부분: 외화 - 원화와 우측 정렬 및 2열 외화 실현손익과 동일 선상 정렬) */}
                          <div className="flex flex-col items-center justify-start min-w-0">
                            <span className="text-[10px] text-slate-400 font-medium leading-tight">배당금</span>
                            <div className="flex flex-col items-end w-fit mx-auto mt-1">
                              {/* 윗부분: 한화(원화) */}
                              <span className={`text-[11px] font-bold tabular-nums whitespace-nowrap leading-tight ${selectedTradeModal.dividend > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                {selectedTradeModal.dividend > 0 ? `+${formatCurrency(selectedTradeModal.dividend, 'KRW')}` : '0'}<span className="text-[9.5px] font-bold ml-0.5">원</span>
                              </span>
                              {/* 2열의 원화 수익률과 높이를 맞추기 위한 투명 스페이서 */}
                              <span className="text-[10px] leading-tight select-none pointer-events-none opacity-0 mt-0.5" aria-hidden="true">
                                &nbsp;
                              </span>

                              {/* 아랫부분: 외화 (원화 배당금과 우측 끝선 정렬) */}
                              {!isModalKRW && (
                                <div className="flex flex-col items-end mt-1.5">
                                  <span className={`text-[11px] font-bold tabular-nums whitespace-nowrap leading-tight ${modalForeignDiv > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                    {modalForeignDiv > 0 ? `+${formatForeignAmount(modalForeignDiv, selectedTradeModal.currency)}` : `${getCurrencySymbol(selectedTradeModal.currency)}0`}
                                  </span>
                                  {/* 2열의 외화 수익률과 높이를 맞추기 위한 투명 스페이서 */}
                                  <span className="text-[10px] leading-tight select-none pointer-events-none opacity-0 mt-0.5" aria-hidden="true">
                                    &nbsp;
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 4열: 총실현손익 (윗부분: 원화, 아랫부분: 외화) */}
                          <div className="flex flex-col items-center justify-start min-w-0">
                            <span className="text-[10px] text-slate-400 font-medium leading-tight">총실현손익</span>
                            <div className="flex flex-col items-end w-fit mx-auto mt-1">
                              {/* 윗부분: 원화 */}
                              <span className={`text-[11px] font-bold tabular-nums whitespace-nowrap leading-tight ${modalTotalProfit > 0 ? 'text-red-600' : modalTotalProfit < 0 ? 'text-blue-600' : 'text-slate-700'}`}>
                                {modalTotalProfit > 0 ? '+' : ''}{formatCurrency(modalTotalProfit, 'KRW')}<span className="text-[9.5px] font-bold ml-0.5">원</span>
                              </span>
                              <span className={`text-[10px] font-bold tabular-nums mt-0.5 leading-tight whitespace-nowrap ${modalTotalProfit > 0 ? 'text-red-600' : modalTotalProfit < 0 ? 'text-blue-600' : 'text-slate-700'}`}>
                                ({modalTotalProfit > 0 ? '+' : ''}{selectedTradeModal.realizedRate.toFixed(2)}%)
                              </span>

                              {/* 아랫부분: 외화 (외화 종목인 경우 Image 2 반영) */}
                              {!isModalKRW && (
                                <div className="flex flex-col items-end mt-1.5">
                                  <span className={`text-[11px] font-bold tabular-nums whitespace-nowrap leading-tight ${modalForeignTotalProfit > 0 ? 'text-red-600' : modalForeignTotalProfit < 0 ? 'text-blue-600' : 'text-slate-700'}`}>
                                    {formatForeignAmount(modalForeignTotalProfit, selectedTradeModal.currency, true)}
                                  </span>
                                  <span className={`text-[10px] font-bold tabular-nums mt-0.5 leading-tight whitespace-nowrap ${modalForeignTotalProfit > 0 ? 'text-red-600' : modalForeignTotalProfit < 0 ? 'text-blue-600' : 'text-slate-700'}`}>
                                    ({modalForeignTotalProfit > 0 ? '+' : ''}{selectedTradeModal.foreignTotalRate.toFixed(2)}%)
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
