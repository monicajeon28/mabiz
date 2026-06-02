# 모달 구현 빠른 참조 및 체크리스트

---

## ⚡ 30초 요약

**현재**: 고객 이름 클릭 → 2초 대기 → 새 페이지 로드  
**개선**: 고객 이름 클릭 → 0.5초 → 모달 팝업

**기대 효과**:
- TTI: **1.5s → 0.45s** (70% 빠름)
- 개발 시간: **10시간** (3일)
- ROI: **1,442%** (1개월 회수)
- 월간 시간절감: **11시간**

---

## 📋 구현 체크리스트 (4단계)

### Phase 1: 기초 모달 (2-3시간)

**목표**: ContactDetailModal.tsx 작성 + Lazy 탭 설정

- [ ] `src/app/(dashboard)/contacts/ContactDetailModal.tsx` 생성
  ```typescript
  // 주요 내용:
  // - AnimatePresence + motion.div (Framer Motion)
  // - Suspense + lazy 탭 (ContactCallTab, ContactMemoTab 등)
  // - 모달 헤더 (닫기 버튼)
  // - 탭 네비게이션 + 콘텐츠 영역
  ```

- [ ] 필수 라이브러리 확인
  - `framer-motion` ✅ (이미 설치)
  - `lucide-react` ✅ (아이콘)

- [ ] 성능 측정
  - [ ] Chrome DevTools Lighthouse 실행
  - [ ] TTI: 0.3-0.6s 범위 확인

---

### Phase 2: 상태 관리 (1-2시간)

**목표**: ContactsContext 작성 + 중앙 상태 관리

- [ ] `src/app/(dashboard)/contacts/ContactsContext.tsx` 생성
  ```typescript
  // 주요 내용:
  // - createContext (selectedContactId, isModalOpen)
  // - openModal(id) / closeModal()
  // - contactCache 구현
  // - useContactsModal() 커스텀 훅
  // - URL 쿼리 파라미터 (?contactId=xxx)
  ```

- [ ] `src/app/(dashboard)/contacts/layout.tsx` 수정
  ```typescript
  // <ContactsContextProvider> 래핑
  // <ContactDetailModalWrapper> 마운트
  ```

- [ ] 딥링킹 테스트
  - [ ] `/contacts?contactId=contact_affiliate_102` 직접 접속
  - [ ] 새로고침 후 모달 복원되는지 확인

---

### Phase 3: 마이그레이션 (4-6시간)

**목표**: 기존 라우팅 → 모달 상태 전환

- [ ] `src/app/(dashboard)/contacts/page.tsx` 수정
  ```typescript
  // Before:
  // onClick={() => router.push(`/contacts/${c.id}`)}
  
  // After:
  // const { openModal } = useContactsModal();
  // onClick={() => openModal(c.id)}
  ```

- [ ] `src/app/(dashboard)/contacts/inquiries/page.tsx` 수정
  - [ ] 동일한 패턴 적용

- [ ] `src/app/(dashboard)/contacts/all/page.tsx` 수정
  - [ ] 동일한 패턴 적용

- [ ] 페이지 이동 라우팅 비활성화
  - [ ] `/contacts/[id]/page.tsx` 여전히 유지 (직접 URL 접속용)
  - [ ] 향후 완전 제거 가능

- [ ] 사용자 테스트
  - [ ] 고객 이름 클릭 → 모달 열기
  - [ ] 목록 스크롤 위치 유지 확인
  - [ ] Escape 키로 모달 닫기

---

### Phase 4: 캐싱 + 최적화 (2-3시간)

**목표**: API 캐싱 + 메모리 최적화

- [ ] `src/lib/hooks/useContactDetail.ts` 생성
  ```typescript
  // 주요 내용:
  // - useContactsModal() Context 사용
  // - getCachedContact(id) 확인
  // - fetch → cacheContact(id, data)
  // - loading / error 상태
  ```

- [ ] ContactDetailModal에서 사용
  ```typescript
  // const { contact, loading, error } = useContactDetail(contactId);
  ```

