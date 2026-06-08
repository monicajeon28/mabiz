# Vercel 환경변수 설정 인덱스

**작성일**: 2026-06-08  
**최종 업데이트**: 2026-06-08  
**버전**: 1.0  
**상태**: Production Ready

---

## 📚 문서 구조

마비즈 CRM을 Vercel에 배포할 때 필요한 모든 문서가 여기 정리되어 있습니다.

### 🎯 당신의 상황에 맞는 문서 선택

#### 🚀 **지금 바로 배포하고 싶다면** (5분)
```
→ VERCEL_DEPLOYMENT_QUICK_START.md
→ 3단계 빠른 배포 가이드
→ 핵심만 정리된 체크리스트
```

#### ✅ **차근차근 따라가면서 배포하고 싶다면** (25분)
```
→ VERCEL_SETUP_CHECKLIST.md
→ 상세한 체크리스트
→ 각 단계별 스크린샷 포함
→ 오류 해결책 포함
```

#### 📖 **상세한 설명과 함께 이해하고 싶다면** (40분)
```
→ VERCEL_ALIGO_SETUP.md
→ 완전한 설명서
→ 보안 고려사항
→ 일반적인 오류 및 해결책
```

#### 🔧 **기술 구현을 알고 싶다면** (50분)
```
→ ALIGO_IMPLEMENTATION.md
→ SMS 아키텍처
→ API 명세
→ 데이터베이스 스키마
```

---

## 📋 필수 환경변수 4개

### 요약

| 이름 | 용도 | 필수여부 | 예시 |
|------|------|---------|------|
| **ALIGO_USER_ID** | Aligo 계정 ID | ✅ 필수 | `user123abc` |
| **ALIGO_API_KEY** | Aligo API 키 (보안) | ✅ 필수 | `abcd1234efgh5678` |
| **ALIGO_SENDER_PHONE** | SMS 발신번호 | ✅ 필수 | `0215114560` |
| **CRON_SECRET** | Cron Job 보안 토큰 | ✅ 필수 | `vVExp...SAo=` |

### 설정 방법

```
1. Vercel 대시보드 접속: https://vercel.com/dashboard
2. 프로젝트 선택 → Settings → Environment Variables
3. 위 4개 변수 모두 추가
4. Production 환경에서만 설정 (Preview/Dev 선택사항)
5. Redeploy 실행
```

---

## 🔄 배포 프로세스

### 1단계: 사전 준비 (5분)
```
✅ Aligo 계정 생성
✅ API Key 확보
✅ 발신자 번호 승인 확인
✅ Aligo 충전금 50,000원 이상
```

**참고**: ALIGO_SETUP.md

### 2단계: Vercel 설정 (10분)
```
✅ Vercel 대시보드 접속
✅ 4개 환경변수 입력
✅ Production 환경 선택
✅ 모두 저장
```

**참고**: VERCEL_SETUP_CHECKLIST.md

### 3단계: 배포 (5분)
```
✅ Redeploy 실행
✅ 배포 상태 모니터링 (3-5분)
✅ Success 초록색 체크 확인
```

### 4단계: 테스트 (5분)
```
✅ SMS 테스트 발송
✅ 1-10초 내 수신 확인
✅ 통계 페이지 기록 확인
```

**참고**: VERCEL_ALIGO_SETUP.md의 "5️⃣ SMS 발송 테스트"

---

## 🗺️ 문서 네비게이션

