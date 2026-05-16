#!/usr/bin/env node

/**
 * Q&A 라이브러리 데이터 시드 스크립트
 * 275개 Q&A 데이터를 DB에 로드합니다.
 *
 * 사용법:
 * npx ts-node scripts/seed-qa-library.ts
 */

import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";

interface QaData {
  id: string;
  question: string;
  answer: string;
  category: string;
  source: string;
  type: string;
  keywords: string[];
  length: number;
  hash: string;
  sales_tone: {
    primary: string;
    secondary: string[];
    confidence: number;
  };
}

async function seedQaLibrary() {
  try {
    console.log("🚀 Q&A 라이브러리 데이터 로딩 시작...");

    // JSON 파일 로드
    const jsonPath = path.join(
      __dirname,
      "../docs/고객질문리스트/questions_rag_memory_with_tone.json"
    );

    if (!fs.existsSync(jsonPath)) {
      throw new Error(`JSON 파일을 찾을 수 없습니다: ${jsonPath}`);
    }

    const rawData = fs.readFileSync(jsonPath, "utf-8");
    const data = JSON.parse(rawData);

    if (!Array.isArray(data.questions)) {
      throw new Error("JSON 파일의 questions 배열을 찾을 수 없습니다");
    }

    const questions: QaData[] = data.questions;
    console.log(`📊 총 ${questions.length}개 Q&A 데이터 발견`);

    // 기존 데이터 삭제
    console.log("🗑️  기존 데이터 삭제 중...");
    const deleted = await prisma.botGuideAnswer.deleteMany({});
    console.log(`   삭제됨: ${deleted.count}개`);

    // 트랜잭션으로 데이터 삽입
    console.log("💾 데이터 삽입 중...");
    let success = 0;
    let failed = 0;
    const errors: any[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      try {
        // 키 생성
        const key = q.id || `q_${i}`;

        await prisma.botGuideAnswer.upsert({
          where: { key },
          update: {
            question: q.question,
            answer: q.answer,
            category: q.category || "기타",
            type: q.type || "상담기록",
            source: q.source || "ai-generated",
            salesTone: q.sales_tone || {
              primary: "neutral",
              secondary: [],
              confidence: 0,
            },
            keywords: q.keywords || [],
            isActive: true,
          },
          create: {
            key,
            question: q.question,
            answer: q.answer,
            category: q.category || "기타",
            type: q.type || "상담기록",
            source: q.source || "ai-generated",
            salesTone: q.sales_tone || {
              primary: "neutral",
              secondary: [],
              confidence: 0,
            },
            keywords: q.keywords || [],
            isActive: true,
          },
        });

        success++;

        // 진행 상황 표시 (50개마다)
        if ((i + 1) % 50 === 0) {
          console.log(`   진행: ${i + 1}/${questions.length}`);
        }
      } catch (err) {
        failed++;
        errors.push({
          index: i,
          id: q.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    console.log(`\n✅ 완료!`);
    console.log(`   성공: ${success}개`);
    console.log(`   실패: ${failed}개`);

    if (errors.length > 0) {
      console.log(`\n⚠️  에러 (처음 5개):`);
      errors.slice(0, 5).forEach((e) => {
        console.log(`   [${e.index}] ${e.id}: ${e.error}`);
      });
    }

    // 통계
    const stats = await prisma.botGuideAnswer.groupBy({
      by: ["category"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    console.log(`\n📈 카테고리별 통계:`);
    stats.forEach((s) => {
      console.log(`   ${s.category}: ${s._count.id}개`);
    });

    // 판매톤 통계
    const tones = await prisma.$queryRaw<
      Array<{ primary: string; count: number }>
    >`
      SELECT
        salesTone->>'primary' as primary,
        COUNT(*) as count
      FROM "BotGuideAnswer"
      GROUP BY salesTone->>'primary'
      ORDER BY count DESC
    `;

    console.log(`\n🎯 판매톤별 통계:`);
    tones.forEach((t) => {
      console.log(`   ${t.primary}: ${t.count}개`);
    });

    console.log(`\n🎉 데이터 로드 완료!`);
  } catch (error) {
    console.error("❌ 에러 발생:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedQaLibrary();
