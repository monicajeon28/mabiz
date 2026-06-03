"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";

/**
 * /payslips → /team-statements 통합 리다이렉트
 * AffiliatePayslip 데이터는 팀 정산 관리 페이지에서 통합 제공됩니다.
 */
export default function PayslipsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/team-statements");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-gray-400">
      <FileText className="w-10 h-10 opacity-30" />
      <p className="text-sm">팀 정산 관리 페이지로 이동 중...</p>
    </div>
  );
}
