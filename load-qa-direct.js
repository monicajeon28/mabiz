#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');

// Import Prisma client
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function loadQaData() {
  try {
    console.log('🚀 Loading 275 Q&A items directly to database...');

    // Load Q&A JSON data
    const qaFilePath = path.join(__dirname, 'src/lib/data/questions_rag_memory_with_tone.json');
    const qaContent = fs.readFileSync(qaFilePath, 'utf-8');
    const qaData = JSON.parse(qaContent);

    let itemsToLoad = qaData.questions || qaData;
    if (!Array.isArray(itemsToLoad)) {
      itemsToLoad = Object.values(itemsToLoad);
    }

    console.log(`📋 Found ${itemsToLoad.length} Q&A items to load`);

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (const item of itemsToLoad) {
      try {
        if (!item.key || !item.question || !item.answer) {
          failCount++;
          errors.push({ key: item.id || item.key, error: 'Missing required fields' });
          continue;
        }

        const key = item.key || item.id || `qa-${item.id}`;

        await prisma.botGuideAnswer.upsert({
          where: { key },
          create: {
            key,
            question: item.question,
            answer: item.answer,
            category: item.category || '기타',
            type: item.type || '상담기록',
            source: item.source || 'ai-generated',
            salesTone: item.sales_tone || item.salesTone || {
              primary: 'neutral',
              secondary: [],
              confidence: 0,
            },
            keywords: item.keywords || [],
            isActive: true,
          },
          update: {
            question: item.question,
            answer: item.answer,
            category: item.category || '기타',
            type: item.type || '상담기록',
            source: item.source || 'ai-generated',
            salesTone: item.sales_tone || item.salesTone || {
              primary: 'neutral',
              secondary: [],
              confidence: 0,
            },
            keywords: item.keywords || [],
            isActive: true,
          },
        });

        successCount++;
        if (successCount % 50 === 0) {
          console.log(`  ✓ Loaded ${successCount}/${itemsToLoad.length}...`);
        }
      } catch (itemError) {
        failCount++;
        errors.push({
          key: item.key || item.id,
          error: itemError.message || String(itemError),
        });
      }
    }

    console.log(`\n✅ Complete!`);
    console.log(`   Succeeded: ${successCount}/${itemsToLoad.length}`);
    console.log(`   Failed: ${failCount}`);

    if (errors.length > 0 && errors.length <= 5) {
      console.log(`\n❌ Errors:`);
      errors.forEach(e => console.log(`   ${e.key}: ${e.error}`));
    }

    console.log(`\n📚 Q&A Library ready! Visit http://localhost:3000/tools to see data`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to load Q&A data:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

loadQaData();
