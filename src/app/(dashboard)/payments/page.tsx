"use client";

import { useState, useEffect, useCallback } from "react";
import { CreditCard, RefreshCw, ArrowUpRight, ArrowDownLeft, Clock, Repeat, Store } from "lucide-react";

/** 전화번호 마스킹: 010-****-5678 형식 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-***-${digits.slice(6)}`;
  return phone.slice(0, 4) + "****";
}

type Payment = {
  id: string;
  orderId: string;
  productName: string | null;
  customerName: string;
  customerPhone: string;
  amount: number;
  status: string;
  payType: string | null;
  cardName: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  refundAmount: number;
  createdAt: string;
};

type Stats = {
  totalPaid: number;
  totalPaidCount: number;
  totalRefunded: number;
  totalRefundedCount: number;
  totalPending: number;
  totalPendingCount: number;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  paid:             { label: "결제완료", color: "text-emerald-700 bg-emerald-50" },
  pending:          { label: "대기",     color: "text-gray-600 bg-gray-100" },
  waiting:          { label: "입금대기", color: "text-amber-700 bg-amber-50" },
  refunded:         { label: "환불",     color: "text-red-700 bg-red-50" },
  partial_refunded: { label: "부분환불", color: "text-orange-700 bg-orange-50" },
  cancelled:        { label: "취소",     color: "text-gray-500 bg-gray-100" },
};

type Subscription = {
  id: string;
  rebillNo: string;
  goodname: string;
  goodprice: number;
  customerName: string;
  customerPhone: string;
  cycleDay: number;
  expireDate: string;
  status: string;
  createdAt: string;
};

const SUB_STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: "대기",     color: "text-gray-600 bg-gray-100" },
  active:    { label: "활성",     color: "text-emerald-700 bg-emerald-50" },
  paused:    { label: "일시정지", color: "text-amber-700 bg-amber-50" },
  cancelled: { label: "해지",     color: "text-red-700 bg-red-50" },
};

type MallPayment = {
  id: number;
  orderId: string;
  buyerName: string;
  buyerTel: string;
  amount: number;
  status: string;
  productName: string | null;
  pgProvider: string | null;
  paidAt: string | null;
};

export default function PaymentsPage() {
  const [tab, setTab] = useState<"payments" | "mall" | "subscriptions">("payments");
  const [isAdmin, setIsAdmin] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("");
  const [search, setSearch]     = useState("");
  const [refunding, setRefunding] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");

  // 크루즈닷몰 결제
  const [mallPayments, setMallPayments] = useState<MallPayment[]>([]);
  const [mallTotal, setMallTotal]       = useState(0);
  const [mallPage, setMallPage]         = useState(1);
  const [mallTotalPages, setMallTotalPages] = useState(1);
  const [mallLoading, setMallLoading]   = useState(false);

  // 정기결제
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (filter) params.set("status", filter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/payapp/payments?${params}`);
      const data = await res.json();
      if (data.ok) {
        setPayments(data.payments);
        setTotal(data.total);
        setPage(data.page);
        setTotalPages(data.totalPages);
        setStats(data.stats);
      }
    } catch {}
    setLoading(false);
  }, [filter, search]);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.ok && d.role === 'GLOBAL_ADMIN') setIsAdmin(true); })
      .catch(() => {});
  }, []);

  useEffect(() => { if (tab === "payments") load(1); }, [load, tab]);

  const loadSubscriptions = useCallback(async () => {
    setSubLoading(true);
    try {
      const res = await fetch("/api/payapp/subscription");
      const data = await res.json();
      if (data.ok) setSubscriptions(data.subscriptions ?? []);
    } catch {}
    setSubLoading(false);
  }, []);

  const loadMallPayments = useCallback(async (p: number) => {
    setMallLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/payapp/mall-payments?${params}`);
      const data = await res.json();
      if (data.ok) {
        setMallPayments(data.payments);
        setMallTotal(data.total);
        setMallPage(data.page);
        setMallTotalPages(data.totalPages);
      }
    } catch {}
    setMallLoading(false);
  }, [search]);

  useEffect(() => { if (tab === "mall") loadMallPayments(1); }, [tab, loadMallPayments]);
  useEffect(() => { if (tab === "subscriptions") loadSubscriptions(); }, [tab, loadSubscriptions]);

  const handleSubAction = async (id: string, action: "pause" | "resume" | "cancel") => {
    try {
      if (action === "cancel") {
        const res = await fetch(`/api/payapp/subscription/${id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: cancelReason }),
        });
        const data = await res.json();
        if (!data.ok) { alert(data.message ?? "해지 실패"); return; }
      } else {
        const res = await fetch(`/api/payapp/subscription/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        if (!data.ok) { alert(data.message ?? "처리 실패"); return; }
      }
      loadSubscriptions();
    } catch { alert("네트워크 오류"); }
  };

  const handleRefund = async (paymentId: string) => {
    if (!refundReason.trim()) return;
    try {
      const res = await fetch("/api/payapp/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, reason: refundReason }),
      });
      const data = await res.json();
      if (data.ok) {
        setRefunding(null);
        setRefundReason("");
        load(page);
      } else {
        alert(data.message ?? "환불 실패");
      }
    } catch {
      alert("네트워크 오류");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-6 h-6" />
          결제 관리
        </h1>
        <button onClick={() => tab === "payments" ? load(page) : loadSubscriptions()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <RefreshCw className="w-4 h-4" /> 새로고침
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("payments")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "payments" ? "bg-white text-navy-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          <CreditCard className="w-4 h-4 inline mr-1.5" />결제 내역
        </button>
        {isAdmin && (
          <button
            onClick={() => setTab("mall")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "mall" ? "bg-white text-navy-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Store className="w-4 h-4 inline mr-1.5" />크루즈닷몰(B2C)
          </button>
        )}
        <button
          onClick={() => setTab("subscriptions")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "subscriptions" ? "bg-white text-navy-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          <Repeat className="w-4 h-4 inline mr-1.5" />정기결제
        </button>
      </div>

      {tab === "payments" && (<>
      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-emerald-50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-emerald-700 mb-1">
              <ArrowUpRight className="w-4 h-4" />
              <span className="text-sm font-medium">결제 완료</span>
            </div>
            <p className="text-2xl font-bold text-emerald-900">{stats.totalPaid.toLocaleString()}원</p>
            <p className="text-xs text-emerald-600 mt-1">{stats.totalPaidCount}건</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-700 mb-1">
              <ArrowDownLeft className="w-4 h-4" />
              <span className="text-sm font-medium">환불</span>
            </div>
            <p className="text-2xl font-bold text-red-900">{stats.totalRefunded.toLocaleString()}원</p>
            <p className="text-xs text-red-600 mt-1">{stats.totalRefundedCount}건</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-700 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">대기</span>
            </div>
            <p className="text-2xl font-bold text-amber-900">{stats.totalPending.toLocaleString()}원</p>
            <p className="text-xs text-amber-600 mt-1">{stats.totalPendingCount}건</p>
          </div>
        </div>
      )}

      {/* 필터 + 검색 */}
      <div className="flex gap-3 mb-4">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">전체 상태</option>
          <option value="paid">결제완료</option>
          <option value="pending">대기</option>
          <option value="refunded">환불</option>
          <option value="partial_refunded">부분환불</option>
          <option value="cancelled">취소</option>
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름, 전화번호, 상품명 검색"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
          onKeyDown={(e) => e.key === "Enter" && load(1)}
        />
        <button onClick={() => load(1)} className="bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-700">
          검색
        </button>
      </div>

      {/* 결제 목록 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">상품명</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">고객</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">금액</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">결제수단</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">일시</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">불러오는 중...</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">결제 내역이 없습니다</td></tr>
            ) : payments.map((p) => {
              const st = STATUS_LABELS[p.status] ?? { label: p.status, color: "text-gray-500 bg-gray-100" };
              return (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.productName ?? "-"}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900">{p.customerName}</p>
                    <p className="text-xs text-gray-400">{maskPhone(p.customerPhone)}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{p.amount.toLocaleString()}원</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">{p.cardName ?? p.payType ?? "-"}</td>
                  <td className="px-4 py-3 text-center text-xs text-gray-400">
                    {p.paidAt ? new Date(p.paidAt).toLocaleDateString("ko-KR") : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {["paid", "partial_refunded"].includes(p.status) && (
                      refunding === p.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={refundReason}
                            onChange={(e) => setRefundReason(e.target.value)}
                            placeholder="환불 사유"
                            className="border border-gray-200 rounded px-2 py-1 text-xs w-24"
                          />
                          <button onClick={() => handleRefund(p.id)} className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-500">확인</button>
                          <button onClick={() => { setRefunding(null); setRefundReason(""); }} className="text-xs text-gray-400 hover:text-gray-600">취소</button>
                        </div>
                      ) : (
                        <button onClick={() => setRefunding(p.id)} className="text-xs text-red-600 hover:text-red-800 font-medium">환불</button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => load(page - 1)} className="px-3 py-1 text-sm border rounded disabled:opacity-30">이전</button>
          <span className="text-sm text-gray-500">{page} / {totalPages} ({total}건)</span>
          <button disabled={page >= totalPages} onClick={() => load(page + 1)} className="px-3 py-1 text-sm border rounded disabled:opacity-30">다음</button>
        </div>
      )}
      </>)}

      {/* 크루즈닷몰 B2C 탭 — 읽기 전용 */}
      {tab === "mall" && (
        <>
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름, 전화번호, 상품명 검색"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              onKeyDown={(e) => e.key === "Enter" && loadMallPayments(1)}
            />
            <button onClick={() => loadMallPayments(1)} className="bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium">검색</button>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">상품명</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">고객</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">금액</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">PG</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">결제일</th>
                </tr>
              </thead>
              <tbody>
                {mallLoading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">불러오는 중...</td></tr>
                ) : mallPayments.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">결제 내역이 없습니다</td></tr>
                ) : mallPayments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.productName ?? "-"}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{p.buyerName}</p>
                      <p className="text-xs text-gray-400">{maskPhone(p.buyerTel)}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{p.amount.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.status === "paid" ? "text-emerald-700 bg-emerald-50" :
                        p.status === "cancelled" ? "text-red-700 bg-red-50" : "text-gray-600 bg-gray-100"
                      }`}>{p.status === "paid" ? "결제완료" : p.status === "cancelled" ? "취소" : p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">{p.pgProvider ?? "-"}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString("ko-KR") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mallTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button disabled={mallPage <= 1} onClick={() => loadMallPayments(mallPage - 1)} className="px-3 py-1 text-sm border rounded disabled:opacity-30">이전</button>
              <span className="text-sm text-gray-500">{mallPage} / {mallTotalPages} ({mallTotal}건)</span>
              <button disabled={mallPage >= mallTotalPages} onClick={() => loadMallPayments(mallPage + 1)} className="px-3 py-1 text-sm border rounded disabled:opacity-30">다음</button>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-3 text-center">크루즈닷몰(웰컴페이먼츠) 결제 내역 — 읽기 전용</p>
        </>
      )}

      {/* 정기결제 탭 */}
      {tab === "subscriptions" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">상품명</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">고객</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">월 금액</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">결제일</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">만료일</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody>
              {subLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">불러오는 중...</td></tr>
              ) : subscriptions.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">정기결제 내역이 없습니다</td></tr>
              ) : subscriptions.map((s) => {
                const st = SUB_STATUS[s.status] ?? { label: s.status, color: "text-gray-500 bg-gray-100" };
                return (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.goodname}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{s.customerName}</p>
                      <p className="text-xs text-gray-400">{maskPhone(s.customerPhone)}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{s.goodprice.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-center text-sm">매월 {s.cycleDay === 90 ? "말일" : `${s.cycleDay}일`}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      {new Date(s.expireDate).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {s.status === "active" && (
                          <button onClick={() => handleSubAction(s.id, "pause")} className="text-xs text-amber-600 hover:text-amber-800 font-medium">일시정지</button>
                        )}
                        {s.status === "paused" && (
                          <button onClick={() => handleSubAction(s.id, "resume")} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">재시작</button>
                        )}
                        {s.status !== "cancelled" && (
                          cancelling === s.id ? (
                            <div className="flex items-center gap-1">
                              <input type="text" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="해지 사유" className="border border-gray-200 rounded px-2 py-1 text-xs w-24" />
                              <button onClick={() => { handleSubAction(s.id, "cancel"); setCancelling(null); setCancelReason(""); }} className="text-xs bg-red-600 text-white px-2 py-1 rounded">확인</button>
                              <button onClick={() => { setCancelling(null); setCancelReason(""); }} className="text-xs text-gray-400">취소</button>
                            </div>
                          ) : (
                            <button onClick={() => setCancelling(s.id)} className="text-xs text-red-600 hover:text-red-800 font-medium">해지</button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
