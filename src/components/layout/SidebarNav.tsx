"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Users2, MessageSquare, GitBranch,
  FileText, Wrench, Database, Link2, Settings, LogOut,
  TrendingUp, Building2, ClipboardList, CreditCard,
  BookOpen, FolderOpen, BarChart2, BarChart,
  Calculator, Phone, ShoppingBag, Award, Star, Receipt, Stamp, Images, Tag, UserPlus,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { AuthSession } from "@/types/auth";

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
      { href: "/b2b/buyers",             icon: Building2,    label: "교육 구매자",    roles: ["GLOBAL_ADMIN", "OWNER"] },
      { href: "/b2b/inquirers",          icon: MessageSquare,label: "교육 문의자",    roles: ["GLOBAL_ADMIN", "OWNER"] },
      { href: "/team",                  icon: BarChart,     label: "팀 성과",       roles: ["GLOBAL_ADMIN", "OWNER"] },
      { href: "/contacts/all",          icon: Users2,       label: "전체 고객(관리자)", roles: ["GLOBAL_ADMIN"] },
      { href: "/team/affiliate",        icon: Award,        label: "어필리에이트 성과", roles: ["GLOBAL_ADMIN"] },
      { href: "/admin/organizations",   icon: Building2,    label: "대리점 관리",       roles: ["GLOBAL_ADMIN"] },
    ],
  },
  {
    label: "GMcruise",
    roles: ["GLOBAL_ADMIN", "OWNER", "AGENT"],
    items: [
      { href: "/affiliate-sales",   icon: TrendingUp,   label: "판매 관리",    roles: ["GLOBAL_ADMIN", "OWNER"] },
      { href: "/gold-members",      icon: Star,          label: "골드회원" },
      { href: "/gold-inquiries",    icon: MessageSquare, label: "골드문의" },
      { href: "/payslips",          icon: Receipt,       label: "급여명세" },
      { href: "/commission-ledger", icon: BookOpen,      label: "커미션 원장",  roles: ["GLOBAL_ADMIN", "OWNER"] },
      { href: "/year-end-report",   icon: BarChart2,     label: "연말정산",     roles: ["GLOBAL_ADMIN", "OWNER"] },
      { href: "/products",          icon: ShoppingBag,   label: "상품 관리",    roles: ["GLOBAL_ADMIN", "OWNER"] },
      { href: "/members",           icon: Users,         label: "크루즈닷 회원관리", roles: ["GLOBAL_ADMIN"] },
      { href: "/affiliate-issuance", icon: UserPlus,     label: "어필리에이트 발급", roles: ["GLOBAL_ADMIN"] },
      { href: "/passport",          icon: Stamp,         label: "여권 관리",    roles: ["GLOBAL_ADMIN", "OWNER"] },
      { href: "/passport/apis",     icon: FileText,      label: "APIS 관리",    roles: ["GLOBAL_ADMIN", "OWNER"] },
      { href: "/partner-dashboard", icon: BarChart,      label: "파트너 현황",  roles: ["GLOBAL_ADMIN", "OWNER"] },
    ],
  },
  {
    label: "마케팅 캠페인",
    roles: ["GLOBAL_ADMIN", "OWNER", "AGENT"],
    items: [
      { href: "/marketing",             icon: BarChart2,    label: "마케팅 대시보드",    roles: ["GLOBAL_ADMIN", "OWNER"] },
      { href: "/marketing/sales",       icon: TrendingUp,   label: "랜딩 매출관리",      roles: ["GLOBAL_ADMIN", "OWNER"] },
      { href: "/messages",              icon: MessageSquare,label: "문자 CRM" },
      { href: "/sms-logs",              icon: ClipboardList,label: "발송 기록" },
      { href: "/funnel-sms",            icon: GitBranch,    label: "자동문자",           roles: ["GLOBAL_ADMIN", "OWNER"] },
      { href: "/funnel-email",          icon: FileText,     label: "자동이메일",          roles: ["GLOBAL_ADMIN", "OWNER"] },
      { href: "/landing-pages",         icon: FileText,     label: "랜딩페이지",         roles: ["GLOBAL_ADMIN", "OWNER"] },
      { href: "/payments",              icon: CreditCard,   label: "결제 관리",          roles: ["GLOBAL_ADMIN", "OWNER"] },
      { href: "/links",                 icon: Link2,        label: "상담 링크",          roles: ["GLOBAL_ADMIN", "OWNER"] },
      { href: "/image-library",         icon: Images,       label: "이미지 라이브러리",   roles: ["GLOBAL_ADMIN", "OWNER"] },
    ],
  },
  {
    label: "그룹관리",
    roles: ["GLOBAL_ADMIN", "OWNER", "AGENT"],
    items: [
      { href: "/groups",                icon: Tag,          label: "그룹 관리" },
    ],
  },
  {
    label: "교육생 모집",
    roles: ["GLOBAL_ADMIN", "OWNER"], // 지사장·관리자 전용(대리점장·마케터 제외)
    items: [
      { href: "/recruit",               icon: GraduationCap, label: "교육생 모집" },
    ],
  },
  {
    label: "영업 도구",
    items: [
      { href: "/tools",                    icon: Wrench,     label: "영업 도구함" },
      { href: "/training",                 icon: BookOpen,   label: "상품 교육" },
      { href: "/call-scripts",             icon: BookOpen,   label: "콜 스크립트" },
      { href: "/tools/profit-calculator",  icon: Calculator, label: "수익 계산기", roles: ["GLOBAL_ADMIN"] },
    ],
  },
  {
    label: "정산·서류",
    items: [
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
  session: AuthSession | null;
}

export function SidebarNav({ className, session }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Map session role to UserRole type (session.role may have different values)
  const role: UserRole | null = session?.role as UserRole | null ?? null;
  const displayName = session?.member?.displayName ?? null;

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
    <nav className={cn("w-60 min-h-screen flex flex-col shrink-0 bg-[#1E2D4E] text-white", className)}>
      {/* 로고 */}
      <div className="px-6 py-5 flex items-center justify-between border-b border-[#2A4080]">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="크루즈닷파트너스" width={120} height={32} className="h-8 w-auto object-contain" />
        </div>
        <NotificationBell />
      </div>

      {/* 사용자 정보 */}
      {(role || displayName) && (
        <div className="px-4 py-3 border-b border-[#2A4080]">
          <div className="text-sm text-gray-600">
            {role === 'GLOBAL_ADMIN' && '관리자'}
            {role === 'OWNER' && '지사장'}
            {role === 'AGENT' && '대리점장'}
            {role === 'FREE_SALES' && '마케터'}
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
                    "flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "text-white bg-[#2A4080] border-l-2 border-[#C9A84C] pl-[10px] pr-3"
                      : "text-[#D1D5DB] hover:text-white px-3"
                  )}
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
                    <span className="text-sm font-semibold uppercase tracking-wider text-[#6B7280]">
                      {section.label}
                    </span>
                  </li>
                  {visibleItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                            isActive
                              ? "bg-[#2A4080] text-white border-l-2 border-[#C9A84C] pl-[10px] pr-3"
                              : "text-[#D1D5DB] hover:bg-[#2A4080] hover:text-white px-3"
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
            );
          })
        )}
      </ul>

      {/* 하단 설정 */}
      <div className="px-3 pb-4 space-y-0.5 pt-3 border-t border-[#2A4080]">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-[#D1D5DB]"
        >
          <Settings className="w-4 h-4" />
          설정
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-[#D1D5DB] hover:text-[#F87171] hover:bg-red-900/40"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>
      </div>
    </nav>
  );
}
