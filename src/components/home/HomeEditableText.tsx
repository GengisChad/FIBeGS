import { ElementType, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { cn } from "@/lib/utils";

type EditableTag = "h1" | "h2" | "h3" | "p" | "span";

interface HomeEditableTextProps {
  storageKey: string;
  defaultText: string;
  as?: EditableTag;
  className?: string;
  multiline?: boolean;
}

const prefix = "ibnf-home-copy:";

export const HomeEditableText = ({
  storageKey,
  defaultText,
  as = "p",
  className,
  multiline = false,
}: HomeEditableTextProps) => {
  const { isAdmin } = useAdmin();
  const ref = useRef<HTMLElement | null>(null);
  const [text, setText] = useState(defaultText);
  const Component = as as ElementType;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`${prefix}${storageKey}`);
      if (saved?.trim()) setText(saved);
    } catch {
      /* frontend-only draft copy */
    }
  }, [storageKey]);

  useEffect(() => {
    if (!ref.current || document.activeElement === ref.current) return;
    ref.current.innerText = text;
  }, [text]);

  const persist = () => {
    const next = (ref.current?.innerText || "").trim() || defaultText;
    setText(next);
    try {
      window.localStorage.setItem(`${prefix}${storageKey}`, next);
    } catch {
      /* noop */
    }
  };

  const reset = () => {
    setText(defaultText);
    try {
      window.localStorage.removeItem(`${prefix}${storageKey}`);
    } catch {
      /* noop */
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!multiline && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  return (
    <div className="ibnf-editable-wrap">
      <Component
        ref={ref}
        className={cn(className, isAdmin && "ibnf-editable-copy")}
        contentEditable={isAdmin}
        suppressContentEditableWarning
        onBlur={persist}
        onKeyDown={onKeyDown}
      >
        {text}
      </Component>
      {isAdmin && (
        <span className="ibnf-editable-tools" aria-hidden="false">
          <button type="button" onClick={() => ref.current?.focus()} title="Modifica testo">
            <Pencil size={12} />
          </button>
          <button type="button" onClick={reset} title="Ripristina testo">
            <RotateCcw size={12} />
          </button>
        </span>
      )}
    </div>
  );
};

export default HomeEditableText;