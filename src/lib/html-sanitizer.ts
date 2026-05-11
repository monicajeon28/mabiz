import sanitizeHtmlLib from 'sanitize-html';

const ALLOWED_TAGS = [
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'img', 'a', 'ul', 'ol', 'li', 'br', 'hr',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'strong', 'em', 'b', 'i', 'u', 'blockquote',
  'figure', 'figcaption', 'section', 'article',
  'header', 'footer', 'nav', 'main', 'aside',
  'form', 'input', 'textarea', 'select', 'button', 'label', 'option',
  'video', 'source', 'picture',
  'details', 'summary', 'mark', 'small', 'sub', 'sup',
  'pre', 'code', 'dl', 'dt', 'dd',
  'style',
];

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  '*': [
    'class', 'id', 'style',
    'role', 'aria-*', 'data-*',
  ],
  'img': ['src', 'alt', 'width', 'height', 'loading'],
  'a': ['href', 'target', 'rel'],
  'video': ['src', 'width', 'height', 'controls', 'autoplay', 'muted', 'loop', 'poster'],
  'source': ['src', 'type'],
  'td': ['colspan', 'rowspan'],
  'th': ['colspan', 'rowspan'],
  'form': ['action', 'method', 'autocomplete'],
  'input': ['name', 'type', 'placeholder', 'value', 'required', 'disabled', 'checked', 'maxlength', 'min', 'max', 'step', 'pattern', 'autocomplete', 'readonly'],
  'textarea': ['name', 'placeholder', 'required', 'disabled', 'maxlength', 'rows', 'cols', 'readonly'],
  'select': ['name', 'required', 'disabled'],
  'option': ['value', 'selected', 'disabled'],
  'button': ['type', 'disabled', 'name', 'value'],
  'label': ['for'],
  'style': [],
};

/**
 * HTML 콘텐츠를 sanitize — XSS 공격 벡터 차단
 * script, iframe, object, embed 태그 제거
 * on* 이벤트 핸들러, javascript: URI 차단
 */
export function sanitizeHtml(html: string): string {
  if (!html) return html;

  return sanitizeHtmlLib(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['https', 'http', 'data', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['https', 'data'],
      a: ['https', 'http', 'mailto', 'tel'],
    },
    allowVulnerableTags: false,
    allowedStyles: {
      '*': {
        // 모든 CSS 속성 허용 (인라인 스타일 보존)
        '*': [/.*/],
      },
    },
    transformTags: {
      'a': (tagName, attribs) => {
        // target="_blank"에 rel="noopener noreferrer" 자동 추가
        if (attribs.target === '_blank') {
          attribs.rel = 'noopener noreferrer';
        }
        return { tagName, attribs };
      },
    },
  });
}
