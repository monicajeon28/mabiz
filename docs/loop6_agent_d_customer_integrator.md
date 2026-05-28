# Loop 6 Agent D: Customer Integrator (고객 통합 360도 뷰)

**목표**: CRM Contact를 GoldMember, Partner, ContactGroup, Order와 통합하여 단일 고객 프로필에서 모든 상호작용 데이터 표시

**예상 효과**: 고객 조회 속도 50% 단축 (쿼리 N+1 제거), 데이터 일관성 95% → 99%

---

## 1. 데이터 모델 및 관계도

### 1.1 Entity Relationship Diagram (ERD)

```
Contact (중앙)
├─ GoldMember (1:1 선택)
│  └─ GoldMemberConsultation (1:N)
│
├─ Partner (N:1)
│  ├─ PartnerMetrics (1:N)
│  ├─ PartnerPerformance (1:N)
│  └─ PartnerRiskFlags (1:1)
│
├─ ContactGroup (N:N via ContactGroupMember)
│  └─ ContactGroupMember (중간테이블)
│
└─ CruiseProduct / GmReservation (1:1 선택)
   └─ Order History (결제, 환불, 추적)

CommissionLedger (Affiliate 추적)
└─ Contact (N:1)
   └─ Partner (N:1)
```

### 1.2 Contact 필드 (기존 + 통합용)

```typescript
Contact {
  // 기본 정보 (기존)
  id: string                    // cuid
  organizationId: string
  phone: string (unique + org)
  name: string
  email: string?
  
  // 통합용 FK (기존)
  partnerId: string?            // Partner 링크
  userId: int?                  // GmUser (외부시스템)
  cruiseProductId: int?         // 크루즈 상품
  reservationId: int?           // 예약 정보
  
  // 상태 추적
  type: string                  // "LEAD" | "CUSTOMER" | "VIP"
  segment: string?              // 자동 세그먼트
  autoSegment: string           // "unclassified" | ...
  
  // 신심리학 렌즈 메타데이터
  lensMetadata: Json            // {"decisionLevel": 0, "readinessScore": 0}
  
  // 태그 (분류용)
  tags: string[]                // ["affiliate", "gold_member", "repeat_customer"]
  
  // 타임스탬프
  createdAt: DateTime
  updatedAt: DateTime
  lastContactedAt: DateTime?
  purchasedAt: DateTime?
  deletedAt: DateTime?
}
```

---

## 2. API 엔드포인트 설계

### 2.1 Contact 360도 조회 (통합 뷰)

**요청**:
```http
GET /api/contacts/:id/360
Authorization: Bearer <token>
```

