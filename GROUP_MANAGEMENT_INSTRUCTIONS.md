# 그룹관리 기능 개발 — 상세 작업지시서

**작성 일시**: 2026-05-16  
**버전**: Step 3 작업지시서  
**소요 시간**: 8시간 (8단계)  
**목표**: 속도, 성능, 효율성, 자동화  

---

## 📋 목차

1. [Step 1: AGENT 권한 수정](#step-1-agent-권한-수정--30분)
2. [Step 2: Prisma 역참조 필드](#step-2-prisma-역참조-필드--20분)
3. [Step 3: /api/groups/[id]/register 엔드포인트](#step-3-apigroups-id-register--1h)
4. [Step 4: 폼 빌더 UI](#step-4-폼-빌더-ui--2h)
5. [Step 5: seq 생성 + 스크립트 자동화](#step-5-seq-생성--스크립트-자동화--15h)
6. [Step 6: P1 이슈 처리](#step-6-p1-이슈-처리--15h)
7. [Step 7: 보안 IDOR 검증](#step-7-보안-idor-검증--1h)
8. [Step 8: 메뉴 추가 + 통합 테스트](#step-8-메뉴-추가--통합-테스트--30분)

---

## Step 1: AGENT 권한 수정 — 30분

### 수정 대상 파일

#### 1️⃣ `src/app/api/groups/route.ts` (GET)

**현재 상황**: ✅ 정상 (ownerId 필터 있음)
```typescript
// Line 20-25: AGENT 필터
if (ctx.role === "AGENT") {
  where.OR = [
    { ownerId: ctx.userId },           // 자신의 그룹
    { ownerId: null }                  // 공유 그룹
  ];
}
```

**확인만 하면 됨** - 수정 불필요

---

#### 2️⃣ `src/app/api/groups/route.ts` (POST)

**현재 상황**: ❌ AGENT 생성 불가
```typescript
// Line 45-50: 현재
if (ctx.role === 'FREE_SALES' || ctx.role === 'AGENT') {
  return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
}
```

**수정**:
```typescript
// ✅ 수정 후
if (ctx.role === 'FREE_SALES') {
  return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
}
// AGENT는 허용 (자신의 그룹으로 조직ID 설정)
```

추가 검증 (Line 60-65 근처):
```typescript
const body = await req.json();
let { name, description, color, funnelId, organizationId } = body;

// OWNER/AGENT는 자기 조직만
if (ctx.role !== 'GLOBAL_ADMIN') {
  organizationId = ctx.organizationId;
}

// AGENT는 ownerId 자동 설정
const ownerId = ctx.role === 'AGENT' ? ctx.userId : null;

const group = await prisma.contactGroup.create({
  data: {
    organizationId,
    ownerId,  // ← AGENT인 경우 userId, 아니면 null
    name,
    description,
    color: color || '#1E2D4E',
    funnelId: funnelId || null,
  },
});
```

---

#### 3️⃣ `src/app/api/groups/[id]/route.ts` (PATCH, DELETE)

**현재 상황**: ❌ 권한 검증 미흡

**PATCH 수정** (Line 45-60):
```typescript
const existing = await prisma.contactGroup.findUnique({ where: { id } });
if (!existing) {
  return NextResponse.json({ ok: false, error: 'Group not found' }, { status: 404 });
}

// 권한 검증 추가
if (ctx.role === 'OWNER' && existing.organizationId !== ctx.organizationId) {
  return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
}

if (ctx.role === 'AGENT') {
  // AGENT는 자신의 그룹(ownerId = userId) 또는 공유 그룹(ownerId = null)만 수정 가능
  if (existing.ownerId !== ctx.userId && existing.ownerId !== null) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
}

// 수정 진행 (기존 코드)
```

**DELETE 수정** (동일 방식):
```typescript
if (ctx.role === 'AGENT') {
  if (existing.ownerId !== ctx.userId) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
}
```

---

#### 4️⃣ `src/app/api/landing-pages/route.ts` (POST)

**현재 상황**: ❌ AGENT 생성 불가
```typescript
// Line 74: 현재
if (ctx.role === 'FREE_SALES' || ctx.role === 'AGENT') {
  return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
}
```

**수정**:
```typescript
// ✅ 수정 후
if (ctx.role === 'FREE_SALES') {
  return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
}

// AGENT는 허용하되, 조직ID 검증
if (ctx.role === 'AGENT') {
  const body = await req.json();
  if (body.organizationId && body.organizationId !== ctx.organizationId) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
}
```

---

### 검증 방법

```bash
# 개발 서버 재시작
npm run dev

# 테스트
# 1. AGENT 계정으로 로그인
# 2. /dashboard/groups → [그룹 추가] 버튼 클릭
# 3. 그룹 생성 성공 확인
# 4. 자신의 그룹 수정/삭제 가능 확인
# 5. 다른 사람 그룹 수정/삭제 시도 → 403 Forbidden 확인
```

---

## Step 2: Prisma 역참조 필드 — 20분

### 수정 파일: `prisma/schema.prisma`

**현재 상황**: `ContactGroup` 모델에 `landingPages` 관계 필드 없음

**수정** (ContactGroup 모델 라인):

```prisma
model ContactGroup {
  id                String    @id @default(cuid())
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id])
  
  name              String
  description       String?
  color             String    @default("#1E2D4E")
  ownerId           String?   // null = 공유그룹, userId = 개인그룹
  funnelId          String?
  funnel            Funnel?   @relation(fields: [funnelId], references: [id])
  
  // 🆕 역참조 필드 추가
  landingPages      CrmLandingPage[]
  members           ContactGroupMember[]
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([organizationId])
  @@index([ownerId])
  @@index([funnelId])
}
```

**마이그레이션 생성**:
```bash
npx prisma migrate dev --name add_contact_group_landing_pages_relation
```

---

## Step 3: /api/groups/[id]/register — 1h

### 새 파일 생성: `src/app/api/groups/[id]/register/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { upsertContact } from '@/lib/contact-utils';
import { triggerGroupFunnel } from '@/lib/funnel-trigger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/groups/[id]/register
 * 그룹 신청 폼 제출 (공개 엔드포인트)
 * 
 * Body:
 * {
 *   seq: "a7f3b2d1c9e5",      // GroupToken.id
 *   name: "홍길동",
 *   phone: "010-1234-5678",
 *   email: "hong@email.com",
 *   customField1?: "...",
 *   utm_source?: "...",
 *   utm_medium?: "..."
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { seq, name, phone, email, ...customFields } = body;

    // 1️⃣ seq 토큰 검증
    if (!seq) {
      return NextResponse.json({ ok: false, error: 'seq is required' }, { status: 400 });
    }

    const groupToken = await prisma.groupToken.findUnique({
      where: { id: seq },
      include: { group: { select: { id: true, organizationId: true } } }
    });

    if (!groupToken) {
      return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
    }

    // 2️⃣ 토큰 만료 확인
    const now = new Date();
    if (groupToken.expiresAt < now) {
      return NextResponse.json({ ok: false, error: 'Token expired' }, { status: 401 });
    }

    // 3️⃣ 토큰 활성화 상태 확인
    if (!groupToken.active) {
      return NextResponse.json({ ok: false, error: 'Token deactivated' }, { status: 401 });
    }

    const groupId = groupToken.group.id;
    const organizationId = groupToken.group.organizationId;

    // 4️⃣ 기본 필드 검증
    if (!name || !phone) {
      return NextResponse.json(
        { ok: false, error: 'name and phone are required' },
        { status: 400 }
      );
    }

    // 5️⃣ 전화번호 정규화 및 검증
    const normalizedPhone = phone.replace(/[^0-9]/g, '');
    const phoneRegex = /^01[0-9]\d{7,8}$/;
    if (!phoneRegex.test(normalizedPhone)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // 6️⃣ Contact upsert
    const contact = await upsertContact({
      organizationId,
      phone: normalizedPhone,
      name,
      email: email || null,
      type: 'LEAD',
      leadScore: 30,
      adminMemo: `[그룹 신청] from group: ${groupId}`,
    });

    // 7️⃣ ContactGroupMember 추가
    await prisma.contactGroupMember.upsert({
      where: {
        groupId_contactId: { groupId, contactId: contact.id },
      },
      create: {
        groupId,
        contactId: contact.id,
      },
      update: {},
    });

    // 8️⃣ 퍼널 시작 (그룹의 funnelId 기반)
    const triggered = await triggerGroupFunnel({
      contactId: contact.id,
      groupId,
      organizationId,
    });

    logger.info('[groups/register] signup', {
      groupId,
      contactId: contact.id,
      phone: normalizedPhone.slice(0, 4) + '****' + normalizedPhone.slice(-4),
      funnelTriggered: triggered,
    });

    return NextResponse.json({
      ok: true,
      contactId: contact.id,
      groupId,
      funnelTriggered: triggered,
    }, { status: 201 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[groups/register] error', { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
```

### GroupToken 모델 추가: `prisma/schema.prisma`

```prisma
model GroupToken {
  id          String    @id @default(nanoid(12))  // "a7f3b2d1c9e5"
  groupId     String
  group       ContactGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  
  expiresAt   DateTime                            // 7일 후
  active      Boolean   @default(true)
  
  createdAt   DateTime  @default(now())
  
  @@index([groupId])
  @@index([expiresAt])
}
```

ContactGroup 모델에 관계 추가:
```prisma
model ContactGroup {
  // ... 기존 필드
  tokens      GroupToken[]
}
```

### 마이그레이션

```bash
npx prisma migrate dev --name add_group_token_model
```

---

## Step 4: 폼 빌더 UI — 2h

### 설치

```bash
npm install react-beautiful-dnd
npm install -D @types/react-beautiful-dnd
```

### 파일 생성: `src/components/forms/FormBuilder.tsx`

```typescript
'use client';

import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Trash2, Plus } from 'lucide-react';

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'checkbox' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[];  // for select
}

const DEFAULT_FIELDS: FormField[] = [
  { id: 'name', name: 'name', label: '이름', type: 'text', required: true, placeholder: '이름을 입력하세요' },
  { id: 'phone', name: 'phone', label: '연락처', type: 'tel', required: true, placeholder: '010-0000-0000' },
  { id: 'email', name: 'email', label: '이메일', type: 'email', required: false, placeholder: 'email@example.com' },
];

interface FormBuilderProps {
  value: FormField[];
  onChange: (fields: FormField[]) => void;
}

export function FormBuilder({ value = DEFAULT_FIELDS, onChange }: FormBuilderProps) {
  const [fields, setFields] = useState<FormField[]>(value);

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;
    if (source.index === destination.index) return;

    const newFields = Array.from(fields);
    const [removed] = newFields.splice(source.index, 1);
    newFields.splice(destination.index, 0, removed);

    setFields(newFields);
    onChange(newFields);
  };

  const handleToggleRequired = (id: string) => {
    const newFields = fields.map(f =>
      f.id === id ? { ...f, required: !f.required } : f
    );
    setFields(newFields);
    onChange(newFields);
  };

  const handleRemoveField = (id: string) => {
    // 필수 필드는 제거 불가
    if (['name', 'phone'].includes(id)) return;
    
    const newFields = fields.filter(f => f.id !== id);
    setFields(newFields);
    onChange(newFields);
  };

  const handleAddField = () => {
    const newId = `custom_${Date.now()}`;
    const newField: FormField = {
      id: newId,
      name: newId,
      label: '새로운 필드',
      type: 'text',
      required: false,
      placeholder: '입력하세요',
    };
    const newFields = [...fields, newField];
    setFields(newFields);
    onChange(newFields);
  };

  return (
    <div className="space-y-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="form-fields">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={`space-y-2 p-4 rounded border-2 ${
                snapshot.isDraggingOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
              }`}
            >
              {fields.map((field, index) => (
                <Draggable key={field.id} draggableId={field.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`flex items-center gap-3 p-3 rounded border ${
                        snapshot.isDragging ? 'bg-blue-100 border-blue-400' : 'bg-white border-gray-300'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">{field.label}</div>
                        <div className="text-xs text-gray-500">{field.type}</div>
                      </div>

                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={() => handleToggleRequired(field.id)}
                          disabled={['name', 'phone'].includes(field.id)}
                          className="w-4 h-4"
                        />
                        필수
                      </label>

                      {!['name', 'phone'].includes(field.id) && (
                        <button
                          onClick={() => handleRemoveField(field.id)}
                          className="p-1 hover:bg-red-100 rounded"
                        >
                          <Trash2 size={16} className="text-red-500" />
                        </button>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <button
        onClick={handleAddField}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded hover:bg-blue-600"
      >
        <Plus size={16} /> 필드 추가
      </button>

      <div className="p-4 bg-gray-50 rounded text-sm">
        <p className="font-medium mb-2">📋 현재 폼 구성</p>
        <ul className="space-y-1 text-gray-700">
          {fields.map((f, i) => (
            <li key={f.id}>
              {i + 1}. {f.label} ({f.type}){f.required ? ' *' : ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

### 랜딩페이지 편집 페이지에 통합

**파일**: `src/app/(dashboard)/landing-pages/[id]/page.tsx`

적절한 위치(예: formConfig 관리 섹션)에 추가:

```typescript
import { FormBuilder, FormField } from '@/components/forms/FormBuilder';

// ... 페이지 컴포넌트 내부

const [formFields, setFormFields] = useState<FormField[]>(
  landingPage.formConfig?.fields || DEFAULT_FIELDS
);

// UI에 추가
<div className="tab-content">
  <h3 className="text-lg font-semibold mb-4">폼 필드 설정</h3>
  <FormBuilder
    value={formFields}
    onChange={setFormFields}
  />
  {/* 저장 버튼은 기존 코드 참고 */}
</div>
```

---

## Step 5: seq 생성 + 스크립트 자동화 — 1.5h

### 수정 파일: `src/app/api/groups/route.ts` (POST)

**그룹 생성 후 자동 seq 생성 추가** (Line 90 근처):

```typescript
// ... 그룹 생성 코드

const group = await prisma.contactGroup.create({
  data: { ... }
});

// 🆕 자동으로 GroupToken 생성
const token = await prisma.groupToken.create({
  data: {
    groupId: group.id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후
  },
});

logger.info('[groups] created', { groupId: group.id, tokenId: token.id });

return NextResponse.json({ ok: true, group, token }, { status: 201 });
```

---

### 새 파일: `src/lib/form-script-generator.ts`

```typescript
export function generateFormScript(seq: string): string {
  return `<!-- 그룹 신청 폼 (자동 생성) -->
<form action="https://mabiz-crm.kr/api/groups/register" method="POST" onsubmit="return validateForm(this);">
    <input type="hidden" name="seq" value="${seq}"/>
    
    <div class="form-group">
        <label for="name">이름 *</label>
        <input type="text" id="name" name="name" placeholder="이름을 입력하세요" required/>
    </div>
    
    <div class="form-group">
        <label for="phone">연락처 *</label>
        <input type="tel" id="phone" name="phone" placeholder="010-0000-0000" required/>
    </div>
    
    <div class="form-group">
        <label for="email">이메일</label>
        <input type="email" id="email" name="email" placeholder="email@example.com"/>
    </div>
    
    <button type="submit" class="btn-submit">신청하기</button>
</form>

<script>
function validateForm(frm) {
    // 이름 검증
    if (!frm.name.value.trim()) {
        alert("이름을 입력하세요");
        return false;
    }
    
    // 연락처 검증
    const phone = frm.phone.value.replace(/[^0-9]/g, '');
    const phoneRegex = /^01[0-9]\\d{7,8}$/;
    if (!phoneRegex.test(phone)) {
        alert("휴대폰 번호 형식이 잘못되었습니다.\\n예: 010-1234-5678");
        return false;
    }
    
    return true;
}
</script>

<style>
.form-group {
    margin-bottom: 16px;
}

.form-group label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    color: #333;
}

.form-group input {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
}

.form-group input:focus {
    outline: none;
    border-color: #0066cc;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
}

.btn-submit {
    width: 100%;
    padding: 12px;
    background-color: #0066cc;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
}

.btn-submit:hover {
    background-color: #0052a3;
}
</style>
<!-- //그룹 신청 폼 -->`;
}
```

---

### 그룹 상세 페이지에 "스크립트 복사" 버튼 추가

**파일**: `src/app/(dashboard)/groups/page.tsx`

그룹 상세 모달 또는 상세 페이지에 추가:

```typescript
import { generateFormScript } from '@/lib/form-script-generator';
import { Copy, Check } from 'lucide-react';

// ... 그룹 상세 컴포넌트

const [copied, setCopied] = useState(false);

const handleCopyScript = async () => {
  const script = generateFormScript(group.token?.id || '');
  await navigator.clipboard.writeText(script);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};

const handleRefreshToken = async () => {
  const res = await fetch(`/api/groups/${group.id}/refresh-token`, { method: 'POST' });
  const data = await res.json();
  if (data.ok) {
    // 토큰 새로고침 완료 → 스크립트도 자동 갱신
    alert('토큰이 갱신되었습니다');
  }
};

// UI
<div className="space-y-4">
  <h3 className="font-semibold">신청 폼 스크립트</h3>
  
  <div className="p-4 bg-gray-50 rounded border border-gray-200">
    <p className="text-sm text-gray-600 mb-3">
      이 코드를 대리점 웹사이트에 붙여넣으면 신청 폼이 나타납니다.
    </p>
    
    <pre className="bg-white p-3 rounded border text-xs overflow-auto max-h-[200px] mb-3">
      {generateFormScript(group.token?.id || '')}
    </pre>
    
    <div className="flex gap-2">
      <button
        onClick={handleCopyScript}
        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        {copied ? (
          <><Check size={16} /> 복사됨</>
        ) : (
          <><Copy size={16} /> 복사하기</>
        )}
      </button>
      
      <button
        onClick={handleRefreshToken}
        className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
      >
        토큰 갱신
      </button>
    </div>
  </div>
  
  <div className="text-sm text-gray-500">
    <p>토큰 만료일: {group.token?.expiresAt ? new Date(group.token.expiresAt).toLocaleDateString('ko-KR') : '-'}</p>
  </div>
</div>
```

---

### 토큰 갱신 API: `src/app/api/groups/[id]/refresh-token/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/rbac';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getAuthContext();
    const { id } = params;

    const group = await prisma.contactGroup.findUnique({ where: { id } });
    if (!group) {
      return NextResponse.json({ ok: false, error: 'Group not found' }, { status: 404 });
    }

    // 권한 검증
    if (ctx.role === 'OWNER' && group.organizationId !== ctx.organizationId) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }
    if (ctx.role === 'AGENT' && group.ownerId !== ctx.userId) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    // 기존 토큰 비활성화
    await prisma.groupToken.updateMany({
      where: { groupId: id },
      data: { active: false },
    });

    // 새 토큰 생성
    const newToken = await prisma.groupToken.create({
      data: {
        groupId: id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    logger.info('[groups/refresh-token] refreshed', { groupId: id, newTokenId: newToken.id });

    return NextResponse.json({ ok: true, token: newToken });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[groups/refresh-token] error', { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
```

---

## Step 6: P1 이슈 처리 — 1.5h

### P1-1: 그룹 복제 권한 명확화

**파일**: `src/app/api/groups/[id]/clone/route.ts`

확인 후 수정:
- 퍼널도 함께 복제 여부 명시
- 멤버는 복제하지 않음
- 새 seq 토큰 자동 생성

---

### P1-3: 일괄 발송(Blast) — SmsOptOut 추가

**파일**: `src/app/api/groups/[id]/blast/route.ts`

```typescript
// Line 50-60: 기존
const contacts = await prisma.contact.findMany({
  where: {
    contactGroupMembers: { some: { groupId } },
    optOutAt: null,
    phone: { not: '' },
  },
});

// ✅ 수정: SmsOptOut 제외
const blockedPhones = await prisma.smsOptOut.findMany({
  select: { phone: true },
});
const blockedPhoneSet = new Set(blockedPhones.map(b => b.phone));

const contacts = await prisma.contact.findMany({
  where: {
    contactGroupMembers: { some: { groupId } },
    optOutAt: null,
    phone: { not: '' },
  },
});

const targetContacts = contacts.filter(c => !blockedPhoneSet.has(c.phone));
```

---

### P1-4: 메시지 페이지 정리

**파일**: `src/app/(dashboard)/messages/page.tsx`

- 그룹 발송 안내 제거 (또는 링크만 유지)
- 단일 발송 도구로만 명시

---

### P1-5: 퍼널 생성 유연성

**파일**: `src/app/(dashboard)/funnels/page.tsx`

```typescript
// 버튼 2개:
// 1. "VIP 케어 템플릿" → createVipCareFunnel()
// 2. "빈 퍼널 생성" → 빈 퍼널 생성 후 편집 가능
```

---

## Step 7: 보안 IDOR 검증 — 1h

### 모든 수정 엔드포인트 확인

- ✅ `/api/groups/[id]` PATCH/DELETE
- ✅ `/api/landing-pages/[id]` PATCH/DELETE
- ✅ `/api/funnels/[id]` PATCH/DELETE

각각에서:
```typescript
// organizationId 검증 필수
const existing = await prisma.xxxxx.findFirst({
  where: { 
    id,
    organizationId: ctx.role === 'GLOBAL_ADMIN' ? undefined : ctx.organizationId
  }
});

if (!existing) return 403;
```

---

## Step 8: 메뉴 추가 + 통합 테스트 — 30분

### 사이드바 메뉴 추가

**파일**: `src/components/layout/SidebarNav.tsx`

```typescript
// 마케팅 캠페인 섹션에 추가
{
  label: "마케팅 캠페인",
  roles: ["GLOBAL_ADMIN", "OWNER"],
  items: [
    // ... 기존 항목
    { href: "/groups",             icon: Users,        label: "그룹관리" },  // 🆕
    // ... 나머지
  ],
}
```

### 통합 테스트

```bash
# 1. 개발 서버 시작
npm run dev

# 2. GLOBAL_ADMIN 계정
# - /dashboard/groups 접근 확인
# - 그룹 생성 → seq 자동 생성 확인
# - [스크립트 복사] 클릭 → 클립보드 복사 확인
# - [토큰 갱신] 클릭 → 새 seq 생성 확인

# 3. 외부 HTML 테스트
# - 스크립트를 HTML 파일에 붙여넣기
# - 폼 제출 → /api/groups/register로 요청
# - Contact 생성 + 그룹 추가 확인
# - Funnel 시작 확인

# 4. AGENT 계정
# - 자기 그룹만 조회 확인
# - 자기 그룹 수정/삭제 가능 확인
# - 다른 사람 그룹 수정 시도 → 403 확인

# 5. 폼 빌더
# - 필드 Drag-Drop 동작 확인
# - 필드 추가/제거 확인
# - 생성된 HTML이 자동 반영 확인
```

---

## 배포 체크리스트

- [ ] Step 1: AGENT 권한 수정 ✅ → 커밋
- [ ] Step 2: Prisma 역참조 + 마이그레이션 ✅ → 커밋
- [ ] Step 3: /api/groups/[id]/register ✅ → 커밋
- [ ] Step 4: 폼 빌더 UI ✅ → 커밋
- [ ] Step 5: seq 생성 + 스크립트 ✅ → 커밋
- [ ] Step 6: P1 이슈 처리 ✅ → 커밋
- [ ] Step 7: 보안 IDOR ✅ → 커밋
- [ ] Step 8: 메뉴 + 테스트 ✅ → 커밋
- [ ] 최종 코드 리뷰 (병렬 에이전트)
- [ ] 버그 수정 (있으면)
- [ ] 무한루프 완료

---

**다음 단계**: Step 4 (사용자 승인) → Step 6 (구현 시작)