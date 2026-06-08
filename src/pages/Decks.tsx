import { useState, useEffect, useRef, TouchEvent as ReactTouchEvent, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DeckCreatorDialog } from "@/components/decks/DeckCreatorDialog";
import { DeckCard } from "@/components/decks/DeckCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Swords, Search, TrendingUp, Clock, Flame, Trophy, Medal, ChevronLeft, ChevronRight } from "lucide-react";

interface DeckData {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

type SortMode = "new" | "popular" | "rank";
const DECKS_PER_PAGE = 6;
const TOP_PER_PAGE = 6;
const SWIPE_THRESHOLD = 50;

const PaginationControls = ({ page, total, onPrev, onNext, small }: { page: number; total: number; onPrev: () => void; onNext: () => void; small?: boolean }) => {
  if (total <= 1) return null;
  const h = small ? "h-7 w-7" : "h-8 w-8";
  const r = small ? "rounded-lg" : "rounded-xl";
  const iconSize = small ? 12 : 14;
  const textSize = small ? "text-[10px]" : "text-xs";
  return (
    <div className="flex items-center justify-center gap-2">
      <Button variant="outline" size="icon" className={`${h} ${r}`} disabled={page === 0} onClick={onPrev}>
        <ChevronLeft size={iconSize} />
      </Button>
      <span className={`${textSize} text-muted-foreground`}>{page + 1} / {total}</span>
      <Button variant="outline" size="icon" className={`${h} ${r}`} disabled={page >= total - 1} onClick={onNext}>
        <ChevronRight size={iconSize} />
      </Button>
    </div>
  );
};

const Decks = () => {
  const { user } = useAuth();
  const [decks, setDecks] = useState<DeckData[]>([]);
  const [myDecks, setMyDecks] = useState<DeckData[]>([]);
  const [profiles, setProfiles] = useState<Map<string, { display_name: string | null; username: string | null; avatar_url: string | null; points: number }>>(new Map());
  const [deckLikes, setDeckLikes] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showMine, setShowMine] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("new");
  const [decksPage, setDecksPage] = useState(0);
  const [topPage, setTopPage] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

  const [popularDecks, setPopularDecks] = useState<{ deck: DeckData; count: number; wins: number; profileData: any }[]>([]);

  useEffect(() => {
    fetchDecks();
    fetchPopularDecks();
  }, []);

  // Fetch user's own decks when logged in
  useEffect(() => {
    if (!user) { setMyDecks([]); return; }
    const fetchMine = async () => {
      const { data } = await (supabase as any)
        .from("decks")
        .select("id, user_id, name, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setMyDecks(data || []);
    };
    fetchMine();
  }, [user]);

  const fetchDecks = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("decks")
      .select("id, user_id, name, description, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    const decksList: DeckData[] = data || [];
    setDecks(decksList);

    if (decksList.length > 0) {
      const userIds = [...new Set(decksList.map(d => d.user_id))];
      const deckIds = decksList.map(d => d.id);
      
      // Fetch profiles and likes in parallel instead of sequentially
      const [{ data: profilesData }, { data: likesData }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, username, avatar_url, points").in("user_id", userIds),
        (supabase as any).from("deck_likes").select("deck_id").in("deck_id", deckIds),
      ]);

      const map = new Map<string, any>();
      (profilesData || []).forEach(p => map.set(p.user_id, p));
      setProfiles(map);

      const likesMap = new Map<string, number>();
      (likesData || []).forEach((l: any) => {
        likesMap.set(l.deck_id, (likesMap.get(l.deck_id) || 0) + 1);
      });
      setDeckLikes(likesMap);
    }

    setLoading(false);
  };