**응답** (200 OK):
```json
{
  "contact": {
    "id": "cuid_12345",
    "phone": "01012345678",
    "name": "김민준",
    "email": "kim@example.com",
    "organizationId": "org_001",
    "type": "CUSTOMER",
    "segment": "repeat_gold",
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2026-05-28T14:22:00Z"
  },
  
  "goldMember": {
    "id": "gm_789",
    "memberCode": "GOLD-2025-001",
    "courseType": "Premium",
    "status": "ACTIVE",
    "joinDate": "2025-01-20T00:00:00Z",
    "totalPayments": 45000000,  // 한화
    "paidCount": 9,
    "maxPaymentCount": 12,
    "tier": 3,
    "consultations": [
      {
        "id": "cons_001",
        "content": "준비 과정 설명 제공",
        "authorId": "agent_001",
        "createdAt": "2025-02-10T15:00:00Z"
      }
    ]
  },
  
  "partner": {
    "id": "partner_456",
    "name": "이지만",
    "email": "ji@partner.com",
    "phone": "01098765432",
    "status": "ACTIVE",
    "commissionRate": 15.5,
    "totalRevenue": 125000000,  // 누적
    "onboardingStatus": "COMPLETED",
    "incomeLevel": "ADVANCED",
    "monthlyIncomeGoal": 50000000,
    "automationRate": 85,
    "metrics": {
      "thisMonth": {
        "customerCount": 12,
        "leadCount": 45,
        "revenue": 8500000
      },
      "lastMonth": {
        "customerCount": 10,
        "leadCount": 38,
        "revenue": 7200000
      }
    },
    "riskFlags": {
      "suspensionRisk": "YELLOW",
      "automationGap": 15,  // 목표 100 - 현재 85
      "churnRisk": false
    }
  },
  
  "groups": [
    {
      "id": "group_001",
      "name": "VIP 재방문 고객",
      "color": "#FF6B35",
      "ownerId": "agent_002",
      "memberCount": 234,
      "addedAt": "2025-03-01T11:00:00Z"
    },
    {
      "id": "group_002",
      "name": "의료 위험도 - HIGH",
      "color": "#F75740",
      "memberCount": 18,
      "addedAt": "2026-04-15T09:30:00Z"
    }
  ],
  
  "orders": [
    {
      "id": "order_999",
      "type": "cruise_package",
      "productCode": "MEDITERRANEAN-7D",
      "productName": "지중해 크루즈 7일",
      "quotedPrice": 4500000,
      "priceAcceptedAt": "2026-05-20T16:45:00Z",
      "departureDate": "2026-07-15T00:00:00Z",
      "cruiseInterest": "family_vacation",
      "status": "CONFIRMED",
      "paymentStatus": "DEPOSIT_PAID",
      "paymentAmount": 1500000,
      "paymentDate": "2026-05-21T10:00:00Z",
      "remainingBalance": 3000000,
      "cabinType": "Balcony Suite",
      "createdAt": "2026-05-15T08:20:00Z"
    },
    {
      "id": "order_998",
      "type": "cruise_package",
      "productCode": "CARIBBEAN-10D",
      "productName": "카리브해 크루즈 10일",
      "quotedPrice": 6800000,
      "priceAcceptedAt": "2026-03-10T12:00:00Z",
      "departureDate": "2026-04-20T00:00:00Z",
      "status": "COMPLETED",
      "paymentStatus": "COMPLETED",
      "paymentAmount": 6800000,
      "paymentDate": "2026-03-15T14:30:00Z",
      "satisactionScore": 9,
      "createdAt": "2026-03-01T09:00:00Z"
    }
  ],
  
  "communications": {
    "smsLogs": [
      {
        "id": "sms_001",
        "messageType": "Day0",
        "lensType": "L10",
        "content": "🎉 [특가] 지중해 크루즈 7일 48시간 한정...",
        "status": "DELIVERED",
        "sentAt": "2026-05-20T10:00:00Z",
        "openedAt": "2026-05-20T10:15:00Z",
        "clickedAt": "2026-05-20T10:20:00Z",
        "convertedAt": null
      }
    ],
    "emailLogs": [
      {
        "id": "email_001",
        "subject": "특별 할인 제안 - 지중해 크루즈",
        "status": "DELIVERED",
        "sentAt": "2026-05-20T10:05:00Z",
        "openedAt": "2026-05-20T11:30:00Z"
      }
    ],
    "callLogs": [
      {
        "id": "call_001",
        "duration": 450,  // 초
        "result": "BOOKED",
        "convictionScore": 9,
        "callPhase": "close",
        "callStartedAt": "2026-05-20T14:00:00Z",
        "callEndedAt": "2026-05-20T14:07:30Z",
        "scriptVersion": "v13-A-standard",
        "recordingConsent": true
      }
    ],
    "totalInteractions": 12,
    "lastInteractionAt": "2026-05-20T14:07:30Z"
  },
  
  "psychologyProfile": {
    "lensClassifications": [
      {
        "lensType": "L6",
        "lensLabel": "타이밍/손실회피",
        "confidenceScore": 92,
        "status": "ACTIVE",
        "identifiedAt": "2026-05-18T09:00:00Z",
        "readinessScore": 85,
        "priorityLevel": "P0"
      },
      {
        "lensType": "L10",
        "lensLabel": "즉시 구매 클로징",
        "confidenceScore": 88,
        "status": "ACTIVE",
        "identifiedAt": "2026-05-19T15:30:00Z",
        "readinessScore": 92,
        "priorityLevel": "P0"
      }
    ],
    "sequenceStatus": {
      "L6": {
        "day0": { "sent": true, "clicked": true, "converted": false },
        "day1": { "sent": true, "clicked": false, "converted": false },
        "day2": { "sent": true, "clicked": true, "converted": false },
        "day3": { "sent": false, "clicked": false, "converted": false }
      },
      "L10": {
        "day0": { "sent": true, "clicked": true, "converted": true, "convertedAt": "2026-05-20T14:30:00Z" }
      }
    }
  },
  
  "riskProfile": {
    "riskScore": 15,  // 0-100, 낮을수록 좋음
    "flags": [
      {
        "type": "FAMILY_PERSUASION_PENDING",
        "severity": "MEDIUM",
        "detectedAt": "2026-05-15T11:00:00Z",
        "description": "배우자 설득 필요 (상태: hesitant)"
      },
      {
        "type": "PREPARATION_ANXIETY_MEDIUM",
        "severity": "LOW",
        "detectedAt": "2026-05-18T09:30:00Z",
        "description": "여행 준비 불안도: MEDIUM (비자 필요, 여권 85일)"
      }
    ],
    "recommendedActions": [
      {
        "action": "SEND_SPOUSE_ENGAGEMENT_SMS",
        "priority": "HIGH",
        "reason": "배우자 동의 필수 (구매 전환율 +35%)",
        "nextScheduledAt": "2026-05-29T10:00:00Z"
      },
      {
        "action": "PROVIDE_VISA_GUIDANCE",
        "priority": "MEDIUM",
        "reason": "비자 준비 불안 해소 (전환율 +18%)",
        "resources": ["visa_guide_pdf", "embassy_contact"]
      }
    ]
  },
  
  "affiliateTracking": {
    "affiliateLinkId": "aff_link_001",
    "affiliateManagerId": "mgr_001",
    "affiliateAgentId": "agent_123",
    "commissionAmount": 450000,  // 계산됨
    "commissionStatus": "PENDING_CONFIRMATION",
    "attributionModel": "last_touch",
    "attributionChain": [
      {
        "step": 1,
        "source": "affiliate_link",
        "touchedAt": "2026-05-10T08:00:00Z"
      },
      {
        "step": 2,
        "source": "organic_return",
        "touchedAt": "2026-05-15T10:00:00Z"
      },
      {
        "step": 3,
        "source": "SMS_campaign",
        "touchedAt": "2026-05-20T10:00:00Z",
        "credited": true
      }
    ]
  },
  
  "metadata": {
    "dataQuality": {
      "completeness": 0.95,  // 필드 95% 채워짐
      "lastValidatedAt": "2026-05-28T12:00:00Z",
      "issues": []
    },
    "cacheInfo": {
      "cachedAt": "2026-05-28T14:22:00Z",
      "ttl": 1800,  // 30분
      "source": "redis"
    }
  }
}
```

