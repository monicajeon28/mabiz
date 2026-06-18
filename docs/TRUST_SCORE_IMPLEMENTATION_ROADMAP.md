# 신뢰도 시스템 구현 로드맵 (Product + Dev)

**작성일**: 2026-06-19 | **버전**: 1.0 | **담당**: Product + Engineering + Legal

> 이 문서는 법률 가이드(`TRUST_SCORE_LEGAL_GUIDE.md`)와 함께 읽으세요.
> 법률 검토 완료 후 개발을 시작합니다.

---

## 📋 전체 일정 (PHASE별)

```
┌─────────────────────────────────────────┐
│ PHASE 1: 법률 준비 (06-19 ~ 07-06)     │
│ • 약관 작성 + 변호사 검토              │
│ • 공지 이메일 + 앱 공지 준비           │
│ → 결과: 변호사 OK 승인서                │
├─────────────────────────────────────────┤
│ PHASE 2: 개발 준비 (07-07 ~ 07-12)     │
│ • DB 스키마 추가                        │
│ • API 구현 (계산 로직)                 │
│ • UI 개발 (대시보드)                    │
│ • QA & 테스트 (3일)                     │
├─────────────────────────────────────────┤
│ PHASE 3: 사용자 공지 (07-13 ~ 07-18)   │
│ • 이메일 발송: "변호사 OK 공지"        │
│ • 앱 배너 노출 + 동의 수집              │
│ • 최종 점검                             │
├─────────────────────────────────────────┤
│ PHASE 4: 시행 & 모니터링 (07-19 ~)    │
│ • 첫 신뢰도 점수 계산                  │
│ • 경고 파트너 알림 + 관리              │
│ • 이의 제기 처리                        │
│ • 주간 리포트                           │
└─────────────────────────────────────────┘
```

---

## 🗄️ PHASE 2-1: DB 스키마 추가

### 1. Partner 모델 확장

**추가할 필드** (기존 `partner.ts`에 추가):

```prisma
model Partner {
  // 기존 필드들...
  
  // 신뢰도 시스템 필드 (NEW)
  trustScoreCurrent    Int       @default(100) // 현재 신뢰도 점수 (0-120)
  trustScoreHistory    TrustScoreHistory[] // 점수 변동 이력
  trustScoreUpdatedAt  DateTime? @updatedAt @db.Timestamptz(6)
  
  // 환불율 추적
  refundRateMonthly    Decimal?  @db.Decimal(5, 2) // 이번달 환불율 (%)
  refundRateLastMonth  Decimal?  @db.Decimal(5, 2) // 지난달 환불율 (%)
  refundRateAvg3M      Decimal?  @db.Decimal(5, 2) // 3개월 평균 (%)
  
  // 약관 위반 추적
  violationCount       Int       @default(0) // 누적 위반 횟수
  violationHistory     Violation[] // 위반 이력
  
  // 신뢰도 상태
  trustStatus          String    @default("GREEN") // "GREEN" | "YELLOW" | "RED" | "BLACK"
  trustStatusUpdatedAt DateTime? @db.Timestamptz(6)
  
  // 이의 제기
  objections           Objection[] // 이의 제기 기록
}

// 신뢰도 점수 변동 이력
model TrustScoreHistory {
  id            String   @id @default(cuid())
  partnerId     String
  partner       Partner  @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  
  previousScore Int      // 변경 전 점수
  currentScore  Int      // 변경 후 점수
  reason        String   // 변경 원인 ("환불율", "판매보너스", "약관위반" 등)
  details       Json?    // 상세정보 {"refundRate": 35, "deductedPoints": 10, ...}
  
  createdAt     DateTime @default(now()) @db.Timestamptz(6)
  
  @@index([partnerId, createdAt])
}

// 약관 위반 기록
model Violation {
  id          String   @id @default(cuid())
  partnerId   String
  partner     Partner  @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  
  violationType String  // "FALSE_REFUND_CLAIM", "SPAM_SMS", "FRAUD", "OTHER"
  description String?
  severity    String   @default("MINOR") // "MINOR" | "MAJOR" | "CRITICAL"
  
  reportedBy  String   // "SYSTEM" | "ADMIN" | "CUSTOMER" | "PARTNER"
  reportedAt  DateTime @default(now()) @db.Timestamptz(6)
  
  status      String   @default("PENDING") // "PENDING" | "CONFIRMED" | "DISPUTED" | "RESOLVED"
  resolvedAt  DateTime?
  notes       String?  // 해결 노트
  
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @db.Timestamptz(6)
  
  @@index([partnerId, status])
  @@index([reportedAt])
}

// 이의 제기 기록
model Objection {
  id            String   @id @default(cuid())
  partnerId     String
  partner       Partner  @relation(fields: [partnerId], references: [id], onDelete: Cascade)
  
  scoreBeforeObjection Int // 이의 제기 전 점수
  reasonForObjection   String // 왜 이의를 제기했나
  detailedExplanation  String? // 상세 설명
  
  status        String   @default("PENDING") // "PENDING" | "APPROVED" | "REJECTED" | "ESCALATED"
  
  reviewedBy    String?  // 검토한 관리자 ID
  reviewedAt    DateTime?
  reviewNotes   String?  // 검토 메모
  
  scoreAfterReview Int?  // 검토 후 점수 (승인시만)
  
  submittedAt   DateTime @default(now()) @db.Timestamptz(6)
  createdAt     DateTime @default(now()) @db.Timestamptz(6)
  updatedAt     DateTime @updatedAt @db.Timestamptz(6)
  
  @@index([partnerId, status])
  @@index([submittedAt])
}
```

