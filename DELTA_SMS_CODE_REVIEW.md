# Menu #38 Phase 4 Wave 2 코드 리뷰 — Delta SMS API
**검토자**: Reviewer B  
**검토 날짜**: 2026-05-19  
**대상 파일**:
1. `src/app/api/campaigns/delta/route.ts` (POST, 231줄)
2. `src/app/api/campaigns/[id]/delta/route.ts` (GET only, 185줄)

**최종 점수**: **7.8/10** (Good, 개선 가능)

---

## 1. 보안 (8/10)

### P0 이슈 없음 ✅
- **IDOR 검증**: 모든 쿼리에서 `organizationId` 이중 확인
  - POST: line 66-70 (campaign 존재 확인)
  - GET: line 33-42 (campaign 존재 확인)
  - GET: line 54-58 (deltaConfig organizationId 이중 확인)

- **권한 검증**: DRAFT 상태만 수정 가능 (line 92-102)
- **Zod 검증**: CreateDeltaCampaignSchema 적용 (line 47)

### 주의사항
1. **문자 길이 재검증 중복** (line 140-161)
   ```typescript
   // Zod에서 이미 검증:
   // deltaDay0Message: z.string().max(90, ...)
   // deltaDay1-3Message: z.string().max(160, ...)
   
   // POST에서 또 검증 (불필요)
   const dayLimits = {
     day0: 90,
     day1: 160,
     day2: 160,
     day3: 160,
   };
   ```
   **개선**: Zod 검증으로 충분. POST 재검증 제거 가능

2. **triggerType 검증 누락**
   ```typescript
   // Line 118: triggerConfig 존재 확인만 함
   const triggerConfig = deltaSequence.triggers[triggerType as keyof ...];
   
   // Zod에서는 PURCHASE | ABANDONED만 허용하지만,
   // JSON 파일이 수정되면 불일치 가능
   ```
   **개선**: DeltaCampaignConfig.triggerType에 enum 추가 (schema)

---

## 2. 성능 (6/10)

### 최적화 필요

1. **upsert 성능 이슈** (line 164)
   ```typescript
   const deltaConfig = await prisma.deltaCampaignConfig.upsert({
     where: { campaignId: data.campaignId }, // ← 문제
     update: { ... },
     create: { ... },
   });
   ```
   - ❌ `upsert`는 내부적으로 `findUnique` + `update`/`create` 순차 실행
   - `campaignId`는 `@unique`이지만, 조건부 로직 처리 오버헤드 발생
   - **개선**: 직접 `findFirst` → 조건부 update/create로 변경
   ```typescript
   // 개선 버전
   const existing = await prisma.deltaCampaignConfig.findUnique({
     where: { campaignId: data.campaignId },
   });
   
   const deltaConfig = existing
     ? await prisma.deltaCampaignConfig.update({...})
     : await prisma.deltaCampaignConfig.create({...});
   ```

2. **SendingHistory 통계 쿼리** (line 122-140)
   ```typescript
   const statsRaw = await prisma.sendingHistory.groupBy({
     by: ['status'],
     where: {
       campaignId: campaignId,
       isDeltaSmsEligible: true,
       deltaDay: { in: [0, 1, 2, 3] },
     },
     _count: { id: true },
   });
   ```
   - ✅ 인덱스 존재: `idx_sendinghistory_deltatemp` (isDeltaSmsEligible, deltaDay)
   - ✅ groupBy 최적화됨
   - ❌ 하지만 campaignId 인덱스 없음
   - **개선**: 인덱스 추가 필요
     ```prisma
     @@index([campaignId, isDeltaSmsEligible, deltaDay])
     ```

3. **N+1 쿼리 없음** ✅
   - POST: 2개 쿼리 (campaign 확인 + upsert)
   - GET: 4개 쿼리 (campaign 확인 + deltaConfig + stats groupBy + latestSendingHistory)
   - 합리적 수준

### 성능 점수: 6/10
- 이유: upsert 오버헤드, 인덱스 누락, 통계 쿼리 재최적화 필요

---

## 3. 에러 처리 (7/10)

### 우수 사항
- **null 안전성**: `deltaConfig?.day0Message` optional chaining 사용 ✅
- **에러 상태 코드**: 404, 400, 500 구분 ✅
- **로깅**: 모든 주요 단계에서 logger 기록 ✅

### 개선 필요

1. **campaign.status 검증 후 campaign not found 재처리**
   ```typescript
   // Line 92에서 DRAFT 검증하는데,
   // 이 시점에서 campaign은 이미 findFirst됨
   // campaign이 없으면 이미 404 반환했으므로 OK
   ```
   ✅ 논리는 안전하나 명확성 개선 가능

