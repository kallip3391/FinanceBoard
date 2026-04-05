"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import { AuthProvider } from "@/contexts/AuthContext";
import { AssetProvider } from "@/contexts/AssetContext";

export default function ClientLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  // 5대 핵심 화면에서 ESC 키로 사이드바 토글
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // 지정된 5개 화면에서만 작동
        const authorizedPaths = [
          '/holdings',
          '/transactions/trading',
          '/transactions/overseas',
          '/transactions/dividends',
          '/dividends'
        ];

        if (!authorizedPaths.includes(pathname)) return;

        // 모달이 열려있는지 확인 (z-index 50 이상인 요소가 사이드바 외에 있는지 체크)
        // 우리 서비스의 모든 모달은 z-50 또는 z-[100] 이상을 사용함
        const fixedElements = document.querySelectorAll('.fixed.inset-0');
        const hasOpenModal = Array.from(fixedElements).some(el => {
          const zIndex = window.getComputedStyle(el).zIndex;
          // 사이드바의 z-index는 50이므로, 50 이상이면서 사이드바나 사이드바 배경(z-40)이 아닌 요소가 있는지 확인
          // 실제 모달들은 z-50 (overseas, dividends) 또는 z-[100] 이상을 사용
          // el.closest('.z-50') 등을 통해 사이드바인지 판별 가능하지만, 간단히 z-index 숫자로 판별
          return zIndex && parseInt(zIndex) >= 50 && !el.closest('.translate-x-0, .-translate-x-full');
        });

        if (!hasOpenModal) {
          setIsSidebarOpen(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pathname]);

  return (
    <AuthProvider>
      <AssetProvider>
        <div className="flex bg-slate-50 min-h-screen text-slate-800 font-sans">
          {/* Sidebar Component */}
          <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col items-center">
            {/* Top Navigation */}
            <TopNav onMenuClick={toggleSidebar} />

            {/* Page Content */}
            <main className="w-full max-w-[1400px] p-6 mt-4">
              <div className="glass-panel rounded-xl p-8 min-h-[970px]">
                {children}
              </div>
            </main>
          </div>
        </div>
      </AssetProvider>
    </AuthProvider>
  );
}