### 2. 마이그레이션 스크립트

**파일**: `prisma/migrations/[timestamp]_add_trust_score_system.sql`

```sql
-- Partner 테이블에 신뢰도 필드 추가
ALTER TABLE "Partner" 
ADD COLUMN "trustScoreCurrent" INTEGER DEFAULT 100,
ADD COLUMN "trustScoreUpdatedAt" TIMESTAMPTZ,
ADD COLUMN "refundRateMonthly" NUMERIC(5,2),
ADD COLUMN "refundRateLastMonth" NUMERIC(5,2),
ADD COLUMN "refundRateAvg3M" NUMERIC(5,2),
ADD COLUMN "violationCount" INTEGER DEFAULT 0,
ADD COLUMN "trustStatus" VARCHAR(10) DEFAULT 'GREEN',
ADD COLUMN "trustStatusUpdatedAt" TIMESTAMPTZ;

-- 인덱스 추가
CREATE INDEX "Partner_trustScore_idx" ON "Partner"("trustScoreCurrent");
CREATE INDEX "Partner_trustStatus_idx" ON "Partner"("trustStatus");
CREATE INDEX "Partner_trustStatusUpdatedAt_idx" ON "Partner"("trustStatusUpdatedAt");

-- TrustScoreHistory 테이블 생성
CREATE TABLE "TrustScoreHistory" (
  "id" CUID PRIMARY KEY,
  "partnerId" CUID NOT NULL REFERENCES "Partner"("id") ON DELETE CASCADE,
  "previousScore" INTEGER NOT NULL,
  "currentScore" INTEGER NOT NULL,
  "reason" VARCHAR(100) NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX "TrustScoreHistory_partnerId_createdAt_idx" ON "TrustScoreHistory"("partnerId", "createdAt");

-- Violation 테이블 생성
CREATE TABLE "Violation" (
  "id" CUID PRIMARY KEY,
  "partnerId" CUID NOT NULL REFERENCES "Partner"("id") ON DELETE CASCADE,
  "violationType" VARCHAR(50) NOT NULL,
  "description" TEXT,
  "severity" VARCHAR(20) DEFAULT 'MINOR',
  "reportedBy" VARCHAR(50) NOT NULL,
  "reportedAt" TIMESTAMPTZ DEFAULT NOW(),
  "status" VARCHAR(20) DEFAULT 'PENDING',
  "resolvedAt" TIMESTAMPTZ,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX "Violation_partnerId_status_idx" ON "Violation"("partnerId", "status");
CREATE INDEX "Violation_reportedAt_idx" ON "Violation"("reportedAt");

-- Objection 테이블 생성
CREATE TABLE "Objection" (
  "id" CUID PRIMARY KEY,
  "partnerId" CUID NOT NULL REFERENCES "Partner"("id") ON DELETE CASCADE,
  "scoreBeforeObjection" INTEGER NOT NULL,
  "reasonForObjection" VARCHAR(500) NOT NULL,
  "detailedExplanation" TEXT,
  "status" VARCHAR(20) DEFAULT 'PENDING',
  "reviewedBy" CUID,
  "reviewedAt" TIMESTAMPTZ,
  "reviewNotes" TEXT,
  "scoreAfterReview" INTEGER,
  "submittedAt" TIMESTAMPTZ DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX "Objection_partnerId_status_idx" ON "Objection"("partnerId", "status");
CREATE INDEX "Objection_submittedAt_idx" ON "Objection"("submittedAt");
```

