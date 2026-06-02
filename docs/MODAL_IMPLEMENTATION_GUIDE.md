# 모달 구현 가이드 - 스텝 바이 스텝

**작성일**: 2026-06-02  
**난이도**: 중간  
**예상 소요 시간**: 4-6시간 (3명 병렬 작업 시 2-3시간)

---

## 📋 Step 1: Hook 작성 (`src/hooks/useContactDetail.ts`)

### 파일 신규 생성
```typescript
// src/hooks/useContactDetail.ts

import { useState, useEffect, useCallback } from 'react';
import { Contact } from '@/types/contact';
import { logger } from '@/lib/logger';

interface UseContactDetailOptions {
  cache?: Map<string, Contact>;
  onCache?: (id: string, contact: Contact) => void;
}

export function useContactDetail(
  contactId: string | null,
  options: UseContactDetailOptions = {}
) {
  const { cache = new Map(), onCache } = options;

  const [data, setData] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContact = useCallback(async (signal: AbortSignal) => {
    if (!contactId) return;

    // 캐시에서 먼저 확인
    if (cache.has(contactId)) {
      const cached = cache.get(contactId);
      setData(cached || null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/contacts/${contactId}`, { 
        signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const result = await res.json();

      if (result.ok && result.contact) {
        setData(result.contact);
        // 캐시 업데이트 콜백
        if (onCache) {
          onCache(contactId, result.contact);
        }
      } else {
        setError(result.error ?? '고객 정보를 불러올 수 없습니다');
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          // 요청 취소됨 (무시)
          return;
        }
        setError(err.message || '네트워크 오류가 발생했습니다');
      } else {
        setError('알 수 없는 오류가 발생했습니다');
      }
      logger.error('[useContactDetail]', { contactId, err });
    } finally {
      setLoading(false);
    }
  }, [contactId, cache, onCache]);

  useEffect(() => {
    const controller = new AbortController();
    fetchContact(controller.signal);

    return () => {
      controller.abort();
    };
  }, [contactId, fetchContact]);

  return { data, loading, error };
}
```

---

## 📋 Step 2: 모달 컴포넌트 작성

### `src/app/(dashboard)/contacts/ContactDetailModal.tsx` (신규)

```typescript
'use client';

import { useState, useEffect } from 'react';
import {
  X, Phone, MessageSquare, ArrowRight, Loader2,
  AlertCircle, MapPin, Calendar, DollarSign, User
} from 'lucide-react';
import { Contact } from '@/types/contact';
import { useContactDetail } from '@/hooks/useContactDetail';

interface ContactDetailModalProps {
  contactId: string;
  onClose: () => void;
  cache?: Map<string, Contact>;
  onCache?: (id: string, contact: Contact) => void;
}

