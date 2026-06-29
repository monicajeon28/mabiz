"use client";

import { useEffect, useRef, useState } from "react";

/**
 * HTML형 "전체 문서"(<!doctype html>...</html>) 전용 렌더러 — #15.
 * 붙여넣은 원본 HTML을 정제(sanitize) 없이 iframe srcDoc에 그대로 넣어
 * "하얀 백지에 사용자 코드 그대로"(스타일·배경·tailwind·스크립트 동작)를 보장.
 * 안전은 정제기가 아니라 브라우저 샌드박스(null origin)가 책임진다:
 *   sandbox="allow-scripts allow-popups" (allow-same-origin 절대 금지 — 켜면 부모 쿠키/스토리지/세션 탈취 가능).
 *   → iframe은 불투명(null) origin이라 부모 DOM·쿠키·localStorage 접근 불가, 폼/탑네비 탈출 불가.
 * 폼/리드캡처·결제·댓글은 렌더하지 않음(요구=백지 그대로). viewCount만 부모에서 호출(렌더방식 무관).
 */
export function LandingDocumentFrame({ pageId, htmlContent }: { pageId: string; htmlContent: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  // viewCount — 기존과 동일하게 부모(클라이언트)에서 POST (iframe과 무관)
  useEffect(() => {
    fetch(`/api/landing-pages/${pageId}/view`, { method: "POST" }).catch(() => {});
  }, [pageId]);

  // 높이 자동맞춤 — 우리가 주입한 보고 스크립트가 보낸 scrollHeight 수신(샌드박스 iframe origin은 "null").
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== "null") return;
      if (e.source !== ref.current?.contentWindow) return;
      const h = Number((e.data as { __h?: number })?.__h);
      if (Number.isFinite(h) && h > 0) setHeight(Math.ceil(h));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // 높이 보고 스크립트를 우리가 문서 끝에 주입 → allow-scripts로 실행(same-origin 불필요).
  const reporter =
    `<script>(function(){function p(){parent.postMessage({__h:document.documentElement.scrollHeight},'*');}` +
    `try{new ResizeObserver(p).observe(document.documentElement);}catch(e){}` +
    `addEventListener('load',p);p();})();<\/script>`;

  return (
    <iframe
      ref={ref}
      srcDoc={htmlContent + reporter}
      sandbox="allow-scripts allow-popups"
      referrerPolicy="no-referrer"
      title="홍보 페이지"
      style={{ width: "100%", height: height ? `${height}px` : "100dvh", border: 0, display: "block" }}
    />
  );
}
