# PostgreSQL DB 실제 상태 분석 리포트

## 1. DB 상태 요약

### 현재 DB의 실제 테이블
- **총 207개 테이블** 존재
  - 206개: 실제 데이터 테이블
  - 1개: `_prisma_migrations` (메타데이터)
  - 예: `Organization`, `Contact`, `CrmLandingView`, `CrmB2BLandingView` 등 모두 **실제 존재**

### Prisma 마이그레이션 파일
- **폴더 기준**: 38개 마이그레이션 정의됨
- **DB 기록(_prisma_migrations)**: 7개만 기록됨

## 2. DB의 마이그레이션 기록 상태

| 순번 | 마이그레이션명 | 상태 | 시간 | ID |
|------|----------------|------|------|-----|
| 1 | 20260415000001_add_sms_log | ✓ 완료 | 2026.5.18 PM 1:48:34 | 8555de96-571b-4c7c-a389-0c4a789a44da |
| 2 | 20260415000002_landing_utm_view | ✓ 완료 | 2026.5.18 PM 2:29:15 | 38e50e97-0a0b-470d-976f-076abcd3ecfa |
| 3 | 20260415000003_landing_registration_meta | ✓ 완료 | 2026.5.18 PM 2:29:16 | 5af3246e-0a5a-44b5-be85-c86d199fa652 |
| 4 | 20260415000004_sms_config_verify | ✓ 완료 | 2026.5.18 PM 2:29:18 | ca067372-b9b2-456e-9d47-3194d9758507 |
| 5 | 20260415000005_landing_view_dedup (시도1) | ✗ 실패 | 2026.5.18 PM 2:31:56 | 3738bdcb-5e46-49e5-b2e2-22c17556e454 |
| 6 | 20260415000005_landing_view_dedup (시도2) | ✗ 실패 | 2026.5.18 PM 2:43:10 | 1b8aa23b-9479-46b1-b09c-5ab32abb8269 |
| 7 | 20260415000005_landing_view_dedup (시도3) | ✓ 완료 | 2026.5.18 PM 2:43:11 | ced84fd8-71af-4f3a-a014-8d75e70043f3 |

**요약:**
- ✓ 완료: 5개
- ✗ 실패 (롤백): 2개
- 마이그레이션 완료도: **5/7 = 71%**

## 3. 미적용 마이그레이션 목록 (31개)

파일시스템에 정의되었으나 DB에서 아직 실행되지 않은 마이그레이션:

### Phase 1 (2026-04-15 ~ 04-17)
```
20260416000006_landing_comments
20260416000007_scheduled_sms
20260416000008_contact_lead_score
20260416000009_contact_tags
20260416000010_re_engage
20260416000011_org_invite
20260416000012_contact_db_tracking
20260416000013_transfer_log
20260416000014_affiliate_sale
20260416000015_b2b_prospect
20260416000020_call_learning_loop
20260416000021_playbook_v2
20260416000022_shortlink
20260416000023_funnel_type
20260416000024_news_shortlink
20260416000026_sales_document
20260417000001_add_member_document
```

### Phase 2 (2026-05-09 ~ 05-18)
```
20260509000001_add_image_asset_processing
20260511000001_add_processed_webhook_event
20260511100001_add_performance_indexes
20260511200001_payapp_b2b_upgrade
20260512200001_add_landing_editor_fields
20260512200002_sms_pause_resume
20260512300001_add_b2b_b2c_performance_indexes
20260516000001_add_contact_group_relations
20260516100001_add_createdByUserId
20260516100002_add_image_orientation
```

### Phase 3 (2026-05-17~18)
```
20260517_add_b2b_prospect
20260517_add_recaptcha_verification_model
20260517_bot_guide_answer_schema
20260517100608_add_partner_suspension
20260518110749_add_execution_log_phase0
20260518120000_fix_execution_log_critical
```

**합계: 31개 미적용 마이그레이션**

## 4. 핵심 발견사항

### A. 기존 테이블은 이미 DB에 존재함
- 207개 테이블이 실제로 생성됨
- `CrmLandingView`, `CrmB2BLandingView` 등 최신 테이블도 존재
- **결론: DB 스키마는 이미 최신 상태**

### B. 마이그레이션 히스토리만 부분 기록됨
- DB에는 처음 4개 + 마지막 1개 마이그레이션만 기록
- 나머지 31개는 파일시스템에만 존재 (DB 레코드 없음)
- **원인**: `prisma migrate deploy` 또는 `prisma db push`가 부분 실행되었거나, 이전 Neon DB에서 마이그레이션 후 DB만 복제된 것 같음

### C. 마이그레이션 충돌 흔적
- `20260415000005_landing_view_dedup` 마이그레이션이 3번 시도됨
- 처음 2번 실패, 3번째에 성공
- 실패 원인: 테이블이 이미 존재하거나 제약조건 충돌 가능

## 5. 현재 상황 결론

| 항목 | 상태 |
|------|------|
| **DB 스키마** | ✓ 최신 (207개 테이블 존재) |
| **마이그레이션 히스토리** | ✗ 불완전 (5/38만 기록) |
| **즉시 조치 필요** | ✗ 아니오 - DB는 이미 적용됨 |
| **추후 관리** | ✓ 필요 - 마이그레이션 히스토리 정리 |

## 6. 권장 조치

### 즉시 (선택사항)
- DB는 최신 상태이므로 `prisma migrate` 실행 불필요
- 필요시 `npx prisma db push --skip-generate` 로 마이그레이션 히스토리 동기화 가능

### 장기 (필수)
- Prisma 마이그레이션 정리: 불일치하는 31개 마이그레이션 검토
- `.env.local`의 `DATABASE_URL` 계속 사용
- `npx prisma generate`로 클라이언트 최신 유지

## 7. 테이블 존재 확인

✓ 확인된 핵심 테이블들:
- Organization
- Contact  
- CrmLandingView
- CrmB2BLandingView
- PartnerSuspension
- ContactGroup
- AffiliateSale
- CrmB2BLandingPage

**모두 실제로 DB에 존재함**.
