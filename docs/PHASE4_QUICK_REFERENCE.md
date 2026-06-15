# Phase 4: 빠른 참조 (Quick Reference)

## 🚀 핵심 3줄 요약

**Agent-CTR-CRON**은 Day 7+ 계약서를 자동으로 감지하여 심리학 기반 A/B 메시지로 재전송합니다.
- **Cron Job**: `src/app/api/cron/contract-reminders/route.ts` (매일 09:00 KST)
- **A/B 변형**: 긴박감 (L10) vs 친절함 (상호성) → 성능 비교
- **심리학**: L6 손실회피 + L10 긴박감 → 전환율 35% → 45%

---

## 📂 파일 위치 및 역할

| 파일 | 목적 | 수정 대상 |
|------|------|----------|
| `src/app/api/cron/contract-reminders/route.ts` | Cron Job 핵심 로직 | Agent-CTR-CRON ✅ |
| `prisma/schema.prisma` | ContractInstance 필드 추가 | Agent-CTR-CRON ✅ |
| `prisma/migrations/20260615120000_*` | DB 마이그레이션 | Agent-CTR-CRON ✅ |
| `src/app/api/contract-instances/[id]/duplicate/route.ts` | 복제 API | Agent-CTR-DUP 🔄 |
| `src/app/(dashboard)/contracts/[id]/DuplicateModal.tsx` | 복제 UI | Agent-CTR-DUP 🔄 |
| `src/app/(dashboard)/contracts/[id]/ContractDetailPanel.tsx` | 액션 버튼 UI | Agent-CTR-STATE 🔄 |
| `src/app/(dashboard)/contracts/ContractActions.ts` | 상태 전이 로직 | Agent-CTR-STATE 🔄 |

---

## 🔑 주요 개념

### ContractInstance 필드 추가

```typescript
// retryCount: 전체 재시도 횟수
// reminderCount: 재전송 횟수 (최대 3회)
// lastReminderSentAt: 마지막 재전송 시각

// 쿼리 조건: WHERE status='SENT' AND reminderCount < 3
```

### Cron Job 워크플로우

```
1. 매일 09:00 KST 실행
2. SENT 상태 + createdAt > 7일 + reminderCount < 3 계약서 조회
3. A/B 변형 선택 (reminderCount % 2)
4. SMS 발송
5. reminderCount++, lastReminderSentAt 업데이트
6. 로그 반환
```

### A/B 변형

| 변형 | 메시지 | 심리학 |
|------|--------|--------|
| **A (짝수)** | "계약서가 대기 중입니다. 지금 서명하세요" | L10 긴박감 |
| **B (홀수)** | "아직 확인하지 않으셨네요. 클릭해서 완료하세요" | 상호성 |

---

## 📊 성과 목표

| 메트릭 | 현재 | 목표 | +% |
|--------|------|------|-----|
| 전환율 | 35% | 45% | +28% |
| 계약 기간 | 5-7일 | 2-3일 | -50% |
| 수동작업 | 100% | 70% | -30% |

---

## ✅ 배포 체크리스트

### 즉시 실행
- [x] Cron Job 코드
- [x] Prisma 스키마
- [x] 마이그레이션
- [x] 문서화

### 배포 전 (Vercel)
```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/contract-reminders",
    "schedule": "0 0 * * *"
  }]
}
```

```env
// .env.local
CRON_SECRET=<secure-token>
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

### 실행
```bash
npx prisma migrate deploy
npx tsc --noEmit  # TSC 검증
```

---

## 🔍 모니터링 및 디버깅

### Cron 로그 확인
```
Vercel Dashboard → Cron Logs
또는 API 응답:
{
  "ok": true,
  "sentCount": 45,
  "skippedCount": 5,
  "processedTotal": 50,
  "durationMs": 12345
}
```

### DB 데이터 검증
```sql
-- SENT 상태 + 7일+ + 재전송 대기 중
SELECT COUNT(*) FROM "ContractInstance"
WHERE status='SENT'
  AND createdAt < NOW() - INTERVAL '7 days'
  AND reminderCount < 3;

