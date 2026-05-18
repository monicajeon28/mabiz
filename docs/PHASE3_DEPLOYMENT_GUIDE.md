# Phase 3 배포 실행 가이드

**대상**: 개발팀 배포 담당자  
**소요시간**: 약 2시간 (배포 + 모니터링)  
**위험도**: 낮음 (자동 롤백 가능)

---

## 🚀 배포 전 체크리스트 (배포 1시간 전)

### Step 1: 환경 준비 (5분)

```bash
# 저장소 최신화
cd /d/mabiz-crm
git fetch origin
git status

# 필요한 것:
# - 로컬 변경사항 0개
# - 원격 origin/main과 동기화
```

### Step 2: 코드 품질 검증 (10분)

```bash
# TypeScript 컴파일 확인
npm run type-check
# 예상: 0 error

# ESLint 검사
npm run lint
# 예상: 0 error, 0 warning

# 단위 테스트 실행
npm run test -- --testPathPattern="(verification|execution|campaign)" --coverage
# 예상: 100% 통과
```

### Step 3: 성능 벤치마크 (5분)

```bash
# 성능 테스트 실행
npm run benchmark
# 예상 결과:
# - P99 < 150ms
# - 메모리 < 300MB
# - DB 쿼리 < 10개
```

### Step 4: 데이터 무결성 검증 (5분)

```bash
# 데이터 검증 스크립트 실행 (수동)
npm run verify:data

# 또는 직접 쿼리 실행
psql $DATABASE_URL << EOF
-- ExecutionLog 행 수 확인
SELECT COUNT(*) as execution_count FROM execution_log;

-- SendingHistory 행 수 확인
SELECT COUNT(*) as sending_count FROM sending_history;

-- 최근 7일 일관성 확인
SELECT 
  (SELECT COUNT(*) FROM execution_log WHERE created_at > NOW() - INTERVAL '7 days' AND source_type = 'CAMPAIGN') as exec_count,
  (SELECT COUNT(*) FROM sending_history WHERE created_at > NOW() - INTERVAL '7 days' AND campaign_id IS NOT NULL) as send_count;
EOF
```

**예상 결과**:
```
execution_count: 10,000+
sending_count: 10,000+
일관성: 95%+
```

### Step 5: 팀 공지 (5분)

```bash
# Slack 공지 템플릿
cat << 'EOF' | pbcopy
🚀 **Menu #38 Phase 3 배포 시작**

**시간**: 오후 2:00 PM ~ 4:00 PM KST
**담당**: [개발자명]
**영향**: 마케팅 자동화 기능 (사용자 무중단)
**롤백**: 필요시 자동 수행 (<1분)

📌 **모니터링**:
- #crm-deployments 채널 확인
- 문제 발생 시 즉시 연락

❌ **이 시간에 마케팅 캠페인 발송 금지**

감사합니다!
EOF
```

---

## 🎯 배포 절차

### Phase A: Feature Flag 초기화 (배포 0분)

```bash
# 1. Feature Flag를 OFF (0%)로 설정
# 목적: 새 로직 비활성화 상태로 배포

curl -X POST http://localhost:3000/api/admin/feature-flags/menu38-phase3 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabledPercentage": 0,
    "description": "Phase 3 배포 시작 - OFF 상태로 배포"
  }'

# 응답 확인:
# {
#   "flag": "menu38-phase3",
#   "enabledPercentage": 0,
#   "status": "disabled",
#   "updatedAt": "2026-05-19T14:00:00Z"
# }

echo "✅ Feature Flag OFF - 배포 준비 완료"
```

### Phase B: 데이터베이스 마이그레이션 (배포 5분)

```bash
# 2. 데이터베이스 마이그레이션 실행
npm run prisma migrate deploy

# 예상 결과:
# Prisma schema loaded from prisma/schema.prisma
# Datasource "db": PostgreSQL
# 
# 1 migration file validated
# No new migrations to apply.

echo "✅ DB 마이그레이션 완료"

# 3. 마이그레이션 검증 (선택)
npm run prisma migrate status

# 마이그레이션 목록 확인:
# Database: CRM (PostgreSQL)
# Status: All migrations have been applied
```

### Phase C: 애플리케이션 배포 (배포 10분)

```bash
# 4. Git 커밋 확인 (배포 전 검증)
git log -1 --oneline
# 예상: refactor(automation): Phase 3-β P2 이슈 5개 해결

# 5. Vercel에 배포 (git push)
git push origin main

# 예상 동작:
# 1. GitHub에 푸시
# 2. Vercel 자동 배포 트리거 (3-5분)
# 3. 배포 로그: https://vercel.com/mabiz/cruiseai/deployments

echo "⏳ Vercel 배포 중... (약 5분 대기)"
```

**배포 진행 상황 확인**:
```bash
# Vercel 배포 상태 확인 (CLI 필요)
vercel --prod --team mabiz
# 또는 웹 대시보드: https://vercel.com/mabiz/cruiseai

# 배포 완료 후:
# ✅ Production: Ready
```

### Phase D: 카나리 배포 (배포 20분)

