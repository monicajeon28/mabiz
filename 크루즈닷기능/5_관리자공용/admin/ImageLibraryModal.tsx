"use client";

import { useState, useEffect } from "react";
import { Search, X, Copy, Check, Link2, Play, Download } from "lucide-react";
import { generateWatermarkedDownloadUrl } from "@/lib/cloudinary-service";
import { useImageFetch } from "./useImageFetch";

interface ImageItem {
  id: number;
  fileName: string;
  fullUrl: string;
  thumbnailUrl?: string;
  folder?: string;
  tags?: string[];
  isGif: boolean;
  source?: 'library' | 'product'; // 공용 라이브러리 vs 상품 이미지
}

interface ImageLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (html: string) => void;
  /** 썸네일 선택 모드: HTML 삽입 대신 이미지 URL을 반환 */
  onSelectUrl?: (url: string) => void;
}

const DEFAULT_PUBLIC_FOLDERS = ["전체", "객실", "내부시설", "수영장", "자쿠지", "엑티비티", "지도", "키즈", "행사", "외관"];
const DEFAULT_PRODUCT_FOLDERS = ["전체", "지중해", "카리브해", "알래스카", "선박", "객실", "후기", "기타"];

interface ImageApiResponse {
  ok: boolean;
  data: { images: ImageItem[] };
}