-- 마지막 Cron 실행 확인
SELECT MAX(lastReminderSentAt) FROM "ContractInstance";
```

---

## 🧪 테스트 명령어

```bash
# 로컬 테스트 (mock Cron 실행)
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/contract-reminders

# 또는 직접 호출 (코드에서)
import { GET } from '@/app/api/cron/contract-reminders/route';
const response = await GET(new NextRequest('http://localhost/'));
console.log(response.json());
```

---

## 📝 SMS 메시지 템플릿

### 변형 A (긴박감)
```
김철수님, 계약서가 대기 중입니다. 7일 남았습니다. 지금 서명하세요: https://...
```

### 변형 B (친절함)
```
김철수님, 계약서를 아직 확인하지 않으셨네요. 7일 남았습니다. 클릭해서 서명 완료하세요: https://...
```

---

## 🎯 상태 머신 (Agent-CTR-STATE)

```
DRAFT ──[서명요청]──> SENT ──[재전송]──> SENT (반복)
                        │
                        └[요청취소]> ARCHIVED
                        
SIGNED ──> COMPLETED ──[복제]──> DRAFT (신규)
           
ARCHIVED <──[복구]──────┴
```

**액션 버튼**:
- SENT: [재전송], [요청취소]
- COMPLETED: [복제]
- ARCHIVED: [복구]

---

## 🔐 보안 체크

- [x] Cron 토큰 검증 (Bearer)
- [x] 조직별 격리 (organizationId)
- [x] SMS 템플릿 안전 (변수 치환)
- [x] 환경변수 관리 (민감 정보)

---

## 💡 자주 묻는 질문 (FAQ)

**Q: reminderCount를 왜 3회로 제한?**  
A: Day 0-3 (4회) + Day 7 (1회) + 수동 (3회) = 총 7회 접촉 (Grant Cardone 원칙)

**Q: A/B 변형은 어떻게 선택?**  
A: `reminderCount % 2` → 짝수면 A, 홀수면 B (번갈아가며)

**Q: 발송 실패하면?**  
A: reminderCount 증가, 다음 Cron에서 재처리 (최대 3회)

**Q: 24시간 안에 발송 안 되면?**  
A: 24시간마다 1회씩, Cron 실행 시간(09:00 KST) 기준

---

## 📞 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| SMS 발송 안 됨 | SMS 설정 없음 | OrgSmsConfig 확인 |
| reminderCount 증가 안 함 | Prisma 마이그레이션 미적용 | `npx prisma migrate deploy` |
| Cron 401 Unauthorized | CRON_SECRET 미설정 | Vercel Env 추가 |
| reminderCount > 3 계약서 발송 | DB 직접 수정 | WHERE reminderCount < 3 쿼리 확인 |

---

## 🚀 Next Steps

### Phase B (병렬 팀)
- Agent-CTR-DUP: 복제 API + UI (2-3시간)
- Agent-CTR-STATE: 상태 머신 + 액션 (2-3시간)

### Phase C (통합)
- Git merge (1시간)
- 통합 테스트 (1-2시간)
- Vercel 배포 (30분)

### 총 소요 시간
- Phase A (CRON): 4-5시간 ✅ (완료)
- Phase B (병렬): 4-6시간 🔄 (진행 중)
- Phase C (통합): 2-3시간 ⏳ (대기 중)

---

## 📚 추가 문서

- `PHASE4_CONTRACT_REMINDER_SPEC.md` - 상세 스펙 (350줄)
- `PHASE4_CONTRACT_REMINDER_TESTS.md` - 테스트 계획 (8가지 케이스)
- `PHASE4_PARALLEL_AGENT_HANDOFF.md` - 병렬 팀 업무 분담
- `PHASE4_CRON_DELIVERY_SUMMARY.md` - 최종 결과 보고

---

**작성자**: Agent-CTR-CRON  
**작성일**: 2026-06-15  
**상태**: Phase A ✅ | Phase B 🔄 | Phase C ⏳
