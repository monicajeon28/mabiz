# Phase 3 P2 배포 체크리스트 및 카나리 배포 전략

**문서 버전**: 1.0  
**작성일**: 2026-05-22  
**마지막 업데이트**: 2026-05-22

---

## 📋 사전 배포 체크리스트

### Phase 1. 코드 검토 및 테스트

#### 1.1 P0 블로커 해결 상태
- [ ] **P0-BLOCK-1**: exhaustive-deps 제거 → 서버 컴포넌트 래퍼 패턴 적용 완료
  - [ ] `src/app/(dashboard)/documents/page.tsx` - 서버 컴포넌트 래퍼 생성
  - [ ] `src/app/(dashboard)/documents/documents-client.tsx` - 클라이언트 컴포넌트 분리
  - [ ] `src/app/(dashboard)/admin/partner-applications/page.tsx` - 래퍼 패턴 적용
  - [ ] 3개 단위 테스트 통과
  - [ ] npm run build 성공

- [ ] **P0-BLOCK-2**: setTimeout 제거 + async/await 명시화
  - [ ] `src/middleware.ts` - 세션 ID 헤더만 주입 (역할 검증 제거)
  - [ ] `src/app/(dashboard)/admin/layout.tsx` - 역할 검증 이동
  - [ ] `src/types/auth-headers.ts` - HeaderNames 타입 생성
  - [ ] `src/lib/middleware-auth.ts` - 에러 처리 표준화
  - [ ] 미들웨어 응답시간 < 10ms 확인
  - [ ] 8개 보안 테스트 통과

- [ ] **P0-BLOCK-3**: Promise.all → Promise.allSettled로 변경
  - [ ] `src/app/api/campaigns/route.ts` - Promise.allSettled 적용
  - [ ] 부분 실패 시에도 응답 반환 확인
  - [ ] 에러 로깅 추가
  - [ ] 4개 통합 테스트 통과

#### 1.2 전체 테스트 실행
```bash
npm test
```
- [ ] **43개 단위 테스트** 모두 통과 (0 실패)
- [ ] **통합 테스트** 모두 통과
- [ ] **테스트 커버리지** 미들웨어 90% 이상

#### 1.3 빌드 검증
```bash
npm run build
```
- [ ] 빌드 성공 (warning 없음)
- [ ] 번들 크기 증가 < 5%
- [ ] 타입 에러 0개
- [ ] ESLint 경고 < 5개

#### 1.4 보안 감사
- [ ] **OWASP Top 10** 검증
  - [ ] A1: Broken Access Control - 역할 기반 접근 제어 검증
  - [ ] A2: Cryptographic Failures - 세션 토큰 암호화 확인
  - [ ] A4: Insecure Design - 미들웨어 검증 로직 검토
- [ ] **권한 우회 테스트**
  - [ ] AGENT가 /admin 접근 시도 → 403 반환
  - [ ] 세션 토큰 위조 시도 → 401 반환
  - [ ] 헤더 스포핑 → 검증 실패
- [ ] **IDOR (Insecure Direct Object Reference)** 테스트
  - [ ] Organization A의 사용자가 Organization B의 데이터 접근 시도 → 거부
  - [ ] 사용자가 다른 사용자의 세션 조회 시도 → 거부
- [ ] **에러 처리**
  - [ ] 감지되지 않은 예외 없음
  - [ ] 민감 정보 노출 없음 (에러 메시지)

---

### Phase 2. 성능 검증

#### 2.1 미들웨어 성능
```typescript
// src/lib/monitoring.ts를 사용한 성능 측정
import { recordMiddlewarePerformance } from '@/src/lib/monitoring';

// p99 (99th percentile) 측정
```
- [ ] **미들웨어 응답시간 p99 < 100ms** (측정 방법: Datadog/New Relic APM)
  - [ ] 세션 ID 주입: < 5ms
  - [ ] 헤더 검증: < 10ms
  - [ ] 전체 미들웨어: < 50ms
