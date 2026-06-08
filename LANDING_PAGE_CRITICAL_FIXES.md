# 랜딩페이지 긴급 작업지시서 (2026-06-08)

**작성자**: Claude Code AI Agent  
**우선순위**: P0(치명) 5건 → P1(높음) 7건 → P2(중간) 15건  
**총 추정 시간**: 120시간 (3주 풀타임)  
**긴급 실행**: 24시간 내 P0-2건 완료 필수

---

## 📊 이슈 분포도

| 우선순위 | 심각도 | 건수 | 위험도 | 1주일 소요시간 |
|--------|-------|------|--------|--------------|
| **P0** | 치명적 | 5 | 🔴 극심 | 6-8시간 |
| **P1** | 높음 | 7 | 🟠 높음 | 8-10시간 |
| **P2** | 중간 | 15 | 🟡 중간 | 12-16시간 |
| **P3** | 낮음 | 8 | 🟢 낮음 | 4-6시간 |

---

## 🔴 P0 치명적 결함 (24시간 내 완료)

### P0-1: 그룹 자동 배정 미구현 (Contact Lens Classification 실패)

**문제**:
- 랜딩페이지에 `groupId` 설정되어 있으나, 등록자(CrmLandingRegistration)가 자동으로 ContactGroup에 추가되지 않음
- Contact는 생성되나, Contact.ContactGroupMember 레코드 미생성
- 그룹 기반 퍼널/문자/분석이 작동하지 않음

**근본원인**:
1. CrmLandingRegistration 모델에 `groupId` 필드 없음 (schema.prisma line 874-892)
2. /api/public/landing-register 엔드포인트에서 Contact 생성 후 ContactGroupMember.create() 호출 안 함 (route.ts line 152-194)
3. CrmLandingPage.groupId → Contact.groupId 연결 로직 없음

**수정 방법**:

#### Step 1: Schema 수정 (prisma/schema.prisma)

```prisma
model CrmLandingRegistration {
  id            String         @id @default(cuid())
  landingPageId String
  name          String
  phone         String
  email         String?
  
  // ✅ NEW: Group Assignment
  groupId       String?        // Landing Page가 지정한 그룹
  contactId     String?        // Contact 생성 후 저장 (추적용)
  
  utmSource     String?
  utmMedium     String?
  utmCampaign   String?
  metadata      Json?
  funnelStarted Boolean        @default(false)
  createdAt     DateTime       @default(now())
  
  landingPage   CrmLandingPage @relation(fields: [landingPageId], references: [id], onDelete: Cascade)
  group         ContactGroup?  @relation(fields: [groupId], references: [id], onDelete: SetNull) // ✅ NEW
  contact       Contact?       @relation(fields: [contactId], references: [id], onDelete: SetNull) // ✅ NEW

  @@unique([landingPageId, phone])
  @@index([landingPageId])
  @@index([groupId])  // ✅ NEW: Group 기반 필터링 성능
  @@index([contactId])  // ✅ NEW: Contact 추적 성능
  @@map("CrmLandingRegistration")
}

model ContactGroup {
  // ... 기존 필드
  registrations CrmLandingRegistration[]  // ✅ NEW: Relation
}

model Contact {
  // ... 기존 필드
  registrations CrmLandingRegistration[]  // ✅ NEW: Relation
}
```

마이그레이션 생성:
```bash
npx prisma migrate dev --name add_group_and_contact_to_landing_registration
```

#### Step 2: 백엔드 수정 (/api/public/landing-register/route.ts)

**기존 코드 (line 152-194)**:
```typescript
// ❌ 기존: Contact만 생성, Group 배정 없음
const contact = await prisma.contact.upsert({
  where: { phone: normalizedPhone },
  update: { updatedAt: new Date() },
  create: { ... }
});
```

**수정 후 (Prisma Transaction 사용)**:
```typescript
// ✅ 수정: Transaction으로 Contact + GroupMember 원자성 보장
const { contact, groupMember } = await prisma.$transaction(async (tx) => {
  // 1. Landing Page 조회 (groupId 포함)
  const landingPage = await tx.crmLandingPage.findUniqueOrThrow({
    where: { id: landingPageId },
    select: { groupId: true, organizationId: true }
  });

  // 2. Contact Upsert
  const contact = await tx.contact.upsert({
    where: { phone: normalizedPhone },
    update: {
      email: email || undefined,
      source: source || undefined,
      adminMemo: `Landing: ${landingPageId} | ${new Date().toISOString()}`,
      updatedAt: new Date()
    },
    create: {
      organizationId,
      phone: normalizedPhone,
      email: email || undefined,
      source: source || undefined,
      adminMemo: `Landing: ${landingPageId} | ${new Date().toISOString()}`,
      status: 'INQUIRY'
    }
  });

  // 3. ContactGroupMember 추가 (Landing Page의 groupId가 있을 때)
  let groupMember = null;
  if (landingPage.groupId) {
    groupMember = await tx.contactGroupMember.upsert({
      where: {
        groupId_contactId: {
          groupId: landingPage.groupId,
          contactId: contact.id
        }
      },
      update: { addedAt: new Date() },
      create: {
        groupId: landingPage.groupId,
        contactId: contact.id,
        addedAt: new Date()
      }
    });
  }

  // 4. Registration 레코드 생성 + groupId 저장
  const registration = await tx.crmLandingRegistration.create({
    data: {
      landingPageId,
      name: name.trim(),
      phone: normalizedPhone,
      email: email?.toLowerCase().trim() || null,
      groupId: landingPage.groupId,  // ✅ Landing Page의 그룹 저장
      contactId: contact.id,  // ✅ Contact ID 추적
      utmSource: params.utm_source || null,
      utmMedium: params.utm_medium || null,
      utmCampaign: params.utm_campaign || null,
      metadata: {
        ipAddress: ipAddress,
        userAgent: userAgent,
        landingPageUrl: landingPageUrl,
        formValues: { name, phone, email, ...formData }
      }
    }
  });

  return { contact, groupMember, registration };
}, {
  // Transaction 설정
  isolationLevel: 'Serializable',  // Race condition 완전 차단
  timeout: 5000
});

// 5. ContactLensClassification 트리거 (별도 처리 가능)
// 성공 응답
return NextResponse.json({
  contactId: contact.id,
  registrationId: registration.id,
  groupAssigned: !!groupMember,
  groupId: landingPage.groupId,
  message: '등록 완료'
}, { status: 201 });
```

