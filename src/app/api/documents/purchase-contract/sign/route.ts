import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { sendFunnelEmail } from '@/lib/email';
import { checkRateLimitAsync } from '@/lib/rate-limit';
import { saveContractToDrive } from '@/lib/affiliate/document-drive-sync';
import { generatePurchaseContractPdf } from '@/lib/purchase-contract-pdf';
import { sendSystemEmail, COMPANY_EMAIL } from '@/lib/system-email';
import { extractAllContactFieldValues, validateAllFieldValues } from '@/lib/utils/contract-field-mapper';
import type { ContractInputField } from '@/lib/types/contract-templates';

type Companion = {
  name: string;      // 이름 (필수)
  birthDate: string; // 생년월일 YYYY-MM-DD (필수)
  relation: string;  // 관계: 배우자|자녀|부모|형제자매|친구|기타
  phone: string;     // 연락처 (필수)
};

type InputField = {
  id: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'date' | 'select' | 'number';
  required: boolean;
  placeholder?: string;
  pattern?: string;
  options?: Array<{ label: string; value: string }>;
};

type InputValue = {
  fieldId: string;
  value: string | number | null;
};

// P0-2: timingSafeEqual 기반 토큰 비교
function safeTokenCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// P2-2: HTML 이스케이프
function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Drive 저장 재시도 헬퍼 함수 (exponential backoff)
async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; baseDelayMs: number }
): Promise<T> {
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === options.maxRetries) throw err;
      const delayMs = options.baseDelayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('Max retries exceeded');
}

// P2-1: 동행자 관계 허용 목록
const ALLOWED_RELATIONS = ['배우자', '자녀', '부모', '형제자매', '친구', '기타'];
const birthDateRegex = /^\d{4}-\d{2}-\d{2}$/;
const phoneRegex = /^01[0-9][-]?\d{3,4}[-]?\d{4}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phase 6: Input field 값 검증 함수
function validateInputValue(field: InputField, value: string | number | null): { valid: boolean; error?: string } {
  if (field.required && (value === null || value === '' || value === undefined)) {
    return { valid: false, error: `${field.label}은(는) 필수입니다` };
  }

  if (value === null || value === '' || value === undefined) {
    return { valid: true }; // 선택사항이고 비어있으면 통과
  }

  const strValue = String(value);

  if (field.type === 'email' && !emailRegex.test(strValue)) {
    return { valid: false, error: `${field.label}이(가) 유효하지 않습니다` };
  }

  if (field.type === 'phone' && !phoneRegex.test(strValue)) {
    return { valid: false, error: `${field.label} 형식이 유효하지 않습니다 (010-0000-0000)` };
  }

  if (field.type === 'date' && !birthDateRegex.test(strValue)) {
    return { valid: false, error: `${field.label} 형식이 유효하지 않습니다 (YYYY-MM-DD)` };
  }

  if (field.type === 'number' && isNaN(Number(value))) {
    return { valid: false, error: `${field.label}은(는) 숫자여야 합니다` };
  }

  return { valid: true };
}

// Phase 6: Input Fields 정의 (Contact 자동 채우기 지원)
function getInputFields(contactData: Record<string, unknown> | null): InputField[] {
  return [
    {
      id: 'signerName',
      label: '계약자 이름',
      type: 'text',
      required: true,
      placeholder: contactData?.name ? `(자동) ${contactData.name}` : '이름을 입력하세요',
    },
    {
      id: 'signerPhone',
      label: '계약자 연락처',
      type: 'phone',
      required: true,
      placeholder: contactData?.phone ? `(자동) ${contactData.phone}` : '010-0000-0000',
      pattern: '^01[0-9][-]?\\d{3,4}[-]?\\d{4}$',
    },
    {
      id: 'signerEmail',
      label: '계약자 이메일',
      type: 'email',
      required: false,
      placeholder: contactData?.email ? `(자동) ${contactData.email}` : 'example@email.com',
    },
    {
      id: 'signerBirthDate',
      label: '계약자 생년월일',
      type: 'date',
      required: false,
      placeholder: contactData?.birthDate ? `(자동) ${contactData.birthDate}` : 'YYYY-MM-DD',
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
    },
  ];
}

