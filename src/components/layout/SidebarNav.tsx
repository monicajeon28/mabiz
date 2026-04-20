"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Users2, MessageSquare, GitBranch,
  FileText, Wrench, Database, Link2, Settings, LogOut,
  AlarmClock, TrendingUp, Building2, ClipboardList, CreditCard,
  BookOpen, Newspaper, FolderOpen, BarChart2, BarChart,
  Calculator, Phone, ShoppingBag, Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useEffect, useState } from "react";

type UserRole = "GLOBAL_ADMIN" | "OWNER" | "AGENT" | "FREE_SALES";

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  roles?: UserRole[]; // undefined = 모든 역할
}

interface NavSection {
  label: string;
  roles?: UserRole[]; // 섹션 자체가 특정 역할에만 표시
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "CRM",
    items: [
      { href: "/dashboard",             icon: LayoutDashboard, label: "대시보드" },
      { href: "/contacts",              icon: Users,        label: "고객 관리" },
      { href: "/contacts/inquiries",    icon: Phone,        label: "문의 고객" },
      { href: "/contacts/purchased",    icon: ShoppingBag,  label: "구매 고객" },
      { href: "/db",                    icon: Database,     label: "DB 관리" },
      { href: "/b2b",                   icon: Building2,    label: "B2B 파이프라인", roles: ["GLOBAL_ADMIN", "OWNER"] },
      { href: "/team",                  icon: BarChart,     label: "팀 성과",       roles: ["GLOBAL_ADMIN", "OWNER"] },
      { href: "/contacts/all",          icon: Users2,       label: "전체 고객(관리자)", roles: ["GLOBAL_ADMIN"] },
      { href: "/team/affiliate",        icon: Award,        label: "어필리에이트 성과", roles: ["GLOBAL_ADMIN"] },
    ],
  },
  {
    label: "마케팅 자동화",
    roles: ["GLOBAL_ADMIN", "OWNER"],
    items: [
      { href: "/marketing",             icon: BarChart2,    label: "마케팅 대시보드" },
      { href: "/marketing/sales",       icon: TrendingUp,   label: "랜딩 매출관리" },
      { href: "/messages",              icon: MessageSquare,label: "문자 CRM" },
      { href: "/messages/scheduled",    icon: AlarmClock,   label: "예약 발송" },
      { href: "/sms-logs",              icon: ClipboardList,label: "발송 기록" },
      { href: "/funnels",               icon: GitBranch,    label: "퍼널" },
      { href: "/landing-pages",         icon: FileText,     label: "랜딩페이지" },
      { href: "/links",                 icon: Link2,        label: "상담 링크" },
      { href: "/news-links",            icon: Newspaper,    label: "뉴스 링크" },
    ],
  },
  {
    label: "영업 도구",
    items: [
      { href: "/tools",                    icon: Wrench,     label: "영업 도구함" },
      { href: "/playbook",                 icon: BookOpen,   label: "콜 플레이북" },
      { href: "/tools/profit-calculator",  icon: Calculator, label: "수익 계산기" },
    ],
  },
  {
    label: "정산·서류",
    items: [
      { href: "/payments",         icon: CreditCard,   label: "결제 내역" },
      { href: "/statements",       icon: FileText,     label: "내 정산 내역" },
      { href: "/team-statements",  icon: Users,        label: "팀 정산",    roles: ["GLOBAL_ADMIN", "OWNER"] },
      { href: "/contracts",        icon: ClipboardList,label: "계약서 관리" },
      { href: "/documents",        icon: FolderOpen,   label: "서류 관리" },
      { href: "/contracts/templates", icon: FileText,  label: "계약서 템플릿", roles: ["GLOBAL_ADMIN"] },
    ],
  },
];

const freeSalesItems: NavItem[] = [
  { href: "/my-sales", icon: TrendingUp, label: "내 판매 현황" },
];

interface SidebarNavProps {
  className?: string;
}

export function SidebarNav({ className }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setRole(d.role);
          setDisplayName(d.displayName);
        }
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.replace('/sign-in');
  }

  const isFreeSales = role === "FREE_SALES";

  function hasAccess(roles?: UserRole[]): boolean {
    if (!role) return false;
    if (!roles) return true;
    return roles.includes(role);
  }

  return (
    <nav className={cn("w-60 min-h-screen flex flex-col shrink-0", className)}
         style={{ backgroundColor: '#1E2D4E', color: 'white' }}>
      {/* 로고 */}
      <div className="px-6 py-5 flex items-center justify-between"
           style={{ borderBottom: '1px solid #2A4080' }}>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="크루즈닷파트너스" className="h-8 w-auto object-contain" />
        </div>
        <NotificationBell />
      </div>

      {/* 사용자 정보 */}
      {(role || displayName) && (
        <div className="px-4 py-3" style={{ borderBottom: '1px solid #2A4080' }}>
          <div className="text-xs text-gray-400">
            {role === 'GLOBAL_ADMIN' && '관리자'}
            {role === 'OWNER' && '대리점장'}
            {role === 'AGENT' && '판매원'}
            {role === 'FREE_SALES' && '프리세일즈'}
          </div>
          {displayName && (
            <div className="text-sm font-semibold text-white mt-0.5">{displayName}</div>
          )}
        </div>
      )}

      {/* 메뉴 */}
      <ul className="flex-1 py-4 space-y-0.5 px-3 overflow-y-auto">
        {isFreeSales ? (
          freeSalesItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "text-white"
                      : "hover:text-white"
                  )}
                  style={isActive
                    ? { backgroundColor: '#2A4080', borderLeft: '2px solid #C9A84C', paddingLeft: '10px' }
                    : { color: '#D1D5DB' }
                  }
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })
        ) : (
          navSections.map((section) => {
            // 섹션 자체 접근 권한 확인
            if (!hasAccess(section.roles)) return null;

            // 섹션 내 표시 가능한 아이템 필터링
            const visibleItems = section.items.filter((item) => hasAccess(item.roles));
            if (visibleItems.length === 0) return null;

            return (
              <li key={section.label}>
                <ul>
                  <li className="px-3 pt-4 pb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider"
                          style={{ color: '#6B7280' }}>
                      {section.label}
                    </span>
                  </li>
                  {visibleItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                          style={isActive
                            ? { backgroundColor: '#2A4080', color: 'white', borderLeft: '2px solid #C9A84C', paddingLeft: '10px' }
                            : { color: '#D1D5DB' }
                          }
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              (e.currentTarget as HTMLElement).style.backgroundColor = '#2A4080';
                              (e.currentTarget as HTMLElement).style.color = 'white';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              (e.currentTarget as HTMLElement).style.backgroundColor = '';
                              (e.currentTarget as HTMLElement).style.color = '#D1D5DB';
                            }
                          }}
                        >
                          <item.icon className="w-4 h-4 shrink-0" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })
        )}
      </ul>

      {/* 하단 설정 */}
      <div className="px-3 pb-4 space-y-0.5 pt-3" style={{ borderTop: '1px solid #2A4080' }}>
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
          style={{ color: '#D1D5DB' }}
        >
          <Settings className="w-4 h-4" />
          설정
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
          style={{ color: '#D1D5DB' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = '#F87171';
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(127,29,29,0.4)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = '#D1D5DB';
            (e.currentTarget as HTMLElement).style.backgroundColor = '';
          }}
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>
      </div>
    </nav>
  );
}
