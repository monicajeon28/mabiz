export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  PartnerApiError,
  ensureValidLeadStatus,
  getPartnerLead,
  requirePartnerContext,
} from '@/app/api/partner/_utils';
import { toNullableString } from '@/app/api/admin/affiliate/profiles/shared';
import { syncSaleCommissionLedgers } from '@/lib/affiliate/commission-ledger';
import { logCommissionAudit } from '@/lib/affiliate/audit-log';
import { notifyCommissionCalculationFailed } from '@/lib/affiliate/admin-notifications';

function parseLeadId(raw: string | undefined) {
  const id = Number(raw);
  if (!raw || Number.isNaN(id) || id <= 0) {
    throw new PartnerApiError('유효한 고객 ID가 필요합니다.', 400);
  }
  return id;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> | { leadId: string } }
) {
  let resolvedParams: { leadId: string } = { leadId: 'unknown' };
  try {
    const { profile } = await requirePartnerContext({ includeManagedAgents: true });
    // Next.js 15+에서는 params가 Promise일 수 있음
    resolvedParams = await params;
    const leadId = parseLeadId(resolvedParams.leadId);

    await getPartnerLead(profile.id, leadId, { interactions: 1 }, profile.type);

    const interactions = await prisma.affiliateInteraction.findMany({
      where: { leadId },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: {
        id: true,
        interactionType: true,
        occurredAt: true,
        note: true,
        profileId: true,
        createdById: true,
        User: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        AffiliateMedia: {
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            storagePath: true,
            createdAt: true,
            metadata: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      interactions: interactions.map((interaction) => ({
        id: interaction.id,
        interactionType: interaction.interactionType,
        occurredAt: interaction.occurredAt.toISOString(),
        note: interaction.note ?? null,
        profileId: interaction.profileId,
        createdById: interaction.createdById,
        createdBy: interaction.User
          ? {
              id: interaction.User.id,
              name: interaction.User.name,
              phone: interaction.User.phone,
            }
          : null,
        media: interaction.AffiliateMedia.map((m) => ({
          id: m.id,
          fileName: m.fileName,
          fileSize: m.fileSize,
          mimeType: m.mimeType,
          url: m.storagePath,
          isBackedUp: !!(m.metadata as any)?.googleDriveFileId,
          googleDriveFileId: (m.metadata as any)?.googleDriveFileId || null,
        })),
      })),
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error(`GET /api/partner/customers/${resolvedParams.leadId}/interactions error:`, error);
    return NextResponse.json({ ok: false, message: '상담 기록을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> | { leadId: string } }
) {
  let resolvedParams: { leadId: string } = { leadId: 'unknown' };
  try {
    const { profile, sessionUser } = await requirePartnerContext({ includeManagedAgents: true });
    // Next.js 15+에서는 params가 Promise일 수 있음
    resolvedParams = await params;
    const leadId = parseLeadId(resolvedParams.leadId);
    const payload = await req.json().catch(() => ({}));

    const interactionType = toNullableString(payload.interactionType) ?? 'NOTE';
    const note = toNullableString(payload.note);

    if (!note) {
      throw new PartnerApiError('상담 메모를 입력해주세요.', 400);
    }

    await getPartnerLead(profile.id, leadId, { interactions: 1 }, profile.type);

    let occurredAt = new Date();
    if (payload.occurredAt) {
      const parsed = new Date(payload.occurredAt);
      if (!Number.isNaN(parsed.getTime())) {
        occurredAt = parsed;
      }
    }

    let nextActionAt: Date | null = null;
    if (payload.nextActionAt) {
      const parsed = new Date(payload.nextActionAt);
      if (!Number.isNaN(parsed.getTime())) {
        nextActionAt = parsed;
      }
    }

    const status = ensureValidLeadStatus(payload.status);

    // lead 정보 가져오기 (productCode 확인용)
    const lead = await getPartnerLead(profile.id, leadId, { interactions: 1 }, profile.type);

    const result = await prisma.$transaction(async (tx) => {
      const createdInteraction = await tx.affiliateInteraction.create({
        data: {
          leadId,
          profileId: profile.id,
          createdById: sessionUser.id,
          interactionType,
          occurredAt,
          note,
        },
        select: {
          id: true,
          interactionType: true,
          occurredAt: true,
          note: true,
          profileId: true,
          createdById: true,
          User: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      });

      const updateData: Prisma.AffiliateLeadUpdateInput = {
        lastContactedAt: occurredAt,
      };

      if (nextActionAt !== null) {
        updateData.nextActionAt = nextActionAt;
      }

      if (status) {
        updateData.status = status;
      }

      if (payload.notes !== undefined) {
        updateData.notes = toNullableString(payload.notes);
      }

      await tx.affiliateLead.update({
        where: { id: leadId },
        data: updateData,
      });

      // CustomerNote도 동시 생성 (관리자 패널과 동기화)
      if (lead.userId && note) {
        const createdByType = profile.type || 'SALES_AGENT';
        const createdByName = profile.displayName || sessionUser.name || '파트너';

        await tx.customerNote.create({
          data: {
            customerId: lead.userId,
            createdBy: sessionUser.id,
            createdByType,
            createdByName,
            content: note,
            consultedAt: occurredAt,
            nextActionDate: nextActionAt,
            nextActionNote: null,
            statusAfter: status || null,
            audioFileUrl: null,
            isInternal: false,
            updatedAt: new Date(),
          },
        });

        // User 테이블의 다음 조치 알람도 업데이트
        if (nextActionAt) {
          await tx.user.update({
            where: { id: lead.userId },
            data: {
              nextActionDate: nextActionAt,
              nextActionNote: null,
            },
          });
        }

        // 상담 후 상태 변경
        if (status) {
          await tx.user.update({
            where: { id: lead.userId },
            data: { customerStatus: status },
          });
        }
      }

      // '구매완료' 상태일 때 AffiliateSale 생성
      if (status === 'PURCHASED') {
        const productCode = lead.metadata?.productCode || lead.metadata?.product_code;
        
        if (productCode) {
          // AffiliateProduct 조회
          const affiliateProduct = await tx.affiliateProduct.findFirst({
            where: {
              productCode: productCode.toUpperCase(),
              status: 'active',
              isPublished: true,
            },
          });

          if (affiliateProduct) {
            // 이미 생성된 판매가 있는지 확인
            const existingSale = await tx.affiliateSale.findFirst({
              where: {
                leadId,
                productCode: productCode.toUpperCase(),
                status: { in: ['PENDING', 'CONFIRMED'] },
              },
            });

            if (!existingSale) {
              // AffiliateSale 생성
              const saleAmount = affiliateProduct.defaultSaleAmount || 0;
              const costAmount = affiliateProduct.defaultCostAmount || 0;
              const netRevenue = affiliateProduct.defaultNetRevenue || (saleAmount - costAmount);

              // 계약 해지 여부 확인 및 본사로 전환
              let finalManagerId = profile.type === 'BRANCH_MANAGER' ? profile.id : lead.managerId;
              let finalAgentId = profile.type === 'SALES_AGENT' ? profile.id : lead.agentId;
              let finalProfileType = profile.type;

              // 본사(HQ) 프로필 찾기 또는 자동 생성
              let hqProfile = await tx.affiliateProfile.findFirst({
                where: { type: 'HQ' },
                select: { id: true, userId: true },
              });

              if (!hqProfile) {
                // 관리자 계정 찾기
                let adminUser = await tx.user.findFirst({
                  where: { role: 'admin' },
                  select: { id: true },
                });

                if (!adminUser) {
                  adminUser = await tx.user.create({
                    data: {
                      name: '본사 관리자',
                      email: 'hq@cruiseguide.kr',
                      phone: '00000000000',
                      password: 'admin',
                      role: 'admin',
                      onboarded: true,
                    },
                    select: { id: true },
                  });
                }

                hqProfile = await tx.affiliateProfile.create({
                  data: {
                    userId: adminUser.id,
                    affiliateCode: 'HQ',
                    type: 'HQ',
                    status: 'ACTIVE',
                    displayName: '본사',
                    published: true,
                    metadata: {
                      autoCreated: true,
                      createdAt: new Date().toISOString(),
                      createdFor: 'purchase_redirection',
                    },
                  },
                  select: { id: true, userId: true },
                });
              }

              const hqProfileId = hqProfile.id;

              // 대리점장인 경우 계약 해지 여부 확인
              if (profile.type === 'BRANCH_MANAGER' && profile.userId) {
                const managerContract = await tx.affiliateContract.findFirst({
                  where: {
                    userId: profile.userId,
                    status: 'terminated',
                  },
                  select: {
                    id: true,
                    metadata: true,
                  },
                });

                // 해지된 대리점장인 경우
                if (managerContract && hqProfileId) {
                  const metadata = managerContract.metadata as any;
                  const terminatedAt = metadata?.terminatedAt ? new Date(metadata.terminatedAt) : null;
                  const dbRecovered = metadata?.dbRecovered || false;

                  if (terminatedAt) {
                    // 해지일 + 7일까지는 수당 인정, 그 이후는 본사로 전환
                    const gracePeriodEnd = new Date(terminatedAt);
                    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
                    gracePeriodEnd.setHours(23, 59, 59, 999); // 하루 끝까지

                    // 구매 시점이 해지일 + 7일 이내인지 확인
                    if (occurredAt <= gracePeriodEnd) {
                      // 해지일 + 7일 이내: 해지된 대리점장에게 수당 지급 (기존 로직 유지)
                      console.log(`[Sale] Manager ${profile.id} is terminated but within grace period (7 days), commission allowed`);
                    } else {
                      // 해지일 + 7일 이후: 본사로 전환
                      finalManagerId = hqProfileId;
                      finalAgentId = null; // 판매원 ID 제거
                      finalProfileType = 'HQ'; // 본사로 처리
                      console.log(`[Sale] Manager ${profile.id} is terminated and grace period expired, transferring to HQ ${hqProfileId}`);
                    }
                  } else if (dbRecovered) {
                    // DB가 회수되었으면 본사로 전환
                    finalManagerId = hqProfileId;
                    finalAgentId = null;
                    finalProfileType = 'HQ';
                    console.log(`[Sale] Manager ${profile.id} DB recovered, transferring to HQ ${hqProfileId}`);
                  }
                }
              }

              // 판매원인 경우 계약 해지 여부 확인
              if (profile.type === 'SALES_AGENT' && profile.userId) {
                const agentContract = await tx.affiliateContract.findFirst({
                  where: {
                    userId: profile.userId,
                    status: 'terminated',
                  },
                  select: {
                    id: true,
                    metadata: true,
                  },
                });

                // 해지된 판매원인 경우
                if (agentContract) {
                  const metadata = agentContract.metadata as any;
                  const terminatedAt = metadata?.terminatedAt ? new Date(metadata.terminatedAt) : null;
                  const dbRecovered = metadata?.dbRecovered || false;

                  if (terminatedAt) {
                    // 해지일 + 7일까지는 수당 인정, 그 이후는 대리점장 또는 본사로 전환
                    const gracePeriodEnd = new Date(terminatedAt);
                    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
                    gracePeriodEnd.setHours(23, 59, 59, 999); // 하루 끝까지

                    // 구매 시점이 해지일 + 7일 이내인지 확인
                    if (occurredAt <= gracePeriodEnd) {
                      // 해지일 + 7일 이내: 해지된 판매원에게 수당 지급 (기존 로직 유지)
                      console.log(`[Sale] Agent ${profile.id} is terminated but within grace period (7 days), commission allowed`);
                      // finalManagerId, finalAgentId는 그대로 유지 (판매원 수당 지급)
                    } else {
                      // 해지일 + 7일 이후: 대리점장 또는 본사로 전환
                      // 대리점장 찾기
                      const relation = await tx.affiliateRelation.findFirst({
                        where: {
                          agentId: profile.id,
                          status: 'ACTIVE',
                        },
                        include: {
                          AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile: {
                            select: {
                              id: true,
                              type: true,
                              userId: true,
                            },
                          },
                        },
                      });

                      if (relation?.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile) {
                        const managerProfile = relation.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile;
                        
                        // 대리점장도 해지되었는지 확인
                        if (managerProfile.userId) {
                          const managerContract = await tx.affiliateContract.findFirst({
                            where: {
                              userId: managerProfile.userId,
                              status: 'terminated',
                            },
                            select: {
                              id: true,
                              metadata: true,
                            },
                          });

                          // 대리점장도 해지되었는지 확인
                          if (managerContract && hqProfileId) {
                            const managerMetadata = managerContract.metadata as any;
                            const managerTerminatedAt = managerMetadata?.terminatedAt ? new Date(managerMetadata.terminatedAt) : null;
                            
                            if (managerTerminatedAt) {
                              const managerGracePeriodEnd = new Date(managerTerminatedAt);
                              managerGracePeriodEnd.setDate(managerGracePeriodEnd.getDate() + 7);
                              managerGracePeriodEnd.setHours(23, 59, 59, 999);
                              
                              // 대리점장도 해지일 + 7일 이후면 본사로, 아니면 대리점장으로
                              if (occurredAt > managerGracePeriodEnd) {
                                finalManagerId = hqProfileId;
                                finalAgentId = null;
                                finalProfileType = 'HQ';
                                console.log(`[Sale] Agent ${profile.id} and manager ${managerProfile.id} are terminated (grace period expired), transferring to HQ ${hqProfileId}`);
                              } else {
                                finalManagerId = managerProfile.id;
                                finalAgentId = null;
                                finalProfileType = 'BRANCH_MANAGER';
                                console.log(`[Sale] Agent ${profile.id} is terminated (grace period expired), transferring to manager ${finalManagerId}`);
                              }
                            } else if (managerMetadata?.dbRecovered) {
                              finalManagerId = hqProfileId;
                              finalAgentId = null;
                              finalProfileType = 'HQ';
                              console.log(`[Sale] Agent ${profile.id} and manager ${managerProfile.id} DB recovered, transferring to HQ ${hqProfileId}`);
                            } else {
                              finalManagerId = managerProfile.id;
                              finalAgentId = null;
                              finalProfileType = 'BRANCH_MANAGER';
                              console.log(`[Sale] Agent ${profile.id} is terminated (grace period expired), transferring to manager ${finalManagerId}`);
                            }
                          } else {
                            finalManagerId = managerProfile.id;
                            finalAgentId = null;
                            finalProfileType = 'BRANCH_MANAGER';
                            console.log(`[Sale] Agent ${profile.id} is terminated (grace period expired), transferring to manager ${finalManagerId}`);
                          }
                        } else {
                          finalManagerId = managerProfile.id;
                          finalAgentId = null;
                          finalProfileType = 'BRANCH_MANAGER';
                          console.log(`[Sale] Agent ${profile.id} is terminated (grace period expired), transferring to manager ${finalManagerId}`);
                        }
                      } else if (hqProfileId) {
                        // 대리점장이 없으면 본사로
                        finalManagerId = hqProfileId;
                        finalAgentId = null;
                        finalProfileType = 'HQ';
                        console.log(`[Sale] Agent ${profile.id} is terminated (grace period expired), no manager found, transferring to HQ ${hqProfileId}`);
                      }
                    }
                  } else if (dbRecovered) {
                    // DB가 회수되었으면 대리점장 또는 본사로 전환 (기존 로직)
                    const relation = await tx.affiliateRelation.findFirst({
                      where: {
                        agentId: profile.id,
                        status: 'ACTIVE',
                      },
                      include: {
                        AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile: {
                          select: {
                            id: true,
                            type: true,
                            userId: true,
                          },
                        },
                      },
                    });

                    if (relation?.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile) {
                      const managerProfile = relation.AffiliateProfile_AffiliateRelation_managerIdToAffiliateProfile;
                      if (managerProfile.userId) {
                        const managerContract = await tx.affiliateContract.findFirst({
                          where: {
                            userId: managerProfile.userId,
                            status: 'terminated',
                          },
                          select: {
                            id: true,
                            metadata: true,
                          },
                        });

                        if (managerContract && hqProfileId) {
                          const managerMetadata = managerContract.metadata as any;
                          if (managerMetadata?.dbRecovered || managerMetadata?.terminatedAt) {
                            finalManagerId = hqProfileId;
                            finalAgentId = null;
                            finalProfileType = 'HQ';
                            console.log(`[Sale] Agent ${profile.id} DB recovered, manager also terminated, transferring to HQ ${hqProfileId}`);
                          } else {
                            finalManagerId = managerProfile.id;
                            finalAgentId = null;
                            finalProfileType = 'BRANCH_MANAGER';
                            console.log(`[Sale] Agent ${profile.id} DB recovered, transferring to manager ${finalManagerId}`);
                          }
                        } else {
                          finalManagerId = managerProfile.id;
                          finalAgentId = null;
                          finalProfileType = 'BRANCH_MANAGER';
                          console.log(`[Sale] Agent ${profile.id} DB recovered, transferring to manager ${finalManagerId}`);
                        }
                      } else {
                        finalManagerId = managerProfile.id;
                        finalAgentId = null;
                        finalProfileType = 'BRANCH_MANAGER';
                        console.log(`[Sale] Agent ${profile.id} DB recovered, transferring to manager ${finalManagerId}`);
                      }
                    } else if (hqProfileId) {
                      finalManagerId = hqProfileId;
                      finalAgentId = null;
                      finalProfileType = 'HQ';
                      console.log(`[Sale] Agent ${profile.id} DB recovered, no manager found, transferring to HQ ${hqProfileId}`);
                    }
                  }
                }
              }

              // 수당 계산
              // 해지일 + 7일 이내면 해지된 판매원/대리점장에게 수당 지급
              // 해지일 + 7일 이후면 본사로 전환되어 오버라이딩 수당만 지급
              let branchCommission = 0;
              let salesCommission = 0;
              let overrideCommission = 0;

              if (finalProfileType === 'BRANCH_MANAGER') {
                // 대리점장 수당 (해지일 + 7일 이내면 지급, 이후면 본사로 전환됨)
                branchCommission = Math.floor(netRevenue * 0.033); // 3.3%
              } else if (finalProfileType === 'SALES_AGENT' && finalAgentId) {
                // 판매원 수당 (해지일 + 7일 이내면 지급, 이후면 대리점장/본사로 전환됨)
                salesCommission = Math.floor(netRevenue * 0.033); // 3.3%
              } else if (finalProfileType === 'HQ') {
                // 본사로 전환된 경우: 오버라이딩 수당만 지급
                overrideCommission = Math.floor(netRevenue * 0.033); // 3.3% 오버라이딩
              }

              // AffiliateSale 생성 (commissionProcessed: false로 초기화)
              const createdSale = await tx.affiliateSale.create({
                data: {
                  leadId,
                  affiliateProductId: affiliateProduct.id,
                  productCode: productCode.toUpperCase(),
                  saleAmount,
                  costAmount,
                  netRevenue,
                  branchCommission: finalProfileType === 'BRANCH_MANAGER' ? branchCommission : null,
                  salesCommission: (finalProfileType === 'SALES_AGENT' && finalAgentId) || (finalProfileType === 'HQ' && salesCommission > 0) ? salesCommission : null,
                  overrideCommission: finalProfileType === 'HQ' && overrideCommission > 0 ? overrideCommission : null,
                  managerId: finalManagerId,
                  agentId: finalAgentId,
                  status: 'PENDING', // 초기 상태는 PENDING, 매출 완료 버튼으로 CONFIRMED로 변경
                  saleDate: occurredAt,
                  metadata: {
                    createdFromInteraction: true,
                    interactionId: createdInteraction.id,
                    productName: lead.metadata?.productName || lead.metadata?.product_name,
                    agentTerminated: finalAgentId === null && profile.type === 'SALES_AGENT',
                    managerTerminated: finalProfileType === 'HQ' && profile.type === 'BRANCH_MANAGER',
                    transferredToManager: finalProfileType === 'BRANCH_MANAGER' && profile.type === 'SALES_AGENT',
                    transferredToHQ: finalProfileType === 'HQ',
                    commissionProcessed: false, // 수당 처리 플래그 초기화
                  },
                },
              });

              // 수당 중복 지급 방지: CommissionLedger에 기록
              // 트랜잭션 내에서 원자적으로 처리
              try {
                // 이미 처리되었는지 다시 확인 (동시성 방지)
                const currentSale = await tx.affiliateSale.findUnique({
                  where: { id: createdSale.id },
                  select: { metadata: true },
                });

                const currentMetadata = currentSale?.metadata as any;
                if (currentMetadata?.commissionProcessed) {
                  console.log(`[Sale] Commission already processed for sale ${createdSale.id}, skipping`);
                } else {
                  // CommissionLedger에 수당 기록
                  await syncSaleCommissionLedgers(createdSale.id, {}, tx);

                  // commissionProcessed 플래그 업데이트
                  await tx.affiliateSale.update({
                    where: { id: createdSale.id },
                    data: {
                      metadata: {
                        ...currentMetadata,
                        commissionProcessed: true,
                        commissionProcessedAt: new Date().toISOString(),
                      },
                    },
                  });

                  // 수당 계산 감사 로그
                  await logCommissionAudit(
                    'CALCULATED',
                    createdSale.id,
                    {
                      profileId: finalAgentId || finalManagerId || null,
                      userId: profile.userId || null,
                      performedBySystem: true,
                      details: {
                        branchCommission: finalProfileType === 'BRANCH_MANAGER' ? branchCommission : null,
                        salesCommission: (finalProfileType === 'SALES_AGENT' && finalAgentId) ? salesCommission : null,
                        overrideCommission: finalProfileType === 'HQ' ? overrideCommission : null,
                        netRevenue,
                        processedAt: new Date().toISOString(),
                      },
                    },
                    tx
                  );

                  console.log(`[Sale] Commission processed and ledger created for sale ${createdSale.id}`);
                }
              } catch (commissionError: any) {
                console.error(`[Sale] Failed to process commission for sale ${createdSale.id}:`, commissionError);
                
                // 수당 계산 실패 알림
                await notifyCommissionCalculationFailed(
                  createdSale.id,
                  commissionError.message || String(commissionError)
                );
                
                // 수당 처리 실패해도 판매는 생성됨 (나중에 재시도 가능)
                // commissionProcessed는 false로 유지되어 재시도 가능
              }
            }
          }
        }
      }

      return createdInteraction;
    });

    const interactions = await prisma.affiliateInteraction.findMany({
      where: { leadId },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true,
        interactionType: true,
        occurredAt: true,
        note: true,
        profileId: true,
        createdById: true,
        User: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    // Google 스프레드시트에 상세기록 업데이트 (source에 따라 해당 스프레드시트로)
    try {
      // Lead에서 고객 정보 + source 가져오기
      const leadForGoogle = await prisma.affiliateLead.findUnique({
        where: { id: leadId },
        select: { customerName: true, customerPhone: true, source: true },
      });

      if (leadForGoogle?.customerPhone && note) {
        const timestamp = new Date().toLocaleString('ko-KR');
        const source = leadForGoogle.source || '';

        // source에 따라 스프레드시트 URL 결정
        const SCRIPT_URLS = {
          PHONE_CONSULT: 'https://script.google.com/macros/s/AKfycbwVYYHKLyNfXwO3fSX19jmb7hF3Bh2oyay7lrlw3mJx42eL9kQANxhwxLrQyzbEj29x/exec',
          GROUP: 'https://script.google.com/macros/s/AKfycbyI7MEAS-fodkb7f8Y_PRUT8SBzDh-fvognlulXe3YeUDHmv0cuHRsNj3ub9YNoMxi9gg/exec',
          MANAGEMENT: 'https://script.google.com/macros/s/AKfycbyZYKPmjQ_IWlAn0onXeUTnyj1DxLqtRJLuD2Lh70QEk_1IR4DkAZW0eM8aLyFJJGid/exec',
          PURCHASED: 'https://script.google.com/macros/s/AKfycbwgZNwZnQwro13ZFfG8LQzqAhIBRV-xA8l_1TpK47vDip2gYKBV7W-aicGpbpwLSUXB/exec',
        };

        // source에 따라 대상 스프레드시트 선택
        let targetUrl = SCRIPT_URLS.MANAGEMENT; // 기본값: 나의고객추가
        let targetName = '나의고객추가';

        if (source.includes('phone-consultation') || source.includes('product-inquiry') || source.startsWith('mall')) {
          targetUrl = SCRIPT_URLS.PHONE_CONSULT;
          targetName = '전화상담고객';
        } else if (source.includes('landing') || source.includes('partner-landing')) {
          targetUrl = SCRIPT_URLS.GROUP;
          targetName = '나의그룹고객';
        } else if (source.includes('purchase') || source.includes('payment')) {
          targetUrl = SCRIPT_URLS.PURCHASED;
          targetName = '구매고객관리';
        }
        // partner-manual, trial, assigned, received 등은 기본값 MANAGEMENT 사용

        const formData = new URLSearchParams();
        formData.append('action', 'updateNote');
        formData.append('timestamp', timestamp);
        formData.append('name', leadForGoogle.customerName || '');
        formData.append('phone', leadForGoogle.customerPhone || '');
        formData.append('note', note);

        console.log('[Partner Interactions API] Google 스프레드시트 전송 시작:', {
          name: leadForGoogle.customerName,
          phone: leadForGoogle.customerPhone,
          source,
          targetSheet: targetName,
          note: note.substring(0, 50) + '...',
        });

        const googleResponse = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });

        const googleResult = await googleResponse.text();
        console.log(`[Partner Interactions API] ${targetName} 스프레드시트 응답:`, googleResult);
      } else {
        console.log('[Partner Interactions API] 고객 연락처 없음, 스프레드시트 업데이트 생략');
      }
    } catch (googleError) {
      console.error('[Partner Interactions API] Google 스프레드시트 전송 실패:', googleError);
      // 스프레드시트 전송 실패해도 기록은 성공으로 처리
    }

    return NextResponse.json({
      ok: true,
      interaction: {
        id: result.id,
        interactionType: result.interactionType,
        occurredAt: result.occurredAt.toISOString(),
        note: result.note ?? null,
        profileId: result.profileId,
        createdById: result.createdById,
        createdBy: result.User
          ? {
              id: result.User.id,
              name: result.User.name,
              phone: result.User.phone,
            }
          : null,
      },
      interactions: interactions.map((interaction) => ({
        id: interaction.id,
        interactionType: interaction.interactionType,
        occurredAt: interaction.occurredAt.toISOString(),
        note: interaction.note ?? null,
        profileId: interaction.profileId,
        createdById: interaction.createdById,
        createdBy: interaction.User
          ? {
              id: interaction.User.id,
              name: interaction.User.name,
              phone: interaction.User.phone,
            }
          : null,
      })),
    });
  } catch (error) {
    if (error instanceof PartnerApiError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }
    console.error(`POST /api/partner/customers/${resolvedParams.leadId}/interactions error:`, error);
    return NextResponse.json({ ok: false, message: '상담 기록을 저장하지 못했습니다.' }, { status: 500 });
  }
}
