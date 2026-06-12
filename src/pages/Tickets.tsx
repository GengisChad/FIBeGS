import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { FeedbackAttachment } from "@/components/FeedbackAttachment";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Send, CheckCircle, ArrowLeft, MessageSquare, Flag, RotateCcw, Eye, ExternalLink, ShoppingBag, MessageCircle, Swords, Image } from "lucide-react";
import { DeckCard } from "@/components/decks/DeckCard";
import { toast } from "@/hooks/use-toast";
import ibnaLogo from "@/assets/ibna-logo-square.png";

type TabType = "feedback" | "reports";
type SelectedType = { kind: "feedback"; data: any } | { kind: "report"; data: any; source: string } | null;

const ReportedContentCard = ({ source, data }: { source: string; data: any }) => {
  const content = data._content;
  if (!content) {
    return (
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-muted-foreground">Contenuto segnalato</h4>
        <div className="text-sm bg-secondary/50 rounded-lg p-3 text-muted-foreground italic">
          Contenuto eliminato o non disponibile
        </div>
      </div>
    );
  }

  const linkMap: Record<string, string> = {
    market: "/market",
    forum: content.type === "reply" ? `/forum` : data.post_id ? `/forum/${data.post_id}` : "/forum",
    deck: "/decks",
  };
  const link = linkMap[source] || "#";

  return (
    <div className="space-y-1">
      <h4 className="text-sm font-semibold text-muted-foreground">Contenuto segnalato</h4>
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-3 space-y-2">
          {/* Header with source icon and author */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {source === "market" && <ShoppingBag size={13} />}
            {source === "forum" && <MessageCircle size={13} />}
            {source === "deck" && <Swords size={13} />}
            <span className="font-medium">{content._authorName}</span>
          </div>

          {/* Content preview */}
          {source === "market" && (
            <div className="flex gap-3 items-start">
              {content.image_url && (
                <img src={content.image_url} alt="" className="w-14 h-14 rounded-md object-cover flex-shrink-0 border border-border" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{content.product_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {content.price != null && <span className="text-xs font-semibold text-primary">€{content.price}</span>}
                  <Badge variant="outline" className="text-[10px] h-4">{content.condition}</Badge>
                </div>
              </div>
            </div>
          )}

          {source === "forum" && content.type === "post" && (
            <div className="space-y-1">
              <p className="text-sm font-medium line-clamp-1">{content.title}</p>
              {content.image_url && (
                <img src={content.image_url} alt="" className="w-full max-h-24 rounded-md object-cover border border-border" />
              )}
              <p className="text-xs text-muted-foreground line-clamp-2">{content.content}</p>
              <Badge variant="outline" className="text-[10px] h-4">{content.category}</Badge>
            </div>
          )}

          {source === "forum" && content.type === "reply" && (
            <div className="space-y-1">
              <p className="text-xs italic text-muted-foreground">Commento:</p>
              <p className="text-sm line-clamp-3 bg-secondary/50 rounded p-2">{content.content}</p>
            </div>
          )}

          {source === "deck" && content && (
            <DeckCard
              deck={{
                id: data.deck_id,
                user_id: content.user_id,
                name: content.name,
                description: content.description || null,
                created_at: data.created_at,
              }}
              profile={{ display_name: content._authorName, username: null, avatar_url: null }}
              compact
            />
          )}

          {/* Link to content */}
          <Link to={link} className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
            <ExternalLink size={11} /> Vai al contenuto
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

const Tickets = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabType>("feedback");
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedType>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [replyMsg, setReplyMsg] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [fbRes, marketRes, forumRes, deckRes] = await Promise.all([
      supabase.from("feedback").select("id, user_id, message, status, is_read, attachment_url, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("market_reports").select("*, market_listings(product_name, image_url, price, condition, user_id)").eq("reporter_id", user.id).order("created_at", { ascending: false }),
      supabase.from("forum_reports").select("*, forum_posts(title, content, image_url, user_id, category), forum_replies(content, user_id)").eq("reporter_id", user.id).order("created_at", { ascending: false }),
      supabase.from("deck_reports").select("*, decks(name, description, user_id)").eq("reporter_id", user.id).order("created_at", { ascending: false }),
    ]);
    setFeedbacks(fbRes.data ?? []);

    // Collect all user_ids from reported content to fetch display names
    const contentUserIds = new Set<string>();
    for (const r of (marketRes.data ?? [])) if (r.market_listings?.user_id) contentUserIds.add(r.market_listings.user_id);
    for (const r of (forumRes.data ?? [])) {
      if (r.forum_posts?.user_id) contentUserIds.add(r.forum_posts.user_id);
      if (r.forum_replies?.user_id) contentUserIds.add(r.forum_replies.user_id);
    }
    for (const r of (deckRes.data ?? [])) if (r.decks?.user_id) contentUserIds.add(r.decks.user_id);

    let profileMap: Record<string, string> = {};
    if (contentUserIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", Array.from(contentUserIds));
      if (profiles) {
        for (const p of profiles) {
          profileMap[p.user_id] = p.display_name || p.username || "Utente";
        }
      }
    }

    const allReports = [
      ...(marketRes.data ?? []).map(r => ({
        ...r, _source: "market",
        _target: r.market_listings?.product_name || "Eliminato",
        _content: r.market_listings ? { ...r.market_listings, _authorName: profileMap[r.market_listings.user_id] || "Utente" } : null,
      })),
      ...(forumRes.data ?? []).map(r => {
        const isReply = !!r.reply_id;
        return {
          ...r, _source: "forum",
          _target: isReply ? (r.forum_replies?.content?.substring(0, 60) || "Commento") : (r.forum_posts?.title || "Post eliminato"),
          _content: isReply
            ? (r.forum_replies ? { type: "reply" as const, ...r.forum_replies, _authorName: profileMap[r.forum_replies.user_id] || "Utente" } : null)
            : (r.forum_posts ? { type: "post" as const, ...r.forum_posts, _authorName: profileMap[r.forum_posts.user_id] || "Utente" } : null),
        };
      }),
      ...(deckRes.data ?? []).map(r => ({
        ...r, _source: "deck",
        _target: r.decks?.name || "Deck eliminato",
        _content: r.decks ? { ...r.decks, _authorName: profileMap[r.decks.user_id] || "Utente" } : null,
      })),
    ];

    allReports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setReports(allReports);

    // Fetch all read statuses for this user
    const allTicketIds = [
      ...(fbRes.data ?? []).map((f: any) => f.id),
      ...allReports.map(r => r.id),
    ];
    const readMap: Record<string, string> = {};
    if (allTicketIds.length > 0) {
      const { data: readData } = await supabase
        .from("ticket_read_status" as any)
        .select("ticket_id, last_read_at")
        .eq("user_id", user.id)
        .in("ticket_id", allTicketIds);
      if (readData) {
        for (const r of readData as any[]) {
          readMap[r.ticket_id] = r.last_read_at;
        }
      }
    }

    const counts: Record<string, number> = {};

    // Count unread staff replies for feedbacks
    if (fbRes.data && fbRes.data.length > 0) {
      const fbIds = fbRes.data.map((f: any) => f.id);
      const { data: fbReplies } = await supabase
        .from("feedback_replies" as any)
        .select("feedback_id, created_at")
        .in("feedback_id", fbIds)
        .eq("is_staff", true);
      if (fbReplies) {
        for (const r of fbReplies as any[]) {
          const lastRead = readMap[r.feedback_id];
          if (!lastRead || new Date(r.created_at) > new Date(lastRead)) {
            counts[`fb-${r.feedback_id}`] = (counts[`fb-${r.feedback_id}`] || 0) + 1;
          }
        }
      }
    }

    // Count unread staff replies for reports
    const allReportIds = allReports.map(r => r.id);
    if (allReportIds.length > 0) {
      const { data: repReplies } = await supabase
        .from("report_replies" as any)
        .select("report_id, created_at")
        .in("report_id", allReportIds)
        .eq("is_staff", true);
      if (repReplies) {
        for (const r of repReplies as any[]) {
          const lastRead = readMap[r.report_id];
          if (!lastRead || new Date(r.created_at) > new Date(lastRead)) {
            counts[`rp-${r.report_id}`] = (counts[`rp-${r.report_id}`] || 0) + 1;
          }
        }
      }
    }
    setUnreadCounts(counts);
    setLoading(false);
  };

  const markTicketRead = async (ticketId: string, ticketType: string) => {
    if (!user) return;
    await supabase.from("ticket_read_status" as any).upsert({
      user_id: user.id,
      ticket_id: ticketId,
      ticket_type: ticketType,
      last_read_at: new Date().toISOString(),
    } as any, { onConflict: "user_id,ticket_id,ticket_type" });
  };

  const openFeedback = async (ticket: any) => {
    setSelected({ kind: "feedback", data: ticket });
    const { data } = await supabase
      .from("feedback_replies" as any)
      .select("*")
      .eq("feedback_id", ticket.id)
      .order("created_at", { ascending: true });
    setReplies((data as any[]) ?? []);
    await markTicketRead(ticket.id, "feedback");
    setUnreadCounts(prev => { const n = { ...prev }; delete n[`fb-${ticket.id}`]; return n; });
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const openReport = async (report: any) => {
    setSelected({ kind: "report", data: report, source: report._source });
    const { data } = await supabase
      .from("report_replies" as any)
      .select("*")
      .eq("report_id", report.id)
      .eq("report_source", report._source)
      .order("created_at", { ascending: true });
    setReplies((data as any[]) ?? []);
    await markTicketRead(report.id, "report");
    setUnreadCounts(prev => { const n = { ...prev }; delete n[`rp-${report.id}`]; return n; });
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const sendReply = async () => {
    if (!user || !selected || !replyMsg.trim()) return;
    setSending(true);
    if (selected.kind === "feedback") {
      await supabase.from("feedback_replies" as any).insert({
        feedback_id: selected.data.id,
        user_id: user.id,
        message: replyMsg.trim(),
        is_staff: false,
      } as any);
      setReplyMsg("");
      const { data } = await supabase
        .from("feedback_replies" as any)
        .select("*")
        .eq("feedback_id", selected.data.id)
        .order("created_at", { ascending: true });
      setReplies((data as any[]) ?? []);
    } else {
      await supabase.from("report_replies" as any).insert({
        report_id: selected.data.id,
        report_source: selected.source,
        user_id: user.id,
        message: replyMsg.trim(),
        is_staff: false,
      } as any);
      setReplyMsg("");
      const { data } = await supabase
        .from("report_replies" as any)
        .select("*")
        .eq("report_id", selected.data.id)
        .eq("report_source", selected.source)
        .order("created_at", { ascending: true });
      setReplies((data as any[]) ?? []);
    }
    setSending(false);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const resolveTicket = async () => {
    if (!selected) return;
    if (selected.kind === "feedback") {
      await supabase.from("feedback").update({ status: "resolved" } as any).eq("id", selected.data.id);
    } else {
      const table = selected.source === "market" ? "market_reports" : selected.source === "forum" ? "forum_reports" : "deck_reports";
      await supabase.from(table).update({ status: "resolved" }).eq("id", selected.data.id);
    }
    toast({ title: "Ticket segnato come risolto ✅" });
    setSelected((prev) => prev ? { ...prev, data: { ...prev.data, status: "resolved" } } : null);
    fetchData();
  };

  const reopenTicket = async () => {
    if (!selected) return;
    if (selected.kind === "feedback") {
      await supabase.from("feedback").update({ status: "open" } as any).eq("id", selected.data.id);
    } else {
      const table = selected.source === "market" ? "market_reports" : selected.source === "forum" ? "forum_reports" : "deck_reports";
      await supabase.from(table).update({ status: "pending" }).eq("id", selected.data.id);
    }
    toast({ title: "Ticket riaperto 🔄" });
    setSelected((prev) => prev ? { ...prev, data: { ...prev.data, status: selected.kind === "feedback" ? "open" : "pending" } } : null);
    fetchData();
  };

  if (!user) return null;

  const items = tab === "feedback" ? feedbacks : reports;
  const selectedData = selected?.data;
  const isResolved = selectedData?.status === "resolved";
  const sourceLabel = (s: string) => s === "market" ? "🛒 Market" : s === "forum" ? "💬 Forum" : "🎯 Deck";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">I miei Ticket</h1>
        </div>

        {/* Tab switch */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={tab === "feedback" ? "default" : "outline"}
            onClick={() => setTab("feedback")}
            className="gap-2"
          >
            <MessageSquare size={16} /> Feedback ({feedbacks.length})
          </Button>
          <Button
            variant={tab === "reports" ? "default" : "outline"}
            onClick={() => setTab("reports")}
            className="gap-2"
          >
            <Flag size={16} /> Segnalazioni ({reports.length})
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Caricamento...</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground">Nessun ticket in questa categoria.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item: any) => {
              const key = tab === "feedback" ? `fb-${item.id}` : `rp-${item.id}`;
              const staffMsgCount = unreadCounts[key] || 0;
              return (
                <Card
                  key={`${item._source || "fb"}-${item.id}`}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => tab === "feedback" ? openFeedback(item) : openReport(item)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {tab === "reports" && (
                          <Badge variant="outline" className="mb-1 text-[10px]">{sourceLabel(item._source)}</Badge>
                        )}
                        <p className="text-sm truncate font-medium">
                          {tab === "feedback" ? item.message : `${item._target} — ${item.reason}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(item.created_at).toLocaleDateString("it-IT")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {staffMsgCount > 0 && (
                          <span className="relative inline-flex items-center gap-1 text-xs font-medium text-primary">
                            <MessageSquare size={14} />
                            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                              {staffMsgCount}
                            </span>
                          </span>
                        )}
                        <Badge variant={
                          (item.status === "resolved" || item.status === "reviewed" || item.status === "dismissed") ? "secondary" : "default"
                        }>
                          {item.status === "resolved" ? "✅ Risolto" : item.status === "dismissed" ? "Archiviata" : item.status === "pending" ? "In attesa" : "Aperto"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      <Footer />

      {/* Ticket detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Dettaglio Ticket</span>
              {selected && !isResolved ? (
                <Button size="sm" variant="outline" onClick={resolveTicket} className="text-green-500 border-green-500/30">
                  <CheckCircle size={14} className="mr-1" /> Segna risolto
                </Button>
              ) : selected && (
                <Button size="sm" variant="outline" onClick={reopenTicket}>
                  <RotateCcw size={14} className="mr-1" /> Riapri ticket
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {selected && selectedData && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                {selected.kind === "report" && (
                  <><Badge variant="outline">{sourceLabel(selected.source)}</Badge><span>•</span></>
                )}
                <span>{new Date(selectedData.created_at).toLocaleString("it-IT")}</span>
                <span>•</span>
                <Badge variant={isResolved ? "secondary" : "default"}>
                  {isResolved ? "✅ Risolto" : selectedData.status === "pending" ? "In attesa" : "Aperto"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground">
                    {selected.kind === "feedback" ? "Messaggio" : "Motivo segnalazione"}
                  </h4>
                  <p className="whitespace-pre-wrap text-sm bg-secondary/50 rounded-lg p-3">
                    {selected.kind === "feedback" ? selectedData.message : selectedData.reason}
                  </p>
                  {selected.kind === "report" && (
                    <ReportedContentCard source={selected.source} data={selectedData} />
                  )}
                </div>
                {selected.kind === "feedback" && selectedData.attachment_url && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground">Allegato</h4>
                    <FeedbackAttachment attachment={selectedData.attachment_url} />
                  </div>
                )}
              </div>

              {/* Chat */}
              <div className="border-t border-border pt-3">
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">Chat</h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {replies.length === 0 && <p className="text-xs text-muted-foreground">Nessun messaggio ancora.</p>}
                  {replies.map((r: any) => (
                    <div key={r.id} className={`flex gap-2 ${r.is_staff ? "justify-start" : "justify-end"}`}>
                      {r.is_staff && (
                        <img src={ibnaLogo} alt="FIBeGS" className="w-6 h-6 rounded-full flex-shrink-0 mt-1" />
                      )}
                      <div className={`rounded-lg px-3 py-2 text-sm max-w-[80%] ${r.is_staff ? "bg-primary/10 text-foreground" : "bg-secondary text-foreground"}`}>
                        <p className="text-[10px] font-semibold mb-0.5 text-muted-foreground">
                          {r.is_staff ? "FIBeGS Staff" : "Tu"}
                        </p>
                        <p className="whitespace-pre-wrap">{r.message}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="flex gap-2 mt-2">
                  <Textarea
                    placeholder="Rispondi..."
                    value={replyMsg}
                    onChange={(e) => setReplyMsg(e.target.value)}
                    rows={2}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={sendReply} disabled={!replyMsg.trim() || sending}>
                    <Send size={14} />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tickets;
