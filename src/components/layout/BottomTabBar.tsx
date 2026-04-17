"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  MessageSquare,
  Home,
  Database,
  MoreHorizontal,
  GitBranch,
  FileText,
  AlarmClock,
  ClipboardList,
  BookOpen,
  Building2,
  CreditCard,
  Link2,
  Newspaper,
  FolderOpen,
  Settings,
  LogOut,
  BarChart2,
  TrendingUp,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useClerk } from "@clerk/nextjs";

const tabs = [
  { href: "/dashboard", icon: Home,         label: "홈" },
  { href: "/contacts",  icon: Users,        label: "고객" },
  { href: "/messages",  icon: MessageSquare,label: "문자" },
  { href: "/db",        icon: Database,     label: "DB" },
] as const;

const extraMenus = [
  { href: "/marketing",       icon: BarChart2,  label: "마케팅" },
  { href: "/marketing/sales", icon: TrendingUp, label: "매출관리" },
  { href: "/funnels",            icon: GitBranch,     label: "퍼널" },
  { href: "/landing-pages",      icon: FileText,      label: "랜딩페이지" },
  { href: "/messages/scheduled", icon: AlarmClock,    label: "예약발송" },
  { href: "/sms-logs",           icon: ClipboardList, label: "발송기록" },
  { href: "/playbook",           icon: BookOpen,      label: "플레이북" },
  { href: "/b2b",                icon: Building2,     label: "B2B" },
  { href: "/payments",           icon: CreditCard,    label: "결제내역" },
  { href: "/statements",         icon: FileText,      label: "정산" },
  { href: "/contracts",          icon: ClipboardList, label: "계약서" },
  { href: "/documents",          icon: FolderOpen,    label: "서류" },
  { href: "/links",              icon: Link2,         label: "상담링크" },
  { href: "/news-links",         icon: Newspaper,     label: "뉴스링크" },
  { href: "/settings",           icon: Settings,      label: "설정" },
  { href: '/tools/profit-calculator', icon: Calculator, label: '수익계산기' },
] as const;

interface BottomTabBarProps {
  className?: string;
}

export function BottomTabBar({ className }: BottomTabBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200",
          "safe-bottom",
          className
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex h-14">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  className={cn(
                    "flex flex-col items-center justify-center h-full gap-0.5 text-xs transition-colors",
                    isActive
                      ? "text-navy-900 border-t-2 border-gold-500"
                      : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <tab.icon
                    className={cn("w-5 h-5", isActive ? "fill-current" : "")}
                  />
                  <span className="font-medium">{tab.label}</span>
                </Link>
              </li>
            );
          })}

          {/* 더보기 탭 */}
          <li className="flex-1">
            <button
              onClick={() => setDrawerOpen((prev) => !prev)}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-0.5 text-xs transition-colors",
                drawerOpen
                  ? "text-navy-900 border-t-2 border-gold-500"
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="font-medium">더보기</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* 드로어 오버레이 + 슬라이드 패널 */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="fixed bottom-14 left-0 right-0 z-50 bg-white rounded-t-2xl p-4 shadow-2xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {/* 핸들 바 */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            {/* 메뉴 그리드 */}
            <div className="grid grid-cols-4 gap-3">
              {extraMenus.map((menu) => (
                <button
                  key={menu.href}
                  onClick={() => {
                    setDrawerOpen(false);
                    router.push(menu.href);
                  }}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <menu.icon className="w-5 h-5 text-navy-700" />
                  <span className="text-xs text-gray-700 font-medium leading-tight text-center">
                    {menu.label}
                  </span>
                </button>
              ))}

              {/* 로그아웃 */}
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  signOut({ redirectUrl: "/sign-in" });
                }}
                className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-red-50 hover:bg-red-100 transition-colors"
              >
                <LogOut className="w-5 h-5 text-red-500" />
                <span className="text-xs text-red-500 font-medium leading-tight text-center">
                  로그아웃
                </span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
