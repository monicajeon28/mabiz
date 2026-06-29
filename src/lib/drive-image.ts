/**
 * 구글드라이브 이미지 핫링크 유틸.
 *
 * 배경: `https://drive.google.com/thumbnail?id=FILE_ID&sz=wN` 은 HTTP 302 리다이렉트라
 *   <img>/canvas/외부 임베드에서 자주 로드 실패(특히 큰 sz, 핫링크). 반면
 *   `https://lh3.googleusercontent.com/d/FILE_ID=wN` 은 이미지 바이트를 직접(200) 서빙해 안정적이다.
 *   (검증: thumbnail?sz=w1920 → 302 / lh3 .../d/ID=w1920 → 200 image/jpeg)
 */

/** 드라이브 fileId로 안정적 lh3 이미지 URL 생성(신규 생성용). */
export function driveImageUrl(fileId: string, width = 1200): string {
  const id = encodeURIComponent(fileId.trim());
  return `https://lh3.googleusercontent.com/d/${id}=w${width}`;
}

/**
 * 저장된 HTML 안의 구글드라이브 thumbnail URL을 안정적 lh3 포맷으로 치환.
 *   기존에 thumbnail 포맷으로 저장된 랜딩 콘텐츠의 이미지 표시를 재저장 없이 복구한다.
 *   `&sz=` 와 HTML 인코딩된 `&amp;sz=` 양쪽 처리.
 */
export function rewriteDriveThumbnails(html: string): string {
  if (!html) return html;
  return html.replace(
    /https?:\/\/drive\.google\.com\/thumbnail\?id=([A-Za-z0-9_-]+)(?:&(?:amp;)?sz=w(\d+))?[^"'\s)<>]*/gi,
    (_m, id, w) => `https://lh3.googleusercontent.com/d/${id}=w${w || 1200}`,
  );
}