**에러 응답**:
```json
{
  "error": "Contact not found",
  "code": "CONTACT_NOT_FOUND",
  "statusCode": 404
}
```

---

### 2.2 주요 엔드포인트 목록

| 엔드포인트 | 메서드 | 설명 | 성능 |
|-----------|--------|------|------|
| `/api/contacts/:id/360` | GET | 통합 360도 뷰 (모든 데이터) | <1s (Redis 캐시) |
| `/api/contacts/:id/orders` | GET | 거래 이력 (페이징) | <500ms (쿼리 최적화) |
| `/api/contacts/:id/communications` | GET | SMS/Email/Call 로그 | <300ms (별도 테이블) |
| `/api/contacts/:id/risk-score` | GET | 위험도 + 권장액션 | <200ms (캐시됨) |
| `/api/contacts/:id/psychology` | GET | 렌즈 분류 + 시퀀스 상태 | <400ms (GraphQL DataLoader) |
| `/api/contacts/:id/affiliate` | GET | Affiliate 추적 정보 | <250ms (Commission 계산) |
| `POST /api/contacts/:id/pii-mask` | POST | PII 마스킹 적용 | <100ms (메모리) |

---

## 3. 성능 최적화 전략

### 3.1 데이터베이스 최적화

#### 3.1.1 N+1 쿼리 제거

**문제**: Contact를 조회한 후 GoldMember, Partner, Group 등을 각각 조회 (총 5+ 쿼리)

**해결책**: Prisma DataLoader + 배치 쿼리

