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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClerk } from "@clerk/nextjs";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "대시보드" },
  { href: "/contacts", icon: Users, label: "고객 관리" },
  { href: "/messages", icon: MessageSquare, label: "문자 CRM" },
  { href: "/funnels", icon: GitBranch, label: "퍼널" },
  { href: "/landing-pages", icon: FileText, label: "랜딩페이지" },
  { href: "/tools", icon: Wrench, label: "영업 도구함" },
  { href: "/db", icon: Database, label: "DB 관리" },
  { href: "/links", icon: Link2, label: "상담 링크" },
];

interface SidebarNavProps {
  className?: string;
}

export function SidebarNav({ className }: SidebarNavProps) {
  const pathname = usePathname();
  const { signOut } = useClerk();

  return (
    <nav
      className={cn(
        "w-60 min-h-screen bg-navy-900 flex flex-col text-white shrink-0",
        className
      )}
    >
      {/* 로고 */}
      <div className="px-6 py-5 border-b border-navy-700">
        <h1 className="text-xl font-bold text-gold-500">mabiz</h1>
        <p className="text-xs text-gray-400 mt-0.5">크루즈 영업 CRM</p>
      </div>

      {/* 메뉴 */}
      <ul className="flex-1 py-4 space-y-0.5 px-3">
        {navItems.map((item) => {
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