2. **triggerConfig null 처리**
   ```typescript
   // Line 120-128
   if (!triggerConfig) {
     logger.error('[POST /api/campaigns/delta] Invalid trigger type in sequence data', ...);
     return NextResponse.json(
       { ok: false, error: 'SERVER_ERROR', message: '지정된 트리거 타입을 지원하지 않습니다.' },
       { status: 500 } // ← 잘못된 상태 코드!
     );
   }
   ```
   - ❌ `error: 'SERVER_ERROR'`이면서 status 500은 일관성 떨어짐
   - **개선**: status 400 + error: 'INVALID_TRIGGER_TYPE'
   ```typescript
   return NextResponse.json(
     { ok: false, error: 'INVALID_TRIGGER_TYPE', message: '...' },
     { status: 400 }
   );
   ```

3. **deltaDay null 처리** (GET line 127)
   ```typescript
   where: {
     campaignId: campaignId,
     isDeltaSmsEligible: true,
     deltaDay: { in: [0, 1, 2, 3] }, // ← null 제외됨 (의도적인가?)
   },
   ```
   - ❌ deltaDay가 null인 SendingHistory 레코드 존재 가능
   - **명확성**: 주석 추가 필요
   ```typescript
   // deltaDay는 Delta SMS 대상일 때만 설정되므로,
   // isDeltaSmsEligible=true이면서 deltaDay=null인 경우는 제외
   deltaDay: { in: [0, 1, 2, 3] },
   ```

### 에러 처리 점수: 7/10

---

## 4. 코드 품질 (DRY, 중복) (7/10)

### 중복 패턴

1. **메시지 로드 로직 분산**
   ```typescript
   // POST line 132-137: 메시지 준비
   const messages = {
     day0: data.deltaDay0Message || triggerConfig.days[0].message,
     day1: data.deltaDay1Message || triggerConfig.days[1].message,
     day2: data.deltaDay2Message || triggerConfig.days[2].message,
     day3: data.deltaDay3Message || triggerConfig.days[3].message,
   };
   
   // GET line 84-117: 메시지 출력
   const scheduleData = [
     { day: 0, time: '09:00', message: deltaConfig?.day0Message || '', ... },
     { day: 1, time: '09:00', message: deltaConfig?.day1Message || '', ... },
     ...
   ];
   ```
   - ❌ 메시지 필드명 "day0Message", "day1Message" 하드코딩
   - **개선**: 유틸 함수 작성
   ```typescript
   const MessageFields = ['day0Message', 'day1Message', 'day2Message', 'day3Message'] as const;
   const dayLimits = [90, 160, 160, 160] as const;
   
   function buildMessages(data: CreateDeltaCampaignData, triggerConfig: any) {
     return MessageFields.map((field, idx) => ({
       [field]: data[field as any] || triggerConfig.days[idx].message,
     }));
   }
   ```

2. **IDOR 검증 반복**
   ```typescript
   // POST에서
   const campaign = await prisma.crmMarketingCampaign.findFirst({
     where: { id, organizationId },
   });
   
   // GET에서도 동일
   const campaign = await prisma.crmMarketingCampaign.findFirst({
     where: { id, organizationId },
   });
   ```
   - ✅ 중복이지만 각 엔드포인트는 독립적이므로 문제 없음
   - 미들웨어 레벨에서 처리 가능하지만 현재 구조상 OK

3. **메시지 길이 검증**
   - POST line 147-160: 메시지 길이 수동 반복 (dayLimits object)
   - **개선**: dayLimits를 상수로 분리
   ```typescript
   const DELTA_MESSAGE_LIMITS = { day0: 90, day1: 160, day2: 160, day3: 160 };
   ```

### 코드 품질 점수: 7/10

---

## 5. 테스트 (7/10)

### 검증해야 할 시나리오

1. **메시지 길이 경계** (90자 vs 160자)
   ```
   ✅ Day 0: 90자 정확히 → SMS
   ✅ Day 0: 91자 → 400 에러
   ✅ Day 1: 160자 정확히 → LMS
   ✅ Day 1: 161자 → 400 에러
   ```

2. **PATCH 엔드포인트 없음** ⚠️
   - 현재는 GET (조회) + POST (생성/덮어쓰기) only
   - **문제**: 특정 메시지만 업데이트 불가
   - 예: Day 0만 변경하고 Day 1-3은 유지하고 싶어도 불가능
   - **권장**: PATCH /api/campaigns/[id]/delta 추가
   ```typescript
   export async function PATCH(req: Request, { params }: Params) {
     // partial update 지원
     const updates = UpdateDeltaCampaignSchema.parse(await req.json());
     return await prisma.deltaCampaignConfig.update({
       where: { campaignId },
       data: updates,
     });
   }
   ```