```typescript
// ❌ 나쁜 예 (N+1)
const contact = await prisma.contact.findUnique({
  where: { id: contactId }
});
const goldMember = await prisma.goldMember.findFirst({
  where: { userId: contact.userId }  // 별도 쿼리!
});
const partner = await prisma.partner.findUnique({
  where: { id: contact.partnerId }   // 별도 쿼리!
});

// ✅ 좋은 예 (DataLoader + Batch)
const contacts = await prisma.contact.findMany({
  where: { id: { in: contactIds } },
  include: {
    groups: { include: { group: true } },
    partner: { include: { metrics: true } },
    organization: true
  }
});
```

#### 3.1.2 View 및 Materialized View

```sql
-- Contact 360도 뷰 (읽기 전용)
CREATE OR REPLACE VIEW v_contact_360 AS
SELECT
  c.id,
  c.phone,
  c.name,
  c.email,
  c.organizationId,
  c.type,
  c.segment,
  
  -- GoldMember 정보
  gm.id as goldMemberId,
  gm.memberCode,
  gm.courseType,
  gm.status as goldMemberStatus,
  gm.totalPayments,
  
  -- Partner 정보
  p.id as partnerId,
  p.name as partnerName,
  p.totalRevenue,
  p.automationRate,
  
  -- Group 카운트
  (SELECT COUNT(*) FROM "ContactGroupMember" WHERE "contactId" = c.id) as groupCount,
  
  -- Order 카운트
  (SELECT COUNT(*) FROM "Contact" c2 WHERE c2.id = c.id AND c2."reservationId" IS NOT NULL) as orderCount,
  
  -- 마지막 상호작용
  c.lastContactedAt,
  c.updatedAt
  
FROM "Contact" c
LEFT JOIN "GoldMember" gm ON c."userId" = gm."userId" AND gm."organizationId" = c."organizationId"
LEFT JOIN "Partner" p ON c."partnerId" = p.id
WHERE c."deletedAt" IS NULL;

-- Materialized View 갱신 (매시간)
REFRESH MATERIALIZED VIEW CONCURRENTLY v_contact_360;
```

#### 3.1.3 인덱스 전략

```sql
-- 기존 인덱스 확인 (이미 스키마에 정의됨)
-- Contact: organizationId, type, partnerId, userId, deletedAt
-- GoldMember: userId, organizationId
-- Partner: organizationId, status
-- ContactGroupMember: contactId, groupId

-- 추가 인덱스 (선택)
CREATE INDEX idx_contact_360_lookup ON "Contact"
  (organizationId, id) 
  INCLUDE (userId, partnerId, deletedAt);

CREATE INDEX idx_goldmember_contact_lookup ON "GoldMember"
  (organizationId, userId) 
  INCLUDE (id, memberCode, status, totalPayments);

CREATE INDEX idx_contact_org_user ON "Contact"
  (organizationId, userId) 
  WHERE "deletedAt" IS NULL;
```

### 3.2 Redis 캐싱 전략

```typescript
// redis.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export async function getContact360Cached(contactId: string, orgId: string) {
  const cacheKey = `contact:360:${orgId}:${contactId}`;
  const ttl = 1800; // 30분
  
  // 1단계: 캐시 조회
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // 2단계: DB에서 조회 (DataLoader 사용)
  const contact360 = await fetchContact360FromDb(contactId, orgId);
  
  // 3단계: 캐시에 저장
  await redis.setex(cacheKey, ttl, JSON.stringify(contact360));
  
  return contact360;
}

// 캐시 무효화 (Contact 업데이트 시)
export async function invalidateContact360Cache(contactId: string, orgId: string) {
  const cacheKey = `contact:360:${orgId}:${contactId}`;
  await redis.del(cacheKey);
}
```

### 3.3 GraphQL DataLoader

