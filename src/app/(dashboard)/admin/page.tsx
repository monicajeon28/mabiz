import Link from 'next/link';
import {
  Building2,
  UserX,
  ClipboardList,
  TrendingUp,
  CheckSquare,
  AlertTriangle,
  Send,
  Globe,
  BarChart3,
  Shield,
  Database,
  Users,
  LayoutDashboard,
} from 'lucide-react';

export const metadata = {
  title: '관리자 홈',
  description: '마비즈 CRM 관리자 메뉴',
};

const MENU_CARDS = [
  {
    icon: Building2,
    title: '대리점 관리',
    description: '지사장 계정·대리점장·계약 관리',
    href: '/admin/organizations',
  },
  {
    icon: UserX,
    title: '파트너 정지',
    description: '정지된 파트너 상태 관리',
    href: '/admin/partner-suspensions',
  },
  {
    icon: ClipboardList,
    title: '파트너 신청',
    description: '크루즈닷 파트너 신청서 검토/승인',
    href: '/admin/partner-applications',
  },
  {
    icon: TrendingUp,
    title: '대리점 매출',
    description: '모든 대리점 월별·연도별 매출 비교',
    href: '/admin/affiliate-sales-by-partner',
  },
  {
    icon: CheckSquare,
    title: '매출 승인',
    description: '어필리에이트 매출 검증·수수료 승인',
    href: '/admin/affiliate/sales-confirmation',
  },
  {
    icon: AlertTriangle,
    title: '파트너 경고',
    description: '위험도 높은 파트너 자동 알림',
    href: '/admin/affiliate/partner-alert',
  },
  {
    icon: Send,
    title: '발송 모니터링',
    description: '문자·이메일 발송 성공률·실패 원인 분석',
    href: '/admin/sending-monitor',
  },
  {
    icon: Globe,
    title: '웹훅 모니터링',
    description: '실시간 웹훅 성능·지연시간 추적',
    href: '/admin/webhook-monitor',
  },
  {
    icon: BarChart3,
    title: '웹훅 리포트',
    description: '주간·월간 웹훅 성능 보고서',
    href: '/admin/webhook-reports',
  },
  {
    icon: Shield,
    title: '감사 로그',
    description: 'DB 접근 기록·보안 이벤트 모니터링',
    href: '/admin/audit-logs',
  },
  {
    icon: Database,
    title: '백업 상태',
    description: '일일 백업 성공/실패 현황 모니터링',
    href: '/admin/backup-status',
  },
  {
    icon: Users,
    title: '그룹 통계',
    description: '마케팅 그룹 생성 현황·사용 패턴',
    href: '/admin/groups-stats',
  },
  {
    icon: LayoutDashboard,
    title: 'Loop5 대시보드',
    description: 'Loop5 캠페인 성과·A/B 테스트 결과',
    href: '/admin/loop5/dashboard',
  },
] as const;

export default function AdminPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">관리자 메뉴</h1>
        <p className="mt-1 text-sm text-gray-500">
          GLOBAL_ADMIN 전용 관리 기능입니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MENU_CARDS.map(({ icon: Icon, title, description, href }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-blue-400 hover:shadow-md"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">
                {title}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">
                {description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
