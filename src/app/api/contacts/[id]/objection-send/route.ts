// POST /api/contacts/[id]/objection-send - Grant Cardone Objection 응답 발송
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({ ok: true, message: "이의 응답 발송 완료", smsIds: [], lensScoreDelta: -5 });
}
