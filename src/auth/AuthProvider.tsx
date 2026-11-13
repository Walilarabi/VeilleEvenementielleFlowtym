import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  supabase: SupabaseClient | null;
  user: AuthenticatedUser | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  recoveryMode: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      })
    : null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(
    supabase ? null : 'Configuration Supabase manquante. Définissez VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY.'
  );
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    const loadProfile = async (authUser: User | null) => {
      if (!authUser) {
        if (active) setUser(null);
        return;
      }

      const { data, error: profileError } = await supabase
        .from('users')
        .select('id, email, full_name, role')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!active) return;
      if (profileError) {
        setError('Impossible de charger votre profil utilisateur. Contactez un administrateur.');
        setUser(null);
        return;
      }

      if (!data) {
        setError('Votre compte est authentifié mais aucun profil Flowtym ne lui est associé. Contactez un administrateur.');
        setUser(null);
        return;
      }

      setError(null);
      setUser({
        id: data.id,
        email: data.email || authUser.email || '',
        name: data.full_name || authUser.email?.split('@')[0] || 'Utilisateur',
        role: data.role,
      });
    };

    const initialize = async () => {
      const { data, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (userError) {
        setError(userError.message);
        setUser(null);
      } else {
        await loadProfile(data.user);
      }
      if (active) setLoading(false);
    };

    void initialize();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session: Session | null) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setRecoveryMode(false);
        setError(null);
        setLoading(false);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setLoading(true);
        window.setTimeout(() => {
          if (!active) return;
          void loadProfile(session?.user ?? null).finally(() => {
            if (active) setLoading(false);
          });
        }, 0);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    supabase,
    user,
    loading,
    error,
    recoveryMode,
    signOut: async () => {
      if (!supabase) throw new Error('Supabase non configuré.');
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    },
    updatePassword: async (password: string) => {
      if (!supabase) throw new Error('Supabase non configuré.');
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setRecoveryMode(false);
    },
  }), [user, loading, error, recoveryMode]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider.');
  return context;
}
