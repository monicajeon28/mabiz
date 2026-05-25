# Missing @/lib Imports - 전체 스캔 결과

**스캔 날짜**: 2026-05-26  
**대상**: `src/` 디렉토리의 모든 `.ts`, `.tsx`, `.js` 파일  
**스캔 방법**: 정규표현식으로 `from '@/lib/...'` 패턴 추출 후 실제 파일 존재 여부 검증

---

## 📊 요약

| 항목 | 수량 |
|------|------|
| 총 임포트된 모듈 | 125개 |
| 실제 존재하는 파일 | 116개 |
| **Missing 모듈** | **9개** |

---

## 🔴 Missing Imports (파일 없음)

### 1. `@/lib/auth-context`
- **상태**: 파일 없음 (댓글 TODO로만 존재)
- **임포트 위치**: 2개 파일
  - `src/app/(dashboard)/campaigns/sending-history/page.tsx`
  - `src/app/(dashboard)/campaigns/sending-history-dashboard/page.tsx`
- **현재 상태**: 코드에 주석 처리됨 (`// TODO: Fix auth import`)
- **영향도**: 낮음 (이미 비활성화)
- **해결책**: 
  - 옵션 1: 파일 생성 (`src/lib/auth-context.ts`)
  - 옵션 2: 주석 제거 (이미 비활성화된 상태)
  - 옵션 3: 기존 `auth.ts` 활용으로 교체

---

### 2. `@/lib/google-sheets`
- **상태**: 파일 없음
- **임포트 위치**: 1개 파일
  - `src/lib/apis/apis-sync-queue.ts` (line ~)
- **사용 목적**: Google Sheets API 통합 (추정)
- **영향도**: 중간 (하나의 중요 파일에만 임포트)
- **해결책**:
  - 파일 생성: `src/lib/google-sheets.ts` (Google Sheets API 클라이언트)
  - 또는 기존 `src/lib/google-drive.ts`에 통합

---

### 3. `@/lib/gemini`
- **상태**: 파일 없음 (코멘트에 "이식 필요"로 표시)
- **임포트 위치**: 1개 파일
  - `src/app/api/passport/admin/chatbot-flow/route.ts`
- **사용 목적**: Google Gemini AI API 통합
- **영향도**: 낮음 (아직 개발 단계)
- **해결책**:
  - 파일 생성: `src/lib/gemini.ts` (Gemini API 클라이언트)
  - 구조: Anthropic SDK와 유사하게 Gemini SDK 래핑

---

### 4. `@/lib/data/questions_rag_memory_with_tone.json`
- **상태**: JSON 데이터 파일 없음
- **임포트 위치**: 1개 파일
  - `src/app/api/tools/bot-guide-answers/route.ts`
- **사용 목적**: 챗봇 답변 RAG 메모리 데이터
- **영향도**: 중간 (챗봇 기능 의존)
- **해결책**:
  - 파일 생성: `src/lib/data/questions_rag_memory_with_tone.json`
  - 또는 데이터를 Prisma/DB로 마이그레이션

---

### 5-8. `@/lib/preparation-guides/*.json` (4개 파일)
- **상태**: JSON 데이터 파일 없음
- **임포트 위치**: 1개 파일
  - `src/app/api/preparation-guides/[category]/route.ts` (모두 같은 파일에서 임포트)
- **파일 목록**:
  - `preparation-guides/customs-guide.json`
  - `preparation-guides/health-guide.json`
  - `preparation-guides/passport-guide.json`
  - `preparation-guides/visa-guide.json`
- **사용 목적**: 여행 준비 가이드 데이터
- **영향도**: 중간 (여행 준비 API 기능)
- **해결책**:
  - 모두 생성: `src/lib/preparation-guides/` 폴더 및 4개 JSON 파일
  - 또는 DB 테이블로 마이그레이션

---

## ✅ 올바르게 임포트된 핵심 파일들

다음 파일들은 모두 정상적으로 존재하고 임포트됨:

| 파일 | 임포트 수 |
|------|-----------|
| `logger.ts` | 높음 (100+) |
| `auth.ts` | 높음 (50+) |
| `prisma.ts` | 높음 (80+) |
| `email.ts` | 중간 (20+) |
| `aligo.ts` | 중간 (15+) |
| `rbac.ts` | 중간 (30+) |
| `redis.ts` | 낮음 (10+) |

---

## 🛠️ 해결 방안 (우선순위)

### P0 (긴급) - API 오류 유발
**영향받는 엔드포인트**:
- `POST /api/preparation-guides/[category]` - 여행 준비 가이드 API
- `POST /api/tools/bot-guide-answers` - 챗봇 답변 API
- `POST /api/passport/admin/chatbot-flow` - 패스포트 챗봇 플로우

**해결 태스크**:
```
1. src/lib/preparation-guides/ 디렉토리 생성
2. 4개 JSON 파일 생성:
   - customs-guide.json
   - health-guide.json
   - passport-guide.json
   - visa-guide.json
3. src/lib/data/ 디렉토리 생성
4. questions_rag_memory_with_tone.json 생성
5. src/lib/gemini.ts 생성 (Google Gemini API 클라이언트)
```

### P1 (높음)
- `src/lib/google-sheets.ts` 생성 (Google Sheets 동기화 기능)

### P2 (낮음)
- `src/lib/auth-context.ts` 생성 또는 주석 제거 (이미 비활성화)

---

## 📝 추가 분석

### 파일 오류 패턴
주목할 점: 일부 임포트 라인이 손상된 상태로 스캔됨
- `aligo/client 에서 이식) ──────────` (주석 내 텍스트)
- `gemini 이식 필요` (주석 내 TODO)
- `password)` (부분 적인 임포트)

이는 **주석이나 비활성화된 임포트 라인**을 그대로 캡처한 것으로, 실제 런타임 오류는 아님.

---

## 🎯 다음 단계

1. **즉시 대응** (30분): JSON 데이터 파일 4개 생성
2. **단기 대응** (1-2시간):
   - Gemini API 클라이언트 작성
   - Google Sheets 클라이언트 작성
3. **검증**: 각 엔드포인트에서 import 오류 없는지 테스트
4. **문서화**: 새로 생성된 모듈의 API 문서 추가

---

## 💡 권장사항

### 코드 구조 개선
- JSON 데이터 파일 → Prisma 데이터베이스로 마이그레이션 검토
- 외부 API 클라이언트 (`google-sheets`, `gemini`) → 통합 관리 패턴 수립

### 체크리스트 추가
빌드 전에 다음을 확인:
```bash
# Missing imports 스캔
grep -rho "@/lib/[^'\"]*" src --include="*.ts" --include="*.tsx" | \
  while read mod; do 
    [ ! -f "src/lib/${mod}.ts" ] && [ ! -d "src/lib/${mod}" ] && echo "MISSING: $mod"
  done
```

---

**작성자**: Claude Code Agent  
**최후 수정**: 2026-05-26  
**스캔 완료 여부**: ✅ 완료
