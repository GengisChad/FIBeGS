import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripHorizontal, GripVertical } from "lucide-react";
import { ReactNode } from "react";

interface Props {
  id: string;
  children: ReactNode;
  className?: string;
  /** If true, exposes the drag handle visually; otherwise renders a hidden handle. */
  handle?: "row" | "icon";
}

/**
 * Sortable wrapper for course items. Use `handle="row"` to make the entire
 * row draggable (admin sidebar). Use `handle="icon"` to render a grip icon
 * (when the card contains interactive elements like links).
 */
export function SortableCourseItem({ id, children, className, handle = "row" }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  if (handle === "icon") {
    return (
      <div ref={setNodeRef} style={style} className={`relative h-full ${className || ""}`}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.preventDefault()}
          className="absolute top-1.5 left-1/2 -translate-x-1/2 z-20 inline-flex items-center justify-center px-2 py-0.5 text-muted-foreground hover:text-primary cursor-grab active:cursor-grabbing transition-colors"
          style={{
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 30%, black 70%, transparent 100%)",
            maskImage: "linear-gradient(to right, transparent 0%, black 30%, black 70%, transparent 100%)",
          }}
          title="Trascina per riordinare"
          aria-label="Trascina"
        >
          <GripHorizontal size={16} strokeWidth={2.25} />
        </button>
        {children}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={className}>
      {children}
    </div>
  );
}
