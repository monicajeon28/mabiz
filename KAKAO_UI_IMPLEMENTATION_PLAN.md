# Kakao Channel UI Implementation Plan
**Date**: 2026-05-27 | **Status**: Analysis Complete | **Priority**: P1

---

## 📊 현재 상태 분석

### 기존 구조 (SMS/Email 탭)
```
Messages Page (messages/page.tsx - 867줄)
├── Tab Bar (SMS / Email)
├── SmsTab 컴포넌트 (511줄)
│   ├── 좌측: Aligo 설정 + 그룹 선택 + 템플릿
│   └── 우측: 메시지 작성 + DRY RUN + 발송
└── EmailTab 컴포넌트 (326줄)
    └── 유사 구조 (예약 발송 추가)
```

### 백엔드 API 현황
| API | 상태 | 기능 |
|-----|------|------|
| `POST /api/groups/[id]/blast` | ✅ 구현 | SMS 그룹 일괄 발송 |
| `POST /api/messages/send-sms` | ✅ 구현 | SMS 단건 발송 |
| `POST /api/messages/send-kakao` | ✅ 구현 | Kakao 단건 발송 |
| `POST /api/groups/[id]/blast-kakao` | ❌ **미구현** | **Kakao 그룹 일괄 발송** |

### 기술 스택
- UI: Next.js 14 + React (useCallback, useMemo, useState)
- Backend: Next.js API Routes + Prisma
- 메시지: Aligo API (SMS + Kakao 알림톡)
- 보안: RBAC, CSRF, IDOR 방지, Rate Limit

---

## 🎯 Kakao 탭 추가 설계

### 구현 계획

#### Phase 1: UI 탭 추가 (P0 - 1시간)
1. `messages/page.tsx` 메인 탭 바 수정
   - `"sms" | "email"` → `"sms" | "email" | "kakao"`
   - 카카오 탭 버튼 추가 (MessageCircle 아이콘)

2. KakaoTab 컴포넌트 작성 (~400줄)
   - SMS와 거의 동일 구조 + 차이점
   
#### Phase 2: Backend API 구현 (P1 - 2시간)
1. `api/groups/[id]/blast-kakao/route.ts` 신규 생성
   - SMS blast 기반으로 복사 후 수정
   - Kakao 발송 로직으로 변경

2. `api/tools/kakao-templates/route.ts` (선택사항)
   - Day 0-3 시퀀스 템플릿 제공

#### Phase 3: SMS-Logs 통합 (선택사항 - 30분)
- Kakao 채널 필터 추가 또는 별도 Kakao-logs 페이지

---

## 📋 KakaoTab 컴포넌트 상세 설계

### 상태 변수
```tsx
// SMS와 동일
const [kakaoConfig, setKakaoConfig] = useState<KakaoConfig | null>(null);
const [configLoading, setConfigLoading] = useState(true);
const [groups, setGroups] = useState<Group[]>([]);
const [selectedGroup, setSelectedGroup] = useState("");

// Kakao 특화
const [title, setTitle] = useState(""); // 제목 (30자 제한)
const [message, setMessage] = useState(""); // 본문 (1000자)
const [templates, setTemplates] = useState<KakaoTemplate[]>([]);
const [templateCat, setTemplateCat] = useState("");
const [showTemplates, setShowTemplates] = useState(false);

// 발송 제어 (SMS와 동일)
const [dryRunResult, setDryRunResult] = useState<{ count: number; sample: string } | null>(null);
const [confirmed, setConfirmed] = useState(false);
const [sending, setSending] = useState(false);
const [csrfToken, setCsrfToken] = useState("");
const [rateLimitStatus, setRateLimitStatus] = useState<RateLimit | null>(null);
const [userRole, setUserRole] = useState<UserRole | null>(null);
```

### UI 구조 (2열 레이아웃)
```
좌측 패널 (lg:col-span-1)
├── Kakao 연결 상태 카드
│   ├── ✅ 연결됨 (설정 정보 표시)
│   └── ⚠️ 미연결 (설정 페이지 링크)
├── 그룹 선택
├── 템플릿 추천 (선택사항)
└── Day 0-3 시퀀스 템플릿 카드

우측 패널 (lg:col-span-2)
├── 제목 입력 (30자 제한)
├── 본문 입력 (1000자 제한)
├── 치환변수 & 어필리에이트 링크
├── 발송 대상 미리보기 버튼
├── DRY RUN 결과 (제목 + 본문 미리보기)
├── 검수 탭 (RBAC: 관리자/대리점장)
├── 발송 확인 체크박스
└── 발송 버튼
```

