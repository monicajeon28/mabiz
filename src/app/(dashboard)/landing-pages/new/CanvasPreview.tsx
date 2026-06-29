"use client";

import React, { useMemo } from "react";
import { Block } from "@/lib/landing-page-blocks";

interface CanvasPreviewProps {
  blocks: Block[];
  mode: "desktop" | "mobile" | "tablet";
}

/**
 * HTML 텍스트를 안전하게 이스케이프
 * XSS 공격 방지
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * URL을 안전하게 검증
 * javascript: 프로토콜 및 유효하지 않은 URL 차단
 */
function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return ["http:", "https:", "data:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * 블록 배열을 HTML 문자열로 변환
 * 모든 동적 콘텐츠는 escapeHtml() 처리
 */
function buildBlocksHtml(blocks: Block[]): string {
  if (blocks.length === 0) {
    return `<div style="height:180px;display:flex;align-items:center;justify-content:center;background:#f7f8fc;color:#bbb;font-family:sans-serif;font-size:13px">블록이 없습니다. 블록을 추가해주세요.</div>`;
  }

  let html = "";

  blocks.forEach((block: any) => {
    switch (block.type) {
      case "heading": {
        const headingAlign = block.data.align || "center";
        const sizeMap: Record<string, string> = {
          small: "16px",
          medium: "24px",
          large: "32px",
          xl: "48px",
        };
        const headingSize = sizeMap[block.data.fontSize || "large"] || "32px";
        const text = escapeHtml(block.data.text || "");
        html += `<div style="text-align:${headingAlign};margin:24px 0;padding:0 20px">
          <h1 style="font-size:${headingSize};font-weight:bold;color:#1a1a1a;margin:0">${text}</h1>
        </div>`;
        break;
      }

      case "body": {
        const bodyText = escapeHtml(block.data.text || "");
        html += `<div style="margin:16px 0;padding:0 20px">
          <p style="font-size:16px;color:#555;line-height:1.6;margin:0">${bodyText.replace(
            /\n/g,
            "<br>"
          )}</p>
        </div>`;
        break;
      }

      case "image": {
        const imgUrl = block.data.url;
        if (!isValidImageUrl(imgUrl)) {
          console.warn(`Invalid image URL: ${imgUrl}`);
          break;
        }
        const altText = escapeHtml(block.data.alt || "이미지");
        const ar =
          block.data.aspectRatio && block.data.width && block.data.height
            ? `aspect-ratio:${block.data.aspectRatio};`
            : "";
        html += `<div style="margin:20px 0;line-height:0">
          <img src="${encodeURI(imgUrl)}" alt="${altText}" style="width:100%;display:block;${ar};object-fit:cover;" loading="lazy">
        </div>`;
        break;
      }

      case "cta": {
        const ctaText = escapeHtml(block.data.text || "버튼");
        const colors: Record<string, string> = {
          blue: "#1E2D4E",
          red: "#dc2626",
          green: "#16a34a",
          yellow: "#eab308",
          dark: "#000",
        };
        const bg = colors[block.data.color] || "#1E2D4E";
        const sizeMap: Record<string, string> = {
          small: "12px 24px",
          medium: "15px 32px",
          large: "18px 40px",
        };
        const size = sizeMap[block.data.size || "medium"] || "15px 32px";
        html += `<div style="text-align:center;margin:24px 0;padding:0 20px">
          <button style="background:${bg};color:#fff;border:none;border-radius:8px;padding:${size};font-size:16px;font-weight:bold;cursor:pointer">${ctaText}</button>
        </div>`;
        break;
      }

      case "divider": {
        const dividerColor = block.data.color || "#e5e7eb";
        const dividerStyle = block.data.style || "solid";
        html += `<div style="margin:32px 0;border-top:1px ${dividerStyle} ${dividerColor}"></div>`;
        break;
      }

      case "footer": {
        const footerText = escapeHtml(block.data.text || "");
        const footerAlign = block.data.align || "center";
        html += `<footer style="text-align:${footerAlign};margin:32px 0;padding:20px;color:#999;font-size:12px">${footerText.replace(
          /\n/g,
          "<br>"
        )}</footer>`;
        break;
      }

      case "video": {
        const videoUrl = block.data.url;
        if (videoUrl && isValidImageUrl(videoUrl)) {
          const autoplay = block.data.autoplay ? "autoplay" : "";
          const loop = block.data.loop ? "loop" : "";
          html += `<div style="margin:24px 0;padding:0 20px">
            <iframe width="100%" height="400" src="${encodeURI(
              videoUrl
            )}" frameborder="0" ${autoplay} ${loop} allowfullscreen style="border-radius:8px;"></iframe>
          </div>`;
        } else if (videoUrl) {
          console.warn(`Invalid video URL: ${videoUrl}`);
        }
        break;
      }

      case "timer": {
        if (block.data.enabled) {
          const timerTitle = escapeHtml(block.data.title || "마감까지");
          html += `<div style="text-align:center;margin:24px 0;padding:20px;background:#fff3cd;border-radius:8px">
            <p style="margin:0 0 10px;color:#856404;font-weight:bold">${timerTitle}</p>
            <div id="timer-${
              block.id
            }" style="font-size:24px;font-weight:bold;color:#dc3545">계산 중...</div>
            <script>
              (function() {
                const deadline = new Date('${block.data.deadline}').getTime();
                const timerId = setInterval(function() {
                  const now = new Date().getTime();
                  const diff = deadline - now;
                  const elem = document.getElementById('timer-${block.id}');
                  if (elem) {
                    if (diff > 0) {
                      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
                      const mins = Math.floor((diff / 1000 / 60) % 60);
                      const secs = Math.floor((diff / 1000) % 60);
                      elem.textContent = days + '일 ' + hours + '시간 ' + mins + '분 ' + secs + '초';
                    } else {
                      elem.textContent = '마감됨';
                      clearInterval(timerId);
                    }
                  }
                }, 1000);
              })();
            </script>
          </div>`;
        }
        break;
      }

      case "testimonial": {
        html += `<div style="margin:24px 0;padding:0 20px">
          <h3 style="font-size:20px;font-weight:bold;margin:0 0 16px;color:#1a1a1a">💬 고객 후기</h3>
          <div style="display:grid;gap:12px">
            ${block.data.items
              .map((item: any) => {
                const itemText = escapeHtml(item.text || "");
                const itemAuthor = escapeHtml(item.author || "고객");
                const itemRole = item.role ? ` (${escapeHtml(item.role)})` : "";
                return `<div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9f9f9">
                  <p style="margin:0 0 8px;font-size:14px;color:#555;font-style:italic">"${itemText}"</p>
                  <p style="margin:0;font-size:12px;font-weight:bold;color:#333">- ${itemAuthor}${itemRole}</p>
                </div>`;
              })
              .join("")}
          </div>
        </div>`;
        break;
      }

      case "faq": {
        html += `<div style="margin:24px 0;padding:0 20px">
          <h3 style="font-size:20px;font-weight:bold;margin:0 0 16px;color:#1a1a1a">❓ 자주 묻는 질문</h3>
          <div style="display:grid;gap:8px">
            ${block.data.items
              .map((item: any) => {
                const question = escapeHtml(item.question || "");
                const answer = escapeHtml(item.answer || "");
                return `<details style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9f9f9">
                  <summary style="font-weight:bold;cursor:pointer;color:#333">Q. ${question}</summary>
                  <p style="margin:8px 0 0;color:#555;line-height:1.6">A. ${answer}</p>
                </details>`;
              })
              .join("")}
          </div>
        </div>`;
        break;
      }
    }
  });

  return html;
}

/**
 * CanvasPreview 컴포넌트
 * 블록 목록을 HTML로 렌더링하는 미리보기 패널
 */
export function CanvasPreview({
  blocks,
  mode,
}: CanvasPreviewProps) {
  // 모드별 너비 설정
  const containerClasses = (() => {
    switch (mode) {
      case "mobile":
        return "max-w-sm"; // ~384px
      case "tablet":
        return "max-w-2xl"; // ~672px
      case "desktop":
      default:
        return "w-full";
    }
  })();

  // 블록 HTML 생성 (useMemo로 최적화)
  const previewHtml = useMemo(() => {
    const bodyHtml = buildBlocksHtml(blocks);
    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      background: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Segoe UI', sans-serif;
      line-height: 1.5;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    button {
      transition: all 0.2s ease;
    }
    button:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
  }, [blocks]);

  return (
    <div className={`flex flex-col gap-4 p-4 bg-gray-50 rounded-xl`}>
      {/* 미리보기 제목 */}
      <div>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {mode === "desktop" && "💻 PC 미리보기"}
          {mode === "tablet" && "📱 태블릿 미리보기"}
          {mode === "mobile" && "📱 모바일 미리보기"}
        </p>
      </div>

      {/* 미리보기 컨테이너 */}
      <div
        className={`mx-auto bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 ${containerClasses}`}
        style={{
          minHeight: "400px",
          maxHeight: "600px",
          overflowY: "auto",
        }}
      >
        <iframe
          srcDoc={previewHtml}
          title="캔버스 미리보기"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            backgroundColor: "#fff",
          }}
          sandbox="allow-same-origin allow-scripts"
        />
      </div>

      {/* 빈 상태 메시지 */}
      {blocks.length === 0 && (
        <p className="text-xs text-gray-500 text-center py-4">
          블록을 추가하면 여기에 표시됩니다
        </p>
      )}
    </div>
  );
}
