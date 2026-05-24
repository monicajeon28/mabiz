# Menu #46 (설정) - 최종 스펙 문서 (2026-05-24)

## 📋 개요

**메뉴명**: 설정 (Settings)  
**메뉴 번호**: #46  
**우선순위**: P0 (기본 설정)  
**범위**: 사용자/팀/알림/통합/데이터/심리학 설정  
**예상 구현 기간**: 3주 (설계 1주 + 개발 1.5주 + QA 0.5주)

---

## 🎯 비즈니스 목표

1. **사용자 역량강화**: 개인/팀 설정으로 플랫폼 맞춤화
2. **데이터 안전성**: 암호화된 API 키 저장, 백업/복구 기능
3. **성과 자동화**: 심리학 렌즈 ON/OFF 토글로 자동화 범위 제어
4. **조직 거버넌스**: 팀원 권한 관리 및 감사 추적

---

## 📐 페이지 구조

### 메인 설정 대시보드 (Settings Hub)
- **경로**: `/settings`
- **컴포넌트**: Tabs 기반 네비게이션
- **목록 항목**:
  1. 프로필 (Profile)
  2. 팀 (Team)
  3. 알림 (Notifications)
  4. 통합 (Integrations)
  5. 데이터 (Data)
  6. 심리학 (Psychology)

---

## 🔑 기능 상세 설명

### 1️⃣ 프로필 설정 (Profile Tab)
**경로**: `/settings/profile`

#### 1.1 기본 정보 (Personal Information)
- **필드**:
  - 이름 (Name) - 텍스트 입력, 필수
  - 이메일 (Email) - 읽기 전용 (로그인 이메일)
  - 전화번호 (Phone) - 010-XXXX-XXXX 형식, 선택
  - 직위 (Title) - 대리점장/판매원/프리세일즈, 선택
  - 자기소개 (Bio) - 200자 제한, 선택

- **저장 방식**: 
  - `/api/settings/profile` PATCH 요청
  - User 모델에 직접 저장 (name, phone, title)
  - 프로필 수정 시 OrganizationMember.displayName 동시 업데이트

#### 1.2 프로필 사진 (Avatar)
- **기능**:
  - 업로드 크기: 최대 5MB (JPG/PNG)
  - 해상도: 최소 200x200px, 권장 400x400px
  - 저장소: 구글 클라우드 스토리지 (GCS)
  - URL 저장: User.profileImageUrl

- **업로드 프로세스**:
  1. 클라이언트: FormData로 이미지 전송
  2. 서버: `/api/upload/avatar` POST 요청
  3. 서버: GCS에 저장, 임시 URL 생성
  4. 클라이언트: URL 미리보기
  5. 저장: `/api/settings/profile` PATCH로 최종 저장

#### 1.3 서명 이미지 (Signature Image - 계약서용)
- **기능**:
  - 손글씨 서명 또는 이미지 업로드
  - 용도: 계약서/영수증에 자동 삽입
  - 저장소: GCS, 암호화 저장
  - URL 저장: User.signatureImageUrl

- **업로드 방식**: 프로필 사진과 동일

#### 1.4 비밀번호 변경 (Change Password)
- **기능**:
  - 현재 비밀번호 입력 (검증)
  - 새 비밀번호 입력 (8자 이상, 특수문자 포함)
  - 비밀번호 확인
  - 변경 시 모든 세션 로그아웃 (보안)

- **API**: `/api/auth/change-password` POST

---

### 2️⃣ 팀 설정 (Team Tab)
**경로**: `/settings/team`

#### 2.1 팀 정보 (Team Information)
- **필드**:
  - 팀명 (Organization Name) - 편집 가능, PATCH 저장
  - 팀 로고 (Team Logo) - 업로드, GCS 저장
  - 플랜 (Plan) - FREE/PRO, 읽기 전용
  - 가입일 (Created Date) - 읽기 전용
  - 대리점 코드 (Affiliate Code) - 읽기 전용, 복사 기능

- **API**: `/api/org/info` GET/PATCH

#### 2.2 팀 멤버 관리 (Team Members)
- **현황 표시**:
  - 총 멤버 수
  - 역할별 분류 (대리점장/판매원/프리세일즈)
  - 활성/비활성 상태

- **멤버 목록 (Member List)**:
  | 이름 | 이메일 | 역할 | 상태 | 액션 |
  |------|--------|------|------|------|
  | 성민형 | min@cruisedot.com | 대리점장 | 활성 | - |
  | 모니카 | monica@cruisedot.com | 판매원 | 활성 | 권한변경/제거 |
  | 박철수 | park@cruisedot.com | 프리세일즈 | 비활성 | 활성화/제거 |

