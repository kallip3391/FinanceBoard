"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, List, Sprout } from "lucide-react";

const tabs = [
  { name: "대시보드", href: "/holdings", icon: LayoutDashboard },
  { name: "거래 내역", href: "/transactions/trading", icon: List },
  { name: "수익결산", href: "/dividends", icon: Sprout },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 h-16 mobile-only">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive =
          pathname === tab.href ||
          (tab.href === "/transactions/trading" && pathname.startsWith("/transactions"));
        return (
          <Link
            key={tab.name}
            href={tab.href}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
              isActive ? "text-emerald-600" : "text-slate-400"
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