export function ImageLibraryModal({ open, onClose, onInsert, onSelectUrl }: ImageLibraryModalProps) {
  const [tab, setTab] = useState<"library" | "url" | "youtube">("library");
  const [subTab, setSubTab] = useState<"public" | "product">("public"); // 라이브러리 내 서브탭
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("전체");
  const [selected, setSelected] = useState<ImageItem | null>(null);
  const [copied, setCopied] = useState(false);

  const [urlInput, setUrlInput] = useState("");
  const [altInput, setAltInput] = useState("");
  const [ytInput, setYtInput] = useState("");
  const [ytWidth, setYtWidth] = useState("100%");

  // P2-2: 동적 폴더 목록 (API 실패 시 기본값 fallback)
  const [publicFolders, setPublicFolders] = useState<string[]>(DEFAULT_PUBLIC_FOLDERS);
  const [productFolders, setProductFolders] = useState<string[]>(DEFAULT_PRODUCT_FOLDERS);

  // 공통 fetch 훅 (AbortController + loading/error 상태)
  const { data: imageApiData, loading, fetch: fetchImages, abort: abortImages } = useImageFetch<ImageApiResponse>('[ImageLibraryModal]');

  // API 응답에서 이미지 목록 추출
  const items: ImageItem[] = imageApiData?.ok ? imageApiData.data.images : [];

  // 서브탭 변경 시 폴더 리셋
  useEffect(() => {
    setFolder("전체");
  }, [subTab]);

  // P2-2: 모달 오픈 시 폴더 목록 동적 조회 (API 실패 시 기본값 유지)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const fetchFolders = async () => {
      try {
        const [libRes, imgRes] = await Promise.all([
          fetch("/api/admin/mall/library?limit=200", { credentials: "include" }),
          fetch("/api/admin/mall/images?limit=200", { credentials: "include" }),
        ]);

        if (!cancelled && libRes.ok) {
          const libData = await libRes.json();
          if (libData.ok && Array.isArray(libData.data?.images)) {
            const folders = Array.from(
              new Set<string>(
                (libData.data.images as { folder?: string }[])
                  .map((img) => img.folder)
                  .filter((f): f is string => Boolean(f))
              )
            ).sort();
            if (folders.length > 0) setPublicFolders(["전체", ...folders]);
          }
        }

        if (!cancelled && imgRes.ok) {
          const imgData = await imgRes.json();
          if (imgData.ok && Array.isArray(imgData.data?.images)) {
            const folders = Array.from(
              new Set<string>(
                (imgData.data.images as { folder?: string }[])
                  .map((img) => img.folder)
                  .filter((f): f is string => Boolean(f))
              )
            ).sort();
            if (folders.length > 0) setProductFolders(["전체", ...folders]);
          }
        }
      } catch {
        // API 실패 시 기본값(DEFAULT_*_FOLDERS) 유지
      }
    };

    fetchFolders();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "library") return;

    const timer = setTimeout(() => {
      // URL + 쿼리 파라미터 조립 후 훅에 전달
      const params = new URLSearchParams();
      if (q) params.set("search", q);
      if (folder !== "전체") params.set("folder", folder);
      const endpoint = subTab === "public" ? "/api/admin/mall/library" : "/api/admin/mall/images";
      fetchImages(`${endpoint}?${params}`);
    }, 500);

    return () => {
      clearTimeout(timer);
      abortImages();
    };
  }, [open, tab, q, folder, subTab, fetchImages, abortImages]);

  const extractYtId = (url: string) => {
    const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
    return m?.[1] ?? null;
  };

  const buildImageHtml = (item: ImageItem) => {
    if (item.isGif) {
      return `<img src="${item.fullUrl}" alt="${item.fileName}" style="max-width:100%;height:auto;" loading="lazy">`;
    }
    const imageUrl = item.fullUrl || item.thumbnailUrl;
    return `<img src="${imageUrl}" alt="${item.fileName}" style="max-width:100%;height:auto;" loading="lazy">`;
  };

  const isValidImageUrl = (url: string): boolean => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const buildUrlHtml = () => {
    const url = urlInput.trim();
    if (!url || !isValidImageUrl(url)) return "";
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

  const handleInsert = (html: string, item?: ImageItem) => {
    if (onSelectUrl) {
      // H-5: 썸네일 선택 모드 — item이 있으면 fullUrl, 없으면 urlInput (URL 탭 직접 입력값)
      // YouTube 탭은 이미지 선택 모드 미지원 (embed iframe이므로 URL 반환 불가)
      const url = item
        ? (item.fullUrl || item.thumbnailUrl || "")
        : urlInput.trim();
      if (url) onSelectUrl(url);
      onClose();
      return;
    }
    onInsert(html);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-slate-900">이미지 라이브러리</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-200 px-5">
          {[
            { key: "library", label: "📁 라이브러리" },
            { key: "url", label: "🔗 URL 직접 입력" },
            { key: "youtube", label: "▶ YouTube" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-magic-gold text-slate-900"
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
              {/* 서브탭: 공용 라이브러리 vs 상품 이미지 */}
              <div className="flex gap-2 mb-4 border-b border-gray-200 pb-3">
                <button
                  onClick={() => setSubTab("public")}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    subTab === "public"
                      ? "bg-blue-100 text-blue-700 border border-blue-300"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  📚 공용 라이브러리 (크루즈정보)
                </button>
                <button
                  onClick={() => setSubTab("product")}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    subTab === "product"
                      ? "bg-orange-100 text-orange-700 border border-orange-300"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  📁 상품 이미지
                </button>
              </div>

              <div className="flex gap-2 mb-4 flex-col sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="이미지 검색..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-magic-gold"
                  />
                </div>
              </div>

              <div className="flex gap-1 flex-wrap mb-4">
                {(subTab === "public" ? publicFolders : productFolders).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFolder(f)}
                    className={`px-2.5 py-1.5 text-xs rounded-full border transition-colors ${
                      folder === f
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-gray-600 border-gray-200 hover:border-slate-900"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="aspect-square bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-3xl mb-2">🖼️</p>
                  <p className="text-sm">이미지가 없습니다</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {items.map((item) => {
                    const html = buildImageHtml(item);
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelected(selected?.id === item.id ? null : item)}
                        className={`relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all group ${
                          selected?.id === item.id
                            ? "border-magic-gold shadow-md"
                            : "border-transparent hover:border-gray-300"
                        }`}
                      >
                        <div className="aspect-square bg-gray-100">
                          <img
                            src={item.thumbnailUrl || item.fullUrl}
                            alt={item.fileName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {item.isGif && (
                            <span className="absolute top-1 right-1 bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded font-bold">
                              GIF
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 px-1 py-1 truncate">{item.fileName}</p>

                        {/* 호버 액션 */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-xl">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(html);
                            }}
                            className="p-2 bg-white rounded-lg text-gray-700 hover:bg-yellow-100"
                            title="HTML 코드 복사"
                          >
                            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInsert(html, item);
                            }}
                            className="p-2 bg-magic-gold rounded-lg text-white hover:bg-banana-gold"
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-magic-gold"
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-magic-gold"
                />
              </div>

              {urlInput && isValidImageUrl(urlInput) && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-2 font-medium">미리보기</p>
                  <img
                    src={urlInput}
                    alt={altInput || "미리보기"}
                    className="max-h-40 rounded-lg object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}

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
                  className="flex-1 bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-40"
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-magic-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">너비</label>
                <select
                  value={ytWidth}
                  onChange={(e) => setYtWidth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-magic-gold"
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

              {ytInput && !extractYtId(ytInput) && <p className="text-red-500 text-sm">올바른 YouTube 링크가 아닙니다.</p>}

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
                  className="flex-1 bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-40"
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
              <img src={selected.thumbnailUrl || selected.fullUrl} alt={selected.fileName} className="w-full h-full object-cover" />
            </div>
            <p className="text-sm font-medium text-gray-700 flex-1 truncate">{selected.fileName}</p>
            <button
              onClick={() => handleCopy(buildImageHtml(selected))}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-white"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              코드 복사
            </button>
            {(() => {
              const rawUrl = selected.fullUrl || selected.thumbnailUrl || "";
              const driveMatch = rawUrl.match(/[?&]id=([a-zA-Z0-9_\-]{5,100})/);
              if (driveMatch) {
                // Google Drive 이미지 → cruise-photos 프록시로 워터마크 + 다운로드
                const downloadUrl = `/api/admin/cruise-photos/image?id=${driveMatch[1]}&download=true`;
                const ext = selected.isGif ? "gif" : "png";
                return (
                  <a
                    href={downloadUrl}
                    download={`${selected.fileName.replace(/\.[^.]+$/, "")}_watermark.${ext}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-white hover:border-orange-300"
                    title="크루즈닷 워터마크 포함 다운로드"
                  >
                    <Download className="w-3.5 h-3.5" />
                    워터마크 다운로드
                  </a>
                );
              }
              if (!selected.isGif && rawUrl.includes("cloudinary.com")) {
                // Cloudinary 이미지 → 기존 워터마크 함수
                return (
                  <a
                    href={generateWatermarkedDownloadUrl(rawUrl, selected.fileName)}
                    download={`${selected.fileName.replace(/\.[^.]+$/, "")}_watermark.png`}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-white hover:border-orange-300"
                    title="크루즈닷 워터마크 포함 PNG 다운로드"
                  >
                    <Download className="w-3.5 h-3.5" />
                    워터마크 다운로드
                  </a>
                );
              }
              return null;
            })()}
            <button
              onClick={() => handleInsert(buildImageHtml(selected), selected)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700"
            >
              <Play className="w-3.5 h-3.5" /> {onSelectUrl ? "선택" : "삽입"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
