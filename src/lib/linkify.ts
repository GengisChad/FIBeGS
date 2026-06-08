/**
 * Convert plain-text URLs in user input to anchor tags, and preserve
 * line breaks as <br>/<p> so the sanitizer doesn't collapse them.
 *
 * Safe to apply on text that may already contain a mix of plain URLs
 * and minimal HTML (e.g. Textarea content with pasted links). If the
 * input already contains <a> tags, those are left untouched.
 */

const URL_REGEX = /\b((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]])/gi;

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const linkifyText = (text: string): string => {
  return text.replace(URL_REGEX, (raw) => {
    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${raw}</a>`;
  });
};

/**
 * If the input looks like plain text (no <p>/<br>/<a> tags), wrap each
 * non-empty line in a <p> and linkify URLs. Otherwise, return as-is.
 */
export const linkifyAndFormat = (input: string | null | undefined): string => {
  const raw = (input || "").trim();
  if (!raw) return "";

  const looksLikeHtml = /<\/?(p|br|a|div|ul|ol|li|h[1-6]|strong|em|b|i|u|span|blockquote|img)\b/i.test(raw);

  if (looksLikeHtml) {
    // Only linkify text outside of existing anchor tags.
    return raw.replace(/(<a\b[^>]*>[\s\S]*?<\/a>)|([^<]+)/gi, (_m, anchor, text) => {
      if (anchor) return anchor;
      return linkifyText(text);
    });
  }

  // Plain text path: split by blank lines into paragraphs, single newlines -> <br>
  const paragraphs = raw.split(/\n{2,}/).map((para) => {
    const escaped = escapeHtml(para).replace(/\n/g, "<br>");
    return `<p>${linkifyText(escaped)}</p>`;
  });
  return paragraphs.join("");
};
