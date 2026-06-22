# 🎯 M2-5 파일 마이그레이션 - 빠른 목차

**Phase**: 1C M2-5 (여권 백업 파일 마이그레이션)  
**준비 상태**: ✅ 완료  
**시작 날짜**: 2026-07-04  
**소요 시간**: 1일 (20-30분 실행 + 10-15분 검증)

---

## 📂 필수 파일

### 1️⃣ 마이그레이션 스크립트 (실행)
**파일**: `scripts/migrate-passport-files-to-trips.mjs` (14KB, 469줄)

**역할**: 기존 평면 폴더 → Trip별 계층 구조 마이그레이션

**실행**:
```bash
cd D:\mabiz-crm
dotenv -e .env.local node scripts/migrate-passport-files-to-trips.mjs
```

**기능**:
- 모든 guests (backup status = 'success') 자동 조회
- Trip별 폴더 생성: Org-{orgId}/Trip-{tripId}
- 서브폴더 생성: 여권이미지/, OCR데이터/
- 파일 이동 + 이름 변경: guest-{id}.webp, guest-{id}.json
- 실시간 로깅 + 최종 통계

---

## 📚 문서 선택 가이드

### A. 빠르게 시작하려면 👈 추천
**파일**: `docs/BACKUP_SYSTEM_PASSPORT_M2_5_README.md` (3.1KB)

**내용**: 5분 안에 시작하기 (1-5단계)
- 스크립트 위치
- 환경 확인
- 실행 명령
- 결과 확인
- Google Drive 확인

---

### B. 상세히 이해하려면
**파일**: `docs/BACKUP_SYSTEM_PASSPORT_PHASE1C_M2_5_MIGRATION.md` (9.6KB)

**내용**: 완벽한 작업지시서
- 마이그레이션 개요 (시각화)
- Step 1-5 상세 절차
- 환경 변수 설정
- 로컬 테스트 (드라이런)
- 검증 체크리스트 (4가지)
- 문제 해결 (4가지 흔한 문제)
- 기대 효과
- 롤백 계획
- 보안 체크리스트

**대상**: Agent-Passport 팀 엔지니어

---

### C. 검증/QA를 해야 한다면
**파일**: `docs/M2_5_VALIDATION_CHECKLIST.md` (7.8KB)

**내용**: Phase 1-8 단계별 체크리스트
- Phase 1: 사전 준비
- Phase 2: 스크립트 실행
- Phase 3: Google Drive 검증
- Phase 4: DB 검증 (Prisma Studio + SQL)
- Phase 5: 파일 복구 테스트
- Phase 6: 성능 확인
- Phase 7: 이슈 추적
- Phase 8: 최종 체크인
- 최종 요약표
- 서명 필드

**대상**: QA 팀, 검증 담당자

---

### D. 전체 개요를 알고 싶다면
**파일**: `docs/M2_5_DELIVERABLES_SUMMARY.md` (9.8KB)

**내용**: 납품물 완전 요약
- 납품물 5가지 (스크립트, 3개 문서, 스키마)
- 실행 흐름
- 검증 기준
- 다음 단계 (M3)
- 성능 목표
- 학습 포인트
- 트러블슈팅 (Q&A)
- 커밋 메시지 템플릿

**대상**: 프로젝트 리더, 기술 매니저

---

## ⚡ 5분 실행 가이드

### 1단계: 환경 확인 (1분)
```bash
cd D:\mabiz-crm
echo $GOOGLE_OAUTH_ACCESS_TOKEN  # 설정 확인
# 만료됨? → Google OAuth에서 새 토큰 발급
```

### 2단계: 스크립트 실행 (3-10분)
```bash
dotenv -e .env.local node scripts/migrate-passport-files-to-trips.mjs
```

### 3단계: 결과 확인 (1분)
```
✅ 성공: NNN명
❌ 실패: N명
⏭️  스킵: N명
```

### 4단계: Google Drive 확인 (1분)
```
마비즈CRM-여권백업/
└─ Org-{orgId}/
   └─ Trip-{tripId}/
      ├─ 여권이미지/ (WebP 파일들)
      └─ OCR데이터/ (JSON 파일들)
```

---

## 📋 핵심 체크리스트

