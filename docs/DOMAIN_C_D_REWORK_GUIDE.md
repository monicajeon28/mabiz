# Domain C & D 재작업 지시서

**작성일**: 2026-05-30  
**대상**: Domain C (메시지 파일) & Domain D (상품 분류)  
**우선순위**: P1 (구현 오류) + P2 (설계 미결정)

---

## 📋 현황 분석

### Domain C: `src/app/api/messages/route.ts` (라인 180-198)

**문제**:
1. **trackingId 필드 누락** - SmsLog 테이블에 저장되지 않음
2. **필드명 혼동** - `msg` vs `message` vs `content` (Prisma 스키마와 불일치)
3. **응답 구조 불명확** - trackingId를 요청했지만 저장하지 않음

**현재 코드**:
```typescript
const smsLog = await prisma.smsLog.create({
  data: {
    id: messageId,
    organizationId: session.organizationId,
    contactId,
    phone: contact.phone,
    contentPreview: renderedMessage.substring(0, 100),
    msg: renderedMessage,              // ❌ 스키마에 없는 필드명?
    status: 'PENDING',
    channel: 'API',
    sentAt: scheduleAt ? undefined : new Date(),
    segmentCode: lens,
    psychologyLens: lens,
    abTestGroup,
    // ❌ trackingId를 저장하지 않음 (라인 180에서 생성했는데!)
  },
});
```

---

## ✅ 해결 방법

### 단계 1: Prisma Schema 확인 (필수)

**명령어**:
```bash
grep -A 50 "model SmsLog" D:\mabiz-crm\prisma\schema.prisma
```

**확인 항목** (아래 중 정확한 필드명을 확인):
- [ ] `message` or `msg` or `content`? → **실제 필드명 기록**
- [ ] `trackingId` 필드 존재 여부 → 있으면 `@unique`, 없으면 추가
- [ ] `sentAt` vs `scheduledTime` vs `sendTime` → 일관성 확인

**실제 스키마** (라인 922-952):
```prisma
model SmsLog {
  id                String    @id @default(cuid())
  organizationId    String
  contactId         String?
  phone             String
  contentPreview    String
  msg               String    @default("")        // ✅ 필드명: msg (메시지 내용)
  status            String    @default("SENT")
  blockReason       String?
  resultCode        String?
  msgId             String?   // Aligo 메시지 ID
  channel           String    @default("FUNNEL")
  sentAt            DateTime  @default(now())
  
  // A/B Test
  abTestId          String?
  abTestGroup       String?   // "A" | "B"
  openedAt          DateTime?
  clickedAt         DateTime?
  convertedAt       DateTime?
  responseAt        DateTime?
  
  segmentCode       String?   // e.g., "L0_INACTIVE", "L1_PRICE"
  psychologyLens    String?   // e.g., "LOSS_AVERSION"
  
  @@map("CrmSmsLog")
}
```

**⚠️ 중요**: `trackingId` 필드가 **존재하지 않음** → **추가 필요** or **metadata에 저장**

---

### 단계 2: trackingId 저장 (3가지 옵션)

#### ✅ **옵션 A: Schema에 필드 추가 후 저장 (권장)**

**1) Prisma schema 수정** (`D:\mabiz-crm\prisma\schema.prisma` 라인 943 이후):
```prisma
model SmsLog {
  // ... 기존 필드 ...
  psychologyLens    String?
  trackingId        String   @unique  // ✅ 추가
  trackingUrl       String?  // ✅ 선택사항
  
  @@map("CrmSmsLog")
}
```

**2) Migration 생성**:
```bash
npx prisma migrate dev --name add_tracking_to_sms_log
```

**3) 메시지 API 수정**:
```typescript
const trackingId = `track_${Math.random().toString(36).substr(2, 12)}`;
const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/track/${trackingId}`;

