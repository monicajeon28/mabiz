"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { html } from "@codemirror/lang-html";
import { oneDark } from "@codemirror/theme-one-dark";
import { Image, Loader2, Sparkles } from "lucide-react";
import { ImageLibraryModal } from "@/components/image-library/ImageLibraryModal";

// CodeMirror SSR 방지
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false });

interface HtmlEditorProps {
  value: string;
  onChange: (val: string) => void;
  height?: string;
}

export function HtmlEditor({ value, onChange, height = "400px" }: HtmlEditorProps) {
  const [showImageLibrary, setShowImageLibrary] = useState(false);
  const [aiLoading, setAiLoading]               = useState(false);
  const [aiPrompt, setAiPrompt]                 = useState("");
  const [showAiInput, setShowAiInput]           = useState(false);

  // 이미지 HTML을 커서 위치가 아닌 끝에 삽입 (CodeMirror 커서 위치 삽입은 ref 필요)
  const handleInsert = useCallback(
    (html: string) => {
      onChange(value + "\n" + html);
    },
    [value, onChange]
  );

  // AI 초안 생성
  const generateAiDraft = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res  = await fetch("/api/tools/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      const data = await res.json();
      if (data.ok && data.html) {
        onChange(data.html);
        setShowAiInput(false);
        setAiPrompt("");
      }
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* 툴바 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-700">
        <span className="text-xs text-gray-400 font-mono">HTML 에디터</span>
        <div className="flex-1" />
        <button
          onClick={() => setShowImageLibrary(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-700 text-gray-200 rounded text-xs hover:bg-gray-600 transition-colors"
        >
          <Image className="w-3.5 h-3.5" />
          이미지 / 영상
        </button>
        <button
          onClick={() => setShowAiInput(!showAiInput)}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-gold-500/20 text-gold-300 rounded text-xs hover:bg-gold-500/30 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI 초안
        </button>
      </div>

      {/* AI 프롬프트 입력 */}
      {showAiInput && (
        <div className="flex gap-2 p-3 bg-gray-800 border-b border-gray-700">
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") generateAiDraft(); }}
            placeholder="예: 7월 지중해 크루즈 특가 이벤트 랜딩페이지"
            className="flex-1 bg-gray-700 text-gray-200 text-sm px-3 py-1.5 rounded-lg border border-gray-600 focus:outline-none focus:border-gold-500 placeholder:text-gray-500"
          />
          <button
            onClick={generateAiDraft}
            disabled={aiLoading || !aiPrompt.trim()}
            className="px-3 py-1.5 bg-gold-500 text-navy-900 rounded-lg text-sm font-medium hover:bg-gold-300 disabled:opacity-50 flex items-center gap-1"
          >
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            생성
          </button>
        </div>
      )}

      {/* CodeMirror 에디터 */}
      <CodeMirror
        value={value}
        height={height}
        extensions={[html()]}
        theme={oneDark}
        onChange={onChange}
        style={{ fontSize: "13px" }}
      />

      {/* 이미지 라이브러리 모달 */}
      <ImageLibraryModal
        open={showImageLibrary}
        onClose={() => setShowImageLibrary(false)}
        onInsert={handleInsert}
      />
    </div>
  );
}
