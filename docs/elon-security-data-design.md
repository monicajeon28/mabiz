# Elon Musk: 퍼널 SMS 드롭다운 보안 + 데이터 구조 설계
**Updated: 2026-06-15** | **Status: Implementation Guide**

---

## 📋 목차
1. [보안 체크리스트](#보안-체크리스트)
2. [데이터 구조 설계](#데이터-구조-설계)
3. [API 보안 규칙](#api-보안-규칙)
4. [구현 전략](#구현-전략)
5. [테스트 계획](#테스트-계획)

---

## 🔒 보안 체크리스트

### 1. 사용자 입력 검증 (Input Validation)

#### **문제점**
```
❌ 위험: 사용자가 임의로 드롭다운 값을 변조
예시:
{
  "l1_template": "<script>alert('xss')</script>",
  "l3_template": "'; DROP TABLE Contact; --",
  "l6_template": "{{__proto__.isAdmin = true}}"
}

❌ API 요청 변조 감지 불가
❌ 데이터베이스 주입 공격 가능성
❌ 프로토타입 오염 (Prototype Pollution)
```

#### **해결책: 화이트리스트 검증**

```typescript
// src/lib/funnel-sms/template-validation.ts

const ALLOWED_TEMPLATES = {
  L1: {
    // 가격 민감도 (Price Sensitivity)
    templates: [
      '가치재정의',      // PASONA O: 오퍼 재설명
      '쉬운결제',        // PASONA A: 행동 단순화
      '포기하지마세요',  // Cardone 반박법
    ],
    description: '가격 이의 대응',
  },
  L3: {
    // 경쟁사 비교 (Differentiation)
    templates: [
      '비교표제시',     // 경쟁사 비교표
      '한국인가이드',   // 문화 차별화
      '고객후기',       // 사회증명
    ],
    description: '경쟁사 차별화',
  },
  L6: {
    // 타이밍/손실회피 (Timing + Loss Aversion)
    templates: [
      '할인강조',       // 긴박감 (Scarcity)
      '남은자리',       // 희소성 (Limited seats)
      '포기방지',       // 손실회피 (Loss aversion)
    ],
    description: '시간과 희소성',
  },
  L10: {
    // 즉시 구매 (Immediate Purchase)
    templates: [
      '할인강조',       // 긴박감
      '남은자리',       // 희소성
      '포기방지',       // 손실회피
    ],
    description: '즉시 결정 유도',
  },
};

// 서버 검증 함수
export function validateFunnelTemplate(lens: string, template: string): boolean {
  const allowedLens = ALLOWED_TEMPLATES[lens as keyof typeof ALLOWED_TEMPLATES];
  
  if (!allowedLens) {
    throw new Error(`Invalid lens: ${lens}. Allowed: ${Object.keys(ALLOWED_TEMPLATES).join(', ')}`);
  }
  
  if (!allowedLens.templates.includes(template)) {
    throw new Error(
      `Invalid template for ${lens}: ${template}. Allowed: ${allowedLens.templates.join(', ')}`
    );
  }
  
  return true;
}

// 타입 정의
export type FunnelLens = keyof typeof ALLOWED_TEMPLATES;
export type TemplateByLens<T extends FunnelLens> = (typeof ALLOWED_TEMPLATES)[T]['templates'][number];
```

#### **검증 적용 위치**
```typescript
// src/app/api/contacts/[id]/funnel-config/route.ts

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const contactId = params.id;
  const body = await request.json();

  // ✅ 1단계: 기본 타입 검증
  if (typeof body.l1_template !== 'string') {
    throw new Error('Invalid type: l1_template must be string');
  }

  // ✅ 2단계: 화이트리스트 검증 (필수!)
  try {
    validateFunnelTemplate('L1', body.l1_template);
    validateFunnelTemplate('L3', body.l3_template);
    validateFunnelTemplate('L6', body.l6_template);
    validateFunnelTemplate('L10', body.l10_template);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Invalid template selection' }),
      { status: 400 }
    );
  }

  // ✅ 3단계: 권한 검증 (아래에서 자세히)
  // ...

  // ✅ 4단계: 데이터 저장
  // ...
}
```

---

### 2. 권한 검증 (RBAC - Role-Based Access Control)

#### **역할별 권한 매트릭스**

| 역할 | 설정 가능 | 조회 가능 | 다른 사용자 설정 변경 |
|------|---------|---------|-------------------|
| **OWNER** (조직주) | ✅ 모든 설정 | ✅ 전체 | ✅ 가능 |
| **MANAGER** (팀장) | ✅ 자신의 고객만 | ✅ 자신의 팀만 | ❌ 불가 |
| **AGENT** (판매원) | ❌ 설정 불가 | ✅ 할당된 고객만 | ❌ 불가 |

#### **검증 구현**

```typescript
// src/lib/auth/rbac.ts

export type Role = 'OWNER' | 'MANAGER' | 'AGENT';

export interface RBACContext {
  userId: string;
  organizationId: string;
  role: Role;
  managerId?: string; // MANAGER의 경우 팀장 ID
}

export async function checkFunnelConfigAccess(
  context: RBACContext,
  contactId: string,
  action: 'READ' | 'UPDATE' | 'DELETE'
): Promise<boolean> {
  // ✅ 1단계: Contact 소유권 확인
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { organizationId: true, assignedManager: true },
  });

  if (!contact) {
    throw new Error('Contact not found');
  }

  // ❌ 조직 경계 위반 방지
  if (contact.organizationId !== context.organizationId) {
    throw new Error('Unauthorized: contact belongs to different organization');
  }

  // ✅ 2단계: 역할별 권한 확인
  switch (context.role) {
    case 'OWNER':
      // OWNER는 모든 작업 가능
      return true;

    case 'MANAGER':
      // MANAGER는 자신의 고객만 수정 가능
      if (action === 'READ') {
        // 팀장은 자신의 팀 고객 조회 가능
        return contact.assignedManager === context.managerId;
      }
      if (action === 'UPDATE' || action === 'DELETE') {
        // 수정/삭제는 자신의 고객만 가능
        return contact.assignedManager === context.managerId;
      }
      return false;

    case 'AGENT':
      // AGENT는 읽기만 가능 (설정 변경 불가)
      if (action === 'READ') {
        return contact.assignedManager === context.userId;
      }
      return false; // 쓰기 불가

    default:
      return false;
  }
}
```

#### **API에서 권한 확인**

```typescript
// src/app/api/contacts/[id]/funnel-config/route.ts

import { getServerSession } from 'next-auth';
import { checkFunnelConfigAccess } from '@/lib/auth/rbac';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const contactId = params.id;

  // ✅ 권한 확인
  const hasAccess = await checkFunnelConfigAccess(
    {
      userId: session.user.id,
      organizationId: session.user.organizationId,
      role: session.user.role as Role,
      managerId: session.user.managerId,
    },
    contactId,
    'UPDATE'
  );

  if (!hasAccess) {
    return new Response(
      JSON.stringify({ error: 'Forbidden: insufficient permissions' }),
      { status: 403 }
    );
  }

  // ✅ 이후 처리 계속
  // ...
}
```

---

### 3. 개인정보 보호 (PII Protection)

#### **민감 데이터 분류**

```typescript
export enum DataSensitivity {
  LOW = 'LOW',        // remainingSeats (숫자), discountRate
  MEDIUM = 'MEDIUM',  // templateName, lensType
  HIGH = 'HIGH',      // {{name}}, {{phone}}, {{email}}
}

// 템플릿에 포함 가능한 변수
export const SAFE_TEMPLATE_VARIABLES = {
  '{{name}}': {
    sensitivity: DataSensitivity.HIGH,
    description: '고객명',
    example: '김철수',
  },
  '{{phone}}': {
    sensitivity: DataSensitivity.HIGH,
    description: '전화번호',
    example: '010-1234-5678',
  },
  '{{email}}': {
    sensitivity: DataSensitivity.HIGH,
    description: '이메일',
    example: 'customer@example.com',
  },
  '{{remainingSeats}}': {
    sensitivity: DataSensitivity.LOW,
    description: '남은 자리',
    example: '3',
  },
  '{{discount}}': {
    sensitivity: DataSensitivity.LOW,
    description: '할인율',
    example: '15%',
  },
};
```

#### **PII 저장 방지**

```typescript
// ❌ 절대 금지: 실제 PII를 템플릿에 저장
const BAD_TEMPLATE = {
  l1_template: '{{name}}님께 15% 할인을 제공합니다', // 저장 시 name 값 포함 X
  content: 'Day 0: 안녕하세요 김철수님!', // 실제 고객명 저장 금지
};

// ✅ 올바른 방법: 변수만 저장, 실제 데이터는 런타임에 치환
const GOOD_TEMPLATE = {
  l1_template: '{{name}}님께 15% 할인을 제공합니다',
  variables: ['name', 'discount'], // 메타데이터만 저장
  content: 'Day 0: {{salutation}}', // 변수 치환 마크만 저장
};
```

#### **동적 치환 (Runtime Substitution)**

```typescript
// src/lib/sms/template-engine.ts

export function renderTemplate(
  template: string,
  contact: { name: string; email: string; phone: string; remainingSeats: number }
): string {
  let result = template;

  // ✅ 각 변수를 안전하게 치환
  result = result.replace(/\{\{name\}\}/g, escapeHtml(contact.name));
  result = result.replace(/\{\{email\}\}/g, escapeHtml(contact.email));
  result = result.replace(/\{\{phone\}\}/g, escapeHtml(contact.phone));
  result = result.replace(
    /\{\{remainingSeats\}\}/g,
    String(contact.remainingSeats)
  );

  return result;
}

// XSS 방지
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
```

---

### 4. 감시 & 감사 추적 (Audit Log)

#### **모든 변경 기록**

```typescript
// src/lib/audit/funnel-config-logger.ts

export interface FunnelConfigAuditLog {
  id: string;
  contactId: string;
  organizationId: string;
  userId: string;
  action: 'L1_TEMPLATE_ENABLED' | 'L1_TEMPLATE_CHANGED' | 'L1_DISABLED' | ...;
  oldValue: Record<string, any>;
  newValue: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

export async function logFunnelConfigChange(
  contactId: string,
  organizationId: string,
  userId: string,
  lens: string,
  action: string,
  oldTemplate: string | null,
  newTemplate: string | null,
  request: Request
) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  await prisma.funnelConfigAuditLog.create({
    data: {
      contactId,
      organizationId,
      userId,
      action: `${lens}_${action}`,
      oldValue: {
        template: oldTemplate,
        timestamp: new Date().toISOString(),
      },
      newValue: {
        template: newTemplate,
        timestamp: new Date().toISOString(),
      },
      ipAddress: ip,
      userAgent,
    },
  });
}
```

#### **감사 로그 조회**

```typescript
export async function getFunnelConfigAuditLog(
  contactId: string,
  limit: number = 50
) {
  return prisma.funnelConfigAuditLog.findMany({
    where: { contactId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      action: true,
      oldValue: true,
      newValue: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      createdAt: true,
      ipAddress: true,
    },
  });
}
```

---

## 📊 데이터 구조 설계

### 1. FunnelSmsConfig 테이블 (사용자 설정)

```sql
CREATE TABLE IF NOT EXISTS FunnelSmsConfig (
  id VARCHAR(36) PRIMARY KEY,
  contactId VARCHAR(36) NOT NULL UNIQUE,
  organizationId VARCHAR(36) NOT NULL,
  
  -- L1: 가격 민감도 (Price Sensitivity)
  l1_enabled BOOLEAN DEFAULT false,
  l1_template VARCHAR(50),
  l1_created_at TIMESTAMP,
  l1_updated_by VARCHAR(36),
  
  -- L3: 경쟁사 비교 (Differentiation)
  l3_enabled BOOLEAN DEFAULT false,
  l3_template VARCHAR(50),
  l3_created_at TIMESTAMP,
  l3_updated_by VARCHAR(36),
  
  -- L6: 타이밍/손실회피 (Timing + Loss Aversion)
  l6_enabled BOOLEAN DEFAULT false,
  l6_template VARCHAR(50),
  l6_created_at TIMESTAMP,
  l6_updated_by VARCHAR(36),
  
  -- L10: 즉시 구매 (Immediate Purchase)
  l10_enabled BOOLEAN DEFAULT false,
  l10_template VARCHAR(50),
  l10_created_at TIMESTAMP,
  l10_updated_by VARCHAR(36),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (contactId) REFERENCES Contact(id) ON DELETE CASCADE,
  FOREIGN KEY (organizationId) REFERENCES Organization(id),
  UNIQUE KEY unique_contact_org (contactId, organizationId),
  INDEX idx_org_updated (organizationId, updated_at DESC),
  INDEX idx_contact_enabled (contactId, l1_enabled, l3_enabled, l6_enabled, l10_enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2. FunnelSmsTemplate 테이블 (읽기 전용 마스터)

```sql
CREATE TABLE IF NOT EXISTS FunnelSmsTemplate (
  id VARCHAR(36) PRIMARY KEY,
  lens VARCHAR(10) NOT NULL,          -- L1, L3, L6, L10
  name VARCHAR(50) NOT NULL,          -- 템플릿명
  description TEXT,
  
  -- Day 0-3 SMS 콘텐츠
  day0_content TEXT,
  day1_content TEXT,
  day2_content TEXT,
  day3_content TEXT,
  
  -- 변수 메타데이터 (JSON)
  variables JSON,                      -- ["name", "price", "remainingSeats"]
  
  -- 심리학 정보
  psychologyFramework VARCHAR(50),    -- PASONA, Cardone, Brunson
  lensType VARCHAR(10),
  
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_lens_name (lens, name),
  INDEX idx_lens (lens),
  INDEX idx_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### **초기 데이터**

```sql
INSERT INTO FunnelSmsTemplate (id, lens, name, description, day0_content, day1_content, day2_content, day3_content, variables, psychologyFramework, lensType) VALUES
('tpl_l1_01', 'L1', '가치재정의', 'PASONA O단계: 오퍼 재설명', 
 'Day 0: {{name}}님, 15% 할인 제공!',
 'Day 1: 왜 이 가격이 최고의 가치인지',
 'Day 2: 다른 고객들의 후기',
 'Day 3: 오늘 신청하면 추가 혜택!',
 '["name", "discount"]', 'PASONA', 'L1'),

('tpl_l1_02', 'L1', '쉬운결제', 'PASONA A단계: 행동 단순화',
 'Day 0: {{name}}님, 3회 분할 결제 가능!',
 'Day 1: 결제 프로세스는 30초만',
 'Day 2: 선결제 필요 없음',
 'Day 3: 지금 신청하고 바로 출발!',
 '["name"]', 'PASONA', 'L1'),

('tpl_l6_01', 'L6', '남은자리', 'Loss Aversion: 희소성 강조',
 'Day 0: {{name}}님, {{remainingSeats}}자리만 남았어요!',
 'Day 1: 인기 상품, 오늘 마감 예정',
 'Day 2: 지금 놓치면 3주 후 예약',
 'Day 3: 마지막 기회! 지금 신청!',
 '["name", "remainingSeats"]', 'Cardone', 'L6');
```

### 3. FunnelConfigAuditLog 테이블 (감시)

```sql
CREATE TABLE IF NOT EXISTS FunnelConfigAuditLog (
  id VARCHAR(36) PRIMARY KEY,
  contactId VARCHAR(36) NOT NULL,
  organizationId VARCHAR(36) NOT NULL,
  userId VARCHAR(36),
  
  -- 액션 기록
  action VARCHAR(100) NOT NULL,        -- L1_TEMPLATE_CHANGED, L3_ENABLED, ...
  oldValue JSON,
  newValue JSON,
  
  -- 환경 정보
  ipAddress VARCHAR(45),
  userAgent TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (contactId) REFERENCES Contact(id) ON DELETE CASCADE,
  FOREIGN KEY (organizationId) REFERENCES Organization(id),
  FOREIGN KEY (userId) REFERENCES OrganizationMember(id),
  INDEX idx_org_time (organizationId, created_at DESC),
  INDEX idx_contact_action (contactId, action),
  INDEX idx_user_time (userId, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 🔐 API 보안 규칙

### POST /api/contacts/[id]/funnel-config

#### **요청 검증**

```typescript
// src/app/api/contacts/[id]/funnel-config/route.ts

interface FunnelConfigRequest {
  l1_enabled: boolean;
  l1_template?: string;
  l3_enabled: boolean;
  l3_template?: string;
  l6_enabled: boolean;
  l6_template?: string;
  l10_enabled: boolean;
  l10_template?: string;
}

const FUNNEL_CONFIG_SCHEMA = z.object({
  l1_enabled: z.boolean().optional(),
  l1_template: z.string().max(50).optional(),
  l3_enabled: z.boolean().optional(),
  l3_template: z.string().max(50).optional(),
  l6_enabled: z.boolean().optional(),
  l6_template: z.string().max(50).optional(),
  l10_enabled: z.boolean().optional(),
  l10_template: z.string().max(50).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // ✅ 1단계: 기본 파싱 및 타입 검증
    const body = await request.json();
    const validatedBody = FUNNEL_CONFIG_SCHEMA.parse(body);

    const contactId = params.id;

    // ✅ 2단계: 권한 검증
    const hasAccess = await checkFunnelConfigAccess(
      {
        userId: session.user.id,
        organizationId: session.user.organizationId,
        role: session.user.role as Role,
        managerId: session.user.managerId,
      },
      contactId,
      'UPDATE'
    );

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403 }
      );
    }

    // ✅ 3단계: 각 템플릿 화이트리스트 검증
    const templates = [
      { lens: 'L1', template: validatedBody.l1_template },
      { lens: 'L3', template: validatedBody.l3_template },
      { lens: 'L6', template: validatedBody.l6_template },
      { lens: 'L10', template: validatedBody.l10_template },
    ];

    for (const { lens, template } of templates) {
      if (template) {
        validateFunnelTemplate(lens, template);
      }
    }

    // ✅ 4단계: 기존 설정 조회 (감사 로그용)
    const existingConfig = await prisma.funnelSmsConfig.findUnique({
      where: { contactId },
    });

    // ✅ 5단계: 데이터 저장
    const updatedConfig = await prisma.funnelSmsConfig.upsert({
      where: { contactId },
      create: {
        id: cuid(),
        contactId,
        organizationId: session.user.organizationId,
        l1_enabled: validatedBody.l1_enabled ?? false,
        l1_template: validatedBody.l1_template,
        l1_created_at: validatedBody.l1_template ? new Date() : null,
        l1_updated_by: validatedBody.l1_template ? session.user.id : null,
        l3_enabled: validatedBody.l3_enabled ?? false,
        l3_template: validatedBody.l3_template,
        l3_created_at: validatedBody.l3_template ? new Date() : null,
        l3_updated_by: validatedBody.l3_template ? session.user.id : null,
        l6_enabled: validatedBody.l6_enabled ?? false,
        l6_template: validatedBody.l6_template,
        l6_created_at: validatedBody.l6_template ? new Date() : null,
        l6_updated_by: validatedBody.l6_template ? session.user.id : null,
        l10_enabled: validatedBody.l10_enabled ?? false,
        l10_template: validatedBody.l10_template,
        l10_created_at: validatedBody.l10_template ? new Date() : null,
        l10_updated_by: validatedBody.l10_template ? session.user.id : null,
      },
      update: {
        l1_enabled: validatedBody.l1_enabled ?? undefined,
        l1_template: validatedBody.l1_template ?? undefined,
        l1_updated_by: validatedBody.l1_template ? session.user.id : undefined,
        l3_enabled: validatedBody.l3_enabled ?? undefined,
        l3_template: validatedBody.l3_template ?? undefined,
        l3_updated_by: validatedBody.l3_template ? session.user.id : undefined,
        l6_enabled: validatedBody.l6_enabled ?? undefined,
        l6_template: validatedBody.l6_template ?? undefined,
        l6_updated_by: validatedBody.l6_template ? session.user.id : undefined,
        l10_enabled: validatedBody.l10_enabled ?? undefined,
        l10_template: validatedBody.l10_template ?? undefined,
        l10_updated_by: validatedBody.l10_template ? session.user.id : undefined,
      },
    });

    // ✅ 6단계: 감사 로그 기록
    for (const { lens, template } of templates) {
      if (template !== existingConfig?.[`${lens.toLowerCase()}_template` as any]) {
        await logFunnelConfigChange(
          contactId,
          session.user.organizationId,
          session.user.id,
          lens,
          'TEMPLATE_CHANGED',
          existingConfig?.[`${lens.toLowerCase()}_template` as any] || null,
          template || null,
          request
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        config: {
          contactId: updatedConfig.contactId,
          l1: {
            enabled: updatedConfig.l1_enabled,
            template: updatedConfig.l1_template,
          },
          l3: {
            enabled: updatedConfig.l3_enabled,
            template: updatedConfig.l3_template,
          },
          l6: {
            enabled: updatedConfig.l6_enabled,
            template: updatedConfig.l6_template,
          },
          l10: {
            enabled: updatedConfig.l10_enabled,
            template: updatedConfig.l10_template,
          },
          updatedAt: updatedConfig.updated_at,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body', details: err.errors }),
        { status: 400 }
      );
    }

    console.error('FunnelConfig Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
}
```

### GET /api/contacts/[id]/funnel-config

```typescript
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const contactId = params.id;

    // ✅ 권한 확인
    const hasAccess = await checkFunnelConfigAccess(
      {
        userId: session.user.id,
        organizationId: session.user.organizationId,
        role: session.user.role as Role,
        managerId: session.user.managerId,
      },
      contactId,
      'READ'
    );

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403 }
      );
    }

    // 설정 조회
    const config = await prisma.funnelSmsConfig.findUnique({
      where: { contactId },
    });

    if (!config) {
      return new Response(
        JSON.stringify({
          contactId,
          l1: { enabled: false, template: null },
          l3: { enabled: false, template: null },
          l6: { enabled: false, template: null },
          l10: { enabled: false, template: null },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // ✅ 응답: {{variable}} 같은 메타데이터만 반환 (실제 PII 제외)
    return new Response(
      JSON.stringify({
        contactId: config.contactId,
        l1: {
          enabled: config.l1_enabled,
          template: config.l1_template,
          preview: config.l1_template
            ? `Day 0: {{name}}님께 ${config.l1_template}`
            : null,
        },
        l3: {
          enabled: config.l3_enabled,
          template: config.l3_template,
          preview: config.l3_template
            ? `Day 0: {{name}}님께 ${config.l3_template}`
            : null,
        },
        l6: {
          enabled: config.l6_enabled,
          template: config.l6_template,
          preview: config.l6_template
            ? `Day 0: {{remainingSeats}}자리 남음! {{name}}님`
            : null,
        },
        l10: {
          enabled: config.l10_enabled,
          template: config.l10_template,
          preview: config.l10_template
            ? `Day 0: {{discount}} 할인! {{name}}님`
            : null,
        },
        updatedAt: config.updated_at,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('FunnelConfig Read Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
}
```

---

## 🔐 Rate Limiting (분당 10회 제한)

```typescript
// src/lib/rate-limit/funnel-config.ts

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 분당 10회
  analytics: true,
  prefix: 'funnel-config-api',
});

export async function checkRateLimit(userId: string): Promise<boolean> {
  const { success } = await ratelimit.limit(userId);
  return success;
}
```

#### **API에 적용**

```typescript
export async function POST(request: Request, { params }: any) {
  const session = await getServerSession();
  
  // ✅ Rate Limiting
  const rateLimitOk = await checkRateLimit(session.user.id);
  if (!rateLimitOk) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Max 10 per minute.' }),
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  // 계속 진행...
}
```

---

## 구현 전략

### Phase 1: 데이터베이스 마이그레이션 (1-2일)

```prisma
// prisma/schema.prisma에 추가

model FunnelSmsConfig {
  id                String   @id @default(cuid())
  contactId         String   @unique
  contact           Contact  @relation("FunnelSmsConfig", fields: [contactId], references: [id], onDelete: Cascade)
  organizationId    String
  organization      Organization @relation("FunnelSmsConfigs", fields: [organizationId], references: [id])

  // L1
  l1_enabled        Boolean  @default(false)
  l1_template       String?  @db.VarChar(50)
  l1_created_at     DateTime?
  l1_updated_by     String?

  // L3
  l3_enabled        Boolean  @default(false)
  l3_template       String?  @db.VarChar(50)
  l3_created_at     DateTime?
  l3_updated_by     String?

  // L6
  l6_enabled        Boolean  @default(false)
  l6_template       String?  @db.VarChar(50)
  l6_created_at     DateTime?
  l6_updated_by     String?

  // L10
  l10_enabled       Boolean  @default(false)
  l10_template      String?  @db.VarChar(50)
  l10_created_at    DateTime?
  l10_updated_by    String?

  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  @@index([organizationId, updated_at(sort: Desc)])
  @@index([contactId, l1_enabled, l3_enabled, l6_enabled, l10_enabled])
  @@map("FunnelSmsConfig")
}

model FunnelSmsTemplate {
  id                    String   @id @default(cuid())
  lens                  String   @db.VarChar(10)
  name                  String   @db.VarChar(50)
  description           String?  @db.Text
  day0_content          String?  @db.Text
  day1_content          String?  @db.Text
  day2_content          String?  @db.Text
  day3_content          String?  @db.Text
  variables             Json?    // ["name", "price", "remainingSeats"]
  psychologyFramework   String?  @db.VarChar(50)
  lensType              String?  @db.VarChar(10)
  created_by            String?
  created_at            DateTime @default(now())
  updated_at            DateTime @updatedAt

  @@unique([lens, name])
  @@index([lens])
  @@index([created_at(sort: Desc)])
  @@map("FunnelSmsTemplate")
}

model FunnelConfigAuditLog {
  id              String   @id @default(cuid())
  contactId       String
  contact         Contact  @relation("FunnelConfigAuditLogs", fields: [contactId], references: [id], onDelete: Cascade)
  organizationId  String
  organization    Organization @relation("FunnelConfigAuditLogs", fields: [organizationId], references: [id])
  userId          String?
  user            OrganizationMember? @relation("FunnelConfigAuditLogs", fields: [userId], references: [id], onDelete: SetNull)

  action          String   @db.VarChar(100)
  oldValue        Json?
  newValue        Json?
  ipAddress       String?  @db.VarChar(45)
  userAgent       String?  @db.Text
  created_at      DateTime @default(now())

  @@index([organizationId, created_at(sort: Desc)])
  @@index([contactId, action])
  @@index([userId, created_at(sort: Desc)])
  @@map("FunnelConfigAuditLog")
}
```

### Phase 2: API 구현 (3-4일)

1. `src/lib/funnel-sms/template-validation.ts` — 화이트리스트 검증
2. `src/lib/auth/rbac.ts` — 권한 검증
3. `src/lib/audit/funnel-config-logger.ts` — 감사 로그
4. `src/app/api/contacts/[id]/funnel-config/route.ts` — GET/POST API

### Phase 3: UI 구현 (2-3일)

1. ContactSlidePanel에 드롭다운 추가
2. 선택값 저장 및 미리보기
3. 감사 로그 표시 (관리자용)

### Phase 4: 테스트 (2일)

1. 단위 테스트 (검증 함수)
2. 통합 테스트 (API)
3. 성능 테스트 (Rate Limiting)
4. 보안 테스트 (IDOR, SQL Injection)

---

## 테스트 계획

### 1. 입력 검증 테스트

```typescript
// __tests__/funnel-sms/template-validation.test.ts

describe('validateFunnelTemplate', () => {
  it('should accept valid templates', () => {
    expect(() => validateFunnelTemplate('L1', '가치재정의')).not.toThrow();
    expect(() => validateFunnelTemplate('L6', '남은자리')).not.toThrow();
  });

  it('should reject invalid templates', () => {
    expect(() => validateFunnelTemplate('L1', '<script>alert("xss")</script>')).toThrow();
    expect(() => validateFunnelTemplate('L1', "'; DROP TABLE Contact; --")).toThrow();
    expect(() => validateFunnelTemplate('INVALID', '가치재정의')).toThrow();
  });

  it('should reject invalid lens types', () => {
    expect(() => validateFunnelTemplate('L99', '아무거나')).toThrow();
  });
});
```

### 2. 권한 검증 테스트

```typescript
// __tests__/auth/rbac.test.ts

describe('checkFunnelConfigAccess', () => {
  it('OWNER should have full access', async () => {
    const result = await checkFunnelConfigAccess(
      { userId: 'owner1', organizationId: 'org1', role: 'OWNER' },
      'contact1',
      'UPDATE'
    );
    expect(result).toBe(true);
  });

  it('MANAGER should only modify own contacts', async () => {
    const result = await checkFunnelConfigAccess(
      { userId: 'mgr1', organizationId: 'org1', role: 'MANAGER', managerId: 'mgr1' },
      'contact1_assigned_to_mgr1',
      'UPDATE'
    );
    expect(result).toBe(true);

    const result2 = await checkFunnelConfigAccess(
      { userId: 'mgr1', organizationId: 'org1', role: 'MANAGER', managerId: 'mgr1' },
      'contact2_assigned_to_mgr2',
      'UPDATE'
    );
    expect(result2).toBe(false);
  });

  it('AGENT should only read, not modify', async () => {
    const readResult = await checkFunnelConfigAccess(
      { userId: 'agent1', organizationId: 'org1', role: 'AGENT' },
      'contact1',
      'READ'
    );
    expect(readResult).toBe(true);

    const updateResult = await checkFunnelConfigAccess(
      { userId: 'agent1', organizationId: 'org1', role: 'AGENT' },
      'contact1',
      'UPDATE'
    );
    expect(updateResult).toBe(false);
  });

  it('should reject cross-organization access', async () => {
    const result = await checkFunnelConfigAccess(
      { userId: 'user1', organizationId: 'org1', role: 'MANAGER' },
      'contact_from_org2',
      'READ'
    );
    expect(result).toBe(false);
  });
});
```

### 3. API 통합 테스트

```typescript
// __tests__/api/funnel-config.integration.test.ts

describe('POST /api/contacts/[id]/funnel-config', () => {
  it('should update config with valid template', async () => {
    const response = await fetch('/api/contacts/contact1/funnel-config', {
      method: 'POST',
      body: JSON.stringify({
        l1_enabled: true,
        l1_template: '가치재정의',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.config.l1.template).toBe('가치재정의');
  });

  it('should reject invalid template with 400', async () => {
    const response = await fetch('/api/contacts/contact1/funnel-config', {
      method: 'POST',
      body: JSON.stringify({
        l1_enabled: true,
        l1_template: '<script>xss</script>',
      }),
    });

    expect(response.status).toBe(400);
  });

  it('should reject unauthorized access with 403', async () => {
    // AGENT로 로그인
    // MANAGER의 고객 수정 시도
    const response = await fetch('/api/contacts/contact_of_other_manager/funnel-config', {
      method: 'POST',
      body: JSON.stringify({ l1_enabled: true, l1_template: '가치재정의' }),
    });

    expect(response.status).toBe(403);
  });

  it('should rate limit at 10 requests per minute', async () => {
    for (let i = 0; i < 10; i++) {
      const response = await fetch('/api/contacts/contact1/funnel-config', {
        method: 'POST',
        body: JSON.stringify({ l1_enabled: true, l1_template: '가치재정의' }),
      });
      expect(response.status).toBe(200);
    }

    // 11번째 요청은 실패
    const response = await fetch('/api/contacts/contact1/funnel-config', {
      method: 'POST',
      body: JSON.stringify({ l1_enabled: true, l1_template: '가치재정의' }),
    });
    expect(response.status).toBe(429);
  });
});
```

### 4. 감사 로그 테스트

```typescript
// __tests__/audit/funnel-config-logger.test.ts

describe('logFunnelConfigChange', () => {
  it('should record template changes', async () => {
    await logFunnelConfigChange(
      'contact1',
      'org1',
      'user1',
      'L1',
      'TEMPLATE_CHANGED',
      null,
      '가치재정의',
      mockRequest
    );

    const logs = await prisma.funnelConfigAuditLog.findMany({
      where: { contactId: 'contact1' },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('L1_TEMPLATE_CHANGED');
    expect(logs[0].newValue.template).toBe('가치재정의');
  });

  it('should capture IP and user agent', async () => {
    const mockReq = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'Mozilla/5.0',
      },
    });

    await logFunnelConfigChange(
      'contact1',
      'org1',
      'user1',
      'L1',
      'ENABLED',
      null,
      '가치재정의',
      mockReq
    );

    const logs = await prisma.funnelConfigAuditLog.findMany({
      where: { contactId: 'contact1' },
      orderBy: { created_at: 'desc' },
      take: 1,
    });

    expect(logs[0].ipAddress).toBe('192.168.1.1');
    expect(logs[0].userAgent).toBe('Mozilla/5.0');
  });
});
```

---

## 🛡️ Elon의 최종 체크리스트

### 입력 검증 (Input Validation)
- [ ] 각 Lens (L1, L3, L6, L10)의 템플릿 화이트리스트 정의 완료
- [ ] 서버 검증 함수 구현 (클라이언트 검증 추가 불가)
- [ ] XSS/SQL Injection 테스트 완료
- [ ] 타입 검증 (Zod) 적용

### 권한 & 접근 제어 (RBAC)
- [ ] organizationId 재확인 로직 구현
- [ ] 고객 할당 권한 검증 (assignedManager)
- [ ] 역할별 권한 매트릭스 구현 (OWNER/MANAGER/AGENT)
- [ ] AGENT는 읽기만 가능 확인
- [ ] Cross-organization 접근 차단

### 데이터 보호 (Data Protection)
- [ ] PII 필드 구분 (HIGH/MEDIUM/LOW)
- [ ] {{variable}} 동적 치환 구현 (실제 값 저장 금지)
- [ ] 템플릿 저장 시 변수 메타데이터만 저장
- [ ] 응답 시 실제 PII 제외

### 감시 & 감사 추적 (Audit)
- [ ] 모든 설정 변경 기록 (FunnelConfigAuditLog)
- [ ] userId, action, oldValue, newValue, timestamp 기록
- [ ] IP 주소 및 User-Agent 캡처
- [ ] 감사 로그 보존 기간 설정 (6개월+)

### 성능 & 동시성
- [ ] Rate Limiting 구현 (분당 10회)
- [ ] 인덱스 최적화 (organizationId + updated_at)
- [ ] UNIQUE 제약 (contactId + organizationId)
- [ ] 동시성 테스트 (100명 동시 저장)

### 테스트
- [ ] 단위 테스트 (검증, 권한, 감사)
- [ ] 통합 테스트 (API POST/GET)
- [ ] 보안 테스트 (IDOR, XSS, Rate Limit)
- [ ] 성능 테스트 (응답시간 < 200ms)

---

## 참고 문서

- **PASONA Framework**: Problem → Agitate → Solution → Offer → Narrow → Action
- **Grant Cardone 10렌즈**: L1-L10 심리학 렌즈 분류
- **OWASP Top 10**: 입력 검증, 권한 검증, 감사 추적

---

**Elon의 결론:**
```
"안전이 최우선!
사용자 입력은 절대 신뢰하지 마!
항상 서버에서 재검증하세요!"
```

---

**최종 업데이트**: 2026-06-15
**작성자**: Elon Musk (Security & Data Design Framework)
**상태**: Ready for Implementation
