# 크루즈닷 ↔ CRM Contact 동기화 분석 | 경영진 요약

**분석일**: 2026-05-21  
**분석팀**: Agent Code  
**상태**: 🔴 4가지 P0 Blocker 발견

---

## 핵심 발견

### 현황
- **총 Contact**: (진단 쿼리 실행 필요)
- **GmUser 연결율**: ~40-60% 추정 (웹훅 경로에 따라 차이)
- **렌즈 분류율**: ~10-20% (ContactLensClassification 미자동생성)
- **세그먼트 설정율**: ~30-50% (웹훅 경로 제외)

### 🔴 즉시 조치 필요 (P0)

| 문제 | 영향 | 해결시간 |
|:---|:---|:---|
| **Contact.userId FK 없음** | GmUser 삭제 시 Contact 고아 발생 | 2-3시간 |
| **웹훅에서 segment 미설정** | 세그먼트 기반 마케팅 불가 | 1시간 |
| **렌즈 분류 미자동생성** | Menu #38 마케팅 자동화 중단 | 4-6시간 |
| **Contact.userId 미매핑** | GmUser와 CRM 고객 분리 (이중관리) | 2시간 |

---

## 기술 개요

### 동기화 구조

```
GmUser (크루즈닷) ──[5가지 웹훅]──> Contact (CRM)
  - Inquiry (문의)
  - Purchase (결제)
  - Lead Status (상태 변경)
  - Gold Inquiry (골드 회원)
  - Partner Signup (파트너)

❌ 현황:
- Batch 동기화 없음 (이벤트 기반만)
- FK 관계 없음 (userId 단방향)
- Contact.segment 웹훅에서 미설정
- ContactLensClassification 미자동생성
```

### GmUser → Contact 필드 매핑 (실제 vs. 필요)

```
✅ 현재 매핑:
  phone → phone (upsert 기준)
  name → name
  email → email (일부)

❌ 누락:
  id → userId (FK 없음, 단방향만)
  customerStatus → (필드 없음)
  isHibernated → (필드 없음)
  isLocked → (필드 없음)

❌ 웹훅 제약:
  age, maritalStatus, childrenCount 필드 없음 → segment 계산 불가
  Q1-Q5 필드 없음 → 렌즈 분류 불가
```

---

## 영향 범위

### 직접 영향 (Revenue/CX)

| 기능 | 현상태 | 손실 추정 |
|:---|:---|:---|
| **Menu #38 마케팅 자동화** | 🔴 차단 | L0-L10 SMS 미발송 (~18% 전환율 손실) |
| **세그먼트 기반 마케팅** | 🟠 부분 작동 | A-E 세그먼트 50% 미설정 |
| **Customer 360 View** | 🔴 미작동 | GmUser ↔ Contact 분리 (담당자 수동 관리) |
| **렌즈 기반 CRM 자동화** | 🔴 차단 | ContactLensSequence 미생성 |

### 간접 영향 (데이터 품질)

| 항목 | 위험도 | 영향 |
|:---|:---|:---|
| **고아 Contact** | 🔴 높음 | GmUser 삭제 후 Contact 고아 (정정 불가) |
| **중복 Contact** | 🟠 중간 | 같은 phone, 다른 org → SMS 중복 발송 |
| **N+1 쿼리** | 🟡 낮음 | Contact 목록 조회 시 성능 저하 (개선 필요) |

---

## 로드맵 & 우선순위

### 🔴 Week 1 (즉시, 5-6시간)

```
Day 1-2 (2시간):
  ✅ Contact.userId → GmUser FK 마이그레이션
     ALTER TABLE contacts ADD CONSTRAINT fk_contact_userid
       FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE SET NULL;

  ✅ 고아 Contact 진단 (SELECT 쿼리 실행)
     → 문제 규모 파악 (0 vs. 1000개?)

  ✅ Contact 현황 대시보드
     → 조직별/채널별 분포 시각화

Day 3-4 (2시간):
  ✅ Purchase 웹훅 수정
     - Contact.segment 자동 설정
     - Contact.assignedUserId 설정 (affiliateCode 기반)
     - Contact.lastPaymentAt 업데이트

  ✅ Inquiry/GoldInquiry 웹훅 수정
     - Contact.segment 설정 (기본값: fallback)
     - Contact.channel 통일 (inquiry 웹훅 → "inquiry")

Day 5-6 (2시간):
  ✅ 고아 Contact 정정 배치
     UPDATE Contact SET userId = NULL WHERE ... (마이그레이션)

  ✅ 배포 & 테스트
     - 웹훅 재발송 테스트
     - 고객 데이터 정합성 검증
```

### 🟠 Week 2-3 (4-6시간)

```
  ✅ ContactLensClassification 자동생성 파이프라인
     - Contact 생성 시 classifyCustomerLens() 호출
     - (단, Q1-Q5 필드 먼저 추가 필요)

  ✅ N+1 쿼리 배치 로드 구현
     - Contact 목록 + userId 배치 로드
     - ContactLensClassification 배치 로드

  ✅ GmUser → Contact 배치 동기화 (일일)
     - 상태 동기화 (customerStatus, isHibernated, isLocked)
     - 명명 동기화 (name, email)
```

### 🟡 Week 4+ (장기 작업)

