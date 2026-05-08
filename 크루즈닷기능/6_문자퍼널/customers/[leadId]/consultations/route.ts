export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  PartnerApiError,
  getPartnerLead,
  requirePartnerContext,
} from '@/app/api/partner/_utils';

function parseLeadId(raw: string | undefined) {
  const id = Number(raw);
  if (!raw || Number.isNaN(id) || id <= 0) {
    throw new PartnerApiError('유효한 고객 ID가 필요합니다.', 400);
  }
  return id;
}

/**
 * 파트너용 상담기록 조회 API
 * GET /api/partner/customers/[leadId]/consultations
 *
 * - 판매원: 본인 고객의 상담기록만 조회
 * - 대리점장: 본인 + 산하 판매원 고객의 상담기록 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> | { leadId: string } }
) {
  let resolvedParams: { leadId: string } = { leadId: 'unknown' };
  try {
    const { profile, sessionUser } = await requirePartnerContext({ includeManagedAgents: true });
    resolvedParams = await params;
    const leadId = parseLeadId(resolvedParams.leadId);

    // 권한 체크: 해당 고객에 접근 가능한지 확인
    const lead = await getPartnerLead(profile.id, leadId, { interactions: 1 }, profile.type);

    if (!lead) {
      throw new PartnerApiError('고객을 찾을 수 없거나 접근 권한이 없습니다.', 404);
    }

    // 병렬로 상담기록 및 User 조회 (성능 최적화)
    const normalizedPhone = lead.customerPhone?.replace(/[^0-9]/g, '') || '';

    const [interactions, user] = await Promise.all([
      prisma.affiliateInteraction.findMany({
        where: { leadId },
        orderBy: { occurredAt: 'desc' },
        include: {
          AffiliateProfile: {
            select: {
              id: true,
              displayName: true,
              type: true,
            },
          },
          User: {
            select: {
              id: true,
              name: true,
            },
          },
          AffiliateMedia: {
            select: {
              id: true,
              storagePath: true,
              mimeType: true,
              metadata: true,
            },
          },
        },
      }),
      lead.customerPhone ? prisma.user.findFirst({
        where: {
          OR: [
            { phone: normalizedPhone },
            { phone: lead.customerPhone },
          ],
        },
        select: { id: true },
      }) : null,
    ]);

    // CustomerNote 조회 (userId가 있는 경우)
    let customerNotes: any[] = [];
    if (user?.id) {
      customerNotes = await prisma.customerNote.findMany({
        where: {
          customerId: user.id,
          metadata: {
            path: ['leadId'],
            equals: leadId,
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // 통합 상담기록 포맷
    const consultations = [
      // AffiliateInteraction → 통합 포맷
      ...interactions.map((interaction) => {
        const audioMedia = interaction.AffiliateMedia?.find(m =>
          m.mimeType?.startsWith('audio/') ||
          m.storagePath?.match(/\.(mp3|wav|m4a|ogg|webm)$/i)
        );

        // metadata에서 audioFileUrl 추출
        const metadataAudioUrl = (interaction.metadata as any)?.audioFileUrl || null;

        return {
          id: `I-${interaction.id}`,
          type: 'interaction',
          content: interaction.note || '',
          consultedAt: interaction.occurredAt.toISOString(),
          nextActionDate: null,
          nextActionNote: null,
          statusAfter: interaction.interactionType,
          audioFileUrl: metadataAudioUrl || audioMedia?.storagePath || (audioMedia?.metadata as any)?.googleDriveUrl || null,
          createdByLabel: interaction.AffiliateProfile?.type === 'BRANCH_MANAGER' ? '대리점장' :
            interaction.AffiliateProfile?.type === 'SALES_AGENT' ? '판매원' : '본사',
          createdByName: interaction.AffiliateProfile?.displayName || interaction.User?.name || '알 수 없음',
          createdAt: interaction.occurredAt.toISOString(), // AffiliateInteraction에 createdAt이 없어서 occurredAt 사용
          isOwn: interaction.User?.id === sessionUser.id, // 본인 작성 여부
        };
      }),
      // CustomerNote → 통합 포맷
      ...customerNotes.map((note) => ({
        id: `N-${note.id}`,
        type: 'note',
        content: note.content,
        consultedAt: note.consultedAt?.toISOString() || note.createdAt.toISOString(),
        nextActionDate: note.nextActionDate?.toISOString() || null,
        nextActionNote: note.nextActionNote,
        statusAfter: note.statusAfter,
        audioFileUrl: note.audioFileUrl,
        createdByLabel: note.createdByType === 'BRANCH_MANAGER' ? '대리점장' :
          note.createdByType === 'SALES_AGENT' ? '판매원' : '본사',
        createdByName: note.createdByName || '관리자',
        createdAt: note.createdAt.toISOString(),
        isOwn: note.createdBy === sessionUser.id, // 본인 작성 여부
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ ok: true, consultations });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error(`GET /api/partner/customers/${resolvedParams.leadId}/consultations error:`, error);
    return NextResponse.json({ ok: false, message: '상담기록을 불러오지 못했습니다.' }, { status: 500 });
  }
}

/**
 * 파트너용 상담기록 추가 API
 * POST /api/partner/customers/[leadId]/consultations
 *
 * 본사의 CustomerNote + 파트너의 AffiliateInteraction 둘 다 생성
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> | { leadId: string } }
) {
  let resolvedParams: { leadId: string } = { leadId: 'unknown' };
  try {
    const { profile, sessionUser } = await requirePartnerContext({ includeManagedAgents: true });
    resolvedParams = await params;
    const leadId = parseLeadId(resolvedParams.leadId);

    // 권한 체크
    const lead = await getPartnerLead(profile.id, leadId, { interactions: 1 }, profile.type);

    if (!lead) {
      throw new PartnerApiError('고객을 찾을 수 없거나 접근 권한이 없습니다.', 404);
    }

    // AffiliateLead에는 userId가 없으므로 customerPhone으로 User를 찾아야 함
    let leadUserId: number | null = null;
    if (lead.customerPhone) {
      const normalizedPhone = lead.customerPhone.replace(/[^0-9]/g, '');
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { phone: normalizedPhone },
            { phone: lead.customerPhone },
          ],
        },
        select: { id: true },
      });
      leadUserId = user?.id || null;
    }

    const body = await req.json();
    const {
      content,
      consultedAt,
      nextActionDate,
      nextActionNote,
      statusAfter,
      audioFileUrl,
    } = body;

    if (!content || !content.trim()) {
      throw new PartnerApiError('상담 내용을 입력해주세요.', 400);
    }

    // 상담자 정보
    const createdByType = profile.type || 'SALES_AGENT';
    const createdByName = profile.displayName || sessionUser.name || '파트너';

    // 트랜잭션으로 처리
    const result = await prisma.$transaction(async (tx) => {
      // 1. AffiliateInteraction 생성 (파트너 시스템용)
      const interaction = await tx.affiliateInteraction.create({
        data: {
          leadId,
          profileId: profile.id,
          createdById: sessionUser.id,
          interactionType: statusAfter || 'NOTE',
          occurredAt: consultedAt ? new Date(consultedAt) : new Date(),
          note: content.trim(),
          metadata: audioFileUrl ? { audioFileUrl } : undefined,
        },
      });

      // 2. AffiliateLead 업데이트 (다음 조치 알람, 상태)
      const updateData: any = {
        lastContactedAt: consultedAt ? new Date(consultedAt) : new Date(),
      };

      if (nextActionDate) {
        updateData.nextActionAt = new Date(nextActionDate);
      }

      if (statusAfter) {
        updateData.status = statusAfter;
      }

      await tx.affiliateLead.update({
        where: { id: leadId },
        data: updateData,
      });

      // 3. userId가 있으면 CustomerNote도 생성 (본사 시스템과 동기화)
      let customerNote = null;
      if (leadUserId) {
        customerNote = await tx.customerNote.create({
          data: {
            customerId: leadUserId,
            createdBy: sessionUser.id,
            createdByType,
            createdByName,
            content: content.trim(),
            consultedAt: consultedAt ? new Date(consultedAt) : new Date(),
            nextActionDate: nextActionDate ? new Date(nextActionDate) : null,
            nextActionNote: nextActionNote || null,
            statusAfter: statusAfter || null,
            audioFileUrl: audioFileUrl || null,
            isInternal: false,
            metadata: { leadId }, // leadId 추가 (상담기록 필터링용)
            updatedAt: new Date(),
          },
        });

        // User 테이블의 다음 조치 알람도 업데이트
        if (nextActionDate) {
          await tx.user.update({
            where: { id: leadUserId },
            data: {
              nextActionDate: new Date(nextActionDate),
              nextActionNote: nextActionNote || null,
            },
          });
        }

        // 상담 후 상태 변경
        if (statusAfter) {
          await tx.user.update({
            where: { id: leadUserId },
            data: { customerStatus: statusAfter },
          });
        }
      }

      return { interaction, customerNote };
    });

    // Google 스프레드시트 자동 백업 - B2B 상담기록 (동기 대기 - Vercel 서버리스 환경 필수)
    try {
      console.log('[Partner Consultation] 스프레드시트 백업 시작...');
      const { appendConsultationNoteToSheet } = await import('@/lib/google/b2b-backup');
      const backupResult = await appendConsultationNoteToSheet({
        consultationId: result.interaction.id,
        customerId: leadId,
        customerName: lead.customerName || '이름없음',
        customerPhone: lead.customerPhone || '',
        consultedAt: (consultedAt ? new Date(consultedAt) : new Date()).toISOString(),
        content: content.trim(),
        consultantName: createdByName,
        consultantType: createdByType === 'BRANCH_MANAGER' ? '대리점장' : '판매원',
        nextActionDate: nextActionDate || null,
        nextActionNote: nextActionNote || null,
        statusAfter: statusAfter || null,
        audioFileUrl: audioFileUrl || null,
        createdAt: new Date().toISOString(),
      });
      console.log('[Partner Consultation] 스프레드시트 백업 완료:', backupResult);
    } catch (backupErr: any) {
      console.error('[Partner Consultation] 스프레드시트 백업 실패:', backupErr?.message || backupErr);
    }

    return NextResponse.json({
      ok: true,
      consultation: {
        id: `I-${result.interaction.id}`,
        content: content.trim(),
        consultedAt: result.interaction.occurredAt.toISOString(),
        createdAt: result.interaction.createdAt.toISOString(),
        audioFileUrl: audioFileUrl || null,
      },
      message: '상담기록이 저장되었습니다.',
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error(`POST /api/partner/customers/${resolvedParams.leadId}/consultations error:`, error);
    return NextResponse.json({ ok: false, message: '상담기록 저장에 실패했습니다.' }, { status: 500 });
  }
}

/**
 * 파트너용 상담기록 삭제 API
 * DELETE /api/partner/customers/[leadId]/consultations?id=I-123 or id=N-456
 *
 * - 판매원: 본인이 작성한 상담기록만 삭제 가능
 * - 대리점장: 본인 + 산하 판매원이 작성한 상담기록 삭제 가능
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> | { leadId: string } }
) {
  let resolvedParams: { leadId: string } = { leadId: 'unknown' };
  try {
    const { profile, sessionUser } = await requirePartnerContext({ includeManagedAgents: true });
    resolvedParams = await params;
    const leadId = parseLeadId(resolvedParams.leadId);

    // 권한 체크: 해당 고객에 접근 가능한지 확인
    const lead = await getPartnerLead(profile.id, leadId, { interactions: 1 }, profile.type);

    if (!lead) {
      throw new PartnerApiError('고객을 찾을 수 없거나 접근 권한이 없습니다.', 404);
    }

    // URL 파라미터에서 삭제할 상담기록 ID 추출
    const url = new URL(req.url);
    const consultationId = url.searchParams.get('id');

    if (!consultationId) {
      throw new PartnerApiError('삭제할 상담기록 ID가 필요합니다.', 400);
    }

    // ID 파싱: I-123 (AffiliateInteraction) 또는 N-456 (CustomerNote)
    const isInteraction = consultationId.startsWith('I-');
    const isNote = consultationId.startsWith('N-');
    const numericId = parseInt(consultationId.substring(2));

    if ((!isInteraction && !isNote) || isNaN(numericId)) {
      throw new PartnerApiError('유효하지 않은 상담기록 ID입니다.', 400);
    }

    // 트랜잭션으로 삭제 처리
    await prisma.$transaction(async (tx) => {
      if (isInteraction) {
        // AffiliateInteraction 삭제
        const interaction = await tx.affiliateInteraction.findUnique({
          where: { id: numericId },
          select: { id: true, leadId: true, profileId: true, createdById: true },
        });

        if (!interaction) {
          throw new PartnerApiError('상담기록을 찾을 수 없습니다.', 404);
        }

        // 권한 확인: 본인이 작성했거나 대리점장인 경우만 삭제 가능
        const canDelete = interaction.createdById === sessionUser.id ||
          interaction.profileId === profile.id ||
          profile.type === 'BRANCH_MANAGER';

        if (!canDelete) {
          throw new PartnerApiError('이 상담기록을 삭제할 권한이 없습니다.', 403);
        }

        // 관련 미디어 삭제
        await tx.affiliateMedia.deleteMany({
          where: { interactionId: numericId },
        });

        // 상담기록 삭제
        await tx.affiliateInteraction.delete({
          where: { id: numericId },
        });
      } else {
        // CustomerNote 삭제
        const note = await tx.customerNote.findUnique({
          where: { id: numericId },
          select: { id: true, createdBy: true, createdByType: true },
        });

        if (!note) {
          throw new PartnerApiError('상담기록을 찾을 수 없습니다.', 404);
        }

        // 권한 확인: 본인이 작성했거나 대리점장인 경우만 삭제 가능
        const canDelete = note.createdBy === sessionUser.id ||
          profile.type === 'BRANCH_MANAGER';

        if (!canDelete) {
          throw new PartnerApiError('이 상담기록을 삭제할 권한이 없습니다.', 403);
        }

        // 상담기록 삭제
        await tx.customerNote.delete({
          where: { id: numericId },
        });
      }
    });

    return NextResponse.json({
      ok: true,
      message: '상담기록이 삭제되었습니다.',
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error(`DELETE /api/partner/customers/${resolvedParams.leadId}/consultations error:`, error);
    return NextResponse.json({ ok: false, message: '상담기록 삭제에 실패했습니다.' }, { status: 500 });
  }
}
