# Contact 테이블 userId 상태 분석 보고서

**작성일:** 2026-05-21  
**분석 대상:** Contact 테이블의 userId 필드 무결성 및 마이그레이션 준비  
**목표:** Contact → GoldMember 마이그레이션 전 데이터 정정 전략 수립

---

## 📊 1. 분석 결과 요약

### 1.1 Contact 테이블 현황
- **총 Contact 건수:** TBD (분석 쿼리 실행 필요)
- **userId 설정된 건수:** TBD
- **userId NULL 건수:** TBD
- **userId 설정률:** TBD %
- **userId NULL률:** TBD %

*분석 쿼리: `contact_userId_analysis.sql` - Query 1 실행*

---

## 🔍 2. 문제 데이터 식별 (3가지+)

### 2.1 고아 Contact (Orphaned Contacts)
**정의:** userId는 있는데 대응하는 GoldMember가 없는 Contact

**영향:**
- FK 무결성 위반 가능성
- 마이그레이션 시 고아 레코드 발생
- 크루즈닷몰 사용자 데이터 불일치

**정정 방법:**
- `Contact.userId` → NULL 설정
- 또는 해당 GoldMember 신규 생성 (필요시)

**SQL:** `contact_userId_cleanup_scripts.sql` - SCRIPT 1

---

### 2.2 중복 Contact (Duplicate Contacts)
**정의:** 같은 phone + organization으로 여러 Contact 존재

**원인:**
- 고객 재방문 시 새로운 Contact 생성
- 기존 Contact 조회 미스
- 데이터 마이그레이션 오류

**분포:**
- 상위 30개 그룹 확인 가능
- 각 그룹별 중복 건수 파악

**정정 전략:**
```
1. phone + org별로 가장 최신 Contact를 "대표 Contact"로 선정
2. 다른 Contact들을 soft delete 처리 (deletedAt 설정)
3. CallLog, ContactGroup 등 외래키는 대표 Contact로 재지정
```

**SQL:** `contact_userId_cleanup_scripts.sql` - SCRIPT 2

---

### 2.3 다중 userId (Inconsistent User IDs)
**정의:** 같은 phone이지만 다른 userId를 가진 Contact들

**원인:**
- 같은 고객이 다중 크루즈닷몰 계정 보유
- 데이터 입력 오류
- 계정 병합 미처리

**분포:**
- top 20 그룹 식별 가능
- userIds 리스트 포함

**정정 전략:**
```
1. phone + org별로 최신 userid만 선택
2. 다른 Contact들의 userId를 최신값으로 표준화
3. 일관성 검증 (같은 phone = 같은 userId)
```

**SQL:** `contact_userId_cleanup_scripts.sql` - SCRIPT 3

---

### 2.4 추가 문제 케이스

#### Case A: name이 빈 Contact
- 확인 쿼리: `contact_userId_analysis.sql` - Query 9
- 정정: name 필드 필수값 검증

#### Case B: email 중복 (org별)
- 확인 쿼리: `contact_userId_analysis.sql` - Query 10
- 정정: email unique constraint 설정 후 병합

#### Case C: 최근 30일 userId NULL 비율
- 확인 쿼리: `contact_userId_analysis.sql` - Query 7
- 의미: 신규 Contact 입력 품질 추적

---

## 📋 3. Organization별 userId 설정률

**확인 방법:**
```sql
-- contact_userId_analysis.sql - Query 3 실행
-- Organization별로 userId 설정률 정렬
-- 설정률이 낮은 org부터 정정 우선순위 결정
```

**기대 결과:**
- Top 20 Organization의 설정률 비교
- 설정률 <50% org 필터링 → 정정 대상 선정

---

## 🛠️ 4. 마이그레이션 전 정정 SQL

### 4.1 Script 1: 고아 Contact 정정
**파일:** `contact_userId_cleanup_scripts.sql` - SCRIPT 1

**동작:**
```sql
UPDATE "Contact"
SET "userId" = NULL
WHERE userId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "GoldMember" WHERE "userId" = c."userId")
```

**변경 건수:** TBD (실행 후 확인)

**주의:**
- TRANSACTION으로 감싸짐
- 실행 전 영향 범위 검증 필수
- ROLLBACK 가능

