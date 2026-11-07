"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import MobileBottomNav from "./mobile/MobileBottomNav";
import { AuthProvider } from "@/contexts/AuthContext";
import { AssetProvider } from "@/contexts/AssetContext";

export default function ClientLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const closeSidebar = () => setIsSidebarOpen(false);

  // 5대 핵심 화면에서 ESC 키로 사이드바 토글
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        const authorizedPaths = [
          "/holdings",
          "/transactions/trading",
          "/transactions/overseas",
          "/transactions/dividends",
          "/dividends",
        ];
        if (!authorizedPaths.includes(pathname)) return;
        const fixedElements = document.querySelectorAll(".fixed.inset-0");
        const hasOpenModal = Array.from(fixedElements).some((el) => {
          const zIndex = window.getComputedStyle(el).zIndex;
          return (
            zIndex &&
            parseInt(zIndex) >= 50 &&
            !el.closest(".translate-x-0, .-translate-x-full")
          );
        });
        if (!hasOpenModal) setIsSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pathname]);

  // 모바일 가상 키보드 닫힘 시 뷰포트 스크롤 복원 (바닥 화면 밀림/처짐 방지)
  useEffect(() => {
    const handleFocusOut = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) {
        setTimeout(() => {
          const hasOpenModal = document.querySelector('.fixed.inset-0');
          if (hasOpenModal || document.body.style.position === 'fixed') {
            window.scrollTo(0, 0);
          } else {
            window.scrollTo(window.scrollX, window.scrollY);
          }
        }, 100);
      }
    };

    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        if (Math.abs(window.visualViewport.height - window.innerHeight) < 40) {
          const hasOpenModal = document.querySelector('.fixed.inset-0');
          if (hasOpenModal || document.body.style.position === 'fixed') {
            window.scrollTo(0, 0);
          }
        }
      }
    };

    document.addEventListener('focusout', handleFocusOut);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
    }
    return () => {
      document.removeEventListener('focusout', handleFocusOut);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
      }
    };
  }, []);

  return (
    <AuthProvider>
      <AssetProvider>
        <div className="flex bg-slate-50 min-h-screen text-slate-800 font-sans">
          {/* Sidebar (드로어 - 모바일/데스크톱 공통) */}
          <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col items-center min-w-0">
            {/* Top Navigation */}
            <TopNav onMenuClick={toggleSidebar} />

            {/*
              md-panel 클래스 (globals.css에 정의):
                - 모바일 (<768px): 배경 없음, pb-16 (하단탭 공간)
                - 데스크톱 (≥768px): glass-panel 스타일, p-8, min-h-[970px]
            */}
            <main className="w-full md:max-w-[1400px] md:p-6 md:mt-4">
              <div className="md-panel">
                {children}
              </div>
            </main>

            {/* 하단 탭 네비게이션 (모바일 전용 - MobileBottomNav 내부에서 md:hidden 처리) */}
            <MobileBottomNav />
          </div>
        </div>
      </AssetProvider>
    </AuthProvider>
  );
}
