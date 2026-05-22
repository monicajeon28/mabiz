# Phase 4 Wave 1: PNR 페이지 리펙토링 최종 작업지시서

## 진행 상태
- ✅ Step 1: 코드 리뷰 완료 (Alpha)
- ✅ Step 2: 10렌즈 분석 완료 (Lens 1-4 + 예정)
- ⏳ Step 3: 작업지시서 (본 문서)
- ⏳ Step 4: 실행 (병렬 또는 순차)
- ⏳ Step 5: 검증

---

## 1. 종합 평가 (10렌즈 통합 점수)

| Lens | 현황 | 예상개선 | 우선순위 |
|------|------|--------|--------|
| **1. 보안** | 3.2/10 ❌ | 7.8/10 | **P0** |
| **2. 성능** | 6.3/10 ⚠️ | 8.5/10 | P1 |
| **3. 유지보수** | 5.5/10 ⚠️ | 8.2/10 | P1 |
| **4. 타입 안전성** | 6.2/10 ⚠️ | 8.5/10 | P1 |
| **5-10. (예정)** | - | - | - |
| **평균** | **5.3/10** | **8.3/10** | - |

---

## 2. P0 Critical 이슈 (즉시 수정 - 2-3시간)

### P0-α: POST /api/pnr/customer/submit - 소유권 검증 부재 [보안]

**위험도**: CRITICAL (Privilege Escalation + 데이터 변조)

**문제 코드** (submit/route.ts:25-29):
```typescript
const rbacCheck = enforceRBAC(req, {
  authOnly: true,  // ← 모든 인증사용자 허용 = IDOR
});
if (rbacCheck !== true) return rbacCheck;
```

**공격 시나리오**:
- FREE_SALES 계정이 다른 사용자의 reservationId(999) 알면 타인 PNR 정보 수정 가능

**수정 내용**:
1. 세션에서 organizationId 추출
2. 요청된 예약이 해당 조직에 속하는지 확인
   ```typescript
   const isOwner = await prisma.contact.findFirst({
     where: {
       organizationId: session.organizationId,
       reservations: { some: { id: reservationId } }
     }
   });
   if (!isOwner) return { status: 403 };
   ```
3. GLOBAL_ADMIN만 모든 조직 예약 수정 가능

**파일**: `src/app/api/pnr/customer/submit/route.ts`
**라인**: 25-81 수정
**난이도**: 1시간

---

### P0-β: GET /api/pnr/customer/{id}?phone - IDOR + PII 노출 [보안]

**위험도**: CRITICAL (민감정보 노출 + 무차별 접근)

**문제**:
- 누구나 phone 파라미터만으로 타인 예약 정보 조회 가능
- residentNum(주민번호), phone 등 민감정보 그대로 노출

**수정 내용**:
1. phone 검증 로직 강화 (정확 일치만 허용)
2. 응답에서 민감정보 제외:
   ```typescript
   travelers: travelers.map(t => ({
     id: t.id,
     korName: t.korName,
     roomNumber: t.roomNumber,
     // ❌ residentNum, phone 제외
   }))
   ```
3. 부일치 시 감사 로그 기록

**파일**: `src/app/api/pnr/customer/[reservationId]/route.ts`
**라인**: 신규 또는 기존 엔드포인트 수정
**난이도**: 2시간

---

### P0-γ: Traveler 인터페이스 - DB 스키마 불일치 [타입 안전성]

**문제**:
```typescript
// 클라이언트 인터페이스 (page.tsx:8-15)
interface Traveler {
  id?: number;           // ← optional이지만 DB는 필수
  korName: string;
  residentNum: string;
  phone: string;
  roomColor: string;     // ← DB에 없음 (UI only)
}

// API 응답 (submit/route.ts:98-109)
travelers: [{
  id: t.id,             // ← 필수인데 optional로 받음
  engSurname: t.engSurname,  // ← 클라이언트에 없음
  engGivenName: t.engGivenName,
  passportNo: t.passportNo,  // ← 민감정보
  // ...
}]
```

