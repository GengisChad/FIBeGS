import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  initialText: string;
  onSaveEdit?: (next: string) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const MessageActions = ({ initialText, onSaveEdit, onDelete, canEdit, canDelete }: Props) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(initialText);

  const save = async () => {
    const v = val.trim();
    if (!v) return;
    try { await onSaveEdit?.(v); setEditing(false); setOpen(false); }
    catch (e: any) { toast.error(e?.message || "Errore"); }
  };

  const del = async () => {
    if (!confirm("Eliminare questo messaggio?")) return;
    try { await onDelete?.(); setOpen(false); }
    catch (e: any) { toast.error(e?.message || "Errore"); }
  };

  if (!canEdit && !canDelete) return null;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(false); setVal(initialText); } }}>
      <PopoverTrigger asChild>
        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-background/20" aria-label="Azioni">
          <MoreHorizontal size={12} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        {editing ? (
          <div className="flex gap-1">
            <Input value={val} onChange={(e) => setVal(e.target.value)} className="h-8 text-sm" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } if (e.key === "Escape") setEditing(false); }} />
            <Button size="icon" className="h-8 w-8" onClick={save}><Check size={14} /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(false)}><X size={14} /></Button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {canEdit && (
              <Button variant="ghost" size="sm" className="justify-start h-8" onClick={() => setEditing(true)}>
                <Pencil size={12} className="mr-2" /> Modifica
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" size="sm" className="justify-start h-8 text-destructive hover:text-destructive" onClick={del}>
                <Trash2 size={12} className="mr-2" /> Elimina
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