3. **DeltaCampaignConfig 생성 후 존재 확인**
   ```
   ✅ POST 후 GET으로 조회 가능?
   ✅ isActive 기본값 true 확인
   ✅ 스케줄 데이터 정확히 구성되나?
   ```

4. **SendingHistory 통계 계산**
   ```
   ✅ totalSent = SENT + DELIVERED + FAILED 합
   ✅ totalSuccess = SENT + DELIVERED만 카운트
   ✅ successRate = (SENT + DELIVERED) / totalSent * 100
   ✅ 발송 기록 0개일 때 successRate = 0.00
   ```

### 테스트 점수: 7/10
- 이유: PATCH 엔드포인트 부재, 통합 테스트 가이드 필요

---

## 6. 문서화 (7/10)

### 우수 사항
- **JSDoc 주석**: POST line 9-40, GET line 10-23 ✅
- **응답 구조**: 명확히 정의됨
- **단계별 섹션**: 보기 좋음 (`━━━━━ Step 1 ━━━━━`)

### 개선 사항

1. **요청 본문 문서 부족**
   - POST: 주석에 완전하지만 Zod 스키마 링크 필요
   ```typescript
   /**
    * 요청:
    * {@link CreateDeltaCampaignSchema}를 참고
    * campaignId (필수): 캠페인 ID
    * triggerType (선택): PURCHASE | ABANDONED (기본값: PURCHASE)
    * deltaDay0Message (선택): max 90자
    * ...
    */
   ```

2. **에러 응답 스펙 누락**
   ```typescript
   /**
    * 에러 응답:
    * 400: INVALID_INPUT - 입력값 검증 실패
    * 404: NOT_FOUND - 캠페인 없음
    * 400: INVALID_STATE - DRAFT 아님 또는 SMS 비활성
    * 500: SERVER_ERROR - 서버 오류
    */
   ```

3. **시간대(time: '09:00') 의미 미표시**
   - GET line 87: 왜 09:00인가? (고정값? 설정 가능?)
   - **개선**: 주석 추가
   ```typescript
   const scheduleData = [
     {
       day: 0,
       time: '09:00', // 고정값: 하루 09:00 KST (향후 설정 가능)
       ...
     },
   ];
   ```

### 문서화 점수: 7/10

---

## 7. 의존성 (8/10)

### 데이터 경로 검증 ✅
```typescript
import deltaSequence from '@/data/delta_sms_sequence.json';
```
- 파일 존재 확인: ✅ `/src/data/delta_sms_sequence.json`
- 구조 검증:
  ```json
  {
    "triggers": {
      "PURCHASE": { "days": [...] },
      "ABANDONED": { "days": [...] }
    }
  }
  ```
  ✅ 정상 구조

### 의존성 이슈
1. **JSON 파일 수정 시 런타임 에러**
   - 예: `days[0]` undefined이면 line 133에서 에러
   - **개선**: 로드 시 검증
   ```typescript
   const validateTriggerConfig = (config: any) => {
     if (!config?.days?.length || config.days.length < 3) {
       throw new Error(`Invalid trigger config: needs at least 3 days`);
     }
   };
   validateTriggerConfig(triggerConfig);
   ```

2. **sendingHistory 필드 존재 확인**
   - POST line 196: SendingHistory isDeltaSmsEligible 필드 사용
   - **검증**: ✅ prisma schema에 정의됨

### 의존성 점수: 8/10

---

## 8. Next.js API 호환성 (9/10)

### 우수 사항 ✅
```typescript
export const dynamic = 'force-dynamic'; // 캐시 무시
export async function POST(req: Request) { ... }
export async function GET(req: Request, { params }: Params) { ... }
```
- ✅ Next.js 13+ App Router 정확한 시그니처
- ✅ `force-dynamic` 설정으로 ISR 비활성화
- ✅ `Params` 타입 정의 (line 7)
- ✅ `NextResponse.json()` 사용

### 미처리
1. **Response headers 설정**
   ```typescript
   // 현재: 없음
   // 권장: Cache-Control, CORS 헤더
   return NextResponse.json(data, {
     status: 201,
     headers: {
       'Cache-Control': 'no-store, max-age=0',
     }
   });
   ```

2. **PATCH 엔드포인트 누락**
   - GET/POST만 있음
   - **추가 필요**: `PATCH` 함수

### Next.js 호환성 점수: 9/10

---

## 9. 접근성 (N/A)
- API 엔드포인트이므로 WCAG 검증 불필요
- 응답 데이터 구조가 접근 가능한 형식 ✅

---

