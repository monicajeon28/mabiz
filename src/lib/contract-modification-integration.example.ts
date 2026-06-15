/**
 * Contract Modification Auto-Approval Integration Example
 * 실제 사용 시나리오 3가지
 *
 * 참고: 이 파일은 예제이며, 실제 API 라우트에서 사용할 때 참고하세요.
 * 프로덕션 환경에서는 각 시나리오별로 에러 처리와 로깅을 추가해야 합니다.
 */

import { evaluateAutoApproval } from "./contract-modification-rules";
import { makeAutoApprovalDecision } from "./contract-modification-auto-approval";
import { prisma } from "./prisma";

/**
 * 시나리오 1: 고객 A - 여행 날짜 수정 (자동 승인 가능)
 *
 * 상황:
 * - 계약: 크루즈 여행, 출발일 2026-07-15
 * - 요청: 2026-07-10에 출발일을 2026-07-25로 변경 요청
 * - 예상: 자동 승인 (복잡도 25, L2_LOW_COMPLEXITY)
 * - 승인 시간: 즉시
 */
export async function scenario1_CustomerATripDateModification() {
  console.log("\n=== 시나리오 1: 고객 A - 여행 날짜 수정 ===");

  // 현재 계약 상태
  const contract = await prisma.contractInstance.findUnique({
    where: { id: "contract-customer-A" },
  });

  if (!contract) {
    console.log("계약을 찾을 수 없습니다");
    return;
  }

  const boundData = contract.boundData as any;
  console.log(`현재 여행 날짜: ${boundData.tripDate}`);

  // 수정 요청: 15일 후로 변경
  const newTripDate = new Date();
  newTripDate.setDate(newTripDate.getDate() + 15);
  const newTripDateStr = newTripDate.toISOString().split("T")[0];

  // 1. 자동 승인 판정
  const evaluation = await evaluateAutoApproval({
    id: `mod-${Date.now()}-A`,
    contractId: contract.id,
    fieldName: "tripDate",
    newValue: newTripDateStr,
    currentValue: boundData.tripDate || "",
    requestedByUserId: "user-customer-A",
  });

  console.log("\n📋 평가 결과:");
  console.log(`- 자동 승인 가능: ${evaluation.isAutoApprovable}`);
  console.log(`- 복잡도: ${evaluation.complexity}/100`);
  console.log(`- 사유: ${evaluation.reason}`);
  console.log(`- 렌즈: ${evaluation.appliedLenses.join(", ")}`);

  // 2. 자동 승인 판정 (SPIN 기법 + 렌즈)
  const decision = await makeAutoApprovalDecision(
    {
      id: `mod-${Date.now()}-A-decision`,
      contractId: contract.id,
      fieldName: "tripDate",
      newValue: newTripDateStr,
      currentValue: boundData.tripDate || "",
      requestedByUserId: "user-customer-A",
      requestedAt: new Date(),
    },
    { organizationId: contract.organizationId, contactId: contract.contactId || undefined }
  );

  console.log("\n🎯 최종 판정:");
  console.log(`- 상태: ${decision.status}`);
  console.log(`- 승인 시간: ${decision.summary.estimatedApprovalTime}`);
  console.log(`- 권장사항: ${decision.summary.recommendation}`);

  console.log("\n💬 L2 중재 질문 (SPIN):");
  console.log(`상황: ${decision.mediation5Steps.situation}`);
  console.log(`문제: ${decision.mediation5Steps.problem}`);
  console.log(`함의: ${decision.mediation5Steps.implication}`);
  console.log(`필요: ${decision.mediation5Steps.needsPayoff}`);
  console.log(`성공: ${decision.mediation5Steps.successCriteria}`);

  console.log("\n🧠 렌즈 탐지:");
  console.log(`- 탐지된 렌즈: ${decision.lensDetectionDetails.detectedLenses.join(", ")}`);
  console.log(`- 위험도: ${decision.lensDetectionDetails.riskLevel}`);
  decision.lensDetectionDetails.recommendations.forEach((rec) => {
    console.log(`  → ${rec}`);
  });

  // 3. 자동 승인 시 즉시 적용 (예제)
  if (decision.status === "AUTO_APPROVED") {
    console.log("\n✅ 자동 승인됨 - 데이터 적용 중...");
    // 실제 구현에서는 여기서 DB 업데이트
    // await prisma.contractInstance.update({...})
    console.log("→ ContractInstance.boundData 업데이트 완료");
  }

  return decision;
}

