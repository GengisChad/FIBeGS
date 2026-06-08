import { Link, Navigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { FindTeamPanel } from "@/components/teams/FindTeamPanel";
import { useAuth } from "@/hooks/useAuth";

const FindTeamPage = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-6 max-w-2xl flex flex-col" style={{ minHeight: "calc(100vh - 200px)" }}>
        <Button asChild variant="outline" size="sm" className="gap-1 mb-4 self-start">
          <Link to="/squadra"><ChevronLeft size={16} /> Torna a Squadra</Link>
        </Button>
        <h1 className="text-2xl font-bold mb-4">Trova una Team</h1>
        <div className="flex-1 min-h-0">
          <FindTeamPanel scrollClassName="h-[60vh]" />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default FindTeamPage;