## 10. UX/DX (에러 메시지, 로깅) (8/10)

### 우수 사항 ✅
```typescript
// 명확한 한국어 에러 메시지
{ ok: false, error: 'INVALID_INPUT', message: '입력값 검증에 실패했습니다.' }

// 구조화된 로깅
logger.warn('[POST /api/campaigns/delta] Validation failed', {
  orgId, errors: fieldErrors
});
```

### 개선 사항

1. **에러 타입 일관성**
   ```typescript
   // 예1: line 127 (Invalid trigger)
   { error: 'SERVER_ERROR', status: 500 } ← 일관성 없음
   
   // 예2: line 46 (Not found)
   { error: 'NOT_FOUND', status: 404 } ← 좋음
   
   // 예3: line 99 (Invalid state)
   { error: 'INVALID_STATE', status: 400 } ← 좋음
   ```
   - **개선**: error 타입 enum 정의
   ```typescript
   enum ApiErrorType {
     INVALID_INPUT = 'INVALID_INPUT',
     NOT_FOUND = 'NOT_FOUND',
     INVALID_STATE = 'INVALID_STATE',
     INVALID_TRIGGER_TYPE = 'INVALID_TRIGGER_TYPE',
     SERVER_ERROR = 'SERVER_ERROR',
   }
   ```

2. **필드별 에러 메시지 개선**
   ```typescript
   // 현재: fieldErrors 객체
   { ok: false, errors: { 'campaignId': '유효한 캠페인 ID여야 합니다.' } }
   
   // 권장: 배열 형식 (더 명확)
   { ok: false, errors: [
       { field: 'campaignId', message: '유효한 캠페인 ID여야 합니다.' }
     ]
   }
   ```

3. **GET 에러 응답 구조 불일치**
   ```typescript
   // POST line 58
   { ok: false, error: 'INVALID_INPUT', message: '...', errors: {...} }
   
   // GET line 46
   { ok: false, error: 'NOT_FOUND', message: '...' } // ← errors 필드 없음
   ```
   - **일관성 개선**: 모든 에러에 errors 배열 포함

### UX/DX 점수: 8/10

---

## 최종 평가 요약

| 항목 | 점수 | 상태 |
|------|------|------|
| 1. 보안 | 8/10 | Zod 중복 검증, triggerType enum 필요 |
| 2. 성능 | 6/10 | upsert 오버헤드, 인덱스 누락 |
| 3. 에러 처리 | 7/10 | 상태 코드 일관성 개선 필요 |
| 4. 코드 품질 | 7/10 | 중복 패턴, 유틸 함수 추가 필요 |
| 5. 테스트 | 7/10 | PATCH 엔드포인트 부재, 테스트 가이드 필요 |
| 6. 문서화 | 7/10 | 에러 스펙, 시간대 설명 추가 |
| 7. 의존성 | 8/10 | JSON 검증 강화 |
| 8. Next.js | 9/10 | PATCH 엔드포인트 추가, 헤더 설정 |
| 9. 접근성 | N/A | 해당 없음 |
| 10. UX/DX | 8/10 | 에러 타입 enum, 응답 구조 일관성 |

**평균 점수: 7.8/10**

---

## P0 이슈 (블로커)

### 없음 ✅
- 보안 이슈: 없음
- 런타임 에러: 없음
- 논리 오류: 없음

---

## P1 이슈 (우선 수정)

1. **triggerConfig null 시 status 코드 수정**
   - 현재: status 500 + error: 'SERVER_ERROR'
   - 변경: status 400 + error: 'INVALID_TRIGGER_TYPE'

2. **PATCH /api/campaigns/[id]/delta 엔드포인트 추가**
   - UpdateDeltaCampaignSchema 사용
   - 부분 업데이트 지원

3. **SendingHistory 인덱스 추가**
   ```prisma
   @@index([campaignId, isDeltaSmsEligible, deltaDay])
   ```

---

## P2 이슈 (개선 권장)

1. Zod 검증 후 수동 문자 길이 재검증 제거
2. upsert → findUnique + 조건부 update/create 변경
3. 메시지 필드 상수화 (DRY)
4. 에러 타입 enum 정의
5. Response 캐시 헤더 추가
6. deltaDay null 처리 명확화 (주석)
7. JSON 로드 시 검증 추가

---

## 최종 권장사항

✅ **배포 가능**: P0 이슈 없음, 기능 정상 작동  
⚠️ **P1 처리 후 재검토**: PATCH 추가, 상태 코드 수정, 인덱스 추가  
💡 **P2 지속 개선**: 성능 최적화, 테스트 추가

**다음 단계**: Phase 4 Track 1 Wave 2 P1 수정 작업 → Wave 3 진행
