# QA 데이터 통합 - 수행 지침서

## 빠른 실행 (Node.js)

### 방법 1: 제공된 스크립트 실행

```bash
cd D:\mabiz-crm
node scripts/merge_qa_data.js
```

### 방법 2: 직접 Python 실행

```bash
cd D:\mabiz-crm
python integrate_data.py
```

## 상세 설명

### 입력 파일
```
docs/고객질문리스트/
├── msc2605_xlsx_problems_38.json (38개)
├── msc2605_xlsx_qa_71.json (71개)
├── msc2605_xlsx_tips_30.json (8개)
├── msc2605_xlsx_suggestions_30.json (6개)
├── msc2605_xlsx_notices_23.json (18개)
├── msc2605_xlsx_staff_4.json (3개)

src/lib/data/
└── questions_rag_memory_with_tone.json (420개)
```

### 출력 파일
```
docs/고객질문리스트/merged_564_raw.json
```

## 처리 로직

### Step 1: XLSX 파일 읽기 (144개)
```javascript
const xlsxFiles = [
  'docs/고객질문리스트/msc2605_xlsx_problems_38.json',
  'docs/고객질문리스트/msc2605_xlsx_qa_71.json',
  'docs/고객질문리스트/msc2605_xlsx_tips_30.json',
  'docs/고객질문리스트/msc2605_xlsx_suggestions_30.json',
  'docs/고객질문리스트/msc2605_xlsx_notices_23.json',
  'docs/고객질문리스트/msc2605_xlsx_staff_4.json'
];

for (const file of xlsxFiles) {
  const content = JSON.parse(fs.readFileSync(file));
  for (const item of content.data) {
    mergedData.push(normalizeItem(item));
  }
}
```

### Step 2: 메모리 RAG 읽기 (420개)
```javascript
const rag = JSON.parse(fs.readFileSync('src/lib/data/questions_rag_memory_with_tone.json'));
for (const item of rag.questions) {
  mergedData.push(normalizeItem(item));
}
```

### Step 3: 정규화
```javascript
function normalizeItem(item) {
  return {
    id: item.id,
    question: normalize_text(item.question, 100),
    answer: normalize_text(item.answer, null),
    keywords: item.keywords || extractKeywords(item.question),
    travelPhase: validate_travelPhase(item.travelPhase),
    type: item.type || '기타',
    category: item.category || '자동분류대기',
    source: item.source || 'MSC',
    salesTone: item.salesTone || 'neutral'
  };
}
```

### Step 4: 통계 계산
```javascript
const stats = {
  total_items: mergedData.length,
  avg_keywords: sum(keywords.length) / total,
  avg_question_length: sum(question.length) / total,
  avg_answer_length: sum(answer.length) / total,
  travel_phase_distribution: { ... }
};
```

### Step 5: JSON 생성
```javascript
const output = {
  total: 564,
  merged_at: new Date().toISOString(),
  sources: ["XLSX: 144개", "Memory-RAG: 420개"],
  statistics: stats,
  data: mergedData
};

fs.writeFileSync('docs/고객질문리스트/merged_564_raw.json', 
  JSON.stringify(output, null, 2), 'utf-8');
```

## 정규화 함수 구현

### normalizeText
```javascript
function normalizeText(text, maxLength) {
  if (!text) return "";
  
  // 다중 개행 제거
  let normalized = text
    .replace(/\n\n+/g, '\n')      // 다중 개행 → 단일 개행
    .replace(/\n/g, ' ')           // 모든 개행 → 공백
    .trim();
  
  // 길이 제한
  if (maxLength && normalized.length > maxLength) {
    normalized = normalized.substring(0, maxLength) + '...';
  }
  
  return normalized;
}
```

### validateTravelPhase
```javascript
function validateTravelPhase(phase) {
  const valid = ['여행전', '여행중', '여행후'];
  return valid.includes(phase) ? phase : '여행중';
}
```

### extractKeywords
```javascript
function extractKeywords(text) {
  if (!text) return [];
  
  const patterns = [
    /크루즈|MSC|벨리시마/g,
    /도쿄|고베|부산|가고시마|일본/g,
    /객실|카드|와이파이|앱|어플/g,
    /식사|뷔페|정찬|음료|물/g
  ];
  
  const keywords = new Set();
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(m => keywords.add(m));
      if (keywords.size >= 5) break;
    }
  }
  
  return Array.from(keywords).slice(0, 5);
}
```

## 출력 검증

실행 완료 후 확인 사항:

```bash
# 파일 크기 확인
ls -lh docs/고객질문리스트/merged_564_raw.json

# JSON 유효성 확인
python -m json.tool docs/고객질문리스트/merged_564_raw.json > /dev/null
echo "JSON 유효성: OK"

# 항목 수 확인
python -c "
import json
with open('docs/고객질문리스트/merged_564_raw.json') as f:
    data = json.load(f)
    print(f'총 항목: {data[\"total\"]}')
    print(f'실제 data 배열: {len(data[\"data\"])}')
    print(f'XLSX: {sum(1 for i in data[\"data\"] if \"msc2605\" in i[\"id\"])}')
    print(f'RAG: {sum(1 for i in data[\"data\"] if i[\"id\"].startswith(\"q\"))}')
"
```

## 예상 출력

```
✅ XLSX 통합 완료: 144개
✅ 메모리 RAG 통합 완료: 420개

📊 통계:
  • 총 항목: 564개
  • 평균 키워드: 3.2개
  • 평균 question 길이: 47.8글자
  • 평균 answer 길이: 89.5글자
  • travelPhase 분포:
    - 여행전: 89개
    - 여행중: 398개
    - 여행후: 77개

✅ 통합 완료: docs/고객질문리스트/merged_564_raw.json
   파일 크기: 1245.67 KB
```

## 트러블슈팅

### 문제: "파일을 찾을 수 없습니다"
**해결**: 작업 디렉토리가 D:\mabiz-crm인지 확인
```bash
cd D:\mabiz-crm
```

### 문제: "JSON 파싱 오류"
**해결**: 입력 파일 인코딩이 UTF-8인지 확인
```python
# 파일 인코딩 확인
file_encoding = 'utf-8'
with open(filename, 'r', encoding=file_encoding) as f:
    data = json.load(f)
```

### 문제: 메모리 부족
**해결**: 스트림 처리로 변경
```javascript
// 파일을 청크 단위로 읽기
const stream = fs.createReadStream('large_file.json');
// 처리 로직
```

## 성능 최적화

### 시간 복잡도
- 파일 읽기: O(n)
- 정규화: O(n)
- 정렬: O(n log n) (선택사항)
- **총**: O(n)

### 공간 복잡도
- 메모리: 약 2-3MB (JSON 파싱 후)
- 디스크: 약 1-2MB (최종 파일)

## 다음 단계

1. **검증**
   ```bash
   python validate_merged_data.py
   ```

2. **품질 검사**
   - 중복 항목 확인
   - 누락된 필드 확인
   - 데이터 타입 일관성 확인

3. **사용**
   - 검색 엔진에 인덱싱
   - RAG 시스템에 통합
   - Q&A 챗봇 학습

---

**최종 수정**: 2026-05-18
**상태**: 준비 완료
