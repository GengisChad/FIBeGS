import { Calendar, ChevronRight, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";

const categoryLabels: Record<string, string> = {
  strategia: "Strategia",
  tornei: "Tornei",
  generale: "Generale",
  mercato: "Mercato",
  guide: "Guide",
  annunci_staff: "Annunci Staff",
};

const fetchLatestPosts = async () => {
  const { data } = await supabase
    .from("forum_posts")
    .select("id, title, content, category, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  return data || [];
};

export const NewsSection = () => {
  const { data: posts = [], isLoading: loading } = useQuery({
    queryKey: ["homepage-news"],
    queryFn: fetchLatestPosts,
    staleTime: 15 * 60 * 1000, // 15 min - forum posts don't change that fast
  });

  return (
    <section id="news">
      <div className="flex items-end justify-between mb-6 gap-3 flex-wrap">
        <div>
          <span className="text-primary font-medium uppercase tracking-[0.3em] text-xs">
            Ultime dal Forum
          </span>
          <h2 className="font-display text-3xl md:text-4xl tracking-wide mt-2">
            NEWS & <span className="gradient-text">DISCUSSIONI</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Annunci ufficiali, strategie e discussioni della community FIB.
          </p>
        </div>
        <Link to="/forum" className="shrink-0">
          <Button variant="outline" size="sm" className="gap-2 border-border hover:border-primary/50">
            Vai al forum
            <ChevronRight size={16} />
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center text-muted-foreground py-8 text-sm">Caricamento...</div>
        ) : posts.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm">Nessun post ancora.</div>
        ) : (
          posts.map((post) => {
            const isStaffAnnouncement = post.category === "annunci_staff";
            return (
              <Link
                key={post.id}
                to={`/forum/${post.id}`}
                className={`block glass-card glass-shine p-3 sm:p-4 group cursor-pointer overflow-hidden ${
                  isStaffAnnouncement ? "ring-1 ring-red-500/30" : ""
                }`}
              >

                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                      isStaffAnnouncement
                        ? "bg-red-500/20 text-red-400"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {isStaffAnnouncement && <Megaphone size={10} className="inline mr-1" />}
                    {categoryLabels[post.category] || post.category}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Calendar size={10} />
                    {format(new Date(post.created_at), "d MMM yyyy", { locale: it })}
                  </span>
                </div>
                <h3 className="font-display text-base mb-1 group-hover:text-primary transition-colors truncate">
                  {post.title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-1 break-words">
                  {post.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')}
                </p>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
};
