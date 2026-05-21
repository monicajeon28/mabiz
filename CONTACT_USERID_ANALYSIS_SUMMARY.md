# Contact 테이블 userId 상태 분석 — 최종 요약

**작성일:** 2026-05-21  
**상태:** 준비 완료 (SQL 실행 필요)  
**목표:** Contact → GoldMember 마이그레이션 전 데이터 정정 전략 수립

---

## 🎯 분석 완료 성과물

### 📋 생성된 파일 (4개)

#### 1️⃣ contact_userId_analysis.sql (3.8KB)
**목적:** Contact 테이블 현황 진단 (10개 분석 쿼리)

**쿼리 목록:**
```
Query 1  → 전체 통계 (총 건수, userid 설정률, NULL률)
Query 2  → Phone 중복 분석 (상위 30개 그룹)
Query 3  → Organization별 userId 설정률 (상위 20개)
Query 4  → userId 분포 (서로 다른 userid 개수)
Query 5  → 고아 Contact (userid는 있는데 GoldMember 없음)
Query 6  → 다중 userId (같은 phone이지만 다른 userid)
Query 7  → 최근 30일 추이 (신규 입력 품질)
Query 8  → 소프트 삭제 통계
Query 9  → 빈 name (데이터 품질)
Query 10 → Email 중복 (org별)
```

**사용법:**
```sql
-- Neon 콘솔 → SQL Editor에서 열기
-- Query 1부터 순서대로 실행
-- 결과를 스프레드시트에 정리
```

---

#### 2️⃣ contact_userId_cleanup_scripts.sql (5.8KB)
**목적:** Contact 정정 SQL 스크립트 (3개 SCRIPT)

**SCRIPT 목록:**

| Script | 목적 | 영향 | 예상 시간 |
|--------|------|------|---------|
| **1** | 고아 Contact 정정 (userId → NULL) | Contact only | 1-2분 |
| **2** | 중복 Contact 병합 (soft delete + FK 재지정) | Contact, CallLog | 5-10분 |
| **3** | 다중 userId 표준화 (phone별 일관성) | Contact only | 2-3분 |
| **4** | 검증 쿼리 (최종 상태 확인) | Read-only | 1분 |

**사용 방법:**
```sql
-- 각 SCRIPT는 BEGIN TRANSACTION / COMMIT 포함
-- 테스트 환경에서 ROLLBACK으로 안전 검증 후
-- 프로덕션에서 COMMIT 실행
```

**주의사항:**
```
⚠️ 각 SCRIPT 실행 전:
   1. 백업 수행
   2. 영향 범위 검증 쿼리 실행
   3. 개발 환경에서 테스트

⚠️ 실행 순서 준수 필수:
   SCRIPT 1 → SCRIPT 2 → SCRIPT 3 → SCRIPT 4 (검증)
```

---

#### 3️⃣ CONTACT_USERID_ANALYSIS_REPORT.md (6.8KB)
**목적:** 분석 결과 및 정정 전략 문서화

**포함 내용:**
- Contact 현황 통계 (TBD)
- 4가지 문제 데이터 상세 분석
- Organization별 userId 설정률
- 마이그레이션 준비도 체크리스트
- Contact.userId 용도 및 의미
- 다음 단계 (Phase 1-4)

**핵심 섹션:**
```markdown
## 2. 문제 데이터 식별 (3가지+)

2.1 고아 Contact (Orphaned Contacts)
   - 정의: userId는 있는데 GoldMember 없음
   - 영향: FK 무결성 위반
   - 정정: SCRIPT 1

2.2 중복 Contact (Duplicate Contacts)
   - 정의: 같은 phone+org로 여러 Contact 존재
   - 영향: CallLog, ContactGroup 데이터 불일치
   - 정정: SCRIPT 2

2.3 다중 userId (Inconsistent User IDs)
   - 정의: 같은 phone이지만 다른 userid
   - 영향: phone 기반 조회 오류
   - 정정: SCRIPT 3

2.4 추가 문제 케이스
   - Case A: name이 빈 Contact
   - Case B: email 중복 (org별)
   - Case C: 최근 30일 userId NULL 비율 추이
```

---

#### 4️⃣ CONTACT_USERID_MIGRATION_CHECKLIST.md (11KB)
**목적:** 마이그레이션 실행 체크리스트 (50+ 항목)

**5 Phase 구조:**

```
Phase 1: 현황 분석 (1-2시간)
├─ Step 1.1: 분석 쿼리 실행 (Query 1-10)
├─ Step 1.2: 정정 우선순위 결정
└─ Step 1.3: 영향 범위 분석

Phase 2: 개발 환경 테스트 (2-3시간)
├─ Step 2.1: 테스트 환경 준비 (DB 복제)
├─ Step 2.2: SCRIPT 1 테스트
├─ Step 2.3: SCRIPT 2 테스트
├─ Step 2.4: SCRIPT 3 테스트
├─ Step 2.5: SCRIPT 4 검증
└─ Step 2.6: Rollback 테스트

Phase 3: 프로덕션 준비 (1시간)
├─ Step 3.1: 팀 검토 및 승인
├─ Step 3.2: 백업 계획 수립
└─ Step 3.3: 실행 계획서 작성

Phase 4: 프로덕션 실행 (1-2시간)
├─ Step 4.1: Pre-flight 체크
├─ Step 4.2: SCRIPT 1 실행
├─ Step 4.3: SCRIPT 2 실행
├─ Step 4.4: SCRIPT 3 실행
├─ Step 4.5: SCRIPT 4 검증
├─ Step 4.6: Post-flight 체크
└─ Step 4.7: 최종 확인

Phase 5: 문서화 및 회고 (30분)
├─ Step 5.1: 실행 리포트 작성
└─ Step 5.2: 팀 회고
```