---

## 🔧 PHASE 2-2: API 구현

### 1. 신뢰도 점수 계산 로직

**파일**: `src/lib/trust-score/calculateTrustScore.ts`

```typescript
/**
 * 신뢰도 점수 계산 (초등 로직)
 * 
 * 공식:
 * 기본점수(100) - 환불감점 - 위반감점 + 판매보너스
 */

import { Prisma } from "@prisma/client";

interface TrustScoreCalculationInput {
  refundRate: number; // %
  violationCount: number; // 누적 횟수
  monthlySalesCount: number; // 월 판매건수
  customerRating: number; // 고객평가 (0-5)
}

interface TrustScoreResult {
  baseScore: number; // 100
  refundDeduction: number; // 환불 감점
  violationDeduction: number; // 위반 감점
  salesBonus: number; // 판매 보너스
  ratingBonus: number; // 평가 보너스
  finalScore: number; // 최종 점수 (0-120)
  status: "GREEN" | "YELLOW" | "RED" | "BLACK"; // 상태
  reason: string; // 변경 원인 설명
}

export function calculateTrustScore(
  input: TrustScoreCalculationInput
): TrustScoreResult {
  let score = 100; // 기본점수
  const deductions: string[] = [];
  const bonuses: string[] = [];

  // 1️⃣ 환불율 감점
  let refundDeduction = 0;
  if (input.refundRate >= 40) {
    refundDeduction = 20;
    deductions.push("환불율 40% 이상: -20점");
  } else if (input.refundRate >= 30) {
    refundDeduction = 10;
    deductions.push("환불율 30% 이상: -10점");
  } else if (input.refundRate >= 20) {
    refundDeduction = 5;
    deductions.push("환불율 20% 이상: -5점");
  }
  score -= refundDeduction;

  // 2️⃣ 약관 위반 감점
  let violationDeduction = 0;
  if (input.violationCount >= 3) {
    violationDeduction = 20;
    deductions.push("약관 위반 3회 이상: -20점");
  } else if (input.violationCount === 2) {
    violationDeduction = 10;
    deductions.push("약관 위반 2회: -10점");
  } else if (input.violationCount === 1) {
    violationDeduction = 5;
    deductions.push("약관 위반 1회: -5점");
  }
  score -= violationDeduction;

  // 3️⃣ 판매 보너스
  let salesBonus = 0;
  if (input.monthlySalesCount >= 50) {
    salesBonus = 10;
    bonuses.push("월 판매 50건 이상: +10점");
  } else if (input.monthlySalesCount >= 10) {
    salesBonus = 5;
    bonuses.push("월 판매 10건 이상: +5점");
  }
  score += salesBonus;

  // 4️⃣ 고객평가 보너스
  let ratingBonus = 0;
  if (input.customerRating >= 4.5) {
    ratingBonus = 5;
    bonuses.push("고객평가 4.5/5.0 이상: +5점");
  }
  score += ratingBonus;

  // 최종 점수 (0-120 범위 제한)
  const finalScore = Math.max(0, Math.min(120, score));

  // 상태 결정
  let status: "GREEN" | "YELLOW" | "RED" | "BLACK";
  if (finalScore >= 71) {
    status = "GREEN";
  } else if (finalScore >= 51) {
    status = "YELLOW";
  } else if (finalScore >= 35) {
    status = "RED";
  } else {
    status = "BLACK";
  }

  const reason = [
    ...deductions,
    ...bonuses,
    `최종 점수: ${finalScore}점 (${status})`,
  ].join(" | ");

  return {
    baseScore: 100,
    refundDeduction,
    violationDeduction,
    salesBonus,
    ratingBonus,
    finalScore,
    status,
    reason,
  };
}

// 예시
const result = calculateTrustScore({
  refundRate: 25,
  violationCount: 0,
  monthlySalesCount: 30,
  customerRating: 4.7,
});

console.log(result);
// {
//   baseScore: 100,
//   refundDeduction: 5,
//   violationDeduction: 0,
//   salesBonus: 5,
//   ratingBonus: 5,
//   finalScore: 105,
//   status: "GREEN",
//   reason: "환불율 20% 이상: -5점 | 월 판매 10건 이상: +5점 | 고객평가 4.5/5.0 이상: +5점 | 최종 점수: 105점 (GREEN)"
// }
```

