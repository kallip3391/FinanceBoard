"use client";

import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { ChevronLeft, ChevronRight, Sprout, Calendar, X } from "lucide-react";

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
            {/* ── 상단 헤더 & 년도 선택 바 ── */}
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/60 shadow-xs">
                  <Sprout size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <h1 className="text-base font-extrabold text-slate-800 tracking-tight leading-tight">배당금 현황</h1>
                  <span className="text-[11px] font-semibold text-slate-400">
                    1년 기준 월별 배당 분석
                  </span>
                </div>
              </div>

              {/* 2. 우측 상단 연도: 현재년도(최대) ~ 최초배당년도(최소) 페이징 이동 */}
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevYear}
                  disabled={!canGoPrev}
                  className={`p-1 transition-all ${
                    canGoPrev
                      ? "text-slate-600 hover:text-slate-900 active:scale-90 cursor-pointer"
                      : "text-slate-200 cursor-not-allowed"
                  }`}
                  aria-label="이전 연도"
                  title={canGoPrev ? "이전 연도" : "최초 배당 연도입니다"}
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
                <span className="text-[15px] font-black text-slate-800 tracking-tight min-w-[54px] text-center">
                  {selectedYear}년
                </span>
                <button
                  onClick={handleNextYear}
                  disabled={!canGoNext}
                  className={`p-1 transition-all ${
                    canGoNext
                      ? "text-slate-600 hover:text-slate-900 active:scale-90 cursor-pointer"
                      : "text-slate-200 cursor-not-allowed"
                  }`}
                  aria-label="다음 연도"
                  title={canGoNext ? "다음 연도" : "현재 연도가 최대입니다"}
                >
                  <ChevronRight size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* ── 섹션 1: 상단 1년 차트 & 연간 총 배당금 요약 ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 relative overflow-hidden animate-fade-in">
          {/* 상단 통계 수치 바 */}
          <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-100">
            <div>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">
                {selectedYear} 연간 총 배당금
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

        {/* ── 섹션 2: 1월 ~ 12월 2열 카드 그리드 (순차적 캐스케이드 등장 애니메이션 적용) ── */}
        <div key={`mcards-grid-${selectedYear}`} className="grid grid-cols-2 gap-2.5">
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

      </div>

      {/* ── 종목별 상세 바텀시트 모달 ── */}
      {selectedMonthModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end transition-opacity"
          onClick={() => setSelectedMonthModal(null)}
        >
          <div
            className="bg-white rounded-t-3xl p-5 shadow-2xl border-t border-slate-100 max-h-[75vh] flex flex-col animate-page-slide"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 드래그 핸들 */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3 shrink-0" />

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

            {/* 종목별 리스트 (스크롤 가능) */}
            <div className="overflow-y-auto space-y-2.5 pr-1 flex-1">
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

            {/* 하단 닫기 버튼 */}
            <div className="pt-3 mt-2 border-t border-slate-100 shrink-0">
              <button
                onClick={() => setSelectedMonthModal(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