#### Step 3: 프론트엔드 피드백 (src/components/landing/CTASection.tsx)

```typescript
// 성공 메시지에 그룹 정보 포함
const response = await fetch('/api/public/landing-register', {
  method: 'POST',
  body: JSON.stringify(formData)
});

const data = await response.json();
if (response.ok) {
  // ✅ 그룹 배정 확인
  setSubmitStatus('success');
  setCompletionMessage(
    data.groupAssigned 
      ? `그룹에 추가되었습니다: ${data.groupId}` 
      : '등록되었습니다'
  );
}
```

**테스트 방법**:
```bash
# 1. 마이그레이션 적용
npx prisma migrate dev

# 2. Landing Page 생성 (groupId 포함)
POST /api/landing-pages
{
  "title": "테스트",
  "groupId": "grp_xxx",
  "...": "..."
}

# 3. 등록 테스트
POST /api/public/landing-register
{
  "landingPageId": "page_xxx",
  "name": "김철수",
  "phone": "010-1234-5678"
}

# 4. DB 확인
SELECT * FROM "CrmLandingRegistration" WHERE id = '...';
SELECT * FROM "ContactGroupMember" WHERE contactId = '...';

# 결과: groupId가 저장되고, ContactGroupMember가 생성되어야 함
```

**영향 범위**:
- CrmLandingRegistration: groupId 추가
- ContactGroup: registrations 관계 추가
- Contact: registrations 관계 추가
- DB: 마이그레이션 (다운타임 ~10초)

**Rollback 계획**:
```bash
npx prisma migrate resolve --rolled-back add_group_and_contact_to_landing_registration
npx prisma migrate deploy
```

---

### P0-2: 숏링크 코드 충돌 처리 일관성 부족 (Race Condition)

**문제**:
- CrmLandingPage: generateUniqueShortlink() 사용 (3회 재시도)
- B2BLandingPage: 직접 nanoid() (10회 재시도)
- 일관성 없는 충돌 처리로 B2B는 10회 재시도 중 timeout 위험

**근본원인**:
1. landing-page-utils.ts의 generateUniqueShortlink()는 3회만 재시도
2. /api/b2b-landing/route.ts는 inline nanoid()로 10회 재시도
3. ShortLink.code 충돌 시 재시도 전략 상이 → 동작 예측 불가

**수정 방법**:

#### Step 1: 통일된 Shortlink 생성 함수 작성

**src/lib/shortlink-generator.ts** (신규 생성):
```typescript
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/db';

/**
 * 통일된 숏링크 코드 생성 함수
 * - exponential backoff 전략 (즉시 실패로 DB 부하 최소화)
 * - 최대 3회 재시도 (충돌 확률 < 0.0001%)
 * - 실패 시 명확한 에러 메시지
 */
export async function generateUniqueShortlink(
  organizationId: string,
  options: {
    maxRetries?: number;
    codeLength?: number;
  } = {}
): Promise<string> {
  const maxRetries = options.maxRetries ?? 3;
  const codeLength = options.codeLength ?? 8;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const code = nanoid(codeLength);

    // 이미 존재하는지 확인
    const existing = await prisma.shortLink.findUnique({
      where: { code },
      select: { id: true }
    });

    if (!existing) {
      return code;  // ✅ 성공
    }

    // Exponential backoff: 10ms, 20ms, 40ms, 80ms
    if (attempt < maxRetries) {
      const backoffMs = 10 * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  // 모든 재시도 실패
  throw new Error(
    `[ShortlinkGenerator] Failed to generate unique code after ${maxRetries + 1} attempts. ` +
    `Collision probability exceeded. organizationId=${organizationId}`
  );
}

/**
 * Batch 모드: 여러 코드를 한 번에 검증
 * (예: bulk landing page 생성 시)
 */
export async function generateUniqueShotlinks(
  organizationId: string,
  count: number,
  options: { codeLength?: number } = {}
): Promise<string[]> {
  const codes: string[] = [];
  const codeLength = options.codeLength ?? 8;

  for (let i = 0; i < count; i++) {
    try {
      const code = await generateUniqueShortlink(organizationId, { codeLength });
      codes.push(code);
    } catch (error) {
      throw new Error(
        `[ShortlinkGenerator] Failed at batch index ${i}/${count}: ${error.message}`
      );
    }
  }

  return codes;
}
```

#### Step 2: CrmLandingPage 엔드포인트 수정

**src/app/api/landing-pages/route.ts** (line 125 수정):
```typescript
import { generateUniqueShortlink } from '@/lib/shortlink-generator';

export async function POST(req: Request) {
  // ...
  
  // ✅ 수정: 통일된 함수 사용 + Transaction 래핑
  const shortlinkCode = await generateUniqueShortlink(organizationId);

  const result = await prisma.$transaction(
    async (tx) => {
      // 1. CrmLandingPage 생성
      const landingPage = await tx.crmLandingPage.create({
        data: {
          organizationId,
          title,
          slug,
          shortlink: shortlinkCode,  // ✅ 생성된 코드 저장
          createdByUserId: userId,
          // ... 기타 필드
        }
      });

      // 2. ShortLink 레코드 생성 (동일 Transaction 내에서 원자성 보장)
      const shortLink = await tx.shortLink.create({
        data: {
          organizationId,
          createdBy: userId,
          code: shortlinkCode,
          targetUrl: `/landing/${landingPage.id}`,
          title: landingPage.title,
          category: 'LANDING_PAGE'
        }
      });

      return { landingPage, shortLink };
    },
    {
      isolationLevel: 'Serializable',  // ✅ 중요: Race condition 차단
      timeout: 5000
    }
  );

  return NextResponse.json(result, { status: 201 });
}
```

#### Step 3: B2BLandingPage 엔드포인트 수정

**src/app/api/b2b-landing/route.ts** (line 67-77 수정):
```typescript
import { generateUniqueShortlink } from '@/lib/shortlink-generator';

export async function POST(req: Request) {
  // ...
  
  // ❌ 수정 전:
  // let shortlinkCode = '';
  // for (let i = 0; i < 10; i++) {
  //   const code = nanoid();
  //   const exists = await prisma.shortLink.findUnique({ where: { code } });
  //   if (!exists) {
  //     shortlinkCode = code;
  //     break;
  //   }
  // }

  // ✅ 수정 후: 통일된 함수 사용
  const shortlinkCode = await generateUniqueShortlink(organizationId);

  const result = await prisma.$transaction(
    async (tx) => {
      // ... B2B 페이지 생성
      const b2bPage = await tx.b2bLandingPage.create({
        data: {
          shortlink: shortlinkCode,
          // ... 기타 필드
        }
      });

      const shortLink = await tx.shortLink.create({
        data: {
          code: shortlinkCode,
          targetUrl: `/b2b-landing/${b2bPage.id}`,
          category: 'B2B_LANDING'
        }
      });

      return { b2bPage, shortLink };
    },
    { isolationLevel: 'Serializable', timeout: 5000 }
  );

  return NextResponse.json(result);
}
```

