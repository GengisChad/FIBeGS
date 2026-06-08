import DOMPurify, { type Config } from "dompurify";

let hooksInitialized = false;

const initHooks = () => {
  if (hooksInitialized) return;

  // Extra hardening for inline styles (TipTap uses inline styles for colors/highlights)
  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    if (data.attrName === "style") {
      const value = String(data.attrValue || "");
      // Block common CSS vectors (url(), expression(), @import, behavior)
      if (/url\s*\(|expression\s*\(|@import|behavior\s*:/i.test(value)) {
        data.keepAttr = false;
        return;
      }
      // Strip color & background declarations so user-authored content
      // always inherits the active theme color (prevents black-on-dark issues).
      const cleaned = value
        .split(";")
        .map((decl) => decl.trim())
        .filter((decl) => decl && !/^(color|background(-color)?)\s*:/i.test(decl))
        .join("; ");
      if (cleaned !== value) {
        data.attrValue = cleaned;
        if (!cleaned) data.keepAttr = false;
      }
    }
  });

  hooksInitialized = true;
};

const SANITIZE_CONFIG: Config = {
  // Keep rich formatting, remove scripts/handlers
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "s",
    "a",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "code",
    "pre",
    "img",
    "span",
    "div",
    "mark",
    "hr",
    "i",
  ],
  ALLOWED_ATTR: [
    "href",
    "target",
    "rel",
    "src",
    "alt",
    "class",
    "style",
    "loading",
    "width",
    "height",
  ],
  ALLOW_DATA_ATTR: true,
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "link", "meta"],
  // Allow http(s)/mailto/tel, relative URLs (/...) and anchors (#...)
  ALLOWED_URI_REGEXP: /^((https?:|mailto:|tel:)|\/|#)/i,
};

export const sanitizeUserHtml = (html: string): string => {
  initHooks();
  return DOMPurify.sanitize(html, SANITIZE_CONFIG) as unknown as string;
};
