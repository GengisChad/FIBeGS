import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { BetaBadge } from "@/features/rpg/components/BetaBadge";
import { RpgApp } from "@/features/rpg/RpgApp";
import { Gamepad2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const BetaRpg = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!authLoading && !adminLoading && (!user || !isAdmin)) navigate("/", { replace: true });
  }, [user, isAdmin, authLoading, adminLoading, navigate]);

  if (authLoading || adminLoading) {
    return <div className="flex min-h-[100svh] items-center justify-center bg-background text-muted-foreground">Caricamento...</div>;
  }
  if (!user || !isAdmin) return null;

  if (isMobile) {
    return (
      <div className="min-h-[100svh] bg-black text-foreground">
        <RpgApp />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="mb-6 flex items-center gap-3">
          <Gamepad2 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">BEY-Tokon</h1>
          <BetaBadge />
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <RpgApp />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default BetaRpg;
