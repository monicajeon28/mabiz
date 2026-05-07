"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Phone, X, Trash2, ChevronRight, Search, GraduationCap } from "lucide-react";

type Prospect = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  productName: string | null;
  paymentAmount: number | null;
  paymentDate: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
};

const STATUSES = [
  { key: "잠재고객", color: "bg-blue-100 text-blue-700",    dot: "bg-blue-500"    },
  { key: "문자",     color: "bg-sky-100 text-sky-700",      dot: "bg-sky-500"     },
  { key: "부재",     color: "bg-yellow-100 text-yellow-700",dot: "bg-yellow-500"  },
  { key: "3일부재",  color: "bg-orange-100 text-orange-700",dot: "bg-orange-500"  },
  { key: "소통",     color: "bg-purple-100 text-purple-700",dot: "bg-purple-500"  },
  { key: "구매완료", color: "bg-green-100 text-green-700",  dot: "bg-green-500"   },
  { key: "VIP",      color: "bg-yellow-50 text-yellow-800 font-bold", dot: "bg-yellow-400" },
  { key: "수신거부", color: "bg-gray-100 text-gray-500",    dot: "bg-gray-400"    },
];

const EMPTY_FORM = { name: "", phone: "", email: "", productName: "", paymentAmount: "", paymentDate: "", notes: "", status: "잠재고객" };

