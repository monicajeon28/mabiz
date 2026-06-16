# QA 데이터 마이그레이션 완료 (2026-06-16)

## ✅ Phase 1a: 완료 상태

### 📊 데이터 요약
- **총 항목 수**: 420개 QA 항목
- **파일 위치**: `src/lib/data/questions_rag_memory_with_tone.json`
- **파일 크기**: 417.86 KB
- **버전**: 2026-05-18
- **상태**: ✅ 타입스크립트 검증 통과 (tsc 0 에러)

---

## 📂 카테고리 분포 (8개)

| 카테고리 | 항목 수 | 비율 |
|---------|--------|------|
| 탑승&수속 | 98 | 23.3% |
| 식사&음료 | 66 | 15.7% |
| 기타 | 91 | 21.7% |
| 정책&수수료 | 46 | 11.0% |
| 기항지&투어 | 41 | 9.8% |
| 객실&카드 | 39 | 9.3% |
| 선상활동 | 25 | 6.0% |
| 기술&앱 | 14 | 3.3% |

---

## 🎯 판매 톤(Tone) 분포 (8개)

| 톤 | 항목 수 | 용도 |
|----|--------|------|
| friendly | 197 | 친근한 톤 (47%) |
| neutral | 149 | 중립적 톤 (35%) |
| professional | 29 | 전문적 톤 (7%) |
| urgent | 28 | 긴급/긴박감 (7%) |
| empathetic | 6 | 공감적 톤 (1%) |
| solution | 7 | 솔루션 기반 (2%) |
| casual | 3 | 캐주얼 톤 (<1%) |
| factual | 1 | 사실 기반 (<1%) |

---

## 🔧 API 엔드포인트

### GET /api/tools/bot-guide-answers
검색 및 필터링 기능

**쿼리 파라미터:**
- `q`: 키워드 검색 (질문/답변)
- `category`: 카테고리 필터 (예: "기타", "정책&수수료")
- `tone`: 판매 톤 필터 (예: "friendly", "urgent")
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 항목 수 (기본값: 20)

**응답 형식:**
```json
{
  "ok": true,
  "data": [...],
  "meta": {
    "total": 420,
    "page": 1,
    "limit": 20,
    "totalPages": 21,
    "hasMore": true
  }
}
```

### POST /api/tools/bot-guide-answers
데이터 일괄 로드 (OWNER/GLOBAL_ADMIN만)

**Request Body (선택사항):**
```json
{
  "mode": "upsert",
  "confirm": false
}
```

**모드:**
- `upsert` (기본값): 기존 데이터 업데이트, 새 데이터 추가
- `replace`: 모든 기존 데이터 삭제 후 새로 로드 (confirm: true 필수)

**응답 형식:**
```json
{
  "ok": true,
  "message": "420개 데이터 처리 완료",
  "succeeded": 420,
  "failed": 0,
  "deletedCount": 0
}
```

---

## 📝 사용 사례

### 1. 카테고리별 QA 조회
```bash
curl "http://localhost:3000/api/tools/bot-guide-answers?category=탑승&수속&limit=10"
```

### 2. 긴박감 톤으로 필터링
```bash
curl "http://localhost:3000/api/tools/bot-guide-answers?tone=urgent&limit=20"
```

### 3. 키워드 검색
```bash
curl "http://localhost:3000/api/tools/bot-guide-answers?q=가격&category=정책&수수료"
```

### 4. 데이터 로드 (관리자)
```bash
curl -X POST http://localhost:3000/api/tools/bot-guide-answers \
  -H "Content-Type: application/json" \
  -d '{"mode":"upsert"}'
```

---

## 🔐 보안 고려사항

1. **인증**: POST 요청은 OWNER 또는 GLOBAL_ADMIN 역할만 허용
2. **Rate Limiting**: 공개 API(GET)는 1분당 10회로 제한
3. **데이터 검증**: 필수 필드(key/id, question, answer) 자동 검증
4. **트랜잭션**: 모든 쓰기 작업은 Prisma $transaction으로 보호

---

## 🚀 다음 단계

### Phase 1b (예상)
- [ ] QaLibrary UI 페이지 구현
- [ ] 카테고리별 탭 네비게이션
- [ ] 검색/필터링 기능 추가
- [ ] 톤별 색상 코딩

### Phase 2 (예상)
- [ ] ChatBot/AI 답변 생성 통합
- [ ] 판매 렌즈별 답변 최적화
- [ ] A/B 테스트 답변 변형
- [ ] 성과 추적 대시보드

---

## ✅ 검증 결과

- **TypeScript**: ✅ 통과 (tsc --noEmit)
- **데이터 무결성**: ✅ 420개 항목 로드 완료
- **API 구조**: ✅ GET/POST 엔드포인트 준비 완료
- **보안**: ✅ 인증/Rate Limiting 구현

---

## 📌 참고

- **소스 파일**: `docs/고객질문리스트/questions_rag_memory_with_tone.json`
- **대상 파일**: `src/lib/data/questions_rag_memory_with_tone.json` (복사됨)
- **API 라우트**: `src/app/api/tools/bot-guide-answers/route.ts`
- **DB 스키마**: BotGuideAnswer 모델 (Prisma)
- **페이지 크기**: 20 항목/페이지 (기본값)

---

**완성일**: 2026-06-16  
**상태**: 배포 준비 완료
