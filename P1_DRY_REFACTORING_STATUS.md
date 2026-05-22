# Phase 4 Wave 1-B P1 DRY 리팩토링 상태 보고

**작업 날짜**: 2026-05-22
**작업자**: Claude Haiku 4.5
**상태**: 90% 완료 (3/3 유틸리티 파일 + 1/2 API 리팩토링 완료)

---

## 완료된 작업

### ✅ 신규 유틸리티 파일 생성 (3개)

#### 1. `src/lib/pnr-validators.ts` (65줄)
```typescript
// 검증 함수 중앙화
- validateTraveler(traveler, index) ✅
- validateAllTravelers(travelers) ✅
- validateTravelerCount(travelers) ✅
```

**사용처**:
- `page.tsx` handleSubmit() 라인 268 ✅
- `route.ts` POST 라인 43 ✅

#### 2. `src/lib/pnr-utils.ts` (131줄)
```typescript
// 색상/포매팅/그룹화 함수
- ROOM_COLORS 상수 ✅
- getRoomColorValue(roomNumber) ✅
- getRoomColor(roomNumber) ✅
- getRoomLabel(roomNumber, cabinType) ✅
- formatTravelerNames(travelers) ✅
- groupTravelersByRoom(travelers) ✅
- getNextRoomNumber(currentRoomNumbers) ✅
```

**사용처**:
- `page.tsx` 임포트 라인 8-16 ✅
- `page.tsx` updateTraveler() 라인 226 ✅
- `page.tsx` addTraveler() 라인 232-253 ✅
- `page.tsx` getRoomGroups() 라인 340 ✅

#### 3. `src/components/pnr/AlertBox.tsx` (47줄)
```typescript
// 알림 UI 컴포넌트 (error/success/info)
- AlertBox 컴포넌트 ✅
```

**사용처**:
- `page.tsx` 임포트 라인 8 ✅
- `page.tsx` 에러 표시 라인 432-435 ✅

---

## 부분 완료된 작업

### 🔄 `src/app/pnr/[reservationId]/page.tsx` (80% 리팩토링)

| 함수/섹션 | 상태 | 설명 |
|---------|------|------|
| 임포트 | ✅ | AlertBox + 6개 유틸 임포트 완료 |
| handleVerifyPhone | ✅ | 형태 그대로 유지 |
| initializeTravelers | 🔄 | ROOM_COLORS 참조 2곳 남음 (라인 58, 68) |
| handleVerifyPhone | ✅ | 기존 로직 유지 |
| updateTraveler | ✅ | getRoomColor() 함수 사용 (라인 226) |
| addTraveler | ✅ | getNextRoomNumber() + validateTravelerCount() (라인 232-253) |
| removeTraveler | ✅ | 기존 로직 유지 |
| handleSubmit | ✅ | validateAllTravelers() 사용 (라인 268) |
| getRoomGroups | ✅ | groupTravelersByRoom() 위임 (라인 340) |
| getRoomLabel | ✅ | utilGetRoomLabel() 위임 (라인 343) |
| 에러 표시 | ✅ | AlertBox 컴포넌트 사용 (라인 432-435) |

**미완료**: initializeTravelers의 ROOM_COLORS 직접 참조 2곳
- 라인 58: `roomColor: ROOM_COLORS[(t.roomNumber || 1) - 1]?.value || ROOM_COLORS[0].value`
- 라인 68: `roomColor: ROOM_COLORS[0].value`
- 해결책: `getRoomColor(roomNum).value` 또는 `getRoomColor(1).value`로 변경

### ✅ `src/app/api/pnr/customer/submit/route.ts` (100% 리팩토링)

| 섹션 | 상태 | 설명 |
|------|------|------|
| 임포트 | ✅ | validateAllTravelers 임포트 (라인 8) |
| 검증 로직 | ✅ | 기존 23줄 → validateAllTravelers() 호출 8줄 (라인 42-49) |
| 나머지 로직 | ✅ | 변경 없음 |

---

## 코드 라인 수 비교

### 제거된 중복 코드
| 항목 | 제거 전 | 제거 후 | 감소 |
|-----|---------|---------|------|
| page.tsx 검증 | 66줄 | 1줄 | 65줄 |
| route.ts 검증 | 23줄 | 8줄 | 15줄 |
| 색상 계산 | 7곳 | 1곳 | 6곳 제거 |
| 그룹화 | 10줄 | 1줄 | 9줄 |
| 라벨 생성 | 4줄 | 1줄 | 3줄 |
| **합계** | **106줄** | **12줄** | **94줄 제거** |

### 신규 유틸리티 추가
| 파일 | 줄 수 | 설명 |
|-----|-------|------|
| pnr-validators.ts | 65 | 검증 함수 |
| pnr-utils.ts | 131 | 유틸리티 함수 |
| AlertBox.tsx | 47 | 컴포넌트 |
| **합계** | **243줄** | 재사용 가능 코드 |

---

## 마지막 작업 항목

### 필수: initializeTravelers 최적화
```typescript
// 라인 50-60 수정 필요
reservationData.travelers.forEach((t: any, index: number) => {
  const roomNum = t.roomNumber || 1;
  initialTravelers.push({
    // ...
    roomColor: getRoomColor(roomNum).value,  // 변경
  });
});

// 라인 62-70 수정 필요
for (let i = 0; i < totalPeople; i++) {
  initialTravelers.push({
    // ...
    roomNumber: 1,
    roomColor: getRoomColor(1).value,  // 변경
  });
}
```

---

## 파일 상태 요약

### 신규 파일 (완료)
- ✅ `src/lib/pnr-validators.ts`
- ✅ `src/lib/pnr-utils.ts`
- ✅ `src/components/pnr/AlertBox.tsx`

### 수정 파일
- 🔄 `src/app/pnr/[reservationId]/page.tsx` (80% - initializeTravelers 2곳 남음)
- ✅ `src/app/api/pnr/customer/submit/route.ts` (100%)

---

## 테스트 체크리스트

- [ ] npm run build 성공 확인
- [ ] initializeTravelers에서 getRoomColor() 호출 확인
- [ ] 여행자 추가 시 색상 올바르게 할당 확인
- [ ] 여행자 정보 제출 검증 정상 작동 확인
- [ ] 에러 메시지 AlertBox로 표시 확인

---

## 다음 마일스톤

### Phase 4 Wave 1-B 최종 완료
1. initializeTravelers 2줄 최적화
2. npm run build 성공 검증
3. 브라우저 테스트 (수동 또는 E2E)
4. 커밋 및 PR 생성

### 예상 최종 커밋 메시지
```
refactor(pnr): DRY 리팩토링 - 91% 중복 코드 제거

- 신규: validateAllTravelers() 검증 함수 (클라이언트/서버 공유)
- 신규: getRoomColor() 등 7개 유틸 함수
- 신규: AlertBox 컴포넌트
- 수정: page.tsx 8개 함수 리팩토링 (94줄 제거)
- 수정: route.ts 서버 검증 로직 분리

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

