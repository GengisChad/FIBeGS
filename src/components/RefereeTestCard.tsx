import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/imageCompression";
import { useAdmin } from "@/hooks/useAdmin";
import { useRefereeTestStatus } from "@/hooks/useRefereeTestStatus";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle, Clock, ExternalLink, Pencil, Upload, Crown, Lock, Users, Award } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { AdminEditableText } from "@/components/admin/AdminEditableText";

interface Settings {
  id: string;
  test_type: string;
  image_url: string | null;
  description: string;
  button1_text: string;
  button1_url: string;
  button2_text: string;
  button2_url: string;
}

type Variant = "club_leader" | "judge"; // "judge" auto-swaps to head_judge once passed

interface TestHubCardProps {
  variant: Variant;
}

const VARIANTS: Record<string, {
  label: string;
  badge: string;
  Icon: any;
  accent: string;
  route: string;
  fallbackTitle: string;
}> = {
  club_leader: {
    label: "Club Leader",
    badge: "Leadership",
    Icon: Users,
    accent: "from-blue-500/15 via-blue-500/5",
    route: "/test-club-leader",
    fallbackTitle: "Diventa Club Leader FIBeGS",
  },
  referee: {
    label: "Judge",
    badge: "Arbitraggio",
    Icon: Shield,
    accent: "from-primary/15 via-primary/5",
    route: "/test-arbitri",
    fallbackTitle: "Diventa Judge FIBeGS",
  },
  head_judge: {
    label: "Head Judge",
    badge: "Top Tier",
    Icon: Crown,
    accent: "from-amber-500/15 via-amber-500/5",
    route: "/test-head-judge",
    fallbackTitle: "Diventa Head Judge FIBeGS",
  },
};

const bucketPath = (tt: string) => `settings/card-image-${tt}`;