- **권한 정의**:
  - **OWNER (대리점장)**:
    - 팀 설정 변경
    - 멤버 초대/제거
    - 모든 데이터 접근 (R/W)
    - 결제 정보 관리
    - 감사 로그 접근
  
  - **AGENT (판매원)**:
    - 자신의 데이터만 접근 (R/W)
    - 팀 공유 데이터 접근 (R)
    - 설정 변경 불가
    - 멤버 관리 불가
  
  - **FREE_SALES (프리세일즈)**:
    - 자신의 데이터 접근 (R)
    - 연락처 검색 (R)
    - SMS 발송 불가
    - 설정/멤버 관리 불가

- **멤버 초대 (Invite Member)**:
  - 이메일 입력
  - 역할 선택 (AGENT/FREE_SALES)
  - 선택사항: 메모/초대장 메시지
  - 초대 링크 생성 (7일 유효)
  - QR 코드 생성 (초대 링크)
  - 생성된 초대 링크 표시 및 복사 기능
  - 초대 토큰 이력: 대기/사용됨/만료

- **API**:
  - GET `/api/settings/team/members` - 멤버 목록 조회
  - PATCH `/api/settings/team/members/{userId}/role` - 역할 변경
  - DELETE `/api/settings/team/members/{userId}` - 멤버 제거
  - POST `/api/settings/team/invite` - 초대 생성
  - GET `/api/settings/team/invite-tokens` - 초대 이력

#### 2.3 팀 삭제 (Delete Team)
- **조건**:
  - OWNER만 가능
  - 경고: "조직과 모든 데이터가 영구 삭제됩니다"
  - 확인 메시지: 조직명 입력 필수
  - 백업 권장: "먼저 데이터 백업을 권장합니다"

- **프로세스**:
  1. 경고 다이얼로그 표시
  2. 조직명 입력 확인
  3. DELETE `/api/org/delete` POST
  4. 성공 시: 로그아웃 + 로그인 페이지 리다이렉트

---

### 3️⃣ 알림 설정 (Notifications Tab)
**경로**: `/settings/notifications`

#### 3.1 알림 채널 (Notification Channels)
- **SMS 알림**:
  - 전송 ON/OFF 토글
  - 발신번호 확인 (OrgSmsConfig.senderPhone)
  - 수신 번호 입력 (기본: 프로필 전화번호)
  - 저장: `/api/settings/notifications` PATCH

- **이메일 알림**:
  - 전송 ON/OFF 토글
  - 받는 이메일 주소 (기본: 로그인 이메일)
  - SMTP 설정 연동 확인
  - 저장: `/api/settings/notifications` PATCH

- **앱 알림** (푸시):
  - 브라우저 푸시 ON/OFF 토글
  - 앱 내 알림 (Toast/배너) 설정
  - 저장: `/api/settings/notifications` PATCH

#### 3.2 Day 0-3 SMS 시퀀스 커스터마이징 (SMS Sequence Customization)
- **기능**:
  - 렌탈 상품 Day 0-3 자동 SMS 메시지 커스텀
  - PASONA 프레임워크 기반 4개 메시지 편집

- **메시지 템플릿**:
  | Day | 단계 | 기본 메시지 | 편집 가능 | 변수 |
  |-----|------|----------|---------|------|
  | 0 | P(Problem) + A(Agitate) | "고객님, 크루즈 예약 감사합니다... [문제 인식]" | O | {고객명}, {상품명}, {가격} |
  | 1 | S(Solution) | "고객님, 이제 크루즈를 즐기기 위해... [해결책]" | O | {일정}, {할인율} |
  | 2 | O(Offer) + N(Narrow) | "한정: 이 주 예약자만... [오퍼 강화]" | O | {마감일} |
  | 3 | A(Action) | "최종 확인: 클릭해주세요... [행동 촉구]" | O | {확인링크} |

- **커스터마이징 방식**:
  1. 메시지 탭 선택
  2. 텍스트 편집 (실시간 미리보기)
  3. 변수 삽입 (드롭다운: {고객명}, {상품명} 등)
  4. 저장: `/api/settings/notifications/sms-sequence` PATCH
  5. 미리보기: 샘플 데이터로 시뮬레이션

#### 3.3 알림 카테고리별 설정 (Notification Categories)
- **정산 기한 알림 (Commission Deadline)**:
  - 활성화 ON/OFF
  - 알림 시점: "정산 마감일 N일 전"
  - 옵션: 3일 전, 7일 전, 14일 전 (다중선택)
  - 채널 선택: SMS, 이메일, 앱 알림
  - 저장: `/api/settings/notifications/categories` PATCH

- **A/B 테스트 결과 알림 (A/B Test Results)**:
  - 활성화 ON/OFF
  - 알림 시점: "테스트 완료 시", "우승자 결정 시"
  - 포함 정보: 테스트명, 승패, 성과 지표 (전환율, CPA)
  - 채널 선택: SMS, 이메일, 앱 알림
  - 저장: `/api/settings/notifications/categories` PATCH