export default function BuyersPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [total,     setTotal]     = useState(0);
  const [filter,    setFilter]    = useState("");
  const [q,         setQ]         = useState("");
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [detail,    setDetail]    = useState<Prospect | null>(null);
  const [notesDraft,setNotesDraft]= useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ eduType: "BUYER", page: String(page), limit: "30" });
    if (filter) params.set("status", filter);
    if (q)      params.set("q", q);
    const res  = await fetch(`/api/b2b?${params}`);
    const data = await res.json();
    if (data.ok) { setProspects(data.prospects); setTotal(data.total ?? 0); }
    setLoading(false);
  }, [filter, q, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (detail) setNotesDraft(detail.notes ?? ""); }, [detail]);

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    setSaving(true);
    const res = await fetch("/api/b2b", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        eduType: "BUYER",
        paymentAmount: form.paymentAmount ? parseInt(form.paymentAmount) : undefined,
      }),
    });
    const data = await res.json();
    if (data.ok) { setShowForm(false); setForm(EMPTY_FORM); load(); }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/b2b/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (data.ok) {
      setProspects(prev => prev.map(p => p.id === id ? { ...p, status } : p));
      if (detail?.id === id) setDetail({ ...detail, status });
    }
  };

  const saveNotes = async () => {
    if (!detail || notesDraft === detail.notes) return;
    await fetch(`/api/b2b/${detail.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesDraft }),
    });
    setDetail({ ...detail, notes: notesDraft });
    setProspects(prev => prev.map(p => p.id === detail.id ? { ...p, notes: notesDraft } : p));
  };

  const remove = async (id: string) => {
    if (!confirm("이 구매자를 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/b2b/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) { setProspects(prev => prev.filter(p => p.id !== id)); if (detail?.id === id) setDetail(null); }
  };

  const getStatusInfo = (key: string) => STATUSES.find(s => s.key === key) ?? STATUSES[0];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* 신규 등록 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">교육 구매자 등록</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "name",        label: "이름 *",       placeholder: "홍길동" },
                { key: "phone",       label: "전화번호 *",   placeholder: "010-1234-5678" },
                { key: "email",       label: "이메일",       placeholder: "abc@example.com" },
                { key: "productName", label: "상품명",       placeholder: "2026 크루즈 판매원 교육" },
                { key: "paymentDate", label: "결제일",       placeholder: "2026-05-01" },
              ].map(f => (
                <div key={f.key} className={f.key === "productName" ? "col-span-2" : ""}>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{f.label}</label>
                  <input
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">결제금액 (원)</label>
                <input
                  type="number"
                  value={form.paymentAmount}
                  onChange={e => setForm({ ...form, paymentAmount: e.target.value })}
                  placeholder="330000"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">상태</label>
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                {STATUSES.map(s => <option key={s.key} value={s.key}>{s.key}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">메모</label>
              <textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none"
                placeholder="상담 내용, 특이사항 등"
              />
            </div>
            <button
              onClick={save}
              disabled={saving || !form.name.trim() || !form.phone.trim()}
              className="w-full bg-navy-900 text-white py-2.5 rounded-xl font-medium hover:bg-navy-700 disabled:opacity-40"
            >
              {saving ? "등록 중..." : "등록하기"}
            </button>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-navy-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-gold-500" /> 교육 구매자
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">페이앱 결제 완료 교육생 · 총 {total.toLocaleString()}명</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-700"
        >
          <Plus className="w-4 h-4" /> 구매자 추가
        </button>
      </div>

      {/* 검색 */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="이름, 전화번호, 이메일 검색"
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
          />
        </div>
      </div>

      {/* 상태 필터 탭 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => { setFilter(""); setPage(1); }}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${!filter ? "bg-navy-900 text-white border-navy-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
        >
          전체
        </button>
        {STATUSES.map(s => (
          <button
            key={s.key}
            onClick={() => { setFilter(s.key === filter ? "" : s.key); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filter === s.key ? s.color + " border-current" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            {s.key}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : prospects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">구매자가 없습니다. 추가해보세요!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {prospects.map(p => {
            const si = getStatusInfo(p.status);
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${si.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{p.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${si.color}`}>{p.status}</span>
                      {p.productName && (
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{p.productName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <a href={`tel:${p.phone}`} className="text-blue-600 hover:underline flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {p.phone}
                      </a>
                      {p.email && <span>{p.email}</span>}
                      {p.paymentAmount != null && (
                        <span className="font-medium text-green-700">{p.paymentAmount.toLocaleString()}원</span>
                      )}
                      {p.paymentDate && <span>결제일: {p.paymentDate}</span>}
                      <span>{new Date(p.createdAt).toLocaleDateString("ko-KR")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={p.status}
                      onChange={e => updateStatus(p.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-lg border font-medium cursor-pointer bg-white ${si.color}`}
                    >
                      {STATUSES.map(s => <option key={s.key} value={s.key}>{s.key}</option>)}
                    </select>
                    <button onClick={() => setDetail(p)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(p.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {p.notes && <p className="text-xs text-gray-400 mt-2 ml-5 line-clamp-1 italic">&quot;{p.notes}&quot;</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* 페이지네이션 */}
      {total > 30 && (
        <div className="flex justify-center gap-2 mt-6">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">이전</button>
          <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {Math.ceil(total / 30)}</span>
          <button disabled={page >= Math.ceil(total / 30)} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">다음</button>
        </div>
      )}

      {/* 상세 사이드패널 */}
      {detail && (
        <div className="fixed inset-0 bg-black/30 z-40 flex justify-end" onClick={() => setDetail(null)}>
          <div className="bg-white w-full max-w-sm h-full overflow-y-auto p-6 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">{detail.name}</h3>
              <button onClick={() => setDetail(null)} className="text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                { label: "전화번호", value: detail.phone },
                { label: "이메일",   value: detail.email },
                { label: "상품명",   value: detail.productName },
                { label: "결제금액", value: detail.paymentAmount != null ? `${detail.paymentAmount.toLocaleString()}원` : null },
                { label: "결제일",   value: detail.paymentDate },
              ].filter(f => f.value).map(f => (
                <div key={f.label} className="flex gap-2">
                  <span className="text-gray-400 w-20 shrink-0">{f.label}</span>
                  <span className="text-gray-900 font-medium">{f.value}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">메모</p>
              <textarea
                value={notesDraft}
                onChange={e => setNotesDraft(e.target.value)}
                onBlur={saveNotes}
                rows={4}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-navy-900"
                placeholder="메모 입력..."
              />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">상태 변경</p>
              <div className="grid grid-cols-1 gap-1.5">
                {STATUSES.map(s => (
                  <button key={s.key} onClick={() => updateStatus(detail.id, s.key)}
                    className={`py-2 px-3 rounded-xl text-sm font-medium text-left flex items-center gap-2 transition-colors ${
                      detail.status === s.key ? `${s.color} border border-current` : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}>
                    <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                    {s.key}
                    {detail.status === s.key && <span className="ml-auto text-xs">✓ 현재</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