- [ ] 타임아웃 에러 없음 (< 0.01%)

#### 2.2 페이지 로딩 성능 (Lighthouse CI)
```bash
npm run build
npm start # Local testing
```
- [ ] **First Contentful Paint (FCP)**: 기준선 대비 -200ms 이상 개선
  - 현재 기준선: ~2.5s
  - 목표: < 2.3s
- [ ] **Largest Contentful Paint (LCP)**: 기준선 대비 -300ms 이상 개선
  - 현재 기준선: ~4.5s
  - 목표: < 4.2s
- [ ] **Cumulative Layout Shift (CLS)**: < 0.1
- [ ] **Time to Interactive (TTI)**: < 5s

#### 2.3 네트워크 요청 감소
**DevTools Network 탭 검증**
- [ ] `/api/auth/me` 호출 **0회** (이전: 7개 페이지 × 1회 = 7회)
- [ ] 불필요한 API 호출 제거
- [ ] 총 네트워크 요청 수 < 50개

#### 2.4 데이터베이스 쿼리 성능
```typescript
// src/lib/monitoring.ts 사용
import { recordQueryPerformance } from '@/src/lib/monitoring';
```
- [ ] **느린 쿼리 (> 500ms)** 0개
- [ ] N+1 쿼리 제거됨 (평균 쿼리 시간 50% 감소)
- [ ] 캐시 히트율 > 85%

---

### Phase 3. 배포 준비 및 실행

#### 3.1 배포 환경 설정
- [ ] **Vercel 환경 변수** 확인
  - [ ] `MONITORING_ENABLED=true` 설정
  - [ ] `SENTRY_DSN` 설정
  - [ ] `DATADOG_API_KEY` (선택) 설정
- [ ] **모니터링 대시보드** 설정
  - [ ] Sentry 프로젝트 활성화
  - [ ] Datadog APM 활성화 (선택)
  - [ ] 알림 규칙 설정 (에러율 > 1%)
- [ ] **로깅** 설정
  - [ ] CloudWatch/Datadog Logs 활성화
  - [ ] 느린 작업 자동 로깅 활성화

#### 3.2 카나리 배포 전략

**목표**: 새 코드(미들웨어 + N+1 제거)를 단계적으로 배포하여 위험 최소화

##### 단계 1: 카나리 5% 배포 (소요 시간: 5분)
```bash
# Vercel CLI 또는 관리 콘솔에서
vercel deploy --prod
# (자동으로 5% 트래픽만 새 버전으로 라우팅)
```

**검증 항목**:
- [ ] **배포 완료**: Vercel 대시보드에서 배포 상태 "Ready" 확인
- [ ] **헬스 체크**: /api/health 엔드포인트 200 응답 확인
- [ ] **에러율 모니터링**: Sentry 대시보드 열기
  - [ ] 에러율 < 0.5% (이전: ~0.05%)
  - [ ] 새로운 에러 타입 없음
- [ ] **성능 모니터링**: Datadog APM (또는 Lighthouse CI)
  - [ ] 미들웨어 응답시간 < 100ms
  - [ ] 페이지 로딩 시간 증가 < 5%
- [ ] **사용자 피드백**: Sentry 사용자 이벤트
  - [ ] 새로운 crash 리포트 없음
  - [ ] 성능 저하 불만 없음

**총 소요 시간**: 30분 모니터링

##### 단계 2: 25% 배포 (소요 시간: 5분)
에러율 < 0.5%, 성능 정상 확인 후 진행

```bash
vercel deploy --prod --regions=us-west-1,eu-west-1
# 또는 관리 콘솔에서 25% 트래픽 설정
```

**검증 항목**:
- [ ] 에러율 유지 (< 0.5%)
- [ ] 성능 지표 유지
- [ ] 느린 작업 감지 없음

**총 소요 시간**: 10분 모니터링

