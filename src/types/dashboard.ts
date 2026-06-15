// Dashboard types for 50-aged user friendly UI
export interface CallItem {
  id: string;
  name: string;
  phone: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW'; // 🔴 고급 / 🟡 중간 / 🟢 정상
  daysLeft: number; // 계약까지 남은 일수
  nextAction: string; // "지금 전화!" | "1시간 내" | "기한 임박"
  riskScore: number; // 0-100
  method?: string; // "Grant 방법 #2" | "문자 확인" 등
}

export interface FunnelStats {
  step1: { label: string; count: number; percentage: number }; // 신청
  step2: { label: string; count: number; percentage: number }; // 문자
  step3: { label: string; count: number; percentage: number }; // 계약
}

export interface DashboardHomeStats {
  todayNewApplications: number; // 오늘의 신청자
  todayCompletedContracts: number; // 계약 완료
  pendingCount: number; // 대기 중
  riskLevel: 'SAFE' | 'WARNING' | 'CRITICAL'; // 🟢 정상 / 🟡 주의 / 🔴 위험
  funnelStats: FunnelStats;
  topPriorityCalls: CallItem[]; // TOP 3
  yearMonth: string; // "2026년 6월"
}
