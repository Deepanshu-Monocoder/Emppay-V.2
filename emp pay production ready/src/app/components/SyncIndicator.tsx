import { useState, useEffect, useRef } from 'react';
import { CheckCircle, RefreshCw, WifiOff, AlertCircle } from 'lucide-react';

export type SyncStatus = 'synced' | 'syncing' | 'refreshing' | 'offline' | 'error' | 'failed';

interface Props {
  // Pass status from outside to connect Firebase later.
  // Defaults to a demo cycle when omitted.
  status?: SyncStatus;
  onRetry?: () => void;
}

const CONFIG: Record<SyncStatus, { label: string; color: string; bg: string; border: string }> = {
  synced:     { label: 'Synced',       color: '#16A34A', bg: 'rgba(22,163,74,0.08)',   border: 'rgba(22,163,74,0.2)'   },
  syncing:    { label: 'Syncing...',   color: '#2563EB', bg: 'rgba(37,99,235,0.08)',   border: 'rgba(37,99,235,0.2)'   },
  refreshing: { label: 'Refreshing...', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)' },
  offline:    { label: 'Offline',      color: '#D97706', bg: 'rgba(217,119,6,0.08)',   border: 'rgba(217,119,6,0.2)'   },
  error:      { label: 'Sync Error',   color: '#DC2626', bg: 'rgba(220,38,38,0.08)',   border: 'rgba(220,38,38,0.2)'   },
  failed:     { label: 'Sync Failed',  color: '#DC2626', bg: 'rgba(220,38,38,0.08)',   border: 'rgba(220,38,38,0.2)'   },
};

// Demo cycle used when no status prop is provided (remove once Firebase is wired)
const DEMO_SEQUENCE: { status: SyncStatus; duration: number }[] = [
  { status: 'syncing', duration: 1800 },
  { status: 'synced',  duration: 4000 },
  { status: 'offline', duration: 3000 },
  { status: 'syncing', duration: 1600 },
  { status: 'failed',  duration: 4000 },
  { status: 'syncing', duration: 1600 },
  { status: 'synced',  duration: 99999 },
];

export function SyncIndicator({ status: externalStatus, onRetry }: Props) {
  const [demoStatus, setDemoStatus] = useState<SyncStatus>('syncing');
  const [visible, setVisible] = useState(true);
  const [pulse, setPulse] = useState(false);
  const demoIdx = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const controlled = externalStatus !== undefined;
  const status = controlled ? externalStatus : demoStatus;

  // Demo auto-cycle
  useEffect(() => {
    if (controlled) return;
    function next() {
      const step = DEMO_SEQUENCE[demoIdx.current % DEMO_SEQUENCE.length];
      setDemoStatus(step.status);
      demoIdx.current++;
      timerRef.current = setTimeout(next, step.duration);
    }
    next();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [controlled]);

  // Flash pulse on status change
  useEffect(() => {
    setVisible(false);
    const t1 = setTimeout(() => setVisible(true), 120);
    const t2 = setTimeout(() => setPulse(true), 120);
    const t3 = setTimeout(() => setPulse(false), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [status]);

  const cfg = CONFIG[status];

  const Icon = () => {
    if (status === 'syncing' || status === 'refreshing') return (
      <RefreshCw
        style={{
          width: 11, height: 11,
          animation: 'sync-spin 0.9s linear infinite',
          flexShrink: 0,
        }}
      />
    );
    if (status === 'synced') return <CheckCircle style={{ width: 11, height: 11, flexShrink: 0 }} />;
    if (status === 'offline') return <WifiOff style={{ width: 11, height: 11, flexShrink: 0 }} />;
    return <AlertCircle style={{ width: 11, height: 11, flexShrink: 0 }} />;
  };

  return (
    <>
      <style>{`
        @keyframes sync-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes sync-appear {
          from { opacity: 0; transform: translateY(-4px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes sync-pulse {
          0%   { box-shadow: 0 0 0 0px ${cfg.color}40; }
          60%  { box-shadow: 0 0 0 5px ${cfg.color}00; }
          100% { box-shadow: 0 0 0 0px ${cfg.color}00; }
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 9px',
          borderRadius: 20,
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          color: cfg.color,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.1,
          cursor: (status === 'failed' || status === 'error') ? 'pointer' : 'default',
          flexShrink: 0,
          userSelect: 'none',
          opacity: visible ? 1 : 0,
          animation: visible ? `sync-appear 0.18s ease, ${pulse ? `sync-pulse 0.7s ease` : 'none'}` : 'none',
          transition: 'background 0.3s, border-color 0.3s, color 0.3s',
        }}
        title={(status === 'failed' || status === 'error') ? 'Click to retry sync' : undefined}
        onClick={(status === 'failed' || status === 'error') ? onRetry : undefined}
        role={(status === 'failed' || status === 'error') ? 'button' : undefined}
        aria-label={`Sync status: ${cfg.label}${(status === 'failed' || status === 'error') ? '. Click to retry.' : ''}`}
      >
        <Icon />
        <span>{cfg.label}</span>
        {(status === 'failed' || status === 'error') && (
          <span style={{ fontSize: 10, opacity: 0.75, marginLeft: 1 }}>Retry</span>
        )}
      </div>
    </>
  );
}