- [ ] 메모리 최적화
  - [ ] MAX_CACHE_SIZE = 50 (최대 50개 고객 캐시)
  - [ ] 초과 시 가장 오래된 항목 자동 제거

- [ ] 캐시 성능 검증
  - [ ] 같은 고객 재진입: 0.1s (API 스킵)
  - [ ] 새 고객 진입: 0.5s (API 호출)

---

## 🚨 주의사항

### 뒤로가기 처리
```typescript
// ContactsContext.tsx에 추가
useEffect(() => {
  const handlePopState = () => {
    closeModal();
  };
  window.addEventListener('popstate', handlePopState);
  return () => window.removeEventListener('popstate', handlePopState);
}, [closeModal]);
```

### URL 쿼리 관리
```typescript
// 모달 열기 시
window.history.replaceState(null, '', `?contactId=${id}`);

// 모달 닫기 시
window.history.replaceState(null, '', '/contacts');
```

### 타입 안정성
```typescript
// ContactsContext의 타입 정의
interface ContactsContextType {
  selectedContactId: string | null;
  isModalOpen: boolean;
  openModal: (id: string) => void;
  closeModal: () => void;
  contactCache: Map<string, Contact>;
  // ...
}
```

---

## 📊 성능 검증 (Phase별)

### Phase 1 완료 후
```bash
# Chrome DevTools에서
1. Lighthouse 실행 → Performance 탭
2. TTI: 0.3-0.6s 확인 ✅
3. Performance 점수: 75점 이상 ✅
```

### Phase 2 완료 후
```bash
# URL 쿼리 파라미터 확인
1. 고객 이름 클릭
2. URL: /contacts?contactId=contact_affiliate_102 ✅
3. 새로고침 → 모달 복원 ✅
```

### Phase 3 완료 후
```bash
# 사용자 경험 확인
1. 모달 진입 속도 < 700ms ✅
2. 스크롤 위치 유지 ✅
3. Escape 키 작동 ✅
4. 뒤로가기 동작 ✅
```

### Phase 4 완료 후
```bash
# 캐시 성능 확인
1. 같은 고객 재진입: API 호출 없음 ✅
2. DevTools Network 탭: 캐시 히트 표시 ✅
3. 메모리 사용량: 300MB 이내 ✅
```

---

## 💡 자주 묻는 질문 (FAQ)

### Q1: 기존 페이지 라우팅은 어떻게?
**A**: `/contacts/[id]` 페이지는 유지. 직접 URL 접속하는 사용자를 위해. 향후 완전 제거 가능.

### Q2: 뒤로가기는?
**A**: 상태 기반으로 작동. `popstate` 이벤트 리스너로 처리.

### Q3: 딥링킹은?
**A**: URL 쿼리 파라미터 `?contactId=xxx`로 구현.

### Q4: SEO는?
**A**: 모달은 SEO 영향 없음. `/contacts` 페이지 자체만 색인됨.

### Q5: 모바일은?
**A**: 모달은 모바일에도 최적화됨 (max-h-[90vh], overflow-y-auto).

### Q6: 캐시 만료는?
**A**: 세션 종료 시 자동 삭제. 또는 `clearCache()` 수동 호출.

### Q7: 다중 모달은?
**A**: 현재 구조로는 1개 모달만 지원. 향후 배열로 확장 가능.

---

## 🔗 관련 문서

1. **PERFORMANCE_MODAL_ANALYSIS.md** (분석 상세)
   - 현재 vs 개선 비교
   - TTI 시간 분해
   - Lighthouse 예상값

2. **MODAL_IMPLEMENTATION_GUIDE.md** (구현 상세)
   - Phase 1-4 코드 예제
   - 커밋 메시지 템플릿
   - 참고자료

3. **MODAL_ARCHITECTURE_DIAGRAMS.md** (시각화)
   - 시스템 아키텍처 다이어그램
   - 컴포넌트 트리
   - 상태 다이어그램

