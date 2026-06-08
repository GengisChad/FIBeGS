import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CityCombobox } from "@/components/CityCombobox";
import { supabase } from "@/integrations/supabase/client";
import { validateNoProfanity } from "@/lib/profanityFilter";
import { useAuth } from "@/hooks/useAuth";
import { useRegions } from "@/hooks/useCachedQuery";
import { toast } from "sonner";
import { z } from "zod";

const usernameSchema = z.string()
  .min(3, "Username deve avere almeno 3 caratteri")
  .max(30, "Username troppo lungo")
  .regex(/^[a-zA-Z0-9_]+$/, "Solo lettere, numeri e underscore");

export const ProfileCompletionDialog = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [regionId, setRegionId] = useState("");
  const [city, setCity] = useState("");
  const { data: regions = [] } = useRegions();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; region?: string }>({});

  useEffect(() => {
    if (!user) return;

    // Check sessionStorage to avoid re-querying on every navigation
    const cacheKey = `profile_complete_${user.id}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached === "true") return;

    const checkProfile = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, region_id, city")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile && (!profile.username || !profile.region_id)) {
        setOpen(true);
        if (profile.username) setUsername(profile.username);
        if (profile.region_id) setRegionId(profile.region_id);
        if (profile.city) setCity(profile.city);
      } else {
        sessionStorage.setItem(cacheKey, "true");
      }
    };

    checkProfile();
  }, [user]);


  const handleSave = async () => {
    const fieldErrors: typeof errors = {};

    try {
      usernameSchema.parse(username);
    } catch (e) {
      if (e instanceof z.ZodError) {
        fieldErrors.username = e.errors[0]?.message;
      }
    }

    if (!regionId) {
      fieldErrors.region = "Seleziona una regione";
    }

    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    const profanityError = validateNoProfanity(username, city);
    if (profanityError) {
      toast.error(profanityError);
      return;
    }

    setSaving(true);
    try {
      // Check username availability (handles ghost profiles from external imports)
      const { data: usernameCheck } = await supabase.rpc("check_username_available" as any, { _username: username });
      if (usernameCheck && !(usernameCheck as any).available) {
        setErrors({ username: "Username già in uso" });
        return;
      }

      // If a ghost profile holds this username, claim it (transfer tournament data)
      if (usernameCheck && (usernameCheck as any).is_ghost) {
        await supabase.rpc("claim_ghost_username" as any, { _real_user_id: user!.id, _username: username });
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          username,
          display_name: username,
          region_id: regionId,
          city: city || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user!.id);

      if (error) throw error;

      toast.success("Profilo completato!");
      sessionStorage.setItem(`profile_complete_${user!.id}`, "true");
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-xl">Completa il tuo profilo</DialogTitle>
          <DialogDescription>
            Per continuare, imposta il tuo username, la regione e la città.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Username *</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="il_tuo_username"
            />
            {errors.username && <p className="text-destructive text-sm">{errors.username}</p>}
          </div>

          <div className="space-y-2">
            <Label>Regione *</Label>
            <Select value={regionId} onValueChange={(val) => { setRegionId(val); setCity(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona la tua regione" />
              </SelectTrigger>
              <SelectContent>
                {regions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.region && <p className="text-destructive text-sm">{errors.region}</p>}
          </div>

          {regionId && (
            <div className="space-y-2">
              <Label>Città</Label>
              <CityCombobox
                value={city}
                onChange={(val) => setCity(val)}
                regionId={regionId}
                placeholder="Cerca il tuo comune..."
              />
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            variant="hero"
            className="w-full mt-4"
          >
            {saving ? "Salvataggio..." : "Salva e continua"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
