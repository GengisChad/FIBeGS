import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FeedbackAttachment } from "@/components/FeedbackAttachment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Eye, CheckCircle, Send, RotateCcw, MessageSquare } from "lucide-react";
import AdminPagination, { useAdminPagination } from "@/components/admin/AdminPagination";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import ibnaLogo from "@/assets/ibna-logo-square.png";


const FeedbackAdminTab = () => {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [replyMsg, setReplyMsg] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [userReplyCounts, setUserReplyCounts] = useState<Record<string, number>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  const fetchFeedbacks = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false });
    const fbs = data ?? [];
    setFeedbacks(fbs);

    if (fbs.length > 0) {
      const fbIds = fbs.map((f: any) => f.id);

      // Fetch read statuses for this admin
      const { data: readData } = await supabase
        .from("ticket_read_status" as any)
        .select("ticket_id, last_read_at")
        .eq("user_id", user.id)
        .eq("ticket_type", "feedback")
        .in("ticket_id", fbIds);
      const readMap: Record<string, string> = {};
      if (readData) {
        for (const r of readData as any[]) {
          readMap[r.ticket_id] = r.last_read_at;
        }
      }

      // Fetch user (non-staff) replies with timestamps
      const { data: replyData } = await supabase
        .from("feedback_replies" as any)
        .select("feedback_id, created_at")
        .in("feedback_id", fbIds)
        .eq("is_staff", false);
      const counts: Record<string, number> = {};
      if (replyData) {
        for (const r of replyData as any[]) {
          const lastRead = readMap[r.feedback_id];
          if (!lastRead || new Date(r.created_at) > new Date(lastRead)) {
            counts[r.feedback_id] = (counts[r.feedback_id] || 0) + 1;
          }
        }
      }
      setUserReplyCounts(counts);
    }

    setLoading(false);
  };

  useEffect(() => { fetchFeedbacks(); }, []);

  const handleMarkRead = async (id: string) => {
    await supabase.from("feedback").update({ is_read: true }).eq("id", id);
    fetchFeedbacks();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("feedback").delete().eq("id", id);
    toast({ title: "Feedback eliminato" });
    setSelected(null);
    fetchFeedbacks();
  };

  const handleResolve = async (id: string) => {
    await supabase.from("feedback").update({ status: "resolved" } as any).eq("id", id);
    toast({ title: "Ticket segnato come risolto ✅" });
    setSelected((prev: any) => prev ? { ...prev, status: "resolved" } : null);
    fetchFeedbacks();
  };

  const handleReopen = async (id: string) => {
    await supabase.from("feedback").update({ status: "open" } as any).eq("id", id);
    toast({ title: "Ticket riaperto 🔄" });
    setSelected((prev: any) => prev ? { ...prev, status: "open" } : null);
    fetchFeedbacks();
  };

  const openDetail = async (fb: any) => {
    setSelected(fb);
    if (!fb.is_read) handleMarkRead(fb.id);
    fetchReplies(fb.id);
    // Mark as read
    if (user) {
      await supabase.from("ticket_read_status" as any).upsert({
        user_id: user.id,
        ticket_id: fb.id,
        ticket_type: "feedback",
        last_read_at: new Date().toISOString(),
      } as any, { onConflict: "user_id,ticket_id,ticket_type" });
      setUserReplyCounts(prev => { const n = { ...prev }; delete n[fb.id]; return n; });
    }
  };

  const fetchReplies = async (feedbackId: string) => {
    const { data } = await supabase
      .from("feedback_replies" as any)
      .select("*")
      .eq("feedback_id", feedbackId)
      .order("created_at", { ascending: true });
    setReplies((data as any[]) ?? []);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const sendReply = async () => {
    if (!user || !selected || !replyMsg.trim()) return;
    setSendingReply(true);
    const { error } = await supabase.from("feedback_replies" as any).insert({
      feedback_id: selected.id,
      user_id: user.id,
      message: replyMsg.trim(),
      is_staff: true,
    } as any);
    if (!error) {
      setReplyMsg("");
      fetchReplies(selected.id);
    }
    setSendingReply(false);
  };

  const [profiles, setProfiles] = useState<Record<string, string>>({});
  useEffect(() => {
    const userIds = [...new Set(feedbacks.map(f => f.user_id))];
    if (userIds.length === 0) return;
    supabase
      .from("profiles")
      .select("user_id, display_name, username")
      .in("user_id", userIds)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        data?.forEach(p => { map[p.user_id] = p.display_name || p.username || "Utente"; });
        setProfiles(map);
      });
  }, [feedbacks]);

  const { getPageItems } = useAdminPagination(feedbacks);
  const pagedFeedbacks = getPageItems(page);

  if (loading) return <p className="text-muted-foreground">Caricamento...</p>;

  const unreadCount = feedbacks.filter(f => !f.is_read).length;

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            Feedback ({feedbacks.length})
            {unreadCount > 0 && <Badge variant="destructive">{unreadCount} nuovi</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {feedbacks.length === 0 ? (
            <p className="text-muted-foreground">Nessun feedback ricevuto.</p>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden space-y-3">
                {pagedFeedbacks.map((fb) => (
                  <div
                    key={fb.id}
                    className={`rounded-xl border border-border p-3 space-y-2 ${!fb.is_read ? "bg-primary/5" : "bg-card"}`}
                    onClick={() => openDetail(fb)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate">{profiles[fb.user_id] || "..."}</span>
                      <Badge variant={(fb as any).status === "resolved" ? "secondary" : fb.is_read ? "outline" : "default"} className="text-[10px] shrink-0">
                        {(fb as any).status === "resolved" ? "✅ Risolto" : fb.is_read ? "Letto" : "Nuovo"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{fb.message}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(fb.created_at).toLocaleDateString("it-IT")}
                        {fb.attachment_url ? " 📎" : ""}
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs relative" onClick={(e) => { e.stopPropagation(); openDetail(fb); }}>
                          <Eye size={12} className="mr-1" /> Vedi
                          {(userReplyCounts[fb.id] || 0) > 0 && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-primary">
                              <MessageSquare size={10} />
                              <span className="bg-primary text-primary-foreground rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px] font-bold">
                                {userReplyCounts[fb.id]}
                              </span>
                            </span>
                          )}
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); handleDelete(fb.id); }}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block overflow-x-auto">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utente</TableHead>
                      <TableHead>Messaggio</TableHead>
                      <TableHead>📎</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedFeedbacks.map((fb) => (
                      <TableRow key={fb.id} className={!fb.is_read ? "bg-primary/5" : ""}>
                        <TableCell className="font-medium">{profiles[fb.user_id] || "..."}</TableCell>
                        <TableCell className="max-w-[250px] truncate">{fb.message}</TableCell>
                        <TableCell>{fb.attachment_url ? "📎" : "-"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(fb.created_at).toLocaleDateString("it-IT")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={(fb as any).status === "resolved" ? "secondary" : fb.is_read ? "outline" : "default"}>
                            {(fb as any).status === "resolved" ? "✅ Risolto" : fb.is_read ? "Letto" : "Nuovo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openDetail(fb)} className="relative">
                              <Eye size={14} className="mr-1" /> Vedi
                              {(userReplyCounts[fb.id] || 0) > 0 && (
                                <span className="ml-1.5 inline-flex items-center gap-0.5 text-primary">
                                  <MessageSquare size={12} />
                                  <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">
                                    {userReplyCounts[fb.id]}
                                  </span>
                                </span>
                              )}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(fb.id)}>
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <AdminPagination page={page} totalItems={feedbacks.length} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:justify-between">
              <span>Dettaglio Ticket</span>
              {selected && (selected as any).status !== "resolved" ? (
                <Button size="sm" variant="outline" onClick={() => handleResolve(selected.id)} className="text-green-500 border-green-500/30">
                  <CheckCircle size={14} className="mr-1" /> Segna risolto
                </Button>
              ) : selected && (
                <Button size="sm" variant="outline" onClick={() => handleReopen(selected.id)}>
                  <RotateCcw size={14} className="mr-1" /> Riapri ticket
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {/* Top: info */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                <span>Da: <strong className="text-foreground">{profiles[selected.user_id] || "Utente"}</strong></span>
                <span>•</span>
                <span>{new Date(selected.created_at).toLocaleString("it-IT")}</span>
                <span>•</span>
                <Badge variant={(selected as any).status === "resolved" ? "secondary" : "default"}>
                  {(selected as any).status === "resolved" ? "✅ Risolto" : "Aperto"}
                </Badge>
              </div>

              {/* Content: left text, right image */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground">Messaggio</h4>
                  <p className="whitespace-pre-wrap text-sm bg-secondary/50 rounded-lg p-3">{selected.message}</p>
                </div>
                {selected.attachment_url && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground">Allegato</h4>
                    <FeedbackAttachment attachment={selected.attachment_url} />
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
                          {r.is_staff ? "FIBeGS Staff" : profiles[r.user_id] || "Utente"}
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
                  <Button size="sm" onClick={sendReply} disabled={!replyMsg.trim() || sendingReply}>
                    <Send size={14} />
                  </Button>
                </div>
              </div>

              <Button variant="destructive" size="sm" onClick={() => handleDelete(selected.id)}>
                <Trash2 size={14} className="mr-1" /> Elimina ticket
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FeedbackAdminTab;
