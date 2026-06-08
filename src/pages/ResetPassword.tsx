import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash") || hashParams.get("token_hash");
        const type = url.searchParams.get("type") || hashParams.get("type");
        const errorDescription = url.searchParams.get("error_description") || hashParams.get("error_description");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (errorDescription) {
          if (mounted) setErrorMessage(decodeURIComponent(errorDescription));
        }

        // 1) PKCE flow: ?code=...
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && mounted) {
            setIsValidSession(true);
            // Clean URL
            window.history.replaceState({}, "", window.location.pathname);
          } else if (error && mounted) {
            setErrorMessage(error.message);
          }
        }
        // 2) OTP token_hash flow: ?token_hash=...&type=recovery
        else if (tokenHash && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
          if (!error && mounted) {
            setIsValidSession(true);
            window.history.replaceState({}, "", window.location.pathname);
          } else if (error && mounted) {
            setErrorMessage(error.message);
          }
        }
        // 3) Implicit flow: #access_token=...&type=recovery
        else if (accessToken && refreshToken && type === "recovery") {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (!error && mounted) {
            setIsValidSession(true);
            window.history.replaceState({}, "", window.location.pathname);
          } else if (error && mounted) {
            setErrorMessage(error.message);
          }
        }
        // 4) Already-handled session (e.g. SDK auto-detected)
        else {
          const { data } = await supabase.auth.getSession();
          if (data.session && mounted) {
            setIsValidSession(true);
          }
        }
      } finally {
        if (mounted) setChecking(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && mounted) {
        setIsValidSession(true);
        setChecking(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("La password deve avere almeno 6 caratteri");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Le password non coincidono");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        if (error.message.toLowerCase().includes("leaked") || error.message.toLowerCase().includes("breach") || error.message.toLowerCase().includes("pwned") || error.message.toLowerCase().includes("compromised")) {
          toast.error("Questa password risulta compromessa in un data breach noto. Scegli una password diversa e più sicura.");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success("Password aggiornata con successo!");
        navigate("/");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">Verifica del link in corso…</p>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <h1 className="font-display text-2xl mb-4">Link non valido</h1>
          <p className="text-muted-foreground mb-6">
            {errorMessage || "Questo link di recupero non è valido o è scaduto."}
          </p>
          <Button onClick={() => navigate("/auth")}>Torna al login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <Button variant="ghost" className="mb-6" onClick={() => navigate("/auth")}>
          <ArrowLeft size={18} className="mr-2" />
          Torna al login
        </Button>

        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl tracking-wider">NUOVA PASSWORD</h1>
            <p className="text-muted-foreground mt-2">Inserisci la tua nuova password</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nuova password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-secondary border-border pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Conferma password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-secondary border-border"
              />
            </div>

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full mt-6"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Caricamento..." : "Aggiorna password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