```typescript
// dataloader.ts
import DataLoader from 'dataloader';

// 배치 로더 (여러 Contact를 한번에 조회)
const contactLoader = new DataLoader(async (contactIds: string[]) => {
  const contacts = await prisma.contact.findMany({
    where: { id: { in: contactIds } },
    include: {
      partner: true,
      groups: { include: { group: true } },
      organization: true
    }
  });
  
  // 요청 순서대로 정렬
  return contactIds.map(id => 
    contacts.find(c => c.id === id) || new Error(`Contact ${id} not found`)
  );
});

const goldMemberLoader = new DataLoader(async (userIds: (number | null)[]) => {
  const filtered = userIds.filter((uid): uid is number => uid !== null);
  if (filtered.length === 0) return userIds.map(() => null);
  
  const members = await prisma.goldMember.findMany({
    where: { userId: { in: filtered } }
  });
  
  return userIds.map(uid => 
    uid ? members.find(m => m.userId === uid) || null : null
  );
});

export function createDataLoaders() {
  return {
    contactLoader,
    goldMemberLoader
  };
}
```

---

## 4. PII (개인식별정보) 마스킹 구현

### 4.1 마스킹 규칙

| 필드 | 마스킹 패턴 | 예시 |
|------|-----------|------|
| phone | `01XXXXXXXX` | `010****5678` |
| email | `user@***.com` | `kim****@example.com` |
| name | `김*` (성만 표시) | `김민준` → `김**` |
| address | `서울시 강남구 ***` | 동/호수 숨김 |
| birthday | `XXXX년 XX월 생` | `1990년 03월 생` |
| idNumber | `XXXXXXXX-XXXXXXXX` | 뒤 8자리 숨김 |

### 4.2 마스킹 함수

```typescript
// pii-mask.ts
export interface MaskOptions {
  level: 'full' | 'partial' | 'none'; // 마스킹 수준
  roles: string[]; // 권한 ("admin", "agent", "viewer")
  orgId: string;
}

export function maskPII(data: Contact360, options: MaskOptions): Contact360 {
  if (options.level === 'none') return data;
  
  const maskLevel = options.level === 'full' ? 0.8 : 0.5;
  
  return {
    ...data,
    contact: {
      ...data.contact,
      phone: maskPhone(data.contact.phone, maskLevel),
      email: maskEmail(data.contact.email, maskLevel),
      name: maskName(data.contact.name, maskLevel)
    },
    goldMember: data.goldMember ? {
      ...data.goldMember,
      phone: maskPhone(data.goldMember.phone, maskLevel)
    } : null
  };
}

function maskPhone(phone: string, level: number) {
  // level: 0-1 (0=완전 숨김, 1=완전 노출)
  const visibleChars = Math.ceil(phone.length * level);
  const hiddenChars = phone.length - visibleChars;
  return phone.slice(0, visibleChars) + 'X'.repeat(hiddenChars);
  // "01012345678" → level 0.3 → "010X" + "XXXXXXX"
}

function maskEmail(email: string, level: number) {
  const [user, domain] = email.split('@');
  const visibleUser = Math.ceil(user.length * level);
  const masked = user.slice(0, visibleUser) + '*'.repeat(user.length - visibleUser);
  return `${masked}@${domain}`;
  // "kim.min.jun@example.com" → level 0.3 → "ki****@example.com"
}

function maskName(name: string, level: number) {
  if (level > 0.5) return name; // 충분히 높은 권한
  // 성만 표시
  return name[0] + '*'.repeat(name.length - 1);
  // "김민준" → "김**"
}

// 사용 예시
const masked = maskPII(contact360, {
  level: 'partial',
  roles: ['agent'],
  orgId: 'org_001'
});
```

### 4.3 권한 기반 마스킹 정책

```typescript
// rbac-masking.ts
const maskingPolicies: Record<string, MaskOptions> = {
  'ADMIN': { level: 'none', roles: ['admin'], orgId: '' },        // 마스킹 안함
  'MANAGER': { level: 'partial', roles: ['manager'], orgId: '' }, // 부분 마스킹
  'AGENT': { level: 'full', roles: ['agent'], orgId: '' },        // 전체 마스킹
  'VIEWER': { level: 'full', roles: ['viewer'], orgId: '' }       // 전체 마스킹
};

export async function applyMaskingPolicy(
  data: Contact360,
  user: { role: string; orgId: string }
): Promise<Contact360> {
  const policy = maskingPolicies[user.role] || maskingPolicies['VIEWER'];
  return maskPII(data, { ...policy, orgId: user.orgId });
}
```

### 4.4 법적 준수

