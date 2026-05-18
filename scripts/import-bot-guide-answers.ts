/**
 * 세일즈봇 Q&A 데이터 임포트 스크립트
 *
 * 사용법:
 * npx ts-node scripts/import-bot-guide-answers.ts
 * 또는
 * node scripts/import-bot-guide-answers.js
 */

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface QaItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  source: string;
  type: string;
  keywords: string[];
  length?: number;
  hash?: string;
  sales_tone?: {
    primary: string;
    secondary: string[];
    confidence: number;
  };
}

interface RagData {
  version: string;
  updated: string;
  total: number;
  categories: string[];
  questions: QaItem[];
}

async function main() {
  console.log("🚀 세일즈봇 Q&A 데이터 임포트 시작...");

  try {
    // JSON 파일 읽기 - MSC 2026-05 데이터
    let dataPath = path.join(
      __dirname,
      "..",
      "docs/고객질문리스트/questions_rag_msc_2026_05.json"
    );

    // MSC 파일이 없으면 기본 파일 사용
    if (!require("fs").existsSync(dataPath)) {
      dataPath = path.join(
        __dirname,
        "..",
        "docs/고객질문리스트/questions_rag_memory_with_tone.json"
      );
    }

    if (!fs.existsSync(dataPath)) {
      console.error(`❌ 데이터 파일을 찾을 수 없습니다: ${dataPath}`);
      process.exit(1);
    }

    console.log(`📂 데이터 파일 읽기: ${dataPath}`);
    const rawData = fs.readFileSync(dataPath, "utf-8");
    const data = JSON.parse(rawData) as RagData;

    console.log(`📊 데이터 통계:`);
    console.log(`   - 총 Q&A: ${data.total}`);
    console.log(`   - 카테고리: ${data.categories.length}개`);
    console.log(`   - 업데이트: ${data.updated}`);

    // 기존 데이터 확인
    const existingCount = await prisma.botGuideAnswer.count();
    console.log(`📊 기존 DB 데이터: ${existingCount}개`);

    if (existingCount > 0) {
      console.log("⚠️  기존 데이터가 존재합니다.");
      console.log("   - 중복 key는 업데이트됩니다.");
      console.log("   - 새로운 key는 추가됩니다.");
    }

    // 트랜잭션으로 일괄 처리
    console.log(`\n🔄 데이터 업로드 시작...`);

    const result = await prisma.$transaction(async (tx) => {
      const upsertResults: any[] = [];
      const errors: any[] = [];

      for (let i = 0; i < data.questions.length; i++) {
        const item = data.questions[i];

        try {
          // 데이터 검증
          if (!item.question || !item.answer) {
            errors.push({
              index: i,
              id: item.id,
              error: "필수 필드 누락 (question, answer)",
            });
            continue;
          }

          // key 생성: id를 key로 사용
          const key = item.id;

          const record = await tx.botGuideAnswer.upsert({
            where: { key },
            update: {
              question: item.question,
              answer: item.answer,
              category: item.category || "기타",
              type: item.type || "상담기록",
              source: item.source || "ai-generated",
              salesTone: item.sales_tone || {
                primary: "neutral",
                secondary: [],
                confidence: 0,
              },
              keywords: item.keywords || [],
              isActive: true,
              updatedAt: new Date(),
            },
            create: {
              key,
              question: item.question,
              answer: item.answer,
              category: item.category || "기타",
              type: item.type || "상담기록",
              source: item.source || "ai-generated",
              salesTone: item.sales_tone || {
                primary: "neutral",
                secondary: [],
                confidence: 0,
              },
              keywords: item.keywords || [],
              isActive: true,
            },
          });

          upsertResults.push({
            index: i,
            key,
            id: record.id,
            action: "upserted",
          });

          // 진행도 표시
          if ((i + 1) % 50 === 0) {
            console.log(`   ✓ ${i + 1}/${data.total} 처리 중...`);
          }
        } catch (itemError) {
          errors.push({
            index: i,
            id: item.id,
            error:
              itemError instanceof Error ? itemError.message : "Unknown error",
          });
        }
      }

      return { upsertResults, errors };
    });

    console.log(`\n✅ 임포트 완료!`);
    console.log(`   - 성공: ${result.upsertResults.length}개`);
    console.log(`   - 실패: ${result.errors.length}개`);

    if (result.errors.length > 0) {
      console.log(`\n⚠️  오류 발생 목록 (처음 5개):`);
      result.errors.slice(0, 5).forEach((err: any) => {
        console.log(`   - [${err.index}] ${err.id}: ${err.error}`);
      });
    }

    // 카테고리별 통계
    const stats = await prisma.botGuideAnswer.groupBy({
      by: ["category"],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
      where: { isActive: true },
    });

    console.log(`\n📊 카테고리별 Q&A 통계:`);
    for (const stat of stats) {
      console.log(`   - ${stat.category}: ${stat._count.id}개`);
    }

    // 판매톤 분석
    const allData = await prisma.botGuideAnswer.findMany({
      where: { isActive: true },
      select: { salesTone: true },
    });

    const toneStats: Record<string, number> = {};
    for (const record of allData) {
      const tone = (record.salesTone as any).primary || "neutral";
      toneStats[tone] = (toneStats[tone] || 0) + 1;
    }

    console.log(`\n🎯 판매톤 분석:`);
    Object.entries(toneStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([tone, count]) => {
        console.log(`   - ${tone}: ${count}개`);
      });

    console.log(`\n✨ 모든 작업이 완료되었습니다!`);
  } catch (error) {
    console.error("❌ 오류 발생:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