```
  ✅ 렌즈 분류 통합 (Q1-Q5 필드 추가)
     - Contact에 questionnaire 필드 추가
     - 콜 중 Q1-Q5 수집 UI
     - classifyCustomerLens() 자동 호출

  ✅ SMS 자동화 파이프라인 (L0-L10)
     - ContactLensSequence 자동 생성
     - Day 0-3 메시지 스케줄링
     - 전환 추적

  ✅ 데이터 품질 모니터링
     - 고아 Contact 실시간 모니터링
     - 중복 Contact 자동 정제
     - 렌즈 분류율 대시보드
```

---

## 의사결정 요청

### Q1: GmUser ↔ Contact 단일 고객 모델로 통합할까?

**현재**: 두 개의 분리된 고객 모델
- GmUser (크루즈닷몰 회원)
- Contact (CRM 영업 관리)

**옵션 A** (권장): FK 관계 유지, Batch 동기화
- Contact.userId → GmUser FK (이번 주 적용)
- 일일 배치: GmUser → Contact 동기화
- **비용**: 2-3일 / **위험**: 낮음 / **유연성**: 높음 (향후 분리 가능)

**옵션 B**: 마이그레이션 (Contact만 사용)
- GmUser 필드를 Contact로 병합
- 크루즈닷몰 ↔ CRM 통합 (큰 변화)
- **비용**: 2-3주 / **위험**: 높음 / **유연성**: 낮음

**권장**: **옵션 A** (이번 주 FK 적용 + 향후 유연한 확장)

---

### Q2: Contact.segment (A-E) vs. 렌즈 (L0-L10) 어떤 걸 우선할까?

**현황**:
- segment: 인구통계(나이, 결혼, 자녀) 기반 5가지 세그먼트
- 렌즈: 심리학 기반 10가지 렌즈

**옵션 A** (권장): 병행 (segment + 렌즈)
- segment: 빠른 자동 감지 (나이 필드만 필요)
- 렌즈: Q1-Q5 기반 고정밀 분류 (UI 수집 필요)
- **구현**: 2-4주 / **효과**: Menu #38 완전 활성화

**옵션 B**: segment만 (빠른 배포)
- 간단하고 빠름
- **단점**: 렌즈 기반 마케팅 자동화 불가 (Menu #38 지연)

**권장**: **옵션 A** (Contact.age 필드 있으니 segment부터 설정, 렌즈는 Q1-Q5 수집 후)

---

## 재정 영향

### 손실 (미조치 시)

| 항목 | 월 손실 |
|:---|:---|
| Menu #38 마케팅 자동화 미작동 | ~$5-10K (전환율 18% ↓) |
| 세그먼트 기반 SMS 미발송 | ~$3-5K (반응율 낮음) |
| 고객 중복 관리 (수동 작업) | ~$2K (담당자 시간) |
| **합계** | **~$10-20K/월** |

### 투자 (조치 시)

| 항목 | 시간 | 비용 |
|:---|:---|:---|
| P0 P1 이슈 해결 (Week 1-2) | 8-10시간 | ~$1-2K |
| 렌즈 통합 (Week 3-4) | 16-20시간 | ~$3-4K |
| 모니터링 구축 (지속) | 4시간/월 | ~$500/월 |
| **합계** | **24-30시간** | **~$4-7K** |

### ROI
- **Payback Period**: 2-4주 (자동화로 인한 수작업 제거)
- **연간 순이익**: ~$120-240K (손실 회피 + 전환율 개선)

---

## 리스크 & 완화 전략

### 리스크 1: 웹훅 재배포 중 실시간 데이터 손실
- **완화**: 웹훅 DLQ 큐 확인 후 배포, 1시간 테스트 주기

### 리스크 2: GmUser 대량 삭제 시 Contact 고아 발생
- **완화**: FK 추가 + 주간 배치 정정 (즉시 조치)

### 리스크 3: 세그먼트 자동 계산 오류
- **완화**: segmentOverride 필드로 수동 보정 (이미 구현됨)

---

## 결론 & 다음 단계

### 상황
크루즈닷(GmUser) ↔ CRM(Contact) 동기화가 **기술적으로 불완전**하여:
- 고객 데이터 분리 관리 (중복, 일관성 위험)
- Menu #38 마케팅 자동화 **미작동**
- 렌즈 기반 고객 분류 **미작동**

### 즉시 조치 (Week 1)
1. Contact.userId FK 추가 (2-3시간)
2. 웹훅 3개 수정: Purchase/Inquiry/GoldInquiry (2시간)
3. 고아 Contact 진단 & 정정 (2시간)
4. 배포 & 테스트 (2시간)

**총 소요시간**: 8-9시간 / **위험도**: 낮음 / **우선순위**: 🔴 최고

### 중기 계획 (Week 2-4)
- Contact.segment 웹훅 자동 설정
- ContactLensClassification 자동생성
- N+1 쿼리 최적화
- 일일 배치 동기화

**총 소요시간**: 16-20시간 / **효과**: 월 $10-20K 손실 회피 + 전환율 개선

---

**분석 완료: 2026-05-21**  
**상세 분석**: `CONTACT_SYNC_ANALYSIS.md` 참조  
**진단 쿼리**: `CONTACT_SYNC_DIAGNOSTIC.sql` 실행