#### Step 4: 숏링크 조회 로직 수정 (Orphaned 코드 방지)

**src/app/api/p/[code]/route.ts** (신규 또는 기존 수정):
```typescript
export async function GET(
  req: Request,
  { params }: { params: { code: string } }
) {
  const { code } = params;

  // ✅ ShortLink 조회
  const shortLink = await prisma.shortLink.findUnique({
    where: { code },
    select: {
      id: true,
      targetUrl: true,
      organizationId: true,
      isActive: true,
      clicks: { select: { id: true } }
    }
  });

  if (!shortLink) {
    // ❌ Orphaned code 감지
    console.error(`[ShortLink] Orphaned code detected: ${code}`);
    return NextResponse.json(
      {
        error: 'Link not found',
        code: 404,
        hint: 'This shortlink code exists in CrmLandingPage but not in ShortLink table'
      },
      { status: 404 }
    );
  }

  if (!shortLink.isActive) {
    return NextResponse.json(
      { error: 'This link has been deactivated' },
      { status: 410 }
    );
  }

  // ✅ Click 기록 (비동기로 처리해서 성능 영향 최소화)
  prisma.shortLinkClick.create({
    data: {
      linkId: shortLink.id,
      userAgent: req.headers.get('user-agent') || 'unknown',
      clickedAt: new Date()
    }
  }).catch(err => {
    console.error(`[ShortLink] Click logging failed: ${err.message}`);
  });

  // ✅ Redirect
  return NextResponse.redirect(
    new URL(shortLink.targetUrl, process.env.NEXT_PUBLIC_BASE_URL || 'https://mabizcruisedot.com'),
    { status: 307 }
  );
}
```

**테스트 방법**:
```bash
# 1. 동일 organizationId에서 100개 shortlink 동시 생성
for i in {1..100}; do
  curl -X POST /api/landing-pages \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"title\": \"Test $i\"}"
done

# 2. 충돌 여부 확인
SELECT COUNT(*) FROM "ShortLink" WHERE code IS NOT NULL;
SELECT COUNT(DISTINCT code) FROM "ShortLink";
# 결과: 두 값이 같아야 함 (중복 없음)

# 3. Orphaned code 검증
SELECT sl.code FROM "ShortLink" sl
LEFT JOIN "CrmLandingPage" clp ON clp.shortlink = sl.code
WHERE clp.shortlink IS NULL AND sl.category = 'LANDING_PAGE';
# 결과: 0 rows

# 4. 조회 성능 테스트
ab -n 1000 -c 10 "https://mabizcruisedot.com/p/abc12345"
# 결과: ~100ms/req 이상
```

**영향 범위**:
- ShortLink.code 생성 로직 통일
- CrmLandingPage + B2BLandingPage 모두 영향
- 기존 데이터: no impact (이전 코드는 이미 unique)
- DB: no new columns

**Rollback 계획**:
기존 로직으로 복구 가능 (생성 로직만 변경)

---

### P0-3: 폼 제출 실패 시 사용자 입력 데이터 손실

**문제**:
- handleSubmit에서 catch(error) 발생 시 submitStatus='error'로 5초 후 'idle' 리셋
- 사용자는 에러 메시지를 볼 수 없음 (UI 미구현)
- 데이터 손실 우려

**근본원인**:
1. CTASection.tsx line 53-55: setSubmitStatus('error') 후 5초 타이머로 자동 리셋
2. Line 146-157: success 상태만 렌더링, error 상태는 무시
3. API 응답 에러 메시지 파싱 없음

**수정 방법**:

#### Step 1: FormState 타입 정의

**src/lib/types/form.ts** (신규):
```typescript
export type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

export interface FormErrorDetail {
  field?: string;
  message: string;
  code?: string;
  timestamp?: Date;
}

export interface FormSubmitState {
  status: SubmitStatus;
  error?: FormErrorDetail;
  successMessage?: string;
  retryCount?: number;
}
```

#### Step 2: CTASection 컴포넌트 수정

**src/components/landing/CTASection.tsx**:

```typescript
'use client';

import { useState, useRef } from 'react';
import { FormSubmitState, FormErrorDetail } from '@/lib/types/form';

export default function CTASection() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    message: ''
  });
  
  // ✅ 개선된 상태 관리
  const [submitState, setSubmitState] = useState<FormSubmitState>({
    status: 'idle'
  });
  
  const submitAttemptRef = useRef(0);
  const submittedDataRef = useRef<typeof formData | null>(null);

  // ❌ 제거: 자동 타이머로 error 상태 리셋
  // useEffect(() => {
  //   if (submitState.status === 'error') {
  //     const timer = setTimeout(() => {
  //       setSubmitState({ status: 'idle' });
  //     }, 5000);
  //     return () => clearTimeout(timer);
  //   }
  // }, [submitState.status]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // ✅ 입력 중에 에러 메시지 자동 해제
    if (submitState.status === 'error') {
      setSubmitState({ status: 'idle' });
    }
  };

  const parseErrorResponse = (response: Response, data: any): FormErrorDetail => {
    // API 에러 응답 파싱
    switch (response.status) {
      case 400:
        // 검증 에러
        return {
          field: data?.field || 'form',
          message: data?.message || '입력값을 확인해주세요',
          code: data?.code || 'VALIDATION_ERROR'
        };
      case 409:
        // 중복 등록
        return {
          field: 'phone',
          message: '이미 등록되어 있습니다',
          code: 'DUPLICATE_REGISTRATION'
        };
      case 429:
        // Rate limit
        return {
          message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요',
          code: 'RATE_LIMITED'
        };
      case 500:
      case 502:
      case 503:
        return {
          message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요',
          code: 'SERVER_ERROR'
        };
      default:
        return {
          message: data?.message || '오류가 발생했습니다',
          code: data?.code || 'UNKNOWN_ERROR'
        };
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // ✅ 중복 제출 방지
    if (submitState.status === 'loading') {
      console.warn('[Form] Duplicate submit attempt detected');
      return;
    }

    // ✅ 폼 검증
    if (!formData.name.trim() || !formData.phone.trim()) {
      setSubmitState({
        status: 'error',
        error: {
          message: '이름과 전화번호는 필수입니다',
          code: 'VALIDATION_ERROR'
        }
      });
      return;
    }

    // ✅ 제출 시작
    setSubmitState({ status: 'loading' });
    submittedDataRef.current = { ...formData };
    submitAttemptRef.current = 0;

    try {
      const response = await fetch('/api/landing/contact-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        const error = parseErrorResponse(response, data);
        setSubmitState({
          status: 'error',
          error
        });
        
        // ✅ Sentry 에러 로깅
        if (typeof window !== 'undefined' && window.Sentry) {
          window.Sentry.captureException(
            new Error(`Form submission failed: ${error.code}`),
            {
              contexts: {
                form: {
                  status: response.status,
                  code: error.code,
                  field: error.field
                }
              }
            }
          );
        }
        
        return;
      }

      // ✅ 성공
      setSubmitState({
        status: 'success',
        successMessage: '등록이 완료되었습니다'
      });

      // ✅ 폼 초기화 (3초 후)
      setTimeout(() => {
        setFormData({ name: '', phone: '', email: '', message: '' });
        // 성공 상태는 유지 (사용자가 명시적으로 확인할 때까지)
      }, 3000);

    } catch (error) {
      console.error('[Form] Network error:', error);
      
      setSubmitState({
        status: 'error',
        error: {
          message: '네트워크 연결을 확인해주세요',
          code: 'NETWORK_ERROR'
        }
      });

      if (typeof window !== 'undefined' && window.Sentry) {
        window.Sentry.captureException(error);
      }
    }
  };

  // ✅ UI: 에러 상태 렌더링
  const renderErrorMessage = () => {
    if (submitState.status !== 'error' || !submitState.error) return null;

    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">
              {submitState.error.field ? `${submitState.error.field} 오류` : '오류 발생'}
            </h3>
            <p className="text-sm text-red-700 mt-1">{submitState.error.message}</p>
            <p className="text-xs text-red-600 mt-2 opacity-75">
              코드: {submitState.error.code}
            </p>
          </div>
          <button
            onClick={() => setSubmitState({ status: 'idle' })}
            className="text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>

        {/* ✅ 재시도 버튼 */}
        {submitState.error.code === 'NETWORK_ERROR' && (
          <button
            onClick={() => {
              setSubmitState({ status: 'idle' });
              setTimeout(() => {
                const form = document.querySelector('form');
                if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
              }, 500);
            }}
            className="mt-3 px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
          >
            다시 시도
          </button>
        )}
      </div>
    );
  };

  // ✅ UI: 성공 메시지 (자동 제거 안 함)
  const renderSuccessMessage = () => {
    if (submitState.status !== 'success') return null;

    return (
      <div className="rounded-lg bg-green-50 border border-green-200 p-4 mb-4">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">
              {submitState.successMessage || '등록이 완료되었습니다'}
            </p>
          </div>
          <button
            onClick={() => setSubmitState({ status: 'idle' })}
            className="text-green-400 hover:text-green-600"
          >
            ✕
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="py-16 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-8">무료 상담 신청</h2>

        {renderErrorMessage()}
        {renderSuccessMessage()}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              disabled={submitState.status === 'loading' || submitState.status === 'success'}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="이름을 입력해주세요"
              required
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-1">
              전화번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              disabled={submitState.status === 'loading' || submitState.status === 'success'}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="010-1234-5678"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              이메일
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              disabled={submitState.status === 'loading' || submitState.status === 'success'}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="email@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={submitState.status === 'loading' || submitState.status === 'success'}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {submitState.status === 'loading' ? (
              <>
                <span className="inline-block animate-spin mr-2">⌛</span>
                등록 중...
              </>
            ) : submitState.status === 'success' ? (
              '등록되었습니다 ✓'
            ) : (
              '등록하기'
            )}
          </button>
        </form>
      </div>
    </section>
  );
}
```

**테스트 방법**:
```bash
# 1. 네트워크 에러 시뮬레이션
POST /api/landing/contact-signup
Content-Type: application/json

{
  "name": "",
  "phone": "010-1234-5678"
}
# 결과: "이름과 전화번호는 필수입니다" 에러 표시

# 2. 중복 등록
POST /api/landing/contact-signup (동일 데이터 2회)
# 결과: 첫 번째 성공 → 두 번째 "이미 등록되어 있습니다" 에러

# 3. 서버 에러
# 서버 500 에러 강제 유발
# 결과: "서버 오류가 발생했습니다" + 재시도 버튼 표시

# 4. 중복 제출 방지
# 폼 제출 중 "등록하기" 버튼을 빠르게 여러 번 클릭
# 결과: Contact 1개만 생성되어야 함
```

---

### P0-4: 커스텀 XSS 살충제(sanitizeHtml) 보안 감사 미필

**문제**:
- Landing page HTML을 sanitizeHtml() 사용자 정의 함수로 정제
- DOMPurify 사용 안 함 (전문가 검증 라이브러리)
- img onerror, svg onload, data-* 어트리뷰트 등 XSS 우회 가능성

**근본원인**:
1. src/app/api/landing-pages/route.ts line 143: custom sanitizeHtml()
2. 화이트리스트 없이 검은목록 기반 정제
3. 동적 속성(onclick, onload 등) 필터링 불완전

**수정 방법**:

#### Step 1: DOMPurify 설치 및 설정

```bash
npm install isomorphic-dompurify
npm install --save-dev @types/dompurify
```

#### Step 2: 안전한 sanitize 유틸리티 작성