**수정 내용**:
1. `src/lib/types/pnr.ts` 신규 생성 (통합 타입 파일)
2. Prisma 생성 타입 활용:
   ```typescript
   export type GmTraveler = Prisma.GmTravelerGetPayload<{}>;
   
   export interface PnrTraveler extends Omit<GmTraveler, 'residentNum'> {
     // residentNum은 서버에만 존재 (클라이언트 미노출)
     roomColor?: string;  // UI only
   }
   ```
3. 클라이언트 인터페이스 통일

**파일**: 
- `src/lib/types/pnr.ts` (신규)
- `src/app/pnr/[reservationId]/page.tsx` (라인 8-15 수정)
- `src/app/api/pnr/customer/submit/route.ts` (라인 42-65 수정)

**난이도**: 1.5시간

---

## 3. P1 중요 개선 (3-4시간)

### P1-1: 감사 로그 추가 (비컴플라이언스 위험)

**파일**: `src/app/api/pnr/customer/submit/route.ts`
**라인**: 라인 148 후 추가

```typescript
await prisma.auditLog.create({
  data: {
    action: 'PNR_SUBMIT',
    resourceType: 'Reservation',
    resourceId: reservationId.toString(),
    userId: session.userId,
    userRole: session.role,
    organizationId: session.organizationId,
    changes: {
      travelers: travelers.map(t => ({
        name: t.korName,
        phone: t.phone?.substring(0, 3) + '***',  // 마스킹
      }))
    },
    status: 'SUCCESS',
    ipAddress: req.headers.get('x-forwarded-for'),
    timestamp: new Date()
  }
});
```

**난이도**: 1시간

---

### P1-2: PnrSubmitSchema 클라이언트 통합

**파일**: `src/app/pnr/[reservationId]/page.tsx`
**라인**: 라인 256-279 (handleSubmit 메서드)

**현황**:
```typescript
// Zod 스키마 존재하지만 미사용
if (!korName || !residentNum || !roomNumber) {
  alert('모든 필드를 입력해주세요.');
  return;
}
```

**수정**:
```typescript
import { PnrSubmitSchema } from '@/src/lib/schemas/pnr.zod';

async function handleSubmit() {
  try {
    const validData = PnrSubmitSchema.parse({
      reservationId,
      travelers: updatedTravelers.map(t => ({
        id: t.id,
        korName: t.korName,
        // ...
      }))
    });
    // 검증 통과 후 서버 요청
    const response = await fetch('/api/pnr/customer/submit', {
      method: 'POST',
      body: JSON.stringify(validData)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      setErrors(error.flatten().fieldErrors);
    }
  }
}
```

**난이도**: 1시간

---

### P1-3: API 응답 타입 정의

**파일**: `src/lib/types/pnr-api.ts` (신규)

```typescript
export interface PnrCustomerResponse {
  ok: boolean;
  reservation?: {
    id: number;
    totalPeople: number;
    cabinType: string | null;
    trip: {
      id: number;
      shipName: string | null;
      departureDate: Date | null;
      endDate: Date | null;
      productCode: string | null;
    } | null;
    travelers: Array<{
      id: number;
      korName: string;
      roomNumber: number;
      // ❌ residentNum, engSurname 등 민감정보 제외
    }>;
    paymentStatus: 'paid' | 'refunded' | 'cancelled' | 'unknown';
  };
  error?: string;
}
```

**파일**: `src/app/api/pnr/customer/[reservationId]/route.ts`
**라인**: 응답 부분 타입 지정

```typescript
return NextResponse.json<PnrCustomerResponse>({
  ok: true,
  reservation: {...}
});
```

**난이도**: 1.5시간

---

### P1-4: 성능 최적화 (캐싱)

**파일**: `src/app/pnr/[reservationId]/page.tsx`
**라인**: 라인 159-203 (checkAuthAndLoad 함수)

**개선 사항**:
1. 서버 컴포넌트에서 `cache()` 래퍼 추가
2. 동일 예약 ID에 대해 1분 캐싱
   ```typescript
   import { cache } from 'react';
   
   const getCachedReservation = cache(async (id: number) => {
     return await prisma.gmReservation.findUnique({
       where: { id },
       include: { travelers: true, trip: true }
     });
   });
   ```

**난이도**: 1시간

---

### P1-5: 404 vs 403 구분 (보안 정보 유출 방지)

**파일**: `src/app/api/pnr/customer/submit/route.ts`
**라인**: 68-81

