"use client";

import { mockTrendData } from "../data/mockData";
import { Filter, RotateCcw } from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { useState, useEffect } from "react";

const CustomXAxisTick = ({ x, y, payload }) => {
  if (!payload.value) return null;
  const date = new Date(payload.value);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={10} dy={5} textAnchor="middle" fill="#94a3b8" fontSize={11} fontWeight={600}>
        {`${month}.${day}`}
      </text>
      <text x={0} y={25} dy={5} textAnchor="middle" fill="#cbd5e1" fontSize={10} fontWeight={500}>
        {year}
      </text>
    </g>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md p-3 border border-slate-100 rounded-xl shadow-xl min-w-[170px]">
        <p className="text-[10px] font-black text-slate-400 mb-2 border-b border-slate-50 pb-1.5 uppercase tracking-wider">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: entry.color }}></div>
                <span className="text-[13px] font-semibold text-slate-600">{entry.name}</span>
              </div>
              <span className="text-[14px] font-black text-slate-800 tabular-nums">
                {entry.name === '수익률' ? `${entry.value.toFixed(2)}%` : `${new Intl.NumberFormat('ko-KR').format(entry.value)}원`}
              </span>
            </div>
          ))}
          {/* 상단 차트 호버 시 수익률 추가 표시 */}
          {!payload.find(p => p.name === "수익률") && payload[0].payload.profitRate !== undefined && (
            <div className="pt-2 mt-2 border-t border-slate-50 flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500 shadow-sm"></div>
                <span className="text-[13px] font-semibold text-slate-600">수익률</span>
              </div>
              <span className={`text-[14px] font-black tabular-nums ${payload[0].payload.profitRate >= 0 ? "text-rose-500" : "text-blue-500"}`}>
                {payload[0].payload.profitRate > 0 ? "+" : ""}{payload[0].payload.profitRate.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default function TrendsPage() {
  const [chartReady, setChartReady] = useState(false);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await TransactionManager.getDailyTrendData();
        setTrendData(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setChartReady(true);
      }
    }
    loadData();
  }, []);

  const formatCurrency = (value) => {
    if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
    if (value >= 10000) return `${(value / 10000).toFixed(0)}만`;
    return new Intl.NumberFormat('ko-KR').format(value);
  };

  return (
    <div className="animate-fade-in h-full flex flex-col">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800">자산 트렌드</h1>
          <span className="text-slate-400 text-sm font-normal">({trendData.length}일 데이터)</span>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-xl font-semibold transition-all">
            <Filter size={18} />
            필터 열기
          </button>
          <button className="flex items-center gap-2 bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl font-medium transition-all">
            <RotateCcw size={18} />
            필터 초기화
          </button>
        </div>
      </div>
      
      {/* Chart Section */}
      <div className="glass-card p-6 flex-1 min-h-[500px] mb-6 min-w-0 flex flex-col gap-6">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-slate-400">데이터를 불러오는 중...</div>
        ) : chartReady && trendData.length > 0 ? (
          <>
            {/* 상단: 금액 차트 (60%) */}
            <div className="flex-[6]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} syncId="trendSync" margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorEvalMain" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    hide 
                    padding={{ left: 0, right: 0 }} 
                  />
                  <YAxis 
                    yAxisId="left"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12, textAnchor: "middle" }}
                    tickFormatter={formatCurrency}
                    width={50}
                    dx={-15}
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
                    content={<CustomTooltip />} 
                    cursor={{ stroke: '#e2e8f0', strokeWidth: 2 }} 
                    position={{ y: 0 }}
                  />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="eval" 
                    name="평가금액" 
                    stroke="#3b82f6" 
                    strokeWidth={2} 
                    fill="transparent"
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="invest" 
                    name="매수금액" 
                    stroke="#64748b" 
                    strokeWidth={1.5} 
                    strokeOpacity={0.4}
                    fill="transparent"
                    activeDot={{ r: 4, fill: '#64748b' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* 하단: 수익률 차트 (40%) */}
            <div className="flex-[4]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} syncId="trendSync" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorProfitSub" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={<CustomXAxisTick />} 
                    height={50}
                    padding={{ left: 0, right: 0 }}
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
                    tick={{ fill: '#f43f5e', fontSize: 12, textAnchor: "middle" }}
                    tickFormatter={(v) => `${v}%`}
                    width={50}
                    dx={15}
                  />
                  <Tooltip content={() => null} />
                  <Area 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="profitRate" 
                    name="수익률" 
                    stroke="#f43f5e" 
                    strokeWidth={1.5} 
                    fill="transparent"
                    activeDot={{ r: 5, strokeWidth: 0, fill: '#f43f5e' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">데이터가 없습니다.</div>
        )}
      </div>

      {/* Period Selector */}
      <div className="flex justify-center flex-wrap gap-2">
        {['최근 1개월', '최근 3개월', '최근 6개월', '최근 1년', '최근 3년', '최근 5년', '전체기간'].map((period) => (
          <button 
            key={period} 
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
              period === '최근 1년' 
                ? 'bg-slate-800 text-white border-slate-800' 
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {period}
          </button>
        ))}
      </div>
    </div>
  );
}