const TestHubCard = ({ variant }: TestHubCardProps) => {
  const { isAdmin } = useAdmin();
  // For variant "judge" we first read referee status; if passed, we switch to head_judge variant
  const refStatus = useRefereeTestStatus("referee");
  const activeType: string =
    variant === "judge" ? (refStatus.passed ? "head_judge" : "referee") : variant;

  const cfg = VARIANTS[activeType];
  const status = useRefereeTestStatus(activeType);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [coursesPassed, setCoursesPassed] = useState<boolean | null>(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("referee_test_settings")
        .select("id, test_type, image_url, description, button1_text, button1_url, button2_text, button2_url")
        .eq("test_type", activeType)
        .limit(1)
        .maybeSingle();
      if (data) setSettings(data as any);
      else setSettings(null);
    })();
  }, [activeType]);

  // Gate by category-specific course completion
  useEffect(() => {
    const category = activeType === "club_leader" ? "club_leader" : "judge";
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setCoursesPassed(true); return; }
      const { data } = await (supabase as any).rpc("judge_course_category_passed", { _user_id: user.id, _category: category });
      setCoursesPassed(data === true);
    })();
  }, [activeType]);

  useEffect(() => {
    if (!status.cooldownUntil) { setCountdown(""); return; }
    const update = () => {
      const diff = status.cooldownUntil!.getTime() - Date.now();
      if (diff <= 0) { setCountdown(""); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(`${d}g ${h}h ${m}m`);
    };
    update();
    const i = setInterval(update, 60000);
    return () => clearInterval(i);
  }, [status.cooldownUntil]);

  const handleSave = async () => {
    if (!editForm || !settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("referee_test_settings")
      .update({
        description: editForm.description,
        button1_text: editForm.button1_text,
        button1_url: editForm.button1_url,
        button2_text: editForm.button2_text,
        button2_url: editForm.button2_url,
      })
      .eq("id", settings.id);
    setSaving(false);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } else {
      setSettings({ ...settings, ...editForm });
      setEditing(false);
      toast({ title: "Salvato" });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file || !settings) return;
    setUploading(true);
    try { file = await prepareImageForUpload(file, { maxDimension: 1600 }); }
    catch (err: any) { toast({ title: err?.message || "Immagine non valida", variant: "destructive" }); setUploading(false); return; }
    const ext = file.name.split(".").pop();
    const path = `${bucketPath(activeType)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("referee-test").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      toast({ title: "Errore upload", description: upErr.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("referee-test").getPublicUrl(path);
    await supabase.from("referee_test_settings").update({ image_url: `${publicUrl}?v=${Date.now()}` }).eq("id", settings.id);
    setSettings({ ...settings, image_url: `${publicUrl}?v=${Date.now()}` });
    setUploading(false);
    toast({ title: "Immagine aggiornata" });
  };

  const renderDescription = (text: string) => {
    if (!text) return <p className="text-sm text-muted-foreground italic">Nessuna descrizione configurata.</p>;
    const lines = text.split("\n");
    const elements: JSX.Element[] = [];
    let listItems: string[] = [];
    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            {listItems.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        );
        listItems = [];
      }
    };
    lines.forEach((line, i) => {
      if (line.startsWith("- ") || line.startsWith("• ")) listItems.push(line.substring(2));
      else { flushList(); elements.push(<p key={`p-${i}`} className="text-sm text-muted-foreground">{line || "\u00A0"}</p>); }
    });
    flushList();
    return elements;
  };

  if (!settings && !isAdmin) return null;

  const Icon = cfg.Icon;

  // CTA logic
  const renderCTA = () => {
    if (!status.isLoggedIn) {
      return <Button asChild className="w-full gap-2"><Link to="/auth"><Lock size={16} />Accedi per iniziare</Link></Button>;
    }
    if (status.passed) {
      return (
        <Button disabled className="w-full gap-2 bg-green-600 hover:bg-green-600 text-white">
          <CheckCircle size={16} /> Abilitato {cfg.label}
        </Button>
      );
    }
    if (status.cooldownUntil) {
      return <Button disabled variant="destructive" className="w-full gap-2"><Clock size={16} />Riprova tra {countdown}</Button>;
    }
    if (coursesPassed === false) {
      return <Button disabled variant="outline" className="w-full gap-2"><Lock size={16} />Completa prima i corsi {activeType === "club_leader" ? "Club Leader" : "Judge"}</Button>;
    }
    // Unlocked + available: emphasize
    return (
      <Link to={cfg.route} className="block">
        <Button
          size="lg"
          className="w-full gap-2 h-12 text-base font-bold tracking-wide shadow-[0_0_24px_-4px_hsl(var(--primary)/0.6)] ring-1 ring-primary/40 animate-pulse hover:animate-none"
        >
          <Icon size={18} />Avvia Test {cfg.label}
        </Button>
      </Link>
    );
  };

  const unlocked = status.isLoggedIn && !status.passed && !status.cooldownUntil && coursesPassed !== false;

  return (
    <div className={`relative rounded-2xl overflow-hidden border bg-gradient-to-br ${cfg.accent} to-transparent transition-all ${unlocked ? "border-primary/60 shadow-[0_0_40px_-10px_hsl(var(--primary)/0.5)] ring-1 ring-primary/30" : "border-border shadow-[0_10px_40px_-20px_hsl(var(--primary)/0.3)]"}`}>
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-foreground/[0.03] blur-3xl pointer-events-none" />

      {isAdmin && settings && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 z-10"
          onClick={() => { setEditForm(settings); setEditing(true); }}
          title="Modifica card"
        >
          <Pencil size={14} />
        </Button>
      )}

      <div className="p-5 sm:p-6 flex flex-col h-full relative">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className={`shrink-0 w-12 h-12 rounded-xl border flex items-center justify-center ${unlocked ? "border-primary/50 bg-primary/10" : "border-border bg-background/60"}`}>
            <Icon size={22} className={unlocked ? "text-primary" : "text-foreground"} />
          </div>
          <div className="flex-1 min-w-0">
            <AdminEditableText
              settingKey={`test_card_badge_${activeType}`}
              defaultValue={cfg.badge}
              as="div"
              className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold"
            />
            <AdminEditableText
              settingKey={`test_card_title_${activeType}`}
              defaultValue={`Test ${cfg.label} FIBeGS`}
              as="h3"
              className="font-display text-xl sm:text-2xl leading-tight tracking-wide"
            />
          </div>
        </div>

        {/* Image */}
        <div className="relative w-full aspect-[16/9] sm:aspect-[5/3] rounded-xl overflow-hidden border border-border bg-background/40 mb-4">
          {settings?.image_url ? (
            <img src={settings.image_url} alt={cfg.label} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
              <Award size={28} className="opacity-30" />
            </div>
          )}
          {isAdmin && settings && (
            <label className="absolute bottom-2 right-2 cursor-pointer">
              <div className="bg-primary text-primary-foreground rounded-full p-2 hover:opacity-80 shadow-lg">
                <Upload size={12} />
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
            </label>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2 mb-4 flex-1">
          {renderDescription(settings?.description || "")}
        </div>

        {/* External links */}
        {(settings?.button1_text || settings?.button2_text) && (
          <div className="flex flex-wrap gap-2 mb-3">
            {settings.button1_text && settings.button1_url && (
              <a href={settings.button1_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5 h-8"><ExternalLink size={12} />{settings.button1_text}</Button>
              </a>
            )}
            {settings.button2_text && settings.button2_url && (
              <a href={settings.button2_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5 h-8"><ExternalLink size={12} />{settings.button2_text}</Button>
              </a>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="pt-2 border-t border-border/60 mt-auto">
          {renderCTA()}
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifica card "{cfg.label}"</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div>
                <Label>Descrizione (usa "- " per elenchi puntati)</Label>
                <Textarea rows={8} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Testo tasto 1</Label>
                  <Input value={editForm.button1_text} onChange={e => setEditForm({ ...editForm, button1_text: e.target.value })} />
                </div>
                <div>
                  <Label>URL tasto 1</Label>
                  <Input value={editForm.button1_url} onChange={e => setEditForm({ ...editForm, button1_url: e.target.value })} />
                </div>
                <div>
                  <Label>Testo tasto 2</Label>
                  <Input value={editForm.button2_text} onChange={e => setEditForm({ ...editForm, button2_text: e.target.value })} />
                </div>
                <div>
                  <Label>URL tasto 2</Label>
                  <Input value={editForm.button2_url} onChange={e => setEditForm({ ...editForm, button2_url: e.target.value })} />
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "Salvataggio..." : "Salva"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const RefereeTestCard = () => {
  return (
    <section className="py-12 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <AdminEditableText
              settingKey="tests_hub_eyebrow"
              defaultValue="CERTIFICAZIONI UFFICIALI"
              as="div"
              className="text-primary font-semibold uppercase tracking-[0.2em] text-xs mb-2"
            />
            <AdminEditableText
              settingKey="tests_hub_title"
              defaultValue="Diventa parte dello staff FIBeGS"
              as="h2"
              className="font-display text-3xl md:text-4xl font-bold leading-tight"
            />
            <AdminEditableText
              settingKey="tests_hub_subtitle"
              defaultValue="Scegli il tuo percorso: leader della tua community locale o ufficiale di gara durante i tornei."
              multiline
              as="p"
              className="text-sm text-muted-foreground mt-3 max-w-2xl mx-auto"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <TestHubCard variant="club_leader" />
            <TestHubCard variant="judge" />
          </div>
        </div>
      </div>
    </section>
  );
};
