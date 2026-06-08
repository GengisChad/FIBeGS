import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import LinkExt from "@tiptap/extension-link";
import PlaceholderExt from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { useState, useRef, useEffect } from "react";
import {
  Bold, Italic, Strikethrough, Code, Heading2, Heading3,
  List, ListOrdered, Quote, Link2, Palette, Highlighter, Smile,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ForumMediaToolbar } from "./ForumMediaToolbar";
import { supabase } from "@/integrations/supabase/client";

const TEXT_COLORS = [
  { name: "Nero", hex: "#000000" },
  { name: "Grigio scuro", hex: "#374151" },
  { name: "Grigio", hex: "#6b7280" },
  { name: "Grigio chiaro", hex: "#9ca3af" },
  { name: "Argento", hex: "#d1d5db" },
  { name: "Bianco", hex: "#ffffff" },
  { name: "Rosso scuro", hex: "#991b1b" },
  { name: "Rosso", hex: "#ef4444" },
  { name: "Rosso chiaro", hex: "#fca5a5" },
  { name: "Arancione scuro", hex: "#c2410c" },
  { name: "Arancione", hex: "#f97316" },
  { name: "Arancione chiaro", hex: "#fdba74" },
  { name: "Ambra scuro", hex: "#b45309" },
  { name: "Ambra", hex: "#f59e0b" },
  { name: "Ambra chiaro", hex: "#fcd34d" },
  { name: "Giallo", hex: "#eab308" },
  { name: "Giallo chiaro", hex: "#fde047" },
  { name: "Lime scuro", hex: "#4d7c0f" },
  { name: "Lime", hex: "#84cc16" },
  { name: "Lime chiaro", hex: "#bef264" },
  { name: "Verde scuro", hex: "#166534" },
  { name: "Verde", hex: "#22c55e" },
  { name: "Verde chiaro", hex: "#86efac" },
  { name: "Smeraldo", hex: "#10b981" },
  { name: "Teal scuro", hex: "#115e59" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Teal chiaro", hex: "#5eead4" },
  { name: "Ciano", hex: "#06b6d4" },
  { name: "Celeste", hex: "#0ea5e9" },
  { name: "Celeste chiaro", hex: "#7dd3fc" },
  { name: "Blu scuro", hex: "#1e40af" },
  { name: "Blu", hex: "#3b82f6" },
  { name: "Blu chiaro", hex: "#93c5fd" },
  { name: "Indaco scuro", hex: "#3730a3" },
  { name: "Indaco", hex: "#6366f1" },
  { name: "Indaco chiaro", hex: "#a5b4fc" },
  { name: "Viola scuro", hex: "#5b21b6" },
  { name: "Viola", hex: "#8b5cf6" },
  { name: "Viola chiaro", hex: "#c4b5fd" },
  { name: "Porpora", hex: "#a855f7" },
  { name: "Fucsia scuro", hex: "#a21caf" },
  { name: "Fucsia", hex: "#d946ef" },
  { name: "Fucsia chiaro", hex: "#f0abfc" },
  { name: "Rosa scuro", hex: "#be185d" },
  { name: "Rosa", hex: "#ec4899" },
  { name: "Rosa chiaro", hex: "#f9a8d4" },
  { name: "Oro", hex: "#ca8a04" },
];


function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const EMOJI_LIST = [
  "😀", "😂", "🤣", "😍", "🥰", "😎", "🤩", "😤", "😡", "🥺",
  "😢", "😭", "🤔", "🤯", "🥳", "😏", "👀", "🔥", "💯", "⚡",
  "❤️", "💙", "💚", "💛", "🧡", "💜", "🖤", "🤍", "💪", "👊",
  "✌️", "🤞", "👍", "👎", "👏", "🙌", "🎉", "🎊", "🏆", "🥇",
  "⭐", "🌟", "💫", "✨", "🎯", "🎮", "🕹️", "🃏", "🧩", "🪀",
];

interface MentionResult {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface RichTextEditorProps {
  initialContent?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

/** Convert legacy plain‑text content to HTML paragraphs so TipTap can load it */
function toEditorHtml(content: string): string {
  if (!content) return "<p></p>";
  if (/<(?:p|h[1-6]|ul|ol|blockquote|img)\b/i.test(content)) return content;
  return content
    .split("\n")
    .map((l) => (l.trim() === "" ? "<p></p>" : `<p>${l}</p>`))
    .join("");
}

const TBtn = ({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`h-7 w-7 flex items-center justify-center rounded text-sm transition-colors ${
      active
        ? "bg-primary/20 text-primary"
        : "text-muted-foreground hover:text-foreground hover:bg-accent"
    }`}
  >
    {children}
  </button>
);

export const RichTextEditor = ({
  initialContent = "",
  onChange,
  placeholder = "",
  className = "",
}: RichTextEditorProps) => {
  const [colorOpen, setColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [bubbleColorOpen, setBubbleColorOpen] = useState(false);
  const [bubbleHighlightOpen, setBubbleHighlightOpen] = useState(false);
  const [highlightOpacity, setHighlightOpacity] = useState(30);
  

  // Floating toolbar state
  const [floatingToolbar, setFloatingToolbar] = useState<{ show: boolean; top: number; left: number }>({ show: false, top: 0, left: 0 });
  const [editorFocused, setEditorFocused] = useState(false);

  // Mention state
  const [mentionShow, setMentionShow] = useState(false);
  const [mentionResults, setMentionResults] = useState<MentionResult[]>([]);
  const [mentionCoords, setMentionCoords] = useState({ top: 0, left: 0 });
  const [mentionAtPos, setMentionAtPos] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      LinkExt.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline" },
      }),
      PlaceholderExt.configure({ placeholder }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: toEditorHtml(initialContent),
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  // Mention detection
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      try {
        const { $from } = editor.state.selection;
        const textBefore = $from.parent.textBetween(0, $from.parentOffset);
        const match = textBefore.match(/@(\w+)$/);
        if (match && match[1].length >= 1) {
          searchUsers(match[1]).then((results) => {
            if (results.length > 0) {
              const atDocPos = $from.pos - match[0].length;
              try {
                const coords = editor.view.coordsAtPos(atDocPos);
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                  setMentionCoords({
                    top: coords.top - rect.top,
                    left: Math.min(coords.left - rect.left, 200),
                  });
                }
              } catch {
                /* ignore coord errors */
              }
              setMentionAtPos(atDocPos);
              setMentionResults(results);
              setMentionShow(true);
            } else {
              setMentionShow(false);
            }
          });
        } else {
          setMentionShow(false);
        }
      } catch {
        setMentionShow(false);
      }
    };
    editor.on("update", handler);
    editor.on("selectionUpdate", handler);
    return () => {
      editor.off("update", handler);
      editor.off("selectionUpdate", handler);
    };
  }, [editor]);

  // Floating toolbar: always follow cursor position
  useEffect(() => {
    if (!editor) return;
    const updatePos = () => {
      try {
        const { from } = editor.state.selection;
        const coords = editor.view.coordsAtPos(from);
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          // Clamp left so the toolbar never overflows the editor container
          const toolbarWidth = 420; // approximate floating toolbar width
          const rawLeft = coords.left - rect.left;
          const clampedLeft = Math.max(8, Math.min(rawLeft, rect.width - toolbarWidth - 8));
          setFloatingToolbar({
            show: true,
            top: coords.top - rect.top - 4,
            left: clampedLeft,
          });
        }
      } catch {
        /* ignore */
      }
    };
    editor.on("selectionUpdate", updatePos);
    editor.on("update", updatePos);
    // Initial position
    updatePos();
    return () => {
      editor.off("selectionUpdate", updatePos);
      editor.off("update", updatePos);
    };
  }, [editor]);

  const searchUsers = async (query: string): Promise<MentionResult[]> => {
    const { data } = await supabase.rpc("search_mentionable_users", { q: query });
    return ((data || []) as MentionResult[]).filter((p) => p.username).slice(0, 5);
  };

  const insertMention = (username: string) => {
    if (!editor) return;
    const to = editor.state.selection.from;
    editor
      .chain()
      .focus()
      .deleteRange({ from: mentionAtPos, to })
      .insertContent(`@${username} `)
      .run();
    setMentionShow(false);
  };

  const addLink = () => {
    if (!editor) return;
    const url = window.prompt("Inserisci URL:");
    if (!url) return;
    const { from, to } = editor.state.selection;
    if (from === to) {
      editor.chain().focus().insertContent(`<a href="${url}">${url}</a>`).run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  if (!editor) return null;

  return (
    <div
      ref={containerRef}
      className={`tiptap-editor relative border border-border rounded-lg overflow-hidden ${className}`}
    >
      {/* Fixed toolbar hidden - all tools in floating toolbar */}
      <div className="flex items-center px-2 py-1 border-b border-border bg-secondary/50">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          @ per menzionare
        </span>
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="bg-secondary"
        onFocus={() => setEditorFocused(true)}
        onBlur={(e) => {
          // Don't blur if clicking within the floating toolbar
          if (containerRef.current?.contains(e.relatedTarget as Node)) return;
          setEditorFocused(false);
        }}
      />

      {/* Floating toolbar - visible only when editor is focused */}
      {floatingToolbar.show && editorFocused && (
        <div
          className="absolute z-[60] flex items-center gap-0.5 flex-wrap bg-popover border border-border rounded-lg shadow-xl px-1 py-0.5 sm:px-1.5 sm:py-1 animate-in fade-in-0 zoom-in-95 max-w-[calc(100vw-16px)] sm:max-w-none"
          style={{
            top: floatingToolbar.top,
            left: floatingToolbar.left,
            transform: "translateY(-100%)",
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {/* Text formatting */}
          <TBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Grassetto"><Bold size={14} /></TBtn>
          <TBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Corsivo"><Italic size={14} /></TBtn>
          <TBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Barrato"><Strikethrough size={14} /></TBtn>
          <TBtn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="Codice"><Code size={14} /></TBtn>

          <div className="w-px h-4 bg-border mx-0.5 hidden sm:block" />

          {/* Headings & blocks */}
          <TBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Titolo"><Heading2 size={14} /></TBtn>
          <TBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Sottotitolo"><Heading3 size={14} /></TBtn>
          <TBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citazione"><Quote size={14} /></TBtn>
          <TBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista puntata"><List size={14} /></TBtn>
          <TBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerata"><ListOrdered size={14} /></TBtn>

          <div className="w-px h-4 bg-border mx-0.5 hidden sm:block" />

          {/* Link */}
          <TBtn active={editor.isActive("link")} onClick={addLink} title="Link"><Link2 size={14} /></TBtn>

          {/* Color picker */}
          <Popover open={bubbleColorOpen} onOpenChange={setBubbleColorOpen}>
            <PopoverTrigger asChild>
              <button type="button" title="Colore" className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" onMouseDown={(e) => e.preventDefault()}>
                <Palette size={14} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2 max-w-[200px]" side="top" onMouseDown={(e) => e.preventDefault()}>
              <p className="text-[10px] font-medium mb-1 text-muted-foreground">Colore testo</p>
              <div className="grid grid-cols-6 gap-1 max-h-[120px] overflow-y-auto touch-pan-y overscroll-contain pr-0.5">
                {TEXT_COLORS.map((c) => (
                  <button key={c.hex} type="button" style={{ backgroundColor: c.hex }} className="w-5 h-5 rounded-full hover:ring-2 ring-offset-1 ring-foreground/30 transition-all border border-border/30 shrink-0" title={c.name}
                    onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setColor(c.hex).run(); setBubbleColorOpen(false); }} />
                ))}
              </div>
              <button type="button" className="mt-1.5 text-[10px] text-muted-foreground hover:text-foreground w-full text-center"
                onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetColor().run(); setBubbleColorOpen(false); }}>
                Rimuovi colore
              </button>
            </PopoverContent>
          </Popover>

          {/* Highlight picker */}
          <Popover open={bubbleHighlightOpen} onOpenChange={setBubbleHighlightOpen}>
            <PopoverTrigger asChild>
              <button type="button" title="Evidenzia" className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" onMouseDown={(e) => e.preventDefault()}>
                <Highlighter size={14} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2 max-w-[180px]" side="top" onMouseDown={(e) => e.preventDefault()}>
              <p className="text-[10px] font-medium mb-1 text-muted-foreground">Evidenziatore</p>
              <div className="grid grid-cols-6 gap-1 max-h-[120px] overflow-y-auto touch-pan-y overscroll-contain pr-0.5">
                {TEXT_COLORS.map((c) => (
                  <button key={c.hex} type="button" style={{ backgroundColor: hexToRgba(c.hex, highlightOpacity / 100) }} className="w-5 h-5 rounded-full hover:ring-2 ring-offset-1 ring-foreground/30 transition-all border border-border/30 shrink-0" title={c.name}
                    onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHighlight({ color: hexToRgba(c.hex, highlightOpacity / 100) }).run(); setBubbleHighlightOpen(false); }} />
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">Opacità</span>
                  <span className="text-[10px] font-medium text-muted-foreground">{highlightOpacity}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="80"
                  step="5"
                  value={highlightOpacity}
                  onChange={(e) => setHighlightOpacity(Number(e.target.value))}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-full h-1.5 accent-primary cursor-pointer"
                />
              </div>
              <button type="button" className="mt-1.5 text-[10px] text-muted-foreground hover:text-foreground w-full text-center"
                onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetHighlight().run(); setBubbleHighlightOpen(false); }}>
                Rimuovi evidenziazione
              </button>
            </PopoverContent>
          </Popover>

          {/* Emoji picker */}
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" title="Emoji" className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" onMouseDown={(e) => e.preventDefault()}>
                <Smile size={14} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" side="top" onMouseDown={(e) => e.preventDefault()}>
              <div className="grid grid-cols-10 gap-0.5 max-h-40 overflow-y-auto">
                {EMOJI_LIST.map((em) => (
                  <button key={em} type="button" className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-base sm:text-lg hover:bg-accent rounded transition-colors"
                    onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().insertContent(em).run(); }} >
                    {em}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <div className="w-px h-4 bg-border mx-0.5" />

          {/* GIF & Sticker */}
          <div onMouseDown={(e) => e.preventDefault()}>
            <ForumMediaToolbar
              onGifSelect={(url) => editor.chain().focus().setImage({ src: url, alt: "GIF" }).run()}
              onStickerSelect={(url) => editor.chain().focus().setImage({ src: url, alt: "Sticker" }).run()}
            />
          </div>
        </div>
      )}

      {/* Mention dropdown */}
      {mentionShow && mentionResults.length > 0 && (
        <div
          className="absolute z-50 w-full max-w-xs bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
          style={{
            top: mentionCoords.top - 8,
            left: mentionCoords.left,
            transform: "translateY(-100%)",
          }}
        >
          {mentionResults.map((u) => (
            <button
              key={u.username}
              type="button"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(u.username);
              }}
            >
              <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center border border-border overflow-hidden shrink-0">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-medium">
                    {(u.display_name || u.username || "?").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{u.display_name || u.username}</div>
                <div className="text-xs text-muted-foreground">@{u.username}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
