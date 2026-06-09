import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PageShell } from "@/components/layout/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useStaffRole } from "@/hooks/useStaffRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, X, Search, Trash2, Pencil, Megaphone, Heart, Flag, ChevronDown, ShieldAlert } from "lucide-react";
import { BncIcon } from "@/components/icons/BncIcon";
import { RichTextEditor } from "@/components/forum/RichTextEditor";
import { RichContentRenderer } from "@/components/forum/RichContentRenderer";
import { format } from "date-fns";
import { ForumReportDialog } from "@/components/ForumReportDialog";
import { it } from "date-fns/locale";
import { z } from "zod";
import { validateNoProfanity } from "@/lib/profanityFilter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const MAX_MENTIONS = 5;

const extractMentions = (content: string): string[] => {
  const text = content.replace(/<[^>]+>/g, " ");
  const matches = text.match(/@(\w+)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1)))].slice(0, MAX_MENTIONS);
};

const sendMentionNotifications = async (mentionerId: string, usernames: string[], postId: string, context: string) => {
  await Promise.all(usernames.map(username =>
    supabase.rpc("notify_mention", {
      _mentioner_id: mentionerId,
      _mentioned_username: username,
      _post_id: postId,
      _context: context,
    } as any)
  ));
};


interface ForumPost {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  image_url: string | null;
  replies_count: number;
  created_at: string;
  profiles: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

const allCategories = [
  { value: "annunci_staff", label: "Annunci Staff", color: "bg-red-500/20 text-red-400", staffOnly: true },
  { value: "strategia", label: "Strategia", color: "bg-blue-500/20 text-blue-400", staffOnly: false },
  { value: "tornei", label: "Tornei", color: "bg-primary/20 text-primary", staffOnly: false },
  { value: "generale", label: "Generale", color: "bg-green-500/20 text-green-400", staffOnly: false },
  { value: "guide", label: "Guide", color: "bg-yellow-500/20 text-yellow-400", staffOnly: false },
];

const forumRules = [
  "Non pubblicare annunci di vendita, acquisto o scambio — usa la sezione Mercato dedicata.",
  "Non pubblicare risultati o discussioni sui tornei — usa la sezione Tornei.",
  "Non fare spam, pubblicità non autorizzata o autopromozione eccessiva.",
  "Niente contenuti offensivi, discriminatori, violenti o sessualmente espliciti.",
  "Non insultare, provocare o attaccare altri membri della community.",
  "Non pubblicare informazioni personali di terzi senza il loro consenso.",
  "Non creare post duplicati o ripetitivi — cerca prima se l'argomento esiste già.",
  "Non diffondere fake news, leak non verificati o informazioni false.",
  "Usa titoli chiari e descrittivi — evita clickbait o titoli vaghi.",
  "Rispetta le decisioni dei moderatori — eventuali contestazioni vanno fatte in privato.",
  "Account multipli o elusione di ban comportano la rimozione permanente.",
];

const ForumRulesCard = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="bg-card rounded-xl border border-border p-4 mb-6">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <ShieldAlert size={18} className="text-destructive" />
              </div>
              <div className="text-left">
                <h3 className="font-display text-base sm:text-lg">Regolamento del Forum</h3>
                <p className="text-xs text-muted-foreground">Leggi le regole prima di pubblicare</p>
              </div>
            </div>
            <ChevronDown size={18} className={`text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="mt-4 space-y-2 border-t border-border pt-4">
            {forumRules.map((rule, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="font-mono text-xs text-destructive/70 mt-0.5 shrink-0">{i + 1}.</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground/60 mt-3 italic">La violazione delle regole comporta la rimozione dei contenuti e possibili provvedimenti.</p>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

const postSchema = z.object({
  title: z.string().min(5, "Titolo troppo corto (min 5 caratteri)").max(200, "Titolo troppo lungo"),
  content: z.string().min(3, "Contenuto troppo corto").max(5000, "Contenuto troppo lungo"),
  category: z.string(),
});

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, "").trim();

const Forum = () => {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPost, setShowNewPost] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("generale");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [createKey, setCreateKey] = useState(0);
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { isStaff } = useStaffRole();
  const navigate = useNavigate();

  const [postLikesCount, setPostLikesCount] = useState<Record<string, number>>({});
  const [userPostLikes, setUserPostLikes] = useState<Set<string>>(new Set());
  const [likingPostIds, setLikingPostIds] = useState<Set<string>>(new Set());

  const categories = allCategories.filter((c) => !c.staffOnly || isStaff || isAdmin);

  const [page, setPage] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const POSTS_PER_PAGE = 20;

  useEffect(() => { fetchPosts(); }, []);

  const fetchPosts = async (append = false) => {
    const from = append ? posts.length : 0;
    const { data, error } = await supabase
      .from("forum_posts")
      .select("id, user_id, title, content, category, image_url, replies_count, likes_count, created_at")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + POSTS_PER_PAGE - 1);

    if (!error && data) {
      setHasMorePosts(data.length === POSTS_PER_PAGE);
      const userIds = [...new Set(data.map((p) => p.user_id))];
      const postIds = data.map(p => p.id);

      // Parallelize profiles + user likes fetch
      const [{ data: profiles }, myLikesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", userIds),
        user ? supabase.from("forum_post_likes" as any).select("post_id").eq("user_id", user.id).in("post_id", postIds) : Promise.resolve({ data: [] as any[] }),
      ]);

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      const postsData = data.map((post) => ({ ...post, replies_count: post.replies_count ?? 0, profiles: profileMap.get(post.user_id) || null })) as ForumPost[];
      const allPosts = append ? [...posts, ...postsData] : postsData;
      setPosts(allPosts);

      // Set likes from denormalized count + user likes
      const counts: Record<string, number> = {};
      allPosts.forEach(p => { counts[p.id] = (p as any).likes_count || 0; });
      setPostLikesCount(counts);
      if (user) {
        setUserPostLikes(new Set(((myLikesRes.data as any[]) ?? []).map((l) => l.post_id)));
      }
    } else if (!append) {
      setPosts([]);
    }
    setLoading(false);
    setLoadingMore(false);
  };

  const loadMorePosts = () => {
    if (loadingMore || !hasMorePosts) return;
    setLoadingMore(true);
    fetchPosts(true);
  };


  const togglePostLike = async (postId: string) => {
    if (!user) { toast.error("Accedi per mettere like"); return; }
    if (likingPostIds.has(postId)) return;
    setLikingPostIds(prev => new Set(prev).add(postId));
    const liked = userPostLikes.has(postId);
    setUserPostLikes(prev => { const next = new Set(prev); if (liked) next.delete(postId); else next.add(postId); return next; });
    setPostLikesCount(prev => ({ ...prev, [postId]: (prev[postId] || 0) + (liked ? -1 : 1) }));
    if (liked) { await supabase.from("forum_post_likes" as any).delete().eq("post_id", postId).eq("user_id", user.id); }
    else { await supabase.from("forum_post_likes" as any).insert({ post_id: postId, user_id: user.id } as any); }
    setLikingPostIds(prev => { const next = new Set(prev); next.delete(postId); return next; });
  };


  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Devi effettuare l'accesso per pubblicare"); return; }
    const textContent = stripHtml(newContent);
    try { postSchema.parse({ title: newTitle, content: textContent, category: newCategory }); }
    catch (error) { if (error instanceof z.ZodError) { toast.error(error.errors[0].message); return; } }
    const profanityError = validateNoProfanity(newTitle, textContent);
    if (profanityError) { toast.error(profanityError); return; }
    setIsSubmitting(true);

    const finalImageUrl = imageUrl.trim() || null;

    const { data: insertedPost, error } = await supabase.from("forum_posts").insert({
      user_id: user.id, title: newTitle.trim(), content: newContent, category: newCategory, image_url: finalImageUrl,
    }).select("id").single();
    if (error) { toast.error("Errore nella pubblicazione: " + error.message); }
    else {
      if (insertedPost) {
        const mentions = extractMentions(newContent);
        if (mentions.length > 0) await sendMentionNotifications(user.id, mentions, insertedPost.id, "un post");
      }
      toast.success("Post pubblicato!");
      setNewTitle(""); setNewContent(""); setNewCategory("generale"); setImageUrl(""); setShowNewPost(false);
      setCreateKey(prev => prev + 1);
      fetchPosts();
    }
    setIsSubmitting(false);
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo post?")) return;
    const { error } = await supabase.from("forum_posts").delete().eq("id", postId);
    if (error) { toast.error("Errore nell'eliminazione del post"); } else { toast.success("Post eliminato"); fetchPosts(); }
  };

  const startEditing = (post: ForumPost) => {
    setEditingPost(post.id); setEditTitle(post.title); setEditContent(post.content); setEditCategory(post.category);
  };

  const handleUpdatePost = async (postId: string) => {
    const textContent = stripHtml(editContent);
    try { postSchema.parse({ title: editTitle, content: textContent, category: editCategory }); }
    catch (error) { if (error instanceof z.ZodError) { toast.error(error.errors[0].message); return; } }
    const profanityError = validateNoProfanity(editTitle, textContent);
    if (profanityError) { toast.error(profanityError); return; }
    const { error } = await supabase.from("forum_posts").update({ title: editTitle.trim(), content: editContent, category: editCategory }).eq("id", postId);
    if (error) { toast.error("Errore nella modifica"); } else { toast.success("Post aggiornato"); setEditingPost(null); fetchPosts(); }
  };

  const getCategoryStyle = (category: string) => allCategories.find((c) => c.value === category)?.color || "bg-secondary text-muted-foreground";
  const getCategoryLabel = (category: string) => allCategories.find((c) => c.value === category)?.label || category;

  const filteredPosts = posts.filter((post) => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) || post.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || post.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <PageShell ambient="subtle"><div className="min-h-screen text-foreground">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-primary font-medium uppercase tracking-wider text-sm">Community</span>
            <h1 className="section-title mt-2">FORUM <span className="gradient-text">BLADER</span></h1>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">Discuti strategie, organizza incontri e condividi la tua passione con altri blader.</p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input placeholder="Cerca discussioni..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-card border-border" />
              </div>
              <div className="flex gap-2">
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-4 py-2 rounded-lg bg-card border border-border text-foreground">
                  <option value="">Tutte le categorie</option>
                  {categories.map((cat) => (<option key={cat.value} value={cat.value}>{cat.label}</option>))}
                </select>
                {user && (
                  <Button variant="hero" onClick={() => setShowNewPost(true)}>
                    <Plus size={18} className="mr-2" /> Nuovo Post
                  </Button>
                )}
              </div>
            </div>

            <ForumRulesCard />

            {showNewPost && (
              <div className="bg-card rounded-2xl border border-border p-6 mb-8 animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-xl">Crea nuovo post</h2>
                  <Button variant="ghost" size="icon" onClick={() => setShowNewPost(false)}><X size={20} /></Button>
                </div>
                <form onSubmit={handleCreatePost} className="space-y-4">
                  <Input placeholder="Titolo della discussione" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="bg-secondary border-border" />
                  <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full px-4 py-2 rounded-lg bg-secondary border border-border text-foreground">
                    {categories.map((cat) => (<option key={cat.value} value={cat.value}>{cat.label}</option>))}
                  </select>
                  <RichTextEditor
                    key={`create-${createKey}`}
                    initialContent=""
                    onChange={setNewContent}
                    placeholder="Scrivi il contenuto del tuo post... Usa @username per menzionare"
                  />
                  <div>
                    <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="URL immagine (opzionale, es. https://...)" className="mt-1" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => setShowNewPost(false)}>Annulla</Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Pubblicazione..." : "Pubblica"}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            <div className="space-y-4">
              {loading ? (
                <div className="text-center text-muted-foreground py-12">Caricamento discussioni...</div>
              ) : filteredPosts.length === 0 ? (
                <div className="text-center py-12">
                  <BncIcon name="chat" size={48} className="mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{posts.length === 0 ? "Nessuna discussione ancora. Sii il primo a pubblicare!" : "Nessun risultato trovato"}</p>
                  {!user && posts.length === 0 && (<p className="text-sm text-muted-foreground mt-2"><a href="/auth" className="text-primary hover:underline">Accedi</a> per creare il primo post</p>)}
                </div>
              ) : (
                filteredPosts.map((post) => {
                  const canEdit = user?.id === post.user_id || isAdmin;
                  const canDelete = canEdit || isAdmin;
                  const isEditing = editingPost === post.id;

                  return (
                    <div
                      key={post.id}
                      className={`bg-card rounded-xl border p-5 card-glow hover:border-primary/30 transition-colors cursor-pointer ${
                        post.category === "annunci_staff" ? "border-red-500/40 ring-1 ring-red-500/20" : "border-border"
                      }`}
                      onClick={() => navigate(`/forum/${post.id}`)}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center border border-border shrink-0 overflow-hidden">
                          {post.profiles?.avatar_url ? (
                            <img src={post.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-display text-lg">
                              {(post.profiles?.display_name || post.profiles?.username || "?").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-secondary border-border" />
                              <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="w-full px-4 py-2 rounded-lg bg-secondary border border-border text-foreground">
                                {categories.map((cat) => (<option key={cat.value} value={cat.value}>{cat.label}</option>))}
                              </select>
                              <RichTextEditor
                                key={`edit-${editingPost}`}
                                initialContent={editContent}
                                onChange={setEditContent}
                                placeholder="Contenuto"
                              />
                              <div className="flex gap-2 justify-end">
                                <Button variant="ghost" size="sm" onClick={() => setEditingPost(null)}>Annulla</Button>
                                <Button size="sm" onClick={() => handleUpdatePost(post.id)}>Salva</Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryStyle(post.category)}`}>
                                  {post.category === "annunci_staff" && <Megaphone size={10} className="inline mr-1" />}
                                  {getCategoryLabel(post.category)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(post.created_at), "d MMM yyyy, HH:mm", { locale: it })}
                                </span>
                              </div>
                              
                              <h3 className="font-display text-lg md:text-xl mb-1 line-clamp-1">{post.title}</h3>
                              <div className="text-sm text-muted-foreground line-clamp-2 mb-3"><RichContentRenderer content={post.content} /></div>

                              {post.image_url && (
                                <img src={post.image_url} alt="" className="max-h-48 rounded-lg border border-border mb-3 object-cover" />
                              )}
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span>
                                    di{" "}
                                    {post.profiles?.username ? (
                                      <Link to={`/profilo/${post.profiles.username}`} className="text-foreground hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>
                                        {post.profiles.display_name || post.profiles.username}
                                      </Link>
                                    ) : (
                                      <span className="text-foreground">{post.profiles?.display_name || "Anonimo"}</span>
                                    )}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <BncIcon name="chat" size={14} />
                                    {post.replies_count} risposte
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); togglePostLike(post.id); }}
                                    className="flex items-center gap-1 hover:text-primary transition-colors"
                                    disabled={likingPostIds.has(post.id)}
                                  >
                                    <Heart size={14} className={userPostLikes.has(post.id) ? "fill-primary text-primary" : ""} />
                                    {(postLikesCount[post.id] || 0) > 0 && (
                                      <span className={userPostLikes.has(post.id) ? "text-primary font-medium" : ""}>{postLikesCount[post.id]}</span>
                                    )}
                                  </button>
                                </div>

                                {(canEdit || canDelete) && (
                                  <div className="flex items-center gap-1">
                                    {canEdit && (
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); startEditing(post); }}>
                                        <Pencil size={14} />
                                      </Button>
                                    )}
                                    {canDelete && (
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }}>
                                        <Trash2 size={14} />
                                      </Button>
                                    )}
                                  </div>
                                )}
                                {user && user.id !== post.user_id && !canEdit && (
                                <ForumReportDialog postId={post.id}>
                                    <button className="p-1.5 rounded-lg text-orange-500/70 hover:text-orange-500 hover:bg-orange-500/10 transition-colors" title="Segnala post">
                                      <Flag size={16} />
                                    </button>
                                  </ForumReportDialog>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {hasMorePosts && !searchQuery && !categoryFilter && (
                <div className="flex justify-center mt-6">
                  <Button variant="outline" onClick={loadMorePosts} disabled={loadingMore}>
                    {loadingMore ? "Caricamento..." : "Carica altri post"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div></PageShell>
  );
};

export default Forum;
