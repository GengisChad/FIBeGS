import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

let authListener: { unsubscribe: () => void } | null = null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string, city?: string, regionId?: string, birthDate?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (authListener) {
      authListener.unsubscribe();
      authListener = null;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!isMounted) return;

        // Ignore INITIAL_SESSION - we handle restoration via getSession() below
        if (event === 'INITIAL_SESSION') return;

        // For SIGNED_OUT, clear state
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        // For SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED: only update if we have a valid session.
        // Some browsers (Safari/Firefox with strict storage) can briefly fire events with a null
        // session right after sign-in; ignoring them prevents an immediate logout flicker.
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          setLoading(false);
        }
      }
    );
    authListener = subscription;

    // Restore session from storage FIRST to avoid race conditions
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
      if (authListener === subscription) {
        subscription.unsubscribe();
        authListener = null;
      }
    };
  }, []);

  const signUp = async (email: string, password: string, username?: string, city?: string, regionId?: string, birthDate?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username: username,
          city: city,
          region_id: regionId,
          birth_date: birthDate,
        },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.session) {
      setSession(data.session);
      setUser(data.session.user);
      setLoading(false);
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