**현재**:
```typescript
if (!reservation) {
  return NextResponse.json(
    { ok: false, error: 'Reservation not found' },
    { status: 404 }  // ← 404 = 인증 실패인지 존재 안 하는지 불명확
  );
}
```

**수정**:
```typescript
if (!reservation) {
  // 존재하는 조직의 예약이지만 접근 권한 없음
  return NextResponse.json(
    { ok: false, error: 'Access denied' },
    { status: 403 }  // Forbidden
  );
}
```

**난이도**: 0.5시간

---

## 4. P2 코드 품질 개선 (2시간)

### P2-1: null coalescing 일관성
- `?.` + `??` 조합으로 통일
- 파일: page.tsx, route.ts

### P2-2: Zod strict mode
```typescript
export const PnrSubmitSchema = z.object({...}).strict();
```

### P2-3: Reservation 타입 중앙화
- 이동: page.tsx 라인 17-45 → `src/lib/types/pnr.ts`

### P2-4: 에러 메시지 표준화
- 보안: 일반적인 에러 메시지만 노출 ("작업 실패", "접근 거부")
- 상세 에러는 서버 로그에만 기록

**난이도**: 1시간

---

## 5. 파일 변경 요약

| 파일 | 변경 | 라인 | P레벨 |
|------|------|------|-------|
| `src/app/api/pnr/customer/submit/route.ts` | 소유권 검증 추가 + 감사로그 | 25-81, 148+ | P0, P1 |
| `src/app/api/pnr/customer/[reservationId]/route.ts` | IDOR 수정 + PII 마스킹 | 전체 | P0 |
| `src/app/pnr/[reservationId]/page.tsx` | Traveler 인터페이스 + Zod 통합 | 8-15, 256-279 | P0, P1 |
| `src/lib/types/pnr.ts` | 신규 생성 - 타입 통합 | - | P1 |
| `src/lib/types/pnr-api.ts` | 신규 생성 - API 응답 타입 | - | P1 |
| `src/lib/schemas/pnr.zod.ts` | 기존 (임포트만) | - | P1 |

---

## 6. 실행 전략

### Wave 1-A: P0 Critical (2-3시간) - **병렬 가능**
- Agent α: P0-α (소유권 검증) + P0-β (IDOR)
- Agent β: P0-γ (타입 통합) + 타입 파일 생성

### Wave 1-B: P1 개선 (3-4시간) - 순차 또는 병렬
- Agent γ: 감사로그 + 타입 정의
- Agent δ: Zod 통합 + 캐싱

### 검증: npm run build + 통합 테스트

---

## 7. 테스트 케이스 (검증 단계)

### T1: 조직 경계 보호 (P0-α)
```bash
# FREE_SALES role로 다른 조직 예약 수정 시도
# 예상: 403 Forbidden
```

### T2: Phone 검증 (P0-β)
```bash
# 잘못된 phone으로 조회 시도
# 예상: 401 Unauthorized + 감사로그 기록
```

### T3: 민감정보 제외 (P0-β)
```bash
# GET /api/pnr/customer/123?phone=010... 응답
# 예상: travelers[].residentNum 없음
```

### T4: 타입 안전성 (P0-γ)
```bash
npm run build
# 예상: TypeScript 오류 0개
```

---

## 8. 배포 준비도

| 항목 | 현황 | 목표 |
|------|------|------|
| **보안** | 3.2/10 | 7.8/10 ✅ |
| **타입 안전성** | 6.2/10 | 8.5/10 ✅ |
| **성능** | 6.3/10 | 8.5/10 ✅ |
| **유지보수성** | 5.5/10 | 8.2/10 ✅ |
| **테스트** | <20% | ~70% ✅ |
| **배포 준비도** | 1.5/10 | **8.2/10** |

---

## 9. 다음 단계 (Wave 2)

- **Wave 2**: Dashboard/Contacts/Messages 상태 재확인
- **Wave 3**: API 제거 + 서버 래퍼 통합 (2-3시간)
- **Wave 4**: 나머지 메뉴 최적화

---

## 승인 대기

✅ 코드 리뷰 완료  
✅ 10렌즈 분석 완료 (Lens 1-4)  
⏳ **사용자 승인 대기** (Step 3 완료 → Step 4 실행 대기)
