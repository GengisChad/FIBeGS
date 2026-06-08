import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Pencil, Trash2, Search, Image as ImageIcon } from "lucide-react";

import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import IconUploadDialog from "@/components/IconUploadDialog";
import { isLiveSite } from "@/hooks/useCustomIcons";

// Registry of all known overridable icon keys across the site.
// Keep this list aligned with <CustomIcon iconKey="..."> usages.
const KNOWN_KEYS: { key: string; label: string; section: string }[] = [
  { section: "Arena (loggato)", key: "arena.points", label: "Punti" },
  { section: "Arena (loggato)", key: "arena.wins",   label: "Vittorie" },
  { section: "Arena (loggato)", key: "arena.shoot",  label: "Shoot" },
  { section: "Arena (guest)",   key: "arena.guest.bladers", label: "Bladers" },
  { section: "Arena (guest)",   key: "arena.guest.clubs",   label: "Club" },
  { section: "Arena (guest)",   key: "arena.guest.events",  label: "Eventi" },
  { section: "KPI Circuito",    key: "kpi.bladers",     label: "Bladers" },
  { section: "KPI Circuito",    key: "kpi.clubs",       label: "Club" },
  { section: "KPI Circuito",    key: "kpi.tournaments", label: "Tornei anno" },
  { section: "KPI Circuito",    key: "kpi.upcoming",    label: "In programma" },
  { section: "Sidebar",         key: "sidebar.tournaments", label: "Tornei" },
  { section: "Sidebar",         key: "sidebar.rankings",    label: "Classifica" },
  { section: "Sidebar",         key: "sidebar.elo",         label: "Ranking ELO" },
  { section: "Sidebar",         key: "sidebar.achievements",label: "Achievement" },
];

type CustomIconRow = { icon_key: string; image_url: string; updated_at?: string };

const AdminIcons = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<{ key: string; url: string | null } | null>(null);
  const [customKeyOpen, setCustomKeyOpen] = useState(false);
  const [customKeyInput, setCustomKeyInput] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["admin-custom-icons"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("custom_icons")
        .select("icon_key, image_url, updated_at")
        .order("icon_key");
      return (data || []) as CustomIconRow[];
    },
    enabled: !!isAdmin,
    staleTime: 30 * 1000,
  });

  const byKey = useMemo(() => {
    const m = new Map<string, CustomIconRow>();
    for (const r of rows) m.set(r.icon_key, r);
    return m;
  }, [rows]);

  const allKeys = useMemo(() => {
    const set = new Set(KNOWN_KEYS.map((k) => k.key));
    for (const r of rows) set.add(r.icon_key);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return allKeys.filter((k) => !term || k.toLowerCase().includes(term));
  }, [allKeys, q]);

  if (authLoading || adminLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const live = isLiveSite();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-16 max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/admin">
            <Button variant="outline" size="sm" className="gap-2"><ArrowLeft size={14} /> Admin</Button>
          </Link>
          <h1 className="font-display text-2xl md:text-3xl tracking-wider">Gestione icone</h1>
        </div>

        {live && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200 mb-6">
            Sei sul dominio Live (<code>ibna.it</code>): le sostituzioni sono ignorate qui per sicurezza.
            Modifica e verifica le icone dagli ambienti di anteprima.
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca per chiave (es. arena.points)"
              className="pl-9"
            />
          </div>
          <Button onClick={() => { setCustomKeyInput(""); setCustomKeyOpen(true); }} className="gap-2">
            <Plus size={14} /> Nuova chiave
          </Button>
        </div>

        {/* Grouped known section */}
        <div className="space-y-6">
          {Object.entries(
            KNOWN_KEYS.reduce<Record<string, typeof KNOWN_KEYS>>((acc, k) => {
              if (!filtered.includes(k.key)) return acc;
              (acc[k.section] ||= []).push(k);
              return acc;
            }, {})
          ).map(([section, keys]) => (
            <section key={section}>
              <h2 className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold mb-2">{section}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {keys.map((k) => (
                  <IconCard
                    key={k.key}
                    iconKey={k.key}
                    label={k.label}
                    row={byKey.get(k.key)}
                    onEdit={() => setTarget({ key: k.key, url: byKey.get(k.key)?.image_url ?? null })}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* Extra keys present in DB but not in registry */}
          {(() => {
            const knownSet = new Set(KNOWN_KEYS.map((k) => k.key));
            const extras = filtered.filter((k) => !knownSet.has(k));
            if (extras.length === 0) return null;
            return (
              <section>
                <h2 className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold mb-2">Altre chiavi</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {extras.map((key) => (
                    <IconCard
                      key={key}
                      iconKey={key}
                      label={key}
                      row={byKey.get(key)}
                      onEdit={() => setTarget({ key, url: byKey.get(key)?.image_url ?? null })}
                    />
                  ))}
                </div>
              </section>
            );
          })()}
        </div>
      </main>
      <Footer />

      {target && (
        <IconUploadDialog
          iconKey={target.key}
          currentUrl={target.url}
          open={!!target}
          onOpenChange={(v) => {
            if (!v) {
              setTarget(null);
              qc.invalidateQueries({ queryKey: ["admin-custom-icons"] });
            }
          }}
        />
      )}

      {customKeyOpen && (
        <div className="fixed inset-0 z-[120] bg-black/60 grid place-items-center p-4" onClick={() => setCustomKeyOpen(false)}>
          <div className="bg-background border border-border rounded-xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg tracking-wider mb-2">Nuova chiave icona</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Usa una chiave descrittiva, es. <code>navbar.profile</code> oppure <code>card.club</code>.
              Verrà associata solo dopo che la chiave viene effettivamente referenziata nel codice.
            </p>
            <Input
              value={customKeyInput}
              onChange={(e) => setCustomKeyInput(e.target.value)}
              placeholder="es. mySection.iconName"
              className="mb-3"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setCustomKeyOpen(false)}>Annulla</Button>
              <Button
                size="sm"
                disabled={!customKeyInput.trim()}
                onClick={() => {
                  const k = customKeyInput.trim();
                  setCustomKeyOpen(false);
                  setTarget({ key: k, url: byKey.get(k)?.image_url ?? null });
                }}
              >
                Continua
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const IconCard = ({
  iconKey, label, row, onEdit,
}: { iconKey: string; label: string; row?: CustomIconRow; onEdit: () => void }) => {
  const qc = useQueryClient();
  const handleDelete = async () => {
    if (!confirm(`Ripristinare l'icona originale per "${iconKey}"?`)) return;
    await (supabase as any).from("custom_icons").delete().eq("icon_key", iconKey);
    qc.invalidateQueries({ queryKey: ["admin-custom-icons"] });
    qc.invalidateQueries({ queryKey: ["custom-icons-map"] });
  };
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2">
      <div className="aspect-square rounded-lg bg-muted/40 grid place-items-center overflow-hidden">
        {row?.image_url ? (
          <img src={row.image_url} alt="" className="max-h-[80%] max-w-[80%] object-contain" />
        ) : (
          <ImageIcon size={28} className="text-muted-foreground/60" />
        )}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold truncate">{label}</div>
        <div className="text-[10px] text-muted-foreground font-mono truncate">{iconKey}</div>
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" className="h-7 flex-1 text-[11px] gap-1" onClick={onEdit}>
          <Pencil size={11} /> {row ? "Cambia" : "Carica"}
        </Button>
        {row && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={handleDelete}>
            <Trash2 size={12} />
          </Button>
        )}
      </div>
    </div>
  );
};

export default AdminIcons;
