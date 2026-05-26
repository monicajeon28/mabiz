import { redirect } from "next/navigation";
import { getMabizSession } from "@/lib/auth";
import { AuthSession } from "@/types/auth";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { FloatingChatbot } from "@/components/layout/FloatingChatbot";
import { SessionProvider } from "@/hooks/useSession";

export const dynamic = 'force-dynamic';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const ctx = await getMabizSession();
  // GLOBAL_ADMIN은 organizationId 없이도 접근 가능
  if (!ctx) {
    redirect("/sign-in");
  }
  if (!ctx.organizationId && ctx.role !== "GLOBAL_ADMIN") {
    redirect("/sign-in");
  }

  const session: AuthSession = {
    userId: ctx.userId,
    role: ctx.role,
    organizationId: ctx.organizationId,
    member: ctx.member || null,
    mallUser: ctx.mallUser,
  };

  return (
    <SessionProvider
      session={{
        role: session?.role,
        organizationId: session?.organizationId ?? undefined,
        isAdmin: session?.role === "GLOBAL_ADMIN",
      }}
    >
      <div className="flex h-screen bg-[#F7F8FC]">
        {/* PC: 좌측 사이드바 */}
        <SidebarNav className="hidden md:flex" session={session} />

        {/* 메인 콘텐츠 */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>

        {/* 모바일: 하단 탭 */}
        <BottomTabBar className="md:hidden" />

        {/* 플로팅 세일즈봇 */}
        <FloatingChatbot />
      </div>
    </SessionProvider>
  );
}