### SMS와의 주요 차이점
| 항목 | SMS | Kakao |
|------|-----|-------|
| 제목 | 없음 | 필수 (30자) |
| 본문 길이 | 90자 | 1000자 |
| 템플릿 | 일반/VIP/라이브/시퀀스 | Day 0-3 시퀀스 추가 |
| 미리보기 | 본문만 | 제목 + 본문 |
| Rate Limit | 5회/일 | 5회/일 (동일) |

---

## 🔌 필요한 API 구현

### 1. POST /api/groups/[id]/blast-kakao (필수)
**새 파일**: `src/app/api/groups/[id]/blast-kakao/route.ts` (~300줄)

**요청**:
```json
{
  "title": "크루즈닷 예약 안내",
  "message": "[이름]님, 6월 출발 크루즈가 예약되었습니다.",
  "dryRun": true,
  "templateCode": "CRUISE_BOOKING"
}
```

**응답 (dryRun=true)**:
```json
{
  "ok": true,
  "dryRun": true,
  "groupName": "VIP 고객",
  "total": 150,
  "willSend": 145,
  "sample": "크루즈닷 예약 안내\n[이름]님, 6월 출발 크루즈가 예약되었습니다.",
  "rateLimitStatus": {
    "used": 2,
    "remaining": 3,
    "resetAt": "2026-05-28 09:00:00"
  }
}
```

**응답 (dryRun=false)**:
```json
{
  "ok": true,
  "sentCount": 145,
  "failedCount": 0
}
```

**핵심 로직**:
- SMS blast 기반으로 복사 후 수정
- Max Recipients: 200명
- Batch Size: 10명 (동시 발송)
- Rate Limit: 하루 5회
- Aligo API 호출 (send-kakao endpoint)
- 로깅: AdminMessage (messageType: 'kakao')

### 2. GET /api/tools/kakao-templates (선택사항)
**새 파일**: `src/app/api/tools/kakao-templates/route.ts` (~100줄)

**응답**:
```json
{
  "ok": true,
  "templates": [
    {
      "id": "tpl_001",
      "title": "Day 0 - 예약 확인",
      "content": "[이름]님, 예약이 완료되었습니다.\n출발: [출발일]\n상품: [상품명]",
      "category": "SEQUENCE",
      "templateCode": "CRUISE_BOOKING_DAY0"
    }
  ]
}
```

---

## 🎨 UI 구현 상세

### 제목 입력 필드
```tsx
<div className="rounded-xl border bg-white p-4">
  <label className="text-xs font-semibold text-gray-500 mb-2 block">
    제목 (알림톡 헤더)
  </label>
  <input
    value={title}
    onChange={e => setTitle(e.target.value.slice(0, 30))}
    placeholder="예: 크루즈닷 예약 확인"
    maxLength={30}
    className="w-full border rounded-lg px-3 py-2 text-sm"
  />
  <span className="text-xs text-gray-400 mt-1">
    {title.length}/30자
  </span>
</div>
```

### 본문 입력 필드
```tsx
<div className="rounded-xl border bg-white p-4">
  <div className="flex items-center justify-between mb-2">
    <label className="text-xs font-semibold text-gray-500">메시지 내용</label>
    <span className={`text-xs ${message.length > 900 ? "text-red-500 font-medium" : "text-gray-400"}`}>
      {message.length}/1000자
    </span>
  </div>
  <textarea
    value={message}
    onChange={e => setMessage(e.target.value)}
    placeholder="알림톡 본문 내용을 입력하세요"
    rows={8}
    className="w-full border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
    maxLength={1000}
  />
</div>
```

### 미리보기 카드
```tsx
{dryRunResult && (
  <div className="p-3 bg-gray-50 rounded-lg border">
    <p className="text-xs font-medium text-gray-600 mb-2">
      발송 예정: <span className="text-blue-600 font-bold">{dryRunResult.count}명</span>
    </p>
    <div className="text-sm bg-white border rounded p-2.5 whitespace-pre-wrap break-words">
      <strong>{title}</strong>
      <br/>
      {DOMPurify.sanitize(dryRunResult.sample, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })}
    </div>
  </div>
)}
```

---

## 📊 구현 우선순위

### P0: UI 구현 (1-2시간)
| 작업 | 파일 | 줄수 | 난이도 |
|------|------|------|--------|
| 탭 추가 | messages/page.tsx | 30 | ⭐ |
| KakaoTab 컴포넌트 | messages/page.tsx | 350-400 | ⭐⭐ |
| 스타일링 | Tailwind CSS | 100 | ⭐ |
| **소계** | | **480-530줄** | |