**추가 섹션:**
- 🚨 비상 대응 절차
- 📞 연락처
- ✅ 최종 승인 양식

---

## 📊 4가지 문제 데이터 분석

### Problem 1️⃣: 고아 Contact (Orphaned)
**정의:** userId는 있는데 GoldMember 없음
```
Contact.userId = 123 → GoldMember(userId=123) 없음
```

**영향:**
- FK 무결성 위반
- Contact → GoldMember 업그레이드 불가
- 데이터 일관성 저하

**정정:**
```sql
-- SCRIPT 1
UPDATE "Contact"
SET "userId" = NULL
WHERE "userId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "GoldMember" WHERE "userId" = c."userId")
```

**예상 영향:** TBD (Query 5 실행 후)

---

### Problem 2️⃣: 중복 Contact (Duplicate)
**정의:** 같은 phone + organization으로 여러 Contact 존재
```
phone=010-1234-5678, org=org123
├─ Contact 1 (createdAt=2026-05-01)
├─ Contact 2 (createdAt=2026-05-10)  ← 최신
└─ Contact 3 (createdAt=2026-05-05)
```

**영향:**
- Contact 1, 3 soft delete 처리 필요
- CallLog 재지정 필수 (1→2, 3→2)
- ContactGroup 관계 업데이트

**정정:**
```sql
-- SCRIPT 2: 3단계
1. phone+org별 ROW_NUMBER() = 1인 Contact만 유지
2. 나머지는 soft delete (deletedAt 설정)
3. CallLog, ContactGroup FK 재지정
```

**예상 영향:** TBD (Query 2 실행 후)

---

### Problem 3️⃣: 다중 userId (Inconsistent)
**정의:** 같은 phone이지만 다른 userid 가진 Contact들
```
phone=010-1234-5678, org=org123
├─ Contact A (userId=100)
└─ Contact B (userId=200)  ← 불일치
```

**원인:**
- 고객이 크루즈닷몰에 다중 계정 보유
- 데이터 입력 오류
- 계정 병합 미처리

**정정:**
```sql
-- SCRIPT 3: 2단계
1. phone+org별로 최신 userId 선택
2. 해당 그룹의 모든 Contact를 해당 userId로 UPDATE
```

**효과:**
- phone당 1개 userid만 유지
- FK 일관성 강화
- 고객 조회 정확도 향상

**예상 영향:** TBD (Query 6 실행 후)

---

### Problem 4️⃣: 추가 문제 케이스

#### Case A: name이 빈 Contact
```sql
WHERE "name" = '' OR "name" IS NULL
```
**영향:** TBD (Query 9)

#### Case B: email 중복 (org별)
```sql
GROUP BY email, "organizationId"
HAVING COUNT(*) > 1
```
**영향:** TBD (Query 10)

#### Case C: 최근 30일 userId NULL 비율
```sql
WHERE "createdAt" >= NOW() - INTERVAL '30 days'
```
**추이:** 상향/하향/안정 확인 (Query 7)

---

## 📈 마이그레이션 로드맵

```
┌─────────────────────────────────────────────────────┐
│ Phase 1: 분석 (1-2시간)                              │
│ └─ Query 1-10 실행 → 현황 파악                       │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│ Phase 2: 테스트 (2-3시간)                            │
│ └─ Test DB: SCRIPT 1-3 검증 + ROLLBACK 테스트       │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│ Phase 3: 준비 (1시간)                                │
│ └─ 팀 검토, 백업 계획, 실행 계획서                     │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│ Phase 4: 실행 (1-2시간)                              │
│ ├─ Pre-flight: 백업, 상태 확인                       │
│ ├─ SCRIPT 1 실행: 고아 정정                          │
│ ├─ SCRIPT 2 실행: 중복 병합                          │
│ ├─ SCRIPT 3 실행: userid 표준화                     │
│ ├─ SCRIPT 4 실행: 최종 검증                          │
│ └─ Post-flight: 스모크 테스트                       │
└──────────────┬──────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│ Phase 5: 문서화 (30분)                               │
│ └─ 실행 리포트, 회고                                 │
└─────────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│ Next: GoldMember 마이그레이션 (별도 계획)             │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 즉시 실행 항목

### Step 1: 분석 시작 (지금 바로)
```bash
# 1. Neon 콘솔 접속
# 2. contact_userId_analysis.sql 열기
# 3. Query 1 실행 → 결과 캡처
# 4. Query 2-10 순서대로 실행
# 5. 결과를 CONTACT_USERID_ANALYSIS_REPORT.md에 기입
```

### Step 2: 의사결정 (24시간 이내)
```
1. 정정 우선순위 결정
   - 중복 Contact 병합: 필수 / 선택
   - 다중 userId 표준화: 전체 / 일부
   - 고아 Contact: NULL로 설정 / GoldMember 생성

