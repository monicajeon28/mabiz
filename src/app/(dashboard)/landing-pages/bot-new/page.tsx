/**
 * 봇 랜딩 만들기 (50대 간편 제작) — 서버 컴포넌트
 * 권한(지사장·관리자) 확인 + 상담할 상품 목록을 서버에서 조회해 폼에 전달.
 */
import prisma from "@/lib/prisma";
import { getAuthContext, canManageSettings } from "@/lib/rbac";
import BotLandingForm from "./BotLandingForm";

export const dynamic = "force-dynamic";

export default async function NewBotLandingPage() {
  const ctx = await getAuthContext().catch(() => null);

  if (!ctx) {
    return (
      <div className="p-6 text-lg text-slate-700">로그인이 필요해요.</div>
    );
  }
  if (!canManageSettings(ctx)) {
    return (
      <div className="p-6 text-lg text-slate-700">
        봇 랜딩 만들기는 <b>지사장·관리자</b>만 할 수 있어요.
      </div>
    );
  }

  const products = await prisma.cruiseProduct.findMany({
    where: { isActive: true, isVisible: true, deletedAt: null, saleStatus: "판매중" },
    select: {
      productCode: true,
      packageName: true,
      cruiseLine: true,
      basePrice: true,
      nights: true,
      days: true,
    },
    orderBy: [{ isPopular: "desc" }, { basePrice: "asc" }],
    take: 60,
  });

  return <BotLandingForm products={products} />;
}
