import { Calendar, MapPin, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

const fetchEvents = async () => {
  const now = new Date().toISOString();
  const [upRes, recentRes] = await Promise.all([
    supabase.from("tournaments").select("id, title, city, event_date, max_participants, status").gte("event_date", now).eq("is_active", true).or("event_type.eq.tournament,event_type.is.null").order("event_date", { ascending: true }).limit(3),
    supabase.from("tournaments").select("id, title, city, event_date, max_participants, status").lt("event_date", now).eq("is_active", true).or("event_type.eq.tournament,event_type.is.null").order("event_date", { ascending: false }).limit(2),
  ]);
  return { upcoming: upRes.data ?? [], recent: recentRes.data ?? [] };
};

export const IBNAEventsWidget = () => {
  const { data, isLoading: loading } = useQuery({
    queryKey: ["homepage-events-widget"],
    queryFn: fetchEvents,
    staleTime: 5 * 60 * 1000,
  });

  const upcoming = data?.upcoming ?? [];
  const recent = data?.recent ?? [];

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6"><div className="h-32 animate-pulse bg-muted rounded-lg" /></CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" /> Eventi & Tornei
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {upcoming.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prossimi</h4>
            {upcoming.map((t) => (
              <Link key={t.id} to={`/tournaments/${t.id}`} className="block p-3 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors border border-primary/20">
                <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">{t.title}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(t.event_date), "d MMM yyyy", { locale: it })}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{t.city}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {recent.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recenti</h4>
            {recent.map((t) => (
              <Link key={t.id} to={`/tournaments/${t.id}`} className="block p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <p className="text-xs font-medium text-foreground/80 line-clamp-1">{t.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <span>{format(new Date(t.event_date), "d MMM yyyy", { locale: it })}</span>
                  <span>•</span>
                  <span>{t.city}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {upcoming.length === 0 && recent.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nessun torneo disponibile</p>
        )}

        <Link to="/tournaments" className="block mt-4">
          <Button variant="outline" size="sm" className="w-full gap-2">Tutti i tornei<ChevronRight className="h-3 w-3" /></Button>
        </Link>
      </CardContent>
    </Card>
  );
};
