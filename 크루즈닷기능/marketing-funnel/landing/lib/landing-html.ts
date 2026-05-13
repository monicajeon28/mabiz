const PUBLIC_BASE_ORIGIN = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

const ABSOLUTE_PROTOCOL_REGEX = /^(https?:|data:|blob:|\/\/)/i;

const stripLeadingSlashes = (value: string) => value.replace(/^\/+/, '');

export const getLandingBaseOrigin = (fallback?: string) => {
  if (PUBLIC_BASE_ORIGIN) {
    return PUBLIC_BASE_ORIGIN;
  }

  if (fallback) {
    return fallback.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  return '';
};

export const normalizeLandingImageUrl = (url: string, options?: { baseOrigin?: string }) => {
  if (!url) {
    return '';
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }

  const baseOrigin = getLandingBaseOrigin(options?.baseOrigin);
  const ensureBaseOrigin = () => baseOrigin || '';

  const rebuildWithBase = (path: string) => {
    const origin = ensureBaseOrigin();
    if (!origin) {
      return path.startsWith('/') ? path : `/${stripLeadingSlashes(path)}`;
    }
    if (path.startsWith('/')) {
      return `${origin}${path}`;
    }
    return `${origin}/${stripLeadingSlashes(path)}`;
  };

  if (!ABSOLUTE_PROTOCOL_REGEX.test(trimmed)) {
    return rebuildWithBase(trimmed);
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const resolved = new URL(trimmed);
      if (LOCAL_HOSTS.has(resolved.hostname.toLowerCase())) {
        return `${ensureBaseOrigin()}${resolved.pathname}${resolved.search}${resolved.hash}`;
      }
    } catch {
      return trimmed;
    }
  }

  return trimmed;
};

// 완전한 HTML 문서에서 body 내용만 추출
const extractBodyContent = (html: string): string => {
  if (!html) {
    return '';
  }

  const trimmed = html.trim();
  
  // 완전한 HTML 문서인지 확인 (<!DOCTYPE html> 또는 <html>로 시작)
  if (trimmed.toLowerCase().startsWith('<!doctype') || trimmed.toLowerCase().startsWith('<html')) {
    // <body> 태그 내용 추출
    const bodyMatch = trimmed.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      return bodyMatch[1].trim();
    }
    
    // <body> 태그가 없으면 <html> 태그 내용 추출
    const htmlMatch = trimmed.match(/<html[^>]*>([\s\S]*?)<\/html>/i);
    if (htmlMatch && htmlMatch[1]) {
      // <head> 태그 제거
      let content = htmlMatch[1].replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
      return content.trim();
    }
  }
  
  return trimmed;
};

export const normalizeLandingHtmlContent = (
  html: string,
  options?: { baseOrigin?: string }
) => {
  if (!html) {
    return '';
  }

  // 완전한 HTML 문서에서 body 내용만 추출
  let processedHtml = extractBodyContent(html);

  const baseOrigin = getLandingBaseOrigin(options?.baseOrigin);
  if (!baseOrigin) {
    return processedHtml;
  }

  let normalized = processedHtml;

  // src 속성 정규화
  normalized = normalized.replace(
    /(<img[^>]+src=["'])([^"'>]+)(["'])/gi,
    (_match, prefix: string, src: string, suffix: string) => {
      const normalizedSrc = normalizeLandingImageUrl(src, { baseOrigin });
      return `${prefix}${normalizedSrc}${suffix}`;
    }
  );

  // srcset 속성 정규화 (예: srcset="image1.jpg 1x, image2.jpg 2x")
  normalized = normalized.replace(
    /(<img[^>]+srcset=["'])([^"'>]+)(["'])/gi,
    (_match, prefix: string, srcset: string, suffix: string) => {
      const normalizedSrcset = srcset
        .split(',')
        .map(entry => {
          const parts = entry.trim().split(/\s+/);
          if (parts.length > 0) {
            const url = parts[0];
            const normalizedUrl = normalizeLandingImageUrl(url, { baseOrigin });
            return parts.length > 1 
              ? `${normalizedUrl} ${parts.slice(1).join(' ')}`
              : normalizedUrl;
          }
          return entry;
        })
        .join(', ');
      return `${prefix}${normalizedSrcset}${suffix}`;
    }
  );

  // data-src 속성 정규화 (lazy loading)
  normalized = normalized.replace(
    /(<img[^>]+data-src=["'])([^"'>]+)(["'])/gi,
    (_match, prefix: string, src: string, suffix: string) => {
      const normalizedSrc = normalizeLandingImageUrl(src, { baseOrigin });
      return `${prefix}${normalizedSrc}${suffix}`;
    }
  );

  // background-image 스타일 정규화
  normalized = normalized.replace(
    /(background-image\s*:\s*url\(["']?)([^"')]+)(["']?\))/gi,
    (_match, prefix: string, url: string, suffix: string) => {
      const normalizedUrl = normalizeLandingImageUrl(url, { baseOrigin });
      return `${prefix}${normalizedUrl}${suffix}`;
    }
  );

  // style 속성 내 url() 정규화
  normalized = normalized.replace(
    /(style=["'][^"']*url\(["']?)([^"')]+)(["']?\)[^"']*["'])/gi,
    (_match, prefix: string, url: string, suffix: string) => {
      const normalizedUrl = normalizeLandingImageUrl(url, { baseOrigin });
      return `${prefix}${normalizedUrl}${suffix}`;
    }
  );

  return normalized;
};