```
┌─ VERCEL_ENV_SETUP_INDEX.md (이 문서)
│  └─ 전체 문서 인덱스 및 선택 가이드
│
├─ VERCEL_DEPLOYMENT_QUICK_START.md ⭐ (초보자용)
│  ├─ 3단계 빠른 배포 (30분)
│  ├─ FAQ
│  ├─ 보안 주의사항
│  └─ 다음 단계
│
├─ VERCEL_SETUP_CHECKLIST.md (중급자용)
│  ├─ 사전 준비 체크리스트
│  ├─ Vercel 설정 (5단계)
│  ├─ 최종 확인
│  ├─ 배포
│  ├─ SMS 테스트
│  └─ 오류 해결표
│
├─ VERCEL_ALIGO_SETUP.md (상세 가이드)
│  ├─ 1️⃣ 사전 준비 (Aligo 확인)
│  ├─ 2️⃣ Vercel 대시보드 설정
│  ├─ 3️⃣ 환경변수 추가 (4개)
│  ├─ 4️⃣ 확인 & 배포
│  ├─ 5️⃣ SMS 발송 테스트
│  ├─ ⚙️ 환경변수 완전 리스트
│  ├─ 🔐 보안 체크리스트
│  ├─ ❌ 일반적인 오류 & 해결책
│  └─ 📞 지원 & 문제 해결
│
├─ ALIGO_SETUP.md (Aligo 설정)
│  ├─ 1. Aligo 계정 설정
│  ├─ 2. CRM 환경 변수 설정
│  ├─ 3. SMS 발송 기능 사용
│  ├─ 4. SMS 상태 추적
│  ├─ 5. 오류 처리 및 재시도
│  ├─ 6. 야간 발송 차단
│  ├─ 7. 발신자 번호 검증
│  ├─ 8. 비용 및 한도
│  ├─ 9. 모니터링 및 로깅
│  ├─ 10. 테스트 모드
│  └─ 11. 문제 해결
│
├─ ALIGO_IMPLEMENTATION.md (기술 구현)
│  ├─ 🏗️ 아키텍처 (3계층)
│  ├─ 📁 파일 구조 (신규/수정)
│  ├─ 🔑 핵심 기능 (3가지)
│  ├─ ⚙️ Cron Jobs (2가지)
│  ├─ 🧪 테스트 방법
│  ├─ 📊 성능 지표
│  ├─ 🔐 보안 고려사항
│  ├─ 📈 모니터링
│  └─ 🚀 배포 체크리스트
│
└─ scripts/setup-vercel-env.ts (자동화 스크립트)
   └─ Vercel CLI를 사용한 자동 설정 (선택사항)
```

---

## ⏱️ 소요 시간별 가이드

### 🟢 5분 빠른 배포
```
→ VERCEL_DEPLOYMENT_QUICK_START.md
→ 3단계 배포 + 테스트
→ 최소한의 설명
```

### 🟡 25분 안내 배포
```
→ VERCEL_SETUP_CHECKLIST.md
→ 체크리스트 형식으로 단계별 진행
→ 오류 해결법 포함
```

### 🔴 40분 완전 이해 배포
```
→ VERCEL_ALIGO_SETUP.md
→ 상세한 설명 + 스크린샷
→ 보안 고려사항
→ 일반적인 오류 전체 커버
```

### 🟣 1시간 기술 학습
```
→ ALIGO_SETUP.md + ALIGO_IMPLEMENTATION.md
→ 기술 아키텍처 이해
→ API 명세 학습
→ 향후 수정/확장에 필요한 지식
```

---

## 🎯 배포 체크리스트 (최종)

### 배포 전
```
☐ VERCEL_DEPLOYMENT_QUICK_START.md 또는 VERCEL_SETUP_CHECKLIST.md 선택
☐ Aligo 계정 정보 4개 확보 (USER_ID, API_KEY, SENDER_PHONE, 충전금)
☐ Vercel 프로젝트 접근 권한 확인
```

### 배포 중
```
☐ 4개 환경변수를 Vercel에 입력
☐ Production 환경 선택 확인
☐ Redeploy 실행 및 완료 대기
```

### 배포 후
```
☐ SMS 테스트 발송 성공
☐ 응답에 msgId 반환됨
☐ 1-10초 내 실제 수신 확인
☐ 통계 페이지에 기록 표시
```

---

## 🔐 보안 체크리스트

```
☐ API Key는 Vercel 대시보드에만 저장 (Git X)
☐ .env.production은 .gitignore에 포함
☐ ALIGO_API_KEY와 CRON_SECRET은 Production만 설정
☐ 분기별(3개월) API Key 갱신 계획
☐ Preview 환경 설정 시 별도의 테스트용 키 사용
```

---

## 📱 배포 후 일상 운영

### 일일
```
☐ SMS 통계 확인: https://mabizcruisedot.com/admin/sms/stats
☐ 배송 오류 확인
☐ 실패율이 5% 이상이면 원인 파악
```

### 주간
```
☐ SMS 발송 트렌드 분석
☐ 야간 차단된 메시지 확인
☐ 수신자 불만 사항 점검
```

### 월간
```
☐ SMS 비용 현황 확인 (Aligo 대시보드)
☐ API 키 갱신 필요 여부 검토
☐ 자동화 시퀀스 개선 사항 토론
```

### 분기별
```
☐ API Key 갱신 (Aligo에서 재발급)
☐ Vercel 환경변수 업데이트
☐ SMS 통계 분석 리포트 작성
```

---

## 🆘 문제 해결 플로우차트

