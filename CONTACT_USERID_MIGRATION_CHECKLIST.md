# Contact userId 마이그레이션 체크리스트

## 🎯 목표
Contact 테이블의 userId 데이터 정합성 확보 → GoldMember 마이그레이션 안전화

---

## 📊 Phase 1: 현황 분석 (권장: 1-2시간)

### Step 1.1: 분석 쿼리 실행
- [ ] `contact_userId_analysis.sql` 파일 열기
- [ ] Neon 콘솔에서 각 Query 1-10 순서대로 실행
- [ ] 결과를 스프레드시트에 정리

**결과물:**
```
Query 1: 전체 통계
- 총 Contact: _____ 건
- userId 설정: _____ 건 (____%)
- userId NULL: _____ 건 (____%)

Query 2: Phone 중복
- 중복 그룹 수: _____ 개
- TOP 5 중복 건수:
  1. _____ 건
  2. _____ 건
  ...

Query 3: Organization별 설정률
- 상위 10개 org의 평균 설정률: _____%

Query 4: userId 분포
- 서로 다른 userId 개수: _____개
- 최고 usage: _____ Contact

Query 5: 고아 Contact
- 개수: _____ 건

Query 6: 다중 userId (same phone)
- 그룹 수: _____ 개
- 영향받는 Contact: _____ 건

Query 7: 최근 30일 추이
- NULL률 추세: 상향/하향/안정

Query 8: 소프트 삭제
- 삭제된 Contact: _____ 건

Query 9: 빈 name
- 개수: _____ 건

Query 10: Email 중복
- 그룹 수: _____ 개
```

### Step 1.2: 정정 우선순위 결정
- [ ] userId NULL률이 높은 Organization 목록화
- [ ] 중복 Contact 그룹 영향도 계산
- [ ] 정정 순서 결정 (중복 → 다중userId → 고아)

**의사결정:**
- 중복 Contact 정정 우선도: 높음 / 중간 / 낮음
  - 이유: _____
- 다중 userId 정정 범위: 전체 / 일부 조직
  - 대상 조직: _____
- 고아 Contact 처리: NULL로 설정 / GoldMember 생성
  - 선택 이유: _____

### Step 1.3: 영향 범위 분석
- [ ] CallLog 테이블에서 영향받을 레코드 수 확인
  ```sql
  SELECT COUNT(DISTINCT "contactId")
  FROM "CallLog"
  WHERE "contactId" IN (
    -- 정정 대상 Contact
  );
  ```
  결과: _____ 건

- [ ] ContactGroup 테이블 영향도 확인
  ```sql
  SELECT COUNT(DISTINCT "contactId")
  FROM "ContactGroupMember"
  WHERE "contactId" IN (
    -- 정정 대상 Contact
  );
  ```
  결과: _____ 건

- [ ] 기타 외래키 테이블 검사 (ContactMemo, ContactLensClassification 등)
  ```sql
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename LIKE '%Contact%';
  ```

---

## 🧪 Phase 2: 개발 환경 테스트 (권장: 2-3시간)

### Step 2.1: 테스트 환경 준비
- [ ] 테스트용 DB 복제 (프로덕션 스냅샷)
  ```bash
  # Neon 콘솔 → Database → Backup & Restore
  ```
- [ ] 테스트 DB 연결 확인
  ```bash
  psql -h [test-host] -U neondb_owner -d neondb_test
  ```

### Step 2.2: SCRIPT 1 테스트 (고아 Contact 정정)
- [ ] Test DB에서 영향 범위 확인
  ```sql
  SELECT COUNT(*) as orphaned_count
  FROM "Contact" c
  WHERE c."userId" IS NOT NULL
    AND c."deletedAt" IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM "GoldMember" gm WHERE gm."userId" = c."userId"
    );
  ```
  결과: _____ 건

- [ ] SCRIPT 1 실행 (TRANSACTION 내)
  ```sql
  BEGIN TRANSACTION;
  -- SCRIPT 1 내용 ...
  ROLLBACK;  -- 테스트용
  ```

- [ ] 결과 검증
  - [ ] rows_updated 건수 확인
  - [ ] 외래키 제약조건 위반 없음
  - [ ] Contact.name, Contact.phone 보존됨

### Step 2.3: SCRIPT 2 테스트 (중복 Contact 병합)
- [ ] Test DB에서 영향 범위 확인
  ```sql
  SELECT COUNT(*) as duplicate_groups
  FROM (
    SELECT phone, "organizationId"
    FROM "Contact"
    WHERE "deletedAt" IS NULL
    GROUP BY phone, "organizationId"
    HAVING COUNT(*) > 1
  ) t;
  ```
  결과: _____ 건