export default function ContactDetailModal({
  contactId,
  onClose,
  cache,
  onCache,
}: ContactDetailModalProps) {
  const { data: contact, loading, error } = useContactDetail(contactId, {
    cache,
    onCache,
  });

  const [isClosing, setIsClosing] = useState(false);

  // ESC 키 지원
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 150); // Fade-out 애니메이션 대기
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Type 뱃지 스타일
  const getTypeStyle = (type?: string) => {
    const typeMap: Record<string, { label: string; bg: string; text: string }> = {
      'LEAD': { label: '잠재고객', bg: 'bg-blue-100', text: 'text-blue-700' },
      '잠재고객': { label: '잠재고객', bg: 'bg-blue-100', text: 'text-blue-700' },
      'CUSTOMER': { label: '구매완료', bg: 'bg-green-100', text: 'text-green-700' },
      '구매완료': { label: '구매완료', bg: 'bg-green-100', text: 'text-green-700' },
      'UNSUBSCRIBED': { label: '수신거부', bg: 'bg-gray-100', text: 'text-gray-700' },
      '수신거부': { label: '수신거부', bg: 'bg-gray-100', text: 'text-gray-700' },
    };
    return typeMap[type] || { label: type || '미분류', bg: 'bg-gray-100', text: 'text-gray-700' };
  };

  const typeStyle = getTypeStyle(contact?.type);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-150 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={handleBackgroundClick}
        aria-hidden="true"
      />

      {/* 모달 */}
      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden transition-transform duration-150 flex flex-col ${
          isClosing ? 'scale-95' : 'scale-100'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* 헤더 */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {contact ? (
              <>
                {/* 아바타 */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy-900 to-navy-700 text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {contact.name?.[0]?.toUpperCase() || '?'}
                </div>

                {/* 이름 + 전화 */}
                <div className="flex-1 min-w-0">
                  <h2
                    id="modal-title"
                    className="font-bold text-gray-900 truncate text-base"
                  >
                    {contact.name}
                  </h2>
                  <p className="text-sm text-gray-500 truncate">{contact.phone}</p>
                </div>
              </>
            ) : (
              <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
            )}
          </div>

          {/* 닫기 버튼 */}
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors ml-2 shrink-0"
            aria-label="모달 닫기"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* 바디 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* 로딩 상태 */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400 mb-3" />
              <p className="text-sm text-gray-600">고객 정보를 불러오는 중...</p>
            </div>
          )}

          {/* 에러 상태 */}
          {error && !loading && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900">오류 발생</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                  <button
                    onClick={() => {
                      // 새로고침 (페이지 이동 후 모달 재열기)
                      window.location.href = `/contacts/${contactId}`;
                    }}
                    className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium underline"
                  >
                    전체 페이지에서 보기
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 데이터 표시 */}
          {contact && !loading && (
            <div className="space-y-4">
              {/* 상태 뱃지 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm px-2.5 py-1 rounded-full font-medium ${typeStyle.bg} ${typeStyle.text}`}>
                  {typeStyle.label}
                </span>
                {contact.leadScore && (
                  <span className={`text-sm px-2.5 py-1 rounded-full font-medium ${
                    contact.leadScore >= 70 ? 'bg-red-100 text-red-700' :
                    contact.leadScore >= 30 ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-50 text-blue-600'
                  }`}>
                    {contact.leadScore >= 70 ? '🔥 HOT' :
                     contact.leadScore >= 30 ? '☀️ WARM' :
                     '❄️ COLD'}
                  </span>
                )}
              </div>

              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg">
                {contact.phone && (
                  <div className="col-span-1">
                    <p className="text-xs text-gray-600 font-medium">전화</p>
                    <a href={`tel:${contact.phone}`} className="text-sm text-blue-600 hover:underline font-medium">
                      {contact.phone}
                    </a>
                  </div>
                )}

                {contact.createdAt && (
                  <div className="col-span-1">
                    <p className="text-xs text-gray-600 font-medium">가입일</p>
                    <p className="text-sm text-gray-700">
                      {new Date(contact.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                )}

                {contact.cruiseInterest && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-600 font-medium">관심 크루즈</p>
                    <p className="text-sm text-gray-700">{contact.cruiseInterest}</p>
                  </div>
                )}

                {contact.departureDate && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-600 font-medium">출발 예정일</p>
                    <p className="text-sm text-gray-700">
                      {new Date(contact.departureDate).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                )}
              </div>

              {/* 그룹 */}
              {contact.groups && contact.groups.length > 0 && (
                <div>
                  <p className="text-xs text-gray-600 font-medium mb-2">그룹</p>
                  <div className="flex gap-2 flex-wrap">
                    {contact.groups.map((g) => (
                      <span
                        key={g.group.id}
                        className="text-sm px-2.5 py-1 rounded-full bg-blue-50 text-blue-700"
                      >
                        {g.group.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 태그 */}
              {contact.tags && contact.tags.length > 0 && (
                <div>
                  <p className="text-xs text-gray-600 font-medium mb-2">태그</p>
                  <div className="flex gap-2 flex-wrap">
                    {contact.tags.slice(0, 5).map((tag) => (
                      <span
                        key={tag}
                        className="text-sm px-2 py-1 rounded-full bg-amber-50 text-amber-700"
                      >
                        #{tag}
                      </span>
                    ))}
                    {contact.tags.length > 5 && (
                      <span className="text-sm text-gray-600">+{contact.tags.length - 5}개</span>
                    )}
                  </div>
                </div>
              )}

              {/* 콜 로그 */}
              {contact._count?.callLogs && contact._count.callLogs > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-700">
                    {contact._count.callLogs}회 콜 기록
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        {contact && !loading && (
          <div className="sticky bottom-0 z-10 bg-gray-50 border-t border-gray-200 px-6 py-4">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = `tel:${contact.phone}`;
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors active:scale-95"
                title="전화 걸기"
              >
                <Phone className="w-4 h-4" />
                <span className="hidden sm:inline">전화</span>
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = `sms:${contact.phone}`;
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors active:scale-95"
                title="문자 보내기"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">문자</span>
              </button>

              <button
                onClick={() => {
                  handleClose();
                  // 500ms 후에 페이지 이동 (애니메이션 완료 대기)
                  setTimeout(() => {
                    window.location.href = `/contacts/${contactId}`;
                  }, 500);
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-gray-300 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors active:scale-95"
                title="상세 페이지 열기"
              >
                <ArrowRight className="w-4 h-4" />
                <span className="hidden sm:inline">상세</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 📋 Step 3: contacts/page.tsx 통합

### 변경 사항 (10개 지점)

#### 3-1. Import 추가 (L1-12)
```typescript
// 기존 (L1-10)
"use client";

import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
// ... 다른 import들

// 추가 (L12 다음)
const ContactDetailModal = lazy(() => import('./ContactDetailModal'));
```

#### 3-2. 상태 추가 (L143 다음)
```typescript
// 기존 (L129-143)
export default function ContactsPage() {
  const { toast } = useToast();
  const { role } = useSession();
  const canDelete = role === 'OWNER' || role === 'GLOBAL_ADMIN';
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  // ... 기존 상태들

  // 추가 (L143 다음)
  // 모달 상태
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [contactDetailsCache, setContactDetailsCache] = useState<Map<string, Contact>>(new Map());

  // 캐시 업데이트 함수
  const updateContactCache = useCallback((id: string, contact: Contact) => {
    setContactDetailsCache(prev => {
      const newCache = new Map(prev);
      // LRU: 50개 초과 시 가장 오래된 항목 제거
      if (newCache.size >= 50) {
        const firstKey = newCache.keys().next().value;
        newCache.delete(firstKey);
      }
      newCache.set(id, contact);
      return newCache;
    });
  }, []);

  // 모달 열기/닫기
  const openContactModal = (contactId: string) => {
    setSelectedContactId(contactId);
  };

  const closeContactModal = () => {
    setSelectedContactId(null);
  };
```

#### 3-3. 리스트 행 클릭 변경 (L1102-1105)
```typescript
// 기존 (L1102-1105)
<Link
  href={`/contacts/${c.id}`}
  className="flex items-center gap-3 flex-1 min-w-0"
>
  {/* ... */}
</Link>

// 변경
<button
  type="button"
  onClick={() => openContactModal(c.id)}
  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer text-left hover:no-underline"
>
  {/* 기존 내용 동일 - 복사 */}
</button>
```

#### 3-4. 모달 렌더링 추가 (반환문 끝, L1504 전)
```typescript
// 페이지 반환문 끝 (</div> 바로 전)에 추가
      {/* 고객 상세 모달 */}
      {selectedContactId && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 z-50" />}>
          <ContactDetailModal
            contactId={selectedContactId}
            onClose={closeContactModal}
            cache={contactDetailsCache}
            onCache={updateContactCache}
          />
        </Suspense>
      )}
    </div>
  );
}
```

---

## 🧪 Step 4: 테스트 전략

### 단위 테스트 (Optional but Recommended)

```typescript
// __tests__/ContactDetailModal.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContactDetailModal from '@/app/(dashboard)/contacts/ContactDetailModal';

describe('ContactDetailModal', () => {
  it('should render modal with loading state', () => {
    render(
      <ContactDetailModal contactId="test-id" onClose={() => {}} />
    );
    expect(screen.getByText(/로드 중/)).toBeInTheDocument();
  });

  it('should close on ESC key', async () => {
    const onClose = jest.fn();
    render(
      <ContactDetailModal contactId="test-id" onClose={onClose} />
    );
    
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('should close on background click', async () => {
    const onClose = jest.fn();
    const { container } = render(
      <ContactDetailModal contactId="test-id" onClose={onClose} />
    );
    
    const overlay = container.querySelector('[aria-hidden="true"]');
    fireEvent.click(overlay);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
```

### 수동 테스트 체크리스트

- [ ] **모달 열기**: 고객 이름 클릭 → 모달 표시 (300ms 이내)
- [ ] **캐시 동작**: 같은 고객 재클릭 → 즉시 표시 (API 호출 안 함)
- [ ] **닫기 방법**:
  - [ ] X 버튼 클릭
  - [ ] 배경 클릭
  - [ ] ESC 키
- [ ] **에러 처리**: 네트워크 끊김 → 에러 메시지 표시
- [ ] **액션 버튼**: 전화, 문자, 상세보기 동작
- [ ] **반응형**: PC(768px+) / 모바일(<768px) 레이아웃
- [ ] **접근성**:
  - [ ] ARIA 속성 완비
  - [ ] 키보드 네비게이션 (Tab, Enter, ESC)
  - [ ] 스크린 리더 호환

---

## 🚀 Step 5: 배포 전 체크리스트

### 코드 품질
- [ ] TypeScript 타입 검증 (`npx tsc --noEmit`)
- [ ] Linting (`npm run lint`)
- [ ] 성능 프로파일링 (DevTools Performance 탭)

### 성능 메트릭
- [ ] **초기 로드**: TTI < 2.5s
- [ ] **모달 열기** (첫 번째): < 300ms
- [ ] **모달 열기** (캐시): < 50ms
- [ ] **메모리**: < 85MB (고객 50명 기준)
- [ ] **번들 크기**: 증가분 < 25KB

### 브라우저 호환성
- [ ] Chrome (최신 3개 버전)
- [ ] Safari (최신 2개 버전)
- [ ] Firefox (최신 3개 버전)
- [ ] Edge (최신 버전)

### 보안
- [ ] XSS 방지 (React escape 자동 처리)
- [ ] 권한 검증 (API `/api/contacts/:id` 권한 확인)
- [ ] 정보 마스킹 (PII 데이터 보호)

---

## 📊 Step 6: 성능 측정

### Chrome DevTools로 측정

#### TTI 측정 (Time to Interactive)
```
1. DevTools 열기 (F12)
2. Performance 탭 선택
3. 녹화 시작 (빨간 원)
4. 고객 이름 클릭
5. 모달 완전 표시될 때까지 대기
6. 녹화 중지
7. "Main" 섹션에서 "FCP" 시점 확인 → "TTI" 까지 시간 계산
```

#### 메모리 측정 (Memory)
```
1. DevTools 열기
2. Memory 탭 선택
3. "Heap snapshot" 클릭
4. 현재 메모리 기록
5. 고객 50명 조회
6. 다시 snapshot 생성
7. 차이 계산
```

#### 번들 크기 측정
```bash
npm run build

# .next/static/chunks/ 에서 main-*.js 파일 크기 확인
ls -lh .next/static/chunks/main-*.js
```

---

## 🎯 Quick Start

### 최소 구현 (2시간)
1. ✅ Step 1: Hook 작성
2. ✅ Step 2: ContactDetailModal 컴포넌트
3. ✅ Step 3-1, 3-4: 기본 통합 (import + 렌더링)

### 완전 구현 (6시간)
1. ✅ Step 1-3: 전체 구현
2. ✅ Step 4: 테스트
3. ✅ Step 5: 배포 체크
4. ✅ Step 6: 성능 측정

---

## 📚 참고 자료

### 현재 프로젝트 구조
- **리스트**: `/contacts/page.tsx` (1507줄)
- **상세 페이지**: `/contacts/[id]/page.tsx` (재사용 가능한 컴포넌트들)
- **API**: `/api/contacts/[id]` (데이터 소스)
- **타입**: `@/types/contact.ts`

### 재사용 컴포넌트
- `ContactInfoPanel` — 고객 정보 표시
- `ContactCallTab` — 콜 로그
- `ContactMemoTab` — 메모
- `ContactGroupTab` — 그룹
- `ContactSmsTab` — SMS 로그

---

**마지막 검토**: 2026-06-02
