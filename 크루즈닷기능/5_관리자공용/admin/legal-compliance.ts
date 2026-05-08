// lib/legal-compliance.ts
// 법률 컴플라이언스 체크 유틸리티

export interface ComplianceCheckResult {
  id: string;
  category: 'tax' | 'contract' | 'labor' | 'travel';
  item: string;
  status: 'pass' | 'warning' | 'fail' | 'info';
  message: string;
  action?: string;
  reference?: string;
}

// ===========================================
// 계약서 필수 조항 체크
// ===========================================

interface ContractCheckInput {
  contractType: string;
  sections: Array<{
    id: string;
    title: string;
    content: string;
  }>;
}

export function checkContractCompliance(input: ContractCheckInput): ComplianceCheckResult[] {
  const results: ComplianceCheckResult[] = [];
  const allContent = input.sections.map(s => s.content).join(' ');
  const allTitles = input.sections.map(s => s.title).join(' ');

  // 1. 수당 지급 주체 명시 체크
  const hasCommissionClause =
    allContent.includes('크루즈닷') &&
    (allContent.includes('수당') || allContent.includes('수수료')) &&
    allContent.includes('지급');

  results.push({
    id: 'contract-commission-payer',
    category: 'contract',
    item: '수당 지급 주체',
    status: hasCommissionClause ? 'pass' : 'warning',
    message: hasCommissionClause
      ? '수당 지급 주체(크루즈닷) 명시됨'
      : '수당 지급 주체를 명시하는 것이 좋습니다',
    action: hasCommissionClause ? undefined : '제X조 (수당 지급) 조항 추가 권장',
    reference: '계약서 분쟁 예방',
  });

  // 2. 독립 사업자 지위 명시 체크
  const hasFreelancerClause =
    (allContent.includes('독립') && allContent.includes('사업자')) ||
    (allContent.includes('근로자') && allContent.includes('아니'));

  results.push({
    id: 'contract-freelancer-status',
    category: 'labor',
    item: '독립 사업자 지위',
    status: hasFreelancerClause ? 'pass' : 'warning',
    message: hasFreelancerClause
      ? '독립 사업자 지위 명시됨'
      : '독립 사업자 지위를 명시하는 것이 좋습니다',
    action: hasFreelancerClause ? undefined : '제X조 (독립 사업자 지위) 조항 추가 권장',
    reference: '근로기준법 - 근로자성 판단 기준',
  });

  // 3. 원천징수 조항 체크
  const hasWithholdingClause =
    allContent.includes('원천징수') ||
    allContent.includes('3.3%') ||
    allContent.includes('사업소득');

  results.push({
    id: 'contract-withholding',
    category: 'tax',
    item: '원천징수 조항',
    status: hasWithholdingClause ? 'pass' : 'warning',
    message: hasWithholdingClause
      ? '원천징수 관련 조항 명시됨'
      : '원천징수(3.3%) 관련 조항을 명시하는 것이 좋습니다',
    action: hasWithholdingClause ? undefined : '수당 지급 시 원천징수 내용 추가 권장',
    reference: '소득세법 제127조 (원천징수의무)',
  });

  // 4. 환불 시 수당 처리 체크
  const hasRefundClause =
    (allContent.includes('환불') || allContent.includes('취소')) &&
    allContent.includes('수당');

  results.push({
    id: 'contract-refund-commission',
    category: 'contract',
    item: '환불 시 수당 처리',
    status: hasRefundClause ? 'pass' : 'info',
    message: hasRefundClause
      ? '환불 시 수당 처리 방법 명시됨'
      : '환불 시 수당 처리 방법을 명시하면 좋습니다',
    action: hasRefundClause ? undefined : '고객 환불 시 수당 차감 규정 추가 권장',
    reference: '분쟁 예방',
  });

  // 5. 계약 기간 및 해지 체크
  const hasTermClause =
    allTitles.includes('계약 기간') ||
    allTitles.includes('계약기간') ||
    allTitles.includes('해지');

  results.push({
    id: 'contract-term',
    category: 'contract',
    item: '계약 기간 및 해지',
    status: hasTermClause ? 'pass' : 'info',
    message: hasTermClause
      ? '계약 기간 및 해지 조항 있음'
      : '계약 기간 및 해지 조건을 명시하는 것이 좋습니다',
    reference: '민법 제543조 (해지, 해제권)',
  });

  // 6. 관할 법원 체크
  const hasJurisdiction =
    allContent.includes('관할') &&
    allContent.includes('법원');

  results.push({
    id: 'contract-jurisdiction',
    category: 'contract',
    item: '관할 법원',
    status: hasJurisdiction ? 'pass' : 'info',
    message: hasJurisdiction
      ? '관할 법원 명시됨'
      : '관할 법원을 명시하면 분쟁 시 유리합니다',
    reference: '민사소송법 제2조 (관할)',
  });

  return results;
}

// ===========================================
// 상품 생성 시 법률 체크
// ===========================================

interface ProductCheckInput {
  productName: string;
  price: number;
  commission?: number;
  commissionRate?: number;
  hasRefundPolicy: boolean;
  description?: string;
}