### 2. 월별 신뢰도 계산 API

**파일**: `src/app/api/partners/[id]/trust-score/calculate/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateTrustScore } from "@/lib/trust-score/calculateTrustScore";

/**
 * POST /api/partners/[id]/trust-score/calculate
 * 특정 파트너의 신뢰도 점수를 계산하고 업데이트합니다.
 * (이전 점수와 다르면 history에 기록)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const partnerId = params.id;

    // 1️⃣ 파트너 정보 조회
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: {
        contacts: {
          where: {
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        },
        violationHistory: {
          where: {
            status: "CONFIRMED",
          },
        },
      },
    });

    if (!partner) {
      return NextResponse.json({ error: "파트너를 찾을 수 없습니다" }, { status: 404 });
    }

    // 2️⃣ 환불율 계산
    const monthlyContacts = partner.contacts.length;
    const refundedContacts = partner.contacts.filter((c) => c.refundedAt).length;
    const refundRate = monthlyContacts > 0 
      ? (refundedContacts / monthlyContacts) * 100 
      : 0;

    // 3️⃣ 신뢰도 점수 계산
    const calculation = calculateTrustScore({
      refundRate,
      violationCount: partner.violationHistory.length,
      monthlySalesCount: monthlyContacts,
      customerRating: 4.0, // TODO: 실제 고객평가 조회
    });

    // 4️⃣ 이전 점수와 비교
    const previousScore = partner.trustScoreCurrent;
    const scoreChanged = calculation.finalScore !== previousScore;

    // 5️⃣ DB 업데이트
    const updatedPartner = await prisma.partner.update({
      where: { id: partnerId },
      data: {
        trustScoreCurrent: calculation.finalScore,
        refundRateMonthly: new Prisma.Decimal(refundRate),
        trustStatus: calculation.status,
        trustScoreUpdatedAt: new Date(),
      },
    });

    // 6️⃣ 이력 저장
    if (scoreChanged) {
      await prisma.trustScoreHistory.create({
        data: {
          partnerId,
          previousScore,
          currentScore: calculation.finalScore,
          reason: calculation.reason,
          details: calculation,
        },
      });
    }

    return NextResponse.json({
      partnerId,
      previousScore,
      calculation,
      scoreChanged,
      updatedPartner,
    });
  } catch (error) {
    console.error("[TRUST_SCORE_CALC]", error);
    return NextResponse.json(
      { error: "점수 계산 실패" },
      { status: 500 }
    );
  }
}
```

