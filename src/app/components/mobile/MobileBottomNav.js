"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, List, Sprout, LineChart } from "lucide-react";

const tabs = [
  { name: "대시보드", href: "/holdings", icon: LayoutDashboard },
  { name: "거래내역", href: "/transactions/trading", icon: List },
  { name: "수익결산", href: "/dividends", icon: Sprout },
  { name: "투자분석", href: "/backtest", icon: LineChart },
];

const getActiveColorClass = (tabHref, pathname) => {
  if (tabHref === "/holdings") return "text-emerald-600";
  if (tabHref === "/transactions/trading") {
    return pathname.startsWith("/transactions/dividends") ? "text-amber-500" : "text-blue-600";
  }
  if (tabHref === "/dividends") {
    return pathname.startsWith("/trades") ? "text-violet-600" : "text-emerald-600";
  }
  if (tabHref === "/backtest") {
    return pathname.startsWith("/volatility") ? "text-rose-600" : "text-indigo-600";
  }
  return "text-emerald-600";
};

export default function MobileBottomNav({ onNavigate }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 h-16 mobile-only">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive =
          pathname === tab.href ||
          (tab.href === "/transactions/trading" && pathname.startsWith("/transactions")) ||
          (tab.href === "/dividends" && pathname.startsWith("/trades")) ||
          (tab.href === "/backtest" && (pathname.startsWith("/volatility") || pathname.startsWith("/analysis")));
        return (
          <Link
            key={tab.name}
            href={tab.href}
            onClick={() => onNavigate?.()}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
              isActive ? getActiveColorClass(tab.href, pathname) : "text-slate-400"
            }`}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            <span className={`text-[11px] font-medium ${isActive ? "font-bold" : ""}`}>
              {tab.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