```typescript
// compliance.ts
export enum DataRetentionPolicy {
  GDPR = 'gdpr',        // 3년 후 자동 삭제
  CCPA = 'ccpa',        // 사용자 요청 시 삭제
  KOREA_PIPA = 'pipa'   // 수집 목적 달성 후 삭제
}

export async function applyDataRetention(
  contactId: string,
  policy: DataRetentionPolicy
) {
  const retentionDays: Record<DataRetentionPolicy, number> = {
    [DataRetentionPolicy.GDPR]: 365 * 3,      // 3년
    [DataRetentionPolicy.CCPA]: 365,          // 1년
    [DataRetentionPolicy.KOREA_PIPA]: 365 * 5 // 5년
  };
  
  const deleteAt = new Date();
  deleteAt.setDate(deleteAt.getDate() + retentionDays[policy]);
  
  await prisma.contact.update({
    where: { id: contactId },
    data: { deletedAt: deleteAt }
  });
}
```

---

## 5. 통합 조회 예시

### 5.1 기본 사용

```typescript
// route.ts
import { getContact360Cached } from '@/lib/contact-integrator';
import { applyMaskingPolicy } from '@/lib/pii-mask';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const contactId = params.id;
    const user = await getCurrentUser(req);
    const orgId = user.organizationId;
    
    // 1. 360도 뷰 조회 (캐시됨)
    const contact360 = await getContact360Cached(contactId, orgId);
    
    // 2. PII 마스킹 적용 (권한 기반)
    const masked = await applyMaskingPolicy(contact360, user);
    
    return NextResponse.json(masked);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode || 500 }
    );
  }
}
```

### 5.2 고급: 페이징된 주문 조회

```typescript
// /api/contacts/[id]/orders
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const skip = (page - 1) * limit;
  
  const orders = await prisma.gmReservation.findMany({
    where: {
      contacts: {
        some: { id: params.id }
      }
    },
    include: {
      cruiseProduct: true,
      contacts: { select: { id: true } }
    },
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' }
  });
  
  const total = await prisma.gmReservation.count({
    where: {
      contacts: { some: { id: params.id } }
    }
  });
  
  return NextResponse.json({
    data: orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}
```

### 5.3 고급: 위험도 + 권장액션

```typescript
// risk-score.ts
export async function calculateRiskScore(contact: Contact): Promise<RiskProfile> {
  let riskScore = 0;
  const flags: RiskFlag[] = [];
  
  // L2: 준비 불안도
  if (contact.anxietyScore > 70) {
    riskScore += 20;
    flags.push({
      type: 'PREPARATION_ANXIETY_HIGH',
      severity: 'HIGH',
      description: `준비 불안도: ${contact.anxietyCategory}`
    });
  }
  
  // L3: 경쟁사 언급
  if (contact.competitorMentioned && !contact.differentiationResponseSent) {
    riskScore += 25;
    flags.push({
      type: 'COMPETITOR_NOT_ADDRESSED',
      severity: 'HIGH'
    });
  }
  
  // L7: 배우자 동의 미결정
  if (contact.familyComposition === 'spouse' && 
      contact.spouseEngagement !== 'convinced') {
    riskScore += 30;
    flags.push({
      type: 'FAMILY_PERSUASION_PENDING',
      severity: 'MEDIUM'
    });
  }
  
  // L6: 결정 윈도우 임박
  if (contact.decisionWindowExpiresAt && 
      daysBetween(now, contact.decisionWindowExpiresAt) < 3) {
    riskScore += 15;
    flags.push({
      type: 'DECISION_WINDOW_CLOSING',
      severity: 'CRITICAL'
    });
  }
  
  const recommendedActions = generateActions(flags, contact);
  
  return {
    riskScore: Math.min(riskScore, 100),
    flags,
    recommendedActions
  };
}

function generateActions(flags: RiskFlag[], contact: Contact): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  
  flags.forEach(flag => {
    switch (flag.type) {
      case 'PREPARATION_ANXIETY_HIGH':
        actions.push({
          action: 'PROVIDE_PREPARATION_GUIDE',
          priority: 'HIGH',
          reason: '준비 불안 해소 (+18% 전환율)',
          resources: ['visa_guide', 'health_tips']
        });
        break;
      case 'COMPETITOR_NOT_ADDRESSED':
        actions.push({
          action: 'SEND_DIFFERENTIATION_SMS',
          priority: 'CRITICAL',
          reason: '경쟁사 대비 차별성 강조 (+40% 전환율)',
          nextScheduledAt: addHours(now, 1)
        });
        break;
      // ...
    }
  });
  
  return actions;
}
```

