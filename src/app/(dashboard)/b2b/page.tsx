"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Phone, Building2, Users, TrendingUp, Edit2, Trash2, X, ChevronRight } from "lucide-react";

type Prospect = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  companyName: string | null;
  groupSize: number | null;
  packageInterest: string | null;
  budget: string | null;
  preferredDate: string | null;
  destination: string | null;
  notes: string | null;
  status: string;
  source: string | null;
  createdAt: string;
};

type CountRow = { status: string; _count: { id: number } };

const STATUSES = [
  { key: "NEW",         label: "신규",     color: "bg-gray-100  text-gray-700",   dot: "bg-gray-400"   },
  { key: "CONTACTED",   label: "연락함",   color: "bg-blue-100  text-blue-700",   dot: "bg-blue-500"   },
  { key: "NEGOTIATING", label: "협상중",   color: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-500" },
  { key: "WON",         label: "계약성사", color: "bg-green-100 text-green-700",  dot: "bg-green-500"  },
  { key: "LOST",        label: "실패",     color: "bg-red-100   text-red-500",    dot: "bg-red-400"    },
];

const PACKAGES = [
  { value: "330", label: "330만원 패키지", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "540", label: "540만원 패키지", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "750", label: "750만원 패키지", color: "bg-gold-50 text-yellow-800 border-yellow-300" },
];

const EMPTY_FORM = {
  name: "", phone: "", email: "", companyName: "", groupSize: "",
  packageInterest: "", budget: "", preferredDate: "", destination: "", notes: "",
};

export default function B2BPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [counts,    setCounts]    = useState<CountRow[]>([]);
  const [filter,    setFilter]    = useState("");
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [detail,    setDetail]    = useState<Prospect | null>(null);

  const load = useCallback(async (status?: string) => {
    setLoading(true);
    const params = status ? `?status=${status}` : "";
    const res  = await fetch(`/api/b2b${params}`);
    const data = await res.json();
    if (data.ok) {
      setProspects(data.prospects);
      setCounts(data.counts ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(filter || undefined); }, [filter, load]);

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    setSaving(true);
    const res = await fetch("/api/b2b", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        groupSize: form.groupSize ? parseInt(form.groupSize) : undefined,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setShowForm(false);
      setForm(EMPTY_FORM);
      load(filter || undefined);
    }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/b2b/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (data.ok) {
      setProspects((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
      if (detail?.id === id) setDetail({ ...detail, status });
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/b2b/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      setProspects((prev) => prev.filter((p) => p.id !== id));
      if (detail?.id === id) setDetail(null);
    }
  };

  const getCount = (status: string) =>
    counts.find((c) => c.status === status)?._count.id ?? 0;

  const totalCount = counts.reduce((a, c) => a + c._count.id, 0);
  const wonCount   = getCount("WON");

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* 신규 등록 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">B2B 잠재고객 등록</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "name",        label: "이름 *",      placeholder: "홍길동" },
                { key: "phone",       label: "전화번호 *",  placeholder: "010-1234-5678" },
                { key: "companyName", label: "회사/단체명", placeholder: "(주)ABC" },
                { key: "email",       label: "이메일",      placeholder: "abc@example.com" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{f.label}</label>
                  <input
                    value={form[f.key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500"
                  />
                </div>
              ))}
            </div>

            {/* 패키지 선택 */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">관심 패키지</label>
              <div className="flex gap-2">
                {PACKAGES.map((pkg) => (
                  <button
                    key={pkg.value}
                    onClick={() => setForm({ ...form, packageInterest: form.packageInterest === pkg.value ? "" : pkg.value })}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                      form.packageInterest === pkg.value ? pkg.color : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {pkg.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">예상 인원</label>
                <input
                  type="number"
                  value={form.groupSize}
                  onChange={(e) => setForm({ ...form, groupSize: e.target.value })}
                  placeholder="20"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">희망 시기</label>
                <input
                  value={form.preferredDate}
                  onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
                  placeholder="2025년 상반기"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">메모</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
            <Building2 className="w-5 h-5 text-gold-500" /> B2B 잠재고객
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            330/540/750만원 패키지 세일즈 파이프라인 · 총 {totalCount}명
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-navy-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-navy-700"
        >
          <Plus className="w-4 h-4" /> 잠재고객 추가
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-5 gap-2 mb-5">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(filter === s.key ? "" : s.key)}
            className={`bg-white border rounded-xl p-3 text-center transition-all hover:shadow-sm ${
              filter === s.key ? "border-navy-900 ring-2 ring-navy-900/20" : "border-gray-200"
            }`}
          >
            <p className={`text-xs font-medium ${s.color.split(" ")[1]}`}>{s.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{getCount(s.key)}</p>
          </button>
        ))}
      </div>

      {/* 전환율 바 */}
      {totalCount > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 flex items-center gap-3">
          <TrendingUp className="w-4 h-4 text-green-500 shrink-0" />
          <div className="flex-1">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${Math.round((wonCount / totalCount) * 100)}%` }}
              />
            </div>
          </div>
          <p className="text-sm font-semibold text-green-700 shrink-0">
            계약 성사율 {Math.round((wonCount / totalCount) * 100)}%
            <span className="text-xs text-gray-400 font-normal ml-1">({wonCount}/{totalCount})</span>
          </p>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : prospects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">잠재고객이 없습니다. 추가해보세요!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {prospects.map((p) => {
            const statusInfo = STATUSES.find((s) => s.key === p.status) ?? STATUSES[0];
            const pkg = PACKAGES.find((pk) => pk.value === p.packageInterest);
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${statusInfo.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{p.name}</p>
                      {p.companyName && (
                        <span className="text-xs text-gray-500 flex items-center gap-0.5">
                          <Building2 className="w-3 h-3" /> {p.companyName}
                        </span>
                      )}
                      {pkg && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${pkg.color}`}>
                          {pkg.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <a href={`tel:${p.phone}`} className="text-blue-600 hover:underline flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {p.phone}
                      </a>
                      {p.groupSize && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {p.groupSize}명
                        </span>
                      )}
                      {p.preferredDate && <span>📅 {p.preferredDate}</span>}
                      <span>{new Date(p.createdAt).toLocaleDateString("ko-KR")}</span>
                    </div>
                  </div>

                  {/* 상태 변경 버튼들 */}
                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={p.status}
                      onChange={(e) => updateStatus(p.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-lg border font-medium cursor-pointer bg-white ${statusInfo.color}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setDetail(p)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 메모 미리보기 */}
                {p.notes && (
                  <p className="text-xs text-gray-500 mt-2 ml-5 line-clamp-1 italic">"{p.notes}"</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 상세 사이드패널 */}
      {detail && (
        <div className="fixed inset-0 bg-black/30 z-40 flex justify-end" onClick={() => setDetail(null)}>
          <div
            className="bg-white w-full max-w-sm h-full overflow-y-auto p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">{detail.name}</h3>
              <button onClick={() => setDetail(null)} className="text-gray-400"><X className="w-5 h-5" /></button>
            </div>

            {/* 패키지 */}
            {detail.packageInterest && (
              <div className={`text-center py-2 rounded-xl border font-bold ${
                PACKAGES.find((p) => p.value === detail.packageInterest)?.color ?? ""
              }`}>
                {PACKAGES.find((p) => p.value === detail.packageInterest)?.label}
              </div>
            )}

            {/* 정보 */}
            <div className="space-y-2 text-sm">
              {[
                { label: "전화번호",  value: detail.phone },
                { label: "이메일",    value: detail.email },
                { label: "회사/단체", value: detail.companyName },
                { label: "예상 인원", value: detail.groupSize ? `${detail.groupSize}명` : null },
                { label: "희망 시기", value: detail.preferredDate },
                { label: "목적지",    value: detail.destination },
                { label: "예산",      value: detail.budget },
                { label: "유입 경로", value: detail.source },
              ].filter((f) => f.value).map((f) => (
                <div key={f.label} className="flex gap-2">
                  <span className="text-gray-400 w-20 shrink-0">{f.label}</span>
                  <span className="text-gray-900 font-medium">{f.value}</span>
                </div>
              ))}
            </div>

            {detail.notes && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">메모</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{detail.notes}</p>
              </div>
            )}

            {/* 상태 변경 */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">파이프라인 상태</p>
              <div className="grid grid-cols-1 gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => updateStatus(detail.id, s.key)}
                    className={`py-2 px-3 rounded-xl text-sm font-medium text-left flex items-center gap-2 transition-colors ${
                      detail.status === s.key
                        ? `${s.color} border border-current`
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                    {s.label}
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
