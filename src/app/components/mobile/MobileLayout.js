"use client";

import MobileBottomNav from "./MobileBottomNav";

export default function MobileLayout({ children }) {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 w-full">
      {/* 콘텐츠 영역: 하단 탭바(h-16) 높이만큼 padding 확보 */}
      <main className="flex-1 pb-16 w-full">
        {children}
      </main>

      {/* 하단 탭 네비게이션 */}
      <MobileBottomNav />
    </div>
  );
}