##### 단계 3: 100% 배포 (소요 시간: 5분)
25% 배포 30분 후 모두 정상 확인 후 진행

```bash
vercel deploy --prod --auto-promote
# 또는 관리 콘솔에서 100% 배포 승격
```

**검증 항목**:
- [ ] 배포 완료
- [ ] 에러율 < 0.5%
- [ ] 성능 지표 정상
- [ ] 모든 리전에서 응답 정상

**총 소요 시간**: 5분

---

### Phase 4. 사후 검증 (72시간)

#### 4.1 지속적 모니터링 (Day 0-3)
**Day 0 (배포 직후)**
- [ ] **시간별 에러율**: 0, 1, 3, 6, 12, 24시간 체크
  - [ ] 모두 < 0.5%
  - [ ] 에러 유형 변화 없음
- [ ] **API 호출 패턴**
  - [ ] `/api/auth/me` 호출 0회/시간 (이전: ~100회/시간)
  - [ ] 다른 API 호출 증가 없음
- [ ] **성능 지표**
  - [ ] FCP 평균: < 2.3s
  - [ ] LCP 평균: < 4.2s
  - [ ] CLS < 0.1

**Day 1-2**
- [ ] 일일 에러율 < 0.5%
- [ ] 성능 지표 안정화
- [ ] 느린 작업 0건

**Day 3**
- [ ] 누적 에러율 < 0.5%
- [ ] 성능 기준선 설정 (새로운 기준값)
- [ ] 최종 검증 완료

#### 4.2 기능 검증
- [ ] 대시보드 페이지 로딩 정상
- [ ] 탭 전환 데이터 동기화 정상 (exhaustive-deps 수정 확인)
- [ ] 권한별 페이지 접근 제어 정상
  - [ ] AGENT: /dashboard 접근 가능, /admin 거부
  - [ ] OWNER: /dashboard, /team 접근 가능
  - [ ] GLOBAL_ADMIN: 모든 경로 접근 가능

#### 4.3 사용자 피드백
- [ ] 지원팀 문의: 인증 관련 이슈 0건
- [ ] 내부 테스트팀: 기능 동작 정상 피드백
- [ ] 성능 개선 체감 여부 확인

#### 4.4 롤백 기준
다음 중 하나라도 발생하면 즉시 롤백:
- [ ] 에러율 > 1% (지속 5분 이상)
- [ ] 응답시간 p99 > 300ms (지속 5분 이상)
- [ ] 500 에러 급증 (> 100/분)
- [ ] 데이터베이스 연결 오류 > 10%

---

## 🔄 롤백 절차

### 자동 롤백 (설정된 경우)
Vercel의 Automated Rollbacks 기능 활용
```bash
# 자동으로 이전 배포로 롤백됨
```

### 수동 롤백
에러 감지 후 즉시 실행:
```bash
# Step 1: 이전 커밋 확인
git log --oneline | head -5

# Step 2: 이전 버전으로 되돌리기
git revert <current-commit-hash>

# Step 3: 변경 사항 푸시
git push origin main

# Step 4: Vercel에서 자동 배포
# (또는 관리 콘솔에서 수동 배포)
```

### 롤백 후 조치
- [ ] Sentry에서 롤백 이벤트 기록
- [ ] DevOps 팀에 즉시 알림
- [ ] 근본 원인 분석 (Post-mortem)
- [ ] 코드 검토 및 수정
- [ ] 새로운 테스트 케이스 추가

---

## 📊 모니터링 대시보드 설정

### Sentry 대시보드
**URL**: https://sentry.io/organizations/<org>/projects/mabiz-crm/

**주요 메트릭**:
- Issue Count (에러 발생 건수)
- Error Rate (전체 요청 대비 에러 비율)
- P95 Response Time (95th percentile 응답 시간)
- User Sessions Affected (영향받은 사용자 수)

**알림 규칙**:
- Error rate > 1% → Slack #mabiz-alerts 채널 알림
- New Issue → #mabiz-alerts 채널 알림