**src/lib/sanitize.ts** (신규):
```typescript
import DOMPurify from 'isomorphic-dompurify';
import { ALLOWED_TAGS, ALLOWED_ATTR, KEEP_CONTENT } from 'dompurify';

/**
 * 랜딩페이지 HTML 정제
 * OWASP-approved whitelist 기반 sanitization
 * 
 * 허용 범위:
 * - 포맷팅: h1-h6, p, br, hr, blockquote, div, span
 * - 리스트: ul, ol, li
 * - 테이블: table, tr, td, th
 * - 임베드: img, iframe (src 검증)
 * - 스타일: a (href 검증), strong, em, u, code, pre
 * - 금지: script, style, form, input, button, embed, object, iframe (보안)
 * 
 * 허용 속성:
 * - class (정규화됨)
 * - data-* (script 제외)
 * - 스타일: width, height, alt, title, src (href 검증)
 */
export function sanitizeLandingPageHtml(
  dirtyHtml: string,
  options: {
    allowedScripts?: boolean;
    maxLength?: number;
  } = {}
): string {
  const { allowedScripts = false, maxLength = 500000 } = options;

  // ✅ 크기 제한 (메모리 폭탄 방지)
  if (dirtyHtml.length > maxLength) {
    throw new Error(
      `[Sanitize] HTML size exceeds limit: ${dirtyHtml.length} > ${maxLength}`
    );
  }

  const config = {
    ALLOWED_TAGS: [
      // 포맷팅
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr', 'blockquote', 'div', 'span',
      // 리스트
      'ul', 'ol', 'li',
      // 테이블
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
      // 링크
      'a',
      // 이미지
      'img',
      // 텍스트 형식
      'strong', 'em', 'u', 'code', 'pre', 'del', 'ins',
      // 구조
      'section', 'article', 'header', 'footer',
      // 비디오 (제한적)
      'video', 'source'
    ],

    ALLOWED_ATTR: [
      // 일반 속성
      'class', 'id', 'data-*',
      // 링크
      'href', 'target', 'rel',
      // 이미지
      'src', 'alt', 'title', 'width', 'height', 'loading',
      // 비디오
      'controls', 'width', 'height', 'preload',
      // 스타일 (기본 스타일만)
      'style'
    ],

    // ✅ 위험한 호스트 차단 (js:, data:, vbscript:)
    ALLOWED_PROTOCOLS: ['http', 'https', 'mailto', 'tel'],

    // ✅ 스타일 속성 화이트리스트
    ALLOWED_STYLES: {
      '*': {
        // CSS 속성 화이트리스트
        'color': [/.*/],
        'background-color': [/.*/],
        'font-size': [/^\d+(px|em|rem|%)$/],
        'font-weight': [/(bold|normal|\d{3})/],
        'text-align': [/(left|center|right|justify)/],
        'text-decoration': [/(none|underline|overline|line-through)/],
        'margin': [/^\d+(px|em|rem|%)$/],
        'padding': [/^\d+(px|em|rem|%)$/],
        'border': [/.*/],
        'border-radius': [/^\d+(px|em|rem|%)$/],
        'width': [/^\d+(px|em|rem|%|auto)$/],
        'height': [/^\d+(px|em|rem|%|auto)$/],
        'max-width': [/^\d+(px|em|rem|%)$/],
        'line-height': [/^(\d+|normal|inherit)$/],
        // 금지: position, z-index, visibility (안티패턴)
      }
    },

    // ✅ iframe 제한 (YouTube, Vimeo만 허용)
    ALLOW_IFRAME: true,
    ALLOWED_IFRAME_HOSTING_URLS: [
      'https://www.youtube.com',
      'https://youtu.be',
      'https://www.vimeo.com',
      'https://www.youtube-nocookie.com'
    ],

    // ✅ 사용자 정의 훅
    CUSTOM_ELEMENT_HANDLER: (element: any) => {
      // ✅ iframe src 검증
      if (element.tagName === 'IFRAME') {
        const src = element.getAttribute('src') || '';
        const isAllowedHost = ['youtube.com', 'youtu.be', 'vimeo.com'].some(
          host => src.includes(host)
        );
        if (!isAllowedHost) {
          element.removeAttribute('src');
          console.warn(`[Sanitize] Blocked iframe src: ${src}`);
        }
      }

      // ✅ img src 검증 (data: URI 차단)
      if (element.tagName === 'IMG') {
        const src = element.getAttribute('src') || '';
        if (src.startsWith('data:') || src.startsWith('javascript:')) {
          console.warn(`[Sanitize] Blocked img src: ${src}`);
          element.removeAttribute('src');
        }
      }

      return element;
    }
  };

  // ✅ DOMPurify 정제
  const cleanHtml = DOMPurify.sanitize(dirtyHtml, config);

  return cleanHtml;
}

/**
 * 스크립트 태그가 포함된 HTML을 검증 (감지 목적)
 */
export function detectMaliciousPatterns(html: string): {
  detected: boolean;
  patterns: string[];
} {
  const maliciousPatterns = [
    // XSS
    /<script[^>]*>.*?<\/script>/gi,
    /on(load|error|click|mouse\w+|focus|blur|change|submit|reset|select)\s*=/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /<iframe[^>]*>/gi,
    /<object[^>]*>/gi,
    /<embed[^>]*>/gi,
    /eval\s*\(/gi,
    /expression\s*\(/gi,
    /<img[^>]+src\s*=\s*"?data:/gi,
    // SQL Injection (HTML 내에서 미미하지만)
    /('|")(;|--|\/\*)/gi
  ];

  const detected: string[] = [];

  for (const pattern of maliciousPatterns) {
    if (pattern.test(html)) {
      detected.push(pattern.toString());
    }
  }

  return {
    detected: detected.length > 0,
    patterns: detected
  };
}

/**
 * Google Analytics 스크립트 안전 임베드
 * (GTM, GA4 등 신뢰할 수 있는 호스트만)
 */
export function sanitizeTrackingScript(
  scriptContent: string,
  allowedSources: string[] = [
    'www.googletagmanager.com',
    'www.google-analytics.com',
    'cdn.segment.com'
  ]
): string | null {
  // ✅ src 속성만 추출
  const srcMatch = scriptContent.match(/src\s*=\s*["']([^"']+)["']/);
  if (!srcMatch) return null;

  const src = srcMatch[1];

  // ✅ 허용된 호스트 확인
  const isAllowed = allowedSources.some(host => src.includes(host));
  if (!isAllowed) {
    console.warn(`[Sanitize] Blocked tracking script from: ${src}`);
    return null;
  }

  // ✅ 안전한 스크립트 태그 생성
  return `<script async src="${DOMPurify.sanitize(src)}"></script>`;
}
```

#### Step 3: API 엔드포인트 수정

**src/app/api/landing-pages/route.ts** (line 140-145 수정):