### 3. Cron Job: 매달 1일 신뢰도 계산

**파일**: `src/app/api/cron/calculate-trust-scores/route.ts`

```typescript
/**
 * PATCH /api/cron/calculate-trust-scores
 * 
 * 매달 1일 자정(UTC)에 실행
 * Vercel Cron Job에 등록:
 * 
 * vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/calculate-trust-scores",
 *     "schedule": "0 0 1 * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  try {
    // Vercel Cron 검증
    if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 모든 파트너의 신뢰도 점수 계산
    const partners = await prisma.partner.findMany();

    let successCount = 0;
    let failureCount = 0;

    for (const partner of partners) {
      try {
        // 각 파트너마다 계산 로직 실행
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/partners/${partner.id}/trust-score/calculate`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${process.env.CRON_SECRET}`,
            },
          }
        );

        if (response.ok) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error) {
        console.error(`[TRUST_SCORE_BATCH] 파트너 ${partner.id} 실패:`, error);
        failureCount++;
      }
    }

    return NextResponse.json({
      message: "신뢰도 점수 계산 완료",
      total: partners.length,
      successCount,
      failureCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[TRUST_SCORE_BATCH]", error);
    return NextResponse.json(
      { error: "배치 작업 실패" },
      { status: 500 }
    );
  }
}
```

---

## 🎨 PHASE 2-3: UI 개발

### 1. 파트너 대시보드 - 신뢰도 섹션

**파일**: `src/app/(dashboard)/partners/[id]/components/TrustScoreSummary.tsx`