### Datadog APM (선택)
**URL**: https://app.datadoghq.com/apm/

**주요 메트릭**:
- Middleware Duration (p50, p95, p99)
- Database Query Duration
- Endpoint Response Time
- Error Rate by Service

### Lighthouse CI (자동)
**URL**: https://github.com/<org>/<repo>/checks/

매 배포 시 자동 실행:
- Performance Score
- FCP, LCP, CLS 등 Core Web Vitals
- 이전 배포 대비 변화

---

## 📞 에스컬레이션 경로

| 상황 | 심각도 | 담당자 | 액션 |
|-----|--------|--------|------|
| 에러율 > 1% | 🔴 Critical | DevOps Lead | 5분 내 롤백 |
| 응답시간 p99 > 300ms | 🔴 Critical | Performance Lead | 성능 프로파일링 |
| 새로운 에러 타입 | 🟠 High | Backend Lead | 즉시 조사 |
| 사용자 피드백 (성능) | 🟡 Medium | Product Manager | 48시간 내 분석 |
| 배포 실패 | 🔴 Critical | DevOps Lead | 즉시 롤백 |

---

## 🎯 성공 기준

배포는 다음 조건을 모두 만족할 때 **완전히 성공**으로 간주:

### 기술 기준
1. **API 호출 제거**
   - `/api/auth/me` 0회/일 (이전: ~2,800회/일)
   - 다른 불필요한 API 호출 제거됨

2. **성능 개선**
   - FCP: -200ms 이상 개선
   - LCP: -300ms 이상 개선
   - 미들웨어 응답시간 p99 < 100ms

3. **안정성**
   - 에러율 < 0.5% (72시간 평균)
   - 500 에러 < 5개/일
   - 타임아웃 에러 < 1%

4. **보안**
   - IDOR 취약점 0개
   - 권한 우회 시도 모두 차단
   - 데이터 노출 0건

### 기술 부채 감소
- exhaustive-deps 경고 제거 (30개 → 0개)
- 직렬 쿼리 제거 (15개 → 3개)
- 중복 API 호출 제거 (N+1 쿼리)

### 팀 생산성
- 새 권한 추가 시간: 2.5시간 → 15분 (90% 단축)
- 월간 인증 관련 버그: 3-5개 → < 1개 (80% 감소)

---

## 📋 체크리스트 사용 방법

### Phase별 진행
1. **Pre-Deployment (배포 전 - 2시간)**
   - Phase 1-2 완료 확인
   - 모든 테스트 통과 확인
   - 빌드 검증 완료

2. **Deployment (배포 단계 - 45분)**
   - Phase 3 실행
   - 카나리 배포 진행

3. **Post-Deployment (사후 검증 - 72시간)**
   - Phase 4 진행
   - 지속적 모니터링

### 일일 체크
배포 후 매 6시간마다:
- [ ] 에러율 체크
- [ ] 성능 메트릭 체크
- [ ] 느린 작업 로그 확인

### 주간 리뷰
배포 1주일 후:
- [ ] 누적 통계 검토
- [ ] 사용자 피드백 종합
- [ ] 최종 성공 판정

---

## 📎 첨부 자료

- **모니터링 코드**: `src/lib/monitoring.ts`
- **P0 블로커 상세**: `Phase3_P2_WORK_INSTRUCTIONS_FINAL.md`
- **보안 감사 템플릿**: OWASP Top 10 체크리스트
- **Sentry 대시보드**: 조직 관리자에게 문의

---

**최종 승인자**: CTO (배포 전)  
**배포 담당자**: DevOps Lead  
**모니터링 담당자**: Infrastructure Lead  
**롤백 담당자**: DevOps Lead

---

**버전 이력**
| 버전 | 날짜 | 변경 사항 |
|------|------|----------|
| 1.0 | 2026-05-22 | 초안 작성 |