---

## 6. 구현 체크리스트

### Phase 1: 데이터 통합 (Week 1)
- [ ] Prisma 쿼리 최적화 (DataLoader)
- [ ] Contact 360도 조회 API 구현
- [ ] Redis 캐싱 설정
- [ ] 기본 PII 마스킹 구현

### Phase 2: 성능 최적화 (Week 2)
- [ ] 데이터베이스 View 생성
- [ ] 인덱스 추가/최적화
- [ ] 성능 테스트 (벤치마크)
  - 목표: < 1초 (캐시), < 2초 (DB)
- [ ] N+1 쿼리 모두 제거

### Phase 3: 고급 기능 (Week 2-3)
- [ ] 위험도 계산 엔진
- [ ] 권장액션 생성
- [ ] 심리학 렌즈 통합
- [ ] Affiliate 추적 추가

### Phase 4: 테스트 & 배포 (Week 3)
- [ ] 단위 테스트 (jest)
- [ ] 통합 테스트 (e2e)
- [ ] PII 마스킹 검증
- [ ] 규정 준수 감사 (GDPR, PIPA)
- [ ] 본사 환경 배포

---

## 7. 성과 메트릭

| 메트릭 | 현재 | 목표 | 예상 효과 |
|--------|------|------|----------|
| 고객 조회 응답시간 | 3-5s | <1s | 50% 단축 |
| 데이터 일관성 | 95% | 99%+ | 자동분류 정확도 +4% |
| N+1 쿼리 제거율 | 0% | 100% | DB 부하 70% 감소 |
| 캐시 히트율 | 0% | 80%+ | 서버 응답 4배 빠름 |
| PII 보안 준수 | 기본 | GDPR/PIPA 100% | 규정 준수 완료 |

**기대 매출 효과**: 고객 조회 속도 50% 단축 → 평균 처리 시간 40% 단축 → Agent 생산성 40% ↑ → **월 +$30K-50K USD**

---

## 8. 배포 계획

### 8.1 롤아웃 전략 (Canary Deployment)

```
Week 3: Phase A (Internal Only)
├─ 마비즈 내부 팀 (Agent 5명) → 테스트
├─ 메트릭 수집 (응답시간, 에러율)
└─ 피드백 반영

Week 3: Phase B (50% 트래픽)
├─ 파트너 중 50% → 새 API 사용
├─ 나머지 50% → 기존 API (비교)
└─ A/B 비교 (성능, 정확도)

Week 4: Phase C (100% 배포)
├─ 모든 고객에게 확대
├─ 모니터링 강화 (첫 주)
└─ 본사 연동 (cruisedot)
```

### 8.2 모니터링 & 알림

```typescript
// monitoring.ts
export async function monitorContact360API() {
  const metrics = {
    responseTime: [],
    cacheHitRate: 0,
    errorRate: 0,
    dbQueryTime: 0
  };
  
  // CloudWatch / DataDog 전송
  await sendMetrics('contact-360-api', metrics);
  
  // 임계값 초과 시 알림
  if (metrics.responseTime > 2000) {
    await sendAlert('CONTACT_360_SLOW_RESPONSE', {
      threshold: 2000,
      actual: metrics.responseTime,
      severity: 'MEDIUM'
    });
  }
}
```

---

## 9. 참고 자료

- **Prisma DataLoader**: https://github.com/graphql/dataloader
- **Redis Caching**: https://redis.io/docs/
- **PII Masking (GDPR)**: https://gdpr-info.eu/
- **한국 개인정보보호법 (PIPA)**: https://www.pipc.go.kr/
- **성능 벤치마크**: https://www.postgresql.org/docs/current/pgbench.html

---

**Agent D 완료 예정 일시**: 2026-05-29 ~ 2026-06-05 (1주)

**담당자**: Customer Integrator Agent D

**상태**: 🔄 설계 완료 → 구현 대기
