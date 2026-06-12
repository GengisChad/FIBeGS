import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { validateNoProfanity } from "@/lib/profanityFilter";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { Mail, Handshake, Building2, MessageSquare, Heart, Star, Crown, ChevronDown, Send, Pencil, Check, X, Plus, Trash2, Search, Calendar, Users, Shield, Globe, Briefcase, Scale, Megaphone, MapPin } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const iconMap: Record<string, React.ElementType> = {
  Mail, Handshake, Building2, MessageSquare, Heart, Star, Crown, Users, Shield, Globe, Briefcase, Scale, Megaphone,
};

const tierColors: Record<string, string> = {
  supporter: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  donor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  sponsor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  partner: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const tierLabels: Record<string, string> = {
  supporter: "Supporter",
  donor: "Donatore",
  sponsor: "Sponsor",
  partner: "Partner",
};

const STAFF_ROLE_OPTIONS = [
  { value: "founder", label: "Fondatore", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { value: "president", label: "Presidente", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { value: "vice_president", label: "Vice Presidente", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  { value: "national_coordinator", label: "Coordinatore Nazionale", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "regional_coordinator", label: "Referente Regionale", color: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  { value: "head_judge", label: "Capo Arbitro", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { value: "judge", label: "Arbitro", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { value: "social_manager", label: "Social Manager", color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  { value: "content_creator", label: "Content Creator", color: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30" },
  { value: "graphic_designer", label: "Graphic Designer", color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  { value: "developer", label: "Developer", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { value: "moderator", label: "Moderatore", color: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
  { value: "community_manager", label: "Community Manager", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  { value: "event_organizer", label: "Organizzatore Eventi", color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  { value: "partnerships", label: "Partnership Manager", color: "bg-lime-500/20 text-lime-400 border-lime-500/30" },
];

const staffRoleMap = Object.fromEntries(STAFF_ROLE_OPTIONS.map(r => [r.value, r]));

const DEFAULT_CONTACT_CATEGORIES = [
  {
    id: "partnership",
    name: "Partnership",
    description: "Collaborazioni con brand, creator, sponsor e partner commerciali.",
    email: "info@ibna.it",
    icon: "Handshake",
    sort_order: 1,
    is_active: true,
  },
  {
    id: "eventi",
    name: "Eventi",
    description: "Richieste per tornei, fiere, presenze, attività locali e nazionali.",
    email: "info@ibna.it",
    icon: "Megaphone",
    sort_order: 2,
    is_active: true,
  },
  {
    id: "copyright-claim",
    name: "Copyright Claim",
    description: "Segnalazioni relative a copyright, uso non autorizzato di contenuti e proprietà intellettuale.",
    email: "info@ibna.it",
    icon: "Scale",
    sort_order: 3,
    is_active: true,
  },
  {
    id: "club-community",
    name: "Club e Community",
    description: "Supporto per club, community locali, referenti territoriali e iniziative sul territorio.",
    email: "info@ibna.it",
    icon: "Users",
    sort_order: 4,
    is_active: true,
  },
  {
    id: "supporto-generale",
    name: "Supporto Generale",
    description: "Domande generiche, informazioni sul sito o richieste di assistenza.",
    email: "info@ibna.it",
    icon: "MessageSquare",
    sort_order: 5,
    is_active: true,
  },
  {
    id: "stampa-media",
    name: "Stampa e Media",
    description: "Contatti per interviste, articoli, collaborazioni editoriali e ufficio stampa.",
    email: "info@ibna.it",
    icon: "Briefcase",
    sort_order: 6,
    is_active: true,
  },
  {
    id: "altro",
    name: "Altro",
    description: "Per tutte le richieste che non rientrano nelle categorie precedenti.",
    email: "info@ibna.it",
    icon: "Mail",
    sort_order: 7,
    is_active: true,
  },
];

/* ─── Contact Form (unified) ─── */
const ContactForm = ({ categories }: { categories: any[] }) => {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const availableCategories = categories.length > 0 ? categories : DEFAULT_CONTACT_CATEGORIES;

  useEffect(() => {
    if (!selectedCategory && availableCategories.length > 0) {
      setSelectedCategory(availableCategories[0].id);
    }
  }, [availableCategories, selectedCategory]);

  const handleSend = async () => {
    if (!selectedCategory || !name.trim() || !email.trim() || !message.trim()) {
      toast({ title: "Compila tutti i campi", variant: "destructive" });
      return;
    }
    const profanityError = validateNoProfanity(name, message);
    if (profanityError) { toast({ title: profanityError, variant: "destructive" }); return; }

    setSending(true);
    const catObj = availableCategories.find(c => c.id === selectedCategory);
    const catName = catObj?.name || selectedCategory;

    const { error } = await supabase.from("contact_requests" as any).insert({
      category: catName,
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
    } as any);

    supabase.functions.invoke("send-contact-email", {
      body: { category: catName, name: name.trim(), email: email.trim(), message: message.trim() },
    }).catch(() => {});

    setSending(false);
    if (error) {
      toast({ title: "Errore nell'invio", variant: "destructive" });
    } else {
      toast({ title: "Messaggio inviato!", description: "Ti risponderemo al più presto." });
      setName("");
      setEmail("");
      setMessage("");
      setSelectedCategory(availableCategories[0]?.id ?? "");
    }
  };

  const selectedCat = availableCategories.find(c => c.id === selectedCategory);

  return (
    <Card className="bg-card/60 backdrop-blur border-border/50 p-6 lg:p-8">
      <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
        <Send size={20} className="text-primary" /> Inviaci un messaggio
      </h3>
      <div className="space-y-4">
        <div>
          <Label className="mb-1.5 block">Categoria</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {availableCategories.map((cat: any) => {
              const CatIcon = iconMap[cat.icon] || Mail;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left text-sm transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/50 bg-background/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  <CatIcon size={16} className="shrink-0" />
                  <span className="truncate">{cat.name}</span>
                </button>
              );
            })}
          </div>
          {selectedCat?.description && (
            <p className="text-xs text-muted-foreground mt-2">{selectedCat.description}</p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="mb-1.5 block">Il tuo nome</Label>
            <Input placeholder="Mario Rossi" value={name} onChange={(e) => setName(e.target.value)} className="bg-background/50" />
          </div>
          <div>
            <Label className="mb-1.5 block">La tua email</Label>
            <Input placeholder="mario@email.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-background/50" />
          </div>
        </div>

        <div>
          <Label className="mb-1.5 block">Messaggio</Label>
          <Textarea placeholder="Descrivi la tua richiesta..." value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="bg-background/50 resize-none" />
        </div>

        {!selectedCategory && name && email && message && (
          <p className="text-xs text-destructive text-center">Seleziona una categoria per poter inviare il messaggio</p>
        )}
        <Button onClick={handleSend} disabled={sending || !selectedCategory || !name.trim() || !email.trim() || !message.trim()} className="w-full gap-2" size="lg">
          <Send size={16} />
          {sending ? "Invio in corso..." : "Invia messaggio"}
        </Button>
      </div>
    </Card>
  );
};

/* ─── Social Links Card ─── */
const SocialLinksCard = () => {
  const socials = [
    { label: "Discord", href: "https://discord.com/invite/2VrhTduM95", icon: "💬", color: "hover:bg-indigo-500/10 hover:border-indigo-500/30" },
    { label: "Instagram", href: "https://www.instagram.com/ibnabeybladeit/", icon: "📸", color: "hover:bg-pink-500/10 hover:border-pink-500/30" },
    { label: "YouTube", href: "https://www.youtube.com/@ibnabeyblade", icon: "▶️", color: "hover:bg-red-500/10 hover:border-red-500/30" },
    { label: "Facebook", href: "https://www.facebook.com/groups/1578510069340499", icon: "👥", color: "hover:bg-blue-500/10 hover:border-blue-500/30" },
  ];

  return (
    <Card className="bg-card/60 backdrop-blur border-border/50 p-6 lg:p-8 h-fit">
      <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
        <Globe size={20} className="text-primary" /> Seguici
      </h3>
      <div className="space-y-3">
        {socials.map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 p-4 rounded-xl border border-border/50 transition-all ${s.color}`}
          >
            <span className="text-2xl">{s.icon}</span>
            <div>
              <p className="font-semibold text-foreground">{s.label}</p>
              <p className="text-xs text-muted-foreground">Unisciti alla community</p>
            </div>
          </a>
        ))}
      </div>

      <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
        <p className="text-sm font-medium text-foreground mb-1">📧 Email diretta</p>
        <a href="mailto:info@ibna.it" className="text-primary hover:underline text-sm">info@ibna.it</a>
      </div>
    </Card>
  );
};

/* ─── Staff Card ─── */
const StaffCard = ({ member }: { member: any }) => {
  const profile = member.profile;
  const displayName = profile?.display_name || profile?.username || "Staff";
  const avatarUrl = profile?.avatar_url;
  const club = member.club;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="flex flex-col items-center text-center p-5 rounded-2xl bg-card/40 border border-border/30 hover:border-primary/30 transition-all duration-300"
    >
      <Link to={profile?.username ? `/profilo/${profile.username}` : "#"} className="flex flex-col items-center group">
        <Avatar className="w-16 h-16 mb-2 ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
            {displayName?.[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">{displayName}</h4>
      </Link>

      {member.title && (
        <p className="text-xs text-muted-foreground mt-1 italic">{member.title}</p>
      )}

      <div className="flex flex-wrap gap-1 mt-2 justify-center">
        {(member.roles || []).map((role: string) => {
          const r = staffRoleMap[role];
          return r ? (
            <Badge key={role} variant="outline" className={`text-[10px] ${r.color}`}>
              {r.label}
            </Badge>
          ) : null;
        })}
      </div>

      {club && (
        <Link
          to={`/clubs/${club.id}`}
          className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
        >
          {club.logo_url && <img src={club.logo_url} alt={club.name} className="w-4 h-4 rounded-full object-cover" />}
          <span className="truncate max-w-[100px]">{club.name}</span>
        </Link>
      )}
    </motion.div>
  );
};

/* ─── Regional Referent Card (supporter-style) ─── */
const RegionalCard = ({ member }: { member: any }) => {
  const profile = member.profile;
  const displayName = profile?.display_name || profile?.username || "Referente";
  const avatarUrl = profile?.avatar_url;
  const club = member.club;
  const regionName = member.title || "Regione";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="flex flex-col items-center text-center p-5 rounded-2xl bg-card/40 border border-border/30 hover:border-sky-500/30 transition-all duration-300"
    >
      <Link to={profile?.username ? `/profilo/${profile.username}` : "#"} className="flex flex-col items-center group">
        <Avatar className="w-16 h-16 mb-2 ring-2 ring-sky-500/20 group-hover:ring-sky-500/50 transition-all">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-sky-500/10 text-sky-400 text-xl font-bold">
            {displayName?.[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h4 className="font-semibold text-foreground group-hover:text-sky-400 transition-colors text-sm">{displayName}</h4>
      </Link>

      <Badge variant="outline" className="mt-1 text-xs bg-sky-500/20 text-sky-400 border-sky-500/30">
        <MapPin size={10} className="mr-1" />
        {regionName}
      </Badge>

      {club && (
        <Link
          to={`/clubs/${club.id}`}
          className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
        >
          {club.logo_url && <img src={club.logo_url} alt={club.name} className="w-4 h-4 rounded-full object-cover" />}
          <span className="truncate max-w-[100px]">{club.name}</span>
        </Link>
      )}
    </motion.div>
  );
};

const SupporterCard = ({ supporter }: { supporter: any }) => {
  const tierClass = tierColors[supporter.tier] || tierColors.supporter;
  const profile = supporter.profile;
  const club = supporter.club;
  const displayName = profile?.display_name || profile?.username || supporter.display_name;
  const avatarUrl = profile?.avatar_url || supporter.avatar_url;
  const joinedDate = profile?.created_at ? format(new Date(profile.created_at), "MMM yyyy", { locale: it }) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="flex flex-col items-center text-center p-5 rounded-2xl bg-card/40 border border-border/30 hover:border-primary/30 transition-all duration-300"
    >
      <Link to={profile?.username ? `/profilo/${profile.username}` : "#"} className="flex flex-col items-center group">
        <Avatar className="w-16 h-16 mb-2 ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
            {displayName?.[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">{displayName}</h4>
      </Link>

      <Badge variant="outline" className={`mt-1 text-xs ${tierClass}`}>
        {tierLabels[supporter.tier] || supporter.tier}
      </Badge>

      {joinedDate && (
        <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
          <Calendar size={10} /> Iscritto da {joinedDate}
        </p>
      )}

      {club && (
        <Link
          to={`/clubs/${club.id}`}
          className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
        >
          {club.logo_url && <img src={club.logo_url} alt={club.name} className="w-4 h-4 rounded-full object-cover" />}
          <span className="truncate max-w-[100px]">{club.name}</span>
        </Link>
      )}

      {supporter.message && (
        <p className="text-xs text-muted-foreground mt-2 italic">"{supporter.message}"</p>
      )}
    </motion.div>
  );
};

/* ─── Supporter Carousel / Grid ─── */
const COLS_BY_BREAKPOINT = { base: 2, md: 3, lg: 4, xl: 5 };
const MAX_ROWS = 2;

const SupporterCarousel = ({ supporters, isAdmin, onEdit, onDelete }: { supporters: any[]; isAdmin: boolean; onEdit: (s: any) => void; onDelete: (id: string) => void }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [needsCarousel, setNeedsCarousel] = useState(false);
  const animRef = useRef<number>();
  const pausedRef = useRef(false);

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      let cols = COLS_BY_BREAKPOINT.base;
      if (w >= 1280) cols = COLS_BY_BREAKPOINT.xl;
      else if (w >= 1024) cols = COLS_BY_BREAKPOINT.lg;
      else if (w >= 768) cols = COLS_BY_BREAKPOINT.md;
      setNeedsCarousel(supporters.length > cols * MAX_ROWS);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [supporters.length]);

  useEffect(() => {
    if (!needsCarousel || !containerRef.current) return;
    const el = containerRef.current;
    let pos = 0;
    let lastTime = performance.now();
    const tick = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      if (!pausedRef.current) {
        const halfWidth = el.scrollWidth / 2;
        pos += (20 * dt) / 1000;
        if (halfWidth > 0 && pos >= halfWidth) pos -= halfWidth;
        el.scrollLeft = pos;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [needsCarousel, supporters]);

  const handleMouseEnter = () => { pausedRef.current = true; };
  const handleMouseLeave = () => { pausedRef.current = false; };

  const displayItems = needsCarousel ? [...supporters, ...supporters] : supporters;

  if (!needsCarousel) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-w-5xl mx-auto">
        {supporters.map((s: any) => (
          <div key={s.id} className="relative group/admin">
            <SupporterCard supporter={s} />
            {isAdmin && (
              <div className="absolute top-2 right-2 opacity-0 group-hover/admin:opacity-100 transition-opacity flex gap-1">
                <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => onEdit(s)}><Pencil size={12} /></Button>
                <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => onDelete(s.id)}><Trash2 size={12} /></Button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto overflow-hidden" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} onTouchStart={handleMouseEnter} onTouchEnd={handleMouseLeave}>
      <div ref={containerRef} className="flex gap-4 overflow-x-hidden" style={{ scrollbarWidth: "none" }}>
        {displayItems.map((s: any, i: number) => (
          <div key={`${s.id}-${i}`} className="relative group/admin shrink-0 w-[calc(50%-8px)] md:w-[calc(33.333%-11px)] lg:w-[calc(25%-12px)] xl:w-[calc(20%-13px)]">
            <SupporterCard supporter={s} />
            {isAdmin && i < supporters.length && (
              <div className="absolute top-2 right-2 opacity-0 group-hover/admin:opacity-100 transition-opacity flex gap-1">
                <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => onEdit(s)}><Pencil size={12} /></Button>
                <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => onDelete(s.id)}><Trash2 size={12} /></Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── History Timeline Entry ─── */
const formatYear = (year: number) => {
  if (year < 0) return `${Math.abs(year)} a.C.`;
  return String(year);
};

const HistoryEntry = ({ entry, index }: { entry: any; index: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const isLeft = index % 2 === 0;

  return (
    <div ref={ref} className="relative">
      <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:gap-0">
        <div className={`flex ${isLeft ? "justify-end pr-8" : ""}`}>
          {isLeft ? (
            <motion.div initial={{ opacity: 0, x: -40 }} animate={isInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, ease: "easeOut" }} className="group text-right max-w-md">
              <HistoryContent entry={entry} isLeft={true} />
            </motion.div>
          ) : null}
        </div>
        <div className="flex flex-col items-center">
          <div className="w-4 h-4 rounded-full bg-primary border-4 border-background z-10 shrink-0" />
          <div className="w-0.5 flex-1 bg-gradient-to-b from-primary/60 to-primary/10" />
        </div>
        <div className={`flex ${!isLeft ? "justify-start pl-8" : ""}`}>
          {!isLeft ? (
            <motion.div initial={{ opacity: 0, x: 40 }} animate={isInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.6, ease: "easeOut" }} className="group text-left max-w-md">
              <HistoryContent entry={entry} isLeft={false} />
            </motion.div>
          ) : null}
        </div>
      </div>
      <div className="md:hidden flex gap-4">
        <div className="flex flex-col items-center shrink-0">
          <div className="w-3 h-3 rounded-full bg-primary border-2 border-background z-10" />
          <div className="w-0.5 flex-1 bg-gradient-to-b from-primary/60 to-primary/10" />
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, ease: "easeOut" }} className="group flex-1 pb-8">
          <HistoryContent entry={entry} isLeft={false} />
        </motion.div>
      </div>
    </div>
  );
};

const HistoryContent = ({ entry, isLeft }: { entry: any; isLeft: boolean }) => (
  <>
    <div className={`inline-flex items-center gap-2 mb-2 ${isLeft ? "flex-row-reverse" : ""}`}>
      <span className="font-display text-3xl md:text-4xl text-primary tracking-wider">{formatYear(entry.year)}</span>
      {entry.month && <span className="text-xs text-muted-foreground uppercase tracking-widest">.{String(entry.month).padStart(2, "0")}</span>}
    </div>
    {entry.generation && <Badge variant="outline" className="mb-2 border-primary/30 text-primary text-xs">{entry.generation}</Badge>}
    <h3 className="font-semibold text-lg text-foreground mb-2 group-hover:text-primary transition-colors">{entry.title}</h3>
    {entry.description && <p className="text-sm text-muted-foreground leading-relaxed">{entry.description}</p>}
    {entry.image_url && (
      <div className="mt-4 overflow-hidden rounded-xl border border-border/30">
        <img src={entry.image_url} alt={entry.title} className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
      </div>
    )}
  </>
);

/* ─── Editable Text (admin only) ─── */
const FAQ_SETTING_KEYS = {
  hero: "faq_hero_subtitle",
  contatti: "faq_contatti_subtitle",
  supporters: "faq_supporters_subtitle",
  storia: "faq_storia_subtitle",
  staff: "faq_staff_subtitle",
};

const DEFAULTS: Record<string, string> = {
  faq_hero_subtitle: "Contattaci, scopri chi supporta il progetto e rivivi la storia di FIBeGS e del Beyblade.",
  faq_contatti_subtitle: "Scegli la categoria e inviaci un messaggio",
  faq_supporters_subtitle: "Grazie a chi rende possibile questo progetto",
  faq_storia_subtitle: "Il viaggio di FIBeGS e del Beyblade in Italia",
  faq_staff_subtitle: "Le persone che fanno funzionare la community",
};

const EditableText = ({ settingKey, settings, isAdmin, className = "" }: {
  settingKey: string; settings: Record<string, string>; isAdmin: boolean; className?: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const queryClient = useQueryClient();
  const text = settings[settingKey] || DEFAULTS[settingKey] || "";

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    await supabase.from("site_settings").upsert({ key: settingKey, value: trimmed }, { onConflict: "key" });
    queryClient.invalidateQueries({ queryKey: ["faq-settings"] });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 justify-center max-w-2xl mx-auto">
        <Input value={value} onChange={(e) => setValue(e.target.value)} className="text-center" autoFocus onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }} />
        <Button size="icon" variant="ghost" onClick={save}><Check size={16} /></Button>
        <Button size="icon" variant="ghost" onClick={() => setEditing(false)}><X size={16} /></Button>
      </div>
    );
  }

  return (
    <div className="group relative inline-block">
      <span className={className}>{text}</span>
      {isAdmin && (
        <button onClick={() => { setValue(text); setEditing(true); }} className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center text-primary" title="Modifica">
          <Pencil size={14} />
        </button>
      )}
    </div>
  );
};

/* ─── Admin Add Button ─── */
const AdminAddButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <Button size="sm" variant="outline" onClick={onClick} className="gap-1 border-dashed border-primary/40 text-primary hover:bg-primary/10">
    <Plus size={14} /> {label}
  </Button>
);

/* ─── Supporter Add/Edit Dialog with User Search ─── */
const SupporterAddDialog = ({ open, onOpenChange, editing, setEditing, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: any; setEditing: (fn: any) => void; onSave: () => void;
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!search.trim() || search.length < 2) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.from("profiles").select("user_id, display_name, username, avatar_url").or(`username.ilike.%${search}%,display_name.ilike.%${search}%`).limit(20);
      setResults(data ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const selectedProfile = editing?.profile;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing?.id ? "Modifica" : "Nuovo"} Supporter</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Utente</Label>
            {selectedProfile ? (
              <div className="flex items-center gap-3 mt-1 p-3 rounded-xl bg-muted/50 border border-border">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={selectedProfile.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary">{(selectedProfile.display_name || selectedProfile.username)?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{selectedProfile.display_name || selectedProfile.username}</p>
                </div>
                {!editing?.id && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing((p: any) => ({ ...p, user_id: null, display_name: "", avatar_url: "", profile: null }))}><X size={14} /></Button>}
              </div>
            ) : (
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2 mt-1 text-muted-foreground"><Search size={14} /> Cerca utente...</Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Cerca per username o nome..." value={search} onValueChange={setSearch} />
                    <CommandList>
                      {searching && <div className="p-3 text-sm text-muted-foreground text-center">Ricerca...</div>}
                      <CommandEmpty>{search.length < 2 ? "Digita almeno 2 caratteri" : "Nessun utente trovato"}</CommandEmpty>
                      {results.map((p) => (
                        <CommandItem key={p.user_id} value={p.user_id} onSelect={() => {
                          setEditing((prev: any) => ({ ...prev, user_id: p.user_id, display_name: p.display_name || p.username || "", avatar_url: p.avatar_url || "", profile: p }));
                          setSearchOpen(false); setSearch("");
                        }} className="flex items-center gap-2">
                          <Avatar className="w-7 h-7">
                            <AvatarImage src={p.avatar_url} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">{(p.display_name || p.username)?.[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium truncate">{p.display_name || p.username}</span>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={editing?.tier || "supporter"} onValueChange={v => setEditing((p: any) => ({ ...p, tier: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="supporter">Supporter</SelectItem>
                <SelectItem value="donor">Donatore</SelectItem>
                <SelectItem value="sponsor">Sponsor</SelectItem>
                <SelectItem value="partner">Partner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Messaggio (opzionale)</Label>
            <Input className="mt-1" value={editing?.message || ""} onChange={e => setEditing((p: any) => ({ ...p, message: e.target.value }))} placeholder="Un ringraziamento speciale..." />
          </div>
        </div>
        <DialogFooter><Button onClick={onSave} disabled={!editing?.user_id}>Salva</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ─── Staff Add/Edit Dialog ─── */
const StaffAddDialog = ({ open, onOpenChange, editing, setEditing, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: any; setEditing: (fn: any) => void; onSave: () => void;
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!search.trim() || search.length < 2) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.from("profiles").select("user_id, display_name, username, avatar_url").or(`username.ilike.%${search}%,display_name.ilike.%${search}%`).limit(20);
      setResults(data ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const selectedProfile = editing?.profile;
  const selectedRoles: string[] = editing?.roles || [];

  const toggleRole = (role: string) => {
    setEditing((p: any) => {
      const current = p.roles || [];
      return { ...p, roles: current.includes(role) ? current.filter((r: string) => r !== role) : [...current, role] };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing?.id ? "Modifica" : "Nuovo"} Membro Staff</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Utente</Label>
            {selectedProfile ? (
              <div className="flex items-center gap-3 mt-1 p-3 rounded-xl bg-muted/50 border border-border">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={selectedProfile.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary">{(selectedProfile.display_name || selectedProfile.username)?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{selectedProfile.display_name || selectedProfile.username}</p>
                </div>
                {!editing?.id && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing((p: any) => ({ ...p, user_id: null, profile: null }))}><X size={14} /></Button>}
              </div>
            ) : (
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2 mt-1 text-muted-foreground"><Search size={14} /> Cerca utente...</Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Cerca per username o nome..." value={search} onValueChange={setSearch} />
                    <CommandList>
                      {searching && <div className="p-3 text-sm text-muted-foreground text-center">Ricerca...</div>}
                      <CommandEmpty>{search.length < 2 ? "Digita almeno 2 caratteri" : "Nessun utente trovato"}</CommandEmpty>
                      {results.map((p) => (
                        <CommandItem key={p.user_id} value={p.user_id} onSelect={() => {
                          setEditing((prev: any) => ({ ...prev, user_id: p.user_id, profile: p }));
                          setSearchOpen(false); setSearch("");
                        }} className="flex items-center gap-2">
                          <Avatar className="w-7 h-7">
                            <AvatarImage src={p.avatar_url} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">{(p.display_name || p.username)?.[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium truncate">{p.display_name || p.username}</span>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div>
            <Label>Titolo personalizzato (opzionale)</Label>
            <Input className="mt-1" value={editing?.title || ""} onChange={e => setEditing((p: any) => ({ ...p, title: e.target.value }))} placeholder="Es. Co-fondatore, Responsabile Lombardia..." />
          </div>

          <div>
            <Label className="mb-2 block">Ruoli (multi-selezione)</Label>
            <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto">
              {STAFF_ROLE_OPTIONS.map((r) => {
                const isSelected = selectedRoles.includes(r.value);
                return (
                  <button
                    key={r.value}
                    onClick={() => toggleRole(r.value)}
                    className={`text-left text-xs px-3 py-2 rounded-lg border transition-all ${
                      isSelected ? `${r.color} border-current` : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                    }`}
                  >
                    {isSelected && <Check size={10} className="inline mr-1" />}
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={onSave} disabled={!editing?.user_id || !selectedRoles.length}>Salva</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ─── Regional Referent Add/Edit Dialog ─── */
const RegionalAddDialog = ({ open, onOpenChange, editing, setEditing, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: any; setEditing: (fn: any) => void; onSave: () => void;
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const { data: regions = [] } = useQuery({
    queryKey: ["regions-list"],
    queryFn: async () => {
      const { data } = await supabase.from("regions").select("id, name, code").order("name");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!search.trim() || search.length < 2) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.from("profiles").select("user_id, display_name, username, avatar_url").or(`username.ilike.%${search}%,display_name.ilike.%${search}%`).limit(20);
      setResults(data ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const selectedProfile = editing?.profile;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing?.id ? "Modifica" : "Nuovo"} Referente Regionale</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Utente</Label>
            {selectedProfile ? (
              <div className="flex items-center gap-3 mt-1 p-3 rounded-xl bg-muted/50 border border-border">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={selectedProfile.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary">{(selectedProfile.display_name || selectedProfile.username)?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{selectedProfile.display_name || selectedProfile.username}</p>
                </div>
                {!editing?.id && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing((p: any) => ({ ...p, user_id: null, profile: null }))}><X size={14} /></Button>}
              </div>
            ) : (
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2 mt-1 text-muted-foreground"><Search size={14} /> Cerca utente...</Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Cerca per username o nome..." value={search} onValueChange={setSearch} />
                    <CommandList>
                      {searching && <div className="p-3 text-sm text-muted-foreground text-center">Ricerca...</div>}
                      <CommandEmpty>{search.length < 2 ? "Digita almeno 2 caratteri" : "Nessun utente trovato"}</CommandEmpty>
                      {results.map((p) => (
                        <CommandItem key={p.user_id} value={p.user_id} onSelect={() => {
                          setEditing((prev: any) => ({ ...prev, user_id: p.user_id, profile: p }));
                          setSearchOpen(false); setSearch("");
                        }} className="flex items-center gap-2">
                          <Avatar className="w-7 h-7">
                            <AvatarImage src={p.avatar_url} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">{(p.display_name || p.username)?.[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium truncate">{p.display_name || p.username}</span>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div>
            <Label>Regione</Label>
            <Select value={editing?.title || ""} onValueChange={v => setEditing((p: any) => ({ ...p, title: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Seleziona regione..." /></SelectTrigger>
              <SelectContent>
                {regions.map((r: any) => (
                  <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button onClick={onSave} disabled={!editing?.user_id || !editing?.title}>Salva</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ─── Main FAQ Page ─── */
const Faq = () => {
  const { isAdmin } = useAdmin();
  const queryClient = useQueryClient();

  const [historyDialog, setHistoryDialog] = useState(false);
  const [historyEditing, setHistoryEditing] = useState<any>(null);
  const [supporterDialog, setSupporterDialog] = useState(false);
  const [supporterEditing, setSupporterEditing] = useState<any>(null);
  const [contactDialog, setContactDialog] = useState(false);
  const [contactEditing, setContactEditing] = useState<any>(null);
  const [staffDialog, setStaffDialog] = useState(false);
  const [staffEditing, setStaffEditing] = useState<any>(null);
  const [regionalDialog, setRegionalDialog] = useState(false);
  const [regionalEditing, setRegionalEditing] = useState<any>(null);

  const { data: faqSettings = {} } = useQuery({
    queryKey: ["faq-settings"],
    queryFn: async () => {
      const keys = Object.values(FAQ_SETTING_KEYS);
      const { data } = await supabase.from("site_settings").select("key, value").in("key", keys);
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => { map[r.key] = r.value; });
      return map;
    },
  });

  const { data: contactCategories = [] } = useQuery({
    queryKey: ["faq-contact-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("faq_contact_categories").select("*").order("sort_order");
      return data ?? [];
    },
  });

  const { data: supporters = [] } = useQuery({
    queryKey: ["faq-supporters"],
    queryFn: async () => {
      const { data: rawSups } = await supabase.from("faq_supporters_public" as any).select("*").order("sort_order");
      if (!rawSups?.length) return [];
      // Deduplica: stesso user_id o, in mancanza, stesso display_name (case-insensitive) appare una sola volta
      const seen = new Set<string>();
      const sups = (rawSups as any[]).filter((s) => {
        const key = s.user_id ? `u:${s.user_id}` : `n:${(s.display_name || "").trim().toLowerCase()}`;
        if (!key || key === "n:") return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const userIds = sups.filter((s: any) => s.user_id).map((s: any) => s.user_id);
      let profilesMap: Record<string, any> = {};
      let clubsMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, username, avatar_url, created_at").in("user_id", userIds);
        (profiles ?? []).forEach((p: any) => { profilesMap[p.user_id] = p; });
        const { data: members } = await supabase.from("club_members").select("user_id, club_id, clubs(id, name, logo_url)").in("user_id", userIds);
        (members ?? []).forEach((m: any) => { if (m.clubs) clubsMap[m.user_id] = m.clubs; });
      }
      return sups.map((s: any) => ({ ...s, profile: profilesMap[s.user_id] || null, club: clubsMap[s.user_id] || null }));
    },
  });

  const { data: staffMembers = [] } = useQuery({
    queryKey: ["faq-staff"],
    queryFn: async () => {
      const { data: staff } = await supabase.from("staff_members" as any).select("*").order("sort_order");
      if (!staff?.length) return [];
      const userIds = (staff as any[]).map((s: any) => s.user_id);
      let profilesMap: Record<string, any> = {};
      let clubsMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, username, avatar_url, created_at").in("user_id", userIds);
        (profiles ?? []).forEach((p: any) => { profilesMap[p.user_id] = p; });
        const { data: members } = await supabase.from("club_members").select("user_id, club_id, clubs(id, name, logo_url)").in("user_id", userIds);
        (members ?? []).forEach((m: any) => { if (m.clubs) clubsMap[m.user_id] = m.clubs; });
      }
      return (staff as any[]).map((s: any) => ({ ...s, profile: profilesMap[s.user_id] || null, club: clubsMap[s.user_id] || null }));
    },
  });

  const { data: historyEntries = [] } = useQuery({
    queryKey: ["faq-history"],
    queryFn: async () => {
      const { data } = await supabase.from("faq_history_entries").select("*").order("sort_order");
      return data ?? [];
    },
  });

  // Save handlers
  const saveHistory = async () => {
    if (!historyEditing?.title?.trim() || !historyEditing?.year) return;
    const { id, ...rest } = historyEditing;
    if (id) await supabase.from("faq_history_entries").update(rest).eq("id", id);
    else await supabase.from("faq_history_entries").insert(rest);
    setHistoryDialog(false); setHistoryEditing(null);
    queryClient.invalidateQueries({ queryKey: ["faq-history"] });
    toast({ title: "Salvato!" });
  };

  const deleteHistory = async (id: string) => {
    await supabase.from("faq_history_entries").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["faq-history"] });
  };

  const saveSupporter = async () => {
    if (!supporterEditing?.user_id) return;
    const { id, profile, club, ...rest } = supporterEditing;
    if (!rest.display_name?.trim() && profile) rest.display_name = profile.display_name || profile.username || "Utente";
    if (!rest.display_name?.trim()) rest.display_name = "Utente";
    if (!rest.avatar_url) rest.avatar_url = profile?.avatar_url || null;
    if (!rest.badge_id) rest.badge_id = null;
    if (id) await supabase.from("faq_supporters").update(rest).eq("id", id);
    else await supabase.from("faq_supporters").insert(rest);
    setSupporterDialog(false); setSupporterEditing(null);
    queryClient.invalidateQueries({ queryKey: ["faq-supporters"] });
    toast({ title: "Salvato!" });
  };

  const deleteSupporter = async (id: string) => {
    await supabase.from("faq_supporters").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["faq-supporters"] });
  };

  const saveContact = async () => {
    if (!contactEditing?.name?.trim()) return;
    const { id, ...rest } = contactEditing;
    if (id) await supabase.from("faq_contact_categories").update(rest).eq("id", id);
    else await supabase.from("faq_contact_categories").insert(rest);
    setContactDialog(false); setContactEditing(null);
    queryClient.invalidateQueries({ queryKey: ["faq-contact-categories"] });
    toast({ title: "Salvato!" });
  };

  const deleteContact = async (id: string) => {
    await supabase.from("faq_contact_categories").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["faq-contact-categories"] });
  };

  const saveStaff = async () => {
    if (!staffEditing?.user_id || !staffEditing?.roles?.length) return;
    const { id, profile, club, ...rest } = staffEditing;
    if (id) await supabase.from("staff_members" as any).update(rest as any).eq("id", id);
    else await supabase.from("staff_members" as any).insert(rest as any);
    setStaffDialog(false); setStaffEditing(null);
    queryClient.invalidateQueries({ queryKey: ["faq-staff"] });
    toast({ title: "Salvato!" });
  };

  const deleteStaff = async (id: string) => {
    await supabase.from("staff_members" as any).delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["faq-staff"] });
  };

  const saveRegional = async () => {
    if (!regionalEditing?.user_id || !regionalEditing?.title) return;
    const { id, profile, club, ...rest } = regionalEditing;
    rest.roles = ["regional_coordinator"];
    rest.is_active = true;
    if (id) await supabase.from("staff_members" as any).update(rest as any).eq("id", id);
    else await supabase.from("staff_members" as any).insert(rest as any);
    setRegionalDialog(false); setRegionalEditing(null);
    queryClient.invalidateQueries({ queryKey: ["faq-staff"] });
    toast({ title: "Salvato!" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_70%)]" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h1 className="font-display text-5xl md:text-7xl tracking-wider text-foreground mb-4">FAQ & INFO</h1>
          <div className="text-muted-foreground text-lg max-w-2xl mx-auto">
            <EditableText settingKey={FAQ_SETTING_KEYS.hero} settings={faqSettings} isAdmin={isAdmin} />
          </div>
          <div className="mt-8 flex justify-center"><ChevronDown size={28} className="text-primary animate-bounce" /></div>
        </div>
      </section>

      {/* Contact Section */}
      {(contactCategories.length > 0 || isAdmin) && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl md:text-4xl tracking-wider text-foreground mb-2">CONTATTI</h2>
              <div className="text-muted-foreground"><EditableText settingKey={FAQ_SETTING_KEYS.contatti} settings={faqSettings} isAdmin={isAdmin} /></div>
              {isAdmin && (
                <div className="mt-4">
                  <AdminAddButton label="Aggiungi categoria" onClick={() => {
                    setContactEditing({ name: "", description: "", email: "", icon: "Mail", sort_order: contactCategories.length, is_active: true });
                    setContactDialog(true);
                  }} />
                </div>
              )}
            </div>
            <div className="grid lg:grid-cols-[1fr_350px] gap-8 max-w-5xl mx-auto">
              <ContactForm categories={contactCategories} />
              <SocialLinksCard />
            </div>
          </div>
        </section>
      )}

      {/* Staff Section */}
      {(() => {
        const coreStaff = staffMembers.filter((m: any) => !(m.roles || []).includes("regional_coordinator") || (m.roles || []).length > 1);
        const regionalStaff = staffMembers.filter((m: any) => (m.roles || []).includes("regional_coordinator"));
        return (
          <>
            {(coreStaff.length > 0 || isAdmin) && (
              <section className="py-16 bg-card/30">
                <div className="container mx-auto px-4">
                  <div className="text-center mb-12">
                    <h2 className="font-display text-3xl md:text-4xl tracking-wider text-foreground mb-2">
                      <Shield className="inline-block mr-2 text-primary" size={28} />
                      IL NOSTRO STAFF
                    </h2>
                    <div className="text-muted-foreground"><EditableText settingKey={FAQ_SETTING_KEYS.staff} settings={faqSettings} isAdmin={isAdmin} /></div>
                    {isAdmin && (
                      <div className="mt-4">
                        <AdminAddButton label="Aggiungi staff" onClick={() => {
                          setStaffEditing({ user_id: null, roles: [], title: "", sort_order: staffMembers.length, is_active: true, profile: null });
                          setStaffDialog(true);
                        }} />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-w-5xl mx-auto">
                    {coreStaff.map((m: any) => (
                      <div key={m.id} className="relative group/admin">
                        <StaffCard member={m} />
                        {isAdmin && (
                          <div className="absolute top-2 right-2 opacity-0 group-hover/admin:opacity-100 transition-opacity flex gap-1">
                            <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => { setStaffEditing({ ...m }); setStaffDialog(true); }}><Pencil size={12} /></Button>
                            <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => deleteStaff(m.id)}><Trash2 size={12} /></Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {(regionalStaff.length > 0 || isAdmin) && (
              <section className="py-16">
                <div className="container mx-auto px-4">
                  <div className="text-center mb-12">
                    <h2 className="font-display text-3xl md:text-4xl tracking-wider text-foreground mb-2">
                      <Globe className="inline-block mr-2 text-sky-400" size={28} />
                      REFERENTI REGIONALI
                    </h2>
                    <p className="text-muted-foreground">I nostri coordinatori sul territorio</p>
                    {isAdmin && (
                      <div className="mt-4">
                        <AdminAddButton label="Aggiungi referente" onClick={() => {
                          setRegionalEditing({ user_id: null, roles: ["regional_coordinator"], title: "", sort_order: staffMembers.length, is_active: true, profile: null });
                          setRegionalDialog(true);
                        }} />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-w-5xl mx-auto">
                    {regionalStaff.map((m: any) => (
                      <div key={m.id} className="relative group/admin">
                        <RegionalCard member={m} />
                        {isAdmin && (
                          <div className="absolute top-2 right-2 opacity-0 group-hover/admin:opacity-100 transition-opacity flex gap-1">
                            <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => { setRegionalEditing({ ...m }); setRegionalDialog(true); }}><Pencil size={12} /></Button>
                            <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => deleteStaff(m.id)}><Trash2 size={12} /></Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        );
      })()}

      {/* Supporters Section */}
      {(supporters.length > 0 || isAdmin) && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl md:text-4xl tracking-wider text-foreground mb-2">
                <Heart className="inline-block mr-2 text-red-500" size={28} />
                SUPPORTERS & DONATORI
              </h2>
              <div className="text-muted-foreground"><EditableText settingKey={FAQ_SETTING_KEYS.supporters} settings={faqSettings} isAdmin={isAdmin} /></div>
              {isAdmin && (
                <div className="mt-4">
                  <AdminAddButton label="Aggiungi supporter" onClick={() => {
                    setSupporterEditing({ display_name: "", avatar_url: "", tier: "supporter", message: "", badge_id: null, user_id: null, sort_order: supporters.length, is_active: true, profile: null, club: null });
                    setSupporterDialog(true);
                  }} />
                </div>
              )}
            </div>
            <SupporterCarousel supporters={supporters} isAdmin={isAdmin} onEdit={(s: any) => { setSupporterEditing(s); setSupporterDialog(true); }} onDelete={deleteSupporter} />
          </div>
        </section>
      )}

      {/* History Timeline */}
      {(historyEntries.length > 0 || isAdmin) && (
        <section className="py-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.04),transparent_60%)]" />
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-16">
              <h2 className="font-display text-4xl md:text-6xl tracking-wider text-foreground mb-3">LA NOSTRA STORIA</h2>
              <div className="text-muted-foreground text-lg"><EditableText settingKey={FAQ_SETTING_KEYS.storia} settings={faqSettings} isAdmin={isAdmin} /></div>
            </div>
            <div className="relative max-w-4xl mx-auto space-y-8 md:space-y-12">
              {historyEntries.map((entry: any, i: number) => (
                <div key={entry.id} className="relative group/admin">
                  <HistoryEntry entry={entry} index={i} />
                  {isAdmin && (
                    <div className="absolute top-0 right-0 opacity-0 group-hover/admin:opacity-100 transition-opacity flex gap-1 z-20">
                      <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => { setHistoryEditing(entry); setHistoryDialog(true); }}><Pencil size={12} /></Button>
                      <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => deleteHistory(entry.id)}><Trash2 size={12} /></Button>
                    </div>
                  )}
                </div>
              ))}
              <div className="flex justify-center">
                {isAdmin ? (
                  <AdminAddButton label="Aggiungi voce" onClick={() => {
                    setHistoryEditing({ year: new Date().getFullYear(), month: null, title: "", description: "", image_url: "", generation: "", sort_order: historyEntries.length });
                    setHistoryDialog(true);
                  }} />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary/40 border-4 border-background animate-pulse" />
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Empty state */}
      {contactCategories.length === 0 && supporters.length === 0 && historyEntries.length === 0 && staffMembers.length === 0 && !isAdmin && (
        <section className="py-32">
          <div className="container mx-auto px-4 text-center">
            <p className="text-muted-foreground text-lg">Contenuti in arrivo.</p>
          </div>
        </section>
      )}

      {/* ─── Admin Dialogs ─── */}
      <Dialog open={historyDialog} onOpenChange={setHistoryDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{historyEditing?.id ? "Modifica" : "Nuova"} Voce Timeline</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Anno</Label><Input type="number" value={historyEditing?.year || ""} onChange={e => setHistoryEditing((p: any) => ({ ...p, year: +e.target.value }))} /></div>
              <div><Label>Mese (opzionale)</Label><Input type="number" min={1} max={12} value={historyEditing?.month || ""} onChange={e => setHistoryEditing((p: any) => ({ ...p, month: e.target.value ? +e.target.value : null }))} /></div>
            </div>
            <div><Label>Titolo</Label><Input value={historyEditing?.title || ""} onChange={e => setHistoryEditing((p: any) => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Descrizione</Label><Textarea value={historyEditing?.description || ""} onChange={e => setHistoryEditing((p: any) => ({ ...p, description: e.target.value }))} rows={4} /></div>
            <div><Label>URL Immagine</Label><Input value={historyEditing?.image_url || ""} onChange={e => setHistoryEditing((p: any) => ({ ...p, image_url: e.target.value }))} /></div>
            <div><Label>Generazione/Era</Label><Input value={historyEditing?.generation || ""} onChange={e => setHistoryEditing((p: any) => ({ ...p, generation: e.target.value }))} /></div>
            <div><Label>Ordine</Label><Input type="number" value={historyEditing?.sort_order ?? 0} onChange={e => setHistoryEditing((p: any) => ({ ...p, sort_order: +e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={saveHistory}>Salva</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <SupporterAddDialog open={supporterDialog} onOpenChange={setSupporterDialog} editing={supporterEditing} setEditing={setSupporterEditing} onSave={saveSupporter} />
      <StaffAddDialog open={staffDialog} onOpenChange={setStaffDialog} editing={staffEditing} setEditing={setStaffEditing} onSave={saveStaff} />
      <RegionalAddDialog open={regionalDialog} onOpenChange={setRegionalDialog} editing={regionalEditing} setEditing={setRegionalEditing} onSave={saveRegional} />

      <Dialog open={contactDialog} onOpenChange={setContactDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{contactEditing?.id ? "Modifica" : "Nuova"} Categoria Contatto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={contactEditing?.name || ""} onChange={e => setContactEditing((p: any) => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Descrizione</Label><Textarea value={contactEditing?.description || ""} onChange={e => setContactEditing((p: any) => ({ ...p, description: e.target.value }))} /></div>
            <div><Label>Email</Label><Input value={contactEditing?.email || ""} onChange={e => setContactEditing((p: any) => ({ ...p, email: e.target.value }))} /></div>
            <div><Label>Icona</Label>
              <Select value={contactEditing?.icon || "Mail"} onValueChange={v => setContactEditing((p: any) => ({ ...p, icon: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(iconMap).map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Ordine</Label><Input type="number" value={contactEditing?.sort_order ?? 0} onChange={e => setContactEditing((p: any) => ({ ...p, sort_order: +e.target.value }))} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={contactEditing?.is_active ?? true} onCheckedChange={v => setContactEditing((p: any) => ({ ...p, is_active: v }))} />
              <Label>Attivo</Label>
            </div>
          </div>
          <DialogFooter><Button onClick={saveContact}>Salva</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default Faq;
