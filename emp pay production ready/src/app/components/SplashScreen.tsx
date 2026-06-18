const AppLogo = ({ size = 56 }: { size?: number }) => (
  <div style={{
    width: size, height: size, borderRadius: size * 0.3,
    background: 'var(--app-btn-primary-bg)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 24px rgba(0,0,0,0.22)',
  }}>
    <svg width={size * 0.46} height={size * 0.46} viewBox="0 0 24 24" fill="none">
      <rect x="3"  y="3"  width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.95" />
      <rect x="14" y="3"  width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.65" />
      <rect x="3"  y="14" width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.65" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.25" />
    </svg>
  </div>
);

export function SplashScreen() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--app-bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
    }}>
      <style>{`
        @keyframes sp-bounce {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.75); }
          40%            { opacity: 1;   transform: scale(1);    }
        }
      `}</style>

      <AppLogo size={64} />

      <div style={{ textAlign: 'center', lineHeight: 1 }}>
        <div style={{
          fontSize: 26, fontWeight: 800,
          color: 'var(--app-text-primary)',
          letterSpacing: '-0.5px',
          marginBottom: 8,
        }}>
          EmpPay
        </div>
        <div style={{
          fontSize: 14, fontWeight: 500,
          color: 'var(--app-text-muted)',
          letterSpacing: 0.1,
        }}>
          Payroll &amp; Attendance Management
        </div>
      </div>

      {/* Animated dots */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 7 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: '50%',
              background: 'var(--app-text-faint)',
              animation: `sp-bounce 1.2s ease-in-out ${i * 0.18}s infinite`,
            }} />
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--app-text-faint)', fontWeight: 500, letterSpacing: 0.2 }}>
          Loading...
        </div>
      </div>
    </div>
  );
}