```typescript
/**
 * 파트너 대시보드의 신뢰도 요약 카드
 * 
 * 표시 정보:
 * • 현재 신뢰도 점수 (0-120)
 * • 상태 색상 (GREEN/YELLOW/RED/BLACK)
 * • 점수 변동 추이
 * • 이의 제기 버튼
 */

"use client";

import React, { useState } from "react";
import { Partner, TrustScoreHistory } from "@prisma/client";

interface TrustScoreSummaryProps {
  partner: Partner & { trustScoreHistory: TrustScoreHistory[] };
}

export function TrustScoreSummary({ partner }: TrustScoreSummaryProps) {
  const [showObjectionForm, setShowObjectionForm] = useState(false);

  const getStatusColor = (score: number) => {
    if (score >= 71) return { bg: "#D5F4E6", text: "#27AE60", label: "🟢 정상" };
    if (score >= 51) return { bg: "#FFFACD", text: "#FFD700", label: "🟡 경고" };
    if (score >= 35) return { bg: "#FADBD8", text: "#E74C3C", label: "🔴 제한" };
    return { bg: "#BDBDBD", text: "#1A1A1A", label: "⚫ 정지" };
  };

  const statusColor = getStatusColor(partner.trustScoreCurrent);
  const recentHistory = partner.trustScoreHistory.slice(0, 3);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">신뢰도 점수</h2>
        <button
          onClick={() => setShowObjectionForm(true)}
          className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
        >
          ❓ 이의 제기하기
        </button>
      </div>

      {/* 점수 표시 */}
      <div
        className="rounded-lg p-6 mb-6 text-center"
        style={{ backgroundColor: statusColor.bg }}
      >
        <div className="text-5xl font-bold" style={{ color: statusColor.text }}>
          {partner.trustScoreCurrent}점
        </div>
        <div className="text-lg mt-2" style={{ color: statusColor.text }}>
          {statusColor.label}
        </div>
        <div className="text-sm text-gray-600 mt-2">
          마지막 업데이트: {partner.trustScoreUpdatedAt?.toLocaleDateString()}
        </div>
      </div>

      {/* 상세 정보 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-600">환불율</div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">
            {partner.refundRateMonthly?.toFixed(1) ?? "0"}%
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-600">약관 위반</div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">
            {partner.violationCount}회
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-600">판매 건수</div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">
            {partner.contacts?.length ?? 0}건
          </div>
        </div>
      </div>

      {/* 점수 변동 히스토리 */}
      {recentHistory.length > 0 && (
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">점수 변동 내역</h3>
          <div className="space-y-3">
            {recentHistory.map((history) => (
              <div key={history.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium text-gray-900">{history.reason}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {history.createdAt.toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">
                    {history.previousScore} → {history.currentScore}
                  </div>
                  <div className={`text-xs ${
                    history.currentScore > history.previousScore
                      ? "text-green-600"
                      : "text-red-600"
                  }`}>
                    {history.currentScore > history.previousScore ? "+" : ""}
                    {history.currentScore - history.previousScore}점
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 상태별 안내 */}
      {partner.trustScoreCurrent < 71 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-blue-900 mb-2">
            📌 현재 상태와 다음 단계
          </div>
          <div className="text-sm text-blue-800 space-y-1">
            {partner.trustScoreCurrent < 51 && (
              <p>• 환불율을 낮게 유지해주세요 (목표: 20% 이하)</p>
            )}
            {partner.trustScoreCurrent < 35 && (
              <p>• 신규 캠페인 시작이 제한됩니다</p>
            )}
            {partner.trustScoreCurrent < 40 && (
              <p>• 모든 활동이 정지될 수 있습니다</p>
            )}
            <p>
              • 점수를 올리려면:{" "}
              <a href="/docs/trust-score" className="underline">
                가이드 보기
              </a>
            </p>
          </div>
        </div>
      )}

      {/* 이의 제기 폼 */}
      {showObjectionForm && (
        <ObjectionForm
          partnerId={partner.id}
          onClose={() => setShowObjectionForm(false)}
        />
      )}
    </div>
  );
}

function ObjectionForm({
  partnerId,
  onClose,
}: {
  partnerId: string;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    reason: "",
    explanation: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/partners/${partnerId}/objections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert("이의가 제기되었습니다. 3-5일 내에 검토 결과를 알려드리겠습니다.");
        onClose();
      } else {
        alert("이의 제기에 실패했습니다. 다시 시도해주세요.");
      }
    } catch (error) {
      console.error("이의 제기 오류:", error);
      alert("오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">이의 제기</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이의 이유 *
            </label>
            <input
              type="text"
              required
              placeholder="예: 환불율이 잘못 계산됨"
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상세 설명 (선택사항)
            </label>
            <textarea
              placeholder="구체적인 상황을 설명해주세요"
              value={formData.explanation}
              onChange={(e) =>
                setFormData({ ...formData, explanation: e.target.value })
              }
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "제출 중..." : "제출"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-900 py-2 rounded-lg hover:bg-gray-300"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### 2. 관리자 대시보드 - 신뢰도 관리 페이지

**파일**: `src/app/(dashboard)/admin/trust-scores/page.tsx`

```typescript
/**
 * 관리자 페이지: /admin/trust-scores
 * 
 * 표시 내용:
 * • 모든 파트너의 신뢰도 점수 목록
 * • 필터 (상태별, 점수 범위)
 * • 위반 기록 관리
 * • 이의 제기 검토
 */

import React from "react";
import { prisma } from "@/lib/prisma";

