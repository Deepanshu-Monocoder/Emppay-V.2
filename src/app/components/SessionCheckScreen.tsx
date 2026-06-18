const AppLogo = () => (
  <div style={{
    width: 52, height: 52, borderRadius: 16,
    background: 'var(--app-btn-primary-bg)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
  }}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3"  y="3"  width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.95" />
      <rect x="14" y="3"  width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.65" />
      <rect x="3"  y="14" width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.65" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.25" />
    </svg>
  </div>
);

export function SessionCheckScreen() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--app-bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 22,
    }}>
      <style>{`
        @keyframes sc-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes sc-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>

      <div style={{ animation: 'sc-fade-in 0.3s ease' }}>
        <AppLogo />
      </div>

      <div style={{ textAlign: 'center', animation: 'sc-fade-in 0.4s ease 0.1s both' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--app-text-primary)', marginBottom: 6 }}>
          Signing you in...
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--app-text-muted)' }}>
          Setting up your account
        </div>
      </div>

      {/* Spinner */}
      <div style={{ animation: 'sc-fade-in 0.4s ease 0.15s both' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid var(--app-border)',
          borderTopColor: 'var(--app-btn-primary-bg)',
          animation: 'sc-spin 0.75s linear infinite',
        }} />
      </div>
    </div>
  );
}