// ─── GET /api/documents/purchase-contract/sign?docId=X&token=Y ───────────────
// 공개 API — 토큰 기반, 인증 불필요
export async function GET(req: Request) {
  try {
    // P1-1: Rate Limiting (GET)
    const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
    const rl = await checkRateLimitAsync(`sign_get:${ip}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(req.url);
    const docId = searchParams.get('docId');
    const token = searchParams.get('token');

    if (!docId || !token) {
      return NextResponse.json(
        { ok: false, message: 'docId와 token이 필요합니다' },
        { status: 400 },
      );
    }

    const doc = await prisma.salesDocument.findUnique({
      where: { id: docId },
      select: { id: true, generatedData: true, status: true, contactId: true },
    });

    // P1-3: IDOR 방지 — 문서 없을 때 동일 메시지
    if (!doc) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 링크입니다' },
        { status: 401 },
      );
    }

    const data = doc.generatedData as Record<string, unknown>;

    // P0-2: timingSafeEqual 토큰 비교
    const storedToken = typeof data.signToken === 'string' ? data.signToken : '';
    if (!storedToken || !safeTokenCompare(storedToken, token)) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 링크입니다' },
        { status: 401 },
      );
    }

    // 만료 검증 (typeof 가드로 Invalid Date 방지)
    if (
      typeof data.signTokenExpiresAt === 'string' &&
      new Date(data.signTokenExpiresAt) < new Date()
    ) {
      return NextResponse.json(
        { ok: false, message: '링크가 만료되었습니다 (7일 경과)' },
        { status: 410 },
      );
    }

    // 이미 서명된 경우
    if (data.signStatus === 'SIGNED') {
      return NextResponse.json({
        ok: true,
        alreadySigned: true,
        signedAt: data.signedAt ?? null,
      });
    }

    // Phase 6: Contact 조회 + Template에서 inputFields 추출
    let contactData: Record<string, unknown> | null = null;
    let templateInputFields: ContractInputField[] | null = null;
    let inputFieldDefaults: Record<string, unknown> | null = null;

    if (doc.contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: doc.contactId },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          cruiseInterest: true,
          productName: true,
          budgetRange: true,
          departureDate: true,
          bookingRef: true,
        },
      });
      if (contact) {
        contactData = contact as Record<string, unknown>;
      }
    }

    // Phase 6: 템플릿에서 inputFields 추출
    if (data && typeof data === 'object') {
      const templateData = data as Record<string, unknown>;
      if (Array.isArray(templateData.inputFields)) {
        templateInputFields = templateData.inputFields as ContractInputField[];
      }
    }

    // Phase 6: 기본값 추출 (Contact 데이터로부터 자동 채우기)
    if (templateInputFields && contactData) {
      try {
        inputFieldDefaults = extractAllContactFieldValues(contactData);
      } catch (extractErr) {
        logger.warn('[PurchaseContractSign GET] inputFields 추출 오류', {
          docId,
          error: extractErr instanceof Error ? extractErr.message : String(extractErr),
        });
      }
    }

    // Phase 6: 기본 inputFields (템플릿에 없으면 폴백)
    const inputFields = templateInputFields ?? getInputFields(contactData);

    return NextResponse.json({
      ok: true,
      doc: {
        id: doc.id,
        productName:        data.productName        ?? null,
        buyerName:          data.buyerName          ?? null,
        amount:             data.amount             ?? null,
        departureDate:      data.departureDate      ?? null,
        nights:             data.nights             ?? null,
        paymentMethod:      data.paymentMethod      ?? null,
        paidAt:             data.paidAt             ?? null,
        signedAt:           data.signedAt           ?? null,
        cancellationPolicy: data.cancellationPolicy ?? null,
        specialTerms:       data.specialTerms       ?? null,
        companyName:        data.companyName        ?? null,
      },
      inputFields,
      inputFieldDefaults,
      alreadySigned: false,
    });
  } catch (e) {
    logger.error('[PurchaseContractSign GET] 오류', {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ─── POST /api/documents/purchase-contract/sign ──────────────────────────────
// 공개 API — 토큰 기반, 인증 불필요
export async function POST(req: Request) {
  try {
    // P1-1: Rate Limiting (POST)
    const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
    const rl = await checkRateLimitAsync(`sign_post:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429 },
      );
    }

    const body = await req.json() as {
      docId: string;
      token: string;
      companions: Companion[];
      signatureImage: string;
      signerName: string;
      inputValues?: Record<string, any>; // Phase 6: 입력 필드 값 객체 (fieldId → 값)
    };

    const { docId, token, companions = [], signatureImage, signerName, inputValues = {} } = body;

    // 필수값 검증
    if (!docId || !token || !signatureImage || !signerName) {
      return NextResponse.json(
        { ok: false, message: 'docId, token, signatureImage, signerName은 필수입니다' },
        { status: 400 },
      );
    }

    // Phase 6: 문서 사전 조회 (inputFields 검증용)
    const docForValidation = await prisma.salesDocument.findUnique({
      where: { id: docId },
      select: { generatedData: true },
    });

    let templateInputFields: ContractInputField[] | null = null;
    if (docForValidation?.generatedData && typeof docForValidation.generatedData === 'object') {
      const data = docForValidation.generatedData as Record<string, unknown>;
      if (Array.isArray(data.inputFields)) {
        templateInputFields = data.inputFields as ContractInputField[];
      }
    }

    // Phase 6: Input field 값 검증 (templateInputFields가 있는 경우만)
    if (templateInputFields && Object.keys(inputValues).length > 0) {
      const validation = validateAllFieldValues(templateInputFields, inputValues);
      if (!validation.isValid) {
        const errorMessages = Object.entries(validation.errors)
          .map(([fieldId, error]) => error)
          .join(' / ');
        return NextResponse.json(
          { ok: false, message: errorMessages, fieldErrors: validation.errors },
          { status: 400 },
        );
      }
    }

    // P1-2: signatureImage base64 형식 검증
    const base64Regex = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
    if (!base64Regex.test(signatureImage)) {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 서명 이미지입니다' },
        { status: 400 },
      );
    }

    // 동행자 최대 20명 제한
    if (companions.length > 20) {
      return NextResponse.json(
        { ok: false, message: '동행자는 최대 20명까지 등록 가능합니다' },
        { status: 400 },
      );
    }

    // 서명 이미지 크기 검증 (base64 ~375KB max)
    if (signatureImage.length > 500_000) {
      return NextResponse.json(
        { ok: false, message: '서명 이미지 크기가 너무 큽니다 (최대 375KB)' },
        { status: 400 },
      );
    }

    // P2-1: Companion 필드 유효성 검증
    for (const [i, c] of companions.entries()) {
      if (!c.name?.trim() || !c.birthDate || !c.phone?.trim() || !c.relation) {
        return NextResponse.json(
          { ok: false, message: `동행자 ${i + 1}번 필수 정보 누락` },
          { status: 400 },
        );
      }
      if (!birthDateRegex.test(c.birthDate)) {
        return NextResponse.json(
          { ok: false, message: `동행자 ${i + 1}번 생년월일 형식 오류 (YYYY-MM-DD)` },
          { status: 400 },
        );
      }
      if (!ALLOWED_RELATIONS.includes(c.relation)) {
        return NextResponse.json(
          { ok: false, message: `동행자 ${i + 1}번 관계 값 오류` },
          { status: 400 },
        );
      }
    }

    // P0-1: Race condition 방지 — $transaction으로 select-then-update 원자적 처리
    const result = await prisma.$transaction(async (tx) => {
      // 먼저 문서 존재 여부 확인 (미존재 vs 이미서명 구분)
      const docExists = await tx.salesDocument.findFirst({
        where: { id: docId },
        select: { id: true, status: true, approvedAt: true, generatedData: true, organizationId: true },
      });
      if (!docExists) return 'NOT_FOUND' as const; // 문서 없음 → 401

      const current = docExists;
      const existingData = current.generatedData as Record<string, unknown>;
      // APPROVED는 "관리자 발급" + "서명 완료" 두 경우 모두 가능하므로 signStatus로 판단
      if (existingData.signStatus === 'SIGNED') return null; // 이미 서명 → 409

      // P0-2: timingSafeEqual 토큰 비교
      const storedToken = typeof existingData.signToken === 'string' ? existingData.signToken : '';
      if (!storedToken || !safeTokenCompare(storedToken, token)) {
        return 'INVALID_TOKEN' as const;
      }

      // 만료 검증
      if (
        typeof existingData.signTokenExpiresAt === 'string' && new Date(existingData.signTokenExpiresAt) < new Date()
      ) {
        return 'EXPIRED' as const;
      }

      const signedAt = new Date().toISOString();

      // Phase 6: inputValues를 generatedData에 병합
      let mergedData = { ...existingData };
      if (Object.keys(inputValues).length > 0) {
        mergedData = {
          ...mergedData,
          inputValues: { ...inputValues }, // { signerName, signerPhone, signerEmail, signerBirthDate, ... }
        };
      }

      // P1-5: 서명 후 signToken 무효화
      const doc = await tx.salesDocument.update({
        where: { id: docId },
        data: {
          status:     'APPROVED',
          approvedAt: new Date(),
          generatedData: {
            ...mergedData,
            companions,
            signatureImage,
            signedAt,
            signedByName: signerName,
            signStatus:   'SIGNED',
            signToken:    null,
            signTokenExpiresAt: null,
          },
        },
      });

      // Contact 상태 업데이트 (generatedData에서 contactId 찾기)
      let contactRollback: { contactId: string; previousStatus: string | null } | null = null;
      if (doc.generatedData && typeof doc.generatedData === 'object') {
        const contactId = (doc.generatedData as { contactId?: string }).contactId;
        if (contactId) {
          const previousContact = await tx.contact.findUnique({
            where: { id: contactId },
            select: { status: true },
          });
          await tx.contact.update({
            where: { id: contactId },
            data: { status: 'CONTRACTED_SIGNED' }
          });
          contactRollback = { contactId, previousStatus: previousContact?.status ?? null };
        }
      }

      const productName = typeof existingData.productName === 'string' ? existingData.productName : '크루즈 상품';

      return {
        signedAt,
        organizationId: current.organizationId,
        productName,
        previousStatus: current.status,
        previousApprovedAt: current.approvedAt,
        previousGeneratedData: current.generatedData as Prisma.InputJsonValue,
        contactRollback,
      };
    });

    if (result === 'NOT_FOUND') {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 링크입니다' },
        { status: 401 },
      );
    }
    if (result === null) {
      return NextResponse.json(
        { ok: false, message: '이미 서명된 계약서입니다' },
        { status: 409 },
      );
    }
    if (result === 'INVALID_TOKEN') {
      return NextResponse.json(
        { ok: false, message: '유효하지 않은 링크입니다' },
        { status: 401 },
      );
    }
    if (result === 'EXPIRED') {
      return NextResponse.json(
        { ok: false, message: '링크가 만료되었습니다 (7일 경과)' },
        { status: 410 },
      );
    }

    const {
      signedAt,
      organizationId,
      productName: productNameFromTx,
      previousStatus,
      previousApprovedAt,
      previousGeneratedData,
      contactRollback,
    } = result;

    logger.log('[PurchaseContractSign] 서명 완료', {
      docId,
      signerName,
      companions: companions.length,
      organizationId,
    });

    // Google Drive 계약서 저장 (재시도 로직 포함)
    try {
      await retryWithExponentialBackoff(
        async () => {
        // 최신 generatedData로 계약서 HTML 생성
        const freshDoc = await prisma.salesDocument.findUnique({
          where: { id: docId },
          select: { generatedData: true },
        });
        if (!freshDoc) {
          logger.error('[PurchaseContractSign] Drive 저장용 문서 없음', { docId });
          throw new Error('Document not found for Drive save');
        }
        const data = freshDoc.generatedData as Record<string, unknown>;

        const productName = typeof data.productName === 'string' ? data.productName : '크루즈 상품';
        const amount = data.amount != null ? Number(data.amount).toLocaleString() + '원' : '-';
        const departureDate = typeof data.departureDate === 'string' ? data.departureDate : '-';
        const nights = data.nights != null ? `${data.nights}박` : '-';
        const paymentMethod = typeof data.paymentMethod === 'string' ? data.paymentMethod : '-';
        const companionRows = (companions as { name: string; birthDate: string; relation: string; phone: string }[])
          .map((c, i) => `<tr><td>${i + 1}</td><td>${escHtml(c.name)}</td><td>${escHtml(c.birthDate)}</td><td>${escHtml(c.relation)}</td><td>${escHtml(c.phone)}</td></tr>`)
          .join('');

        const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>구매계약서 - ${escHtml(signerName)}</title>
  <style>
    body { font-family: 'Malgun Gothic', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; color: #222; }
    h1 { color: #1a2e4a; border-bottom: 2px solid #1a2e4a; padding-bottom: 12px; }
    h2 { color: #1a2e4a; margin-top: 32px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #ddd; padding: 10px 14px; text-align: left; }
    th { background: #f0f4f8; color: #1a2e4a; width: 30%; }
    .signature-box { border: 1px solid #ddd; padding: 16px; margin-top: 24px; text-align: center; }
    .footer { margin-top: 40px; font-size: 12px; color: #888; text-align: center; }
  </style>
</head>
<body>
  <h1>구매계약서</h1>
  <table>
    <tr><th>문서번호</th><td>${escHtml(docId)}</td></tr>
    <tr><th>상품명</th><td>${escHtml(productName)}</td></tr>
    <tr><th>고객명</th><td>${escHtml(signerName)}</td></tr>
    <tr><th>결제금액</th><td>${escHtml(amount)}</td></tr>
    <tr><th>출발일</th><td>${escHtml(departureDate)}</td></tr>
    <tr><th>일수</th><td>${escHtml(nights)}</td></tr>
    <tr><th>결제수단</th><td>${escHtml(paymentMethod)}</td></tr>
    <tr><th>서명일시</th><td>${escHtml(signedAt)}</td></tr>
  </table>
  ${companionRows ? `<h2>동행자 정보</h2>
  <table>
    <thead><tr><th>#</th><th>이름</th><th>생년월일</th><th>관계</th><th>연락처</th></tr></thead>
    <tbody>${companionRows}</tbody>
  </table>` : ''}
  <div class="signature-box">
    <p><strong>서명자:</strong> ${escHtml(signerName)}</p>
    <img src="${typeof data.signatureImage === 'string' ? data.signatureImage : ''}" alt="전자서명" style="max-width:300px;border:1px solid #eee;margin-top:8px;" />
  </div>
  <div class="footer">이 문서는 마비즈 CRM에서 자동 생성된 전자 계약서입니다. 생성일시: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</div>
</body>
</html>`;

        const customerPhone = typeof data.buyerTel === 'string' ? data.buyerTel : '';
        const driveResult = await saveContractToDrive(
          docId,
          htmlContent,
          signerName,
          organizationId,
          customerPhone
        );

        if (driveResult.ok && driveResult.driveFileId) {
          // SalesDocument generatedData에 driveFileId, driveUrl 저장
          await prisma.salesDocument.update({
            where: { id: docId },
            data: {
              generatedData: {
                ...data,
                driveFileId: driveResult.driveFileId,
                driveUrl: driveResult.driveUrl,
              },
            },
          });
          logger.log('[PurchaseContractSign] Drive 저장 완료', {
            docId,
            driveFileId: driveResult.driveFileId,
          });
        } else {
          throw new Error(`Drive save failed: ${driveResult.error}`);
        }
        },
        { maxRetries: 3, baseDelayMs: 1000 }
      );
    } catch (driveErr) {
      logger.error('[Critical] Contract Drive 저장 최종 실패 — 서명 상태 롤백', {
        docId,
        error: driveErr instanceof Error ? driveErr.message : String(driveErr),
      });

      await prisma.$transaction(async (tx) => {
        await tx.salesDocument.update({
          where: { id: docId },
          data: {
            status: previousStatus,
            approvedAt: previousApprovedAt,
            generatedData: previousGeneratedData,
          },
        });
        if (contactRollback && contactRollback.previousStatus) {
          await tx.contact.update({
            where: { id: contactRollback.contactId },
            data: { status: contactRollback.previousStatus },
          });
        }
      });

      return NextResponse.json(
        {
          ok: false,
          message: '계약서 저장에 실패했습니다. 잠시 후 다시 서명해 주세요.',
          code: 'DRIVE_SAVE_FAILED',
        },
        { status: 503 },
      );
    }

    // 에이전트 이메일 알림 (Drive 저장 성공 이후 fire-and-forget)
    void (async () => {
      try {
        const productName = productNameFromTx;

        const admin = await prisma.organizationMember.findFirst({
          where: {
            organizationId,
            role: { in: ['OWNER', 'GLOBAL_ADMIN'] },
            email: { not: null },
            isActive: true,
          },
          select: { email: true },
        });

        const adminEmail = admin?.email ?? null;
        if (!adminEmail) return;

        await sendFunnelEmail({
          organizationId,
          to:      adminEmail,
          subject: `[서명완료] ${escHtml(productName)} 계약서 서명이 완료되었습니다`,
          html: `<div style="font-family:sans-serif;line-height:1.8;max-width:600px;margin:0 auto;padding:32px 24px">
<h2 style="color:#1a1a2e;margin:0 0 16px">구매계약서 서명 완료 알림</h2>
<p>고객이 구매계약서에 서명을 완료했습니다.</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0">
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666;width:40%">서명자</td><td style="padding:10px 14px;font-weight:600">${escHtml(signerName)}</td></tr>
  <tr><td style="padding:10px 14px;color:#666">상품명</td><td style="padding:10px 14px">${escHtml(productName)}</td></tr>
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666">서명일시</td><td style="padding:10px 14px">${escHtml(signedAt)}</td></tr>
  <tr><td style="padding:10px 14px;color:#666">동행자 수</td><td style="padding:10px 14px">${companions.length}명</td></tr>
  <tr style="background:#f8f9fa"><td style="padding:10px 14px;color:#666">문서번호</td><td style="padding:10px 14px;font-size:12px;color:#888">${escHtml(docId)}</td></tr>
</table>
<p style="color:#666;font-size:14px">CRM에서 계약서를 확인하세요.</p>
</div>`,
          channel: 'MANUAL',
        });
      } catch (emailErr) {
        logger.error('[PurchaseContractSign] 에이전트 이메일 발송 실패', {
          error: emailErr instanceof Error ? emailErr.message : String(emailErr),
        });
      }
    })();

    // 구매계약서 PDF 생성 + 이메일 발송 (fire-and-forget)
    void (async () => {
      try {
        const freshDoc = await prisma.salesDocument.findUnique({
          where:  { id: docId },
          select: { generatedData: true },
        });
        if (!freshDoc) return;

        const d = freshDoc.generatedData as Record<string, unknown>;
        const signedAtStr = new Date(signedAt).toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });

        const pdfBuffer = await generatePurchaseContractPdf({
          docId,
          buyerName:          typeof d.buyerName    === 'string' ? d.buyerName    : signerName,
          buyerTel:           typeof d.buyerTel     === 'string' ? d.buyerTel     : '',
          productName:        typeof d.productName  === 'string' ? d.productName  : '크루즈 상품',
          amount:             typeof d.amount       === 'number' ? d.amount       : Number(d.amount ?? 0),
          departureDate:      typeof d.departureDate === 'string' ? d.departureDate : null,
          nights:             typeof d.nights       === 'number' ? d.nights       : null,
          paymentMethod:      typeof d.paymentMethod === 'string' ? d.paymentMethod : '-',
          paidAt:             typeof d.paidAt       === 'string' ? d.paidAt       : null,
          cancellationPolicy: Array.isArray(d.cancellationPolicy) ? (d.cancellationPolicy as string[]) : [],
          specialTerms:       typeof d.specialTerms === 'string' ? d.specialTerms : null,
          companions,
          signatureImage:     typeof d.signatureImage === 'string' ? d.signatureImage : signatureImage,
          signedAt:           signedAtStr,
          signedByName:       signerName,
          companyName:        typeof d.companyName === 'string' ? d.companyName : '크루즈닷',
        });

        const productName = typeof d.productName === 'string' ? d.productName : '크루즈 상품';
        const filename = `구매계약서_${signerName}_${signedAt.slice(0, 10)}.pdf`;
        const subject  = `[크루즈닷] ${signerName}님 구매계약서 (${signedAt.slice(0, 10)})`;

        const html = `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
            <h2 style="color:#1a3a6b;margin-bottom:16px">📋 크루즈 여행 구매계약서</h2>
            <p>안녕하세요. 크루즈닷입니다.</p>
            <p>아래 계약이 전자서명으로 완료되었습니다. PDF가 첨부되어 있습니다.</p>
            <table style="border-collapse:collapse;width:100%;margin:20px 0;font-size:14px">
              <tr style="background:#f5f7fa"><td style="padding:10px;border:1px solid #e5e7eb;font-weight:600;width:120px">고객명</td><td style="padding:10px;border:1px solid #e5e7eb">${escHtml(signerName)}</td></tr>
              <tr><td style="padding:10px;border:1px solid #e5e7eb;font-weight:600">상품명</td><td style="padding:10px;border:1px solid #e5e7eb">${escHtml(productName)}</td></tr>
              <tr style="background:#f5f7fa"><td style="padding:10px;border:1px solid #e5e7eb;font-weight:600">서명 일시</td><td style="padding:10px;border:1px solid #e5e7eb">${signedAtStr}</td></tr>
              <tr><td style="padding:10px;border:1px solid #e5e7eb;font-weight:600">동행자</td><td style="padding:10px;border:1px solid #e5e7eb">${companions.length}명</td></tr>
            </table>
            <p style="font-size:12px;color:#888;border-top:1px solid #eee;padding-top:12px">
              본 계약서는 전자서명법에 따라 법적 효력을 가집니다.
            </p>
          </div>`;

        const attachment = [{ filename, content: pdfBuffer, contentType: 'application/pdf' }];

        // 발송 1: 회사 보관 — 실패해도 발송 2에 영향 없음
        try {
          await sendSystemEmail({
            to:          COMPANY_EMAIL,
            subject:     `[회사보관] ${subject}`,
            html,
            attachments: attachment,
          });
        } catch (e1) {
          logger.error('[PurchaseContractSign] 회사 보관 이메일 발송 실패', {
            docId, error: e1 instanceof Error ? e1.message : String(e1),
          });
        }

        // 발송 2: 구매자 본인 이메일 — 회사 발송 실패 여부와 독립
        const buyerEmail = typeof d.buyerEmail === 'string' ? d.buyerEmail : null;
        if (buyerEmail) {
          try {
            await sendSystemEmail({
              to:          buyerEmail,
              subject:     `[본인보관] ${subject}`,
              html:        html.replace('PDF가 첨부되어 있습니다.', '본인 보관용 계약서 PDF가 첨부되어 있습니다. 안전한 곳에 보관해 주세요.'),
              attachments: attachment,
            });
          } catch (e2) {
            logger.error('[PurchaseContractSign] 구매자 본인 이메일 발송 실패', {
              docId, error: e2 instanceof Error ? e2.message : String(e2),
            });
          }
        }

        logger.log('[PurchaseContractSign] PDF 이메일 발송 완료', { docId, buyerEmail });
      } catch (pdfErr) {
        logger.error('[PurchaseContractSign] PDF 발송 실패', {
          docId,
          error: pdfErr instanceof Error ? pdfErr.message : String(pdfErr),
        });
      }
    })();

    // POST 응답에 signedAt 포함
    return NextResponse.json({ ok: true, message: '서명이 완료되었습니다', signedAt });
  } catch (e) {
    logger.error('[PurchaseContractSign POST] 오류', {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
