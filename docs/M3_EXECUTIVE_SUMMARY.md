# M3 병렬 마일스톤 거장단 토론 최종 결정 (2026-06-22)

## 🎯 5가지 핵심 결정

| # | 주제 | 결정 | 효과 |
|---|------|------|------|
| **1** | API 설계 | `/restore` (DB만) + `/download` (별도) | 책임 분리, 응답 < 500ms |
| **2** | 권한 검증 | Trip organizationId (Contact는 향후) | 단순성↑, 성능↑, 인덱스 최적화 |
| **3** | 메모리 | Phase 1: 전체 로드 (5MB) → Phase 2: 스트리밍 | 안정성↑, 미래 50MB 대비 |
| **4** | 테스트 | 로컬 병렬 + Phase 완료 후 통합 | 속도 2배↑, 안정성 유지 |
| **5** | 성능 SLA | DB < 1초, Cron < 60초, API < 3초 | UX 최적화, Vercel 제약 준수 |

---

## 📅 실행 일정 (3주)

```
Week 1 (2026-06-22~06-28)
├─ Phase 1A: Contact 토큰 갱신 (2026-06-22~06-25)
│  └─ Team 1: 4시간 병렬 → 3일 소요 (테스트 포함)
├─ Phase 1B: Passport 파일 백업 (2026-06-25~06-27)
│  └─ Team 2: 4시간 병렬 → 2일 소요 (Team 1 후)
└─ Phase 1C: Campaign Soft-Delete (2026-06-27~06-28)
   └─ Team 3: 3.5시간 병렬 → 1.5일 소요 (Team 2 후)
   └─ 통합 테스트: 30분 (2026-06-28)

예상 완료: 2026-06-28 (7일 이내)
```

---

## 👥 팀 구성

| 팀 | 담당 | 작업 | 시간 |
|----|------|------|------|
| **Team 1** | Agent-Contact-Backup | Google OAuth 토큰 + 복구 API | 4h |
| **Team 2** | Agent-Passport-Backup | 파일 버퍼 + 권한 격리 | 4h |
| **Team 3** | Agent-Marketing-Backup | Soft-Delete 표준화 | 3.5h |
| **통합** | 모든 에이전트 | 감사로그, 권한 검증, 성능 | 30min |

---

## ✅ 병렬 실행 조건

### 필수 확인 사항
- [ ] 각 팀 담당자 할당 완료
- [ ] Git worktree 준비 (7개 팀용)
- [ ] Test 스크립트 준비
  - `npm run test:backup-contact`
  - `npm run test:backup-passport`
  - `npm run test:backup-marketing`
  - `npm run test:backup-system`

### 빌드 안전성
```
✅ 각 팀 로컬에서만 실행:
  npx tsc --noEmit
  npx prisma generate
  npm run test:backup-[domain]

❌ 절대 금지:
  npm run build (dev 서버 실행 중)
```

### 공유 파일 관리
```
순차 처리:
  1. Team 1: Contact 토큰 갱신
  2. Team 2: Passport 폴더 추가 (prisma/schema.prisma 수정)
  3. Team 3: Campaign soft-delete (prisma/schema.prisma 수정)

각 단계 후:
  - Commit + Push
  - 다음 팀: Pull + 시작
```

---

## 🚀 즉시 시작 가능 여부

### ✅ 병렬 마일스톤 시작 가능
- 거장단 5명 토론 완료
- 5가지 결정 사항 문서화 완료
- 팀 배치 및 의존성 명확화 완료
- 성능 SLA 정의 완료

### 🟡 시작 전 확인
- [ ] Team 1 담당자 확인
- [ ] Test 스크립트 작동 확인
- [ ] Git worktree 설정

---

## 📋 다음 단계

### 1단계: Phase 1 실행 (2026-06-22 시작)
```bash
# Team 1 시작
npm run test:backup-contact

# Team 1 완료 후 Team 2
npm run test:backup-passport

# Team 2 완료 후 Team 3
npm run test:backup-marketing

# 통합 테스트
npm run test:backup-system
```

### 2단계: 상세 문서 참고
- `docs/M3_PARALLEL_MILESTONE_ANALYSIS.md` (전체 분석)
- `docs/M3_TEAM_ASSIGNMENT.md` (팀별 실행 지시서)
- `docs/BACKUP_SYSTEM_WORK_DIRECTIVE.md` (기존 Phase 계획)

### 3단계: Phase 2 준비 (2026-06-28 후)
- PII 암호화 라이브러리 설계
- MIME 검증 규칙 정의
- 이미지 감사로그 구조 설계

---

## 🎯 성공 기준

### Phase 1A-C 완료 후
- [ ] 모든 npm run test:* 통과
- [ ] npx tsc --noEmit (0 에러)
- [ ] 권한 검증 100% (조직별 격리)
- [ ] 감사로그 모든 작업 기록
- [ ] 성능 SLA 달성
  - Contact 복구: < 500ms
  - Passport 백업: < 60초
  - Campaign 복구: < 1초

### 보안 검증
- [ ] Cross-org 혼성 데이터 테스트 (보안)
- [ ] API 엔드포인트 권한 검증
- [ ] 환경변수 노출 검사
- [ ] 민감정보 마스킹 확인

---

## 📝 추가 자료

1. **M3 병렬 마일스톤 전체 분석**
   - 파일: `docs/M3_PARALLEL_MILESTONE_ANALYSIS.md`
   - 내용: 5가지 결정사항 상세 분석, 위험요소, 성능 측정

2. **팀별 실행 지시서**
   - 파일: `docs/M3_TEAM_ASSIGNMENT.md`
   - 내용: 팀 배치, 의존성, 커밋 메시지, 체크리스트

3. **기존 Phase 계획**
   - 파일: `docs/BACKUP_SYSTEM_WORK_DIRECTIVE.md`
   - 내용: Phase 1-3 전체 계획 (5주, 7팀)

---

**작성일**: 2026-06-22  
**상태**: ✅ 병렬 마일스톤 즉시 시작 가능  
**의사결정**: 거장단 5명 합의 완료  
**예상 완료**: 2026-06-28 (Phase 1)  
**전체 완료**: 2026-07-23 (Phase 1-3)
