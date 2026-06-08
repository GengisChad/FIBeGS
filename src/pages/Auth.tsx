import { useState, useEffect, useMemo } from "react";
import { useRegions } from "@/hooks/useCachedQuery";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import { Eye, EyeOff, ArrowLeft, ShieldCheck, LifeBuoy } from "lucide-react";
import { CityCombobox } from "@/components/CityCombobox";
import { openOAuthInBrowser } from "@/hooks/useCapacitorAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CredentialHelpDialog from "@/components/auth/CredentialHelpDialog";
import PasskeyLoginButton from "@/components/auth/PasskeyLoginButton";
import { checkDeviceForSignup } from "@/lib/passkeys";

interface Region {
  id: string;
  name: string;
}

const authSchema = z.object({
  email: z.string().email("Email non valida").max(255, "Email troppo lunga"),
  password: z.string().min(6, "Password deve avere almeno 6 caratteri").max(100, "Password troppo lunga"),
  username: z.string().min(3, "Username deve avere almeno 3 caratteri").max(30, "Username troppo lungo").regex(/^[a-zA-Z0-9_]+$/, "Solo lettere, numeri e underscore").optional(),
});

const generateCaptcha = () => {
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  return { a, b, answer: a + b };
};

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [city, setCity] = useState("");
  const [regionId, setRegionId] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; username?: string; confirmPassword?: string; captcha?: string }>({});
  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [captchaInput, setCaptchaInput] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/", { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Use cached regions instead of separate query
  const { data: cachedRegions } = useRegions();
  useEffect(() => {
    if (cachedRegions) setRegions(cachedRegions as any);
  }, [cachedRegions]);

  const resetCaptcha = () => {
    setCaptcha(generateCaptcha());
    setCaptchaInput("");
  };

  const validateForm = () => {
    const fieldErrors: typeof errors = {};

    try {
      if (isForgotPassword) {
        // Accept either email or username
        if (!email.trim()) {
          fieldErrors.email = "Inserisci email o username";
        } else {
          setErrors({});
          return true;
        }
      }
      if (isLogin) {
        // Login: accept email or username (just check not empty)
        if (!email.trim()) fieldErrors.email = "Inserisci email o username";
        z.object({ password: z.string().min(6, "Password deve avere almeno 6 caratteri") }).parse({ password });
      } else {
        authSchema.parse({
          email,
          password,
          username: username,
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof typeof errors] = err.message;
          }
        });
      }
    }

    if (!isLogin) {
      if (password !== confirmPassword) {
        fieldErrors.confirmPassword = "Le password non corrispondono";
      }
      if (birthDate) {
        const birth = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
        if (age < 14) {
          fieldErrors.email = "Devi avere almeno 14 anni per registrarti";
        }
      } else {
        fieldErrors.email = "La data di nascita è obbligatoria";
      }
      if (!regionId) {
        fieldErrors.email = fieldErrors.email || "La regione è obbligatoria";
      }
      if (!city.trim()) {
        fieldErrors.email = fieldErrors.email || "La città è obbligatoria";
      }
      if (parseInt(captchaInput) !== captcha.answer) {
        fieldErrors.captcha = "Risposta errata, riprova";
        resetCaptcha();
      }
    }

    setErrors(fieldErrors);
    return Object.keys(fieldErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      if (isForgotPassword) {
        // Resolve username -> email if input is not an email address
        let recoveryEmail = email.trim();
        if (!recoveryEmail.includes("@")) {
          const { data: resolvedEmail, error: rpcError } = await supabase.rpc(
            "get_email_by_username" as any,
            { _username: recoveryEmail }
          );
          if (rpcError || !resolvedEmail) {
            toast.error("Username non trovato. Inserisci la tua email o uno username valido.");
            return;
          }
          recoveryEmail = resolvedEmail as string;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Email di recupero inviata! Controlla la casella di posta associata al tuo account.");
          setIsForgotPassword(false);
        }
        return;
      }

      if (isLogin) {
        let loginEmail = email;
        // If input doesn't look like an email, treat it as username
        if (!email.includes("@")) {
          const trimmedUsername = email.trim();
          // Use security definer function to resolve email from username (works without auth)
          const { data: resolvedEmail, error: rpcError } = await supabase.rpc("get_email_by_username" as any, { _username: trimmedUsername });
          if (rpcError || !resolvedEmail) {
            toast.error("Username non trovato. Controlla di aver scritto correttamente il tuo username.");
            return;
          }
          loginEmail = resolvedEmail as string;
        }
        const { error } = await signIn(loginEmail, password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast.error("Email/username o password non corretti");
          } else if (error.message.toLowerCase().includes("leaked") || error.message.toLowerCase().includes("breach") || error.message.toLowerCase().includes("pwned") || error.message.toLowerCase().includes("compromised")) {
            toast.error("Questa password è stata compromessa in un data breach. Per sicurezza, reimpostala dalla sezione 'Password dimenticata'.");
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success("Accesso effettuato!");
        }
      } else {
        // Anti-multiaccount: check if device already linked to an account with passkey
        const devCheck = await checkDeviceForSignup();
        if (devCheck.blocked) {
          toast.error(devCheck.reason || "Dispositivo già associato a un altro account.");
          return;
        }
        // Check username availability before signup
        if (username) {
          const { data: usernameCheck } = await supabase.rpc("check_username_available" as any, { _username: username });
          if (usernameCheck && !(usernameCheck as any).available) {
            toast.error("Questo username è già in uso. Scegline un altro.");
            return;
          }
        }
        const { error, data: signUpData } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              username,
              city: city || undefined,
              region_id: regionId || undefined,
              birth_date: birthDate || undefined,
            },
          },
        });
        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("Questa email è già registrata. Prova ad accedere o recupera la password.", {
              action: {
                label: "Recupera password",
                onClick: () => { setIsForgotPassword(true); setIsLogin(true); setErrors({}); },
              },
            });
          } else if (error.message.toLowerCase().includes("leaked") || error.message.toLowerCase().includes("breach") || error.message.toLowerCase().includes("pwned") || error.message.toLowerCase().includes("compromised")) {
            toast.error("Questa password risulta compromessa in un data breach noto. Scegli una password diversa e più sicura.");
          } else {
            toast.error(error.message);
          }
        } else if (signUpData?.user && signUpData.user.identities && signUpData.user.identities.length === 0) {
          // Supabase returns an empty identities array for repeated signups (email already exists)
          toast.error("Esiste già un account con questa email. Prova ad accedere o recupera la password.", {
            action: {
              label: "Recupera password",
              onClick: () => { setIsForgotPassword(true); setIsLogin(true); setErrors({}); },
            },
            duration: 8000,
          });
        } else {
          toast.success("Registrazione completata! Controlla la tua email per confermare l'account.");
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Back button */}
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/")}
        >
          <ArrowLeft size={18} className="mr-2" />
          Torna alla Home
        </Button>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                <span className="font-display text-2xl text-primary-foreground">B</span>
              </div>
            </div>
            <h1 className="font-display text-3xl tracking-wider">
              {isForgotPassword ? "RECUPERA PASSWORD" : isLogin ? "ACCEDI" : "REGISTRATI"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {isForgotPassword
                ? "Inserisci la tua email o username per ricevere il link di recupero"
                : isLogin
                ? "Accedi al tuo account blader"
                : "Unisciti alla community italiana di Beyblade"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && !isForgotPassword && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="il_tuo_username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-secondary border-border"
                  />
                  {errors.username && (
                    <p className="text-destructive text-sm">{errors.username}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Regione *</Label>
                  <Select value={regionId} onValueChange={(val) => { setRegionId(val); setCity(""); }}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="Seleziona la tua regione" />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {regionId && (
                  <div className="space-y-2">
                    <Label>Città</Label>
                    <CityCombobox
                      value={city}
                      onChange={setCity}
                      regionId={regionId}
                      placeholder="Cerca il tuo comune..."
                      className="bg-secondary border-border"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Data di nascita *</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="bg-secondary border-border"
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">
                {isForgotPassword || isLogin ? "Email o Username *" : "Email *"}
              </Label>
              <Input
                id="email"
                type={isForgotPassword || isLogin ? "text" : "email"}
                placeholder={isForgotPassword || isLogin ? "email o username" : "la-tua@email.it"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-secondary border-border"
                autoComplete={isForgotPassword || isLogin ? "username" : "email"}
              />
              {errors.email && (
                <p className="text-destructive text-sm">{errors.email}</p>
              )}
            </div>

            {!isForgotPassword && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password *</Label>
                    {isLogin && (
                      <button
                        type="button"
                        className="text-sm text-primary hover:underline"
                        onClick={() => { setIsForgotPassword(true); setErrors({}); }}
                      >
                        Password dimenticata?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-secondary border-border pr-10"
                      autoComplete={isLogin ? "current-password" : "new-password"}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-destructive text-sm">{errors.password}</p>
                  )}
                </div>

                {!isLogin && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Ripeti Password *</Label>
                      <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="bg-secondary border-border"
                      />
                      {errors.confirmPassword && (
                        <p className="text-destructive text-sm">{errors.confirmPassword}</p>
                      )}
                    </div>

                    {/* Anti-bot captcha */}
                    <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                        <ShieldCheck size={16} className="text-primary" />
                        Verifica anti-bot
                      </div>
                      <Label htmlFor="captcha" className="text-sm">
                        Quanto fa <span className="font-bold text-foreground">{captcha.a} + {captcha.b}</span>?
                      </Label>
                      <Input
                        id="captcha"
                        type="number"
                        placeholder="Inserisci il risultato"
                        value={captchaInput}
                        onChange={(e) => setCaptchaInput(e.target.value)}
                        className="bg-background border-border"
                      />
                      {errors.captcha && (
                        <p className="text-destructive text-sm">{errors.captcha}</p>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full mt-6"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Caricamento..."
                : isForgotPassword
                ? "Invia link di recupero"
                : isLogin
                ? "Accedi"
                : "Registrati"}
            </Button>
          </form>

          {/* Divider */}
          {isLogin && !isForgotPassword && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">oppure</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <PasskeyLoginButton
                  emailOrUsername={email}
                  className="w-full"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full flex items-center gap-3"
                  onClick={async () => {
                    const result = await openOAuthInBrowser("google");
                    if (result?.error) {
                      toast.error("Errore durante l'accesso con Google");
                    }
                  }}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Accedi con Google
                </Button>
              </div>
            </>
          )}

          {/* Help button */}
          <div className="mt-6 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setHelpOpen(true)}
            >
              <LifeBuoy size={16} className="mr-2" />
              Aiuto: non riesco ad accedere
            </Button>
          </div>

          {/* Toggle */}
          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              {isForgotPassword ? (
                <button
                  type="button"
                  className="text-primary hover:underline font-medium"
                  onClick={() => { setIsForgotPassword(false); setErrors({}); }}
                >
                  Torna al login
                </button>
              ) : (
                <>
                  {isLogin ? "Non hai un account?" : "Hai già un account?"}{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline font-medium"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setErrors({});
                      resetCaptcha();
                    }}
                  >
                    {isLogin ? "Registrati" : "Accedi"}
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <CredentialHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
};

export default Auth;
