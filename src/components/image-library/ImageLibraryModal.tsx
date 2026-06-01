"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, Copy, Check, Link2, Play, Trash2, FolderPlus, Loader2, RefreshCw } from "lucide-react";

interface ImageItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  fullUrl: string;
  folder: string;
  tags: string | null;
  isGif: boolean;
  isVideo: boolean;
  source: "cache" | "asset";
  driveFileId?: string; // asset 이미지만 존재 (Drive URL 생성용)
}

interface ImageLibraryModalProps {
  open: boolean;
  onClose: () => void;
  /** 선택 시 HTML 코드를 반환 */
  onInsert: (html: string) => void;
}

const DEFAULT_FOLDERS = ["전체", "지중해", "카리브해", "알래스카", "선박", "객실", "후기", "기타"];

export function ImageLibraryModal({ open, onClose, onInsert }: ImageLibraryModalProps) {
  const [tab, setTab]           = useState<"library" | "url" | "youtube">("library");
  const [items, setItems]       = useState<ImageItem[]>([]);
  const [q, setQ]               = useState("");
  const [folder, setFolder]     = useState("전체");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [selected, setSelected] = useState<ImageItem | null>(null);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);

  // 직접 URL 입력
  const [urlInput, setUrlInput]   = useState("");
  const [altInput, setAltInput]   = useState("");
  // YouTube
  const [ytInput, setYtInput]     = useState("");
  const [ytWidth, setYtWidth]     = useState("100%");

  // 업로드
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 폴더 관리
  const [folders, setFolders]           = useState<string[]>(DEFAULT_FOLDERS);
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // 인라인 타이틀 편집
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const fetchImages = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (folder !== "전체") params.set("folder", folder);
    try {
      const res  = await fetch(`/api/image-library?${params}`);
      if (!res.ok) {
        setError("이미지를 불러올 수 없습니다");
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.ok) {
        setItems(data.images);
        setError(null);
      } else {
        setError(data.error || "이미지를 불러올 수 없습니다");
      }
    } catch {
      setError("이미지를 불러올 수 없습니다");
    } finally {
      setLoading(false);
    }
  }, [q, folder]);

  useEffect(() => {
    if (open && tab === "library") fetchImages();
  }, [open, tab, fetchImages]);

  // 클립보드 복사 타이머 정리 (메모리 누수 방지)
  useEffect(() => {
    if (!copiedItemId) return;

    const timeoutId = setTimeout(() => {
      setCopiedItemId(null);
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [copiedItemId]);

  // YouTube videoId 추출
  const extractYtId = (url: string) => {
    const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
    return m?.[1] ?? null;
  };

  const buildImageHtml = (item: ImageItem) => {
    // 삽입 HTML에는 공개 Drive 썸네일 URL 사용 (랜딩페이지 외부 공개 필요)
    // asset인 경우 driveFileId로 Drive URL 직접 구성, cache는 기존 URL 사용
    const insertUrl = item.driveFileId
      ? `https://drive.google.com/thumbnail?id=${item.driveFileId}&sz=w1200`
      : item.fullUrl;

    if (item.isGif) {
      return `<img src="${insertUrl}" alt="${item.title}" style="max-width:100%;height:auto;" loading="lazy">`;
    }
    return `<picture>\n  <source srcset="${insertUrl}" type="image/webp">\n  <img src="${insertUrl}" alt="${item.title}" style="max-width:100%;height:auto;" loading="lazy">\n</picture>`;
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

  const handleCopy = (itemId: string | null, html: string) => {
    navigator.clipboard.writeText(html);
    setCopiedItemId(itemId);
  };

  const handleInsert = (html: string) => {
    onInsert(html);
    onClose();
  };

  // ── 업로드 핸들러 ────────────────────────────────────────
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder !== "전체" ? folder : "기타");

      const res  = await fetch("/api/image-library", { method: "POST", body: formData });
      const data = await res.json();

      if (data.ok) {
        await fetchImages();
      } else {
        alert(data.error ?? "업로드 실패");
      }
    } catch {
      alert("업로드 중 오류가 발생했습니다");
    } finally {
      setUploading(false);
      // 파일 input 초기화 (같은 파일 재업로드 허용)
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── 삭제 핸들러 ─────────────────────────────────────────
  const handleDelete = async (e: React.MouseEvent, item: ImageItem) => {
    e.stopPropagation();
    if (!confirm(`"${item.title}" 이미지를 삭제할까요?`)) return;

    const res  = await fetch(`/api/image-library/${item.id}`, { method: "DELETE" });
    const data = await res.json();

    if (data.ok) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      if (selected?.id === item.id) setSelected(null);
    } else {
      alert(data.error ?? "삭제 실패");
    }
  };

  // ── 인라인 타이틀 편집 ───────────────────────────────────
  const startEditing = (e: React.MouseEvent, item: ImageItem) => {
    if (item.source !== "asset") return;
    e.stopPropagation();
    setEditingId(item.id);
    setEditingTitle(item.title);
  };

  const commitEdit = async (id: string) => {
    const trimmed = editingTitle.trim();
    setEditingId(null);
    if (!trimmed) return;

    const res  = await fetch(`/api/image-library/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ title: trimmed }),
    });
    const data = await res.json();

    if (data.ok) {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, title: trimmed } : i))
      );
    } else {
      alert(data.error ?? "수정 실패");
    }
  };

  // ── 폴더 추가 ────────────────────────────────────────────
  const handleAddFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    if (!folders.includes(name)) {
      setFolders((prev) => [...prev, name]);
    }
    setNewFolderName("");
    setAddingFolder(false);
    setFolder(name);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-navy-900">이미지 / 영상 라이브러리</h2>
          <div className="flex items-center gap-2">
            {tab === "library" && (
              <button
                onClick={handleUploadClick}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gold-500 text-white rounded-lg text-sm font-medium hover:bg-gold-600 disabled:opacity-50 transition-colors"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>📤</span>
                )}
                이미지 업로드
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
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
                  : "border-transparent text-gray-600 hover:text-gray-600"
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
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                  <input
                    type="text"
                    placeholder="이미지 검색..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gold-500"
                  />
                </div>
                <div className="flex gap-1 flex-wrap items-center">
                  {folders.map((f) => (
                    <button
                      key={f}
                      onClick={() => setFolder(f)}
                      className={`px-2.5 py-1.5 text-sm rounded-full border transition-colors ${
                        folder === f
                          ? "bg-navy-900 text-white border-navy-900"
                          : "bg-white text-gray-600 border-gray-200 hover:border-navy-900"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                  {/* 폴더 추가 버튼 */}
                  {addingFolder ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddFolder();
                          if (e.key === "Escape") setAddingFolder(false);
                        }}
                        placeholder="폴더명"
                        autoFocus
                        className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-full focus:outline-none focus:border-gold-500"
                      />
                      <button
                        onClick={handleAddFolder}
                        className="text-sm text-green-600 hover:text-green-800 font-medium"
                      >
                        확인
                      </button>
                      <button
                        onClick={() => setAddingFolder(false)}
                        className="text-sm text-gray-600 hover:text-gray-600"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingFolder(true)}
                      className="p-1.5 text-gray-600 hover:text-navy-900 rounded-full border border-dashed border-gray-300 hover:border-navy-900 transition-colors"
                      title="폴더 추가"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <p className="text-red-700 text-sm font-medium">오류 발생</p>
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                  <button
                    onClick={() => fetchImages()}
                    className="mt-3 px-3 py-1.5 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200 transition-colors"
                  >
                    다시 시도
                  </button>
                </div>
              ) : loading ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2 py-8">
                    <RefreshCw className="w-5 h-5 animate-spin text-navy-900" />
                    <p className="text-sm text-gray-600">이미지 로드 중... (최대 10초)</p>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                    {[...Array(12)].map((_, i) => (
                      <div key={i} className="aspect-square bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  <p className="text-3xl mb-2">🖼️</p>
                  <p className="text-sm">이미지가 없습니다</p>
                  <p className="text-sm mt-1">이미지를 업로드하거나 Google Drive와 동기화가 필요할 수 있습니다</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {items.map((item) => {
                    const html = buildImageHtml(item);
                    const isEditing = editingId === item.id;
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
                            <span className="absolute top-1 right-1 bg-purple-500 text-white text-sm px-1.5 py-0.5 rounded font-bold">
                              GIF
                            </span>
                          )}
                          {item.source === "asset" && (
                            <span className="absolute top-1 left-1 bg-blue-500/80 text-white text-sm px-1.5 py-0.5 rounded font-bold">
                              내
                            </span>
                          )}
                        </div>

                        {/* 타이틀: asset이면 더블클릭 편집 */}
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onBlur={() => commitEdit(item.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit(item.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            className="w-full text-sm px-1 py-1 border border-gold-500 rounded focus:outline-none"
                          />
                        ) : (
                          <p
                            className={`text-sm text-gray-600 px-1 py-1 truncate ${
                              item.source === "asset" ? "cursor-text hover:text-navy-900" : ""
                            }`}
                            onDoubleClick={(e) => startEditing(e, item)}
                            title={item.source === "asset" ? "더블클릭으로 제목 편집" : item.title}
                          >
                            {item.title}
                          </p>
                        )}

                        {/* 호버 액션 */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-xl">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopy(item.id, html); }}
                            className="p-2 bg-white rounded-lg text-gray-700 hover:bg-gold-100"
                            title="HTML 코드 복사"
                          >
                            {copiedItemId === item.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleInsert(html); }}
                            className="p-2 bg-gold-500 rounded-lg text-white hover:bg-gold-300"
                            title="에디터에 삽입"
                          >
                            <Link2 className="w-4 h-4" />
                          </button>
                          {item.source === "asset" && (
                            <button
                              onClick={(e) => handleDelete(e, item)}
                              className="p-2 bg-red-500 rounded-lg text-white hover:bg-red-600"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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
                <p className="text-sm text-gray-600 mt-1">webp, jpg, png, gif 모두 지원</p>
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
                  <p className="text-sm text-gray-500 mb-2 font-medium">미리보기</p>
                  <img
                    src={urlInput}
                    alt={altInput || "미리보기"}
                    className="max-h-40 rounded-lg object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}

              {urlInput && (
                <div className="bg-gray-900 rounded-xl p-3">
                  <p className="text-sm text-gray-600 mb-2">HTML 코드</p>
                  <code className="text-sm text-green-400 break-all">{buildUrlHtml()}</code>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy("url", buildUrlHtml())}
                  disabled={!urlInput}
                  className="flex-1 flex items-center justify-center gap-2 border border-gray-200 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40"
                >
                  {copiedItemId === "url" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
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
                    <p className="text-sm text-gray-500 mb-2">미리보기</p>
                    <div className="relative aspect-video">
                      <iframe
                        src={`https://www.youtube.com/embed/${extractYtId(ytInput)}`}
                        className="absolute inset-0 w-full h-full rounded-lg"
                        allowFullScreen
                        title="YouTube"
                      />
                    </div>
                  </div>

                  <div className="bg-gray-900 rounded-xl p-3">
                    <p className="text-sm text-gray-600 mb-2">HTML 코드</p>
                    <code className="text-sm text-green-400 break-all whitespace-pre-wrap">{buildYtHtml()}</code>
                  </div>
                </>
              )}

              {ytInput && !extractYtId(ytInput) && (
                <p className="text-red-500 text-sm">올바른 YouTube 링크가 아닙니다.</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy("youtube", buildYtHtml())}
                  disabled={!extractYtId(ytInput)}
                  className="flex-1 flex items-center justify-center gap-2 border border-gray-200 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40"
                >
                  {copiedItemId === "youtube" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
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
              onClick={() => handleCopy(selected.id, buildImageHtml(selected))}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-white"
            >
              {copiedItemId === selected.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
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
