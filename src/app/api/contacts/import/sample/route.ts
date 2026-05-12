import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

/** GET /api/contacts/import/sample — 샘플 엑셀 다운로드 */
export async function GET() {
  const sampleData = [
    {
      이름: "홍길동",
      전화번호: "010-1234-5678",
      이메일: "hong@example.com",
      관심크루즈: "지중해 7박",
      예산: "300만원",
      메모: "2월 여행 희망",
      유형: "문의",
    },
    {
      이름: "김영희",
      전화번호: "010-9876-5432",
      이메일: "",
      관심크루즈: "동남아 크루즈",
      예산: "200만원",
      메모: "",
      유형: "구매",
    },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sampleData);

  // 컬럼 너비 설정
  ws["!cols"] = [
    { wch: 10 }, // 이름
    { wch: 16 }, // 전화번호
    { wch: 24 }, // 이메일
    { wch: 16 }, // 관심크루즈
    { wch: 12 }, // 예산
    { wch: 20 }, // 메모
    { wch: 8 },  // 유형
  ];

  XLSX.utils.book_append_sheet(wb, ws, "고객목록");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="contacts-sample.xlsx"',
    },
  });
}
