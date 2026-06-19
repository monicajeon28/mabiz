/**
 * dashboard-home-metrics.ts
 *
 * 50대 관리자용 홈 대시보드 메트릭 계산 라이브러리
 *
 * 계산 항목:
 * - 오늘의 신청자
 * - 계약 완료
 * - 대기 중
 * - 위험도 (SAFE/WARNING/CRITICAL)
 * - 신청 → 문자 → 계약 퍼널
 * - TOP 3 우선순위 콜리스트
 */

import prisma from '@/lib/prisma';

interface MetricsParams {
  organizationId: string | null; // GLOBAL_ADMIN: null (전체 조회)
  userId?: string; // AGENT 역할 필터
  role?: 'GLOBAL_ADMIN' | 'OWNER' | 'AGENT';
}

export async function getHomeDashboardMetrics(params: MetricsParams) {
  const { organizationId, userId, role } = params;
  // GLOBAL_ADMIN은 organizationId null → org 필터 없이 전체 조회
  const hasOrgFilter = !!organizationId;

  // ─────────────────────────────────────────────────────────────
  // 1️⃣ Contact 필터 (역할별)
  // ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let contactFilter: any = {
    ...(hasOrgFilter ? { organizationId: organizationId! } : {}),
    deletedAt: null,
  };

  if (role === 'OWNER' && organizationId) {
    // OWNER: 팀 소속 에이전트 담당 고객만
    const teamAgentIds = await prisma.organizationMember.findMany({
      where: { organizationId, role: 'AGENT' },
      select: { userId: true },
    });
    const userIds = teamAgentIds.map((m) => m.userId);
    contactFilter.createdByUserId = { in: userIds };
  } else if (role === 'AGENT' && userId) {
    // AGENT: 본인 담당 고객만
    contactFilter.createdByUserId = userId;
  }

  // ─────────────────────────────────────────────────────────────
  // 2️⃣ 날짜 기준값
  // ─────────────────────────────────────────────────────────────
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // ─────────────────────────────────────────────────────────────
  // 3️⃣ 신청자 (오늘) - CrmLandingRegistration
  // ─────────────────────────────────────────────────────────────
  const todayRegistrations = await prisma.crmLandingRegistration.count({
    where: {
      createdAt: { gte: todayStart, lte: todayEnd },
      ...(hasOrgFilter ? { landingPage: { organizationId: organizationId! } } : {}),
    },
  });

  // ─────────────────────────────────────────────────────────────
  // 4️⃣ 계약 완료 (오늘) - ContractInstance
  // ─────────────────────────────────────────────────────────────
  const todayCompletedContracts = await prisma.contractInstance.count({
    where: {
      ...(hasOrgFilter ? { organizationId: organizationId! } : {}),
      updatedAt: { gte: todayStart, lte: todayEnd },
      status: { in: ['SIGNED', 'COMPLETED'] },
    },
  });

  // ─────────────────────────────────────────────────────────────
  // 5️⃣ 계약 대기 중 (진행 상태) - ContractInstance
  // ─────────────────────────────────────────────────────────────
  const pendingContracts = await prisma.contractInstance.count({
    where: {
      ...(hasOrgFilter ? { organizationId: organizationId! } : {}),
      status: { in: ['DRAFT', 'SENT'] },
    },
  });

  // ─────────────────────────────────────────────────────────────
  // 6️⃣ 고객 상태별 분류 (위험도)
  // ─────────────────────────────────────────────────────────────
  const safeContacts = await prisma.contact.count({
    where: {
      ...contactFilter,
      lastContactedAt: { gte: sevenDaysAgo }, // 7일 이내 접근
    },
  });

  const warningContacts = await prisma.contact.count({
    where: {
      ...contactFilter,
      lastContactedAt: { lt: sevenDaysAgo, gte: fourteenDaysAgo },
    },
  });

  const criticalContacts = await prisma.contact.count({
    where: {
      ...contactFilter,
      lastContactedAt: { lt: fourteenDaysAgo },
    },
  });

  // 위험도 판정 (위험한 고객이 많을수록 CRITICAL)
  const totalContacts = safeContacts + warningContacts + criticalContacts;
  const criticalRatio = totalContacts > 0 ? criticalContacts / totalContacts : 0;
  const warningRatio = totalContacts > 0 ? warningContacts / totalContacts : 0;

  let riskLevel: 'SAFE' | 'WARNING' | 'CRITICAL' = 'SAFE';
  if (criticalRatio > 0.4) {
    riskLevel = 'CRITICAL'; // 40% 이상이 위험
  } else if (criticalRatio > 0.2 || warningRatio > 0.3) {
    riskLevel = 'WARNING'; // 20% 이상 위험 또는 30% 이상 주의
  }

  // ─────────────────────────────────────────────────────────────
  // 7️⃣ 퍼널 통계 (신청 → 문자 → 계약)
  // ─────────────────────────────────────────────────────────────

  // 1단계: 신청 (CrmLandingRegistration)
  const funnelStep1Count = await prisma.crmLandingRegistration.count({
    where: {
      ...(hasOrgFilter ? { landingPage: { organizationId: organizationId! } } : {}),
    },
  });

  // 2단계: 실제 SMS Day 0-3 중 하나라도 발송된 고객
  const funnelStep2Count = await prisma.contact.count({
    where: {
      ...contactFilter,
      OR: [
        { smsDay0Sent: true },
        { smsDay1Sent: true },
        { smsDay2Sent: true },
        { smsDay3Sent: true },
      ],
    },
  });

  // 3단계: 계약 (ContractInstance의 모든 레코드)
  const funnelStep3Count = await prisma.contractInstance.count({
    where: {
      ...(hasOrgFilter ? { organizationId: organizationId! } : {}),
    },
  });

  // 퍼널 통계 계산
  const funnelStats = {
    step1: {
      label: '신청',
      count: funnelStep1Count,
      percentage: 100, // 신청이 100% 기준
    },
    step2: {
      label: '문자',
      count: Math.max(funnelStep2Count, 0),
      percentage: funnelStep1Count > 0 ? (funnelStep2Count / funnelStep1Count) * 100 : 0,
    },
    step3: {
      label: '계약',
      count: funnelStep3Count,
      percentage: funnelStep1Count > 0 ? (funnelStep3Count / funnelStep1Count) * 100 : 0,
    },
  };

  // ─────────────────────────────────────────────────────────────
  // 8️⃣ TOP 3 우선순위 콜리스트
  // ─────────────────────────────────────────────────────────────

  // Contact 중 아래 조건으로 우선순위 정렬:
  // 1. lastContactedAt이 null 또는 오래된 순
  // 2. anxietyScore 높은 순
  // 3. departureDate가 가까운 순
  const topContacts = await prisma.contact.findMany({
    where: contactFilter,
    select: {
      id: true,
      name: true,
      phone: true,
      lastContactedAt: true,
      departureDate: true,
      anxietyScore: true,
    },
    orderBy: [
      { lastContactedAt: { sort: 'asc', nulls: 'first' } },
      { anxietyScore: 'desc' },
      { departureDate: 'asc' },
    ],
    take: 3,
  });

  const topPriorityCalls = topContacts.map((contact, idx) => {
    // 남은 일수 계산
    const daysLeft = contact.departureDate
      ? Math.ceil((contact.departureDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 999;

    // 다음 액션 추천
    let method = '';
    if (contact.anxietyScore && contact.anxietyScore > 70) {
      method = 'Grant 반박법 #2';
    } else if (daysLeft < 7) {
      method = '긴급 통화';
    } else if (contact.anxietyScore && contact.anxietyScore > 50) {
      method = 'SMS 확인';
    } else {
      method = '정기 연락';
    }

    return {
      id: contact.id,
      name: contact.name || '(이름 없음)',
      phone: contact.phone || '(번호 없음)',
      priority: idx === 0 ? 'HIGH' : idx === 1 ? 'MEDIUM' : 'LOW',
      daysLeft: Math.max(0, daysLeft),
      nextAction: '전화',
      riskScore: contact.anxietyScore || 0,
      method,
    };
  });

  // ─────────────────────────────────────────────────────────────
  // 9️⃣ 날짜 포매팅 (YYYY년 M월)
  // ─────────────────────────────────────────────────────────────
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const yearMonth = `${year}년 ${month}월`;

  // ─────────────────────────────────────────────────────────────
  // 🔟 월별 비교 (이번달 vs 지난달)
  // ─────────────────────────────────────────────────────────────
  // 이번 달 첫날 ~ 마지막날
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  monthEnd.setHours(23, 59, 59, 999);

  // 지난 달 첫날 ~ 마지막날
  const prevMonthStart = new Date(year, month - 2, 1);
  const prevMonthEnd = new Date(year, month - 1, 0);
  prevMonthEnd.setHours(23, 59, 59, 999);

  // 이번 달 신청
  const thisMonthRegistrations = await prisma.crmLandingRegistration.count({
    where: {
      createdAt: { gte: monthStart, lte: monthEnd },
      ...(hasOrgFilter ? { landingPage: { organizationId: organizationId! } } : {}),
    },
  });

  // 지난 달 신청
  const prevMonthRegistrations = await prisma.crmLandingRegistration.count({
    where: {
      createdAt: { gte: prevMonthStart, lte: prevMonthEnd },
      ...(hasOrgFilter ? { landingPage: { organizationId: organizationId! } } : {}),
    },
  });

  // 이번 달 계약
  const thisMonthContracts = await prisma.contractInstance.count({
    where: {
      ...(hasOrgFilter ? { organizationId: organizationId! } : {}),
      updatedAt: { gte: monthStart, lte: monthEnd },
      status: { in: ['SIGNED', 'COMPLETED'] },
    },
  });

  // 지난 달 계약
  const prevMonthContracts = await prisma.contractInstance.count({
    where: {
      ...(hasOrgFilter ? { organizationId: organizationId! } : {}),
      updatedAt: { gte: prevMonthStart, lte: prevMonthEnd },
      status: { in: ['SIGNED', 'COMPLETED'] },
    },
  });

  // 성장률 계산
  const registrationGrowth = prevMonthRegistrations > 0
    ? Math.round(((thisMonthRegistrations - prevMonthRegistrations) / prevMonthRegistrations) * 100)
    : 0;

  const contractGrowth = prevMonthContracts > 0
    ? Math.round(((thisMonthContracts - prevMonthContracts) / prevMonthContracts) * 100)
    : 0;

  // ─────────────────────────────────────────────────────────────
  // 결과 반환
  // ─────────────────────────────────────────────────────────────
  return {
    todayNewApplications: todayRegistrations,
    todayCompletedContracts,
    pendingCount: pendingContracts,
    riskLevel,
    funnelStats,
    topPriorityCalls,
    yearMonth,
    monthlyComparison: {
      thisMonth: {
        applications: thisMonthRegistrations,
        contracts: thisMonthContracts,
      },
      previousMonth: {
        applications: prevMonthRegistrations,
        contracts: prevMonthContracts,
      },
      growth: {
        applicationGrowth: registrationGrowth,
        contractGrowth: contractGrowth,
      },
    },
  };
}
