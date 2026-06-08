import { useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const sb = supabase as any;

// Simple in-memory cache to avoid hammering site_settings across multiple components on the same page
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

async function readSetting(key: string): Promise<string | null> {
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;
  const p = (async () => {
    const { data } = await sb.from("site_settings").select("value").eq("key", key).maybeSingle();
    const v = data?.value ?? null;
    if (v != null) cache.set(key, v);
    return v;
  })();
  inflight.set(key, p);
  const v = await p;
  inflight.delete(key);
  return v;
}

async function writeSetting(key: string, value: string) {
  const { error } = await sb.from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (!error) cache.set(key, value);
  return error;
}

interface Props {
  settingKey: string;
  defaultValue: string;
  multiline?: boolean;
  className?: string;
  /** Optional render function to render the value with custom markup (e.g. <h2>). */
  as?: "span" | "p" | "h2" | "h3" | "h4" | "div";
  /** When the text is part of a heading that uses other inline markup, you can wrap children */
  children?: (value: string) => ReactNode;
  inputClassName?: string;
  rows?: number;
  placeholder?: string;
}

export function AdminEditableText({
  settingKey,
  defaultValue,
  multiline = false,
  className = "",
  as = "span",
  children,
  inputClassName = "",
  rows = 3,
  placeholder,
}: Props) {
  const { isAdmin } = useAdmin();
  const [value, setValue] = useState(defaultValue);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(defaultValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    readSetting(settingKey).then((v) => {
      if (!alive) return;
      if (v != null) { setValue(v); setDraft(v); }
    });
    return () => { alive = false; };
  }, [settingKey]);

  const save = async () => {
    setSaving(true);
    const err = await writeSetting(settingKey, draft);
    setSaving(false);
    if (err) {
      toast({ title: "Errore nel salvataggio", description: err.message, variant: "destructive" });
    } else {
      setValue(draft);
      setEditing(false);
      toast({ title: "Aggiornato" });
    }
  };

  if (editing && isAdmin) {
    return (
      <div className="flex items-start gap-2 w-full">
        {multiline ? (
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={rows} className={`flex-1 ${inputClassName}`} placeholder={placeholder} />
        ) : (
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} className={`flex-1 ${inputClassName}`} placeholder={placeholder} />
        )}
        <Button size="icon" variant="ghost" onClick={save} disabled={saving}><Check size={14} /></Button>
        <Button size="icon" variant="ghost" onClick={() => { setDraft(value); setEditing(false); }}><X size={14} /></Button>
      </div>
    );
  }

  const Tag = as as any;
  const editable = isAdmin ? (
    <button
      type="button"
      title="Modifica testo"
      onClick={(e) => { e.stopPropagation(); setDraft(value); setEditing(true); }}
      className="ml-1 inline-flex items-center align-middle opacity-50 hover:opacity-100 transition"
    >
      <Pencil size={12} />
    </button>
  ) : null;

  return (
    <Tag className={className}>
      {children ? children(value) : value}
      {editable}
    </Tag>
  );
}