- **판매 완료 알림 (Sale Complete)**:
  - 활성화 ON/OFF
  - 알림 시점: 즉시 또는 일일 요약
  - 포함 정보: 고객명, 상품, 금액
  - 저장: `/api/settings/notifications/categories` PATCH

- **시스템 알림 (System Alerts)**:
  - API 연동 실패 (Aligo, SMTP 등)
  - 저장소 용량 부족
  - 보안 경고 (비정상 로그인)
  - 활성화/비활성화 (항상 활성으로 권장)

- **API**: `/api/settings/notifications` GET/PATCH

---

### 4️⃣ 통합 설정 (Integrations Tab)
**경로**: `/settings/integrations`

#### 4.1 외부 API 키 관리 (External API Keys)

**4.1.1 크루즈닷몰 API (CruiseDot Mall API)**
- **용도**: 상품 데이터 동기화, 주문 정보 연동
- **필드**:
  - API Key (필수)
  - API Secret (필수, 마스킹 표시)
  - Webhook URL (자동 생성, 복사 가능)
  - 연결 상태: 성공/실패/검증 대기
  - 마지막 동기화: YYYY-MM-DD HH:mm

- **저장 방식**:
  - 암호화: AES-256으로 암호화 저장
  - 테이블: IntegrationKey (organizationId, providerName, keyEncrypted)
  - API: POST/PATCH `/api/settings/integrations/api-key` (암호 필드만 PATCH)

- **연결 테스트**:
  - "연결 테스트" 버튼 클릭
  - 서버: 크루즈닷몰 API 호출로 검증
  - 결과: 성공/실패 토스트 메시지 + 에러 상세 표시

**4.1.2 페이앱 API (PayApp API)**
- **용도**: 결제 처리, 정산 조회
- **필드**:
  - Merchant ID (필수)
  - API Key (필수, 마스킹)
  - API Secret (필수, 마스킹)
  - Webhook Secret (필수, 마스킹)
  - 연결 상태: 성공/실패
  - 마지막 결제 조회: YYYY-MM-DD HH:mm

- **저장 방식**: 크루즈닷몰 API와 동일
- **연결 테스트**: `/api/settings/integrations/payapp/test` POST

**4.1.3 Slack 웹훅 (Slack Webhook)**
- **용도**: 팀 알림, 판매 완료 공지, A/B 테스트 결과
- **필드**:
  - Webhook URL (필수, 마스킹)
  - Channel (자동 감지, 읽기 전용)
  - 연결 상태: 성공/실패
  - 마지막 테스트: YYYY-MM-DD HH:mm

- **저장 방식**: IntegrationKey 테이블 (providerName="SLACK")
- **연결 테스트**: "/api/settings/integrations/slack/test" POST
  - 테스트 메시지: "마비즈 CRM 연동 완료: YYYY-MM-DD HH:mm"

#### 4.2 이메일 서비스 연동 (Email Service Integration)

**4.2.1 Gmail 연동 (Google OAuth)**
- **용도**: 이메일 발송, 받은 편지함 연동
- **방식**: OAuth 2.0 (Google Sign-In)
- **범위**: gmail.send, gmail.readonly
- **저장**:
  - RefreshToken 암호화 저장 (OrgEmailConfig)
  - 사용자 이메일: OrgEmailConfig.senderEmail
  - 발신자 이름: OrgEmailConfig.senderName

- **버튼**: "Gmail 연동하기"
  - 클릭 → Google OAuth 팝업
  - 권한 승인 → 토큰 저장
  - 완료 → "Gmail 연동됨" 표시

- **API**:
  - GET `/api/settings/integrations/gmail/auth-url` - OAuth URL 생성
  - POST `/api/settings/integrations/gmail/callback` - 토큰 저장

**4.2.2 Outlook 연동 (Microsoft OAuth)**
- **용도**: 이메일 발송, 받은 편지함 연동
- **방식**: OAuth 2.0 (Microsoft Login)
- **범위**: Mail.Send, Mail.Read
- **저장**: 방식은 Gmail과 동일

- **버튼**: "Outlook 연동하기"

**4.2.3 이메일 설정 (Manual SMTP)**
- **용도**: 조직 이메일 (Naver, Daum 등)
- **필드**:
  - SMTP 호스트 (예: smtp.naver.com)
  - SMTP 포트 (기본: 587)
  - 발신 이메일 (필수)
  - 발신 비밀번호 (필수, 마스킹)
  - 이름 (발신자 이름)

- **저장**: OrgEmailConfig 테이블
- **연결 테스트**: POST `/api/settings/integrations/email/test`
  - 테스트 이메일 발송
  - 결과: 성공/실패 표시

- **API**:
  - GET `/api/settings/integrations/email` - 기존 설정 조회
  - POST/PATCH `/api/settings/integrations/email` - 저장

