import { Fragment, type ReactNode } from "react";

/**
 * Lightweight inline markdown-ish formatter for notification messages.
 * Supports:
 *   **bold**            -> <strong>
 *   __bold__            -> <strong>
 *   *italic*            -> <em>
 *   _italic_            -> <em>
 *   ~~strike~~          -> <s>
 *   `code`              -> <code>
 *   [label](url)        -> <a>
 *   bare URLs (https://…) auto-linked
 */
const inlinePattern =
  /(\*\*([^*\n]+)\*\*)|(__([^_\n]+)__)|(\*([^*\n]+)\*)|(_([^_\n]+)_)|(~~([^~\n]+)~~)|(`([^`\n]+)`)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s<>"')]+)/g;

const renderInline = (text: string, keyPrefix: string): ReactNode[] => {
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  inlinePattern.lastIndex = 0;
  while ((match = inlinePattern.exec(text)) !== null) {
    if (match.index > last) {
      out.push(text.slice(last, match.index));
    }
    const key = `${keyPrefix}-${i++}`;
    if (match[2] !== undefined) {
      out.push(<strong key={key} className="font-semibold text-foreground">{match[2]}</strong>);
    } else if (match[4] !== undefined) {
      out.push(<strong key={key} className="font-semibold text-foreground">{match[4]}</strong>);
    } else if (match[6] !== undefined) {
      out.push(<em key={key} className="italic">{match[6]}</em>);
    } else if (match[8] !== undefined) {
      out.push(<em key={key} className="italic">{match[8]}</em>);
    } else if (match[10] !== undefined) {
      out.push(<s key={key} className="opacity-70">{match[10]}</s>);
    } else if (match[12] !== undefined) {
      out.push(
        <code key={key} className="px-1 py-0.5 rounded bg-secondary/60 text-[0.85em] font-mono">
          {match[12]}
        </code>,
      );
    } else if (match[14] !== undefined) {
      out.push(
        <a
          key={key}
          href={match[15]}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-primary underline-offset-2 hover:underline break-all"
        >
          {match[14]}
        </a>,
      );
    } else if (match[16] !== undefined) {
      out.push(
        <a
          key={key}
          href={match[16]}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-primary underline-offset-2 hover:underline break-all"
        >
          {match[16]}
        </a>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

/**
 * Format a multi-line notification message with bullets, numbered lists and
 * inline rich text. Returns React nodes ready to render inside a <div>.
 */
export const formatNotificationMessage = (text: string): ReactNode => {
  if (!text) return null;
  const lines = text.split("\n");

  type Block =
    | { kind: "p"; line: string; key: string }
    | { kind: "br"; key: string }
    | { kind: "ul"; items: string[]; key: string }
    | { kind: "ol"; items: string[]; key: string };

  const blocks: Block[] = [];
  let cursor = 0;

  for (const raw of lines) {
    const trimmed = raw.trimStart();
    const bullet = /^[-•*]\s+(.*)$/.exec(trimmed);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);

    if (bullet) {
      const last = blocks[blocks.length - 1];
      if (last && last.kind === "ul") last.items.push(bullet[1]);
      else blocks.push({ kind: "ul", items: [bullet[1]], key: `ul-${cursor++}` });
    } else if (numbered) {
      const last = blocks[blocks.length - 1];
      if (last && last.kind === "ol") last.items.push(numbered[1]);
      else blocks.push({ kind: "ol", items: [numbered[1]], key: `ol-${cursor++}` });
    } else if (raw.trim() === "") {
      blocks.push({ kind: "br", key: `br-${cursor++}` });
    } else {
      blocks.push({ kind: "p", line: raw, key: `p-${cursor++}` });
    }
  }

  return (
    <>
      {blocks.map((b) => {
        if (b.kind === "br") return <div key={b.key} className="h-1.5" />;
        if (b.kind === "p") {
          return (
            <p key={b.key} className="leading-relaxed">
              {renderInline(b.line, b.key)}
            </p>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul key={b.key} className="list-disc pl-4 space-y-0.5 marker:text-muted-foreground/60">
              {b.items.map((it, idx) => (
                <li key={`${b.key}-${idx}`}>{renderInline(it, `${b.key}-${idx}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <ol key={b.key} className="list-decimal pl-4 space-y-0.5 marker:text-muted-foreground/60">
            {b.items.map((it, idx) => (
              <li key={`${b.key}-${idx}`}>{renderInline(it, `${b.key}-${idx}`)}</li>
            ))}
          </ol>
        );
      })}
    </>
  );
};

/** Plain-text version used for truncation length calculations. */
export const stripNotificationFormatting = (text: string): string =>
  text
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/~~([^~\n]+)~~/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1");