/**
 * 시나리오 2: 고객 B - 객실 타입 변경 (가격 차이 → 수동 검토)
 *
 * 상황:
 * - 계약: 크루즈 여행, 현재 OCEAN_VIEW (2.5M)
 * - 요청: BALCONY (3.5M)로 변경 요청
 * - 예상: 수동 검토 (복잡도 75, L2_HIGH_COMPLEXITY + L6_LOSS_AVERSION)
 * - 승인 시간: 24시간 (영업일)
 */
export async function scenario2_CustomerBRoomTypeChange() {
  console.log("\n=== 시나리오 2: 고객 B - 객실 타입 변경 ===");

  const contract = await prisma.contractInstance.findUnique({
    where: { id: "contract-customer-B" },
  });

  if (!contract) {
    console.log("계약을 찾을 수 없습니다");
    return;
  }

  const boundData = contract.boundData as any;
  console.log(`현재 객실: ${boundData.roomType} (가격: 2,500,000원)`);

  // 수정 요청: BALCONY로 변경
  const evaluation = await evaluateAutoApproval({
    id: `mod-${Date.now()}-B`,
    contractId: contract.id,
    fieldName: "roomType",
    newValue: "BALCONY",
    currentValue: boundData.roomType || "",
    requestedByUserId: "user-customer-B",
  });

  console.log("\n📋 평가 결과:");
  console.log(`- 자동 승인 가능: ${evaluation.isAutoApprovable}`);
  console.log(`- 복잡도: ${evaluation.complexity}/100 (높음)`);
  console.log(`- 사유: ${evaluation.reason}`);
  console.log(`- 렌즈: ${evaluation.appliedLenses.join(", ")}`);

  const decision = await makeAutoApprovalDecision({
    id: `mod-${Date.now()}-B-decision`,
    contractId: contract.id,
    fieldName: "roomType",
    newValue: "BALCONY",
    currentValue: boundData.roomType || "",
    requestedByUserId: "user-customer-B",
    requestedAt: new Date(),
  });

  console.log("\n⏳ 최종 판정:");
  console.log(`- 상태: ${decision.status}`);
  console.log(`- 승인 시간: ${decision.summary.estimatedApprovalTime}`);
  console.log(`- 위험도: ${decision.lensDetectionDetails.riskLevel}`);

  console.log("\n💬 L2 중재 질문:");
  console.log(`문제: ${decision.mediation5Steps.problem}`);
  console.log(`함의: ${decision.mediation5Steps.implication}`);

  console.log("\n🧠 렌즈별 권고:");
  decision.lensDetectionDetails.recommendations.forEach((rec) => {
    console.log(`→ ${rec}`);
  });

  console.log("\n📋 운영팀 액션:");
  console.log("1. L6(손실회피) 신호: 고객 불안감 먼저 해소");
  console.log("2. 가격 1,000,000원 차액 설명");
  console.log("3. 대안 제시:");
  console.log("   - 추가 가격 결제");
  console.log("   - 다른 BALCONY 객실 (같은 가격)");
  console.log("   - 업그레이드 수수료 할인");

  return decision;
}

/**
 * 시나리오 3: 고객 C - 특별 요청 (자동 승인 가능)
 *
 * 상황:
 * - 계약: 크루즈 여행
 * - 요청: 특별 요청 추가 "조용한 위치 선호, 높은 층수"
 * - 예상: 자동 승인 (복잡도 18, L2_LOW_COMPLEXITY)
 * - 승인 시간: 즉시
 */
