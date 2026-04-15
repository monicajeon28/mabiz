import { SidebarNav } from "@/components/layout/SidebarNav";
import { BottomTabBar } from "@/components/layout/BottomTabBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-[#F7F8FC]">
      {/* PC: 좌측 사이드바 */}
      <SidebarNav className="hidden md:flex" />

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {children}
      </main>

      {/* 모바일: 하단 탭 */}
      <BottomTabBar className="md:hidden" />
    </div>
  );
}
