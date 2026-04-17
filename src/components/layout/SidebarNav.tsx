"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  GitBranch,
  FileText,
  Wrench,
  Database,
  Link2,
  Settings,
  LogOut,
  AlarmClock,
  TrendingUp,
  Building2,
  ClipboardList,
  CreditCard,
  BookOpen,
  Newspaper,
  FolderOpen,
  BarChart2,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClerk, useUser } from "@clerk/nextjs";
import { NotificationBell } from "@/components/layout/NotificationBell";

// OWNER/AGENT/GLOBAL_ADMIN 메뉴 — 섹션 그룹핑
const navSections = [
  {
    label: "CRM",
    items: [
      { href: "/dashboard",  icon: LayoutDashboard, label: "대시보드" },
      { href: "/contacts",   icon: Users,           label: "고객 관리" },
      { href: "/db",         icon: Database,        label: "DB 관리" },
      { href: "/b2b",        icon: Building2,       label: "B2B 파이프라인" },
    ],
  },
  {
    label: "마케팅 자동화",
    items: [
      { href: "/marketing",       icon: BarChart2,     label: "마케팅 대시보드" },
      { href: "/marketing/sales", icon: TrendingUp,    label: "랜딩 매출관리" },
      { href: "/messages",           icon: MessageSquare, label: "문자 CRM" },
      { href: "/messages/scheduled", icon: AlarmClock,    label: "예약 발송" },
      { href: "/sms-logs",           icon: ClipboardList, label: "발송 기록" },
      { href: "/funnels",            icon: GitBranch,     label: "퍼널" },
      { href: "/landing-pages",      icon: FileText,      label: "랜딩페이지" },
      { href: "/links",              icon: Link2,         label: "상담 링크" },
      { href: "/news-links",         icon: Newspaper,     label: "뉴스 링크" },
    ],
  },
  {
    label: "영업 도구",
    items: [
      { href: "/tools",                   icon: Wrench,      label: "영업 도구함" },
      { href: "/playbook",                icon: BookOpen,    label: "콜 플레이북" },
      { href: "/tools/profit-calculator", icon: Calculator,  label: "수익 계산기" },
    ],
  },
  {
    label: "정산·서류",
    items: [
      { href: "/payments",        icon: CreditCard,    label: "결제 내역" },
      { href: "/statements",      icon: FileText,      label: "내 정산 내역" },
      { href: "/team-statements", icon: Users,         label: "팀 정산" },
      { href: "/contracts",       icon: ClipboardList, label: "계약서 관리" },
      { href: "/documents",       icon: FolderOpen,    label: "서류 관리" },
    ],
  },
];

// FREE_SALES 전용 메뉴 (판매 현황 + 링크만)
const freeSalesNavItems = [
  { href: "/my-sales", icon: TrendingUp, label: "내 판매 현황" },
];

interface SidebarNavProps {
  className?: string;
}

export function SidebarNav({ className }: SidebarNavProps) {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { user }    = useUser();

  // Clerk publicMetadata 또는 OrganizationMember role로 FREE_SALES 판별
  // 서버에서 역할 확인이 어려우므로 /my-sales 접근 시 서버에서 제한
  const isFreeSales = (user?.publicMetadata as { role?: string })?.role === "FREE_SALES";

  return (
    <nav
      className={cn(
        "w-60 min-h-screen bg-navy-900 flex flex-col text-white shrink-0",
        className
      )}
    >
      {/* 로고 */}
      <div className="px-6 py-5 border-b border-navy-700 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gold-500">mabiz</h1>
          <p className="text-xs text-gray-400 mt-0.5">크루즈 영업 CRM</p>
        </div>
        <NotificationBell />
      </div>

      {/* 메뉴 */}
      <ul className="flex-1 py-4 space-y-0.5 px-3 overflow-y-auto">
        {isFreeSales ? (
          freeSalesNavItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-navy-700 text-white border-l-2 border-gold-500 pl-[10px]"
                      : "text-gray-300 hover:bg-navy-700 hover:text-white"
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })
        ) : (
          navSections.map((section) => (
            <li key={section.label}>
              {/* 섹션 레이블 */}
              <ul>
                <li className="px-3 pt-4 pb-1">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {section.label}
                  </span>
                </li>
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                          isActive
                            ? "bg-navy-700 text-white border-l-2 border-gold-500 pl-[10px]"
                            : "text-gray-300 hover:bg-navy-700 hover:text-white"
                        )}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))
        )}
      </ul>

      {/* 하단 설정 */}
      <div className="px-3 pb-4 space-y-0.5 border-t border-navy-700 pt-3">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-navy-700 hover:text-white transition-colors"
        >
          <Settings className="w-4 h-4" />
          설정
        </Link>
        <button
          onClick={() => signOut({ redirectUrl: "/sign-in" })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-red-900/40 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>
      </div>
    </nav>
  );
}
