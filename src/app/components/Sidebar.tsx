import { useState, useRef, useEffect, type ElementType } from 'react';
import {
  LayoutDashboard, Receipt, Users, CalendarDays, Settings,
  Building2, LogOut, CloudOff, RefreshCw, CheckCircle, ChevronDown,
  User, Repeat2, AlertCircle,
} from 'lucide-react';
import type { Screen } from '../App';
import type { UserProfile, GoogleUser } from './UserSelectScreen';
import type { SyncStatus } from './SyncIndicator';

interface Props {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  companyName: string;
  currentUser: UserProfile;
  onSwitchUser: () => void;   // switch profile — stays authenticated
  onSignOut?: () => void;     // full sign-out — clears auth state
  googleUser?: GoogleUser | null;
  syncStatus?: SyncStatus;
  onCloudRefresh?: () => void; // manual cloud refresh (read-only, never writes)
}

const PALETTES = [
  { bg: '#EDE9FE', color: '#6D28D9' },
  { bg: '#DBEAFE', color: '#1D4ED8' },
  { bg: '#D1FAE5', color: '#065F46' },
  { bg: '#FEF3C7', color: '#92400E' },
  { bg: '#FCE7F3', color: '#9D174D' },
  { bg: '#E0F2FE', color: '#075985' },
  { bg: '#FEE2E2', color: '#991B1B' },
  { bg: '#ECFDF5', color: '#065F46' },
];

function getPalette(name: string) {
  return PALETTES[(name.charCodeAt(0) ?? 65) % PALETTES.length];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}

const NAV_ITEMS: { id: Screen; label: string; icon: ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'payroll',   label: 'Payroll',   icon: Receipt },
  { id: 'employees', label: 'Employees', icon: Users },
  { id: 'holidays',  label: 'Holidays',  icon: CalendarDays },
  { id: 'settings',  label: 'Settings',  icon: Settings },
];

// ─── Sync status pill ──────────────────────────────────────────────────────────

type SyncCfg = { label: string; color: string; Icon: ElementType; spin?: boolean };

const SYNC_CFG: Record<SyncStatus, SyncCfg> = {
  synced:     { label: 'Synced',        color: '#16A34A', Icon: CheckCircle },
  syncing:    { label: 'Syncing…',      color: '#2563EB', Icon: RefreshCw, spin: true },
  refreshing: { label: 'Refreshing…',  color: '#7C3AED', Icon: RefreshCw, spin: true },
  offline:    { label: 'Offline',       color: '#D97706', Icon: CloudOff },
  error:      { label: 'Sync Error',    color: '#DC2626', Icon: AlertCircle },
  failed:     { label: 'Reconnecting…', color: '#D97706', Icon: RefreshCw, spin: true },
};

function SyncPill({ status }: { status: SyncStatus }) {
  const c = SYNC_CFG[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 20,
      background: `${c.color}18`, border: `1px solid ${c.color}35`,
      fontSize: 10.5, fontWeight: 700, color: c.color, flexShrink: 0,
    }}>
      <style>{`@keyframes sb-spin { to { transform: rotate(360deg); } }`}</style>
      <c.Icon style={{ width: 9, height: 9, animation: c.spin ? 'sb-spin 0.9s linear infinite' : 'none' }} />
      {c.label}
    </span>
  );
}

// ─── Account menu (pops up from the user row) ─────────────────────────────────

interface AccountMenuProps {
  googleUser: GoogleUser;
  currentUser: UserProfile;
  syncStatus: SyncStatus;
  onSwitchUser: () => void;
  onSignOut: () => void;
  onClose: () => void;
}

