import { useState, useRef, useImperativeHandle, forwardRef, useCallback, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export interface MentionTextareaHandle {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

interface MentionTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

// Helper to get caret coordinates in a textarea
function getCaretCoordinates(el: HTMLTextAreaElement, position: number) {
  const div = document.createElement("div");
  const style = getComputedStyle(el);
  const props = [
    "fontFamily", "fontSize", "fontWeight", "letterSpacing", "lineHeight",
    "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "border", "borderWidth", "boxSizing", "whiteSpace", "wordWrap", "overflowWrap", "width",
  ];
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  props.forEach((p) => {
    (div.style as any)[p] = (style as any)[p];
  });
  div.style.overflow = "hidden";
  div.style.height = "auto";

  const text = el.value.substring(0, position);
  div.textContent = text;

  const span = document.createElement("span");
  span.textContent = el.value.substring(position) || ".";
  div.appendChild(span);

  document.body.appendChild(div);
  const top = span.offsetTop - el.scrollTop;
  const left = span.offsetLeft;
  document.body.removeChild(div);

  return { top, left };
}

export const MentionTextarea = forwardRef<MentionTextareaHandle, MentionTextareaProps>(
  ({ value, onChange, placeholder, rows = 3, className = "" }, ref) => {
    const [mentionResults, setMentionResults] = useState<{ username: string; display_name: string | null; avatar_url: string | null }[]>([]);
    const [showMentions, setShowMentions] = useState(false);
    const [cursorPos, setCursorPos] = useState(0);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({ textareaRef }), []);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      const pos = e.target.selectionStart || 0;
      onChange(val);
      setCursorPos(pos);
      const textBefore = val.slice(0, pos);
      const mentionMatch = textBefore.match(/@(\w*)$/);
      if (mentionMatch && mentionMatch[1].length >= 1) {
        searchUsers(mentionMatch[1]);
        setShowMentions(true);
        // Calculate position of the @ symbol
        if (textareaRef.current) {
          const atPos = pos - mentionMatch[0].length;
          const coords = getCaretCoordinates(textareaRef.current, atPos);
          setDropdownPos({ top: coords.top, left: coords.left });
        }
      } else {
        setShowMentions(false);
      }
    };

    const searchUsers = async (query: string) => {
      const { data } = await supabase.rpc("search_mentionable_users", { q: query });
      setMentionResults(((data || []) as any[]).filter((p) => p.username).slice(0, 5));
    };

    const insertMention = (username: string) => {
      const textBefore = value.slice(0, cursorPos);
      const textAfter = value.slice(cursorPos);
      const mentionStart = textBefore.lastIndexOf("@");
      const newText = textBefore.slice(0, mentionStart) + `@${username} ` + textAfter;
      onChange(newText);
      setShowMentions(false);
      textareaRef.current?.focus();
    };

    return (
      <div className="relative" ref={containerRef}>
        <Textarea
          ref={textareaRef}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          rows={rows}
          className={className}
        />
        {showMentions && mentionResults.length > 0 && (
          <div
            className="absolute z-50 w-full max-w-xs bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
            style={{
              bottom: `calc(100% - ${dropdownPos.top}px)`,
              left: Math.min(dropdownPos.left, 200),
            }}
          >
            {mentionResults.map((u) => (
              <button
                key={u.username}
                type="button"
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                onClick={() => insertMention(u.username!)}
              >
                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center border border-border overflow-hidden shrink-0">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-medium">{(u.display_name || u.username || "?").charAt(0).toUpperCase()}</span>
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
  }
);

MentionTextarea.displayName = "MentionTextarea";