export async function scenario3_CustomerCSpecialRequest() {
  console.log("\n=== 시나리오 3: 고객 C - 특별 요청 추가 ===");

  const contract = await prisma.contractInstance.findUnique({
    where: { id: "contract-customer-C" },
  });

  if (!contract) {
    console.log("계약을 찾을 수 없습니다");
    return;
  }

  const boundData = contract.boundData as any;
  console.log(`현재 특별 요청: ${boundData.specialRequest || "(없음)"}`);

  // 수정 요청: 특별 요청 추가
  const evaluation = await evaluateAutoApproval({
    id: `mod-${Date.now()}-C`,
    contractId: contract.id,
    fieldName: "specialRequest",
    newValue: "조용한 위치 선호, 높은 층수, 가족 여행 중심 서비스 요청",
    currentValue: boundData.specialRequest || "",
    requestedByUserId: "user-customer-C",
  });

  console.log("\n📋 평가 결과:");
  console.log(`- 자동 승인 가능: ${evaluation.isAutoApprovable}`);
  console.log(`- 복잡도: ${evaluation.complexity}/100 (낮음)`);
  console.log(`- 사유: ${evaluation.reason}`);
  console.log(`- 렌즈: ${evaluation.appliedLenses.join(", ")}`);

  const decision = await makeAutoApprovalDecision({
    id: `mod-${Date.now()}-C-decision`,
    contractId: contract.id,
    fieldName: "specialRequest",
    newValue: "조용한 위치 선호, 높은 층수, 가족 여행 중심 서비스 요청",
    currentValue: boundData.specialRequest || "",
    requestedByUserId: "user-customer-C",
    requestedAt: new Date(),
  });

  console.log("\n✅ 최종 판정:");
  console.log(`- 상태: ${decision.status}`);
  console.log(`- 승인 시간: ${decision.summary.estimatedApprovalTime}`);
  console.log(`- 위험도: ${decision.lensDetectionDetails.riskLevel}`);

  console.log("\n💬 고객 피드백 톤:");
  console.log("→ L1(재활성화): 고객이 적극 참여 중");
  console.log("→ L3(차별화): 맞춤형 서비스 기회");

  return decision;
}

/**
 * 배치 처리: 여러 수정 요청 일괄 처리
 *
 * 사용 사례: 일일 배치 작업 또는 주간 리포팅
 */
export async function batchProcessModificationRequests() {
  console.log("\n=== 배치 처리: 일일 수정 요청 평가 ===");

  // 실제 구현에서는 DB에서 PENDING 상태의 요청을 조회
  const pendingRequests = [
    {
      id: "mod-batch-1",
      contractId: "contract-001",
      fieldName: "tripDate",
      newValue: "2026-08-01",
      currentValue: "2026-07-15",
      requestedByUserId: "user-001",
      requestedAt: new Date(),
    },
    {
      id: "mod-batch-2",
      contractId: "contract-002",
      fieldName: "contactInfo",
      newValue: "newemail@example.com",
      currentValue: "oldemail@example.com",
      requestedByUserId: "user-002",
      requestedAt: new Date(),
    },
    {
      id: "mod-batch-3",
      contractId: "contract-003",
      fieldName: "price",
      newValue: "2750000",
      currentValue: "2500000",
      requestedByUserId: "user-003",
      requestedAt: new Date(),
    },
  ];

  const results = [];

  for (const request of pendingRequests) {
    const decision = await makeAutoApprovalDecision(request);
    results.push({
      requestId: request.id,
      status: decision.status,
      complexity: decision.evaluation.complexity,
      lenses: decision.evaluation.appliedLenses,
      riskLevel: decision.lensDetectionDetails.riskLevel,
    });
  }

  // 통계 생성
  const stats = {
    total: results.length,
    autoApproved: results.filter((r) => r.status === "AUTO_APPROVED").length,
    autoApprovalRate: (
      (results.filter((r) => r.status === "AUTO_APPROVED").length / results.length) *
      100
    ).toFixed(1),
    highRisk: results.filter((r) => r.riskLevel === "HIGH").length,
    averageComplexity: (
      results.reduce((sum, r) => sum + r.complexity, 0) / results.length
    ).toFixed(1),
  };

  console.log("\n📊 일일 통계:");
  console.log(`- 총 요청: ${stats.total}`);
  console.log(`- 자동 승인: ${stats.autoApproved}`);
  console.log(`- 자동 승인율: ${stats.autoApprovalRate}%`);
  console.log(`- 고위험: ${stats.highRisk}`);
  console.log(`- 평균 복잡도: ${stats.averageComplexity}/100`);

  console.log("\n📋 상세:");
  results.forEach((result) => {
    console.log(`- ${result.requestId}: ${result.status} (복잡도: ${result.complexity})`);
  });

  return stats;
}