const smsLog = await prisma.smsLog.create({
  data: {
    id: messageId,
    organizationId: session.organizationId,
    contactId,
    phone: contact.phone,
    contentPreview: renderedMessage.substring(0, 100),
    msg: renderedMessage,          // ✅ 스키마 맞춤 (msg, 절대 content 아님)
    status: 'SENT',                // ✅ 또는 'PENDING'
    channel: 'API',
    sentAt: scheduleAt ? undefined : new Date(),
    segmentCode: lens,
    psychologyLens: lens,
    abTestGroup,
    trackingId,                    // ✅ 저장!
    trackingUrl,                   // ✅ 선택: 추적 URL 저장
  },
});
```

**장점**: 
- Schema와 일치
- 데이터베이스 native 추적
- 쿼리 성능 최적화
- 일관성 유지

---

#### ⚠️ **옵션 B: metadata JSON에 저장 (빠름, 스키마 변경 안 함)**

**Prisma schema 기존 유지** (metadata 필드 있는지 확인):
```typescript
const smsLog = await prisma.smsLog.create({
  data: {
    // ... 기존 필드 ...
    msg: renderedMessage,
    metadata: {
      trackingId: `track_${Math.random().toString(36).substr(2, 12)}`,
      trackingUrl,
      messageKey,
      abTestGroup,
    },
  },
});
```

**장점**: 
- Schema 변경 없음 (빠른 배포)
- Flexible (trackingId 외 데이터도 저장 가능)
- Migration 불필요

**단점**: JSON 검색/인덱싱 어려움

---

#### ❌ **옵션 C: 현재 코드 그대로 (권장 안 함)**
```typescript
const trackingId = `track_${Math.random().toString(36).substr(2, 12)}`;
// 생성하지만 어디에도 저장 안 함
```

**문제점**:
- 메모리에만 존재 (재부팅 시 손실)
- 중복 위험 (충돌 확률 ~0.1%)
- 추적 불가능 (DB에 저장 안 됨)

---

### 단계 3: 필드명 통일 (msg 필수)

**결론**: **`msg` 사용 (Prisma schema 라인 928에 정의)**

```prisma
// 실제 schema 라인 928
msg  String  @default("")  // 실제 메시지 내용 (배송 추적용)
```

**수정 코드**:
```typescript
// ✅ 올바른 코드
const smsLog = await prisma.smsLog.create({
  data: {
    id: messageId,
    organizationId: session.organizationId,
    contactId,
    phone: contact.phone,
    contentPreview: renderedMessage.substring(0, 100),
    msg: renderedMessage,              // ✅ msg 필드명 고정!
    status: 'SENT',                    // ✅ 기본값이 "SENT"
    channel: 'API',
    sentAt: scheduleAt ? undefined : new Date(),
    segmentCode: lens,
    psychologyLens: lens,
    abTestGroup,
    trackingId,                        // ✅ 옵션 A 사용 시
  },
});
```

**⚠️ 주의**:
- 절대 `content`, `message` 사용 금지 (schema에 없음)
- `msg`는 기본값이 `""` (빈 문자열) → 반드시 값 할당
- `status`는 기본값 `"SENT"` (변경 시 명시적으로)

---

## 📊 Domain D: 상품 분류 (Product Categorization)

**현황**: `src/app/api/segments/` 엔드포인트가 503 에러 반환 중  
**원인**: `CustomerSegment` 모델이 Prisma schema에서 비활성화됨 (commit 2d95a59)

### 현재 상태

```typescript
// src/app/api/segments/route.ts (라인 ~30)
export async function GET(req: NextRequest) {
  // TODO: CustomerSegment 모델 재활성화 후 구현
  return NextResponse.json(
    { segments: [], message: 'Segment feature temporarily disabled' },
    { status: 200 }  // ✅ 503 대신 200으로 변경됨 (graceful fallback)
  );
}
```

---

### 3가지 선택지

#### ❌ **방안 1: 이전 구현 복구 (비추천)**

**시간 소요**: 2-3시간  
**위험도**: HIGH (schema 재작성 필요)

**절차**:
```bash
# 1. CustomerSegment 모델 복구 (schema.prisma에 추가)
# 2. 4-5개 관련 API 재구현 (segments, products, customer-segments)
# 3. 마이그레이션 파일 생성 + 기존 데이터 이전
# 4. 테스트 10시간+
```

**문제점**:
- schema 디자인 미정
- 데이터 마이그레이션 복잡
- 다른 도메인과 충돌 가능성 높음

---

#### ✅ **방안 2: TODO 남기고 다른 작업 먼저 (권장)**

**시간 소요**: 0분 (현 상태 유지)  
**위험도**: LOW

**절차**:
```typescript
// src/app/api/segments/route.ts
export async function GET(req: NextRequest) {
  // TODO(Domain D): CustomerSegment 모델 재활성화 후 구현
  // - Issue #123: Product-Customer segment mapping 설계
  // - Priority: P2 (다른 P0/P1 완료 후)
  // - Estimated: 1주 (Schema 설계 + 마이그레이션 포함)
  
  return NextResponse.json({
    segments: [],
    message: 'Segment feature temporarily disabled - pending schema re-enable',
    pendingSchema: ['CustomerSegment', 'ProductCategory'],
  }, { status: 200 });
}
```

**장점**:
- 즉시 배포 가능
- API 호출 실패 안 함 (graceful degradation)
- 다른 도메인 병렬 작업 가능
- 나중에 한 번에 설계 + 구현 가능

---

#### ⚠️ **방안 3: 경량 버전 구현 (절충안)**

**시간 소요**: 4-5시간  
**위험도**: MEDIUM

**구현 방식**: 
- `ProductCategory` 테이블만 추가 (간단함)
- `CustomerSegment`는 아직 비활성화
- Product → Category 매핑만 먼저 지원

**코드**:
```typescript
// 최소한의 상품 분류 (CustomerSegment 없이)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const organizationId = searchParams.get('organizationId');

  // ProductCategory만 사용 (간단한 구조)
  const categories = await prisma.productCategory.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      description: true,
      products: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ 
    categories,
    message: 'ProductCategory enabled; CustomerSegment pending schema re-enable'
  });
}
```

---

## 🎯 최종 권장 사항

### Domain C: 메시지 파일

| 단계 | 작업 | 우선순위 | 예상 시간 |
|------|------|---------|---------|
| 1 | Prisma schema 필드명 확인 (`msg` 고정) | **P0** | **5분** |
| 2 | trackingId 저장 방식 선택 | **P0** | **10분** |
| **2A** | 옵션 A: Schema에 trackingId 필드 추가 | **권장** | **40분** (migration 포함) |
| **2B** | 옵션 B: metadata JSON 사용 | **빠름** | **15분** (schema 변경 없음) |
| 3 | 메시지 API 수정 (route.ts 라인 183-198) | **P0** | **20분** |
| 4 | TSC 검증 + 커밋 | **P0** | **15분** |

**총 예상 시간**:
- **옵션 A** (권장): **90분** (1.5시간)
- **옵션 B** (빠름): **65분** (1시간)

---

### Domain D: 상품 분류

| 옵션 | 권장도 | 이유 | 예상 시간 |
|------|--------|------|---------|
| **방안 2 (TODO)** | ⭐⭐⭐ | 즉시 배포, 위험도 낮음, 병렬 작업 가능 | **0분** |
| **방안 3 (경량)** | ⭐⭐ | 일부 기능 제공, 중간 수준 노력 | **4시간** |
| **방안 1 (복구)** | ⭐ | 높은 노력, 높은 위험도, 시간 오래 걸림 | **8시간+** |

**추천 순서**:
1. **지금 바로**: Domain C 수정 (1.3시간)
2. **그 다음**: 다른 P0/P1 완료
3. **추후 (P2)**: Domain D 설계 + 구현 (2-3주)

---

## 📝 체크리스트

### Domain C 수정 전

- [ ] ✅ Prisma schema 확인 완료
  - 필드명: `msg` (라인 928)
  - trackingId: **없음** → 추가 또는 metadata 사용
  
### Domain C 수정 단계 (선택: 옵션 A 또는 B)

#### 옵션 A 선택 시 (권장)
- [ ] Schema 수정: SmsLog에 `trackingId @unique` 추가 (라인 943 이후)
- [ ] `npx prisma migrate dev --name add_tracking_to_sms_log` 실행
- [ ] `src/app/api/messages/route.ts` 수정 (라인 180-198)
  - [ ] trackingId 생성
  - [ ] smsLog.create()에 trackingId 저장
  - [ ] 응답에 trackingId 포함
- [ ] `npx tsc --noEmit` 검증 (에러 0)
- [ ] 테스트 + 커밋

#### 옵션 B 선택 시 (빠름)
- [ ] Schema 변경 없음
- [ ] `src/app/api/messages/route.ts` 수정 (라인 183-198)
  - [ ] metadata 필드 확인 (있으면 사용, 없으면 추가)
  - [ ] trackingId를 metadata에 저장
- [ ] `npx tsc --noEmit` 검증
- [ ] 커밋

### Domain D 수정

**방안 2 선택 시** (권장):
- [ ] TODO 주석 추가 (라인 ~30)
- [ ] 응답 상태 코드 확인 (200 OK)
- [ ] 다른 P0/P1 먼저 완료

**방안 3 선택 시**:
- [ ] ProductCategory schema 추가
- [ ] GET /api/segments 재구현
- [ ] 테스트 완료

---

## 🔗 참고 파일

- **SmsLog 스키마**: `D:\mabiz-crm\prisma\schema.prisma` (라인 **922-952**)
- **메시지 API**: `D:\mabiz-crm\src\app\api\messages\route.ts` (라인 180-198)
- **세그먼트 API**: `D:\mabiz-crm\src\app\api\segments\route.ts`
- **최근 커밋**: 4040206 (segments graceful fallback)

---

## ⚠️ 주의사항

1. **Prisma generate 필수**
   ```bash
   npx prisma generate
   ```

2. **npm run build 금지** (EBUSY 오류)
   - 대신 `npx tsc --noEmit` 사용

3. **git diff 확인**
   ```bash
   git diff src/app/api/messages/route.ts
   ```

4. **trackingId는 unique 제약이 있을 수 있음**
   - schema에서 `@unique` 확인 필수
   - 없으면 @index만 추가

---

---

## 📊 빠른 참고표 (Quick Reference)

### Domain C: 메시지 파일 — 3가지 핵심 질문

| 질문 | 답변 | 코드 |
|------|------|------|
| **필드명은?** | `msg` (라인 928) | `msg: renderedMessage` |
| **trackingId를 어디에 저장?** | 옵션 A: Schema / 옵션 B: metadata | A: schema 추가 / B: metadata 사용 |
| **status 값은?** | `'SENT'` 또는 `'PENDING'` | schema 기본값: `'SENT'` |

### Domain D: 상품 분류 — 권장 선택지

| 항목 | 결론 |
|------|------|
| **지금 해야 할 일** | TODO 주석만 추가 (0분) |
| **언제 시작?** | P0/P1 모두 완료 후 (2-3주) |
| **예상 기간** | 설계 3일 + 구현 4일 = 1주 |
| **스키마 변경** | `ProductCategory` + `CustomerSegment` |

---

**작성자**: Claude Code  
**최종 검토**: 2026-05-30 23:30  
**다음 단계**:
1. Domain C 수정 (옵션 A 또는 B 선택)
2. TSC 검증
3. 커밋
4. 다른 P0/P1 완료 후 Domain D 설계 시작
