import { useAuth } from '../context/AuthContext.jsx';

/**
 * ProtectedRoute — renders `children` only when a Supabase session exists.
 * If the user is not signed in, renders `fallback` instead (defaults to null).
 *
 * This is a render-based guard (no React Router required) to fit the existing
 * path-based routing pattern already used in main.jsx.
 *
 * Usage:
 *   <ProtectedRoute fallback={<LoginDialog onClose={...} />}>
 *     <AccountPage />
 *   </ProtectedRoute>
 */
export function ProtectedRoute({ children, fallback = null }) {
  const { session, loading } = useAuth();

  // AuthProvider already blocks rendering until loading is false,
  // but guard here as well for safety.
  if (loading) return null;

  return session ? children : fallback;
}
