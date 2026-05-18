const fs = require('fs');
const path = require('path');

// 불용어 목록
const STOPWORDS = new Set([
  '이', '것', '수', '등', '안', '꼭', '다', '을', '를', '가', '에', '에서',
  '으로', '로', '한', '하', '되', '있', '같', '보', '주', '나', '더', '말', '년', '월',
  '일', '님', '분', '사람', '경우', '필요', '하다', '있다', '되다', '있으면', '없다',
  '좋다', '싶다', '가능하다', '않다', '없으면', '아니다', '맞다', '받다', '내다',
  'msc', 'msw', 'rccl', '크루즈', '할', '수있', '한번', '때문', '있어', '되어',
  '잠깐', '저녁', '점심', '아침', '시간', '방법', '가지', '제공', '사용', '포함',
  '반영', '완성', '공유', '업데이트', '추가', '확인', '검증'
]);

// 카테고리별 주요 키워드
const CATEGORY_KEYWORDS = {
  '탑승&수속': ['탑승', '수속', '출입', '승선', '탑승수속'],
  '객실&카드': ['객실', '카드', '캐빈', '선실', '오션뷰'],
  '식사&음료': ['식사', '음료', '레스토랑', '다이닝', '식당'],
  '선상활동': ['활동', '공연', '풀', '스파', '오락'],
  '기항지&투어': ['기항지', '투어', '관광', '포트', '하선'],
  '정책&수수료': ['정책', '수수료', '환불', '취소', '비용'],
  '기술&앱': ['앱', '기술', '예약', '결제', '시스템'],
  '기타': ['정보', '안내'],
  '자동분류대기': ['정보', '안내']
};

// 한글 단어 추출 (3글자 이상)
function extractKoreanWords(text) {
  if (!text) return [];
  const koreanPattern = /[가-힣]{3,}/g;
  return text.match(koreanPattern) || [];
}

// 불용어 제거 및 중복 제거
function cleanKeywords(keywords, maxKeywords = 5) {
  if (!keywords || keywords.length === 0) return [];

  const cleaned = [];
  const seen = new Set();

  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    if (!STOPWORDS.has(kwLower) && !STOPWORDS.has(kw)) {
      if (!seen.has(kwLower)) {
        cleaned.push(kw);
        seen.add(kwLower);
      }
    }
  }

  return cleaned.slice(0, maxKeywords);
}

// 항목에서 키워드 추출
function extractKeywordsFromItem(item) {
  const question = item.question || '';
  const answer = item.answer || '';
  const category = item.category || '';

  // question과 answer에서 단어 추출
  const qWords = extractKoreanWords(question);
  const aWords = extractKoreanWords(answer);

  // 합치기 (question 우선)
  const allWords = [...qWords, ...aWords];

  // 빈도 계산
  const wordFreq = {};
  for (const word of allWords) {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  }

  // 빈도로 정렬
  const sortedWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);

  // 불용어 제거 및 정제 (4개까지)
  const cleaned = cleanKeywords(sortedWords, 4);

  // 카테고리 키워드 추가
  if (CATEGORY_KEYWORDS[category]) {
    const catWords = CATEGORY_KEYWORDS[category];
    for (const cw of catWords) {
      if (!cleaned.includes(cw) && cleaned.length < 5) {
        cleaned.push(cw);
      }
    }
  }

  return cleaned.slice(0, 5);
}

// 모든 JSON 파일 로드
const jsonFiles = [
  'docs/고객질문리스트/questions_rag_memory.json',
  'docs/고객질문리스트/questions_rag_msc_2026_05.json',
  'docs/고객질문리스트/msc_2026_05_qa.json',
  'docs/고객질문리스트/msc2605_xlsx_problems_38.json',
  'docs/고객질문리스트/msc2605_xlsx_qa_71.json',
  'docs/고객질문리스트/msc2605_xlsx_tips_30.json',
  'docs/고객질문리스트/msc2605_xlsx_suggestions_30.json',
  'docs/고객질문리스트/msc2605_xlsx_notices_23.json',
  'docs/고객질문리스트/msc2605_xlsx_staff_4.json',
];

let allQuestions = [];
const sourceCount = {};

for (const jsonFile of jsonFiles) {
  try {
    const data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));

    let items = [];
    if (Array.isArray(data)) {
      items = data;
    } else if (data.questions && Array.isArray(data.questions)) {
      items = data.questions;
    } else if (data.data && Array.isArray(data.data)) {
      items = data.data;
    }

    for (const item of items) {
      if (typeof item === 'object' && (item.question || item.answer)) {
        allQuestions.push(item);
        sourceCount[jsonFile] = (sourceCount[jsonFile] || 0) + 1;
      }
    }
  } catch (e) {
    console.error(`Error loading ${jsonFile}:`, e.message);
  }
}

console.log(`Total items loaded: ${allQuestions.length}`);
console.log(`Source breakdown:`, sourceCount);

// 키워드 추출
const optimizedData = [];
const allKeywords = [];

for (const item of allQuestions) {
  const keywords = extractKeywordsFromItem(item);
  allKeywords.push(...keywords);

  const newItem = { ...item, keywords };
  optimizedData.push(newItem);
}

// 통계 계산
const keywordFreq = {};
for (const kw of allKeywords) {
  keywordFreq[kw] = (keywordFreq[kw] || 0) + 1;
}

const uniqueKeywords = Object.keys(keywordFreq).length;
const avgKeywords = (allKeywords.length / optimizedData.length).toFixed(2);
const topKeywords = Object.entries(keywordFreq)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([kw]) => kw);

// 결과 JSON 생성
const result = {
  total: optimizedData.length,
  keyword_stats: {
    avg_keywords_per_item: parseFloat(avgKeywords),
    unique_keywords: uniqueKeywords,
    top_keywords: topKeywords,
    top_keywords_with_count: {}
  },
  data: optimizedData
};

// 상위 10개 키워드의 카운트
for (const kw of topKeywords) {
  result.keyword_stats.top_keywords_with_count[kw] = keywordFreq[kw];
}

// 파일 저장
const outputFile = 'docs/고객질문리스트/optimized_keywords_564.json';
fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf-8');

console.log(`\nOptimization complete!`);
console.log(`Total items: ${result.total}`);
console.log(`Average keywords per item: ${result.keyword_stats.avg_keywords_per_item}`);
console.log(`Unique keywords: ${result.keyword_stats.unique_keywords}`);
console.log(`Top 10 keywords: ${result.keyword_stats.top_keywords.join(', ')}`);
console.log(`\nOutput saved to: ${outputFile}`);
