import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trash2, Swords, Heart, Flag, Pencil, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DeckCreatorDialog, type BeybladeConfig } from "./DeckCreatorDialog";

const BLADE_TYPE_LABELS: Record<string, string> = {
  BX: "BX",
  UX: "UX",
  CX: "CX",
  BX_INF: "BX♾️",
  UX_INF: "UX♾️",
  CX_INF: "CX♾️",
};

// Component display order: blade-type components first, then ratchet/ribs/bit last
const COMPONENT_ORDER: Record<string, number> = {
  blade: 0,
  lock_chip: 0,
  main_blade: 1,
  over_blade: 1,
  metal_blade: 2,
  assist_blade: 3,
  ratchet: 10,
  ribs: 10,
  bit: 11,
};

interface DeckBeyblade {
  id: string;
  position: number;
  blade_type: string;
  ratchet_type: string | null;
  components: {
    component_type: string;
    component_name: string;
    component_image: string | null;
    variant_name: string | null;
    variant_image: string | null;
    component_id: string;
    variant_id: string | null;
  }[];
}

interface DeckCardProps {
  deck: {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    created_at: string;
  };
  profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
  onDeleted?: () => void;
  compact?: boolean;
  hideDetail?: boolean;
}

export const DeckCard = ({ deck, profile, onDeleted, compact, hideDetail }: DeckCardProps) => {
  const { user } = useAuth();
  const { isStaff } = useUserRoles();
  const [beyblades, setBeyblades] = useState<DeckBeyblade[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    fetchBeyblades();
    fetchLikes();
  }, [deck.id]);

  const fetchBeyblades = async () => {
    const { data: beys } = await (supabase as any)
      .from("deck_beyblades")
      .select("id, position, blade_type, ratchet_type")
      .eq("deck_id", deck.id)
      .order("position");

    if (!beys || beys.length === 0) { setLoaded(true); return; }

    const beyIds = beys.map((b: any) => b.id);
    const { data: comps } = await (supabase as any)
      .from("deck_beyblade_components")
      .select("deck_beyblade_id, component_type, component_id, variant_id")
      .in("deck_beyblade_id", beyIds);

    const compIds = [...new Set((comps || []).map((c: any) => c.component_id))] as string[];
    const varIds = (comps || []).filter((c: any) => c.variant_id).map((c: any) => c.variant_id) as string[];

    const [{ data: components }, { data: variants }] = await Promise.all([
      compIds.length > 0
        ? supabase.from("collection_components").select("id, name, image_url").in("id", compIds)
        : Promise.resolve({ data: [] }),
      varIds.length > 0
        ? supabase.from("collection_component_variants").select("id, variant_name, image_url").in("id", varIds)
        : Promise.resolve({ data: [] }),
    ]);

    const compMap = new Map((components || []).map((c: any) => [c.id, c]));
    const varMap = new Map((variants || []).map((v: any) => [v.id, v]));

    const result: DeckBeyblade[] = beys.map((b: any) => {
      const beyComps = (comps || [])
        .filter((c: any) => c.deck_beyblade_id === b.id)
        .map((c: any) => {
          const comp = compMap.get(c.component_id);
          const variant = c.variant_id ? varMap.get(c.variant_id) : null;
          return {
            component_type: c.component_type,
            component_name: comp?.name || "?",
            component_image: comp?.image_url || null,
            variant_name: variant?.variant_name || null,
            variant_image: variant?.image_url || null,
            component_id: c.component_id,
            variant_id: c.variant_id || null,
          };
        })
        .sort((a: any, b: any) => (COMPONENT_ORDER[a.component_type] ?? 5) - (COMPONENT_ORDER[b.component_type] ?? 5));
      return { ...b, components: beyComps };
    });

    setBeyblades(result);
    setLoaded(true);
  };

  const fetchLikes = async () => {
    const { count } = await (supabase as any)
      .from("deck_likes")
      .select("id", { count: "exact", head: true })
      .eq("deck_id", deck.id);
    setLikesCount(count || 0);

    if (user) {
      const { data } = await (supabase as any)
        .from("deck_likes")
        .select("id")
        .eq("deck_id", deck.id)
        .eq("user_id", user.id)
        .maybeSingle();
      setLiked(!!data);
    }
  };

  const toggleLike = async () => {
    if (!user) { toast.error("Accedi per mettere like"); return; }
    setLikeLoading(true);
    if (liked) {
      await (supabase as any).from("deck_likes").delete().eq("deck_id", deck.id).eq("user_id", user.id);
      setLiked(false);
      setLikesCount(p => Math.max(0, p - 1));
    } else {
      await (supabase as any).from("deck_likes").insert({ deck_id: deck.id, user_id: user.id });
      setLiked(true);
      setLikesCount(p => p + 1);
    }
    setLikeLoading(false);
  };

  const handleReport = async () => {
    if (!user) { toast.error("Accedi per segnalare"); return; }
    if (!reportReason.trim()) { toast.error("Inserisci una motivazione"); return; }
    setReportSending(true);
    // Check if already reported
    const { count } = await (supabase as any).from("deck_reports").select("id", { count: "exact", head: true }).eq("reporter_id", user.id).eq("deck_id", deck.id).neq("status", "dismissed");
    if ((count ?? 0) > 0) {
      toast.error("Hai già segnalato questo deck");
      setReportOpen(false);
      setReportReason("");
      setReportSending(false);
      return;
    }
    const { error } = await (supabase as any).from("deck_reports").insert({
      deck_id: deck.id,
      reporter_id: user.id,
      reason: reportReason.trim(),
    });
    if (error) {
      if (error.code === "23505") toast.error("Hai già segnalato questo deck");
      else toast.error("Errore nella segnalazione");
    } else {
      toast.success("Segnalazione inviata");
      setReportOpen(false);
      setReportReason("");
    }
    setReportSending(false);
  };

  const handleDelete = async () => {
    const { error } = await (supabase as any).from("decks").delete().eq("id", deck.id);
    if (error) {
      toast.error("Errore nell'eliminazione");
    } else {
      toast.success("Deck eliminato");
      onDeleted?.();
    }
  };

  const buildEditBeyblades = (): BeybladeConfig[] => {
    return beyblades.map(bey => {
      const components: Record<string, { component_id: string; component_name: string; component_image: string | null; variant_id: string | null; variant_name: string | null; variant_image: string | null } | null> = {};
      bey.components.forEach(c => {
        components[c.component_type] = {
          component_id: c.component_id,
          component_name: c.component_name,
          component_image: c.component_image,
          variant_id: c.variant_id,
          variant_name: c.variant_name,
          variant_image: c.variant_image,
        };
      });
      return {
        blade_type: bey.blade_type as any,
        ratchet_type: (bey.ratchet_type || "ratchet") as "ratchet" | "ribs",
        components,
      };
    });
  };

  const isOwner = user?.id === deck.user_id;
  const displayName = profile?.display_name || profile?.username || "Utente";

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className={compact ? "p-3" : "p-4"}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {!compact && profile && (
              <Link to={profile.username ? `/profilo/${profile.username}` : "#"}>
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="text-[9px] bg-secondary">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
            )}
            <div className="min-w-0">
              <h3 className="font-display text-sm truncate flex items-center gap-1.5">
                <Swords size={13} className="text-primary shrink-0" />
                {deck.name}
              </h3>
              {!compact && (
                <p className="text-[10px] text-muted-foreground">
                  {displayName} · {format(new Date(deck.created_at), "d MMM yyyy", { locale: it })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {isOwner && (
              <button
                onClick={() => setEditOpen(true)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <Pencil size={14} />
              </button>
            )}
            {(isOwner || isStaff) && onDeleted && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    title={isStaff && !isOwner ? "Elimina (staff)" : "Elimina"}
                    className={`p-1.5 rounded-lg transition-colors ${isStaff && !isOwner ? "text-amber-600 hover:bg-amber-500/10" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"}`}
                  >
                    {isStaff && !isOwner ? <ShieldAlert size={14} /> : <Trash2 size={14} />}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminare il deck "{deck.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {isStaff && !isOwner ? "Stai eliminando un deck di un altro utente come staff. " : ""}Questa azione è irreversibile.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Elimina
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {!isOwner && user && (
              <Dialog open={reportOpen} onOpenChange={setReportOpen}>
                <DialogTrigger asChild>
                  <button className="p-1.5 rounded-lg text-orange-500/70 hover:text-orange-500 hover:bg-orange-500/10 transition-colors" title="Segnala deck">
                     <Flag size={16} />
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Segnala Deck</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Textarea
                      value={reportReason}
                      onChange={e => setReportReason(e.target.value)}
                      placeholder="Descrivi il motivo della segnalazione..."
                      rows={3}
                    />
                    <Button onClick={handleReport} disabled={reportSending || !reportReason.trim()} className="w-full">
                      {reportSending ? "Invio..." : "Invia segnalazione"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {deck.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{deck.description}</p>
        )}

        {/* Beyblades - clickable to open detail */}
        {loaded ? (
          <div className={`grid grid-cols-3 gap-2 ${hideDetail ? "" : "cursor-pointer"}`} onClick={hideDetail ? undefined : () => setDetailOpen(true)}>
            {beyblades.map(bey => {
              const isCX = bey.blade_type === "CX" || bey.blade_type === "CX_INF";
              const imgSize = compact ? "w-7 h-7" : "w-11 h-11";
              const imgSizeCX = compact ? "w-6 h-6" : "w-9 h-9";
              const labelSize = compact ? "text-[6px] max-w-[32px]" : "text-[8px] max-w-[52px]";
              const labelSizeCX = compact ? "text-[6px] max-w-[28px]" : "text-[7px] max-w-[40px]";
              return (
                <div key={bey.id} className={`bg-secondary/30 rounded-xl ${compact ? "p-1.5 space-y-0.5" : "p-2 space-y-1.5"}`}>
                  <div className="text-center">
                    <span className={`font-bold text-primary uppercase tracking-wider ${compact ? "text-[7px]" : "text-[9px]"}`}>
                      {BLADE_TYPE_LABELS[bey.blade_type] || bey.blade_type}
                    </span>
                  </div>
                  {isCX ? (
                    <div className="flex flex-col items-center gap-0.5">
                      {Array.from({ length: Math.ceil(bey.components.length / 2) }, (_, rowIdx) => {
                        const pair = bey.components.slice(rowIdx * 2, rowIdx * 2 + 2);
                        return (
                          <div key={rowIdx} className="flex items-start justify-center gap-0.5">
                            {pair.map((comp, ci) => {
                              const img = comp.variant_image || comp.component_image;
                              return (
                                <div key={ci} className="flex flex-col items-center">
                                  {img ? (
                                    <img src={img} alt={comp.component_name} className={`${imgSizeCX} rounded-md object-contain bg-background border border-border`} />
                                  ) : (
                                    <div className={`${imgSizeCX} rounded-md bg-background border border-border flex items-center justify-center text-[7px] text-muted-foreground`}>
                                      {comp.component_name.slice(0, 3)}
                                    </div>
                                  )}
                                  {!compact && (
                                    <span className={`${labelSizeCX} text-muted-foreground text-center leading-tight mt-0.5 truncate`}>
                                      {comp.component_name}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={`flex flex-col items-center ${compact ? "gap-0.5" : "gap-1"}`}>
                      {bey.components.map((comp, ci) => {
                        const img = comp.variant_image || comp.component_image;
                        return (
                          <div key={ci} className="flex flex-col items-center">
                            {img ? (
                              <img src={img} alt={comp.component_name} className={`${imgSize} rounded-md object-contain bg-background border border-border`} />
                            ) : (
                              <div className={`${imgSize} rounded-md bg-background border border-border flex items-center justify-center text-[8px] text-muted-foreground`}>
                                {comp.component_name.slice(0, 3)}
                              </div>
                            )}
                            {!compact && (
                              <span className={`${labelSize} text-muted-foreground text-center leading-tight mt-0.5 truncate`}>
                                {comp.component_name}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-16 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">Caricamento...</span>
          </div>
        )}

        {/* Like button */}
        {!compact && (
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
            <button
              onClick={toggleLike}
              disabled={likeLoading}
              className={`flex items-center gap-1.5 text-xs transition-colors ${
                liked ? "text-red-500" : "text-muted-foreground hover:text-red-500"
              }`}
            >
              <Heart size={14} fill={liked ? "currentColor" : "none"} />
              {likesCount > 0 && <span>{likesCount}</span>}
            </button>
          </div>
        )}

        {/* Detail Popup */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Swords size={18} className="text-primary" />
                {deck.name}
              </DialogTitle>
            </DialogHeader>
            {profile && (
              <div className="flex items-center gap-2 mb-2">
                <Link to={profile.username ? `/profilo/${profile.username}` : "#"} onClick={() => setDetailOpen(false)}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-secondary">
                      {displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div>
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(deck.created_at), "d MMMM yyyy", { locale: it })}
                  </p>
                </div>
              </div>
            )}
            {deck.description && (
              <p className="text-sm text-muted-foreground mb-4">{deck.description}</p>
            )}
            <div className="grid grid-cols-3 gap-4">
              {beyblades.map(bey => {
                const isCX = bey.blade_type === "CX" || bey.blade_type === "CX_INF";
                return (
                  <div key={bey.id} className="bg-secondary/30 rounded-xl p-4 space-y-3">
                    <div className="text-center">
                      <span className="text-sm font-bold text-primary uppercase tracking-wider">
                        {BLADE_TYPE_LABELS[bey.blade_type] || bey.blade_type}
                      </span>
                      {bey.ratchet_type === "ribs" && (
                        <span className="ml-1 text-[9px] text-muted-foreground">(Ribs)</span>
                      )}
                    </div>
                    {isCX ? (
                      <div className="flex flex-col items-center gap-2.5">
                        {Array.from({ length: Math.ceil(bey.components.length / 2) }, (_, rowIdx) => {
                          const pair = bey.components.slice(rowIdx * 2, rowIdx * 2 + 2);
                          return (
                            <div key={rowIdx} className="flex items-start justify-center gap-3">
                              {pair.map((comp, ci) => {
                                const img = comp.variant_image || comp.component_image;
                                return (
                                  <div key={ci} className="flex flex-col items-center">
                                    {img ? (
                                      <img src={img} alt={comp.component_name} className="w-16 h-16 rounded-lg object-contain bg-background border border-border" />
                                    ) : (
                                      <div className="w-16 h-16 rounded-lg bg-background border border-border flex items-center justify-center text-xs text-muted-foreground">
                                        {comp.component_name.slice(0, 3)}
                                      </div>
                                    )}
                                    <span className="text-[9px] text-muted-foreground text-center leading-tight mt-1 max-w-[70px]">
                                      {comp.variant_name || comp.component_name}
                                    </span>
                                    <span className="text-[8px] text-primary/60 uppercase">{comp.component_type.replace('_', ' ')}</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2.5">
                        {bey.components.map((comp, ci) => {
                          const img = comp.variant_image || comp.component_image;
                          return (
                            <div key={ci} className="flex flex-col items-center">
                              {img ? (
                                <img src={img} alt={comp.component_name} className="w-20 h-20 rounded-lg object-contain bg-background border border-border" />
                              ) : (
                                <div className="w-20 h-20 rounded-lg bg-background border border-border flex items-center justify-center text-sm text-muted-foreground">
                                  {comp.component_name.slice(0, 3)}
                                </div>
                              )}
                              <span className="text-[10px] text-muted-foreground text-center leading-tight mt-1 max-w-[80px]">
                                {comp.variant_name || comp.component_name}
                              </span>
                              <span className="text-[8px] text-primary/60 uppercase">{comp.component_type.replace('_', ' ')}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
              <button
                onClick={toggleLike}
                disabled={likeLoading}
                className={`flex items-center gap-1.5 text-sm transition-colors ${
                  liked ? "text-red-500" : "text-muted-foreground hover:text-red-500"
                }`}
              >
                <Heart size={16} fill={liked ? "currentColor" : "none"} />
                {likesCount > 0 && <span>{likesCount}</span>}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Full Edit Dialog */}
        {isOwner && (
          <DeckCreatorDialog
            onCreated={() => {
              fetchBeyblades();
              onDeleted?.();
            }}
            editDeck={{ id: deck.id, name: deck.name, description: deck.description }}
            editBeyblades={buildEditBeyblades()}
            externalOpen={editOpen}
            onExternalOpenChange={setEditOpen}
          />
        )}
      </CardContent>
    </Card>
  );
};
