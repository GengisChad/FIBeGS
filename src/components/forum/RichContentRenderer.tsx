import { Link } from "react-router-dom";
import { Fragment } from "react";
import { sanitizeUserHtml } from "@/lib/sanitizeUserHtml";

// Detect video URLs and render embeds
const VIDEO_PATTERNS = [
  { regex: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)(?:[&?][\w=]*)*/, type: "youtube" as const },
  { regex: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([\w-]+)/, type: "youtube" as const },
  { regex: /(?:https?:\/\/)?(?:www\.)?twitch\.tv\/videos\/(\d+)/, type: "twitch" as const },
];

const getVideoEmbed = (url: string): { type: string; id: string } | null => {
  for (const pattern of VIDEO_PATTERNS) {
    const match = url.match(pattern.regex);
    if (match) return { type: pattern.type, id: match[1] };
  }
  return null;
};

const VideoEmbed = ({ type, id }: { type: string; id: string }) => {
  if (type === "youtube") {
    return (
      <div className="my-2 rounded-xl overflow-hidden border border-border max-w-md">
        <div className="aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${id}`}
            title="Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
            loading="lazy"
          />
        </div>
      </div>
    );
  }
  if (type === "twitch") {
    return (
      <div className="my-2 rounded-xl overflow-hidden border border-border max-w-md">
        <div className="aspect-video">
          <iframe
            src={`https://player.twitch.tv/?video=${id}&parent=${window.location.hostname}`}
            allowFullScreen
            className="w-full h-full"
            loading="lazy"
          />
        </div>
      </div>
    );
  }
  return null;
};

interface RichContentRendererProps {
  content: string;
}

/** Detect if content is HTML (from TipTap editor) vs legacy markdown-like format */
const isHtmlContent = (content: string): boolean => {
  const trimmed = content.trim();
  return /^<[a-z]/i.test(trimmed) || trimmed.includes("<p>") || trimmed.includes("<h2>") || trimmed.includes("<strong>");
};

/** Process @mentions inside HTML content, turning them into profile links */
const processMentionsInHtml = (html: string): string => {
  // Only replace @mentions that are NOT inside HTML tags (not within < >)
  return html.replace(/>([^<]*)</g, (match, textContent) => {
    const processed = textContent.replace(
      /@(\w+)/g,
      '<a href="/profilo/$1" class="mention-link" data-mention="$1">@$1</a>'
    );
    return `>${processed}<`;
  });
};

export const RichContentRenderer = ({ content }: RichContentRendererProps) => {
  // HTML content from TipTap editor
  if (isHtmlContent(content)) {
    const processed = processMentionsInHtml(content);
    const sanitized = sanitizeUserHtml(processed);

    return (
      <div
        className="rich-content"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }

  // Legacy markdown-like content
  const lines = content.split("\n");

  return (
    <div className="space-y-0.5">
      {lines.map((line, lineIdx) => {
        // Check for [gif:url] pattern
        const gifMatch = line.match(/\[gif:(https?:\/\/[^\]]+)\]/);
        if (gifMatch) {
          const beforeGif = line.slice(0, gifMatch.index);
          const afterGif = line.slice((gifMatch.index || 0) + gifMatch[0].length);
          return (
            <Fragment key={lineIdx}>
              {beforeGif && <span>{renderInlineContent(beforeGif)}</span>}
              <div className="my-2">
                <img src={gifMatch[1]} alt="GIF" className="max-h-64 rounded-xl border border-border" loading="lazy" />
              </div>
              {afterGif && <span>{renderInlineContent(afterGif)}</span>}
            </Fragment>
          );
        }

        // Check for [sticker:url] pattern
        const stickerMatch = line.match(/\[sticker:(https?:\/\/[^\]]+)\]/);
        if (stickerMatch) {
          const beforeSticker = line.slice(0, stickerMatch.index);
          const afterSticker = line.slice((stickerMatch.index || 0) + stickerMatch[0].length);
          return (
            <Fragment key={lineIdx}>
              {beforeSticker && <span>{renderInlineContent(beforeSticker)}</span>}
              <div className="my-2">
                <img src={stickerMatch[1]} alt="Sticker" className="h-24 w-24 object-contain" loading="lazy" />
              </div>
              {afterSticker && <span>{renderInlineContent(afterSticker)}</span>}
            </Fragment>
          );
        }

        // Check for video URLs in text
        const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          const videoInfo = getVideoEmbed(urlMatch[1]);
          if (videoInfo) {
            const beforeUrl = line.slice(0, urlMatch.index);
            const afterUrl = line.slice((urlMatch.index || 0) + urlMatch[0].length);
            return (
              <Fragment key={lineIdx}>
                {beforeUrl && <span>{renderInlineContent(beforeUrl)}</span>}
                <VideoEmbed type={videoInfo.type} id={videoInfo.id} />
                {afterUrl.trim() && <span>{renderInlineContent(afterUrl)}</span>}
              </Fragment>
            );
          }
        }

        // Block-level: ## Heading
        if (line.match(/^## (.+)$/)) {
          return <h2 key={lineIdx} className="text-lg font-bold mt-3 mb-1">{renderInlineContent(line.slice(3))}</h2>;
        }
        // Block-level: ### Heading
        if (line.match(/^### (.+)$/)) {
          return <h3 key={lineIdx} className="text-base font-semibold mt-2 mb-1">{renderInlineContent(line.slice(4))}</h3>;
        }
        // Block-level: > Quote
        if (line.match(/^> (.*)$/)) {
          return (
            <blockquote key={lineIdx} className="border-l-2 border-primary/50 pl-3 text-muted-foreground italic my-1">
              {renderInlineContent(line.slice(2))}
            </blockquote>
          );
        }
        // Block-level: - Unordered list
        if (line.match(/^- (.+)$/)) {
          return (
            <div key={lineIdx} className="flex items-start gap-2 ml-2">
              <span className="text-primary mt-1.5 text-xs">●</span>
              <span>{renderInlineContent(line.slice(2))}</span>
            </div>
          );
        }
        // Block-level: 1. Ordered list
        const olMatch = line.match(/^(\d+)\. (.+)$/);
        if (olMatch) {
          return (
            <div key={lineIdx} className="flex items-start gap-2 ml-2">
              <span className="text-primary font-medium text-sm min-w-[1.2em] text-right">{olMatch[1]}.</span>
              <span>{renderInlineContent(olMatch[2])}</span>
            </div>
          );
        }

        // Normal text line
        return (
          <div key={lineIdx}>
            {line === "" ? <br /> : renderInlineContent(line)}
          </div>
        );
      })}
    </div>
  );
};

