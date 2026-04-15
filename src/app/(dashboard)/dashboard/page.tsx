import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

async function getStats(orgId: string) {
  const [totalContacts, leads, customers] = await Promise.all([
    prisma.contact.count({ where: { organizationId: orgId } }),
    prisma.contact.count({ where: { organizationId: orgId, type: "LEAD" } }),
    prisma.contact.count({ where: { organizationId: orgId, type: "CUSTOMER" } }),
  ]);
  return { totalContacts, leads, customers };
}

function KpiCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      <p className="text-3xl font-bold text-navy-900 mt-1">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const member = await prisma.organizationMember.findFirst({
    where: { userId },
    include: { organization: true },
  });

  if (!member) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-bold text-navy-900">조직 설정 필요</h2>
          <p className="text-gray-500 mt-2">관리자에게 조직 초대를 요청하세요.</p>
        </div>
      </div>
    );
  }

  const stats = await getStats(member.organizationId);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">대시보드</h1>
        <p className="text-gray-500 text-sm mt-1">
          {member.organization.name} · 오늘:{" "}
          {new Date().toLocaleDateString("ko-KR")}
        </p>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard title="총 고객" value={stats.totalContacts} />
        <KpiCard title="잠재고객" value={stats.leads} />
        <KpiCard title="구매고객" value={stats.customers} />
        <KpiCard
          title="전환율"
          value={
            stats.totalContacts > 0
              ? ((stats.customers / stats.totalContacts) * 100).toFixed(1) + "%"
              : "0%"
          }
        />
      </div>

      {/* 빠른 액션 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-navy-900 mb-4">빠른 시작</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "고객 추가", href: "/contacts/new", color: "bg-navy-900" },
            { label: "문자 발송", href: "/messages/send", color: "bg-gold-500" },
            { label: "랜딩페이지", href: "/landing-pages/new", color: "bg-emerald-600" },
            { label: "영업 도구함", href: "/tools", color: "bg-purple-600" },
          ].map((action) => (
            <a
              key={action.href}
              href={action.href}
              className={`${action.color} text-white rounded-lg p-4 text-sm font-medium text-center hover:opacity-90 transition-opacity`}
            >
              {action.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