export function checkProductCompliance(input: ProductCheckInput): ComplianceCheckResult[] {
  const results: ComplianceCheckResult[] = [];

  // 1. 상품 실체 체크 (여행상품인지)
  const isTravelProduct =
    input.productName.toLowerCase().includes('크루즈') ||
    input.productName.toLowerCase().includes('여행') ||
    input.productName.toLowerCase().includes('투어') ||
    input.description?.includes('크루즈') ||
    input.description?.includes('여행');

  results.push({
    id: 'product-legitimacy',
    category: 'travel',
    item: '상품 실체',
    status: isTravelProduct ? 'pass' : 'warning',
    message: isTravelProduct
      ? '여행상품으로 확인됨'
      : '상품이 실제 여행상품인지 확인이 필요합니다',
    action: isTravelProduct ? undefined : '상품 없이 수당만 지급하면 유사수신 위험',
    reference: '관광진흥법 제4조 (여행업 등록)',
  });

  // 2. 환불 정책 체크
  results.push({
    id: 'product-refund-policy',
    category: 'contract',
    item: '환불 정책',
    status: input.hasRefundPolicy ? 'pass' : 'warning',
    message: input.hasRefundPolicy
      ? '환불 정책 명시됨'
      : '환불 정책을 명시해야 합니다',
    action: input.hasRefundPolicy ? undefined : '취소/환불 규정 추가 필요',
    reference: '전자상거래법 제17조 (청약철회)',
  });

  // 3. 가격 정보 체크
  results.push({
    id: 'product-price-info',
    category: 'contract',
    item: '가격 정보',
    status: input.price > 0 ? 'pass' : 'fail',
    message: input.price > 0
      ? `가격 ${input.price.toLocaleString()}원 설정됨`
      : '상품 가격이 설정되지 않았습니다',
    reference: '전자상거래법 제13조 (정보의 제공)',
  });

  // 4. 수당 구조 정보
  if (input.commission || input.commissionRate) {
    results.push({
      id: 'product-commission-info',
      category: 'tax',
      item: '수당 정보',
      status: 'info',
      message: input.commissionRate
        ? `수당률 ${input.commissionRate}% (${((input.price * input.commissionRate) / 100).toLocaleString()}원)`
        : `수당 ${input.commission?.toLocaleString()}원`,
      action: '수당 지급 시 3.3% 원천징수 적용 필수',
      reference: '소득세법 제127조',
    });
  }

  return results;
}

// ===========================================
// 정산 리스크 체크
// ===========================================

interface SettlementCheckInput {
  totalCommission: number;
  withholdingApplied: boolean;
  paymentStatementReady: boolean;
  refundCount: number;
  refundProcessed: boolean;
}

export function checkSettlementCompliance(input: SettlementCheckInput): ComplianceCheckResult[] {
  const results: ComplianceCheckResult[] = [];

  // 1. 원천징수 적용 체크
  results.push({
    id: 'settlement-withholding',
    category: 'tax',
    item: '원천징수 (3.3%)',
    status: input.withholdingApplied ? 'pass' : 'fail',
    message: input.withholdingApplied
      ? '3.3% 원천징수 적용 중'
      : '원천징수 미적용 - 즉시 적용 필요!',
    action: input.withholdingApplied ? undefined : '수당 지급 시 3.3% 원천징수 필수',
    reference: '소득세법 제127조',
  });

  // 2. 지급명세서 발행 체크
  results.push({
    id: 'settlement-payment-statement',
    category: 'tax',
    item: '지급명세서',
    status: input.paymentStatementReady ? 'pass' : 'warning',
    message: input.paymentStatementReady
      ? '지급명세서 발행 시스템 연동됨'
      : '지급명세서 발행 시스템 확인 필요',
    action: input.paymentStatementReady ? undefined : '매년 2월 말까지 지급명세서 제출 필수',
    reference: '소득세법 제164조',
  });

  // 3. 환불 처리 체크
  if (input.refundCount > 0) {
    results.push({
      id: 'settlement-refund',
      category: 'contract',
      item: '환불 건 수당 처리',
      status: input.refundProcessed ? 'pass' : 'warning',
      message: input.refundProcessed
        ? `환불 ${input.refundCount}건 - 수당 차감 처리됨`
        : `환불 ${input.refundCount}건 - 수당 차감 확인 필요`,
      action: input.refundProcessed ? undefined : '환불 건에 대한 수당 차감 처리 필요',
    });
  }

  // 4. 정산 금액 정보
  const withholdingAmount = input.totalCommission * 0.033;
  const netAmount = input.totalCommission - withholdingAmount;

  results.push({
    id: 'settlement-summary',
    category: 'tax',
    item: '정산 요약',
    status: 'info',
    message: `총 수당 ${input.totalCommission.toLocaleString()}원 / 원천징수 ${Math.round(withholdingAmount).toLocaleString()}원 / 실지급 ${Math.round(netAmount).toLocaleString()}원`,
  });

  return results;
}

// ===========================================
// 상태별 색상 및 아이콘
// ===========================================

export function getComplianceStatusColor(status: ComplianceCheckResult['status']): {
  bg: string;
  text: string;
  icon: string;
} {
  switch (status) {
    case 'pass':
      return { bg: 'bg-green-50', text: 'text-green-700', icon: '✅' };
    case 'warning':
      return { bg: 'bg-amber-50', text: 'text-amber-700', icon: '⚠️' };
    case 'fail':
      return { bg: 'bg-red-50', text: 'text-red-700', icon: '❌' };
    case 'info':
    default:
      return { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'ℹ️' };
  }
}

export function getCategoryLabel(category: ComplianceCheckResult['category']): string {
  switch (category) {
    case 'tax': return '세무';
    case 'contract': return '계약';
    case 'labor': return '노무';
    case 'travel': return '여행업';
    default: return category;
  }
}