```bash
# 6. 배포 완료 후 Feature Flag를 50%로 설정
# 목적: 일부 사용자에게만 새 로직 적용

sleep 300  # 5분 대기 (Vercel 배포 완료)

curl -X POST http://localhost:3000/api/admin/feature-flags/menu38-phase3 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabledPercentage": 50,
    "description": "카나리 배포 - 50% 사용자에게 적용"
  }'

echo "✅ 카나리 배포 시작 (50%)"

# 7. 30분간 모니터링
echo "📊 모니터링 중... (30분)"
sleep 1800
```

### Phase E: 일반 배포 (배포 50분)

```bash
# 8. 카나리 검증 완료 후 Feature Flag를 100%로 설정
curl -X POST http://localhost:3000/api/admin/feature-flags/menu38-phase3 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabledPercentage": 100,
    "description": "Phase 3 배포 완료 - 100% 사용자에게 적용"
  }'

echo "✅ 일반 배포 완료 (100%)"
```

---

## 📊 배포 중 모니터링

### Slack 모니터링 (실시간)

**채널**: `#crm-deployments`  
**빈도**: 5분마다 확인

```
예상 알림 시간표:

14:00 - 🟢 Vercel 배포 시작
        @ vercel.com/mabiz/cruiseai/deployments

14:05 - 🟡 카나리 배포 (50%) 시작
        @ http://localhost:3000/api/admin/feature-flags

14:35 - 🟢 카나리 검증 완료
        @ 성능 P99 120ms, 에러율 0%

14:36 - 🟢 일반 배포 (100%) 시작

14:40 - ✅ Phase 3 배포 완료
        @ 배포 시간: 40분, 에러: 0개
```

### API 상태 확인 (수동)

```bash
# 배포 각 단계별 API 상태 확인

# 1. 헬스 체크
curl http://localhost:3000/api/health

# 2. Feature Flag 상태
curl http://localhost:3000/api/admin/feature-flags/menu38-phase3

# 3. 검증 상태
curl http://localhost:3000/api/admin/verification/status

# 예상 응답:
# {
#   "status": "healthy",
#   "consistency": 95.2,
#   "lastCheck": "2026-05-19T14:35:00Z",
#   "automationEnabled": false
# }
```

### 성능 지표 확인 (Vercel)

```
Vercel Dashboard: https://vercel.com/mabiz/cruiseai/analytics

확인 항목:
- 응답 시간: P99 < 150ms
- 에러율: 0% 유지
- 메모리: 250MB 이하
- DB 연결: 안정적
```

---

## 🔄 모니터링 중 대응

### 정상 신호 (계속 진행)

```
✅ P99 응답시간 < 150ms
✅ 에러율 0%
✅ Consistency 95%+
✅ 채널별 동기화 99%+
→ 다음 단계로 진행
```

### 경고 신호 (모니터링 강화)

```
🟡 P99 응답시간 150-200ms
🟡 에러율 0.1-1%
🟡 Consistency 90-95%
→ 30분 더 모니터링
→ 개선 없으면 롤백 고려
```

### 위험 신호 (즉시 롤백)

```
🔴 P99 응답시간 > 200ms
🔴 에러율 > 1%
🔴 Consistency < 90%
→ 즉시 롤백 실행 (5.1 참고)
```

---

## 🚨 배포 중 롤백 (장애 발생 시)

### 상황 1: 수동 롤백 (선택)

```bash
# 1. Feature Flag를 즉시 OFF로 설정
curl -X POST http://localhost:3000/api/admin/verification/rollback \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason": "사용자 선택 롤백"}'

# 2. 상태 확인
curl http://localhost:3000/api/admin/verification/status

# 3. Slack 공지
cat << 'EOF'
⚠️ Phase 3 수동 롤백 실행
- Feature Flag OFF (0%)
- 영향: 새 ExecutionLog 기능 비활성화
- 기존 SendingHistory: 정상 작동
- 예상 복구: 5분 내
EOF
```

### 상황 2: 자동 롤백 (시스템 자동)

```
시스템이 Consistency < 90% 감지
↓
즉시 Feature Flag OFF 자동 실행
↓
Slack #crm-alerts 알림 발송
↓
관리자 메일 발송
↓
예상 복구: < 1분
```

**자동 롤백 확인**:
```bash
# Slack에서 자동 롤백 알림 확인
# #crm-alerts 채널

# 또는 API로 상태 확인
curl http://localhost:3000/api/admin/verification/status
# {
#   "status": "rolled_back",
#   "timestamp": "2026-05-19T14:45:00Z",
#   "reason": "Consistency < 90% auto-rollback"
# }
```

---

## ✅ 배포 후 검증 (배포 완료 후 1시간)

### Step 1: 자동 검증 실행 (10분)

```bash
# 배포 완료 후 자동 검증 크론잡 대기
# (매일 06:00 KST 자동 실행, 지금은 수동 실행)

npm run verify:execution-log

# 또는 관리자 API 호출
curl -X POST http://localhost:3000/api/admin/verification/verify \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 예상 결과:
# {
#   "items": [
#     {
#       "name": "Row Count Consistency",
#       "status": "PASS",
#       "value": 95.2,
#       "threshold": 95
#     },
#     {
#       "name": "Channel Sync Rate",
#       "status": "PASS",
#       "value": 99.5,
#       "threshold": 99
#     }
#   ],
#   "overallStatus": "PASS",
#   "timestamp": "2026-05-19T14:50:00Z"
# }
```

