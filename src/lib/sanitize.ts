import DOMPurify from "dompurify";

/** Sanitize user-generated text content, stripping all HTML/JS */
export function sanitizeText(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/** Sanitize HTML content, allowing safe subset of tags */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li", "code", "pre", "h1", "h2", "h3", "h4", "blockquote", "img"],
    ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "class"],
  });
}