- [ ] SCRIPT 2 단계별 검증
  - [ ] Step 1: duplicate_contacts 임시 테이블 생성
    ```sql
    SELECT COUNT(*) FROM duplicate_contacts;  -- 예상: _____ 건
    ```
  - [ ] Step 2: Contact soft delete 확인
    ```sql
    SELECT COUNT(*) FROM "Contact" WHERE "deletedAt" = NOW()::date;  -- _____ 건
    ```
  - [ ] Step 3: CallLog 재지정 검증
    ```sql
    SELECT COUNT(*) FROM "CallLog"
    WHERE "updatedAt" = NOW()::date;  -- _____ 건
    ```

- [ ] CallLog 데이터 무결성 확인
  ```sql
  SELECT COUNT(*) as orphaned_logs
  FROM "CallLog" cl
  WHERE NOT EXISTS (
    SELECT 1 FROM "Contact" c WHERE c.id = cl."contactId"
  );
  ```
  결과: 0 건 (필수)

### Step 2.4: SCRIPT 3 테스트 (다중 userId 표준화)
- [ ] Test DB에서 영향 범위 확인
  ```sql
  SELECT COUNT(*) as inconsistent_groups
  FROM (
    SELECT phone, "organizationId"
    FROM "Contact"
    WHERE "deletedAt" IS NULL AND "userId" IS NOT NULL
    GROUP BY phone, "organizationId"
    HAVING COUNT(DISTINCT "userId") > 1
  ) t;
  ```
  결과: _____ 건

- [ ] SCRIPT 3 실행
  ```sql
  BEGIN TRANSACTION;
  -- SCRIPT 3 내용 ...
  SELECT COUNT(*) as user_id_standardized FROM "Contact"
  WHERE "updatedAt" = NOW()::date;  -- 예상: _____ 건
  ROLLBACK;  -- 테스트용
  ```

### Step 2.5: SCRIPT 4 검증 (최종 상태)
- [ ] 정정 후 상태 확인
  ```sql
  -- SCRIPT 4 - 최종 검증 쿼리 3개 실행
  ```
  
  **체크사항:**
  - [ ] total_active: _____ (감소 또는 유지)
  - [ ] with_userId: _____
  - [ ] without_userId: _____
  - [ ] unique_phones: _____
  - [ ] remaining_duplicates: 0 (필수)
  - [ ] inconsistencies: 0 (필수)

### Step 2.6: Rollback 테스트
- [ ] 각 SCRIPT별로 ROLLBACK 동작 확인
- [ ] Rollback 후 원본 상태 복구 검증

---

## ⚙️ Phase 3: 프로덕션 준비 (권장: 1시간)

### Step 3.1: 팀 검토 및 승인
- [ ] 분석 결과 팀에 공유
- [ ] 정정 계획 검토 및 Q&A
- [ ] 경영진 승인 획득
  ```markdown
  ### 요청 내용
  - 정정 대상: Contact _____ 건
  - 영향받을 테이블: CallLog (_____ 건), ContactGroup (_____ 건)
  - 예상 소요 시간: _____ 분
  - 다운타임 필요 여부: YES / NO
  
  ### 리스크
  - 고아 Contact 정정으로 userId 손실 (NULL)
  - 중복 Contact 병합 시 CallLog 재지정
  - 다중 userId 표준화로 일부 Contact의 userId 변경
  
  ### 롤백 계획
  - 프로덕션 백업: [timestamp]
  - 예상 복구 시간: _____ 분
  ```

### Step 3.2: 백업 계획 수립
- [ ] 백업 스크립트 작성
  ```bash
  #!/bin/bash
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  pg_dump -h ep-divine-shape-ai1u1c8e-pooler.c-4.us-east-1.aws.neon.tech \
    -U neondb_owner -d neondb \
    > "backup_before_contact_cleanup_${TIMESTAMP}.sql"
  echo "Backup saved: backup_before_contact_cleanup_${TIMESTAMP}.sql"
  ```
- [ ] 백업 파일 저장 위치: _____ (예: S3, 로컬 디스크)
- [ ] 백업 복구 테스트 완료

### Step 3.3: 실행 계획서 작성
- [ ] 실행 일자 및 시간 확정: _____ (UTC)
- [ ] 담당자 지정: _____
- [ ] 예상 소요 시간: _____ 분
- [ ] 모니터링 계획:
  - [ ] DB 성능 모니터링 (CPU, 메모리)
  - [ ] 애플리케이션 에러 로그 모니터링
  - [ ] 사용자 신고 핫라인 준비

---

## 🚀 Phase 4: 프로덕션 실행 (권장: 1-2시간)

### Step 4.1: Pre-flight 체크
실행 1시간 전:
- [ ] 백업 수행
  ```bash
  # backup_before_contact_cleanup_[timestamp].sql 생성 확인
  ```
- [ ] 애플리케이션 상태 확인
  - [ ] CRM 웹 UI 접속 가능
  - [ ] API 응답 정상
  - [ ] Contact 목록 조회 가능
- [ ] 팀 및 경영진 대기 (긴급 연락처 확보)

### Step 4.2: SCRIPT 1 실행
```sql
-- 고아 Contact 정정
BEGIN TRANSACTION;
[SCRIPT 1 내용]
COMMIT;  -- 실행 후 바로 COMMIT
```