export default async function AdminTrustScoresPage() {
  // 모든 파트너의 신뢰도 정보 조회
  const partners = await prisma.partner.findMany({
    include: {
      trustScoreHistory: { take: 1, orderBy: { createdAt: "desc" } },
      violationHistory: { where: { status: "CONFIRMED" } },
      objections: { where: { status: "PENDING" } },
    },
    orderBy: { trustScoreCurrent: "asc" },
  });

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">신뢰도 시스템 관리</h1>

      {/* 통계 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-sm text-green-700">🟢 정상 (71+)</div>
          <div className="text-2xl font-bold text-green-900 mt-2">
            {partners.filter((p) => p.trustScoreCurrent >= 71).length}명
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="text-sm text-yellow-700">🟡 경고 (51-70)</div>
          <div className="text-2xl font-bold text-yellow-900 mt-2">
            {partners.filter((p) => p.trustScoreCurrent >= 51 && p.trustScoreCurrent < 71).length}명
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <div className="text-sm text-orange-700">🔴 제한 (35-50)</div>
          <div className="text-2xl font-bold text-orange-900 mt-2">
            {partners.filter((p) => p.trustScoreCurrent >= 35 && p.trustScoreCurrent < 51).length}명
          </div>
        </div>
        <div className="bg-gray-200 rounded-lg p-4 border border-gray-300">
          <div className="text-sm text-gray-700">⚫ 정지 (&lt;40)</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {partners.filter((p) => p.trustScoreCurrent < 40).length}명
          </div>
        </div>
      </div>

      {/* 파트너 목록 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">파트너</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">점수</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">환불율</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">위반</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">이의</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">액션</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((partner) => (
              <tr key={partner.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {partner.name}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-3 py-1 rounded-full font-semibold ${
                    partner.trustScoreCurrent >= 71
                      ? "bg-green-100 text-green-800"
                      : partner.trustScoreCurrent >= 51
                      ? "bg-yellow-100 text-yellow-800"
                      : partner.trustScoreCurrent >= 35
                      ? "bg-orange-100 text-orange-800"
                      : "bg-gray-200 text-gray-800"
                  }`}>
                    {partner.trustScoreCurrent}점
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {partner.refundRateMonthly?.toFixed(1) ?? "0"}%
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
                    {partner.violationCount}건
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {partner.objections.length > 0 && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                      {partner.objections.length}건
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  <a
                    href={`/admin/trust-scores/${partner.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    자세히
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 🧪 PHASE 2-4: QA & 테스트

### 테스트 체크리스트

| 항목 | 테스트 내용 | 담당 | 상태 |
|------|-----------|------|------|
| 1️⃣ 계산 로직 | 6가지 시나리오 테스트 (각 상태별) | QA | ☑️ |
| 2️⃣ API | 점수 계산 API 응답 검증 | QA | ☑️ |
| 3️⃣ Cron Job | 매달 1일 자동 계산 | QA | ☑️ |
| 4️⃣ UI | 대시보드 표시 + 이의 제기 폼 | QA | ☑️ |
| 5️⃣ 통지 | 경고/제한/정지 알림 이메일 | QA | ☑️ |
| 6️⃣ DB | 데이터 일관성 + 인덱스 성능 | QA | ☑️ |

---

## 📊 PHASE 3: 사용자 공지

### 타이밍

```
07-07: 변호사 OK 받음
       ↓
07-07: 이메일 발송 "변호사 검토 완료"
       ↓
07-08~07-18: 앱 배너 노출 + 동의 수집 (11일)
       ↓
07-18: 동의율 확인 (목표 95%)
       ↓
07-19: 신뢰도 시스템 시행!
```

---

## 🚀 PHASE 4: 시행 & 모니터링

### Day 1 (07-19) 체크리스트

- [ ] 첫 신뢰도 점수 계산 및 발표
- [ ] 경고 파트너 (51-70점) 알림 발송
- [ ] 제한 파트너 (35-50점) 콜 + 지원
- [ ] 정지 파트너 (<40점) 긴급 상담
- [ ] CS 팀 24/7 대기

### Day 1-7: 주간 모니터링

| 지표 | 목표 | 담당 |
|------|------|------|
| 점수 계산 성공률 | 100% | Analytics |
| CS 질문 응답 시간 | <2시간 | CS |
| 이의 제기 접수 | <5건 | Legal |
| 시스템 안정성 | 99.9% Uptime | Eng |

---

**마지막 업데이트**: 2026-06-19 | **예상 완료**: 2026-07-19