```typescript
import { sanitizeLandingPageHtml, detectMaliciousPatterns } from '@/lib/sanitize';

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { htmlContent, headerScript, ...restData } = await req.json();

  // ✅ 악성 패턴 감지
  if (htmlContent) {
    const { detected, patterns } = detectMaliciousPatterns(htmlContent);
    if (detected) {
      console.error('[API] Malicious patterns detected in htmlContent:', patterns);
      
      return NextResponse.json(
        {
          error: 'Invalid HTML content',
          message: '허용되지 않는 콘텐츠가 감지되었습니다',
          code: 'MALICIOUS_CONTENT'
        },
        { status: 400 }
      );
    }
  }

  // ✅ HTML 정제
  let sanitizedHtml = htmlContent;
  if (htmlContent) {
    try {
      sanitizedHtml = sanitizeLandingPageHtml(htmlContent);
    } catch (error) {
      return NextResponse.json(
        {
          error: 'HTML sanitization failed',
          message: error.message,
          code: 'SANITIZATION_ERROR'
        },
        { status: 400 }
      );
    }
  }

  // ✅ 헤더 스크립트 정제 (추적 스크립트만)
  let sanitizedHeaderScript = null;
  if (headerScript) {
    sanitizedHeaderScript = sanitizeTrackingScript(headerScript);
    if (!sanitizedHeaderScript) {
      return NextResponse.json(
        {
          error: 'Header script not allowed',
          message: '허용되지 않는 추적 스크립트입니다',
          code: 'SCRIPT_NOT_ALLOWED'
        },
        { status: 400 }
      );
    }
  }

  // ✅ DB 저장
  const updated = await prisma.crmLandingPage.update({
    where: { id: params.id },
    data: {
      htmlContent: sanitizedHtml,
      headerScript: sanitizedHeaderScript,
      ...restData
    }
  });

  return NextResponse.json(updated);
}
```

#### Step 4: 테스트 사례

**tests/sanitize.test.ts** (신규):
```typescript
import { sanitizeLandingPageHtml, detectMaliciousPatterns } from '@/lib/sanitize';

describe('Sanitize', () => {
  describe('detectMaliciousPatterns', () => {
    it('should detect script tag XSS', () => {
      const html = '<p>Click me!</p><script>alert("XSS")</script>';
      const result = detectMaliciousPatterns(html);
      expect(result.detected).toBe(true);
    });

    it('should detect onerror XSS', () => {
      const html = '<img src="x" onerror="alert(1)">';
      const result = detectMaliciousPatterns(html);
      expect(result.detected).toBe(true);
    });

    it('should detect data: URI XSS', () => {
      const html = '<img src="data:text/html,<script>alert(1)</script>">';
      const result = detectMaliciousPatterns(html);
      expect(result.detected).toBe(true);
    });

    it('should allow clean HTML', () => {
      const html = '<h1>Title</h1><p>Clean content</p>';
      const result = detectMaliciousPatterns(html);
      expect(result.detected).toBe(false);
    });
  });

  describe('sanitizeLandingPageHtml', () => {
    it('should remove script tags', () => {
      const html = '<p>Safe</p><script>alert("XSS")</script>';
      const result = sanitizeLandingPageHtml(html);
      expect(result).not.toContain('<script>');
      expect(result).toContain('<p>Safe</p>');
    });

    it('should remove event handlers', () => {
      const html = '<button onclick="alert(1)">Click</button>';
      const result = sanitizeLandingPageHtml(html);
      expect(result).not.toContain('onclick');
    });

    it('should preserve allowed tags', () => {
      const html = '<h1>Title</h1><p>Para</p><a href="https://example.com">Link</a>';
      const result = sanitizeLandingPageHtml(html);
      expect(result).toContain('<h1>');
      expect(result).toContain('<p>');
      expect(result).toContain('<a');
    });

    it('should allow YouTube iframe', () => {
      const html = '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>';
      const result = sanitizeLandingPageHtml(html);
      expect(result).toContain('youtube.com');
    });

    it('should block malicious iframe', () => {
      const html = '<iframe src="https://evil.com/stealer.js"></iframe>';
      const result = sanitizeLandingPageHtml(html);
      // ✅ src 제거 또는 iframe 제거
      expect(result).not.toContain('evil.com');
    });

    it('should enforce size limit', () => {
      const largeHtml = 'x'.repeat(600000);
      expect(() => {
        sanitizeLandingPageHtml(largeHtml);
      }).toThrow();
    });
  });
});
```

**테스트 실행**:
```bash
npm test -- tests/sanitize.test.ts
```

**OWASP ZAP 보안 스캔** (자동화):
```bash
# 1. Landing page에 테스트 HTML 업로드
curl -X PATCH /api/landing-pages/test-page \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"htmlContent": "<h1>Test</h1>"}'

# 2. ZAP 스캔 시작
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t "https://mabizcruisedot.com/landing/test-page"

# 결과: PASS (XSS 취약점 없음)
```

---

### P0-5: Rate Limiting 미구현 (Bot Spam + API 무차별 대입 공격)

**문제**:
- Honeypot(WO-15) 방어만 있고, 실제 IP 기반 Rate Limit 없음
- 공격자가 1초에 1000개 registration 생성 가능
- SMS/Email 큐 오버플로우 → 서비스 마비

**근본원인**:
1. /api/public/landing-register에 rate limit middleware 없음
2. Honeypot은 단순 검증 (첫 번째 방어선일 뿐)
3. 동일 IP에서 무제한 폼 제출 가능

**수정 방법**:

#### Step 1: Redis 기반 Rate Limiter 유틸리티

