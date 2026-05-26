# 마비즈 CRM 기술 메모리 파일 생성 완료 (2026-05-26)

## 📚 생성된 5개 기술 문서

### 1. crm_database_design.md (282줄)
**주제:** Supabase PostgreSQL 스키마, 정규화, 인덱싱

**핵심 내용:**
- Prisma 데이터소스 설정 (Neon PostgreSQL + PrismaPg Adapter)
- 3정규화 (1NF, 2NF, 3NF) 적용 전략
- Contact 테이블 구조 (430+ 렌즈 필드 비정규화 설계)
- 복합 인덱스 12개 (organizationId 기반)
- 부분 인덱스 (활성 레코드만 인덱싱)
- 마이그레이션 관리 (Prisma Migrate 패턴)

**성능 기준:**
| 작업 | 응답시간 | 인덱스 |
|------|---------|---------|
| 고객 목록 조회 | < 100ms | idx_contact_org_assigned |
| 렌즈별 세그먼트 | < 200ms | idx_contact_org_segment |
| SMS 발송 추적 | < 150ms | idx_contact_*_sms_status |

---

### 2. crm_api_patterns.md (530줄)
**주제:** REST API 설계, 에러 처리, 역할기반 접근 제어

**핵심 내용:**
- Next.js App Router 파일 기반 라우팅
- 표준 응답 형식 (SuccessResponse<T> / ErrorResponse)
- Prisma 에러 코드 매핑 (P2002: 중복, P2025: 레코드 없음)
- 역할기반 접근 제어 (RBAC: OWNER/AGENT/GLOBAL_ADMIN)
- 민감 정보 마스킹 (Agent 역할)
- N+1 쿼리 방지 (배치 조회)

**주요 API:**
- GET /api/contacts — 역할기반 고객 조회 (태그, 그룹, 검색 필터)
- POST /api/contacts — 고객 생성 (세그먼트 자동 감지)
- POST /api/contacts/import — CSV 대량 수입
- POST /api/crm/lens-sequences — SMS Day 0-3 자동화

---

### 3. crm_orm_integration.md (507줄)
**주제:** Prisma ORM 통합, 쿼리 패턴, 트랜잭션 관리

**핵심 내용:**
- PrismaClient 싱글톤 패턴 (전역 재사용)
- CRUD 기본 패턴 (create, findUnique, update, upsert, delete)
- 트랜잭션 관리 (prisma.$transaction)
- 대리점 계약 승인 (5개 테이블 원자성 보장)
- 배치 작업 (createMany, updateMany)
- 렌즈별 세그먼테이션 쿼리 (GROUP BY)
- SMS Day 0-3 시퀀스 추적

**최적화 기법:**
- INCLUDE vs SELECT (성능 비교)
- 배치 조회 (N+1 방지)
- 집계 함수 (COUNT, GROUP BY, _avg, _max)

---

### 4. crm_data_integrity.md (474줄)
**주제:** 데이터 검증, 트랜잭션 일관성, 제약조건, 무결성 감시

**핵심 내용:**
- 3단계 검증 (입력 검증 → DB 제약 → 비즈니스 로직)
- 외래키 제약 (Cascade, SetNull, Restrict)
- 트랜잭션 ACID (Atomicity, Consistency, Isolation, Durability)
- SMS 발송 멱등성 (중복 발송 방지)
- 일일 무결성 감시 Job (고아 레코드, 만료 윈도우)
- 백업 및 복원 전략

**검증 패턴:**
- 전화번호 정규표현식: /^01[0-9]-?\d{3,4}-?\d{4}$/
- 이메일 검증: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
- 열거형 검증: ["LEAD", "CUSTOMER", "VIP"]

---

### 5. crm_performance_optimization.md (498줄)
**주제:** 쿼리 최적화, 캐싱, 연결 풀링, 모니터링

**핵심 내용:**
- 인덱스 활용 (< 50ms vs 100-500ms)
- SELECT 절 최적화 (95% 응답 크기 감소)
- N+1 쿼리 해결 (2개 쿼리로 통합)
- Neon Connection Pooling (pool_size, max_overflow)
- SMS Day 0-3 배치 처리 (100,000명 < 5분)
- Redis 캐싱 전략 (템플릿, 조직 설정)
- HTTP 캐싱 헤더 (Cache-Control)
- 성능 모니터링 (응답시간 측정)

**성능 SLA:**
| 작업 | 목표 | 우선순위 |
|------|------|---------|
| 고객 조회 (50명) | < 100ms | P0 |
| 고객 목록 (100명) | < 200ms | P0 |
| 렌즈 통계 | < 300ms | P1 |
| SMS 100K명 | < 5분 | P1 |

---

## 📊 문서 통계

| 파일 | 줄 수 | 초점 |
|------|-------|------|
| database_design | 282 | 스키마, 정규화, 인덱싱 |
| api_patterns | 530 | REST 엔드포인트, 에러처리, RBAC |
| orm_integration | 507 | Prisma 쿼리, 트랜잭션, 배치 |
| data_integrity | 474 | 검증, ACID, 제약조건 |
| performance_optimization | 498 | 최적화, 캐싱, 모니터링 |
| **합계** | **2291** | **완전한 기술 레퍼런스** |

---

## 🎯 활용 방법

### 1. 신입 개발자 온보딩
```
1일차: crm_database_design.md 읽기 (스키마 이해)
2일차: crm_api_patterns.md 읽기 (API 설계 배우기)
3일차: crm_orm_integration.md 읽기 (쿼리 작성 연습)
4일차: crm_data_integrity.md 읽기 (데이터 무결성)
5일차: crm_performance_optimization.md 읽기 (성능 최적화)
```

### 2. 코드 리뷰 체크리스트
```
- API: crm_api_patterns.md의 에러 처리 패턴 확인
- 쿼리: crm_orm_integration.md의 N+1 방지 기법 적용 여부
- 트랜잭션: crm_data_integrity.md의 ACID 원칙 준수
- 성능: crm_performance_optimization.md의 SLA 달성 확인
```

### 3. 버그 수정
```
- 중복 데이터: crm_database_design.md의 유니크 제약 검토
- 데이터 손실: crm_data_integrity.md의 외래키 전략 확인
- 느린 쿼리: crm_performance_optimization.md의 인덱스 활용
- SMS 문제: crm_orm_integration.md의 멱등성 패턴 검토
```

---

## 🔗 참고 자료 (마비즈 CRM 깃 히스토리)

| 커밋 | 주제 | 참조 문서 |
|------|------|---------|
| b338a7f | Contact FK 필드 추가 | database_design |
| f3cc6fb | Payment/Reservation FK | orm_integration |
| d2b6343 | SMS Day 0-3 자동화 | api_patterns, performance |
| 4801282 | P1 심리학 4대 렌즈 | orm_integration, data_integrity |
| 5e527a4 | 빌드 에러 수정 | api_patterns, data_integrity |

---

## ✅ 다음 단계

1. **메모리 통합:** CLAUDE.md + MEMORY.md에 파일 링크 추가
2. **실시간 동기화:** Contact 스키마 변경 시 database_design.md 업데이트
3. **성능 모니터링:** 월간 SLA 달성 현황 추적
4. **팀 교육:** 신입 온보딩 시 5개 문서 순차 학습

---

생성일: 2026-05-26 | 생성자: AI Agent | 버전: 1.0