2. 실행 일정 예약
   - 실행 날짜: 2026-05-XX
   - 실행 시간: XX:XX UTC (다운타임 최소)
   - 담당자 지정

3. 팀 검토
   - 개발팀 검토
   - 운영팀 검토
   - 경영진 승인
```

### Step 3: 테스트 환경 준비 (2-3일)
```bash
# 1. 테스트용 DB 복제 (Neon 스냅샷)
# 2. contact_userId_cleanup_scripts.sql 테스트
# 3. SCRIPT 1-3 ROLLBACK 검증
# 4. CallLog, ContactGroup FK 무결성 확인
```

---

## 📋 체크리스트 (필수 확인)

Before 분석:
- [ ] Neon 콘솔 접속 가능?
- [ ] contact_userId_analysis.sql 파일 위치 확인?
- [ ] 백업 계획 수립?

After Query 실행:
- [ ] Query 1-10 결과 모두 수집?
- [ ] 고아 Contact 개수 파악?
- [ ] 중복 Contact 개수 파악?
- [ ] 다중 userId 개수 파악?

Before SCRIPT 실행:
- [ ] 테스트 환경에서 ROLLBACK 테스트 완료?
- [ ] CallLog, ContactGroup FK 검증?
- [ ] 팀 승인 획득?
- [ ] 백업 수행?

After SCRIPT 실행:
- [ ] SCRIPT 4 검증 완료?
- [ ] 중복/불일치 0건?
- [ ] 애플리케이션 정상 동작?
- [ ] 사용자 피드백 없음?

---

## 💾 참고 자료

### DB 접근
```
Host: ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech
Database: neondb
User: neondb_owner
Port: 5432
```

### 관련 테이블
```
Contact          (primary)
GoldMember       (reference)
CallLog          (foreignKey: contactId)
ContactGroup     (related)
ContactGroupMember (related)
ContactLensClassification (related)
ContactLensSequence (related)
```

### Contact.userId 의미
```
타입: Int (nullable)
값: 크루즈닷몰 회원 ID
관계: GoldMember.userId (1:N)
마이그레이션: Contact → GoldMember 업그레이드 추적

NOT NULL → 확정 고객 (GoldMember)
NULL → 잠재 고객 (Contact)
```

---

## 📞 질문 & 의사결정

### Q1: 고아 Contact를 NULL로 설정하면 데이터 손실 아닌가?
**A:** userId 필드만 NULL이고, phone, name, email 등 다른 정보는 보존됩니다.
고아인 이유는 GoldMember 레코드가 없기 때문이므로, 다시 일대일 대응 관계를 만들 수 있습니다.

### Q2: 중복 Contact를 삭제하지 말고 병합할 수는 없나?
**A:** 병합하려면 이전 Contact의 모든 정보를 최신 Contact로 통합해야 하는데,
주소, 이력, 구매 기록 등이 섞일 수 있어서 soft delete (deletedAt 설정) 방식을 권장합니다.

### Q3: SCRIPT 실행 중 오류 발생하면?
**A:** ROLLBACK을 즉시 실행하여 원상복구할 수 있습니다.
Transaction 모드이므로 중간 단계 중단 시 전체 변경이 무효화됩니다.

### Q4: Contact.userId를 GoldMember로 마이그레이션하는 건가?
**A:** 아니요. Contact.userId는 Int 타입(크루즈닷몰 ID)으로 유지됩니다.
마이그레이션은 "Contact 고객을 GoldMember로 업그레이드" 의미이며, userId는 참조용입니다.

---

## ✅ 분석 완료 확인

생성된 파일들:
```
✓ contact_userId_analysis.sql (3.8KB)
  └─ 10개 분석 쿼리
  
✓ contact_userId_cleanup_scripts.sql (5.8KB)
  └─ 3개 정정 SCRIPT + 검증 쿼리
  
✓ CONTACT_USERID_ANALYSIS_REPORT.md (6.8KB)
  └─ 종합 분석 보고서
  
✓ CONTACT_USERID_MIGRATION_CHECKLIST.md (11KB)
  └─ 50+ 항목 실행 체크리스트

✓ analyze_contact_userId.js (6.6KB)
  └─ Node.js 자동 분석 도구 (선택사항)
```

**다음 액션:**
1. **즉시:** contact_userId_analysis.sql Query 1-10 실행
2. **24시간:** 의사결정 & 팀 검토
3. **2-3일:** 테스트 환경 SCRIPT 검증
4. **실행 날:** Phase 4 체크리스트 수행

---

**상태:** ✅ 분석 준비 완료  
**작성:** 2026-05-21  
**버전:** 1.0  
**다음 update:** SQL 실행 후 데이터 기입