**src/lib/rate-limit.ts** (신규):
```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN
});

export interface RateLimitConfig {
  windowMs: number;  // 시간 창 (밀리초)
  maxRequests: number;  // 시간 창 내 최대 요청 수
  keyPrefix?: string;
}

/**
 * IP 기반 Rate Limiting
 * 
 * 설정:
 * - 1분당 10개 registration (normal user)
 * - 1시간당 100개 registration
 * - 1일당 500개 registration
 */
export async function checkRateLimit(
  identifier: string,  // IP address
  config: RateLimitConfig = {
    windowMs: 60 * 1000,  // 1분
    maxRequests: 10,
    keyPrefix: 'ratelimit'
  }
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}> {
  const key = `${config.keyPrefix}:${identifier}`;
  
  // ✅ 현재 요청 카운트 조회
  const current = await redis.incr(key);
  
  // ✅ 첫 요청일 때 TTL 설정
  if (current === 1) {
    await redis.expire(key, Math.ceil(config.windowMs / 1000));
  }

  // ✅ TTL 조회 (resetAt 계산용)
  const ttl = await redis.ttl(key);
  const resetAt = Date.now() + (ttl * 1000);

  const allowed = current <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - current);

  if (!allowed) {
    // ✅ Rate limit 초과
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: ttl
    };
  }

  return {
    allowed: true,
    remaining,
    resetAt
  };
}

/**
 * 다중 레벨 Rate Limiting
 * (1분, 1시간, 1일 동시 체크)
 */
export async function checkMultiLevelRateLimit(
  identifier: string
): Promise<{
  allowed: boolean;
  limitExceeded?: 'minute' | 'hour' | 'day';
  details: {
    minute: { allowed: boolean; remaining: number; resetAt: number };
    hour: { allowed: boolean; remaining: number; resetAt: number };
    day: { allowed: boolean; remaining: number; resetAt: number };
  };
}> {
  const [minute, hour, day] = await Promise.all([
    checkRateLimit(identifier, {
      windowMs: 60 * 1000,
      maxRequests: 10,
      keyPrefix: 'ratelimit:minute'
    }),
    checkRateLimit(identifier, {
      windowMs: 60 * 60 * 1000,
      maxRequests: 100,
      keyPrefix: 'ratelimit:hour'
    }),
    checkRateLimit(identifier, {
      windowMs: 24 * 60 * 60 * 1000,
      maxRequests: 500,
      keyPrefix: 'ratelimit:day'
    })
  ]);

  const allowed = minute.allowed && hour.allowed && day.allowed;
  let limitExceeded: 'minute' | 'hour' | 'day' | undefined;

  if (!minute.allowed) limitExceeded = 'minute';
  else if (!hour.allowed) limitExceeded = 'hour';
  else if (!day.allowed) limitExceeded = 'day';

  return {
    allowed,
    limitExceeded,
    details: {
      minute,
      hour,
      day
    }
  };
}

/**
 * IP 주소 추출 (Proxy 환경 대응)
 */
export function getClientIp(
  req: Request | {
    headers: { get(name: string): string | null };
  }
): string {
  const headerNames = [
    'x-forwarded-for',  // Vercel, CloudFlare 등
    'cf-connecting-ip',  // CloudFlare
    'x-real-ip'  // Nginx
  ];

  for (const headerName of headerNames) {
    const ip = req.headers.get?.(headerName);
    if (ip) {
      // ✅ 첫 번째 IP만 사용 (x-forwarded-for는 쉼표로 구분)
      return ip.split(',')[0].trim();
    }
  }

  // ✅ Fallback
  return 'unknown';
}
```

#### Step 2: API Route에 Rate Limit 미들웨어 추가

**src/app/api/public/landing-register/route.ts**:

```typescript
import { checkMultiLevelRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: Request) {
  // ✅ 1. 클라이언트 IP 추출
  const clientIp = getClientIp(req);

  // ✅ 2. Rate Limit 체크
  const rateLimitResult = await checkMultiLevelRateLimit(clientIp);

  if (!rateLimitResult.allowed) {
    const detail = rateLimitResult.details[rateLimitResult.limitExceeded!];
    
    console.warn(`[RateLimit] Exceeded: ${clientIp} (${rateLimitResult.limitExceeded})`);

    return NextResponse.json(
      {
        error: 'Too many requests',
        message: rateLimitResult.limitExceeded === 'minute'
          ? '요청이 너무 많습니다. 1분 후 다시 시도해주세요'
          : rateLimitResult.limitExceeded === 'hour'
            ? '요청이 많습니다. 1시간 후 다시 시도해주세요'
            : '일일 제한에 도달했습니다. 내일 다시 시도해주세요',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: detail.retryAfter,
        resetAt: detail.resetAt
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(detail.retryAfter || 60)
        }
      }
    );
  }

  // ✅ 3. Honeypot 체크 (기존 로직)
  const { honeypot, timestamp } = await req.json();
  if (honeypot || !timestamp || Date.now() - Number(timestamp) < 1500) {
    console.warn(`[Honeypot] Triggered: ${clientIp}`);
    return NextResponse.json(
      { error: 'Honeypot triggered' },
      { status: 400 }
    );
  }

  // ✅ 4. 정상 처리 (기존 로직)
  // ...
}
```

#### Step 3: 모니터링 대시보드

**src/app/api/admin/rate-limit-stats/route.ts** (신규):

```typescript
import { redis } from '@/lib/redis';

export async function GET(req: Request) {
  // ✅ 관리자만 접근 가능
  const user = await getCurrentUser();
  if (user?.role !== 'GLOBAL_ADMIN') {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 403 }
    );
  }

  // ✅ 현재 활성 IP 목록 조회
  const keys = await redis.keys('ratelimit:minute:*');
  
  const stats = [];
  for (const key of keys) {
    const ip = key.replace('ratelimit:minute:', '');
    const count = await redis.get(key);
    const ttl = await redis.ttl(key);

    stats.push({
      ip,
      requestsInLastMinute: count || 0,
      expiresAt: Date.now() + (ttl * 1000),
      isApproachingLimit: (count || 0) > 7
    });
  }

  // ✅ 요청 많은 순으로 정렬
  stats.sort((a, b) => b.requestsInLastMinute - a.requestsInLastMinute);

  return NextResponse.json({
    totalActiveIps: stats.length,
    topIps: stats.slice(0, 20),
    highActivityIps: stats.filter(s => s.isApproachingLimit)
  });
}
```

**테스트 방법**:
```bash
# 1. 정상 요청 (성공)
for i in {1..10}; do
  curl -X POST /api/public/landing-register \
    -H "X-Forwarded-For: 192.168.1.1" \
    -d '{"name": "Test", "phone": "010-1234-5678"}'
done
# 결과: 처음 10개 성공, 11번째 429 Too Many Requests

# 2. Rate Limit 상태 조회
curl /api/admin/rate-limit-stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. 1분 경과 후 재시도 (성공)
sleep 61
curl -X POST /api/public/landing-register \
  -H "X-Forwarded-For: 192.168.1.1" \
  -d '{"name": "Test", "phone": "010-1234-5679"}'
# 결과: 성공 (새로운 시간 창)

# 4. 스트레스 테스트 (100개 동시 요청)
for i in {1..100}; do
  curl -X POST /api/public/landing-register \
    -H "X-Forwarded-For: 192.168.1.$((RANDOM % 256))" \
    -d "{\"name\": \"Test$i\", \"phone\": \"010-1234-56$(printf '%02d' $i)\"}" &
done
wait
# 결과: 대부분 429, 일부만 201 (Rate limit 정상 작동)
```

