/**
 * 교육생 모집 — 카테고리 허브 (지사장·관리자 전용)
 *
 * 부업·창업 파트너(교육생) 모집을 한 곳에서: ①교육생 모집봇 만들기/목록 ②모집 랜딩 관리
 * ③시뮬-검수로 검증된 정직 상담 스크립트. 50대 지사장도 직관적으로 보고 쓰게.
 *
 * 접근: GLOBAL_ADMIN + OWNER(지사장)만. 대리점장(AGENT)·마케터(FREE_SALES)는 차단.
 * (대리점장은 크루즈 상담봇만 복사받아 사용 — 교육생 모집은 지사 개인 업무.)
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Plus, ExternalLink, Settings2, Users, ShieldCheck } from "lucide-react";
import prisma from "@/lib/prisma";
import { getAuthContext } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** 시뮬-검수(수익보장0·과장0·광고법0 게이트 통과)로 검증된 정직 상담 멘트. */
const RECRUIT_SCRIPTS: Array<{ tag: string; q: string; a: string }> = [
  {
    tag: "💰 수익 보장 요구",
    q: "“한 달에 얼마 벌어요? 보장돼요?”",
    a: "“한 달에 얼마라고 보장은 못 드려요. 그렇게 약속하는 곳이 오히려 위험합니다. 수익은 본인이 얼마나 활동하시느냐에 따라 달라져요. 제가 보장드리는 건 ‘돈’이 아니라 ‘교육과 지원’이에요.”",
  },
  {
    tag: "🛡️ 사기 의심",
    q: "“이거 사기 아니에요?”",
    a: "“그 질문 주셔서 오히려 감사해요. ‘누구나 무조건 성공한다’고 하면 그게 거짓말이라 그렇게는 말 못 드려요. 교육·지원을 드리고, 실제로 활동 안 하시면 수익이 안 날 수도 있다는 것까지 솔직히 말씀드릴게요.”",
  },
  {
    tag: "🔗 다단계 의심",
    q: "“혹시 다단계예요?”",
    a: "“아니에요. 하위 회원을 모집해서 그 사람 돈으로 수당 받는 구조가 전혀 아닙니다. 수당은 오직 크루즈 상품을 ‘실제로 판매’했을 때만 발생해요. 누구 데려오라고 강요하지도 않습니다.”",
  },
  {
    tag: "🏷️ 가격 부담(750)",
    q: "“750만원은 부담스러워요.”",
    a: "“그럼 부담이 적은 마케터 330만원부터 시작하시고, 성과가 나면 그때 단계를 올리셔도 돼요. 그리고 결제 후 7일 안에 아직 안 들으신 수업은 100% 환불되니 부담을 덜 수 있어요.”",
  },
  {
    tag: "🤝 마무리 고지(필수)",
    q: "상담 종료 시 꼭 한 번",
    a: "“본 안내는 교육·지원 제공에 관한 것이고 수익을 보장하지 않으며, 정확한 조건은 계약서 기준입니다.” — 이 고지를 빠뜨리지 마세요.",
  },
];

interface BotCfg {
  botType?: string;
  greeting?: string;
}