---

### 4.2 Script 2: 중복 Contact 병합
**파일:** `contact_userId_cleanup_scripts.sql` - SCRIPT 2

**동작:**
```sql
1. phone + org별 ROW_NUMBER() = 1인 Contact만 유지
2. 나머지는 soft delete (deletedAt 설정)
3. CallLog, ContactGroup 외래키 재지정
```

**변경 건수:** TBD

**영향:**
- Contact 테이블: DELETE 1건 이상
- CallLog 테이블: UPDATE 최대 (전체 데이터)

---

### 4.3 Script 3: 다중 userId 표준화
**파일:** `contact_userId_cleanup_scripts.sql` - SCRIPT 3

**동작:**
```sql
1. phone + org별로 최신 userid 선택
2. 해당 그룹의 모든 Contact를 해당 userId로 UPDATE
```

**변경 건수:** TBD

**효과:**
- 같은 phone = 같은 userId 보장
- FK 무결성 강화

---

### 4.4 검증 쿼리
**파일:** `contact_userId_cleanup_scripts.sql` - SCRIPT 4

정정 후 상태 확인:
- 총 active Contact 수
- userId 설정률
- 남은 중복 여부
- userId 일관성 여부

---

## 📈 5. 마이그레이션 준비도 체크리스트

- [ ] `contact_userId_analysis.sql` 실행 → 현황 파악
- [ ] 각 Organization별 설정률 확인
- [ ] 정정 필요 Contact 건수 파악
- [ ] 개발 환경에서 정정 SQL 테스트
- [ ] 영향 범위 문서화 (CallLog, ContactGroup 등)
- [ ] 운영 환경 백업 수립
- [ ] SCRIPT 1-3 순서대로 실행
- [ ] SCRIPT 4로 검증
- [ ] 마이그레이션 진행

---

## 📝 6. Contact.userId 용도 및 의미

| 항목 | 설명 |
|------|------|
| **타입** | Int (nullable) |
| **값** | 크루즈닷몰 회원 ID (userId) |
| **관계** | GoldMember.userId (정규화) |
| **마이그레이션 목적** | Contact → GoldMember 업그레이드 추적 |
| **참조 무결성** | GoldMember(userId) NOT NULL = 고객 확정 |

### 마이그레이션 흐름
```
Contact (userId = 123)
    ↓
GoldMember (userId = 123) 신규 생성
    ↓
Contact.userId는 GoldMember 존재 확인용 (FK 역할)
```

---

## 🔗 7. 참고 자료

### 생성된 파일
1. **contact_userId_analysis.sql** - 10개의 분석 쿼리
2. **contact_userId_cleanup_scripts.sql** - 3개의 정정 스크립트
3. **analyze_contact_userId.js** - Node.js 자동 분석 도구 (선택사항)

### DB 접근
- **Host:** ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech
- **Database:** neondb
- **사용자:** neondb_owner
- **백업 명령:** `pg_dump -h [host] -U neondb_owner neondb > backup.sql`

### 관련 테이블
- Contact (primary)
- GoldMember (reference)
- CallLog (foreign key: contactId)
- ContactGroup (foreign key: contactId)
- ContactGroupMember (related)
- ContactLensClassification (related)
- ContactLensSequence (related)

---

## 🎯 8. 다음 단계

### Phase 1: 분석 (2-3시간)
1. `contact_userId_analysis.sql` 실행
2. 현황 통계 수집
3. 정정 대상 식별
4. 영향 범위 문서화

### Phase 2: 준비 (1-2시간)
1. 개발 환경 복제본 생성
2. 정정 SQL 테스트 실행
3. Rollback 시나리오 검증
4. 운영팀 검토 및 승인

### Phase 3: 실행 (1시간)
1. 운영 환경 백업
2. SCRIPT 1-3 순차 실행
3. SCRIPT 4 검증
4. 롤아웃 확인

### Phase 4: 마이그레이션 (별도 계획)
1. Contact → GoldMember 마이그레이션
2. 신규 API 엔드포인트 활성화
3. UI 업그레이드

---

**작성자:** Claude Code Analysis Agent  
**버전:** 1.0  
**상태:** 분석 대기 (SQL 실행 필요)