const TEXT_COLOR_MAP: Record<string, string> = {
  red: "text-red-500", blue: "text-blue-500", green: "text-green-500", orange: "text-orange-500",
  purple: "text-purple-500", yellow: "text-yellow-500", pink: "text-pink-500", cyan: "text-cyan-500",
};

const HIGHLIGHT_COLOR_MAP: Record<string, string> = {
  yellow: "bg-yellow-300/40", green: "bg-green-300/40", blue: "bg-blue-300/40", pink: "bg-pink-300/40",
  orange: "bg-orange-300/40", purple: "bg-purple-300/40", cyan: "bg-cyan-300/40", red: "bg-red-300/40",
};

// Render inline content with formatting (legacy format)
function renderInlineContent(text: string) {
  const tokens: React.ReactNode[] = [];
  const inlineRegex = /(\[color:(\w+)\](.*?)\[\/color\])|(\[highlight:(\w+)\](.*?)\[\/highlight\])|(\*\*(.+?)\*\*)|(_(.+?)_)|(~~(.+?)~~)|(`(.+?)`)|(\[([^\]]+)\]\(([^)]+)\))|(@\w+)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
    }

    if (match[1]) {
      const colorClass = TEXT_COLOR_MAP[match[2]] || "";
      tokens.push(<span key={`clr-${match.index}`} className={colorClass}>{match[3]}</span>);
    } else if (match[4]) {
      const hlClass = HIGHLIGHT_COLOR_MAP[match[5]] || "";
      tokens.push(<span key={`hl-${match.index}`} className={`${hlClass} px-0.5 rounded`}>{match[6]}</span>);
    } else if (match[7]) {
      tokens.push(<strong key={`b-${match.index}`} className="font-bold">{match[8]}</strong>);
    } else if (match[9]) {
      tokens.push(<em key={`i-${match.index}`} className="italic">{match[10]}</em>);
    } else if (match[11]) {
      tokens.push(<del key={`s-${match.index}`} className="line-through text-muted-foreground">{match[12]}</del>);
    } else if (match[13]) {
      tokens.push(
        <code key={`c-${match.index}`} className="bg-secondary px-1.5 py-0.5 rounded text-sm font-mono text-primary">
          {match[14]}
        </code>
      );
    } else if (match[15]) {
      tokens.push(
        <a
          key={`l-${match.index}`}
          href={match[17]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80"
          onClick={(e) => e.stopPropagation()}
        >
          {match[16]}
        </a>
      );
    } else if (match[0].startsWith("@")) {
      const username = match[0].slice(1);
      tokens.push(
        <Link
          key={`m-${match.index}`}
          to={`/profilo/${username}`}
          className="text-primary font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {match[0]}
        </Link>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return tokens.length > 0 ? tokens : text;
}
