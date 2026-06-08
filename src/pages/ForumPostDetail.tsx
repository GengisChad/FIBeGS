import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, MessageSquare, Trash2, Send, Pencil, Heart, Flag, Reply as ReplyIcon, CornerDownRight } from "lucide-react";
import { RichTextEditor } from "@/components/forum/RichTextEditor";
import { RichContentRenderer } from "@/components/forum/RichContentRenderer";
import { ForumReportDialog } from "@/components/ForumReportDialog";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { z } from "zod";
import { validateNoProfanity } from "@/lib/profanityFilter";

const postSchema = z.object({
  title: z.string().min(5, "Titolo troppo corto (min 5 caratteri)").max(200, "Titolo troppo lungo"),
  content: z.string().min(3, "Contenuto troppo corto").max(5000, "Contenuto troppo lungo"),
});

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, "").trim();

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
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null };
}

interface Reply {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_reply_id: string | null;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null };
}

const categories: Record<string, { label: string; color: string }> = {
  strategia: { label: "Strategia", color: "bg-blue-500/20 text-blue-400" },
  tornei: { label: "Tornei", color: "bg-primary/20 text-primary" },
  generale: { label: "Generale", color: "bg-green-500/20 text-green-400" },
  mercato: { label: "Mercato", color: "bg-purple-500/20 text-purple-400" },
  guide: { label: "Guide", color: "bg-yellow-500/20 text-yellow-400" },
  annunci_staff: { label: "Annunci Staff", color: "bg-red-500/20 text-red-400" },
};

const ForumPostDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [post, setPost] = useState<ForumPost | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [replyKey, setReplyKey] = useState(0);

  const [replyingTo, setReplyingTo] = useState<Reply | null>(null);

  const [postLikeCount, setPostLikeCount] = useState(0);
  const [userLikedPost, setUserLikedPost] = useState(false);
  const [likingPost, setLikingPost] = useState(false);
  const [replyLikesCount, setReplyLikesCount] = useState<Record<string, number>>({});
  const [userReplyLikes, setUserReplyLikes] = useState<Set<string>>(new Set());
  const [likingReplyIds, setLikingReplyIds] = useState<Set<string>>(new Set());

  useEffect(() => { if (id) fetchPost(); }, [id]);

  const fetchPost = async () => {
    const { data: postData } = await supabase.from("forum_posts").select("id, user_id, title, content, category, image_url, replies_count, created_at").eq("id", id!).single();
    if (!postData) { setLoading(false); return; }
    // Parallelize replies fetch with post likes
    const [{ data: repliesData }, likesCountRes, myLikeRes] = await Promise.all([
      supabase.from("forum_replies").select("id, user_id, content, created_at, parent_reply_id").eq("post_id", id!).order("created_at", { ascending: true }),
      supabase.from("forum_post_likes" as any).select("id", { count: "exact", head: true }).eq("post_id", postData.id),
      user ? supabase.from("forum_post_likes" as any).select("id").eq("post_id", postData.id).eq("user_id", user.id).limit(1) : Promise.resolve({ data: [] }),
    ]);
    setPostLikeCount(likesCountRes.count ?? 0);
    setUserLikedPost(((myLikeRes.data as any[]) ?? []).length > 0);

    const userIds = [...new Set([postData.user_id, ...(repliesData || []).map((r) => r.user_id)])];
    const replyIds = (repliesData || []).map(r => r.id);

    // Parallelize profiles + reply likes
    const [{ data: profiles }, replyLikesRes] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", userIds),
      replyIds.length > 0 ? supabase.from("forum_reply_likes" as any).select("reply_id, user_id").in("reply_id", replyIds) : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
    setPost({ ...postData, replies_count: postData.replies_count ?? 0, profile: profileMap.get(postData.user_id) || undefined });
    const repliesList = (repliesData || []).map((r) => ({ ...r, parent_reply_id: (r as any).parent_reply_id || null, profile: profileMap.get(r.user_id) || undefined }));
    setReplies(repliesList);

    // Process reply likes
    const likes = (replyLikesRes.data as any[]) ?? [];
    const counts: Record<string, number> = {};
    likes.forEach((l) => { counts[l.reply_id] = (counts[l.reply_id] || 0) + 1; });
    setReplyLikesCount(counts);
    if (user) setUserReplyLikes(new Set(likes.filter((l) => l.user_id === user.id).map((l) => l.reply_id)));

    setLoading(false);
  };

  const fetchPostLikes = async (postId: string) => {
    // Use count instead of fetching all rows
    const { count } = await supabase.from("forum_post_likes" as any).select("id", { count: "exact", head: true }).eq("post_id", postId);
    setPostLikeCount(count ?? 0);
    if (user) {
      const { data: myLike } = await supabase.from("forum_post_likes" as any).select("id").eq("post_id", postId).eq("user_id", user.id).limit(1);
      setUserLikedPost(((myLike as any[]) ?? []).length > 0);
    }
  };

  const fetchReplyLikes = async (replyIds: string[]) => {
    if (replyIds.length === 0) return;
    const { data: allLikes } = await supabase.from("forum_reply_likes" as any).select("reply_id, user_id").in("reply_id", replyIds);
    const likes = (allLikes as any[]) ?? [];
    const counts: Record<string, number> = {};
    likes.forEach((l) => { counts[l.reply_id] = (counts[l.reply_id] || 0) + 1; });
    setReplyLikesCount(counts);
    if (user) setUserReplyLikes(new Set(likes.filter((l) => l.user_id === user.id).map((l) => l.reply_id)));
  };

  const togglePostLike = async () => {
    if (!user) { toast.error("Accedi per mettere like"); return; }
    if (likingPost || !post) return;
    setLikingPost(true);
    const liked = userLikedPost;
    setUserLikedPost(!liked);
    setPostLikeCount(prev => prev + (liked ? -1 : 1));
    if (liked) { await supabase.from("forum_post_likes" as any).delete().eq("post_id", post.id).eq("user_id", user.id); }
    else { await supabase.from("forum_post_likes" as any).insert({ post_id: post.id, user_id: user.id } as any); }
    setLikingPost(false);
  };

  const toggleReplyLike = async (replyId: string) => {
    if (!user) { toast.error("Accedi per mettere like"); return; }
    if (likingReplyIds.has(replyId)) return;
    setLikingReplyIds(prev => new Set(prev).add(replyId));
    const liked = userReplyLikes.has(replyId);
    setUserReplyLikes(prev => { const next = new Set(prev); if (liked) next.delete(replyId); else next.add(replyId); return next; });
    setReplyLikesCount(prev => ({ ...prev, [replyId]: (prev[replyId] || 0) + (liked ? -1 : 1) }));
    if (liked) { await supabase.from("forum_reply_likes" as any).delete().eq("reply_id", replyId).eq("user_id", user.id); }
    else { await supabase.from("forum_reply_likes" as any).insert({ reply_id: replyId, user_id: user.id } as any); }
    setLikingReplyIds(prev => { const next = new Set(prev); next.delete(replyId); return next; });
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("Devi effettuare l'accesso per rispondere"); return; }
    const textContent = stripHtml(replyContent);
    if (textContent.length < 3) { toast.error("La risposta è troppo corta"); return; }
    const profanityError = validateNoProfanity(textContent);
    if (profanityError) { toast.error(profanityError); return; }
    setSubmitting(true);
    const insertData: any = { post_id: id!, user_id: user.id, content: replyContent };
    if (replyingTo) insertData.parent_reply_id = replyingTo.id;
    const { error } = await supabase.from("forum_replies").insert(insertData);
    if (error) { toast.error("Errore nell'invio della risposta"); }
    else {
      const mentions = extractMentions(replyContent);
      if (mentions.length > 0 && id) await sendMentionNotifications(user.id, mentions, id, "un commento");
      toast.success("Risposta pubblicata!");
      setReplyContent("");
      setReplyingTo(null);
      setReplyKey(prev => prev + 1);
      fetchPost();
    }
    setSubmitting(false);
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!confirm("Eliminare questa risposta?")) return;
    const { error } = await supabase.from("forum_replies").delete().eq("id", replyId);
    if (error) { toast.error("Errore nell'eliminazione"); } else { toast.success("Risposta eliminata"); fetchPost(); }
  };

  const startEditingPost = () => {
    if (!post) return;
    setEditTitle(post.title); setEditContent(post.content); setIsEditingPost(true);
  };

  const handleUpdatePost = async () => {
    const textContent = stripHtml(editContent);
    try { postSchema.parse({ title: editTitle, content: textContent }); }
    catch (error) { if (error instanceof z.ZodError) { toast.error(error.errors[0].message); return; } }
    const profanityError = validateNoProfanity(editTitle, textContent);
    if (profanityError) { toast.error(profanityError); return; }
    const { error } = await supabase.from("forum_posts").update({ title: editTitle.trim(), content: editContent }).eq("id", post!.id);
    if (error) { toast.error("Errore nella modifica"); } else { toast.success("Post aggiornato"); setIsEditingPost(false); fetchPost(); }
  };

  const handleDeletePost = async () => {
    if (!confirm("Sei sicuro di voler eliminare questo post?")) return;
    const { error } = await supabase.from("forum_posts").delete().eq("id", post!.id);
    if (error) toast.error("Errore nell'eliminazione");
    else { toast.success("Post eliminato"); navigate("/forum"); }
  };

  const canEditPost = user?.id === post?.user_id || isAdmin;
  const canDeletePost = canEditPost || isAdmin;
  const cat = post ? categories[post.category] || { label: post.category, color: "bg-secondary text-muted-foreground" } : null;

  const topLevelReplies = replies.filter((r) => !r.parent_reply_id);
  const childRepliesMap = new Map<string, Reply[]>();
  replies.filter((r) => r.parent_reply_id).forEach((r) => {
    const existing = childRepliesMap.get(r.parent_reply_id!) || [];
    existing.push(r);
    childRepliesMap.set(r.parent_reply_id!, existing);
  });

  const renderReply = (reply: Reply, isChild = false) => (
    <div key={reply.id} className={`bg-card rounded-xl border border-border p-4 ${isChild ? "ml-8 border-l-2 border-l-primary/20" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center border border-border shrink-0 overflow-hidden">
          {reply.profile?.avatar_url ? (
            <img src={reply.profile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="font-display text-sm">{(reply.profile?.display_name || "?").charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-medium">
              {reply.profile?.username ? (
                <Link to={`/profilo/${reply.profile.username}`} className="hover:text-primary">{reply.profile.display_name || reply.profile.username}</Link>
              ) : (reply.profile?.display_name || "Anonimo")}
            </span>
            {isChild && (<span className="text-xs text-muted-foreground flex items-center gap-0.5"><CornerDownRight size={10} /> risposta</span>)}
            <span className="text-xs text-muted-foreground">{format(new Date(reply.created_at), "d MMM yyyy, HH:mm", { locale: it })}</span>
          </div>
          <div className="text-sm text-muted-foreground"><RichContentRenderer content={reply.content} /></div>
          <div className="flex items-center gap-3 mt-2">
            <button onClick={() => toggleReplyLike(reply.id)} disabled={likingReplyIds.has(reply.id)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
              <Heart size={14} className={userReplyLikes.has(reply.id) ? "fill-primary text-primary" : ""} />
              {(replyLikesCount[reply.id] || 0) > 0 && (<span className={userReplyLikes.has(reply.id) ? "text-primary font-medium" : ""}>{replyLikesCount[reply.id]}</span>)}
            </button>
            {user && !isChild && (
              <button
                onClick={() => {
                  setReplyingTo(reply);
                  setReplyContent(`<p>@${reply.profile?.username || ""} </p>`);
                  setReplyKey(prev => prev + 1);
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <ReplyIcon size={14} /> Rispondi
              </button>
            )}
          </div>
        </div>
        {(user?.id === reply.user_id || isAdmin) && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDeleteReply(reply.id)}>
            <Trash2 size={14} />
          </Button>
        )}
        {user && user.id !== reply.user_id && !(user?.id === reply.user_id || isAdmin) && (
          <ForumReportDialog replyId={reply.id}>
            <button className="p-1.5 rounded-lg text-orange-500/70 hover:text-orange-500 hover:bg-orange-500/10 transition-colors shrink-0" title="Segnala commento">
              <Flag size={15} />
            </button>
          </ForumReportDialog>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <Button variant="ghost" className="mb-6 gap-2" onClick={() => navigate("/forum")}>
            <ArrowLeft size={16} /> Torna al Forum
          </Button>

          {loading ? (
            <p className="text-muted-foreground text-center py-12">Caricamento...</p>
          ) : !post ? (
            <p className="text-muted-foreground text-center py-12">Post non trovato</p>
          ) : (
            <>
              <div className={`bg-card rounded-2xl border p-6 mb-8 ${post.category === "annunci_staff" ? "border-red-500/40 ring-1 ring-red-500/20" : "border-border"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat?.color}`}>{cat?.label}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(post.created_at), "d MMM yyyy, HH:mm", { locale: it })}</span>
                  </div>
                  {(canEditPost || canDeletePost) && !isEditingPost && (
                    <div className="flex items-center gap-1">
                      {canEditPost && (<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={startEditingPost}><Pencil size={14} /></Button>)}
                      {canDeletePost && (<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={handleDeletePost}><Trash2 size={14} /></Button>)}
                    </div>
                  )}
                  {user && user.id !== post?.user_id && !canEditPost && (
                    <ForumReportDialog postId={post?.id}>
                      <button className="p-1.5 rounded-lg text-orange-500/70 hover:text-orange-500 hover:bg-orange-500/10 transition-colors" title="Segnala post"><Flag size={16} /></button>
                    </ForumReportDialog>
                  )}
                </div>

                {isEditingPost ? (
                  <div className="space-y-3">
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-secondary border-border" placeholder="Titolo" />
                    <RichTextEditor
                      key={`edit-post-${isEditingPost}`}
                      initialContent={editContent}
                      onChange={setEditContent}
                      placeholder="Contenuto"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingPost(false)}>Annulla</Button>
                      <Button size="sm" onClick={handleUpdatePost}>Salva</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="font-display text-2xl md:text-3xl mb-4">{post.title}</h1>
                    {post.image_url && (<img src={post.image_url} alt="" className="w-full max-h-96 object-contain rounded-xl border border-border mb-4" />)}
                    <div className="text-muted-foreground"><RichContentRenderer content={post.content} /></div>
                  </>
                )}

                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center border border-border overflow-hidden">
                      {post.profile?.avatar_url ? (<img src={post.profile.avatar_url} alt="" className="w-full h-full object-cover" />) : (<span className="font-display text-sm">{(post.profile?.display_name || "?").charAt(0).toUpperCase()}</span>)}
                    </div>
                    <span>
                      di{" "}
                      {post.profile?.username ? (<Link to={`/profilo/${post.profile.username}`} className="text-foreground hover:text-primary">{post.profile.display_name || post.profile.username}</Link>) : (post.profile?.display_name || "Anonimo")}
                    </span>
                  </div>
                  <button onClick={togglePostLike} disabled={likingPost} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <Heart size={18} className={userLikedPost ? "fill-primary text-primary" : ""} />
                    {postLikeCount > 0 && (<span className={userLikedPost ? "text-primary font-medium" : ""}>{postLikeCount}</span>)}
                  </button>
                </div>
              </div>

              <h2 className="font-display text-lg mb-4 flex items-center gap-2"><MessageSquare size={18} /> {replies.length} Risposte</h2>

              <div className="space-y-3 mb-8">
                {topLevelReplies.map((reply) => (
                  <div key={reply.id}>
                    {renderReply(reply)}
                    {(childRepliesMap.get(reply.id) || []).map((child) => (<div key={child.id} className="mt-2">{renderReply(child, true)}</div>))}
                  </div>
                ))}
              </div>

              {user ? (
                <form onSubmit={handleReply} className="bg-card rounded-xl border border-border p-4">
                  {replyingTo && (
                    <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-secondary/50 rounded-lg text-sm">
                      <CornerDownRight size={14} className="text-primary shrink-0" />
                      <span className="text-muted-foreground">Rispondendo a <span className="text-foreground font-medium">{replyingTo.profile?.display_name || replyingTo.profile?.username || "Anonimo"}</span></span>
                      <Button type="button" variant="ghost" size="icon" className="h-5 w-5 ml-auto shrink-0" onClick={() => { setReplyingTo(null); setReplyContent(""); setReplyKey(prev => prev + 1); }}>
                        <span className="text-xs">✕</span>
                      </Button>
                    </div>
                  )}
                  <RichTextEditor
                    key={`reply-${replyKey}`}
                    initialContent={replyingTo ? `<p>@${replyingTo.profile?.username || ""} </p>` : ""}
                    onChange={setReplyContent}
                    placeholder="Scrivi una risposta... Usa @username per menzionare qualcuno"
                    className="mb-3"
                  />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={submitting} className="gap-2">
                      <Send size={16} />
                      {submitting ? "Invio..." : "Rispondi"}
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="text-center text-muted-foreground text-sm">
                  <Link to="/auth" className="text-primary hover:underline">Accedi</Link> per rispondere
                </p>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ForumPostDetail;
