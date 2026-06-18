import { useState, useRef, useEffect } from 'react';
import { Plus, X, ArrowRight, LogOut, User, ChevronDown } from 'lucide-react';

export interface UserProfile {
  id: string;
  name: string;
  ownerEmail?: string;   // set when created while authenticated
  createdAt: string;
  lastActive: string;
}

export interface GoogleUser {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

interface Props {
  users: UserProfile[];
  onSelect: (user: UserProfile) => void;
  onCreateUser: (name: string) => UserProfile;
  googleUser?: GoogleUser | null;
  onSignOut?: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}

function getEmailInitials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

function getPalette(name: string) {
  return PALETTES[name.charCodeAt(0) % PALETTES.length];
}

function timeAgo(isoStr: string) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── Account Menu ──────────────────────────────────────────────────────────────

interface AccountMenuProps {
  googleUser: GoogleUser;
  onSignOut: () => void;
  onClose: () => void;
}

function AccountMenu({ googleUser, onSignOut, onClose }: AccountMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 100,
      background: 'var(--app-modal-bg)',
      border: '1px solid var(--app-border)',
      borderRadius: 16,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      width: 220,
      overflow: 'hidden',
      animation: 'acct-menu-in 0.15s ease',
    }}>
      <style>{`
        @keyframes acct-menu-in {
          from { opacity:0; transform:translateY(-6px) scale(0.97); }
          to   { opacity:1; transform:none; }
        }
      `}</style>

      {/* Identity header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--app-border)' }}>
        {googleUser.photoURL ? (
          <img
            src={googleUser.photoURL}
            alt="avatar"
            style={{ width: 36, height: 36, borderRadius: '50%', display: 'block', marginBottom: 8 }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div style={{
            width: 36, height: 36, borderRadius: '50%', marginBottom: 8,
            background: getPalette(googleUser.email ?? 'U').bg,
            color: getPalette(googleUser.email ?? 'U').color,
            fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {getEmailInitials(googleUser.email ?? 'U')}
          </div>
        )}
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--app-text-primary)', marginBottom: 2 }}>
          {googleUser.displayName ?? 'My Account'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--app-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {googleUser.email}
        </div>
      </div>

      {/* Menu items */}
      <div style={{ padding: '6px 0' }}>
        <button onClick={onClose} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', background: 'none', border: 'none',
          cursor: 'pointer', fontSize: 13.5, fontWeight: 500,
          color: 'var(--app-text-secondary)', textAlign: 'left',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--app-nav-hover-bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <User style={{ width: 14, height: 14, color: 'var(--app-text-muted)' }} />
          Profile
        </button>
      </div>

      {/* Sign out */}
      <div style={{ borderTop: '1px solid var(--app-border)', padding: '6px 0' }}>
        <button onClick={onSignOut} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', background: 'none', border: 'none',
          cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
          color: '#DC2626', textAlign: 'left',
          transition: 'background 0.12s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,38,38,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <LogOut style={{ width: 14, height: 14 }} />
          Logout
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function UserSelectScreen({ users, onSelect, onCreateUser, googleUser, onSignOut }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [selecting, setSelecting] = useState<string | null>(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Please enter a name.'); return; }
    if (users.some(u => u.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A profile with this name already exists.');
      return;
    }
    const user = onCreateUser(trimmed);
    setName('');
    setError('');
    setShowForm(false);
    onSelect(user);
  };

  const handleSelect = (user: UserProfile) => {
    setSelecting(user.id);
    setTimeout(() => onSelect(user), 180);
  };

  const handleSignOut = () => {
    setShowAccountMenu(false);
    onSignOut?.();
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--app-bg)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Top bar (shown when Google user is present) ── */}
      {googleUser && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid var(--app-border)',
          background: 'var(--app-card)',
        }}>
          {/* App brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'var(--app-btn-primary-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <rect x="3"  y="3"  width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.9" />
                <rect x="14" y="3"  width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.6" />
                <rect x="3"  y="14" width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.6" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.25" />
              </svg>
            </div>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--app-text-primary)' }}>EmpPay</span>
          </div>

          {/* Account button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowAccountMenu(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'var(--app-subtle-bg)', border: '1px solid var(--app-border)',
                borderRadius: 24, padding: '4px 10px 4px 5px',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--app-nav-hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--app-subtle-bg)')}
            >
              {googleUser.photoURL ? (
                <img
                  src={googleUser.photoURL}
                  alt="avatar"
                  style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0 }}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  background: getPalette(googleUser.email ?? 'U').bg,
                  color: getPalette(googleUser.email ?? 'U').color,
                  fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {getEmailInitials(googleUser.email ?? 'U')}
                </div>
              )}
              <span style={{
                fontSize: 12.5, fontWeight: 600, color: 'var(--app-text-secondary)',
                maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {googleUser.email}
              </span>
              <ChevronDown style={{
                width: 12, height: 12, color: 'var(--app-text-muted)', flexShrink: 0,
                transform: showAccountMenu ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }} />
            </button>

            {showAccountMenu && (
              <AccountMenu
                googleUser={googleUser}
                onSignOut={handleSignOut}
                onClose={() => setShowAccountMenu(false)}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '40px 20px 32px',
      }}>
        {/* Brand / title */}
        {!googleUser && (
          <div style={{ marginBottom: 36, textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: 'var(--app-btn-primary-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="3"  y="3"  width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.9" />
                <rect x="14" y="3"  width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.6" />
                <rect x="3"  y="14" width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.6" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" fill="var(--app-btn-primary-fg)" opacity="0.25" />
              </svg>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--app-text-primary)' }}>EmpPay</div>
          </div>
        )}

        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--app-text-primary)', letterSpacing: '-0.3px', marginBottom: 6 }}>
            {users.length === 0 ? 'Create your first profile' : "Who's working today?"}
          </div>
          {googleUser && (
            <div style={{ fontSize: 13.5, color: 'var(--app-text-muted)' }}>
              Signed in as <strong style={{ color: 'var(--app-text-secondary)' }}>{googleUser.email}</strong>
            </div>
          )}
        </div>

        {/* Profile grid */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 14,
          justifyContent: 'center', maxWidth: 560, marginBottom: 24,
        }}>
          {users.map(user => {
            const p = getPalette(user.name);
            const isSelecting = selecting === user.id;
            return (
              <button
                key={user.id}
                onClick={() => handleSelect(user)}
                style={{
                  width: 134,
                  padding: '20px 12px 16px',
                  background: 'var(--app-card)',
                  border: `2px solid ${isSelecting ? 'var(--app-btn-primary-bg)' : 'var(--app-border)'}`,
                  borderRadius: 18, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  transition: 'border-color 0.15s, transform 0.15s',
                  transform: isSelecting ? 'scale(0.96)' : 'scale(1)',
                }}
                onMouseEnter={e => {
                  if (!isSelecting) (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-text-faint)';
                }}
                onMouseLeave={e => {
                  if (!isSelecting) (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-border)';
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: p.bg, color: p.color,
                  fontSize: 20, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {getInitials(user.name)}
                </div>

                {/* Name */}
                <div style={{
                  fontSize: 13.5, fontWeight: 700, color: 'var(--app-text-primary)',
                  textAlign: 'center', lineHeight: 1.3, wordBreak: 'break-word',
                }}>
                  {user.name}
                </div>

                {/* Owner email — show if set */}
                {user.ownerEmail && (
                  <div style={{
                    fontSize: 10.5, color: 'var(--app-text-faint)',
                    textAlign: 'center', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%',
                  }}>
                    {user.ownerEmail}
                  </div>
                )}

                {/* Last synced (show for cloud-linked profiles) */}
                {user.ownerEmail && (
                  <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>
                    ☁ Synced {timeAgo(user.lastActive)}
                  </div>
                )}

                {/* Last active (always shown) */}
                {!user.ownerEmail && (
                  <div style={{ fontSize: 10.5, color: 'var(--app-text-faint)' }}>
                    {timeAgo(user.lastActive)}
                  </div>
                )}

                {isSelecting && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--app-text-primary)' }}>
                    <ArrowRight style={{ width: 12, height: 12 }} />
                    <span style={{ fontSize: 11, fontWeight: 600 }}>Entering…</span>
                  </div>
                )}
              </button>
            );
          })}

          {/* Add new profile */}
          {!showForm && (
            <button
              onClick={() => { setShowForm(true); setError(''); }}
              style={{
                width: 134, padding: '20px 12px 16px',
                background: 'transparent', border: '2px dashed var(--app-text-faint)',
                borderRadius: 18, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--app-text-muted)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--app-text-faint)')}
            >
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--app-subtle-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Plus style={{ width: 22, height: 22, color: 'var(--app-text-muted)' }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--app-text-muted)', textAlign: 'center' }}>
                Add New Profile
              </div>
            </button>
          )}
        </div>

        {/* New profile form */}
        {showForm && (
          <div style={{
            background: 'var(--app-card)', border: '1px solid var(--app-border)',
            borderRadius: 20, padding: '24px 24px 20px',
            width: '100%', maxWidth: 360,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--app-text-primary)' }}>New Profile</div>
              <button
                onClick={() => { setShowForm(false); setName(''); setError(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-text-muted)', padding: 2 }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {error && (
              <div style={{ background: '#FEF2F2', color: '#DC2626', fontSize: 13, padding: '9px 12px', borderRadius: 8, marginBottom: 12 }}>
                {error}
              </div>
            )}

            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              placeholder="e.g. Kundra Corp, Sharma Traders"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              style={{
                width: '100%', padding: '11px 14px', fontSize: 14,
                background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)',
                borderRadius: 12, color: 'var(--app-text-primary)', outline: 'none',
                boxSizing: 'border-box', marginBottom: 12,
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
              onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
            />

            <button
              onClick={handleCreate}
              style={{
                width: '100%', padding: '11px 0', fontSize: 14, fontWeight: 600,
                background: 'var(--app-btn-primary-bg)', color: 'var(--app-btn-primary-fg)',
                border: 'none', borderRadius: 12, cursor: 'pointer',
              }}
            >
              Create &amp; Enter
            </button>
          </div>
        )}

        {/* Footer */}
        <p style={{ fontSize: 11.5, color: 'var(--app-text-faint)', marginTop: 28, textAlign: 'center' }}>
          {googleUser
            ? 'Profiles sync automatically across your devices'
            : 'Profiles are saved on this device only'}
        </p>
      </div>
    </div>
  );
}