#### 4.3 웹훅 관리 (Webhook Management)
- **목록 표시**:
  | 서비스 | 이벤트 | Webhook URL | 상태 | 마지막 실행 | 액션 |
  |--------|--------|------------|------|----------|------|
  | 크루즈닷몰 | 주문 생성 | wh_order_... | 활성 | 2min ago | 재시도/재등록 |
  | 페이앱 | 결제 완료 | wh_payment_... | 활성 | 5min ago | 재시도/재등록 |

- **기능**:
  - 웹훅 URL 자동 생성 (서버에서 UUID 기반)
  - 활성/비활성 토글
  - 재시도 버튼
  - 전달 이력 조회

- **API**: 
  - GET `/api/settings/integrations/webhooks` - 목록 조회
  - POST `/api/settings/integrations/webhooks/{id}/retry` - 재시도

#### 4.4 기타 연동 (Other Integrations)
- **예약 가능한 통합**:
  - Zapier (자동화)
  - Make.com (워크플로우)
  - WhatsApp Business (메시지)
  - Telegram (알림)

- **현황**: "곧 출시 예정" 배지 표시

---

### 5️⃣ 데이터 설정 (Data Tab)
**경로**: `/settings/data`

#### 5.1 데이터 백업 (Data Backup)

**5.1.1 자동 백업 설정 (Automatic Backup)**
- **기능**:
  - 자동 백업 ON/OFF
  - 백업 빈도: 일일, 주간, 월간 선택
  - 백업 시간: 시간 선택 (기본: 02:00 KST)
  - 저장 위치: 구글 드라이브 또는 Dropbox

- **저장 방식**:
  - BackupLog 테이블 (organizationId, backupType, status, fileUrl)
  - 실제 백업: GCS 또는 구글 드라이브

**5.1.2 수동 백업 (Manual Backup)**
- **기능**:
  - "지금 백업" 버튼
  - 선택 옵션: 전체/연락처만/거래만/문서만
  - 진행률 표시 (로딩 바)
  - 완료 시: 다운로드 링크 + 이메일 발송

- **백업 포함 항목**:
  - 조직 설정
  - 연락처 (Contact)
  - 거래 (Contract)
  - 문서 (Document)
  - SMS 로그
  - CRM 자동화 설정

- **API**: 
  - POST `/api/settings/backup/create` - 백업 시작
  - GET `/api/settings/backup/logs` - 백업 이력
  - GET `/api/settings/backup/download/{id}` - 다운로드

#### 5.2 데이터 내보내기 (Data Export)

**5.2.1 Export 형식**
- **CSV**: 연락처, 거래, SMS 로그
- **JSON**: 모든 데이터 (API 호환)
- **PDF**: 보고서 형식 (정산, 매출 집계)

**5.2.2 Export 옵션**
- 날짜 범위 선택 (필수)
- 포함 데이터 선택 (체크박스):
  - [ ] 연락처 + 상담 기록
  - [ ] 거래 + 영수증
  - [ ] SMS 발송 이력
  - [ ] 매출 보고서
  - [ ] 렌즈별 성과 분석
- 포맷 선택 (CSV/JSON/PDF)
- "내보내기" 버튼 클릭
- 완료 시: 다운로드 + 이메일 발송

**5.2.3 API**:
- POST `/api/settings/export` - 내보내기 시작
- GET `/api/settings/export/logs` - 내보내기 이력

#### 5.3 삭제 데이터 복구 (Data Recovery)

**5.3.1 복구 대상**
- **보관 기간**: 30일 (삭제 후 30일 동안 복구 가능)
- **복구 대상**:
  - 삭제된 연락처 (soft delete)
  - 삭제된 거래 (soft delete)
  - 삭제된 문서 (soft delete)

**5.3.2 복구 인터페이스**
- 삭제된 항목 목록:
  | 유형 | 이름 | 삭제일 | 복구 기한 | 액션 |
  |------|-----|--------|---------|------|
  | 연락처 | 홍길동 | 2026-05-20 | 2026-06-19 | 복구/영구삭제 |
  | 거래 | 크루즈 예약 | 2026-05-21 | 2026-06-20 | 복구/영구삭제 |

- **복구 프로세스**:
  1. 항목 선택
  2. "복구" 버튼 클릭
  3. 확인 다이얼로그: "정말 복구하시겠습니까?"
  4. 복구 실행 (isDeleted=false로 업데이트)
  5. 완료 토스트 메시지

**5.3.3 API**:
- GET `/api/settings/recovery/deleted-items` - 삭제된 항목 목록
- POST `/api/settings/recovery/restore/{id}` - 복구
- DELETE `/api/settings/recovery/permanently-delete/{id}` - 영구삭제

#### 5.4 저장소 관리 (Storage Management)
- **저장소 현황**:
  - 사용량: 2.3 GB / 10 GB (23%)
  - 사용 내역:
    - 연락처: 150 MB
    - 문서: 500 MB
    - 이미지 라이브러리: 1.2 GB
    - 백업: 450 MB