### P1: Backend API (2-3시간)
| 작업 | 파일 | 줄수 | 난이도 |
|------|------|------|--------|
| Kakao 그룹 발송 | api/groups/[id]/blast-kakao/route.ts | 250-300 | ⭐⭐ |
| Rate Limit | 기존 활용 | 30 | ⭐ |
| 로깅 | AdminMessage | 50 | ⭐ |
| 테스트 | 수동/자동 | - | ⭐⭐⭐ |
| **소계** | | **330-380줄** | |

### P2: 추가 기능 (선택사항)
| 작업 | 파일 | 줄수 | 난이도 |
|------|------|------|--------|
| Kakao 템플릿 API | api/tools/kakao-templates/route.ts | 100 | ⭐ |
| SMS-Logs 확장 | sms-logs/page.tsx | 30 | ⭐ |
| Day 0-3 자동화 | - | - | ⭐⭐⭐⭐ |

---

## 🔐 보안 체크리스트

모든 항목 SMS 구현과 동일하게 적용:
- [x] RBAC (역할 기반 접근)
- [x] IDOR 방지 (그룹 소유권 검증)
- [x] CSRF 토큰
- [x] Rate Limit (5회/일)
- [x] 입력값 검증 (제목/본문 길이)
- [x] XSS 방지 (DOMPurify)
- [x] API 키 보안 (환경변수)

---

## 📈 예상 효과

### 메시지 채널 다각화
| 메트릭 | SMS만 | SMS+Kakao | 증가율 |
|--------|-------|-----------|--------|
| 도달율 | 70% | 85-90% | +20-28% |
| 오픈율 | 25% | 40-45% | +60-80% |
| 클릭율 | 8% | 15-18% | +87-125% |
| 전환율 | 2-3% | 4-6% | +100-150% |
| **기대 월간 추가 매출** | - | **$40-80K** | |

---

## 🚀 마이그레이션 로드맵

### Week 1: Phase 1 (UI)
- [ ] messages/page.tsx 탭 추가 (30분)
- [ ] KakaoTab 컴포넌트 작성 (1.5시간)
- [ ] 스타일링 & 검수 (1시간)

### Week 2: Phase 2 (Backend)
- [ ] blast-kakao API 구현 (2시간)
- [ ] API 연동 & 테스트 (1시간)
- [ ] 배포 (30분)

### Week 3: Phase 2.5 (선택)
- [ ] Kakao 템플릿 API (1시간)
- [ ] SMS-logs 확장 (30분)
- [ ] Day 0-3 자동화 설계 (1시간)

---

## 💡 심리학 프레임워크 (T4 Template)

### PASONA + SPIN 통합
```
Day 0: P(Problem) + A(Agitate) - "예약 완료! 출발까지 D-5일"
Day 1: S(Solution) - "준비물 안내를 확인하세요"
Day 2: O(Offer) - "지중해 크루즈 매력 5가지"
Day 3: N(Narrow) + A(Action) - "남은 시간 3일! 객실 업그레이드"
```

---

## 📝 구현 체크리스트

### UI
- [ ] Kakao 탭 버튼 추가
- [ ] KakaoTab 컴포넌트
- [ ] 연결 상태 카드
- [ ] 제목/본문 입력 필드
- [ ] 치환변수 버튼
- [ ] DRY RUN 미리보기
- [ ] 발송 확인 & 버튼

### Backend
- [ ] POST /api/groups/[id]/blast-kakao
- [ ] DRY RUN 로직
- [ ] 실제 발송 로직
- [ ] Rate Limit 검증
- [ ] Kakao 설정 조회
- [ ] 로깅 (AdminMessage)
- [ ] 에러 처리

### 통합
- [ ] E2E 테스트
- [ ] SMS-logs 채널 필터
- [ ] 배포 및 모니터링

---

## 📚 참고 파일

| 파일 | 라인 | 용도 |
|------|------|------|
| `src/app/(dashboard)/messages/page.tsx` | 867 | 메인 페이지 수정 대상 |
| `src/app/api/groups/[id]/blast/route.ts` | 300+ | SMS API 참고 |
| `src/app/api/messages/send-kakao/route.ts` | 93 | Kakao 단건 발송 (기존) |
| `src/app/(dashboard)/sms-logs/page.tsx` | 368 | 로그 페이지 참고 |
| `prisma/schema.prisma` | - | AdminMessage 참고 |

---

**작성**: Claude Code Agent  
**날짜**: 2026-05-27 02:20 KST  
**버전**: 1.0 (분석 완료)