4. **PERFORMANCE_METRICS_TABLE.md** (수치)
   - 종합 성능 비교표
   - 사용 시나리오별 분석
   - 비용 절감 효과

---

## 🎯 커밋 메시지 템플릿

### Phase 1
```
feat(contacts): modal foundation - ContactDetailModal + lazy tabs

- Added ContactDetailModal.tsx with Framer Motion animations
- Lazy-load tab components (call, memo, group, sms)
- Suspense + loading states
- TTI improvement: 1.5s → 0.45s

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

### Phase 2
```
feat(contacts): context-based modal state management

- Added ContactsContext for centralized state
- Implemented deep-linking via URL query params
- useContactsModal() hook
- History state management (replaceState)

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

### Phase 3
```
feat(contacts): migrate from page navigation to modal

- Changed router.push() → openModal()
- Updated contacts/page.tsx, inquiries/page.tsx
- Preserved scroll position in list
- Back navigation via state management

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

### Phase 4
```
feat(contacts): add contact caching + memory optimization

- Implemented useContactDetail() hook with caching
- Cache size limit: 50 contacts max
- Cache hit rate: 90%+ on re-entry
- Memory optimization in ContactsContext

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

## ⏱️ 예상 소요 시간

| Phase | 예상 시간 | 체크 |
|-------|----------|------|
| Phase 1 (기초) | 2-3h | ☐ |
| Phase 2 (상태) | 1-2h | ☐ |
| Phase 3 (마이그레이션) | 4-6h | ☐ |
| Phase 4 (캐싱) | 2-3h | ☐ |
| **총합** | **8-12h** | ☐ |

**추천**: 하루 또는 2일에 걸쳐 진행

---

## 📞 트러블슈팅

### 문제: 모달이 열리지 않음
**해결**: 
1. `useContactsModal()` 훅이 `ContactsContextProvider` 내부인지 확인
2. `isOpen && contactId` 조건 확인
3. Console에서 에러 메시지 확인

### 문제: 캐시가 작동하지 않음
**해결**:
1. `useContactDetail` 훅에서 `getCachedContact` 호출 확인
2. `cacheContact` 호출 타이밍 확인 (API 응답 후)
3. DevTools Network 탭에서 API 호출 횟수 확인

### 문제: 뒤로가기가 작동하지 않음
**해결**:
1. `popstate` 이벤트 리스너 등록 확인
2. `window.history.replaceState()` 호출 확인
3. Firefox에서도 테스트 (브라우저 호환성)

### 문제: 스크롤 위치가 유지되지 않음
**해결**:
1. 리스트 컴포넌트가 언마운트되지 않았는지 확인
2. `key` prop 확인 (리마운트 방지)
3. `overflow-y-auto` 클래스 확인

---

## ✅ 최종 체크리스트

배포 전 필수:

- [ ] Phase 1-4 모두 완료
- [ ] TypeScript 컴파일 성공 (`npx tsc --noEmit`)
- [ ] 모든 탭 lazy-load 작동 확인
- [ ] 캐시 히트율 > 80% 확인
- [ ] Lighthouse Performance > 75점
- [ ] 모바일 환경 테스트 완료
- [ ] 접근성 테스트 (키보드 네비, 스크린 리더)
- [ ] 브라우저 호환성 (Chrome, Firefox, Safari)
- [ ] 성능 메트릭 기록 (Before/After)
- [ ] 커밋 메시지 작성 + Push

---

## 🚀 다음 단계

1. **MODAL_IMPLEMENTATION_GUIDE.md 읽기** (상세 코드)
2. **Phase 1 시작** (ContactDetailModal.tsx)
3. **진행 상황 기록** (이 체크리스트 업데이트)
4. **성능 검증** (Phase별로)
5. **배포** (all phases complete)

---

**시작 일시**: 2026-06-01 | **예상 완료**: 2026-06-03  
**담당자**: [에이전트 이름] | **검토자**: [리드 개발자]

**마지막 업데이트**: 2026-06-01