- **초과 시 대책**:
  - 90% 이상: 경고 배지 + 업그레이드 권장
  - 100% 이상: 쓰기 차단 + "저장소 정리 필요" 알림

---

### 6️⃣ 심리학 설정 (Psychology Tab)
**경로**: `/settings/psychology`

#### 6.1 활성화된 렌즈 관리 (Enabled Lenses)

**6.1.1 렌즈 목록 (Lens List)**
- **표시 형식**: 토글 ON/OFF + 설명

| 렌즈 | 설명 | 활성화 | 자세히 |
|------|------|--------|--------|
| **L0** | 부재중 고객 재활성화 (감정적 재연결) | ☑️ | [?] |
| **L1** | 가격 이의 대응 (가치 재정의) | ☑️ | [?] |
| **L2** | 준비 복잡 불안 (5단계 중재) | ☐ | [?] |
| **L3** | 차별성 미인지 (경쟁사 비교) | ☑️ | [?] |
| **L4** | [기능 맞춤형] | ☐ | [?] |
| **L5** | 자기투영 (고객 상황 일치) | ☑️ | [?] |
| **L6** | 타이밍 손실회피 | ☑️ | [?] |
| **L7** | 동반자 설득 (가족 설득) | ☐ | [?] |
| **L8** | 재구매 습관화 | ☑️ | [?] |
| **L9** | 의료신뢰 (건강/안전) | ☐ | [?] |
| **L10** | 즉시 구매 클로징 | ☑️ | [?] |

**6.1.2 토글 기능**
- 각 렌즈 행의 ON/OFF 토글
- 토글 변경 시: 즉시 `/api/settings/psychology/lenses` PATCH
- 완료 토스트: "L0 렌즈가 활성화되었습니다"
- 비활성화 시: 해당 렌즈의 자동화 규칙 비활성화 (CRM 워크플로우)

**6.1.3 렌즈 상세 정보 (Lens Details)**
- [?] 아이콘 클릭 → 모달 팝업
- 포함 정보:
  - 렌즈명 (L0-L10)
  - 설명 (200자)
  - 심리학 원리 (예: 손실회피, 긴박감)
  - 전환율 증가 기대치 (예: +15-25%)
  - 자동화 규칙 목록 (활성 규칙만 표시)
  - 예시 고객 시나리오

#### 6.2 A/B 테스트 설정 (A/B Test Configuration)

**6.2.1 Day 0-3 SMS 자동 A/B 테스트**
- **기능**:
  - 활성화 ON/OFF
  - "활성화"하면 Day 0-3 SMS 발송 시 자동으로 2가지 변형 A/B 테스트
  - 세그먼트: 50% A 메시지, 50% B 메시지 (무작위 배분)

- **테스트 대상**:
  - Day 0 (P+A 단계): 문제 표현 방식 (긴박감 vs 감정적 재연결)
  - Day 1 (S 단계): 솔루션 강조 방식 (기능 vs 이득)
  - Day 2 (O+N 단계): 오퍼 표현 (희소성 vs 가치)
  - Day 3 (A 단계): 행동 촉구 (긴급 vs 선택권)

- **변형 메시지 템플릿**:
  - A: 기본 메시지
  - B: 심리학 변형 (렌즈별 최적화)

**6.2.2 테스트 설정 페이지**
- "테스트 활성화" 체크박스
- 테스트 기간 선택:
  - 기간: "이번 주", "이번 달", "설정 기간"
  - 커스텀 기간: 시작일~종료일
- 승리 기준: "전환율", "응답율", "클릭율"
- "저장" 버튼 → `/api/settings/psychology/ab-test` PATCH

**6.2.3 테스트 결과 조회**
- 진행 중 테스트 목록:
  | 테스트 | 시작일 | 기간 | 메시지A | 메시지B | A 전환율 | B 전환율 | 우승 | 상태 |
  |--------|--------|------|---------|---------|---------|---------|------|------|
  | Day0 L6 | 2026-05-20 | 10일 | 기본 | +긴박감 | 8.2% | 12.5% | B | 진행중 |
  | Day1 L3 | 2026-05-18 | 5일 | 기본 | +차별성 | 10.1% | 10.8% | B | 완료 |

- 완료된 테스트:
  - "우승자" 메시지를 다음 주부터 자동 적용
  - 스타일: "자동 우승자 적용됨" 배지

- **API**:
  - GET `/api/settings/psychology/ab-tests` - 테스트 목록
  - GET `/api/settings/psychology/ab-tests/{id}/results` - 상세 결과

#### 6.3 성과 리포팅 기간 (Performance Reporting Period)

**6.3.1 리포팅 기간 설정**
- **기간 옵션** (라디오 버튼):
  - [ ] 주간 (매주 월요일 리포트)
  - [ ] 월간 (매달 1일 리포트)
  - [ ] 분기 (Q1/Q2/Q3/Q4 시작일 리포트)
  - [ ] 커스텀 (시작일, 반복 주기 선택)