### Step 2: E2E 테스트 실행 (15분)

```bash
# 통합 테스트 실행
npm run test:e2e

# 또는 특정 시나리오만 테스트
npm run test:e2e -- --testNamePattern="campaign-execution"

# 예상: 모든 테스트 PASS
# ✓ Campaign 생성 및 발송
# ✓ ExecutionLog 기록
# ✓ Feature Flag 토글
# ✓ 자동 롤백 트리거
```

### Step 3: 데이터 일관성 확인 (10분)

```bash
# SQL로 직접 확인
psql $DATABASE_URL << EOF
-- 1. 최근 1시간 발송 현황
SELECT 
  COUNT(*) as total,
  source_type,
  COUNT(*) * 100.0 / (SELECT COUNT(*) FROM execution_log WHERE created_at > NOW() - INTERVAL '1 hour') as percentage
FROM execution_log
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY source_type;

-- 2. 채널별 분포
SELECT 
  channel,
  COUNT(*) as count,
  COUNT(*) * 100.0 / (SELECT COUNT(*) FROM execution_log WHERE created_at > NOW() - INTERVAL '1 hour') as percentage
FROM execution_log
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY channel;

-- 3. 상태별 분포
SELECT 
  status,
  COUNT(*) as count,
  COUNT(*) * 100.0 / (SELECT COUNT(*) FROM execution_log WHERE created_at > NOW() - INTERVAL '1 hour') as percentage
FROM execution_log
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY status;
EOF
```

**예상 결과**:
```
total: 100+
채널 비율: SMS 50%, EMAIL 50% (균등)
상태: SENT 95%, FAILED 5%
```

### Step 4: 성능 재검증 (5분)

```bash
# 최종 성능 확인
npm run benchmark

# 또는 Vercel Analytics
# https://vercel.com/mabiz/cruiseai/analytics

# 확인 항목:
# ✅ P99 < 150ms (목표 200ms)
# ✅ P95 < 100ms
# ✅ 평균 < 50ms
# ✅ 메모리 < 300MB
# ✅ DB 쿼리 < 10개
```

---

## 📋 배포 완료 체크리스트

배포 완료 후 다음을 확인하세요:

```
배포 완료 체크리스트
[ ] Vercel 배포 완료 (✅ Production)
[ ] Feature Flag 100% 활성화 확인
[ ] 자동 검증 PASS
[ ] E2E 테스트 통과
[ ] 성능 기준 달성 (P99 < 150ms)
[ ] 에러율 0% 확인
[ ] Slack #crm-general 공지 완료
[ ] 팀 피드백 수집 완료

배포 시간: ___ 시간 ___ 분
배포자: _______________
최종 검증: _______________
```

---

## 📞 배포 중 문제 대응

### 문제: Vercel 배포 실패

**증상**: 배포가 진행되지 않음, Red X 표시  
**원인**: 빌드 에러, 환경 변수 누락  
**해결**:

```bash
# 1. 로컬에서 빌드 테스트
npm run build

# 2. 빌드 로그 확인
# Vercel Dashboard에서 Deployment 탭 클릭
# 빌드 에러 메시지 확인

# 3. 에러 해결 후 재배포
git push origin main
```

### 문제: Feature Flag API 작동 안 함

**증상**: `/api/admin/feature-flags` 응답 없음  
**원인**: API 서버 미시작  
**해결**:

```bash
# 1. 서버 상태 확인
curl http://localhost:3000/api/health

# 2. 서버 재시작
npm run dev

# 3. Feature Flag 재설정
curl -X POST http://localhost:3000/api/admin/feature-flags/menu38-phase3 \
  -d '{"enabledPercentage": 0}'
```

### 문제: 검증 실패 (Consistency < 90%)

**증상**: 자동 롤백 발생  
**원인**: 데이터 동기화 문제  
**해결**:

```bash
# 1. 즉시 롤백 확인
curl http://localhost:3000/api/admin/verification/status

# 2. 자동 복구 실행
curl -X POST http://localhost:3000/api/admin/verification/recover

# 3. 데이터 검증
npm run verify:data

# 4. 문제 보고
# #crm-alerts에서 알림 확인
# 관리자 메일 확인
```

---

## 📚 참고 자료

| 문서 | 용도 |
|------|------|
| [최종 배포 준비](./PHASE3_FINAL_DELIVERY.md) | 배포 전체 개요 |
| [운영 매뉴얼](./PHASE3_COMPLETE_OPERATIONS_MANUAL.md) | 배포 후 운영 |
| [롤백 플레이북](./PHASE3_DELTA_P0_FIXES.md) | 긴급 상황 대응 |
| [호환성 테스트](./MENU38_PHASE3_COMPATIBILITY_TESTS.md) | 검증 방법 |

---

**마지막 수정**: 2026-05-19  
**버전**: 1.0  
**승인**: 대기 중