export default async function RecruitHubPage() {
  const ctx = await getAuthContext().catch(() => null);
  // 지사장(OWNER)·관리자만. 그 외는 대시보드로.
  if (!ctx || (ctx.role !== "GLOBAL_ADMIN" && ctx.role !== "OWNER")) {
    redirect("/dashboard");
  }

  // 봇 랜딩 조회 — 관리자=전체, 지사장=본인 조직.
  const orgFilter = ctx.role === "GLOBAL_ADMIN" ? {} : { organizationId: ctx.organizationId ?? "__none__" };
  const botPages = await prisma.crmLandingPage.findMany({
    where: { pageType: "bot", ...orgFilter },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      shortlink: true,
      isActive: true,
      viewCount: true,
      createdAt: true,
      botConfig: true,
      _count: { select: { registrations: true } },
    },
    take: 100,
  });
  // 교육생 모집봇(botType='recruit')만.
  const recruitBots = botPages.filter((p) => (p.botConfig as BotCfg | null)?.botType === "recruit");

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <GraduationCap className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">교육생 모집</h1>
          <p className="text-base text-slate-500">부업·창업 파트너를 정직하게 모집하는 봇·랜딩·스크립트</p>
        </div>
      </div>

      {/* 안내 배너 */}
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-base font-bold text-emerald-900">✅ 정직이 최고의 무기예요</p>
        <p className="mt-1 text-sm leading-relaxed text-emerald-800">
          “수익 보장”은 절대 하지 마세요. 시뮬레이션에서 <b>수익보장 없이도 구매의향 63.8%</b>가 나왔어요.
          솔직하게 말할수록 의심 많은 분들이 오히려 신뢰합니다.
        </p>
      </div>

      {/* 1. 모집봇 */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">🎓 교육생 모집봇</h2>
          <Link
            href="/landing-pages/bot-new?type=recruit"
            className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#1E2D4E] px-4 text-base font-bold text-white active:scale-95"
          >
            <Plus className="h-4 w-4" /> 모집봇 만들기
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          손님(부업·창업 희망자)을 봇이 알아서 상담하고, 관심 높은 분은 알림으로 넘겨줘요.
        </p>

        <div className="mt-3 space-y-3">
          {recruitBots.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
              <p className="text-3xl">🎓</p>
              <p className="mt-2 font-medium text-slate-700">아직 만든 모집봇이 없어요</p>
              <p className="mt-1 text-sm text-slate-500">
                위 “모집봇 만들기”로 첫 봇을 만들어 보세요.
              </p>
            </div>
          ) : (
            recruitBots.map((b) => {
              const link = b.shortlink || b.slug;
              return (
                <div
                  key={b.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${b.isActive ? "bg-emerald-500" : "bg-slate-300"}`}
                        title={b.isActive ? "사용 중" : "꺼짐"}
                      />
                      <h3 className="truncate text-base font-bold text-slate-900">{b.title}</h3>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      /p/{link} · 👁 {b.viewCount.toLocaleString()}명 · 📋 신청 {b._count.registrations}명
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={`/p/${link}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-slate-200 px-3 text-base font-medium text-slate-700 active:scale-95"
                    >
                      <ExternalLink className="h-4 w-4" /> 열기
                    </a>
                    <Link
                      href={`/landing-pages/${b.id}`}
                      className="flex min-h-[44px] items-center gap-1.5 rounded-xl border-2 border-slate-200 px-3 text-base font-medium text-slate-700 active:scale-95"
                      title="공유·복제·통계"
                    >
                      <Settings2 className="h-4 w-4" /> 관리
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 2. 모집 랜딩 전체관리 */}
      <section className="mt-6">
        <Link
          href="/landing-pages"
          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-slate-500" />
            <div>
              <p className="text-base font-bold text-slate-900">랜딩페이지 전체 관리</p>
              <p className="text-sm text-slate-500">공유·복제·통계, 일반 랜딩 커스터마이징은 여기서</p>
            </div>
          </div>
          <ExternalLink className="h-5 w-5 text-slate-400" />
        </Link>
      </section>

      {/* 3. 상담 스크립트 */}
      <section className="mt-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-900">정직 상담 스크립트 (검증됨)</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          이의가 들어오면 이대로 답하세요. 광고법 위반 없이 신뢰를 얻는 멘트예요.
        </p>
        <div className="mt-3 space-y-3">
          {RECRUIT_SCRIPTS.map((s) => (
            <div key={s.tag} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-bold text-emerald-700">{s.tag}</p>
              <p className="mt-1 text-base font-medium text-slate-800">{s.q}</p>
              <p className="mt-2 rounded-xl bg-slate-50 p-3 text-base leading-relaxed text-slate-700">
                {s.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-slate-400">
        교육생 모집은 지사장 개인 업무예요. 대리점장·마케터에게는 보이지 않습니다.
      </p>
    </div>
  );
}