- **리포트 내용** (자동 포함):
  - 기간별 매출
  - 렌즈별 전환율
  - A/B 테스트 결과
  - 활성 고객 수
  - 정산 완료율

- **발송 채널** (다중선택):
  - [ ] 이메일
  - [ ] SMS
  - [ ] Slack
  - [ ] 대시보드 알림

#### 6.4 목표 설정 (Goal Setting)

**6.4.1 월간 목표**
- **월 매출**: 원 단위 입력 (기본: 50,000,000원)
- **전환율**: 퍼센트 입력 (기본: 15%)
- **정산완료율**: 퍼센트 입력 (기본: 95%)
- **고객수**: 명 단위 입력 (기본: 100명)

**6.4.2 목표별 자동화 규칙**
- 목표 달성도 현황판:
  ```
  월 매출: 35,200,000원 / 50,000,000원 (70%) [████████░░]
  전환율: 12.5% / 15% (83%) [██████████░░]
  정산완료: 92% / 95% (96%) [████████████░]
  ```

- 목표 미달 시:
  - 실시간 알림: "월 매출 목표까지 14,800,000원 남음"
  - CPA 최적화 자동 제안
  - A/B 테스트 가속화 권장

**6.4.3 API**:
- GET/PATCH `/api/settings/psychology/goals` - 목표 관리

---

## 🔐 보안 고려사항

### 6.1 API 키 암호화
- **알고리즘**: AES-256-GCM
- **구현**:
  ```typescript
  // 저장 시
  const encrypted = encrypt(apiKey, process.env.ENCRYPTION_KEY);
  await prisma.integrationKey.create({
    data: { organizationId, providerName, keyEncrypted: encrypted }
  });

  // 사용 시
  const encrypted = await prisma.integrationKey.findUnique(...);
  const apiKey = decrypt(encrypted.keyEncrypted, process.env.ENCRYPTION_KEY);
  ```

### 6.2 권한 검증
- **모든 PATCH/DELETE 요청에 권한 확인**:
  - OWNER만 설정 변경 가능
  - AGENT는 자신의 프로필만 수정 가능
  - FREE_SALES는 조회만 가능

### 6.3 감사 로그 (Audit Log)
- **기록 항목**:
  - API 키 변경 (성공/실패)
  - 멤버 추가/제거
  - 권한 변경
  - 데이터 백업/복구
  - 로그인 실패 (IP, 시간)

- **저장**: AuditLog 테이블 (userId, action, resource, changes, timestamp)

### 6.4 CSRF 보호
- 모든 POST/PATCH/DELETE에 CSRF 토큰 필수
- 토큰 생성: `/api/csrf-token` GET
- 헤더 전송: `X-CSRF-Token: [token]`

### 6.5 Rate Limiting
- 백엔드 Rate Limit:
  - 일반 요청: 60 req/min
  - 민감한 요청 (비밀번호, 삭제): 5 req/min
- 프론트엔드 체크: 버튼 중복 클릭 방지 (disabled 상태)

---

## 📊 데이터베이스 스키마

### 필요한 추가 모델

