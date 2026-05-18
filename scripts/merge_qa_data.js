const fs = require('fs');
const path = require('path');

async function mergeQAData() {
  try {
    // 6개 XLSX 파일 경로
    const xlsxFiles = [
      'docs/고객질문리스트/msc2605_xlsx_problems_38.json',
      'docs/고객질문리스트/msc2605_xlsx_qa_71.json',
      'docs/고객질문리스트/msc2605_xlsx_tips_30.json',
      'docs/고객질문리스트/msc2605_xlsx_suggestions_30.json',
      'docs/고객질문리스트/msc2605_xlsx_notices_23.json',
      'docs/고객질문리스트/msc2605_xlsx_staff_4.json'
    ];

    const ragFile = 'src/lib/data/questions_rag_memory_with_tone.json';

    // XLSX 파일들 통합
    console.log('📖 XLSX 파일 읽기 시작...');
    const mergedData = [];
    let xlsxCount = 0;

    for (const file of xlsxFiles) {
      const filePath = path.join(process.cwd(), file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      console.log(`  ✓ ${path.basename(file)}: ${content.items}개`);

      for (const item of content.data) {
        mergedData.push(normalizeItem(item));
        xlsxCount++;
      }
    }

    console.log(`✅ XLSX 통합 완료: ${xlsxCount}개\n`);

    // 메모리 RAG 파일 통합
    console.log('📖 메모리 RAG 파일 읽기 시작...');
    const ragPath = path.join(process.cwd(), ragFile);
    const ragContent = JSON.parse(fs.readFileSync(ragPath, 'utf-8'));
    console.log(`  ✓ 메모리 RAG: ${ragContent.total}개`);

    let ragCount = 0;
    for (const item of ragContent.questions) {
      // 메모리 RAG 형식 정규화
      const normalized = {
        id: item.id,
        question: normalizeText(item.question, 100),
        answer: normalizeText(item.answer, null),
        keywords: item.keywords || extractKeywords(item.question),
        travelPhase: validateTravelPhase(item.travelPhase || '여행중'),
        type: item.type || '상담기록',
        category: item.category || '자동분류대기',
        source: item.source || 'MSC벨리시마',
        salesTone: item.sales_tone?.primary || 'neutral'
      };
      mergedData.push(normalized);
      ragCount++;
    }

    console.log(`✅ 메모리 RAG 통합 완료: ${ragCount}개\n`);

    // 통계 계산
    const totalCount = xlsxCount + ragCount;
    const stats = calculateStats(mergedData);

    // 출력 파일 생성
    const output = {
      total: totalCount,
      merged_at: new Date().toISOString(),
      sources: [
        `XLSX: ${xlsxCount}개`,
        `Memory-RAG: ${ragCount}개`
      ],
      statistics: stats,
      data: mergedData
    };

    const outputPath = path.join(process.cwd(), 'docs/고객질문리스트/merged_564_raw.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

    console.log('📊 통계:');
    console.log(`  • 총 항목: ${totalCount}개`);
    console.log(`  • 평균 키워드: ${stats.avgKeywords.toFixed(2)}개`);
    console.log(`  • 평균 question 길이: ${stats.avgQuestionLength.toFixed(1)}글자`);
    console.log(`  • 평균 answer 길이: ${stats.avgAnswerLength.toFixed(1)}글자`);
    console.log(`  • travelPhase 분포:`);
    Object.entries(stats.travelPhaseDist).forEach(([phase, count]) => {
      console.log(`    - ${phase}: ${count}개`);
    });

    console.log(`\n✅ 통합 완료: ${outputPath}`);
    console.log(`   파일 크기: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  }
}

function normalizeItem(item) {
  return {
    id: item.id,
    question: normalizeText(item.question, 100),
    answer: normalizeText(item.answer, null),
    keywords: Array.isArray(item.keywords) ? item.keywords : extractKeywords(item.question),
    travelPhase: validateTravelPhase(item.travelPhase),
    type: item.type || '기타',
    category: item.category || '자동분류대기',
    source: item.source || 'MSC벨리시마',
    salesTone: item.salesTone || 'neutral'
  };
}

function normalizeText(text, maxLength) {
  if (!text) return '';
  // 개행 정규화, 공백 정리
  let normalized = text
    .replace(/\n\n+/g, '\n')
    .replace(/\n/g, ' ')
    .trim();

  if (maxLength && normalized.length > maxLength) {
    normalized = normalized.substring(0, maxLength) + '...';
  }
  return normalized;
}

function validateTravelPhase(phase) {
  const valid = ['여행전', '여행중', '여행후'];
  return valid.includes(phase) ? phase : '여행중';
}

function extractKeywords(text) {
  if (!text) return [];
  // 간단한 키워드 추출: 명사 패턴
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

function calculateStats(data) {
  const stats = {
    avgKeywords: 0,
    avgQuestionLength: 0,
    avgAnswerLength: 0,
    travelPhaseDist: {
      '여행전': 0,
      '여행중': 0,
      '여행후': 0
    }
  };

  let totalKeywords = 0;
  let totalQuestionLength = 0;
  let totalAnswerLength = 0;

  for (const item of data) {
    totalKeywords += (item.keywords?.length || 0);
    totalQuestionLength += (item.question?.length || 0);
    totalAnswerLength += (item.answer?.length || 0);
    stats.travelPhaseDist[item.travelPhase]++;
  }

  stats.avgKeywords = totalKeywords / data.length;
  stats.avgQuestionLength = totalQuestionLength / data.length;
  stats.avgAnswerLength = totalAnswerLength / data.length;

  return stats;
}

mergeQAData();
