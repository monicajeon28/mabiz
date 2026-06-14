"use client";

import { memo } from "react";
import {
  ArrowLeft, Phone, FileDown, Share2, MessageSquare, AlarmClock, ChevronDown, Calendar,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { RecommendBanner } from "./recommend-banner";
import { maskPhone } from "@/lib/masking";
import { Contact } from "@/types/contact";

interface TransferLog {
  id: string;
  createdAt: string;
  transferType: string;
  newContactId: string | null;
  transferredBy: string;
  fromOrg: { name: string } | null;
  toOrg: { name: string } | null;
  toUserName: string | null;
  toUserOrgName: string | null;
  canRecall: boolean;
}

interface ContactInfoPanelProps {
  contact: Contact;
  editingName: boolean;
  setEditingName: (editing: boolean) => void;
  nameInput: string;
  setNameInput: (name: string) => void;
  saveName: () => Promise<void>;
  backingContact: boolean;
  handleContactBackup: () => Promise<void>;
  openSendDb: () => Promise<void>;
  showSchedModal: boolean;
  openSchedModal: () => void;
  closeSchedModal: () => void;
  showSmsModal: boolean;
  openSmsModal: () => void;
  transferLogs: TransferLog[];
  recalling: boolean;
  handleRecall: (log: TransferLog) => Promise<void>;
  showDeptForm: boolean;
  setShowDeptForm: (show: boolean) => void;
  deptForm: { departureDate: string; productName: string; bookingRef: string };
  setDeptForm: (form: { departureDate: string; productName: string; bookingRef: string }) => void;
  savingDept: boolean;
  saveDeparture: () => Promise<void>;
  savingField: string | null;
  saveField: (field: string, value: string | null) => Promise<void>;
  tags: string[];
  tagInput: string;
  setTagInput: (input: string) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  savingTags: boolean;
  currentGroups: { id: string; name: string }[];
  SUGGESTED_TAGS: string[];
}

function ContactInfoPanelComponent({
  contact, editingName, setEditingName, nameInput, setNameInput, saveName,
  backingContact, handleContactBackup, openSendDb, showSchedModal: _showSchedModal, openSchedModal, closeSchedModal: _closeSchedModal,
  showSmsModal: _showSmsModal, openSmsModal, transferLogs, recalling, handleRecall,
  showDeptForm, setShowDeptForm, deptForm, setDeptForm, savingDept, saveDeparture,
  savingField, saveField, tags, tagInput, setTagInput, addTag, removeTag, savingTags,
  currentGroups, SUGGESTED_TAGS,
}: ContactInfoPanelProps) {
  const router = useRouter();
  const inquiryTracking = contact.surveyData?.inquiryTracking ?? null;
  const hasInquiryTracking = !!inquiryTracking && (
    !!inquiryTracking.timestamp ||
    !!inquiryTracking.capturedAt ||
    !!inquiryTracking.source ||
    !!inquiryTracking.productName ||
    !!inquiryTracking.productCode ||
    !!inquiryTracking.pageUrl ||
    !!inquiryTracking.userAgent ||
    !!inquiryTracking.deviceType ||
    !!inquiryTracking.ip ||
    typeof inquiryTracking.isGold === "boolean"
  );

  return (
    <>
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="뒤로 가기"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {editingName ? (
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
            className="text-xl font-bold text-navy-900 flex-1 border-b-2 border-purple-400 outline-none bg-transparent"
          />
        ) : (
          <h1
            className="text-xl font-bold text-navy-900 flex-1 cursor-pointer hover:text-purple-700 transition-colors"
            onClick={() => { setNameInput(contact.name); setEditingName(true); }}
            title="클릭하여 이름 수정"
          >
            {contact.name}
          </h1>
        )}
        <a
          href={`tel:${contact.phone}`}
          className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={`통화: ${maskPhone(contact.phone)}`}
          title="전화 걸기"
        >
          <Phone className="w-5 h-5" />
        </a>
        <button
          onClick={handleContactBackup}
          disabled={backingContact}
          className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="이 고객 Drive 백업"
          title="이 고객 Drive 백업"
        >
          {backingContact
            ? <span className="text-xs px-1">...</span>
            : <FileDown className="w-5 h-5" />
          }
        </button>
        <button
          onClick={contact.sourceOrgId ? undefined : openSendDb}
          disabled={!!contact.sourceOrgId}
          className={`p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${contact.sourceOrgId ? "bg-gray-100 text-gray-300 cursor-not-allowed" : "bg-purple-50 text-purple-600 hover:bg-purple-100"}`}
          aria-label={contact.sourceOrgId ? "DB 전달 (공유받은 DB는 재공유 불가)" : "DB 전달"}
          title={contact.sourceOrgId ? "공유받은 DB는 재공유할 수 없습니다" : "DB 전달"}
        >
          <Share2 className="w-5 h-5" />
        </button>
        <button
          onClick={openSmsModal}
          className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500"
          aria-label="SMS 즉시 발송"
          title="SMS 즉시 발송"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
        <button
          onClick={openSchedModal}
          className="p-2 bg-orange-50 text-orange-500 rounded-lg hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
          aria-label="SMS 예약 발송"
          title="SMS 예약 발송"
        >
          <AlarmClock className="w-5 h-5" />
        </button>
      </div>

      {/* 전달됨 뱃지 */}
      {transferLogs.length > 0 && (() => {
        const latest = transferLogs[0];
        const targetName = latest.toUserName ?? latest.toUserOrgName ?? "알 수 없음";
        return (
          <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl px-4 py-2.5 mb-4">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-purple-500 shrink-0" />
              <div>
                <span className="text-sm font-semibold text-purple-700">→ {targetName}</span>
                <span className="text-xs text-purple-400 ml-2">({latest.toUserOrgName ?? latest.toOrg?.name ?? "본사"})</span>
                <p className="text-xs text-purple-400 mt-0.5">
                  {new Date(latest.createdAt).toLocaleDateString("ko-KR")} 전달
                  {latest.transferType === "ORG_COPY" && " · 복사본 공유"}
                </p>
              </div>
            </div>
            {latest.canRecall && (
              <button
                onClick={() => handleRecall(latest)}
                disabled={recalling}
                className="text-xs text-red-500 hover:text-red-700 hover:underline font-medium disabled:opacity-50 shrink-0 ml-2"
              >
                {recalling ? "회수 중..." : "회수하기"}
              </button>
            )}
          </div>
        );
      })()}

      {/* 상품 추천 배너 */}
      <RecommendBanner
        age={contact.age}
        maritalStatus={contact.maritalStatus}
        childrenCount={contact.childrenCount}
        contactId={contact.id}
      />

      {/* 기본 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-400">전화번호</span><p className="font-medium mt-0.5 font-mono">{maskPhone(contact.phone)}</p></div>

          {contact.inflowDate && (
            <div><span className="text-gray-400">유입날짜</span><p className="font-medium mt-0.5">{new Date(contact.inflowDate).toLocaleDateString("ko-KR")}</p></div>
          )}

          {/* 상태 — 인라인 드롭다운 */}
          <div>
            <span className="text-gray-400">상태</span>
            <div className="mt-0.5 relative">
              <select
                value={
                  contact.type === 'LEAD' || contact.type === 'INQUIRY' ? '잠재고객' :
                  contact.type === 'CUSTOMER' || contact.type === 'PURCHASED' ? '구매완료' :
                  contact.type
                }
                disabled={savingField === "type"}
                onChange={(e) => saveField("type", e.target.value)}
                className="w-full font-medium bg-transparent border-0 border-b border-dashed border-gray-300 focus:outline-none focus:border-navy-500 pr-5 py-0 cursor-pointer text-sm appearance-none"
              >
                <option value="잠재고객">🔵 잠재고객</option>
                <option value="문자">💬 문자</option>
                <option value="부재">📵 부재</option>
                <option value="3일부재">⏰ 3일부재</option>
                <option value="소통">🤝 소통</option>
                <option value="구매완료">✅ 구매완료</option>
                <option value="VIP">⭐ VIP</option>
                <option value="수신거부">🚫 수신거부</option>
              </select>
              <ChevronDown className="absolute right-0 top-0.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              {savingField === "type" && <span className="text-xs text-gray-400 absolute -bottom-4 left-0">저장 중...</span>}
            </div>
          </div>

          {/* 관심 크루즈 — 인라인 드롭다운 */}
          <div>
            <span className="text-gray-400">관심 크루즈</span>
            <div className="mt-0.5 relative">
              <select
                value={contact.cruiseInterest ?? ""}
                disabled={savingField === "cruiseInterest"}
                onChange={(e) => saveField("cruiseInterest", e.target.value || null)}
                className="w-full font-medium text-gold-600 bg-transparent border-0 border-b border-dashed border-gray-300 focus:outline-none focus:border-navy-500 pr-5 py-0 cursor-pointer text-sm appearance-none"
              >
                <option value="">선택 안함</option>
                <option value="지중해">🌊 지중해</option>
                <option value="카리브해">🏝️ 카리브해</option>
                <option value="알래스카">🏔️ 알래스카</option>
                <option value="북유럽">❄️ 북유럽</option>
                <option value="동남아">🌴 동남아</option>
                <option value="발틱해">🚢 발틱해</option>
                <option value="국내출발">🇰🇷 국내출발</option>
                <option value="국내근처">🗺️ 국내근처</option>
                <option value="기타">기타</option>
              </select>
              <ChevronDown className="absolute right-0 top-0.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              {savingField === "cruiseInterest" && <span className="text-xs text-gray-400 absolute -bottom-4 left-0">저장 중...</span>}
            </div>
          </div>
        </div>

        {/* 출발일 + 상품 정보 */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-gold-500" />
              VIP 케어 출발 정보
            </p>
            <button
              onClick={() => setShowDeptForm(!showDeptForm)}
              className="text-xs text-blue-600 hover:underline"
            >
              {contact.departureDate ? "수정" : "입력"}
            </button>
          </div>

          {contact.departureDate ? (
            <div className="bg-gold-100 rounded-lg p-3 space-y-1">
              <p className="text-sm font-bold text-navy-900">
                🗓 출발일: {new Date(contact.departureDate).toLocaleDateString("ko-KR")}
              </p>
              {contact.productName && (
                <p className="text-sm text-gray-700">🚢 상품: {contact.productName}</p>
              )}
              {contact.bookingRef && (
                <p className="text-sm text-gray-700">📋 예약번호: {contact.bookingRef}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">출발일 미입력 — 입력하면 D-150~D+2 자동 계산</p>
          )}

          {showDeptForm && (
            <div className="mt-3 space-y-2 bg-gray-50 rounded-xl p-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">출발일 *</label>
                <input
                  type="date"
                  value={deptForm.departureDate}
                  onChange={(e) => setDeptForm({ ...deptForm, departureDate: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500 focus:ring-2 focus:ring-blue-500"
                  aria-label="출발일"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">크루즈 상품명</label>
                <select
                  value={deptForm.productName}
                  onChange={(e) => setDeptForm({ ...deptForm, productName: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500 focus:ring-2 focus:ring-blue-500 bg-white"
                  aria-label="크루즈 상품명"
                >
                  <option value="">상품 선택...</option>
                  <optgroup label="지중해">
                    <option value="지중해 7박 MSC 크루즈">지중해 7박 MSC</option>
                    <option value="지중해 14박 MSC 크루즈">지중해 14박 MSC</option>
                    <option value="지중해 7박 코스타 크루즈">지중해 7박 코스타</option>
                  </optgroup>
                  <optgroup label="북유럽·발틱">
                    <option value="북유럽 12박 크루즈">북유럽 12박</option>
                    <option value="발틱해 10박 크루즈">발틱해 10박</option>
                  </optgroup>
                  <optgroup label="알래스카">
                    <option value="알래스카 7박 크루즈">알래스카 7박</option>
                  </optgroup>
                  <optgroup label="카리브해">
                    <option value="카리브해 7박 크루즈">카리브해 7박</option>
                    <option value="카리브해 14박 크루즈">카리브해 14박</option>
                  </optgroup>
                  <optgroup label="동남아">
                    <option value="동남아 5박 크루즈">동남아 5박</option>
                    <option value="동남아 7박 크루즈">동남아 7박</option>
                  </optgroup>
                  <optgroup label="국내">
                    <option value="국내출발 크루즈">국내출발</option>
                    <option value="국내근처 크루즈">국내근처</option>
                  </optgroup>
                  <option value="직접입력">직접입력 (하단 메모 활용)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">예약 번호</label>
                <input
                  type="text"
                  value={deptForm.bookingRef}
                  onChange={(e) => setDeptForm({ ...deptForm, bookingRef: e.target.value })}
                  placeholder="PNR 또는 예약 번호"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold-500 focus:ring-2 focus:ring-blue-500"
                  aria-label="예약 번호"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveDeparture}
                  disabled={savingDept || !deptForm.departureDate}
                  className="flex-1 bg-navy-900 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="출발일 저장"
                >
                  {savingDept ? "저장 중..." : "저장"}
                </button>
                <button
                  onClick={() => setShowDeptForm(false)}
                  className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  aria-label="출발일 입력 취소"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 현재 그룹 태그 */}
        {currentGroups.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-3">
            {currentGroups.map((g) => (
              <span key={g.id} className="text-xs px-2 py-1 bg-navy-100 text-navy-900 rounded-full">
                {g.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 태그 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">🏷️ 태그</p>
          {savingTags && <span className="text-xs text-gray-400">저장 중...</span>}
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="text-blue-400 hover:text-blue-700 ml-0.5 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                aria-label={`태그 ${tag} 제거`}
              >×</button>
            </span>
          ))}
          {tags.length === 0 && (
            <p className="text-xs text-gray-400">태그 없음 — 아래에서 추가하세요</p>
          )}
        </div>

        <div className="flex gap-2 mb-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); setTagInput(""); } }}
            placeholder="태그 직접 입력 후 Enter"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500"
            aria-label="태그 입력"
          />
          <button
            onClick={() => { addTag(tagInput); setTagInput(""); }}
            disabled={!tagInput.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="태그 추가"
          >추가</button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).slice(0, 12).map((tag) => (
            <button
              key={tag}
              onClick={() => addTag(tag)}
              className="text-xs bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 px-2 py-0.5 rounded-full transition-colors"
            >
              + {tag}
            </button>
          ))}
        </div>
      </div>

      {/* 설문 응답 */}
      {contact.surveyData && (contact.surveyData.q1 || contact.surveyData.q2 || contact.surveyData.q3) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">📋 설문 응답</h3>
          <div className="space-y-1.5">
            {contact.surveyData.q1 && (
              <div className="flex gap-2 text-sm">
                <span className="text-gray-400 shrink-0 w-12">설문1</span>
                <span className="text-gray-800">{contact.surveyData.q1}</span>
              </div>
            )}
            {contact.surveyData.q2 && (
              <div className="flex gap-2 text-sm">
                <span className="text-gray-400 shrink-0 w-12">설문2</span>
                <span className="text-gray-800">{contact.surveyData.q2}</span>
              </div>
            )}
            {contact.surveyData.q3 && (
              <div className="flex gap-2 text-sm">
                <span className="text-gray-400 shrink-0 w-12">설문3</span>
                <span className="text-gray-800">{contact.surveyData.q3}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {hasInquiryTracking && inquiryTracking && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">🔎 문의 추적 정보</h3>
          <div className="space-y-1.5 text-sm">
            {(inquiryTracking.timestamp || inquiryTracking.capturedAt) && (
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0 w-20">수집시각</span>
                <span className="text-gray-800">{inquiryTracking.timestamp || inquiryTracking.capturedAt}</span>
              </div>
            )}
            {inquiryTracking.source && (
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0 w-20">출처</span>
                <span className="text-gray-800">{inquiryTracking.source}</span>
              </div>
            )}
            {inquiryTracking.productName && (
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0 w-20">상품명</span>
                <span className="text-gray-800">{inquiryTracking.productName}</span>
              </div>
            )}
            {inquiryTracking.productCode && (
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0 w-20">상품코드</span>
                <span className="text-gray-800 font-mono text-xs">{inquiryTracking.productCode}</span>
              </div>
            )}
            {inquiryTracking.pageUrl && (
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0 w-20">페이지</span>
                <a
                  href={inquiryTracking.pageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {inquiryTracking.pageUrl}
                </a>
              </div>
            )}
            {inquiryTracking.ip && (
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0 w-20">IP</span>
                <span className="text-gray-800 font-mono text-xs">{inquiryTracking.ip}</span>
              </div>
            )}
            {inquiryTracking.deviceType && (
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0 w-20">기기</span>
                <span className="text-gray-800">{inquiryTracking.deviceType}</span>
              </div>
            )}
            {inquiryTracking.userAgent && (
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0 w-20">브라우저</span>
                <span className="text-gray-800 break-all">{inquiryTracking.userAgent}</span>
              </div>
            )}
            {typeof inquiryTracking.isGold === "boolean" && (
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0 w-20">골드 문의</span>
                <span className="text-gray-800">{inquiryTracking.isGold ? "예" : "아니오"}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 결제 상태 */}
      {contact.lastPaymentStatus && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-1">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">결제 정보</h3>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              contact.lastPaymentStatus === 'PAID' || contact.lastPaymentStatus === 'SUCCESS'
                ? 'bg-green-100 text-green-700'
                : contact.lastPaymentStatus === 'FAILED' || contact.lastPaymentStatus === 'DECLINED_PRICE'
                ? 'bg-red-100 text-red-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {contact.lastPaymentStatus}
            </span>
            {contact.lastPaymentAt && (
              <span className="text-xs text-gray-400">
                {new Date(contact.lastPaymentAt).toLocaleDateString('ko-KR')}
              </span>
            )}
          </div>
          {contact.paymentStatusNote && (
            <p className="text-xs text-gray-500 mt-1">{contact.paymentStatusNote}</p>
          )}
          {contact.lastRefundedAt && (
            <p className="text-xs text-red-500">
              환불: {new Date(contact.lastRefundedAt).toLocaleDateString('ko-KR')}
            </p>
          )}
        </div>
      )}
    </>
  );
}

export default memo(ContactInfoPanelComponent);