/**
 * 성과 리포팅: 주간/월간 통계
 */
export async function generatePerformanceReport(period: "weekly" | "monthly") {
  console.log(`\n=== ${period === "weekly" ? "주간" : "월간"} 성과 리포트 ===`);

  // 실제 구현에서는 DB에서 필터링하여 데이터 조회
  // const requests = await prisma.contractModificationRequest.findMany({
  //   where: { requestedAt: { gte: startDate, lte: endDate } }
  // });

  const mockStats = {
    period,
    totalRequests: 47,
    autoApproved: 33,
    autoApprovalRate: 70.2,
    pendingReview: 12,
    rejected: 2,
    averageComplexity: 35.8,
    medianApprovalTime: "45분",
    byField: {
      tripDate: { total: 15, auto: 14, rate: 93 },
      roomType: { total: 12, auto: 4, rate: 33 },
      contactInfo: { total: 10, auto: 10, rate: 100 },
      specialRequest: { total: 8, auto: 4, rate: 50 },
      price: { total: 2, auto: 0, rate: 0 },
    },
    byLens: {
      L2_LOW_COMPLEXITY: 25,
      L2_MEDIUM_COMPLEXITY: 5,
      L6_LOSS_AVERSION: 8,
      L10_URGENCY: 9,
      L1_REACTIVATION: 4,
    },
  };

  console.log("\n📊 주요 지표:");
  console.log(`- 총 요청: ${mockStats.totalRequests}`);
  console.log(`- 자동 승인: ${mockStats.autoApproved} (${mockStats.autoApprovalRate}%)`);
  console.log(`- 대기 검토: ${mockStats.pendingReview}`);
  console.log(`- 거절: ${mockStats.rejected}`);
  console.log(`- 평균 복잡도: ${mockStats.averageComplexity}/100`);
  console.log(`- 중앙값 승인 시간: ${mockStats.medianApprovalTime}`);

  console.log("\n📋 필드별 분석:");
  Object.entries(mockStats.byField).forEach(([field, stats]: [string, any]) => {
    console.log(`- ${field}: ${stats.auto}/${stats.total} (${stats.rate}%)`);
  });

  console.log("\n🧠 렌즈 분포:");
  Object.entries(mockStats.byLens).forEach(([lens, count]: [string, any]) => {
    console.log(`- ${lens}: ${count}`);
  });

  console.log("\n💡 권고:");
  if (mockStats.autoApprovalRate < 70) {
    console.log("→ 자동 승인율이 목표(70%)보다 낮습니다");
    console.log("→ roomType의 낮은 자동 승인율(33%)을 개선하세요");
    console.log("→ L6 손실회피 신호 대응 프로세스를 강화하세요");
  } else {
    console.log("✅ 목표 달성! 자동 승인율 70% 이상");
  }

  return mockStats;
}

// ============================================================================
// 실행 예제 (로컬 테스트용)
// ============================================================================

async function main() {
  try {
    console.log("🚀 Contract Modification Auto-Approval - 통합 예제\n");

    // 주의: 실제 데이터 없으면 에러 발생
    // await scenario1_CustomerATripDateModification();
    // await scenario2_CustomerBRoomTypeChange();
    // await scenario3_CustomerCSpecialRequest();

    // 배치 처리 (Mock 데이터 사용)
    await batchProcessModificationRequests();

    // 성과 리포팅
    await generatePerformanceReport("weekly");
  } catch (error) {
    console.error("❌ 오류:", error);
  }
}

// main();
