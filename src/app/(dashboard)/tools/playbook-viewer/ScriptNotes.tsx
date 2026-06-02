"use client";

import { useState, useEffect } from "react";
import { Save, Trash2, Edit2, FileText } from "lucide-react";
import { logger } from "@/lib/logger";

interface ScriptNote {
  scriptId: string;
  text: string;
  tags: string[];
  updatedAt: number;
}

interface ScriptNotesProps {
  scriptId: string;
  onNoteSaved?: (note: ScriptNote) => void;
}

const STORAGE_KEY = "playbook-script-notes";

export function ScriptNotes({ scriptId, onNoteSaved }: ScriptNotesProps) {
  const [noteText, setNoteText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 로드
  useEffect(() => {
    const loadNote = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const notes: Record<string, ScriptNote> = JSON.parse(stored);
          const note = notes[scriptId];
          if (note) {
            setNoteText(note.text);
            setTags(note.tags || []);
            setLastUpdated(new Date(note.updatedAt));
          }
        }
      } catch (error) {
        logger.error("script-notes:load", error);
      }
    };

    loadNote();
  }, [scriptId]);

  const saveNote = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || "{}";
      const notes: Record<string, ScriptNote> = JSON.parse(stored);

      const updatedNote: ScriptNote = {
        scriptId,
        text: noteText,
        tags,
        updatedAt: Date.now(),
      };

      notes[scriptId] = updatedNote;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));

      setLastUpdated(new Date());
      setIsEditing(false);
      onNoteSaved?.(updatedNote);
    } catch (error) {
      logger.error("script-notes:save", error);
    }
  };

  const deleteNote = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || "{}";
      const notes: Record<string, ScriptNote> = JSON.parse(stored);
      delete notes[scriptId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));

      setNoteText("");
      setTags([]);
      setLastUpdated(null);
      setIsEditing(false);
    } catch (error) {
      logger.error("script-notes:delete", error);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const hasContent = noteText.trim().length > 0 || tags.length > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-600" />
          <h3 className="font-bold text-gray-900 text-base">개인 노트</h3>
        </div>
        {hasContent && (
          <button
            onClick={() => setIsEditing(!isEditing)}
            aria-label="노트 편집"
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="편집"
          >
            <Edit2 className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      {!isEditing && !hasContent && (
        <button
          onClick={() => setIsEditing(true)}
          className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors text-center text-gray-600 font-medium text-sm"
        >
          + 이 스크립트에 대해 메모하기
        </button>
      )}

      {!isEditing && hasContent && (
        <div className="space-y-3">
          {noteText && (
            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {noteText}
              </p>
            </div>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {lastUpdated && (
            <p className="text-xs text-gray-500">
              마지막 수정: {lastUpdated.toLocaleDateString("ko-KR")} {lastUpdated.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 px-2 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm font-medium rounded transition-colors"
            >
              수정
            </button>
            <button
              onClick={deleteNote}
              aria-label="노트 삭제"
              className="flex-shrink-0 p-1.5 hover:bg-red-100 rounded-lg transition-colors text-red-600"
              title="삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {isEditing && (
        <div className="space-y-3">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="이 스크립트에 대한 개인 메모를 작성하세요..."
            className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-200 text-sm"
            rows={4}
            aria-label="노트 내용"
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              태그 추가
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="태그 입력 후 Enter"
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-sm"
                aria-label="새 태그"
              />
              <button
                onClick={addTag}
                className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm font-medium rounded transition-colors"
              >
                추가
              </button>
            </div>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <div
                  key={tag}
                  className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium"
                >
                  #{tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-1 hover:opacity-70"
                    aria-label={`${tag} 태그 제거`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={saveNote}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" /> 저장
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                // 편집 취소 - 이전 상태로 복원됨
              }}
              className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              취소
            </button>
            {hasContent && (
              <button
                onClick={deleteNote}
                aria-label="노트 삭제"
                className="flex-shrink-0 p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                title="삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
