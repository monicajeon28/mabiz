# 세일즈봇 Q&A API 테스트 가이드

## 개요
- **총 Q&A**: 275개
- **카테고리**: 8개 (기타, 정책&수수료, 탑승&수속, 기술&앱, 식사&음료, 선상활동, 객실&카드, 기항지&투어)
- **데이터 출처**: questions_rag_memory_with_tone.json

## API 엔드포인트

### 1. POST /api/tools/bot-guide-answers
**275개 Q&A 일괄 업로드**

#### 기본 동작 (기본값 JSON 파일 사용)
```bash
curl -X POST http://localhost:3000/api/tools/bot-guide-answers
```

#### 요청 본문 (선택사항)
```json
{
  "data": [
    {
      "id": "q0001",
      "key": "q0001",
      "question": "크루즈닷 MSC 5/10 크루즈 여행은?",
      "answer": "크루즈닷 MSC 5/10 크루즈 여행에 대한 안내입니다.",
      "category": "기타",
      "type": "상담기록",
      "source": "MSC벨리시마.txt",
      "sales_tone": {
        "primary": "neutral",
        "secondary": [],
        "confidence": 0
      },
      "keywords": ["크루즈닷", "MSC", "여행"]
    }
  ],
  "mode": "upsert",
  "confirm": false
}
```

#### 응답 (성공)
```json
{
  "ok": true,
  "message": "275개 데이터 처리 완료 (실패: 0)",
  "total": 275,
  "succeeded": 275,
  "failed": 0,
  "deletedCount": 0,
  "results": [
    {
      "key": "q0001",
      "id": 1,
      "action": "upserted"
    }
  ],
  "errors": []
}
```

#### 주요 파라미터
- `mode`: "upsert" (기본값) 또는 "replace"
  - `upsert`: 기존 데이터는 업데이트, 새로운 데이터는 추가
  - `replace`: 전체 데이터 삭제 후 새로 로드 (confirm: true 필수)
- `confirm`: replace 모드 사용시 true 필수

---

### 2. GET /api/tools/bot-guide-answers
**Q&A 검색 API**

#### 전체 조회 (활성 데이터만)
```bash
curl "http://localhost:3000/api/tools/bot-guide-answers?page=1&limit=20"
```

#### 카테고리 필터
```bash
curl "http://localhost:3000/api/tools/bot-guide-answers?category=정책%26수수료&limit=10"
```

#### 키워드 검색
```bash
curl "http://localhost:3000/api/tools/bot-guide-answers?q=크루즈&limit=20"
```

#### 판매톤 필터
```bash
curl "http://localhost:3000/api/tools/bot-guide-answers?tone=friendly&limit=20"
```

#### 복합 검색
```bash
curl "http://localhost:3000/api/tools/bot-guide-answers?category=탑승%26수속&q=수속&tone=professional&page=1&limit=10"
```