```
SMS가 안 보내진다?
├─ API Key 확인 (Aligo 대시보드)
│  ├─ 틀렸다면? → Vercel 수정 → Redeploy
│  └─ 맞다면? → 다음 단계
├─ 발신자 번호 확인 (Aligo 승인됨 상태?)
│  ├─ 미등록이면? → Aligo에서 등록 → 대기 1-2시간
│  └─ 승인됨이면? → 다음 단계
├─ 충전금 확인 (50,000원 이상?)
│  ├─ 부족하면? → Aligo에서 충전
│  └─ 충분하면? → 다음 단계
├─ 시간 확인 (밤 21:00~08:00?)
│  ├─ 그렇다면? → 정상 (자동 재발송)
│  └─ 아니면? → VERCEL_ALIGO_SETUP.md 참고

결국 안 보내진다면?
→ VERCEL_ALIGO_SETUP.md의 "❌ 일반적인 오류" 참고
→ Aligo 고객지원 (support@aligo.in) 문의
```

---

## 📞 지원 체계

### 빠른 답변 (이 문서)
```
→ VERCEL_DEPLOYMENT_QUICK_START.md (FAQ 섹션)
→ VERCEL_SETUP_CHECKLIST.md (오류 해결표)
```

### 상세 답변
```
→ VERCEL_ALIGO_SETUP.md (❌ 일반적인 오류 섹션)
→ ALIGO_SETUP.md (11. 문제 해결)
```

### 외부 지원
```
→ Aligo 고객지원: support@aligo.in
→ Vercel 문서: https://vercel.com/docs
```

---

## 🎓 학습 경로

### Level 1: 배포만 하고 싶다 (30분)
```
1. VERCEL_DEPLOYMENT_QUICK_START.md 읽기
2. 3단계 따라하기
3. SMS 테스트
4. 완료!
```

### Level 2: 배포 + 이해 (1시간)
```
1. VERCEL_SETUP_CHECKLIST.md로 배포
2. VERCEL_ALIGO_SETUP.md로 이해
3. 문제 해결법 학습
4. 일상 운영 준비
```

### Level 3: 기술 이해 (2시간)
```
1. ALIGO_SETUP.md로 기본 이해
2. ALIGO_IMPLEMENTATION.md로 기술 학습
3. 코드 구조 파악
4. 향후 수정/확장 능력 확보
```

---

## ✨ 배포 후 다음 단계

### 필수 (배포 직후)
1. ✅ SMS 테스트 발송 성공 확인
2. ✅ 대시보드 SMS 통계 모니터링 시작
3. ✅ 팀에 배포 완료 공지

### 권장 (배포 후 1주)
1. 자동화 시퀀스 설정 (별도 문서)
2. SMS 신뢰도 모니터링
3. 비용 현황 확인

### 고급 (배포 후 1개월)
1. A/B 테스트 자동화
2. 세그먼트별 맞춤 메시지
3. 성과 분석 리포트

---

## 📊 문서 통계

| 문서 | 길이 | 소요시간 | 대상 |
|------|------|---------|------|
| VERCEL_DEPLOYMENT_QUICK_START.md | 중간 | 5분 | 초보자 |
| VERCEL_SETUP_CHECKLIST.md | 중간 | 25분 | 중급자 |
| VERCEL_ALIGO_SETUP.md | 길음 | 40분 | 상세 학습 |
| ALIGO_SETUP.md | 길음 | 30분 | 기술자 |
| ALIGO_IMPLEMENTATION.md | 매우 길음 | 50분 | 개발자 |

**총합 문서 길이**: 약 25,000자  
**총 학습 시간**: 5~50분 (선택 기준에 따라)

---

## 🚀 빠른 시작 (5분)

**지금 바로 배포하고 싶다면:**

```bash
1. VERCEL_DEPLOYMENT_QUICK_START.md 읽기
2. Aligo API Key 4개 확보
3. Vercel 대시보드 → Environment Variables
4. 4개 변수 입력 → Redeploy
5. SMS 테스트 발송 → 완료
```

**예상 총 소요 시간: 25분** ⏱️

---

## 📝 버전 관리

| 버전 | 날짜 | 변경사항 |
|------|------|---------|
| 1.0 | 2026-06-08 | 초판 (완전한 가이드 세트) |

---

## 🎯 마지막 확인

이 문서 세트를 통해 다음을 달성합니다:

```
✅ Vercel에 마비즈 CRM 배포
✅ Aligo SMS API 통합
✅ 환경변수 안전하게 관리
✅ SMS 자동 발송 기능 활성화
✅ 24/7 SMS 모니터링 및 추적
```

**배포 준비 완료! 🚀**

---

**작성**: Claude Code Agent  
**최종 수정**: 2026-06-08  
**상태**: Production Ready  
**라이선스**: Internal Use Only
