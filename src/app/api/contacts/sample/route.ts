import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getAuthContext } from "@/lib/rbac";

// GET /api/contacts/sample — 고객 가져오기 엑셀 샘플 다운로드
export async function GET() {
  try {
    await getAuthContext(); // 인증 필요

    const wb = XLSX.utils.book_new();

    // ── 고객 DB 시트 ──────────────────────────────────────────
    const contactRows = [
      { 이름: "홍길동",   전화번호: "010-1234-5678", 이메일: "hong@example.com", 관심크루즈: "일본 크루즈", 예산: "100만원대", 메모: "지인 소개", 유형: "잠재고객" },
      { 이름: "김영희",   전화번호: "010-9876-5432", 이메일: "",               관심크루즈: "지중해 크루즈", 예산: "200만원대", 메모: "",         유형: "잠재고객" },
      { 이름: "이구매",   전화번호: "010-5555-1234", 이메일: "",               관심크루즈: "카리브해",     예산: "300만원대", 메모: "VIP 고객", 유형: "구매완료" },
    ];
    const wsContacts = XLSX.utils.json_to_sheet(contactRows);
    wsContacts["!cols"] = [14, 16, 22, 18, 12, 16, 12].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, wsContacts, "고객DB");

    // ── 문의고객 시트 ─────────────────────────────────────────
    const inquiryRows = [
      { 이름: "박문의",   전화번호: "010-1111-2222", 이메일: "",    문의내용: "일본 크루즈 날짜 문의", 문의경로: "인스타그램", 메모: "" },
      { 이름: "최관심",   전화번호: "010-3333-4444", 이메일: "",    문의내용: "가격 문의",             문의경로: "전화",       메모: "재연락 희망" },
    ];
    const wsInquiries = XLSX.utils.json_to_sheet(inquiryRows);
    wsInquiries["!cols"] = [14, 16, 22, 24, 14, 16].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, wsInquiries, "문의고객");

    // ── 구매고객 시트 ─────────────────────────────────────────
    const purchaseRows = [
      { 이름: "정구매",   전화번호: "010-7777-8888", 상품명: "일본 크루즈 5박", 결제금액: 1500000, 출발일: "2026-06-15", 인원: 2, 메모: "" },
      { 이름: "한VIP",   전화번호: "010-9999-0000", 상품명: "지중해 크루즈 10박", 결제금액: 4200000, 출발일: "2026-08-20", 인원: 3, 메모: "프리미엄 캐빈" },
    ];
    const wsPurchases = XLSX.utils.json_to_sheet(purchaseRows);
    wsPurchases["!cols"] = [14, 16, 20, 12, 12, 8, 16].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, wsPurchases, "구매고객");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="cruisedot_import_sample.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, message: "샘플 생성 실패" }, { status: 500 });
  }
}
