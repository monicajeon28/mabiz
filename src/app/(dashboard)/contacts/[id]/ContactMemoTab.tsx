"use client";

import { FileText, Plus, Trash2 } from "lucide-react";

interface Memo {
  id: string;
  content: string;
  createdAt: string;
  _authorName?: string | null;
}

interface Contact {
  memos: Memo[];
}

interface ContactMemoTabProps {
  contact: Contact;
  showMemoForm: boolean;
  setShowMemoForm: (show: boolean) => void;
  memoText: string;
  setMemoText: (text: string) => void;
  addMemo: () => Promise<void>;
  deleteMemo: (memoId: string) => Promise<void>;
  deleteAllMemos: () => Promise<void>;
}

export default function ContactMemoTab({
  contact, showMemoForm, setShowMemoForm, memoText, setMemoText,
  addMemo, deleteMemo, deleteAllMemos,
}: ContactMemoTabProps) {
  return (
    <div>
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setShowMemoForm(true)}
          className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-3 text-sm text-gray-500 hover:border-gold-300 hover:text-gold-600 transition-colors"
        >
          <Plus className="w-4 h-4" /> 메모 추가
        </button>
        {contact.memos.length > 0 && (
          <button
            onClick={deleteAllMemos}
            className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-500 rounded-xl text-xs hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> 전체 삭제
          </button>
        )}
      </div>

      {showMemoForm && (
        <div className="bg-white border border-gold-300 rounded-xl p-4 mb-3 space-y-2">
          <textarea
            placeholder="메모 내용..."
            value={memoText}
            onChange={(e) => setMemoText(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gold-500"
          />
          <div className="flex gap-2">
            <button onClick={addMemo} className="flex-1 bg-navy-900 text-white py-2 rounded-lg text-sm font-medium">저장</button>
            <button onClick={() => setShowMemoForm(false)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">취소</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {contact.memos.map((m) => (
          <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between gap-1 mb-1">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <FileText className="w-3 h-3" />
                <span>{new Date(m.createdAt).toLocaleString("ko-KR")}</span>
                {m._authorName && (
                  <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium text-[10px]">
                    {m._authorName}
                  </span>
                )}
              </div>
              <button
                onClick={() => deleteMemo(m.id)}
                className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
        {contact.memos.length === 0 && <p className="text-center text-sm text-gray-400 py-8">메모가 없습니다.</p>}
      </div>
    </div>
  );
}
