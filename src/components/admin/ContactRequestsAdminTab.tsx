import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Mail, Check, Trash2, Eye, Send, Loader2 } from "lucide-react";
import AdminPagination, { useAdminPagination } from "@/components/admin/AdminPagination";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  read: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  resolved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const ContactRequestsAdminTab = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<any | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const fetchData = async () => {
    const { data } = await supabase
      .from("contact_requests" as any)
      .select("*")
      .order("created_at", { ascending: false });
    setRequests((data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const categories = useMemo(() => {
    const cats = [...new Set(requests.map((r: any) => r.category))];
    return ["Tutti", ...cats];
  }, [requests]);

  const [activeCategory, setActiveCategory] = useState("Tutti");

  const filtered = activeCategory === "Tutti" ? requests : requests.filter((r: any) => r.category === activeCategory);
  const { getPageItems } = useAdminPagination(filtered);
  const paged = getPageItems(page);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("contact_requests" as any).update({ status } as any).eq("id", id);
    fetchData();
    toast({ title: status === "resolved" ? "Risolto" : "Aggiornato" });
  };

  const deleteRequest = async (id: string) => {
    await supabase.from("contact_requests" as any).delete().eq("id", id);
    fetchData();
  };

  const openDetail = (r: any) => {
    setSelected(r);
    setReplyText("");
    if (r.status === "pending") {
      updateStatus(r.id, "read");
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selected) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("reply-contact-email", {
        body: {
          to: selected.email,
          name: selected.name,
          category: selected.category,
          originalMessage: selected.message,
          replyMessage: replyText.trim(),
        },
      });
      if (error) throw error;
      await updateStatus(selected.id, "resolved");
      toast({ title: "Risposta inviata", description: `Email inviata a ${selected.email}` });
      setSelected(null);
      setReplyText("");
    } catch (e: any) {
      toast({ title: "Errore", description: e.message || "Impossibile inviare la risposta", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">Caricamento...</p>;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2"><Mail size={20} /> Richieste di Contatto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 overflow-x-auto">
            <div className="flex gap-1.5 pb-2">
              {categories.map(cat => (
                <Button
                  key={cat}
                  size="sm"
                  variant={activeCategory === cat ? "default" : "outline"}
                  onClick={() => { setActiveCategory(cat); setPage(0); }}
                  className="text-xs shrink-0"
                >
                  {cat}
                  {cat !== "Tutti" && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                      {requests.filter((r: any) => r.category === cat).length}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nessuna richiesta di contatto.</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {paged.map((r: any) => (
                  <div key={r.id} className="p-4 rounded-lg border border-border bg-secondary/30 space-y-2 cursor-pointer hover:bg-secondary/50 transition-colors" onClick={() => openDetail(r)}>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">{r.category}</Badge>
                      <Badge variant="outline" className={`text-xs ${statusColors[r.status] || ""}`}>
                        {r.status === "pending" ? "In attesa" : r.status === "read" ? "Letto" : "Risolto"}
                      </Badge>
                    </div>
                    <p className="font-semibold text-sm">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{r.message}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("it-IT")}</p>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Messaggio</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((r: any) => (
                      <TableRow key={r.id} className="cursor-pointer hover:bg-secondary/30" onClick={() => openDetail(r)}>
                        <TableCell><Badge variant="outline" className="text-xs">{r.category}</Badge></TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-primary text-sm">{r.email}</TableCell>
                        <TableCell className="max-w-[300px]">
                          <p className="text-sm text-muted-foreground truncate">{r.message}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${statusColors[r.status] || ""}`}>
                            {r.status === "pending" ? "In attesa" : r.status === "read" ? "Letto" : "Risolto"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(r.created_at).toLocaleDateString("it-IT")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openDetail(r)}>
                              <Eye size={14} />
                            </Button>
                            {r.status !== "resolved" && (
                              <Button size="sm" onClick={() => updateStatus(r.id, "resolved")}>Risolvi</Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => deleteRequest(r.id)}>
                              <Trash2 size={14} className="text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <AdminPagination page={page} totalItems={filtered.length} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail + Reply Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Mail size={18} />
                  {selected.category}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Sender info */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{selected.name}</p>
                    <p className="text-sm text-muted-foreground">{selected.email}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={`text-xs ${statusColors[selected.status] || ""}`}>
                      {selected.status === "pending" ? "In attesa" : selected.status === "read" ? "Letto" : "Risolto"}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(selected.created_at).toLocaleString("it-IT")}
                    </p>
                  </div>
                </div>

                {/* Original message */}
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Messaggio ricevuto</p>
                  <p className="text-sm whitespace-pre-wrap">{selected.message}</p>
                </div>

                {/* Reply area */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Rispondi da info@ibna.it
                  </p>
                  <Textarea
                    placeholder="Scrivi la tua risposta..."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    rows={5}
                    className="resize-none"
                  />
                </div>
              </div>

              <DialogFooter className="flex gap-2 sm:gap-0">
                {selected.status !== "resolved" && (
                  <Button variant="outline" onClick={() => { updateStatus(selected.id, "resolved"); setSelected(null); }}>
                    <Check size={14} className="mr-1" /> Segna risolto
                  </Button>
                )}
                <Button onClick={sendReply} disabled={!replyText.trim() || sending}>
                  {sending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Send size={14} className="mr-1" />}
                  Invia risposta
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ContactRequestsAdminTab;
