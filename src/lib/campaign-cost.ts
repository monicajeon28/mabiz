import prisma from '@/lib/prisma';

interface CampaignCostInput {
  campaignId: string;
  organizationId: string;
}

/**
 * 캠페인의 발송 비용 계산 및 저장
 * SendingHistory 기반으로 SMS/Email 발송 수 집계
 */
export async function calculateCampaignCost(input: CampaignCostInput) {
  const { campaignId, organizationId } = input;

  // Step 1: SendingHistory 집계 (channel, status별)
  const stats = await prisma.sendingHistory.groupBy({
    by: ['channel', 'status'],
    where: { campaignId },
    _count: { id: true }
  });

  // Step 2: 채널별 발송/성공 수 계산
  let smsSent = 0, smsSuccess = 0, smsFailed = 0;
  let emailSent = 0, emailSuccess = 0, emailFailed = 0;

  for (const stat of stats) {
    const count = stat._count.id;
    if (stat.channel === 'SMS') {
      smsSent += count;
      if (['SENT', 'DELIVERED'].includes(stat.status)) {
        smsSuccess += count;
      } else if (stat.status === 'FAILED') {
        smsFailed += count;
      }
    } else if (stat.channel === 'EMAIL') {
      emailSent += count;
      if (['SENT', 'DELIVERED'].includes(stat.status)) {
        emailSuccess += count;
      } else if (stat.status === 'FAILED') {
        emailFailed += count;
      }
    }
  }

  // Step 3: 기본 단가 (향후 조직별 커스터마이징 가능)
  const smsRate = 0.01;      // KRW
  const emailRate = 0.001;   // KRW

  // Step 4: 비용 계산
  const smsCost = smsSent * smsRate;
  const emailCost = emailSent * emailRate;
  const totalCost = smsCost + emailCost;

  const successCount = smsSuccess + emailSuccess;
  const failureCount = smsFailed + emailFailed;
  const costPerSuccess = successCount > 0 ? totalCost / successCount : 0;

  // Step 5: 예상 ROI (임시값, 향후 Reservation 데이터 기반)
  const estimatedRevenue = successCount * 100000;  // 고객당 평균 수익 (임시)
  const estimatedRoi = totalCost > 0 ? estimatedRevenue / totalCost : 0;

  // Step 6: CampaignCost 저장 또는 업데이트
  const result = await prisma.campaignCost.upsert({
    where: { campaignId },
    update: {
      smsSent,
      emailSent,
      smsRateCurrent: smsRate,
      emailRateCurrent: emailRate,
      smsCostTotal: smsCost,
      emailCostTotal: emailCost,
      successCount,
      failureCount,
      costPerSuccess,
      actualCostTotal: totalCost,
      estimatedRevenue,
      estimatedRoi,
      calculatedAt: new Date(),
      updatedAt: new Date()
    },
    create: {
      campaignId,
      organizationId,
      smsSent,
      emailSent,
      smsRateCurrent: smsRate,
      emailRateCurrent: emailRate,
      smsCostTotal: smsCost,
      emailCostTotal: emailCost,
      successCount,
      failureCount,
      costPerSuccess,
      actualCostTotal: totalCost,
      estimatedRevenue,
      estimatedRoi
    }
  });

  return result;
}
