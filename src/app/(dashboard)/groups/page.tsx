"use client";

import { useState } from "react";
import { useSession } from "@/hooks/useSession";
import { ContactGroupsPanel } from "@/components/groups/ContactGroupsPanel";
import { MemberGroupsPanel } from "@/components/groups/MemberGroupsPanel";

type TabKey = "contact" | "member";

export default function GroupsPage() {
  const session = useSession();
  // 회원 그룹 탭은 GLOBAL_ADMIN 전용 (api/members가 GLOBAL_ADMIN 권한 기준)
  const canSeeMemberGroups = session.role === "GLOBAL_ADMIN";

  const [tab, setTab] = useState<TabKey>("contact");
  // 권한 없는 사용자가 회원 그룹 탭에 머무르지 않도록 보정
  const activeTab: TabKey = tab === "member" && !canSeeMemberGroups ? "contact" : tab;

  return (
    <div className="flex flex-col h-full p-4 md:p-6 space-y-3">
      {/* ═══ 페이지 제목 ═══════════════════════════════════════════════ */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">그룹 관리</h1>
        <p className="text-base text-gray-600 mt-1 leading-relaxed">
          연락처 그룹과 회원 그룹을 한 곳에서 관리합니다. 아래 탭으로 전환하세요.
        </p>
      </div>

      {/* ═══ 탭 ════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab("contact")}
          className={`px-5 py-3 text-base font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === "contact"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          연락처 그룹
        </button>
        {canSeeMemberGroups && (
          <button
            onClick={() => setTab("member")}
            className={`px-5 py-3 text-base font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === "member"
                ? "border-green-600 text-green-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            회원 그룹
          </button>
        )}
      </div>

      {/* ═══ 탭 콘텐츠 ══════════════════════════════════════════════════ */}
      <div className="flex-1 min-h-0">
        {activeTab === "contact" ? <ContactGroupsPanel /> : <MemberGroupsPanel />}
      </div>
    </div>
  );
}
