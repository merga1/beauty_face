import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

/**
 * AuthProvider — wrap your app (or just the customer-facing section) with this.
 * It exposes the current Supabase session, the user object, and auth helpers.
 *
 * Usage:
 *   const { user, session, signIn, signUp, signOut, loading } = useAuth();
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  // Start as true so we don't flash protected content before we know the auth state
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Restore existing session from localStorage / URL hash on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2. Subscribe to future auth changes (login, logout, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Auth helpers ───────────────────────────────────────────────────────────

  /** Sign in with email + password */
  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  /** Create a new account with email + password */
  const signUp = (email, password, metadata = {}) =>
    supabase.auth.signUp({ email, password, options: { data: metadata } });

  /** Sign in with magic link (passwordless) */
  const signInWithMagicLink = (email, redirectTo) =>
    supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo ?? window.location.origin },
    });

  /** Sign in with an OAuth provider (e.g. 'google', 'github') */
  const signInWithOAuth = (provider, redirectTo) =>
    supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo ?? window.location.origin },
    });

  /** Sign out the current user */
  const signOut = () => supabase.auth.signOut();

  const value = {
    session,
    user,
    loading,
    signIn,
    signUp,
    signInWithMagicLink,
    signInWithOAuth,
    signOut,
  };

  // Don't render children until we know whether the user is authenticated.
  // This prevents a brief flash of protected content to unauthenticated users.
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

/** Hook — must be called inside an <AuthProvider> */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }
  return ctx;
}
