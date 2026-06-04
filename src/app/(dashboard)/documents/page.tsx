import { redirect } from "next/navigation";

// 서류관리 → 새 통합 서류관리 페이지로 리다이렉트
export default function DocumentsPage() {
  redirect("/documents-approval");
}
