import { useState, useRef } from "react";
import { Bold, Italic, Strikethrough, Heading2, Heading3, List, ListOrdered, Quote, Link2, Code, Palette, Highlighter, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MentionTextareaHandle } from "./MentionTextarea";

interface FormatToolbarProps {
  mentionRef: React.RefObject<MentionTextareaHandle>;
  value: string;
  onChange: (val: string) => void;
}

type FormatAction = {
  icon: React.ReactNode;
  label: string;
  prefix: string;
  suffix: string;
  block?: boolean;
};

const formatActions: FormatAction[] = [
  { icon: <Bold size={15} />, label: "Grassetto", prefix: "**", suffix: "**" },
  { icon: <Italic size={15} />, label: "Corsivo", prefix: "_", suffix: "_" },
  { icon: <Strikethrough size={15} />, label: "Barrato", prefix: "~~", suffix: "~~" },
  { icon: <Code size={15} />, label: "Codice", prefix: "`", suffix: "`" },
  { icon: <Heading2 size={15} />, label: "Titolo", prefix: "## ", suffix: "", block: true },
  { icon: <Heading3 size={15} />, label: "Sottotitolo", prefix: "### ", suffix: "", block: true },
  { icon: <Quote size={15} />, label: "Citazione", prefix: "> ", suffix: "", block: true },
  { icon: <List size={15} />, label: "Lista", prefix: "- ", suffix: "", block: true },
  { icon: <ListOrdered size={15} />, label: "Lista numerata", prefix: "1. ", suffix: "", block: true },
  { icon: <Link2 size={15} />, label: "Link", prefix: "[", suffix: "](url)" },
];

const TEXT_COLORS = [
  { name: "Rosso", value: "red" },
  { name: "Blu", value: "blue" },
  { name: "Verde", value: "green" },
  { name: "Arancione", value: "orange" },
  { name: "Viola", value: "purple" },
  { name: "Giallo", value: "yellow" },
  { name: "Rosa", value: "pink" },
  { name: "Ciano", value: "cyan" },
];

const HIGHLIGHT_COLORS = [
  { name: "Giallo", value: "yellow" },
  { name: "Verde", value: "green" },
  { name: "Blu", value: "blue" },
  { name: "Rosa", value: "pink" },
  { name: "Arancione", value: "orange" },
  { name: "Viola", value: "purple" },
  { name: "Ciano", value: "cyan" },
  { name: "Rosso", value: "red" },
];

const COLOR_MAP: Record<string, string> = {
  red: "bg-red-500", blue: "bg-blue-500", green: "bg-green-500", orange: "bg-orange-500",
  purple: "bg-purple-500", yellow: "bg-yellow-400", pink: "bg-pink-500", cyan: "bg-cyan-500",
};

const EMOJI_LIST = [
  "😀", "😂", "🤣", "😍", "🥰", "😎", "🤩", "😤", "😡", "🥺",
  "😢", "😭", "🤔", "🤯", "🥳", "😏", "👀", "🔥", "💯", "⚡",
  "❤️", "💙", "💚", "💛", "🧡", "💜", "🖤", "🤍", "💪", "👊",
  "✌️", "🤞", "👍", "👎", "👏", "🙌", "🎉", "🎊", "🏆", "🥇",
  "⭐", "🌟", "💫", "✨", "🎯", "🎮", "🕹️", "🃏", "🧩", "🪀",
];

export const FormatToolbar = ({ mentionRef, value, onChange }: FormatToolbarProps) => {
  const [colorOpen, setColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const applyFormat = (action: FormatAction) => {
    const el = mentionRef.current?.textareaRef?.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selectedText = value.slice(start, end) || (action.block ? "" : "testo");

    let newText: string;
    let newCursorPos: number;

    if (action.block) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = value.indexOf("\n", end);
      const actualEnd = lineEnd === -1 ? value.length : lineEnd;
      const before = value.slice(0, lineStart);
      const lines = value.slice(lineStart, actualEnd);
      const formattedLines = lines.split("\n").map((line) => `${action.prefix}${line}`).join("\n");
      newText = before + formattedLines + value.slice(actualEnd);
      newCursorPos = before.length + formattedLines.length;
    } else {
      const before = value.slice(0, start);
      const after = value.slice(end);
      const inserted = `${action.prefix}${selectedText}${action.suffix}`;
      newText = before + inserted + after;
      newCursorPos = start + action.prefix.length + selectedText.length;
    }

    onChange(newText);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newCursorPos, newCursorPos);
    });
  };

  const applyColor = (color: string) => {
    const el = mentionRef.current?.textareaRef?.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selectedText = value.slice(start, end) || "testo";
    const before = value.slice(0, start);
    const after = value.slice(end);
    const inserted = `[color:${color}]${selectedText}[/color]`;
    onChange(before + inserted + after);
    setColorOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + `[color:${color}]`.length, start + `[color:${color}]`.length + selectedText.length);
    });
  };

  const applyHighlight = (color: string) => {
    const el = mentionRef.current?.textareaRef?.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selectedText = value.slice(start, end) || "testo";
    const before = value.slice(0, start);
    const after = value.slice(end);
    const inserted = `[highlight:${color}]${selectedText}[/highlight]`;
    onChange(before + inserted + after);
    setHighlightOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + `[highlight:${color}]`.length, start + `[highlight:${color}]`.length + selectedText.length);
    });
  };

  const insertEmoji = (emoji: string) => {
    const el = mentionRef.current?.textareaRef?.current;
    if (!el) return;
    const start = el.selectionStart;
    const before = value.slice(0, start);
    const after = value.slice(start);
    onChange(before + emoji + after);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-0.5 flex-wrap">
        {formatActions.map((action, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => applyFormat(action)}
              >
                {action.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {action.label}
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Text Color */}
        <Popover open={colorOpen} onOpenChange={setColorOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                  <Palette size={15} />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Colore testo</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-auto p-2" side="top">
            <p className="text-xs font-medium mb-1.5 text-muted-foreground">Colore testo</p>
            <div className="grid grid-cols-4 gap-1.5">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`w-7 h-7 rounded-full ${COLOR_MAP[c.value]} hover:ring-2 ring-offset-1 ring-foreground/30 transition-all`}
                  title={c.name}
                  onClick={() => applyColor(c.value)}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Highlight Color */}
        <Popover open={highlightOpen} onOpenChange={setHighlightOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                  <Highlighter size={15} />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Evidenzia testo</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-auto p-2" side="top">
            <p className="text-xs font-medium mb-1.5 text-muted-foreground">Colore evidenziatore</p>
            <div className="grid grid-cols-4 gap-1.5">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`w-7 h-7 rounded-full ${COLOR_MAP[c.value]} opacity-60 hover:opacity-100 hover:ring-2 ring-offset-1 ring-foreground/30 transition-all`}
                  title={c.name}
                  onClick={() => applyHighlight(c.value)}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Emoji Picker */}
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                  <Smile size={15} />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Emoji</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-auto p-2" side="top">
            <div className="grid grid-cols-10 gap-0.5 max-h-40 overflow-y-auto">
              {EMOJI_LIST.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-accent rounded transition-colors"
                  onClick={() => insertEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </TooltipProvider>
  );
};