```prisma
// 1. 설정 (일반)
model UserSettings {
  id             String   @id @default(cuid())
  userId         String   @unique
  organizationId String
  
  // 프로필
  phone          String?
  title          String?  // OWNER, AGENT, FREE_SALES
  bio            String?  @db.VarChar(200)
  
  // 알림
  smsNotifications      Boolean @default(true)
  emailNotifications    Boolean @default(true)
  pushNotifications     Boolean @default(true)
  
  // 심리학
  enabledLenses         String[] @default([])  // ["L0", "L1", "L5", ...]
  abTestEnabled         Boolean @default(true)
  reportingPeriod       String  @default("MONTHLY")  // WEEKLY, MONTHLY, QUARTERLY
  
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  @@index([userId])
  @@index([organizationId])
}

// 2. 통합 키 (암호화)
model IntegrationKey {
  id             String   @id @default(cuid())
  organizationId String
  providerName   String   // "CRUISEDOT_MALL", "PAYAPP", "SLACK", "GMAIL", "OUTLOOK"
  keyEncrypted   String   // AES-256 암호화
  
  // 상태 추적
  isActive       Boolean  @default(true)
  lastTestedAt   DateTime?
  testStatus     String?  // "SUCCESS", "FAILED"
  testError      String?
  
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  @@unique([organizationId, providerName])
  @@index([organizationId])
}

// 3. SMS 시퀀스 커스텀
model SmsSequenceCustomization {
  id             String   @id @default(cuid())
  organizationId String
  productId      String?  // 특정 상품에만 적용 시
  
  // Day 0-3 메시지
  day0Message    String   @db.Text
  day1Message    String   @db.Text
  day2Message    String   @db.Text
  day3Message    String   @db.Text
  
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  @@unique([organizationId, productId])
  @@index([organizationId])
}

// 4. 백업 로그
model BackupLog {
  id             String   @id @default(cuid())
  organizationId String
  
  backupType     String   // "FULL", "CONTACTS_ONLY", "DEALS_ONLY", "DOCUMENTS_ONLY"
  status         String   // "PENDING", "COMPLETED", "FAILED"
  fileUrl        String?  // GCS URL
  fileSize       Int?     // 바이트
  
  scheduledTime  DateTime?  // 자동 백업인 경우
  completedAt    DateTime?
  errorMessage   String?
  
  createdAt      DateTime @default(now())
  
  @@index([organizationId])
  @@index([createdAt])
}

// 5. 목표 설정
model PsychologyGoal {
  id             String   @id @default(cuid())
  organizationId String
  
  month          String   // "2026-05" 형식
  
  // 목표
  monthlyRevenue Int      // 원 단위
  conversionRate Float    // 퍼센트
  settlementRate Float    // 정산완료율 퍼센트
  customerCount  Int      // 목표 고객 수
  
  // 실제 현황 (대시보드에서 동적 계산)
  // actualRevenue, actualConversionRate, ... (View로 계산)
  
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  @@unique([organizationId, month])
  @@index([organizationId])
}

// 6. A/B 테스트 (기존 테이블 확장)
model AbTest {
  // ... 기존 필드
  psychologyLens  String?  // "L0", "L1", ... A/B 테스트 관련 렌즈
  autoApplyWinner Boolean @default(true)
}

// 7. 감사 로그
model AuditLog {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  
  action         String   // "CREATE", "UPDATE", "DELETE"
  resource       String   // "SETTINGS", "MEMBER", "API_KEY", ...
  resourceId     String?
  
  changes        String   @db.Text  // JSON 형식
  ipAddress      String?
  userAgent      String?
  
  createdAt      DateTime @default(now())
  
  @@index([organizationId])
  @@index([userId])
  @@index([createdAt])
}
```

---

## 🛠️ API 엔드포인트 설계

**기본 경로**: `/api/settings`

### 프로필
- `GET /api/settings/profile` - 프로필 조회
- `PATCH /api/settings/profile` - 프로필 수정
- `POST /api/upload/avatar` - 프로필 사진 업로드
- `POST /api/upload/signature` - 서명 이미지 업로드
- `POST /api/auth/change-password` - 비밀번호 변경

### 팀
- `GET /api/org/info` - 조직 정보 조회
- `PATCH /api/org/info` - 조직 정보 수정
- `GET /api/settings/team/members` - 멤버 목록
- `POST /api/settings/team/invite` - 초대 생성
- `GET /api/settings/team/invite-tokens` - 초대 이력
- `PATCH /api/settings/team/members/{userId}/role` - 역할 변경
- `DELETE /api/settings/team/members/{userId}` - 멤버 제거
- `DELETE /api/org/delete` - 조직 삭제

### 알림
- `GET /api/settings/notifications` - 알림 설정 조회
- `PATCH /api/settings/notifications` - 알림 설정 수정
- `GET /api/settings/notifications/sms-sequence` - SMS 시퀀스 조회
- `PATCH /api/settings/notifications/sms-sequence` - SMS 시퀀스 커스터마이징
- `GET /api/settings/notifications/categories` - 카테고리 조회
- `PATCH /api/settings/notifications/categories` - 카테고리 수정

### 통합
- `GET /api/settings/integrations` - 통합 목록
- `POST /api/settings/integrations/api-key` - API 키 저장
- `PATCH /api/settings/integrations/api-key/{provider}` - API 키 수정
- `DELETE /api/settings/integrations/api-key/{provider}` - API 키 삭제
- `POST /api/settings/integrations/{provider}/test` - 연결 테스트
- `POST /api/settings/integrations/gmail/auth-url` - Gmail OAuth URL
- `POST /api/settings/integrations/gmail/callback` - Gmail 토큰 저장
- `GET /api/settings/integrations/webhooks` - 웹훅 목록
- `POST /api/settings/integrations/webhooks/{id}/retry` - 웹훅 재시도

### 데이터
- `POST /api/settings/backup/create` - 백업 시작
- `GET /api/settings/backup/logs` - 백업 이력
- `GET /api/settings/backup/download/{id}` - 백업 다운로드
- `POST /api/settings/export` - 데이터 내보내기
- `GET /api/settings/recovery/deleted-items` - 삭제된 항목 목록
- `POST /api/settings/recovery/restore/{id}` - 복구
- `DELETE /api/settings/recovery/permanently-delete/{id}` - 영구삭제

