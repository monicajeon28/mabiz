"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X, Copy, Check, Link2, Play } from "lucide-react";

interface ImageItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  fullUrl: string;
  folder: string;
  tags: string | null;
  isGif: boolean;
  isVideo: boolean;
}

interface ImageLibraryModalProps {
  open: boolean;
  onClose: () => void;
  /** 선택 시 HTML 코드를 반환 */
  onInsert: (html: string) => void;
}

const FOLDERS = ["전체", "지중해", "카리브해", "알래스카", "선박", "객실", "후기", "기타"];

export function ImageLibraryModal({ open, onClose, onInsert }: ImageLibraryModalProps) {
  const [tab, setTab]           = useState<"library" | "url" | "youtube">("library");
  const [items, setItems]       = useState<ImageItem[]>([]);
  const [q, setQ]               = useState("");
  const [folder, setFolder]     = useState("전체");
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState<ImageItem | null>(null);
  const [copied, setCopied]     = useState(false);

  // 직접 URL 입력
  const [urlInput, setUrlInput]   = useState("");
  const [altInput, setAltInput]   = useState("");
  // YouTube
  const [ytInput, setYtInput]     = useState("");
  const [ytWidth, setYtWidth]     = useState("100%");

  const fetchImages = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (folder !== "전체") params.set("folder", folder);
    const res  = await fetch(`/api/image-library?${params}`);
    const data = await res.json();
    if (data.ok) setItems(data.images);
    setLoading(false);
  }, [q, folder]);

  useEffect(() => {
    if (open && tab === "library") fetchImages();
  }, [open, tab, fetchImages]);

  // YouTube videoId 추출
  const extractYtId = (url: string) => {
    const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
    return m?.[1] ?? null;
  };

  const buildImageHtml = (item: ImageItem) => {
    if (item.isGif) {
      // GIF: img 태그 (animation 유지)
      return `<img src="${item.fullUrl}" alt="${item.title}" style="max-width:100%;height:auto;" loading="lazy">`;
    }
    // 일반 이미지: webp 우선 + fallback
    return `<picture>\n  <source srcset="${item.fullUrl}" type="image/webp">\n  <img src="${item.thumbnailUrl}" alt="${item.title}" style="max-width:100%;height:auto;" loading="lazy">\n</picture>`;
  };

  const buildUrlHtml = () => {
    const url = urlInput.trim();
    if (!url) return "";
    const isGif = url.toLowerCase().endsWith(".gif");
    if (isGif) {
      return `<img src="${url}" alt="${altInput || "이미지"}" style="max-width:100%;height:auto;" loading="lazy">`;
    }
    return `<img src="${url}" alt="${altInput || "이미지"}" style="max-width:100%;height:auto;" loading="lazy">`;
  };

  const buildYtHtml = () => {
    const id = extractYtId(ytInput.trim());
    if (!id) return "";
    return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:${ytWidth};">\n  <iframe src="https://www.youtube.com/embed/${id}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allowfullscreen loading="lazy" title="YouTube video"></iframe>\n</div>`;
  };

  const handleCopy = (html: string) => {
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = (html: string) => {
    onInsert(html);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-navy-900">이미지 / 영상 라이브러리</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-200 px-5">
          {[
            { key: "library", label: "📁 라이브러리" },
            { key: "url",     label: "🔗 URL 직접 입력" },
            { key: "youtube", label: "▶ YouTube" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-gold-500 text-navy-900"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* 라이브러리 탭 */}
          {tab === "library" && (
            <div>
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="이미지 검색..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
                  />
                </div>
                <div className="flex gap-1 flex-wrap">
                  {FOLDERS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setFolder(f)}
                      className={`px-2.5 py-1.5 text-xs rounded-full border transition-colors ${
                        folder === f
                          ? "bg-navy-900 text-white border-navy-900"
                          : "bg-white text-gray-600 border-gray-200 hover:border-navy-900"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="aspect-square bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-3xl mb-2">🖼️</p>
                  <p className="text-sm">이미지가 없습니다</p>
                  <p className="text-xs mt-1">Google Drive와 동기화가 필요할 수 있습니다</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {items.map((item) => {
                    const html = buildImageHtml(item);
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelected(selected?.id === item.id ? null : item)}
                        className={`relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all group ${
                          selected?.id === item.id
                            ? "border-gold-500 shadow-md"
                            : "border-transparent hover:border-gray-300"
                        }`}
                      >
                        <div className="aspect-square bg-gray-100">
                          {item.isGif ? (
                            // GIF: 실제 애니메이션 표시
                            <img
                              src={item.fullUrl}
                              alt={item.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <img
                              src={item.thumbnailUrl || item.fullUrl}
                              alt={item.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          )}
                          {item.isGif && (
                            <span className="absolute top-1 right-1 bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded font-bold">
                              GIF
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 px-1 py-1 truncate">{item.title}</p>

                        {/* 호버 액션 */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-xl">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopy(html); }}
                            className="p-2 bg-white rounded-lg text-gray-700 hover:bg-gold-100"
                            title="HTML 코드 복사"
                          >
                            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleInsert(html); }}
                            className="p-2 bg-gold-500 rounded-lg text-white hover:bg-gold-300"
                            title="에디터에 삽입"
                          >
                            <Link2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* URL 직접 입력 탭 */}
          {tab === "url" && (
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이미지 URL</label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/image.webp"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
                />
                <p className="text-xs text-gray-400 mt-1">webp, jpg, png, gif 모두 지원</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">대체 텍스트 (alt)</label>
                <input
                  type="text"
                  value={altInput}
                  onChange={(e) => setAltInput(e.target.value)}
                  placeholder="이미지 설명"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
                />
              </div>

              {urlInput && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-2 font-medium">미리보기</p>
                  <img
                    src={urlInput}
                    alt={altInput || "미리보기"}
                    className="max-h-40 rounded-lg object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}

              {/* HTML 코드 미리보기 */}
              {urlInput && (
                <div className="bg-gray-900 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-2">HTML 코드</p>
                  <code className="text-xs text-green-400 break-all">{buildUrlHtml()}</code>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy(buildUrlHtml())}
                  disabled={!urlInput}
                  className="flex-1 flex items-center justify-center gap-2 border border-gray-200 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  코드 복사
                </button>
                <button
                  onClick={() => handleInsert(buildUrlHtml())}
                  disabled={!urlInput}
                  className="flex-1 bg-navy-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-navy-700 disabled:opacity-40"
                >
                  에디터에 삽입
                </button>
              </div>
            </div>
          )}

          {/* YouTube 탭 */}
          {tab === "youtube" && (
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">YouTube 링크</label>
                <input
                  type="url"
                  value={ytInput}
                  onChange={(e) => setYtInput(e.target.value)}
                  placeholder="https://youtu.be/xxxxx 또는 https://youtube.com/watch?v=xxxxx"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">너비</label>
                <select
                  value={ytWidth}
                  onChange={(e) => setYtWidth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-gold-500"
                >
                  <option value="100%">100% (전체 너비)</option>
                  <option value="80%">80%</option>
                  <option value="560px">560px (고정)</option>
                </select>
              </div>

              {ytInput && extractYtId(ytInput) && (
                <>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-2">미리보기</p>
                    <div className="relative" style={{ paddingBottom: "56.25%" }}>
                      <iframe
                        src={`https://www.youtube.com/embed/${extractYtId(ytInput)}`}
                        className="absolute inset-0 w-full h-full rounded-lg"
                        allowFullScreen
                        title="YouTube"
                      />
                    </div>
                  </div>

                  <div className="bg-gray-900 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-2">HTML 코드</p>
                    <code className="text-xs text-green-400 break-all whitespace-pre-wrap">{buildYtHtml()}</code>
                  </div>
                </>
              )}

              {ytInput && !extractYtId(ytInput) && (
                <p className="text-red-500 text-sm">올바른 YouTube 링크가 아닙니다.</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy(buildYtHtml())}
                  disabled={!extractYtId(ytInput)}
                  className="flex-1 flex items-center justify-center gap-2 border border-gray-200 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  코드 복사
                </button>
                <button
                  onClick={() => handleInsert(buildYtHtml())}
                  disabled={!extractYtId(ytInput)}
                  className="flex-1 bg-navy-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-navy-700 disabled:opacity-40"
                >
                  에디터에 삽입
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 선택된 항목 하단 바 */}
        {selected && tab === "library" && (
          <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
              <img src={selected.thumbnailUrl || selected.fullUrl} alt={selected.title} className="w-full h-full object-cover" />
            </div>
            <p className="text-sm font-medium text-gray-700 flex-1 truncate">{selected.title}</p>
            <button
              onClick={() => handleCopy(buildImageHtml(selected))}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-white"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              코드 복사
            </button>
            <button
              onClick={() => handleInsert(buildImageHtml(selected))}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-700"
            >
              <Play className="w-3.5 h-3.5" /> 삽입
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