  // Ensure profiles are loaded for myDecks too
  useEffect(() => {
    if (myDecks.length === 0) return;
    const missingIds = myDecks.map(d => d.user_id).filter(id => !profiles.has(id));
    if (missingIds.length === 0) return;
    const fetchMissing = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, points")
        .in("user_id", [...new Set(missingIds)]);
      if (data) {
        setProfiles(prev => {
          const next = new Map(prev);
          data.forEach(p => next.set(p.user_id, p));
          return next;
        });
      }
    };
    fetchMissing();
  }, [myDecks]);

  const fetchPopularDecks = async () => {
    // Only fetch deck_id counts instead of full rows
    const { data: selections } = await (supabase as any)
      .from("tournament_deck_selections")
      .select("deck_id, tournament_id, user_id")
      .limit(500);

    if (!selections || selections.length === 0) return;

    const deckCounts = new Map<string, number>();
    selections.forEach((s: any) => {
      deckCounts.set(s.deck_id, (deckCounts.get(s.deck_id) || 0) + 1);
    });

    const topDeckIds = [...deckCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([id]) => id);

    if (topDeckIds.length === 0) return;

    // Parallelize deck data, wins, and profiles
    const [{ data: topDecksData }, { data: winsData }] = await Promise.all([
      (supabase as any).from("decks").select("id, user_id, name, description, created_at").in("id", topDeckIds),
      (supabase as any).from("tournament_results").select("user_id, tournament_id").eq("placement", 1).limit(200),
    ]);

    if (!topDecksData) return;

    const deckWins = new Map<string, number>();
    if (winsData) {
      for (const win of winsData) {
        const sel = selections.find((s: any) => s.user_id === win.user_id && s.tournament_id === win.tournament_id);
        if (sel) {
          deckWins.set(sel.deck_id, (deckWins.get(sel.deck_id) || 0) + 1);
        }
      }
    }

    const userIds = [...new Set(topDecksData.map((d: any) => d.user_id))] as string[];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, display_name, username, avatar_url")
      .in("user_id", userIds);

    const pMap = new Map<string, any>();
    (profilesData || []).forEach(p => pMap.set(p.user_id, p));

    const popular = topDeckIds
      .map(id => {
        const deck = topDecksData.find((d: any) => d.id === id);
        if (!deck) return null;
        return { deck, count: deckCounts.get(id) || 0, wins: deckWins.get(id) || 0, profileData: pMap.get(deck.user_id) || null };
      })
      .filter(Boolean) as any[];

    setPopularDecks(popular);
  };

  const sourceDecks = showMine ? myDecks : decks;

  const filteredDecks = sourceDecks
    .filter(d => {
      if (search) {
        const s = search.toLowerCase();
        const profile = profiles.get(d.user_id);
        return d.name.toLowerCase().includes(s) ||
          d.description?.toLowerCase().includes(s) ||
          profile?.display_name?.toLowerCase().includes(s) ||
          profile?.username?.toLowerCase().includes(s);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortMode === "popular") {
        return (deckLikes.get(b.id) || 0) - (deckLikes.get(a.id) || 0);
      }
      if (sortMode === "rank") {
        const pA = profiles.get(a.user_id)?.points || 0;
        const pB = profiles.get(b.user_id)?.points || 0;
        return pB - pA;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  useEffect(() => { setDecksPage(0); }, [search, showMine, sortMode]);

  const totalDecksPages = Math.max(1, Math.ceil(filteredDecks.length / DECKS_PER_PAGE));
  const pagedDecks = filteredDecks.slice(decksPage * DECKS_PER_PAGE, (decksPage + 1) * DECKS_PER_PAGE);

  const totalTopPages = Math.max(1, Math.ceil(popularDecks.length / TOP_PER_PAGE));
  const pagedTopDecks = popularDecks.slice(topPage * TOP_PER_PAGE, (topPage + 1) * TOP_PER_PAGE);

  // Swipe handlers for mobile
  const animatePageChange = useCallback((direction: number, setter: React.Dispatch<React.SetStateAction<number>>, totalPages: number) => {
    setIsAnimating(true);
    setSwipeOffset(direction > 0 ? -80 : 80);
    setTimeout(() => {
      setter(p => Math.max(0, Math.min(totalPages - 1, p + direction)));
      setSwipeOffset(direction > 0 ? 80 : -80);
      setTimeout(() => {
        setSwipeOffset(0);
        setIsAnimating(false);
      }, 20);
    }, 150);
  }, []);

  const handleTouchStart = useCallback((e: ReactTouchEvent) => {
    if (isAnimating) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  }, [isAnimating]);

  const handleTouchMove = useCallback((e: ReactTouchEvent) => {
    if (isAnimating) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!isSwiping.current && Math.abs(dx) > Math.abs(dy) * 1.2 && Math.abs(dx) > 10) {
      isSwiping.current = true;
    }
    if (isSwiping.current) {
      setSwipeOffset(Math.max(-100, Math.min(100, dx * 0.4)));
    }
  }, [isAnimating]);

  const createTouchEnd = useCallback((setter: React.Dispatch<React.SetStateAction<number>>, totalPages: number, currentPage: number) => {
    return () => {
      if (!isSwiping.current) { setSwipeOffset(0); return; }
      const dx = swipeOffset;
      if (dx < -SWIPE_THRESHOLD / 2 && currentPage < totalPages - 1) {
        animatePageChange(1, setter, totalPages);
      } else if (dx > SWIPE_THRESHOLD / 2 && currentPage > 0) {
        animatePageChange(-1, setter, totalPages);
      } else {
        setSwipeOffset(0);
      }
      isSwiping.current = false;
    };
  }, [swipeOffset, animatePageChange]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl mb-3 flex items-center justify-center gap-3">
              <Swords className="text-primary" size={36} />
              Decks
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Condividi i tuoi deck da 3 Beyblade e scopri le combo più usate nei tornei.
            </p>
          </div>

          <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
            <div>
              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca deck..." className="pl-9 rounded-xl" />
                </div>
                <div className="flex gap-1">
                  <Button variant={sortMode === "new" ? "default" : "outline"} size="sm" onClick={() => setSortMode("new")} className="rounded-xl gap-1 text-xs">
                    <Clock size={12} /> Nuovi
                  </Button>
                  <Button variant={sortMode === "popular" ? "default" : "outline"} size="sm" onClick={() => setSortMode("popular")} className="rounded-xl gap-1 text-xs">
                    <Flame size={12} /> Popolari
                  </Button>
                  <Button variant={sortMode === "rank" ? "default" : "outline"} size="sm" onClick={() => setSortMode("rank")} className="rounded-xl gap-1 text-xs">
                    <Trophy size={12} /> Rank
                  </Button>
                </div>
                {user && (
                  <Button variant={showMine ? "default" : "outline"} size="sm" onClick={() => setShowMine(!showMine)} className="rounded-xl text-xs">
                    I miei
                  </Button>
                )}
                {user && <DeckCreatorDialog onCreated={() => { fetchDecks(); supabase.from("decks").select("id, user_id, name, description, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => setMyDecks(data || [])); }} />}
              </div>

              {!user && (
                <div className="bg-card rounded-2xl border border-border p-6 text-center mb-6">
                  <p className="text-muted-foreground text-sm">
                    <a href="/auth" className="text-primary hover:underline font-medium">Accedi</a> per creare e condividere i tuoi deck.
                  </p>
                </div>
              )}

              {loading ? (
                <div className="text-center py-12 text-muted-foreground">Caricamento...</div>
              ) : filteredDecks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {search || showMine ? "Nessun deck trovato con i filtri attuali." : "Nessun deck ancora condiviso. Sii il primo!"}
                </div>
              ) : (
                <>
                  <PaginationControls page={decksPage} total={totalDecksPages} onPrev={() => setDecksPage(p => p - 1)} onNext={() => setDecksPage(p => p + 1)} />
                  <div
                    className="grid sm:grid-cols-2 gap-4 my-4 overflow-hidden touch-pan-y"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={createTouchEnd(setDecksPage, totalDecksPages, decksPage)}
                    style={{
                      transform: `translateX(${swipeOffset}px)`,
                      transition: isAnimating ? 'transform 0.15s ease-out' : (isSwiping.current ? 'none' : 'transform 0.2s ease-out'),
                    }}
                  >
                    {pagedDecks.map(deck => (
                      <DeckCard key={deck.id} deck={deck} profile={profiles.get(deck.user_id)} onDeleted={fetchDecks} />
                    ))}
                  </div>
                  <PaginationControls page={decksPage} total={totalDecksPages} onPrev={() => setDecksPage(p => p - 1)} onNext={() => setDecksPage(p => p + 1)} />
                </>
              )}
            </div>

            {/* Sidebar */}
            <aside className="lg:sticky lg:top-24 space-y-4">
              <div className="bg-card rounded-2xl border border-border p-4">
                <h3 className="font-display text-sm flex items-center gap-2 mb-4">
                  <TrendingUp size={16} className="text-primary" />
                  Deck più usati nei tornei
                </h3>
                {popularDecks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nessun dato disponibile ancora.</p>
                ) : (
                  <>
                    <PaginationControls small page={topPage} total={totalTopPages} onPrev={() => setTopPage(p => p - 1)} onNext={() => setTopPage(p => p + 1)} />
                    <div className="space-y-3 my-3">
                      {pagedTopDecks.map(({ deck, count, wins, profileData }) => (
                        <div key={deck.id} className="space-y-1">
                          <DeckCard deck={deck} profile={profileData} compact />
                          <div className="flex items-center gap-3 px-1 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <Trophy size={10} className="text-primary" /> {count}× usato
                            </span>
                            {wins > 0 && (
                              <span className="flex items-center gap-0.5 text-yellow-500">
                                <Medal size={10} /> {wins} {wins === 1 ? "vittoria" : "vittorie"}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <PaginationControls small page={topPage} total={totalTopPages} onPrev={() => setTopPage(p => p - 1)} onNext={() => setTopPage(p => p + 1)} />
                  </>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Decks;