- [ ] `.env.local`에 GOOGLE_OAUTH_ACCESS_TOKEN 설정
- [ ] 스크립트 실행: `dotenv -e .env.local node scripts/...mjs`
- [ ] 성공 게스트 수 = 예상 수 (실패 + 스킵 = 0)
- [ ] Google Drive 폴더 구조 (Org/Trip/여권이미지,OCR데이터)
- [ ] 파일명 (guest-{id}.webp, guest-{id}.json)
- [ ] 파일 다운로드 테스트 (손상 없음)
- [ ] DB: GmTripGoogleDriveConfig 확인
  - googleFolderId NOT NULL
  - googleFolderName = Trip-{tripId}
  - deletedAt = NULL

---

## 🔍 문제 발생 시

| 문제 | 원인 | 해결책 |
|------|------|--------|
| "Google Drive 생성 실패" | Token 만료 | Google OAuth에서 새 토큰 발급 |
| "organizationId 조회 실패" | 조직 정보 없음 | 정상 동작 (fallback: USER_{tripId}) |
| "파일 이동 실패" | API Rate Limit | 스크립트 재실행 |
| "스크립트 중단" | 네트워크/메모리 | 재실행 |

**상세 가이드**: `docs/BACKUP_SYSTEM_PASSPORT_PHASE1C_M2_5_MIGRATION.md` → "문제 해결" 섹션

---

## 📞 연락처

- **기술 문의**: Agent-Passport 팀
- **스크립트 버그**: GitHub Issues (Tag: passport, m2-5)
- **문서 개선**: 무한루프 절대법칙 거장단

---

## 🚀 다음 단계

**M2-5 완료 후**:
1. **M3**: Restore API (Trip 폴더 접근 제어, 1-2일)
2. **M4**: OCR 백업 통합 (1일)
3. **M5**: 부하 테스트 (1,000명, 1-2일)

---

## 📊 파일 요약

| 파일 | 크기 | 줄수 | 용도 |
|------|------|------|------|
| `scripts/migrate-passport-files-to-trips.mjs` | 14KB | 469 | 마이그레이션 실행 ⭐ |
| `docs/BACKUP_SYSTEM_PASSPORT_M2_5_README.md` | 3.1KB | ~100 | 빠른 시작 👈 추천 |
| `docs/BACKUP_SYSTEM_PASSPORT_PHASE1C_M2_5_MIGRATION.md` | 9.6KB | ~350 | 상세 작업지시서 |
| `docs/M2_5_VALIDATION_CHECKLIST.md` | 7.8KB | ~300 | QA 검증 체크리스트 |
| `docs/M2_5_DELIVERABLES_SUMMARY.md` | 9.8KB | ~400 | 전체 개요 |
| **이 파일** `M2_5_INDEX.md` | 1.5KB | ~150 | 빠른 목차 🎯 |

---

## 💾 커밋 체크리스트

```bash
# 1. 스크립트 및 문서 추가
git add scripts/migrate-passport-files-to-trips.mjs
git add docs/BACKUP_SYSTEM_PASSPORT_PHASE1C_M2_5_MIGRATION.md
git add docs/BACKUP_SYSTEM_PASSPORT_M2_5_README.md
git add docs/M2_5_VALIDATION_CHECKLIST.md
git add docs/M2_5_DELIVERABLES_SUMMARY.md
git add M2_5_INDEX.md

# 2. 커밋
git commit -m "feat(backup-passport-m2-5): 파일 마이그레이션 (평면→Trip 계층)

- scripts/migrate-passport-files-to-trips.mjs 추가
- 평면 구조 파일 → Org-{orgId}/Trip-{tripId}/파일타입 이동
- organizationId 자동 조회 + fallback 메커니즘
- Google Drive 폴더 계층 자동 생성
- 파일 이동 + 이름 변경 자동화
- 진행 상황 실시간 로깅 + 최종 통계
- M2-1 스키마, M2-4 폴더 구조 기반 완성
- 상세 작업지시서 + 빠른 시작 가이드 + 검증 체크리스트
- M3 Restore API 준비 완료

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"

# 3. 푸시 (선택)
git push origin main
```

---

## ✨ 준비 완료!

**상태**: ✅ M2-5 모든 준비물 완료  
**시작**: 2026-07-04 (내일)  
**예상 소요**: 1일 (실행 30분 + 검증 15분)  
**담당**: Agent-Passport 팀  

**다음 검토 포인트**: M2-5 실행 후 M3 설계 시작

---

**작성**: 무한루프 절대법칙 거장단  
**최종 업데이트**: 2026-06-22  
**버전**: M2-5 INDEX V1  
