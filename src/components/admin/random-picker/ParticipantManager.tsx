import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Trash2, X, Search, Shuffle, Users } from "lucide-react";
import { Participant, BeybladeType, TYPE_COLORS } from "./types";
import { SpriteAsset } from "./AssetManager";

interface Props {
  participants: Participant[];
  setParticipants: (p: Participant[]) => void;
  sprites: SpriteAsset[];
}

interface ProfileResult {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export default function ParticipantManager({ participants, setParticipants, sprites }: Props) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProfileResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [freeName, setFreeName] = useState("");
  const [defaultType, setDefaultType] = useState<BeybladeType>("attack");

  useEffect(() => {
    if (search.length < 2) {
      setResults([]);
      return;
    }
    let cancel = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .or(`username.ilike.%${search}%,display_name.ilike.%${search}%`)
        .limit(15);
      if (!cancel) {
        setResults(data || []);
        setLoading(false);
      }
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [search]);

  const addProfile = (p: ProfileResult) => {
    if (participants.some((x) => x.userId === p.user_id)) return;
    if (participants.length >= 128) return;
    setParticipants([
      ...participants,
      {
        id: `u-${p.user_id}`,
        name: p.display_name || p.username || "Sconosciuto",
        userId: p.user_id,
        avatarUrl: p.avatar_url || undefined,
        type: defaultType,
      },
    ]);
    setSearch("");
    setPopoverOpen(false);
  };

  const addFree = () => {
    if (!freeName.trim()) return;
    if (participants.length >= 128) return;
    setParticipants([
      ...participants,
      {
        id: `free-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: freeName.trim(),
        type: defaultType,
      },
    ]);
    setFreeName("");
  };

  const remove = (id: string) => setParticipants(participants.filter((p) => p.id !== id));

  const updateType = (id: string, type: BeybladeType) => {
    setParticipants(participants.map((p) => (p.id === id ? { ...p, type } : p)));
  };

  const randomizeTypes = () => {
    const types: BeybladeType[] = ["attack", "defense", "stamina"];
    setParticipants(
      participants.map((p) => ({ ...p, type: types[Math.floor(Math.random() * 3)] }))
    );
  };

  const counts = useMemo(() => {
    const c = { attack: 0, defense: 0, stamina: 0 };
    for (const p of participants) c[p.type]++;
    return c;
  }, [participants]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users size={14} className="text-muted-foreground" /> Bladers
          </span>
          <Badge variant="outline" className="text-[10px] font-mono">
            {participants.length}/128
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats counters */}
        <div className="grid grid-cols-3 gap-1.5">
          {(["attack", "defense", "stamina"] as BeybladeType[]).map((t) => (
            <div
              key={t}
              className="rounded-md border bg-muted/30 p-1.5 text-center"
              style={{ borderLeftColor: TYPE_COLORS[t], borderLeftWidth: 2 }}
            >
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                {t === "attack" ? "ATK" : t === "defense" ? "DEF" : "STA"}
              </p>
              <p className="text-sm font-bold">{counts[t]}</p>
            </div>
          ))}
        </div>

        {/* Quick actions row */}
        <div className="grid grid-cols-2 gap-2">
          <Select value={defaultType} onValueChange={(v) => setDefaultType(v as BeybladeType)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="attack">Attacco</SelectItem>
              <SelectItem value="defense">Difesa</SelectItem>
              <SelectItem value="stamina">Durata</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={randomizeTypes}
            disabled={!participants.length}
            className="h-8 text-xs"
          >
            <Shuffle size={11} className="mr-1.5" /> Random
          </Button>
        </div>

        {/* Search user */}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8">
              <Search size={12} className="mr-2" />
              {search || "Cerca utente..."}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[300px]" align="start">
            <Command shouldFilter={false}>
              <CommandInput placeholder="Cerca..." value={search} onValueChange={setSearch} />
              <CommandList>
                {loading && <div className="p-2 text-xs text-muted-foreground">Cerco...</div>}
                <CommandEmpty>Nessun risultato</CommandEmpty>
                <CommandGroup>
                  {results.map((r) => (
                    <CommandItem key={r.user_id} onSelect={() => addProfile(r)}>
                      <div className="flex items-center gap-2">
                        {r.avatar_url && (
                          <img src={r.avatar_url} className="h-6 w-6 rounded-full" alt="" />
                        )}
                        <div>
                          <p className="text-xs">{r.display_name || r.username}</p>
                          <p className="text-[10px] text-muted-foreground">@{r.username}</p>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Free name */}
        <div className="flex gap-1.5">
          <Input
            value={freeName}
            onChange={(e) => setFreeName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addFree()}
            placeholder="Nome libero..."
            className="h-8 text-xs"
          />
          <Button size="sm" onClick={addFree} disabled={!freeName.trim()} className="h-8 px-3">
            <Plus size={14} />
          </Button>
        </div>

        {/* List */}
        <div className="max-h-[260px] overflow-y-auto -mx-1 px-1 space-y-1 border-t pt-2">
          {participants.length === 0 ? (
            <p className="text-center text-[11px] text-muted-foreground py-6">
              Nessun blader
            </p>
          ) : (
            participants.map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center gap-1.5 text-xs p-1.5 rounded-md hover:bg-muted/50 transition-colors group"
              >
                <span className="text-[9px] font-mono text-muted-foreground w-4 text-right">
                  {idx + 1}
                </span>
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} className="h-6 w-6 rounded-full" alt="" />
                ) : (
                  <div
                    className="h-6 w-6 rounded-full"
                    style={{ background: TYPE_COLORS[p.type] }}
                  />
                )}
                <span className="flex-1 truncate">{p.name}</span>
                <Select value={p.type} onValueChange={(v) => updateType(p.id, v as BeybladeType)}>
                  <SelectTrigger className="h-6 w-[58px] text-[10px] px-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attack">ATK</SelectItem>
                    <SelectItem value="defense">DEF</SelectItem>
                    <SelectItem value="stamina">STA</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive"
                  onClick={() => remove(p.id)}
                >
                  <X size={12} />
                </Button>
              </div>
            ))
          )}
        </div>

        {participants.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-[11px] text-muted-foreground hover:text-destructive"
            onClick={() => setParticipants([])}
          >
            <Trash2 size={11} className="mr-1.5" /> Svuota lista
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
