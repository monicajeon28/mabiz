#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function loadQaData() {
  try {
    console.log('🚀 Q&A 데이터 로드 시작...');

    // Load JSON data
    const jsonPath = path.join(__dirname, 'src/lib/data/questions_rag_memory_with_tone.json');
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const { questions } = JSON.parse(rawData);

    console.log(`📊 로드할 데이터: ${questions.length}개 항목`);

    let succeeded = 0;
    let failed = 0;

    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);

      for (const q of batch) {
        try {
          await prisma.botGuideAnswer.upsert({
            where: { key: q.id },
            update: {
              question: q.question,
              answer: q.answer,
              category: q.category,
              type: q.type,
              source: q.source,
              salesTone: q.sales_tone || { primary: 'neutral', secondary: [], confidence: 0 },
              keywords: q.keywords || [],
              isActive: true,
            },
            create: {
              key: q.id,
              question: q.question,
              answer: q.answer,
              category: q.category,
              type: q.type,
              source: q.source,
              salesTone: q.sales_tone || { primary: 'neutral', secondary: [], confidence: 0 },
              keywords: q.keywords || [],
              isActive: true,
            },
          });
          succeeded++;
        } catch (err) {
          console.error(`❌ 항목 ${q.id} 실패:`, err.message);
          failed++;
        }
      }

      console.log(`⏳ 진행: ${Math.min(i + batchSize, questions.length)}/${questions.length}`);
    }

    console.log(`\n✅ 완료!`);
    console.log(`  성공: ${succeeded}개`);
    console.log(`  실패: ${failed}개`);

  } catch (err) {
    console.error('💥 오류:', err);
  } finally {
    await prisma.$disconnect();
  }
}

loadQaData();
