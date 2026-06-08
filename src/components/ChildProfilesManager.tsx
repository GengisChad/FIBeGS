import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/imageCompression";
import { validateNoProfanity } from "@/lib/profanityFilter";
import { useAuth } from "@/hooks/useAuth";
import { useParentRole, ChildProfile } from "@/hooks/useParentRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CityCombobox } from "@/components/CityCombobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, Plus, Pencil, Trash2, Trophy, Medal, Camera, UserPlus, Eye, EyeOff, Link2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ChildLinkedAccountsDialog from "@/components/ChildLinkedAccountsDialog";

export const ChildProfilesManager = () => {
  const { user } = useAuth();
  const { isParent, children, loading, refetch } = useParentRole();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<ChildProfile | null>(null);
  const [form, setForm] = useState({ display_name: "", city: "" });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [parentProfile, setParentProfile] = useState<{ city: string | null; region_id: string | null }>({ city: null, region_id: null });
  const [uploadingAvatar, setUploadingAvatar] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarTargetId, setAvatarTargetId] = useState<string | null>(null);

  // Conversion dialog state
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertingChild, setConvertingChild] = useState<ChildProfile | null>(null);
  const [convertForm, setConvertForm] = useState({ email: "", username: "", password: "", confirmPassword: "" });
  const [convertErrors, setConvertErrors] = useState<Record<string, string>>({});
  const [converting, setConverting] = useState(false);
  const [showConvertPassword, setShowConvertPassword] = useState(false);

  // External account linking dialog state
  const [linkDialogChild, setLinkDialogChild] = useState<ChildProfile | null>(null);

  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("profiles")
      .select("city, region_id")
      .eq("user_id", user.id)
      .single()
      .then(({ data }: any) => {
        if (data) setParentProfile({ city: data.city, region_id: data.region_id });
      });
  }, [user]);

  if (!isParent || loading) return null;

  const openAdd = () => {
    setEditingChild(null);
    setForm({ display_name: "", city: parentProfile.city || "" });
    setDialogOpen(true);
  };

  const openEdit = (child: ChildProfile) => {
    setEditingChild(child);
    setForm({ display_name: child.display_name, city: child.city || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.display_name.trim()) {
      toast.error("Il nome è obbligatorio");
      return;
    }
    const profanityError = validateNoProfanity(form.display_name, form.city);
    if (profanityError) { toast.error(profanityError); return; }
    setSaving(true);

    if (editingChild) {
      const { error } = await (supabase as any)
        .from("child_profiles")
        .update({
          display_name: form.display_name.trim(),
          city: form.city || null,
        })
        .eq("id", editingChild.id);
      if (error) {
        console.error("Child profile update error:", error);
        toast.error("Errore nel salvataggio: " + error.message);
      } else {
        toast.success("Profilo figlio aggiornato!");
      }
    } else {
      if (children.length >= 5) {
        toast.error("Puoi gestire al massimo 5 profili figlio");
        setSaving(false);
        return;
      }
      const { error } = await (supabase as any)
        .from("child_profiles")
        .insert({
          parent_user_id: user.id,
          display_name: form.display_name.trim(),
          city: form.city || null,
          region_id: parentProfile.region_id || null,
        });
      if (error) {
        console.error("Child profile creation error:", error);
        toast.error("Errore nella creazione: " + error.message);
      } else {
        toast.success("Profilo figlio creato!");
      }
    }

    setSaving(false);
    setDialogOpen(false);
    refetch();
  };

  const handleDelete = async (childId: string) => {
    if (confirmDeleteId !== childId) {
      setConfirmDeleteId(childId);
      return;
    }
    await (supabase as any)
      .from("tournament_registrations")
      .delete()
      .eq("child_profile_id", childId);

    const { error } = await (supabase as any)
      .from("child_profiles")
      .delete()
      .eq("id", childId);
    if (error) {
      toast.error("Errore nell'eliminazione");
    } else {
      toast.success("Profilo figlio eliminato");
    }
    setConfirmDeleteId(null);
    refetch();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file || !avatarTargetId || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("Seleziona un file immagine"); return; }

    setUploadingAvatar(avatarTargetId);
    try { file = await prepareImageForUpload(file, { maxDimension: 512 }); }
    catch (err: any) { toast.error(err?.message || "Immagine non valida"); setUploadingAvatar(null); return; }
    const ext = file.name.split(".").pop();
    const path = `${user.id}/child-${avatarTargetId}_${Date.now()}.${ext}`;
    const { data: oldFiles } = await supabase.storage.from("avatars").list(user.id);
    if (oldFiles?.length) {
      const toRemove = oldFiles.filter(f => f.name.startsWith(`child-${avatarTargetId}`)).map(f => `${user.id}/${f.name}`);
      if (toRemove.length) await supabase.storage.from("avatars").remove(toRemove);
    }
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
    if (uploadError) { toast.error("Errore nel caricamento"); setUploadingAvatar(null); return; }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: updateError } = await (supabase as any)
      .from("child_profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", avatarTargetId);

    if (updateError) {
      toast.error("Errore nell'aggiornamento");
    } else {
      toast.success("Foto profilo aggiornata!");
      refetch();
    }
    setUploadingAvatar(null);
    setAvatarTargetId(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const triggerAvatarUpload = (childId: string) => {
    setAvatarTargetId(childId);
    setTimeout(() => avatarInputRef.current?.click(), 50);
  };

  // --- Conversion logic ---
  const openConvertDialog = (child: ChildProfile) => {
    setConvertingChild(child);
    setConvertForm({ email: "", username: child.display_name.replace(/\s+/g, '_').toLowerCase(), password: "", confirmPassword: "" });
    setConvertErrors({});
    setConvertDialogOpen(true);
  };

  const validateConvertForm = () => {
    const errors: Record<string, string> = {};
    if (!convertForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(convertForm.email)) {
      errors.email = "Email non valida";
    }
    if (convertForm.username.length < 3) {
      errors.username = "Username deve avere almeno 3 caratteri";
    }
    if (!/^[a-zA-Z0-9_]+$/.test(convertForm.username)) {
      errors.username = "Solo lettere, numeri e underscore";
    }
    if (convertForm.password.length < 6) {
      errors.password = "Password deve avere almeno 6 caratteri";
    }
    if (convertForm.password !== convertForm.confirmPassword) {
      errors.confirmPassword = "Le password non corrispondono";
    }
    setConvertErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConvert = async () => {
    if (!convertingChild || !validateConvertForm()) return;
    setConverting(true);

    try {
      // Check username availability first
      const { data: usernameCheck } = await supabase.rpc("check_username_available" as any, { _username: convertForm.username });
      if (usernameCheck && !(usernameCheck as any).available && (usernameCheck as any).reason !== 'child_profile') {
        setConvertErrors({ username: "Username già in uso" });
        setConverting(false);
        return;
      }

      const { data: result, error } = await supabase.rpc("convert_child_to_account" as any, {
        _child_id: convertingChild.id,
        _email: convertForm.email.trim(),
        _username: convertForm.username.trim(),
        _password: convertForm.password,
      });

      if (error) {
        toast.error("Errore nella conversione: " + error.message);
        setConverting(false);
        return;
      }

      const res = result as any;
      if (res?.error) {
        const errorMessages: Record<string, string> = {
          child_not_found: "Profilo figlio non trovato",
          username_taken: "Username già in uso",
          email_taken: "Email già registrata",
        };
        toast.error(errorMessages[res.error] || "Errore sconosciuto");
        if (res.error === 'username_taken') setConvertErrors({ username: "Username già in uso" });
        if (res.error === 'email_taken') setConvertErrors({ email: "Email già registrata" });
      } else {
        toast.success(`Account creato con successo per ${convertingChild.display_name}! Può accedere con le credenziali fornite.`);
        setConvertDialogOpen(false);
        refetch();
      }
    } catch (err: any) {
      toast.error("Errore: " + (err?.message || "Sconosciuto"));
    }

    setConverting(false);
  };

  return (
    <>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarUpload}
      />
      <Card className="bg-card border-border mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <Users size={20} className="text-primary" />
              Profili Figli
            </CardTitle>
            {children.length < 5 && (
              <Button size="sm" onClick={openAdd} className="gap-1">
                <Plus size={14} /> Aggiungi
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Gestisci i profili dei tuoi figli (max 5). Potrai iscriverli ai tornei dal tuo account.
          </p>
        </CardHeader>
        <CardContent>
          {children.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nessun profilo figlio ancora creato.</p>
          ) : (
            <div className="space-y-3">
              {children.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border"
                >
                  <button
                    className="relative group"
                    onClick={() => triggerAvatarUpload(child.id)}
                    disabled={uploadingAvatar === child.id}
                  >
                    <Avatar className="h-10 w-10">
                      {child.avatar_url ? (
                        <AvatarImage src={child.avatar_url} />
                      ) : null}
                      <AvatarFallback className="bg-primary/20 text-primary font-bold">
                        {child.display_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera size={14} className="text-white" />
                    </div>
                    {uploadingAvatar === child.id && (
                      <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{child.display_name}</p>
                    {child.city && (
                      <p className="text-xs text-muted-foreground">{child.city}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Trophy size={14} className="text-primary" /> {child.points}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Medal size={14} className="text-primary" /> {child.wins}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Collega Challonge / Challengermode" onClick={() => setLinkDialogChild(child)}>
                      <Link2 size={14} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Converti in account" onClick={() => openConvertDialog(child)}>
                      <UserPlus size={14} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(child)}>
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant={confirmDeleteId === child.id ? "destructive" : "ghost"}
                      className="h-8 w-8"
                      onClick={() => handleDelete(child.id)}
                      onBlur={() => setTimeout(() => setConfirmDeleteId(null), 200)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Add dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingChild ? "Modifica Profilo Figlio" : "Nuovo Profilo Figlio"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="Nome del figlio"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Città</Label>
              <CityCombobox
                value={form.city}
                onChange={(c) => setForm({ ...form, city: c })}
                placeholder="Cerca comune..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvataggio..." : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert child to account dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus size={18} className="text-primary" />
              Converti in Account
            </DialogTitle>
            <DialogDescription>
              Crea un account autonomo per <strong>{convertingChild?.display_name}</strong>. 
              Tutti i dati dei tornei e le statistiche verranno trasferiti al nuovo account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="conv-email">Email *</Label>
              <Input
                id="conv-email"
                type="email"
                placeholder="email@esempio.it"
                value={convertForm.email}
                onChange={(e) => setConvertForm({ ...convertForm, email: e.target.value })}
                className="bg-secondary border-border"
              />
              {convertErrors.email && <p className="text-destructive text-sm">{convertErrors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="conv-username">Username *</Label>
              <Input
                id="conv-username"
                type="text"
                placeholder="username"
                value={convertForm.username}
                onChange={(e) => setConvertForm({ ...convertForm, username: e.target.value })}
                className="bg-secondary border-border"
              />
              {convertErrors.username && <p className="text-destructive text-sm">{convertErrors.username}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="conv-password">Password *</Label>
              <div className="relative">
                <Input
                  id="conv-password"
                  type={showConvertPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={convertForm.password}
                  onChange={(e) => setConvertForm({ ...convertForm, password: e.target.value })}
                  className="bg-secondary border-border pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConvertPassword(!showConvertPassword)}
                >
                  {showConvertPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {convertErrors.password && <p className="text-destructive text-sm">{convertErrors.password}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="conv-confirm">Ripeti Password *</Label>
              <Input
                id="conv-confirm"
                type={showConvertPassword ? "text" : "password"}
                placeholder="••••••••"
                value={convertForm.confirmPassword}
                onChange={(e) => setConvertForm({ ...convertForm, confirmPassword: e.target.value })}
                className="bg-secondary border-border"
              />
              {convertErrors.confirmPassword && <p className="text-destructive text-sm">{convertErrors.confirmPassword}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleConvert} disabled={converting}>
              {converting ? "Conversione..." : "Crea Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChildLinkedAccountsDialog
        open={!!linkDialogChild}
        onOpenChange={(v) => { if (!v) setLinkDialogChild(null); }}
        childId={linkDialogChild?.id ?? null}
        childName={linkDialogChild?.display_name ?? ""}
      />
    </>
  );
};