function AccountMenu({ googleUser, currentUser, syncStatus, onSwitchUser, onSignOut, onClose }: AccountMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const emailStr = googleUser.email ?? '';
  const p = getPalette(emailStr || currentUser.name);

  return (
    <div ref={ref} style={{
      position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200,
      background: 'var(--app-modal-bg)', border: '1px solid var(--app-border)',
      borderRadius: 14, boxShadow: '0 -4px 28px rgba(0,0,0,0.18)',
      overflow: 'hidden',
      animation: 'acct-in 0.14s ease',
    }}>
      <style>{`@keyframes acct-in { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:none; } }`}</style>

      {/* Identity block */}
      <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid var(--app-border)' }}>
        {googleUser.photoURL ? (
          <img src={googleUser.photoURL} alt="" referrerPolicy="no-referrer"
            style={{ width: 36, height: 36, borderRadius: '50%', marginBottom: 8, display: 'block' }} />
        ) : (
          <div style={{
            width: 36, height: 36, borderRadius: '50%', marginBottom: 8,
            background: p.bg, color: p.color, fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {emailStr ? emailStr.slice(0, 2).toUpperCase() : getInitials(currentUser.name)}
          </div>
        )}
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--app-text-primary)', marginBottom: 2 }}>
          {googleUser.displayName ?? 'My Account'}
        </div>
        {emailStr && (
          <div style={{ fontSize: 11.5, color: 'var(--app-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {emailStr}
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <SyncPill status={syncStatus} />
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: '5px 0' }}>
        {[
          { icon: <User style={{ width: 13, height: 13 }} />,    label: 'Account',        action: onClose },
          { icon: <Repeat2 style={{ width: 13, height: 13 }} />, label: 'Switch Profile', action: () => { onClose(); onSwitchUser(); } },
        ].map(item => (
          <button key={item.label} onClick={item.action} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 9,
            padding: '9px 14px', background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
            color: 'var(--app-text-secondary)', textAlign: 'left',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--app-nav-hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <span style={{ color: 'var(--app-text-muted)' }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--app-border)', padding: '5px 0' }}>
        <button onClick={() => { onClose(); onSignOut(); }} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 9,
          padding: '9px 14px', background: 'none', border: 'none',
          cursor: 'pointer', fontSize: 13, fontWeight: 700,
          color: '#DC2626', textAlign: 'left',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,38,38,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <LogOut style={{ width: 13, height: 13 }} />
          Logout
        </button>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({
  currentScreen, onNavigate, companyName,
  currentUser, onSwitchUser, onSignOut,
  googleUser, syncStatus = 'synced', onCloudRefresh,
}: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const p = getPalette(currentUser.name);

  const handleSignOut = () => {
    setShowMenu(false);
    (onSignOut ?? onSwitchUser)();
  };

  return (
    <aside style={{ width: 220, background: 'var(--app-card)', borderRight: '1px solid var(--app-border)', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100%' }}>

      {/* Company header + sync */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 16px 16px', borderBottom: '1px solid var(--app-border-subtle)' }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--app-btn-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Building2 style={{ width: 16, height: 16, color: 'var(--app-btn-primary-fg)' }} />
        </div>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--app-text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {companyName}
        </span>
        <SyncPill status={syncStatus} />
        {onCloudRefresh && (
          <button
            onClick={onCloudRefresh}
            disabled={syncStatus === 'refreshing'}
            title="Refresh Cloud Data"
            aria-label="Refresh Cloud Data"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, borderRadius: 6, border: 'none',
              background: 'transparent', cursor: syncStatus === 'refreshing' ? 'default' : 'pointer',
              color: 'var(--app-text-muted)', flexShrink: 0, padding: 0,
              opacity: syncStatus === 'refreshing' ? 0.4 : 1,
              transition: 'opacity 0.2s, background 0.15s',
            }}
            onMouseEnter={e => { if (syncStatus !== 'refreshing') (e.currentTarget as HTMLElement).style.background = 'var(--app-nav-hover-bg)'; }}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <RefreshCw style={{
              width: 13, height: 13,
              animation: syncStatus === 'refreshing' ? 'sb-spin 0.9s linear infinite' : 'none',
            }} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = currentScreen === id;
          return (
            <button key={id} onClick={() => onNavigate(id)} style={{
              height: 38, width: '100%',
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '0 10px', borderRadius: 10, border: 'none',
              background: active ? 'var(--app-nav-active-bg)' : 'transparent',
              color: active ? 'var(--app-nav-active-color)' : 'var(--app-nav-inactive)',
              fontSize: 13.5, fontWeight: active ? 600 : 400,
              cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
            }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--app-nav-hover-bg)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <Icon style={{ width: 16, height: 16, flexShrink: 0 }} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* User row */}
      <div style={{ borderTop: '1px solid var(--app-border-subtle)', padding: '10px 10px', position: 'relative' }}>
        {showMenu && googleUser && (
          <AccountMenu
            googleUser={googleUser}
            currentUser={currentUser}
            syncStatus={syncStatus}
            onSwitchUser={onSwitchUser}
            onSignOut={handleSignOut}
            onClose={() => setShowMenu(false)}
          />
        )}

        <button
          onClick={() => googleUser ? setShowMenu(v => !v) : onSwitchUser()}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 10px', borderRadius: 12, border: 'none',
            background: 'transparent', cursor: 'pointer', textAlign: 'left',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--app-nav-hover-bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {/* Avatar: Google photo > initials */}
          {googleUser?.photoURL ? (
            <img src={googleUser.photoURL} alt="" referrerPolicy="no-referrer"
              style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: p.bg, color: p.color,
              fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {getInitials(currentUser.name)}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--app-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {googleUser?.displayName ?? currentUser.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--app-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {googleUser?.email ?? 'Switch profile'}
            </div>
          </div>

          {googleUser && (
            <ChevronDown style={{ width: 13, height: 13, color: 'var(--app-text-muted)', flexShrink: 0, transform: showMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          )}
          {!googleUser && (
            <LogOut style={{ width: 13, height: 13, color: 'var(--app-text-muted)', flexShrink: 0 }} />
          )}
        </button>
      </div>
    </aside>
  );
}
