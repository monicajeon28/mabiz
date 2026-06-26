import sanitizeHtmlLib from 'sanitize-html';

const ALLOWED_TAGS = [
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'img', 'a', 'ul', 'ol', 'li', 'br', 'hr',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'strong', 'em', 'b', 'i', 'u', 'blockquote',
  'figure', 'figcaption', 'section', 'article',
  'header', 'footer', 'nav', 'main', 'aside',
  'textarea', 'select', 'label', 'option',
  'video', 'source', 'picture',
  'details', 'summary', 'mark', 'small', 'sub', 'sup',
  'pre', 'code', 'dl', 'dt', 'dd',
  // <style> 태그 제거 — CSS injection 방지. 인라인 style="" 속성은 허용됨.
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
  'form': ['method', 'autocomplete'], // action 제거 — 외부 URL 전송 차단
  'input': ['name', 'type', 'placeholder', 'value', 'required', 'disabled', 'checked', 'maxlength', 'min', 'max', 'step', 'pattern', 'autocomplete', 'readonly'],
  'textarea': ['name', 'placeholder', 'required', 'disabled', 'maxlength', 'rows', 'cols', 'readonly'],
  'select': ['name', 'required', 'disabled'],
  'option': ['value', 'selected', 'disabled'],
  'button': ['type', 'disabled', 'name', 'value'],
  'label': ['for'],
};

/**
 * HTML 콘텐츠를 sanitize — XSS + CSS injection 차단
 * - script, iframe, object, embed, style 태그 제거
 * - on* 이벤트 핸들러, javascript: URI 차단
 * - CSS 속성은 안전한 것만 화이트리스트 허용
 * - form action 속성 차단 (외부 피싱 방지)
 */
export function sanitizeHtml(html: string): string {
  if (!html) return html;

  return sanitizeHtmlLib(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['https', 'http', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['https', 'data'],
      a: ['https', 'http', 'mailto', 'tel'],
    },
    allowVulnerableTags: false,
    allowedStyles: {
      '*': {
        'color': [/.*/],
        'background-color': [/.*/],
        'background': [/^(?!.*url\().*$/], // url() 차단
        'font-size': [/.*/],
        'font-weight': [/.*/],
        'font-family': [/.*/],
        'font-style': [/.*/],
        'text-align': [/.*/],
        'text-decoration': [/.*/],
        'text-transform': [/.*/],
        'line-height': [/.*/],
        'letter-spacing': [/.*/],
        'margin': [/.*/], 'margin-top': [/.*/], 'margin-bottom': [/.*/],
        'margin-left': [/.*/], 'margin-right': [/.*/],
        'padding': [/.*/], 'padding-top': [/.*/], 'padding-bottom': [/.*/],
        'padding-left': [/.*/], 'padding-right': [/.*/],
        'border': [/.*/], 'border-radius': [/.*/],
        'border-top': [/.*/], 'border-bottom': [/.*/],
        'border-left': [/.*/], 'border-right': [/.*/],
        'border-color': [/.*/], 'border-width': [/.*/], 'border-style': [/.*/],
        'width': [/.*/], 'height': [/.*/],
        'max-width': [/.*/], 'max-height': [/.*/],
        'min-width': [/.*/], 'min-height': [/.*/],
        'aspect-ratio': [/.*/], 'object-fit': [/.*/], 'object-position': [/.*/],
        'display': [/.*/],
        'flex': [/.*/], 'flex-direction': [/.*/], 'flex-wrap': [/.*/],
        'justify-content': [/.*/], 'align-items': [/.*/], 'align-self': [/.*/],
        'gap': [/.*/], 'row-gap': [/.*/], 'column-gap': [/.*/],
        'grid-template-columns': [/.*/], 'grid-template-rows': [/.*/],
        'grid-column': [/.*/], 'grid-row': [/.*/],
        'opacity': [/.*/],
        'overflow': [/.*/], 'overflow-x': [/.*/], 'overflow-y': [/.*/],
        'white-space': [/.*/], 'word-break': [/.*/],
        'box-shadow': [/^(?!.*url\().*$/],
        'border-collapse': [/.*/],
        'vertical-align': [/.*/],
        'list-style': [/.*/], 'list-style-type': [/.*/],
        'cursor': [/.*/],
        'transition': [/.*/],
        'transform': [/.*/],
        // position:fixed/absolute 차단 — 피싱 오버레이 방지
        'position': [/^(relative|static|sticky)$/],
        'top': [/.*/], 'bottom': [/.*/], 'left': [/.*/], 'right': [/.*/],
        'z-index': [/^\d+$/],
      },
    },
    transformTags: {
      'a': (tagName, attribs) => {
        if (attribs.target === '_blank') {
          attribs.rel = 'noopener noreferrer';
        }
        return { tagName, attribs };
      },
    },
  });
}
