import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, phone, partnerId } = body;

        if (!name?.trim() || !phone?.trim() || !partnerId) {
            return NextResponse.json(
                { ok: false, error: '필수 정보가 누락되었습니다.' },
                { status: 400 }
            );
        }

        const normalizedPhone = phone.replace(/[^0-9]/g, '');
        if (normalizedPhone.length < 10) {
            return NextResponse.json(
                { ok: false, error: '올바른 연락처를 입력해주세요.' },
                { status: 400 }
            );
        }

        // 파트너(대리점장) 찾기
        const partnerUser = await prisma.user.findFirst({
            where: { mallUserId: partnerId },
            include: {
                AffiliateProfile: {
                    where: { status: 'ACTIVE' },
                    take: 1
                }
            }
        });

        if (!partnerUser || !partnerUser.AffiliateProfile[0]) {
            return NextResponse.json(
                { ok: false, error: '유효하지 않은 파트너 링크입니다.' },
                { status: 400 }
            );
        }

        const managerProfile = partnerUser.AffiliateProfile[0];

        // 중복 리드 확인 (B2B 소스는 중복 허용하되 이전 담당자 정보를 notes에 기록)
        let duplicateInfo = '';
        const existingLeads = await prisma.affiliateLead.findMany({
            where: {
                customerPhone: normalizedPhone,
                status: { not: 'CANCELLED' },
            },
            include: {
                AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile: {
                    select: {
                        displayName: true,
                    },
                },
                AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile: {
                    select: {
                        displayName: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        if (existingLeads.length > 0) {
            const latest = existingLeads[0];
            const managerName = latest.AffiliateProfile_AffiliateLead_managerIdToAffiliateProfile?.displayName;
            const agentName = latest.AffiliateProfile_AffiliateLead_agentIdToAffiliateProfile?.displayName;
            const ownerInfo = agentName || managerName || '본사';
            const registrationDate = new Date(latest.createdAt).toLocaleDateString('ko-KR');

            duplicateInfo = `[중복 DB] 이전 담당자: ${ownerInfo} (등록일: ${registrationDate})\n`;
        }

        // 신규 리드 생성
        const newLead = await prisma.affiliateLead.create({
            data: {
                customerName: name.trim(),
                customerPhone: normalizedPhone,
                managerId: managerProfile.id,
                source: 'B2B_LANDING',
                status: 'NEW',
                notes: duplicateInfo ? `${duplicateInfo}파트너 B2B 랜딩페이지 유입` : '파트너 B2B 랜딩페이지 유입',
                createdAt: new Date(),
                updatedAt: new Date(),
            }
        });

        // User 생성 여부는 선택사항 (여기서는 리드만 생성하고, 실제 가입은 별도 절차일 수 있음)
        // 하지만 "7일 체험"을 바로 시작하려면 User도 생성해주는 것이 좋음.
        // 기존 로직(auth/login)을 참고하면 User가 있어야 로그인이 가능.
        // 여기서는 리드만 생성하고, "상담 신청이 접수되었습니다"로 끝낼지,
        // 아니면 바로 체험 계정을 만들어줄지 결정해야 함.
        // 기획상 "B2B 유입" -> "관리자/파트너가 컨택" 프로세스라면 리드만 생성.
        // "7일 무료체험 시작" 버튼이라면 계정 생성까지 필요.
        // User Request: "Start 7-Day Free Trial form" -> implies account creation.
        // Let's create a User if not exists, with a default password (e.g., phone number or '1111').
        // For now, to keep it simple and safe, we will just create the Lead and let the Partner contact them,
        // OR we can redirect them to the signup page with pre-filled info.
        // Given "B2B Potential Customer", Lead creation is the priority.

        // Google Drive Backup (Async - do not await to prevent blocking response)
        // 계약서 이름(실명) 조회
        const contract = await prisma.affiliateContract.findFirst({
            where: {
                userId: partnerUser.id,
                status: 'approved',
            },
            select: { name: true },
        });
        const partnerName = contract?.name || managerProfile.displayName || partnerUser.name || 'Unknown';

        // Google 스프레드시트 백업 (동기 대기 - Vercel 서버리스 환경 필수)
        try {
            console.log('[B2B Register] 스프레드시트 백업 시작...');
            const { appendB2BLeadToSheet } = await import('@/lib/google/b2b-backup');
            const backupResult = await appendB2BLeadToSheet({
                name: newLead.customerName || '',
                phone: newLead.customerPhone || '',
                partnerName: partnerName,
                source: newLead.source || 'B2B_LANDING',
                createdAt: newLead.createdAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
                notes: newLead.notes || ''
            });
            console.log('[B2B Register] 스프레드시트 백업 완료:', backupResult);
        } catch (backupErr: any) {
            console.error('[B2B Register] 스프레드시트 백업 실패:', backupErr?.message || backupErr);
        }

        return NextResponse.json({
            ok: true,
            message: '무료체험 신청이 접수되었습니다. 곧 연락드리겠습니다.',
            leadId: newLead.id,
            isNew: true
        });

    } catch (error) {
        console.error('[B2B Register] Error:', error);
        return NextResponse.json(
            { ok: false, error: '신청 처리 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
