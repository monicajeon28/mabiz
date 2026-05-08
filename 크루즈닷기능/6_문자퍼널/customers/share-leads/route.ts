export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePartnerContext, PartnerApiError } from '@/app/api/partner/_utils';

/**
 * POST /api/partner/customers/share-leads
 * B2B 잠재고객을 본사 또는 다른 대리점장에게 전송
 */
export async function POST(req: NextRequest) {
  try {
    const { profile, sessionUser } = await requirePartnerContext();

    const body = await req.json();
    const { leadIds, targetManagerId, type = 'lead' } = body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      throw new PartnerApiError('전송할 고객을 선택해주세요.', 400);
    }

    // 본사 전송이 아닌 경우, 대상 대리점장 검증
    let targetProfile = null;
    if (targetManagerId !== null) {
      targetProfile = await prisma.affiliateProfile.findFirst({
        where: {
          id: targetManagerId,
          type: 'BRANCH_MANAGER',
          status: 'ACTIVE',
        },
        select: { id: true, displayName: true, affiliateCode: true },
      });

      if (!targetProfile) {
        throw new PartnerApiError('유효하지 않은 대리점장입니다.', 400);
      }
    }

    let successCount = 0;

    if (type === 'lead') {
      // B2B Lead 전송
      for (const leadId of leadIds) {
        try {
          // 현재 파트너가 해당 Lead에 대한 권한이 있는지 확인
          const lead = await prisma.affiliateLead.findFirst({
            where: {
              id: leadId,
              OR: [
                { managerId: profile.id },
                { agentId: profile.id },
                { sharedToManagerId: profile.id },
              ],
            },
          });

          if (!lead) {
            console.warn(`[Share Leads] Lead ${leadId} not found or no permission`);
            continue;
          }

          // Lead를 대상에게 전송 (managerId 변경)
          // metadata에 출처 정보 기록
          const currentMetadata = (lead.metadata as Record<string, any>) || {};
          const transferHistory = currentMetadata.transferHistory || [];
          transferHistory.push({
            date: new Date().toISOString(),
            fromProfileId: profile.id,
            fromProfileName: profile.displayName || profile.affiliateCode,
            toProfileId: targetManagerId,
            toProfileName: targetProfile?.displayName || '본사',
          });

          await prisma.affiliateLead.update({
            where: { id: leadId },
            data: {
              managerId: targetManagerId, // null이면 본사
              agentId: null, // 판매원 해제
              sharedToManagerId: null, // 공유 해제
              updatedAt: new Date(),
              metadata: {
                ...currentMetadata,
                transferHistory,
                lastTransferFrom: profile.displayName || profile.affiliateCode || '대리점장',
                lastTransferFromId: profile.id,
                receivedAt: new Date().toISOString(),
              },
            },
          });

          // 전송 이력 기록
          await prisma.affiliateInteraction.create({
            data: {
              leadId,
              profileId: profile.id,
              createdById: sessionUser.id,
              interactionType: 'DB_TRANSFER',
              occurredAt: new Date(),
              note: targetManagerId === null
                ? `DB를 본사로 반환 (${profile.displayName || profile.affiliateCode})`
                : `DB를 ${targetProfile?.displayName || targetProfile?.affiliateCode}에게 전송 (${profile.displayName || profile.affiliateCode})`,
              metadata: {
                action: 'share_lead',
                fromProfileId: profile.id,
                fromProfileName: profile.displayName,
                toProfileId: targetManagerId,
                toProfileName: targetProfile?.displayName || '본사',
              },
            },
          });

          successCount++;
        } catch (error) {
          console.error(`[Share Leads] Error processing lead ${leadId}:`, error);
        }
      }
    } else if (type === 'consultation') {
      // System Consultation 전송
      for (const consultationId of leadIds) {
        try {
          // 현재 파트너가 해당 Consultation에 대한 권한이 있는지 확인
          const consultation = await prisma.systemConsultation.findFirst({
            where: {
              id: consultationId,
              OR: [
                { managerId: profile.id },
                { agentId: profile.id },
              ],
            },
          });

          if (!consultation) {
            console.warn(`[Share Leads] Consultation ${consultationId} not found or no permission`);
            continue;
          }

          // Consultation을 대상에게 전송
          await prisma.systemConsultation.update({
            where: { id: consultationId },
            data: {
              managerId: targetManagerId, // null이면 본사
              agentId: null, // 판매원 해제
              updatedAt: new Date(),
            },
          });

          successCount++;
        } catch (error) {
          console.error(`[Share Leads] Error processing consultation ${consultationId}:`, error);
        }
      }
    }

    if (successCount === 0) {
      throw new PartnerApiError('전송할 권한이 있는 고객이 없습니다.', 403);
    }

    return NextResponse.json({
      ok: true,
      message: targetManagerId === null
        ? `${successCount}개의 DB가 본사로 반환되었습니다.`
        : `${successCount}개의 DB가 전송되었습니다.`,
      successCount,
      totalRequested: leadIds.length,
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error('[Share Leads] Error:', error);
    return NextResponse.json({ ok: false, message: 'DB 전송에 실패했습니다.' }, { status: 500 });
  }
}
