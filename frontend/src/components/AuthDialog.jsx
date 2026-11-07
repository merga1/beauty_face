import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * AuthDialog — an inline sign-in / sign-up dialog that fits the existing
 * Beauty Face overlay pattern (no extra dependencies).
 *
 * Props:
 *   onClose()  — called when the user dismisses the dialog
 *   onSuccess() — called after a successful sign-in or sign-up
 *   initialMode — 'login' | 'signup' | 'magic' (default: 'login')
 */
export function AuthDialog({ onClose, onSuccess, initialMode = 'login' }) {
  const { signIn, signUp, signInWithMagicLink } = useAuth();

  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const reset = () => { setError(''); setMessage(''); };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    reset();

    try {
      if (mode === 'magic') {
        const { error } = await signInWithMagicLink(email);
        if (error) throw error;
        setMessage('Check your inbox — we sent you a sign-in link.');
        return;
      }

      if (mode === 'signup') {
        const { error } = await signUp(email, password, { full_name: name });
        if (error) throw error;
        setMessage(
          'Account created. Check your inbox to confirm your email, then sign in.'
        );
        return;
      }

      // mode === 'login'
      const { error } = await signIn(email, password);
      if (error) throw error;
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">YOUR ACCOUNT</span>
            <h2 id="auth-title">
              {mode === 'signup' ? 'Create an account'
                : mode === 'magic' ? 'Sign in with email link'
                : 'Welcome back'}
            </h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close">×</button>
        </div>

        {message ? (
          <div className="success-state">
            <span>✓</span>
            <h3>All done</h3>
            <p>{message}</p>
            <button className="primary-button" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <form className="checkout-form" onSubmit={handleSubmit}>
              {mode === 'signup' && (
                <label>
                  Full name
                  <input
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={120}
                  />
                </label>
              )}

              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete={mode === 'signup' ? 'username' : 'email'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              {mode !== 'magic' && (
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={mode === 'signup' ? 8 : undefined}
                  />
                  {mode === 'signup' && <small>At least 8 characters.</small>}
                </label>
              )}

              {error && <div className="form-error" role="alert">{error}</div>}

              <button className="primary-button full-button" disabled={busy}>
                {busy
                  ? (mode === 'magic' ? 'Sending link…' : mode === 'signup' ? 'Creating account…' : 'Signing in…')
                  : (mode === 'magic' ? 'Send magic link' : mode === 'signup' ? 'Create account' : 'Sign in')}
              </button>
            </form>

            <div className="auth-mode-switcher">
              {mode !== 'login' && (
                <button
                  className="text-link"
                  onClick={() => { setMode('login'); reset(); }}
                >
                  Already have an account? Sign in
                </button>
              )}
              {mode !== 'signup' && (
                <button
                  className="text-link"
                  onClick={() => { setMode('signup'); reset(); }}
                >
                  New here? Create an account
                </button>
              )}
              {mode !== 'magic' && (
                <button
                  className="text-link"
                  onClick={() => { setMode('magic'); reset(); }}
                >
                  Sign in with email link instead
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/**
 * AccountMenu — a small header button that shows the user's initial when
 * signed in, or an "Account" link that opens the auth dialog when signed out.
 */
export function AccountMenu({ onOpenAuth }) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) {
    return (
      <button className="text-link" onClick={onOpenAuth} aria-label="Sign in to your account">
        Account
      </button>
    );
  }

  const initials = (user.user_metadata?.full_name ?? user.email ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="account-menu" style={{ position: 'relative' }}>
      <button
        className="account-avatar"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--clr-plum, #9b7ecb)', color: '#fff',
          border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
        }}
      >
        {initials}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', top: 44, right: 0, minWidth: 160,
            background: '#fff', border: '1px solid #eee', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)', padding: '8px 0', zIndex: 100,
          }}
        >
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0' }}>
            <small style={{ color: '#666' }}>{user.email}</small>
          </div>
          <button
            onClick={() => { signOut(); setOpen(false); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '10px 16px', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: '0.9rem',
            }}
          >
            Sign out ↪
          </button>
        </div>
      )}
    </div>
  );
}
