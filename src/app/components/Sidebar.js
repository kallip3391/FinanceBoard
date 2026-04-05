"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LayoutDashboard, List, TrendingUp, X, ChevronDown, ChevronRight, Sprout, Globe, ArrowLeftRight, Coins } from "lucide-react";

export default function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname();
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(false);

  useEffect(() => {
    if (pathname.startsWith('/transactions')) {
      setTimeout(() => setIsTransactionsOpen(true), 0);
    }
  }, [pathname]);

  const links = [
    { name: "대시보드", href: "/holdings", icon: <LayoutDashboard size={20} /> },
    { 
      name: "거래 내역", 
      icon: <List size={20} />,
      sublinks: [
        { name: "국내", href: "/transactions/trading", icon: <ArrowLeftRight size={14} /> },
        { name: "해외", href: "/transactions/overseas", icon: <Globe size={14} /> },
        { name: "배당", href: "/transactions/dividends", icon: <Coins size={14} /> }
      ]
    },
    { name: "배당금 현황", href: "/dividends", icon: <Sprout size={20} /> },
  ];

  return (
    <>
      {/* Overlay for mobile/tablet */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-lg tracking-tight whitespace-nowrap">
            <TrendingUp size={20} />
            FINANCE BOARD
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100 text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <nav className="p-4 flex flex-col gap-2">
          {links.map((link) => {
            if (link.sublinks) {
              const isAnySubActive = link.sublinks.some(sl => pathname === sl.href);
              return (
                <div key={link.name} className="flex flex-col gap-1">
                  <button
                    onClick={() => setIsTransactionsOpen(!isTransactionsOpen)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                      isAnySubActive && !isTransactionsOpen
                        ? "bg-brand/10 text-brand"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {link.icon}
                      <span className="font-medium">{link.name}</span>
                    </div>
                    {isTransactionsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  
                  {isTransactionsOpen && (
                    <div className="flex flex-col gap-1 ml-9 mt-1 border-l-2 border-slate-100 pl-4 animate-fade-in">
                      {link.sublinks.map((sub) => {
                        const isSubActive = pathname === sub.href;
                        return (
                          <Link
                            href={sub.href}
                            key={sub.name}
                            onClick={onClose}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                              isSubActive
                                ? "text-brand font-bold bg-brand/5"
                                : "text-slate-500 hover:text-brand"
                            }`}
                          >
                            {sub.icon}
                            {sub.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive = pathname === link.href;
            return (
              <Link
                href={link.href}
                key={link.name}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-brand text-white shadow-md shadow-brand/30"
                    : "text-slate-600 hover:bg-slate-50 hover:text-brand-dark"
                }`}
              >
                {link.icon}
                <span className="font-medium">{link.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-6 px-6 w-full text-sm text-slate-400 text-center">
          &copy; 2026 Pension Tree
        </div>
      </div>
    </>
  );
}
