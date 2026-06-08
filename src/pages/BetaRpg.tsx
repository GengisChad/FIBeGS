import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { BetaBadge } from "@/features/rpg/components/BetaBadge";
import { RpgApp } from "@/features/rpg/RpgApp";
import { Gamepad2 } from "lucide-react";

const BetaRpg = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !adminLoading && (!user || !isAdmin)) navigate("/", { replace: true });
  }, [user, isAdmin, authLoading, adminLoading, navigate]);

  if (authLoading || adminLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Caricamento...</div>;
  }
  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="flex items-center gap-3 mb-6">
          <Gamepad2 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">BEY-Tōkon</h1>
          <BetaBadge />
        </div>
        <RpgApp />
      </div>
      <Footer />
    </div>
  );
};

export default BetaRpg;
