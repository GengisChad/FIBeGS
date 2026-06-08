import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { CreateTeamForm } from "@/components/teams/CreateTeamForm";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

const CreateTeamPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <Button asChild variant="outline" size="sm" className="gap-1 mb-4">
          <Link to="/squadra"><ChevronLeft size={16} /> Torna a Squadra</Link>
        </Button>
        <h1 className="text-2xl font-bold mb-4">Crea una Team</h1>
        <CreateTeamForm
          onCancel={() => navigate("/squadra")}
          onDone={() => navigate("/squadra")}
        />
      </main>
      <Footer />
    </div>
  );
};

export default CreateTeamPage;
