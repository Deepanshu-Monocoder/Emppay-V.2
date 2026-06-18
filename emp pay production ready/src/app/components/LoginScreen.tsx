import { useState } from 'react';
import { Shield, AlertCircle } from 'lucide-react';
import { auth, googleProvider, signInWithPopup } from '../../lib/firebase';

interface Props {
  onGuestLogin: () => void;
}

export function LoginScreen({ onGuestLogin }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged in App.tsx will detect the new session and
      // advance authStage → 'authed' automatically.
      // Keep loading=true so the spinner stays visible during that transition.
    } catch (err: unknown) {
      setLoading(false);
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // User dismissed — no message needed
      } else if (code === 'auth/unauthorized-domain') {
        setError(
          'This domain is not authorised in Firebase. Go to Firebase Console → Authentication → Settings → Authorised Domains and add the current domain.'
        );
      } else if (code === 'auth/popup-blocked') {
        setError('Pop-up was blocked. Please allow pop-ups for this site and try again.');
      } else if (code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(`Sign-in failed (${code || 'unknown'}). Please try again.`);
      }
    }
  };

  const AppLogo = () => (
    <div style={{
      width: 56, height: 56, borderRadius: 18,
      background: 'var(--app-btn-primary-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto',
      boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
    }}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <rect x="3"  y="3"  width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.95" />
        <rect x="14" y="3"  width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.65" />
        <rect x="3"  y="14" width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.65" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.25" />
      </svg>
    </div>
  );

  const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--app-bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
    }}>
      <style>{`@keyframes ls-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'var(--app-card)', border: '1px solid var(--app-border)',
        borderRadius: 28, padding: '44px 36px 40px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
      }}>
        <AppLogo />

        <div style={{ marginTop: 20, fontSize: 11.5, fontWeight: 700, color: 'var(--app-text-faint)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
          EmpPay
        </div>

        <h1 style={{ marginTop: 28, marginBottom: 10, fontSize: 26, fontWeight: 800, color: 'var(--app-text-primary)', textAlign: 'center', letterSpacing: '-0.5px', lineHeight: 1.18 }}>
          Welcome to EmpPay
        </h1>

        <p style={{ fontSize: 14.5, color: 'var(--app-text-muted)', textAlign: 'center', lineHeight: 1.65, marginBottom: 36, maxWidth: 300 }}>
          Manage attendance, employees and payroll from anywhere.
        </p>

        {/* Error message */}
        {error && (
          <div style={{
            width: '100%', display: 'flex', alignItems: 'flex-start', gap: 9,
            background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.22)',
            borderRadius: 12, padding: '11px 14px', marginBottom: 18,
            fontSize: 13.5, color: '#DC2626', lineHeight: 1.5,
          }}>
            <AlertCircle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
            {error}
          </div>
        )}

        {/* Google Sign-In button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '15px 20px', fontSize: 15.5, fontWeight: 700,
            background: loading ? 'var(--app-subtle-bg)' : 'var(--app-btn-primary-bg)',
            color: loading ? 'var(--app-text-muted)' : 'var(--app-btn-primary-fg)',
            border: 'none', borderRadius: 16, cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.75 : 1, transition: 'background 0.18s, transform 0.1s',
          }}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; }}
        >
          {loading ? (
            <>
              <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2.5px solid var(--app-text-faint)', borderTopColor: 'var(--app-text-muted)', animation: 'ls-spin 0.7s linear infinite' }} />
              Connecting...
            </>
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </button>

        {/* Divider */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 4px' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--app-border)' }} />
          <span style={{ fontSize: 12, color: 'var(--app-text-faint)', fontWeight: 500 }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--app-border)' }} />
        </div>

        {/* Guest button */}
        <button
          onClick={onGuestLogin}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '13px 20px', fontSize: 14.5, fontWeight: 600,
            background: 'transparent',
            color: 'var(--app-text-secondary)',
            border: '1.5px solid var(--app-border)',
            borderRadius: 16, cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.5 : 1,
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            if (!loading) {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-text-faint)';
              (e.currentTarget as HTMLElement).style.color = 'var(--app-text-primary)';
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-border)';
            (e.currentTarget as HTMLElement).style.color = 'var(--app-text-secondary)';
          }}
        >
          Continue as Guest
        </button>

        {/* Trust */}
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 7, color: 'var(--app-text-faint)', fontSize: 12.5 }}>
          <Shield style={{ width: 13, height: 13, flexShrink: 0 }} />
          Secure cloud sync across your devices
        </div>
      </div>

      {/* Legal */}
      <p style={{ marginTop: 20, fontSize: 11.5, color: 'var(--app-text-faint)', textAlign: 'center', maxWidth: 340, lineHeight: 1.6 }}>
        By continuing you agree to the{' '}
        <span style={{ color: 'var(--app-text-muted)', textDecoration: 'underline', cursor: 'pointer' }}>Terms of Service</span>
        {' '}and{' '}
        <span style={{ color: 'var(--app-text-muted)', textDecoration: 'underline', cursor: 'pointer' }}>Privacy Policy</span>.
      </p>
    </div>
  );
}