---

## 🟠 P1 높음 (7건, 8-10시간)

### P1-1: 모바일 반응형 레이아웃 붕괴

**상세 작업지시서는 생략 (우선순위 낮음)**

- **문제**: sm 크기(320-640px)에서 텍스트 크기 과도 + gap 여백 부족
- **수정**: Tailwind sm: text-3xl, sm:grid-cols-1 추가
- **파일**: HeroSection, CTASection, OfferSection, UrgencySection
- **시간**: 2-3시간

---

## 📊 긴급 실행 계획 (첫 1주일)

| 우선순위 | 이슈 | 예상시간 | 담당자 | 마감일 |
|--------|------|--------|-------|-------|
| **P0-1** | Group 자동 배정 | 3-4시간 | Backend | 06-08 18:00 |
| **P0-2** | Shortlink 충돌 처리 | 2-3시간 | Backend | 06-08 20:00 |
| **P0-3** | 폼 제출 에러 UI | 2-3시간 | Frontend | 06-09 10:00 |
| **P0-4** | XSS 정제 (DOMPurify) | 4-5시간 | Security | 06-09 16:00 |
| **P0-5** | Rate Limiting | 3-4시간 | Backend | 06-10 14:00 |
| **P1-1** | 모바일 반응형 | 2-3시간 | Frontend | 06-10 20:00 |
| **Testing** | E2E + 보안 감사 | 4-6시간 | QA | 06-11 18:00 |

**총 예상 소요시간**: 20-24시간 (3일 풀타임 또는 1주 부분)

---

## ✅ 배포 체크리스트

- [ ] 마이그레이션 적용: `npx prisma migrate deploy`
- [ ] 테스트 통과: `npm test`
- [ ] Lighthouse 점수: 85점 이상
- [ ] OWASP ZAP 스캔: A 등급 이상
- [ ] Rate Limit 모니터링: 활성화
- [ ] Sentry 에러 추적: 연동 확인
- [ ] 롤백 계획: 문서화 완료
- [ ] 사용자 공지: 준비 완료

---

## 🔄 대리점 10명+ 멀티테넌트 지원 전략

### 아키텍처 설계

```
Organization (마비즈)
├── Partner 1 (구매대리점 A)
│   ├── CrmLandingPage (partnerId=P1, createdByUserId=agent1)
│   │   └── ShortLink (createdBy=agent1)
│   └── Registration
│       └── ContactGroup (partnerOwnerId=P1)
├── Partner 2 (구매대리점 B)
│   ├── CrmLandingPage (partnerId=P2, createdByUserId=agent2)
│   │   └── ShortLink (createdBy=agent2)
│   └── Registration
│       └── ContactGroup (partnerOwnerId=P2)
└── ... (최대 100+)
```

### Schema 확장 (prisma/schema.prisma)

```prisma
model CrmLandingPage {
  // ... 기존 필드
  
  // ✅ NEW: Partner & Agent Attribution
  partnerId      String?        // 파트너 ID (Multi-tenant support)
  createdByUserId String?        // 생성 에이전트 (추적용)
  
  partner        Partner?       @relation(fields: [partnerId], references: [id], onDelete: SetNull)
  
  @@index([partnerId, createdByUserId])
  @@index([organizationId, partnerId])
}

model CrmLandingRegistration {
  // ... 기존 필드
  
  // ✅ NEW: Agent Attribution
  agentId        String?        // 등록 출처 에이전트
  partnerId      String?        // 파트너 (Source tracking)
  
  agent          OrganizationMember? @relation(fields: [agentId], references: [userId], onDelete: SetNull)
  partner        Partner?       @relation(fields: [partnerId], references: [id], onDelete: SetNull)
  
  @@index([agentId])
  @@index([partnerId])
}

model ContactGroup {
  // ... 기존 필드
  
  // ✅ NEW: Owner tracking
  partnerOwnerId String?        // 소유 파트너
  
  partnerOwner   Partner?       @relation(fields: [partnerOwnerId], references: [id], onDelete: SetNull)
  
  @@index([partnerOwnerId])
}

model Partner {
  id              String         @id @default(cuid())
  organizationId  String
  name            String
  slug            String         @unique
  tier            String         @default("BRONZE")  // BRONZE|SILVER|GOLD|PLATINUM
  commissionRate  Int            @default(15)  // 15-25%
  isActive        Boolean        @default(true)
  
  // ✅ Agent 관리
  assignedAgents  OrganizationMember[] @relation("PartnerAgents")
  
  // ✅ Landing Pages & Groups
  landingPages    CrmLandingPage[]
  registrations   CrmLandingRegistration[]
  groups          ContactGroup[]
  
  organization    Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@index([organizationId])
  @@unique([organizationId, slug])
}
```

### 데이터 격리 규칙

1. **Landing Page 조회**:
   ```sql
   SELECT * FROM "CrmLandingPage"
   WHERE organizationId = $1
   AND (createdByUserId = $2 OR partnerId = $3)  -- 본인 또는 소속 파트너만
   ```

2. **Contact 그룹 조회**:
   ```sql
   SELECT * FROM "ContactGroup"
   WHERE organizationId = $1
   AND (ownerId = $2 OR partnerOwnerId = $3)  -- 본인 또는 소속 파트너만
   ```

3. **Commission 계산**:
   ```sql
   SELECT SUM(saleAmount * commissionRate / 100)
   FROM "AffiliateSale" s
   JOIN "Partner" p ON s.partnerId = p.id
   WHERE s.createdByUserId = $1
   ```

---

## 📝 최종 정리

| 항목 | 수치 |
|-----|------|
| 총 이슈 | 35건 |
| P0 (치명) | 5건 |
| P1 (높음) | 7건 |
| P2 (중간) | 15건 |
| P3 (낮음) | 8건 |
| **예상 총 소요시간** | **120시간** |
| **긴급 실행 기간** | **3일 (P0-1~5)** |
| **보안 감사** | **필수 (OWASP ZAP)** |
| **테스트 커버리지** | **80%+ 목표** |

---

**이 작업지시서는 2026-06-08 현재 상황을 바탕으로 작성되었습니다.**  
**각 단계별 완료 후 다음 이슈로 진행하시길 바랍니다.**