### 심리학
- `GET /api/settings/psychology/lenses` - 렌즈 목록
- `PATCH /api/settings/psychology/lenses` - 렌즈 활성화/비활성화
- `GET /api/settings/psychology/ab-tests` - A/B 테스트 목록
- `GET /api/settings/psychology/ab-tests/{id}/results` - 테스트 결과
- `PATCH /api/settings/psychology/ab-test` - A/B 테스트 설정
- `GET /api/settings/psychology/goals` - 목표 조회
- `PATCH /api/settings/psychology/goals` - 목표 설정

---

## 📱 UI/UX 가이드

### 디자인 토큰
- **색상**: 기존 디자인 시스템 준수 (navy-900, gold-300, gray-**)
- **타이포**: 헤더 lg (18px), 본문 sm (14px), 라벨 xs (12px)
- **간격**: 4px 기반 그리드 (p-4, gap-3 등)
- **라디우**: 반둥근 모서리 (rounded-xl = 12px)

### 컴포넌트
- **Tabs**: 수평 탭 네비게이션 (기존 TabsRoot 활용)
- **Input**: 텍스트, 이메일, 비밀번호, URL 입력
- **Toggle**: ON/OFF 스위치 (렌즈, 알림)
- **Button**: Primary (저장), Secondary (취소), Danger (삭제)
- **ConfirmDialog**: 위험한 작업 (조직 삭제, 영구삭제)
- **Toast**: 성공/실패 메시지 (상단 우측)

### 반응형 대응
- **모바일** (< 640px): 한 열 레이아웃, 큰 터치 타겟 (44px)
- **태블릿** (640-1024px): 두 열, 조정된 여백
- **데스크톱** (> 1024px): 최대 너비 1200px, 사이드바 지원

---

## 🎯 구현 우선순위 (Phase별)

### Phase 1 (P0 - 필수): 1주
- [ ] 프로필 설정 (이름, 이메일, 전화번호)
- [ ] 팀 정보 조회/수정
- [ ] 팀 멤버 조회
- [ ] 조직 삭제 (경고 포함)
- [ ] API 키 저장/테스트 (크루즈닷몰, 페이앱, Slack)

### Phase 2 (P1 - 중요): 1주
- [ ] 팀 멤버 초대/역할 변경/제거
- [ ] 프로필 사진/서명 업로드
- [ ] 알림 설정 (SMS, 이메일, 앱)
- [ ] SMS 시퀀스 커스터마이징
- [ ] 이메일 연동 (Gmail, Outlook, SMTP)

### Phase 3 (P2 - 부가): 3일
- [ ] 데이터 백업 (자동/수동)
- [ ] 데이터 내보내기 (CSV/JSON)
- [ ] 삭제 데이터 복구 (30일)
- [ ] 심리학 렌즈 토글
- [ ] A/B 테스트 설정

### Phase 4 (P3 - 옵션): 2일
- [ ] 목표 설정 (월 매출, 전환율 등)
- [ ] 감사 로그 조회
- [ ] 고급 통합 (Zapier, Make.com)

---

## ✅ 배포 전 체크리스트

### 기능 완성도
- [ ] 모든 6개 탭 페이지 구현
- [ ] 모든 API 엔드포인트 구현
- [ ] 권한 검증 (OWNER/AGENT/FREE_SALES)
- [ ] 에러 핸들링 및 유효성 검사
- [ ] 로딩 상태 및 진행률 표시

### 보안
- [ ] API 키 AES-256 암호화
- [ ] CSRF 토큰 적용
- [ ] Rate Limiting 구현
- [ ] 감사 로그 기록
- [ ] 민감한 정보 마스킹 (****)

### UX/성능
- [ ] 모바일/태블릿/데스크톱 반응형
- [ ] 접근성 (WCAG 2.1 AA): ARIA, 키보드 네비, 포커스
- [ ] 로딩 성능: Lighthouse 90+ (LCP < 2.5s)
- [ ] 404/500 에러 페이지

### 테스트
- [ ] 단위 테스트 (API, 암호화 함수)
- [ ] 통합 테스트 (권한 검증, 데이터 저장)
- [ ] E2E 테스트 (전체 플로우: 로그인 → 설정 변경 → 저장)
- [ ] 보안 테스트 (권한 우회 시도, SQL 인젝션)

### 문서
- [ ] API 문서 (Swagger/OpenAPI)
- [ ] 사용자 가이드 (각 설정별)
- [ ] 관리자 가이드 (팀 관리, 권한)
- [ ] CHANGELOG 업데이트

---

## 📚 참고 자료

- **Template**: CLAUDE_AGENT_PROMPTS.md - Template #5 (CRM 자동화) + Template #6 (대시보드)
- **메모리**: [[menu_39_crm_5product_integration_complete]], [[menu_37_call_playbook_complete]]
- **심리학**: [[grant_cardone_closing]], [[l0_reactivation_inactive_customers]] ~ [[l10_immediate_purchase_closing]]

---

**버전**: 1.0  
**작성일**: 2026-05-24  
**담당자**: 마비즈 CRM 팀  
**상태**: 구현 준비 완료
