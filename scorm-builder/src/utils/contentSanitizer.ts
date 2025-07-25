import DOMPurify from 'dompurify';

// Configure DOMPurify with safe defaults for SCORM content
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'td', 'th'
];

const ALLOWED_ATTRIBUTES = {
  'a': ['href', 'title', 'target'],
  'img': ['src', 'alt', 'width', 'height'],
  '*': ['class', 'id', 'style']
};

// Note: Style filtering in DOMPurify is handled through ALLOWED_ATTR
// These styles would need to be validated separately if needed
// const ALLOWED_STYLES = [
//   'color', 'background-color', 'font-size', 'font-weight', 
//   'text-align', 'padding', 'margin', 'border'
// ];

export function sanitizeContent(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: Object.keys(ALLOWED_ATTRIBUTES).reduce((acc, tag) => {
      ALLOWED_ATTRIBUTES[tag as keyof typeof ALLOWED_ATTRIBUTES].forEach(attr => {
        acc.push(tag === '*' ? attr : `${tag}@${attr}`);
      });
      return acc;
    }, [] as string[]),
    // Note: DOMPurify doesn't support ALLOWED_STYLE directly
    // Style filtering is handled by ALLOWED_ATTR which includes 'style'
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover']
  });
}

export function sanitizeContentItem(item: any): any {
  if (!item) return item;
  
  return {
    ...item,
    content: item.content ? sanitizeContent(item.content) : item.content,
    narration: item.narration ? sanitizeContent(item.narration) : item.narration
  };
}