**Step-by-step:**
1. [ ] Transaction 시작
2. [ ] UPDATE 쿼리 실행
3. [ ] rows_updated 확인: _____ 건
4. [ ] COMMIT 실행
5. [ ] 완료 시간 기록: _____

### Step 4.3: SCRIPT 2 실행
```sql
-- 중복 Contact 병합
BEGIN TRANSACTION;
[SCRIPT 2 내용]
COMMIT;
```

**Step-by-step:**
1. [ ] Transaction 시작
2. [ ] duplicate_contacts 임시 테이블 생성
3. [ ] Contact soft delete 실행
4. [ ] duplicates_removed 확인: _____ 건
5. [ ] CallLog 재지정 실행
6. [ ] COMMIT 실행
7. [ ] 완료 시간 기록: _____

### Step 4.4: SCRIPT 3 실행
```sql
-- 다중 userId 표준화
BEGIN TRANSACTION;
[SCRIPT 3 내용]
COMMIT;
```

**Step-by-step:**
1. [ ] Transaction 시작
2. [ ] latest_user_ids 임시 테이블 생성
3. [ ] Contact userId 표준화
4. [ ] user_id_standardized 확인: _____ 건
5. [ ] COMMIT 실행
6. [ ] 완료 시간 기록: _____

### Step 4.5: SCRIPT 4 검증
```sql
-- 최종 상태 확인
[SCRIPT 4 내용]
```

**최종 검증:**
- [ ] total_active: _____ 건
- [ ] with_userId: _____ (%: _____)
- [ ] remaining_duplicates: 0 ✓
- [ ] inconsistencies: 0 ✓

### Step 4.6: Post-flight 체크
실행 직후:
- [ ] 애플리케이션 재시작 (필요시)
- [ ] CRM 웹 UI 접속 가능 확인
- [ ] 스모크 테스트
  - [ ] Contact 목록 조회
  - [ ] Contact 상세 조회
  - [ ] 새로운 Contact 생성
  - [ ] CallLog 조회
- [ ] 에러 로그 확인 (없어야 함)
- [ ] 사용자 피드백 대기 (1시간)

### Step 4.7: 최종 확인
- [ ] 모든 정정 작업 완료
- [ ] 데이터 무결성 확보
- [ ] 성능 저하 없음
- [ ] 팀 및 경영진에 완료 보고

---

## 📝 Phase 5: 문서화 및 회고 (권장: 30분)

### Step 5.1: 실행 리포트 작성
```markdown
## Contact userId 마이그레이션 실행 리포트

**실행 일시:** 2026-05-XX XX:XX UTC
**담당자:** _____
**소요 시간:** _____ 분

### 실행 결과
- SCRIPT 1: _____ 건 정정 ✓
- SCRIPT 2: _____ 건 삭제 + _____ 건 재지정 ✓
- SCRIPT 3: _____ 건 표준화 ✓

### 최종 상태
- 총 Active Contact: _____ 건
- userId 설정률: ____% (before: ___%)
- 중복: 0 건 ✓
- 불일치: 0 건 ✓

### 이슈 및 해결
- 이슈: _____
- 원인: _____
- 해결방법: _____
- 예방방안: _____

### 다음 단계
- [ ] GoldMember 마이그레이션 진행
- [ ] 신규 API 활성화
- [ ] UI 업그레이드
```

### Step 5.2: 팀 회고
- [ ] 실행 과정 검토
- [ ] 발생한 이슈 분석
- [ ] 예방방안 논의
- [ ] 다음 마이그레이션 교훈 정리

---

## 🚨 비상 대응 절차

### 문제 발생 시 대응
**Case 1: 정정 중 에러 발생**
- [ ] ROLLBACK 즉시 실행
- [ ] 에러 메시지 캡처
- [ ] 개발팀에 보고
- [ ] 재실행 계획 수립

**Case 2: 애플리케이션 에러**
- [ ] 백업에서 복구
  ```bash
  psql -h [host] -U neondb_owner -d neondb < backup_before_contact_cleanup_[timestamp].sql
  ```
- [ ] 애플리케이션 재시작
- [ ] 사용자에게 공지

**Case 3: 성능 저하**
- [ ] 인덱스 재구성
  ```sql
  REINDEX TABLE "Contact";
  REINDEX TABLE "CallLog";
  ```
- [ ] 통계 업데이트
  ```sql
  ANALYZE "Contact";
  ANALYZE "CallLog";
  ```

---

## 📞 연락처

- **기술 담당:** _____  
- **운영 담당:** _____  
- **경영진:** _____  
- **비상 연락:** _____

---

**체크리스트 완료도:** ____ / 50 항목

**최종 승인:**
- [ ] 기술 담당자: _____ (서명/날짜)
- [ ] 운영 담당자: _____ (서명/날짜)
- [ ] 경영진: _____ (서명/날짜)