#### 응답 (성공)
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "key": "q0001",
      "question": "크루즈닷 MSC 5/10 크루즈 여행은?",
      "answer": "크루즈닷 MSC 5/10 크루즈 여행에 대한 안내입니다.",
      "category": "기타",
      "type": "상담기록",
      "source": "MSC벨리시마.txt",
      "salesTone": {
        "primary": "neutral",
        "secondary": [],
        "confidence": 0
      },
      "keywords": ["크루즈닷", "MSC", "여행"],
      "createdAt": "2026-05-17T00:30:00.000Z",
      "updatedAt": "2026-05-17T00:30:00.000Z"
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasMore": false
  }
}
```

#### 쿼리 파라미터
- `q`: 키워드 검색 (질문/답변/키워드 포함)
- `category`: 카테고리 필터 (정확한 일치)
- `tone`: 판매톤 필터 (primary 또는 secondary)
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 한 페이지당 항목 수 (기본값: 20)

---

### 3. GET /api/tools/bot-guide-answers/[key]
**특정 Q&A 조회**

#### 요청
```bash
curl "http://localhost:3000/api/tools/bot-guide-answers/q0001"
```

#### 응답 (성공)
```json
{
  "ok": true,
  "data": {
    "id": 1,
    "key": "q0001",
    "question": "크루즈닷 MSC 5/10 크루즈 여행은?",
    "answer": "크루즈닷 MSC 5/10 크루즈 여행에 대한 안내입니다.",
    "category": "기타",
    "type": "상담기록",
    "source": "MSC벨리시마.txt",
    "salesTone": {
      "primary": "neutral",
      "secondary": [],
      "confidence": 0
    },
    "keywords": ["크루즈닷", "MSC", "여행"],
    "isActive": true,
    "createdAt": "2026-05-17T00:30:00.000Z",
    "updatedAt": "2026-05-17T00:30:00.000Z"
  }
}
```

#### 응답 (실패: 404)
```json
{
  "ok": false,
  "message": "데이터를 찾을 수 없습니다."
}
```

---

### 4. PUT /api/tools/bot-guide-answers/[key]
**특정 Q&A 수정**

#### 요청
```bash
curl -X PUT http://localhost:3000/api/tools/bot-guide-answers/q0001 \
  -H "Content-Type: application/json" \
  -d '{
    "question": "수정된 질문?",
    "answer": "수정된 답변입니다.",
    "category": "탑승&수속",
    "isActive": true
  }'
```

#### 응답 (성공)
```json
{
  "ok": true,
  "message": "수정 완료",
  "data": {
    "id": 1,
    "key": "q0001",
    "question": "수정된 질문?",
    "answer": "수정된 답변입니다.",
    "category": "탑승&수속",
    "type": "상담기록",
    "source": "MSC벨리시마.txt",
    "salesTone": {
      "primary": "neutral",
      "secondary": [],
      "confidence": 0
    },
    "keywords": ["크루즈닷"],
    "isActive": true,
    "createdAt": "2026-05-17T00:30:00.000Z",
    "updatedAt": "2026-05-17T00:35:00.000Z"
  }
}
```

#### 수정 가능한 필드
- `question`: 질문
- `answer`: 답변
- `category`: 카테고리
- `type`: 타입
- `source`: 출처
- `salesTone`: 판매톤 객체
- `keywords`: 키워드 배열
- `isActive`: 활성 여부

---

### 5. DELETE /api/tools/bot-guide-answers/[key]
**특정 Q&A 삭제**

#### 소프트 삭제 (기본값, isActive = false)
```bash
curl -X DELETE http://localhost:3000/api/tools/bot-guide-answers/q0001
```

#### 응답
```json
{
  "ok": true,
  "message": "삭제 완료 (소프트 삭제)",
  "deleted": false,
  "note": "hard=true 파라미터로 완전 삭제 가능"
}
```

#### 하드 삭제 (DB에서 완전 제거)
```bash
curl -X DELETE "http://localhost:3000/api/tools/bot-guide-answers/q0001?hard=true"
```

#### 응답
```json
{
  "ok": true,
  "message": "완전 삭제 완료",
  "deleted": true
}
```

---

## 카테고리 목록

| 카테고리 | 설명 |
|---------|------|
| 기타 | 분류되지 않은 항목 |
| 정책&수수료 | 수수료, 정책 관련 |
| 탑승&수속 | 탑승, 수속 절차 |
| 기술&앱 | 기술 지원, 앱 사용 |
| 식사&음료 | 음식, 음료 관련 |
| 선상활동 | 크루즈 선상 활동 |
| 객실&카드 | 객실 정보, 카드 |
| 기항지&투어 | 항구, 투어 |

---

## 판매톤 종류

| 톤 | 설명 |
|----|------|
| neutral | 중립적, 정중한 톤 |
| friendly | 친절하고 따뜻한 톤 |
| professional | 전문적인 톤 |
| casual | 캐주얼한 톤 |
| urgent | 긴급한 톤 |
| emphatic | 강조하는 톤 |

---

## 데이터 임포트 스크립트

### Node.js 스크립트 실행
```bash
# TypeScript 직접 실행
npx ts-node scripts/import-bot-guide-answers.ts

# 컴파일 후 실행 (Node.js 필수)
npx tsc scripts/import-bot-guide-answers.ts --outDir . --target es2020 --module commonjs
node scripts/import-bot-guide-answers.js
```

### 스크립트 출력 예시
```
🚀 세일즈봇 Q&A 데이터 임포트 시작...
📂 데이터 파일 읽기: D:\mabiz-crm\docs\고객질문리스트\questions_rag_memory_with_tone.json
📊 데이터 통계:
   - 총 Q&A: 275개
   - 카테고리: 8개
   - 업데이트: 2026-05-16

🔄 데이터 업로드 시작...
   ✓ 50/275 처리 중...
   ✓ 100/275 처리 중...
   ✓ 150/275 처리 중...
   ✓ 200/275 처리 중...
   ✓ 250/275 처리 중...

✅ 임포트 완료!
   - 성공: 275개
   - 실패: 0개

📊 카테고리별 Q&A 통계:
   - 탑승&수속: 45개
   - 객실&카드: 38개
   - 식사&음료: 35개
   - 기항지&투어: 32개
   - 정책&수수료: 28개
   - 선상활동: 25개
   - 기술&앱: 22개
   - 기타: 50개

🎯 판매톤 분석:
   - neutral: 150개
   - friendly: 80개
   - professional: 45개

✨ 모든 작업이 완료되었습니다!
```

---

## 성능 최적화 팁

### 1. 검색 최적화
- `category` 인덱스: O(log n) 성능
- `isActive, category` 복합 인덱스: 기본 쿼리 최적화
- `category, updatedAt` 인덱스: 정렬 쿼리 최적화

### 2. 페이지네이션
```bash
# 첫 페이지
curl "http://localhost:3000/api/tools/bot-guide-answers?page=1&limit=20"

# 두 번째 페이지
curl "http://localhost:3000/api/tools/bot-guide-answers?page=2&limit=20"
```

### 3. 벌크 작업
- POST로 275개 데이터를 한 번에 업로드하면 트랜잭션으로 처리됩니다.
- 개별 수정/삭제는 필요시 한 건씩 처리하세요.

---

## 에러 처리

### 400 Bad Request
```json
{
  "ok": false,
  "message": "유효한 데이터 배열이 필요합니다."
}
```

### 404 Not Found
```json
{
  "ok": false,
  "message": "데이터를 찾을 수 없습니다."
}
```

### 500 Internal Server Error
```json
{
  "ok": false,
  "message": "업로드 중 오류가 발생했습니다."
}
```

---

## 테스트 체크리스트

- [ ] POST로 275개 데이터 업로드 성공
- [ ] GET으로 전체 데이터 조회 (페이지네이션)
- [ ] 카테고리별 필터링 테스트
- [ ] 키워드 검색 테스트
- [ ] 판매톤 필터 테스트
- [ ] 특정 Q&A 조회 성공
- [ ] PUT으로 데이터 수정 성공
- [ ] DELETE로 소프트 삭제 성공
- [ ] DELETE hard=true로 하드 삭제 성공
- [ ] 카테고리별 통계 정확성 확인
- [ ] 판매톤 분석 정확성 확인

---

## 데이터 흐름도

```
questions_rag_memory_with_tone.json (275개 Q&A)
        ↓
[API: POST /bot-guide-answers]
        ↓
[Prisma Transaction]
        ↓
[PostgreSQL: BotGuideAnswer 테이블]
        ↓
[API: GET /bot-guide-answers] → 검색/필터링
[API: GET /bot-guide-answers/:key] → 상세 조회
[API: PUT /bot-guide-answers/:key] → 수정
[API: DELETE /bot-guide-answers/:key] → 삭제
```

---

## 추가 정보

- **DB 테이블**: BotGuideAnswer
- **주요 필드**: id(Int, PK), key(String, Unique), question, answer, category, salesTone(JSON), keywords(JSON)
- **인덱스**: isActive+category, category+updatedAt, key+isActive
- **활성 여부**: isActive (기본값 true)
- **마이그레이션**: /prisma/migrations/20260517_bot_guide_answer_schema
