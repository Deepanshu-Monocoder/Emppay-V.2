import { useState, useRef, useEffect } from 'react';
import {
  Building2, Users, Plus, MoreVertical, Crown, Shield, Eye,
  X, ChevronLeft, Mail, Clock, Receipt, CalendarDays,
  UserCheck, Pencil, Trash2, Check, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '../hooks/useIsMobile';
import type { Screen } from '../App';
import type { UserProfile, WorkspaceMember } from './UserSelectScreen';

interface Props {
  currentUser: UserProfile;
  accountEmail: string;
  onUpdateWorkspace: (updated: UserProfile) => void;
  onNavigate: (screen: Screen) => void;
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
  { bg: '#ECFDF5', color: '#166534' },
];

function getPalette(str: string) {
  return PALETTES[(str.charCodeAt(0) ?? 0) % PALETTES.length];
}

function getInitials(str: string) {
  const clean = str.includes('@') ? str.split('@')[0] : str;
  const parts = clean.trim().split(/[\s._-]/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : clean.slice(0, 2).toUpperCase();
}

function workspaceId(userId: string) {
  return 'WS-' + userId.replace('u_', '').slice(0, 8).toUpperCase();
}

function timeAgo(isoStr: string) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MiniAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const p = getPalette(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: p.bg, color: p.color,
      fontSize: size * 0.34, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  );
}

const ROLE_CONFIG = {
  owner:   { label: 'Owner',   bg: '#EDE9FE', color: '#6D28D9', icon: Crown,   desc: 'Full access to everything' },
  manager: { label: 'Manager', bg: '#DBEAFE', color: '#1D4ED8', icon: Shield,  desc: 'Manage employees, attendance & payroll' },
  member:  { label: 'Member',  bg: '#D1FAE5', color: '#065F46', icon: Eye,     desc: 'View and update attendance' },
};

function RoleBadge({ role }: { role: 'owner' | 'manager' | 'member' }) {
  const cfg = ROLE_CONFIG[role];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 20,
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.2,
    }}>
      <cfg.icon style={{ width: 10, height: 10 }} />
      {cfg.label}
    </span>
  );
}

// ─── Dummy activity feed ───────────────────────────────────────────────────────

const DUMMY_ACTIVITY = [
  { Icon: UserCheck,  text: 'Rahul marked Present',       detail: 'Attendance',  time: '2m ago' },
  { Icon: Receipt,    text: 'Payroll Generated',           detail: 'June 2026',   time: '1h ago' },
  { Icon: CalendarDays, text: 'Holiday Added · Diwali',   detail: 'Oct 20',      time: '2d ago' },
  { Icon: UserCheck,  text: 'Sneha marked Half Day',      detail: 'Attendance',  time: '3d ago' },
  { Icon: Users,      text: 'Employee Added · Arjun',     detail: 'Team',        time: '5d ago' },
];

// ─── Invite Modal (bottom-sheet on mobile) ────────────────────────────────────

interface InviteModalProps {
  isMobile: boolean;
  onConfirm: (email: string, role: 'manager' | 'member') => void;
  onClose: () => void;
}

function InviteModal({ isMobile, onConfirm, onClose }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'manager' | 'member'>('member');
  const [error, setError] = useState('');

  const handleSend = () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError('Email address is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError('Please enter a valid email.'); return; }
    onConfirm(trimmed, role);
  };

  const sheet = isMobile ? {
    position: 'fixed' as const, inset: 0, zIndex: 300,
    background: 'var(--app-overlay)',
    display: 'flex', alignItems: 'flex-end',
  } : {
    position: 'fixed' as const, inset: 0, zIndex: 300,
    background: 'var(--app-overlay)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  };

  const card = isMobile ? {
    width: '100%', background: 'var(--app-modal-bg)', borderRadius: '20px 20px 0 0',
    padding: '24px 20px 36px',
    animation: 'sheet-up 0.22s ease',
  } : {
    width: '100%', maxWidth: 440, background: 'var(--app-modal-bg)',
    border: '1px solid var(--app-border)', borderRadius: 22,
    padding: '28px 28px 24px',
    boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
    animation: 'modal-in 0.18s ease',
  };

  return (
    <div style={sheet} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{`
        @keyframes sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes modal-in { from { opacity:0; transform:translateY(10px) scale(0.97); } to { opacity:1; transform:none; } }
      `}</style>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--app-text-primary)' }}>Invite Member</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-text-muted)', padding: 4 }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', color: '#DC2626', fontSize: 13, padding: '9px 12px', borderRadius: 9, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-text-muted)', letterSpacing: 0.5, textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'var(--app-text-muted)' }} />
              <input
                type="email"
                value={email}
                autoFocus
                onChange={e => { setEmail(e.target.value); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                placeholder="colleague@company.com"
                style={{
                  width: '100%', padding: '11px 14px 11px 38px', fontSize: 14,
                  background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)',
                  borderRadius: 11, color: 'var(--app-text-primary)', outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-text-muted)', letterSpacing: 0.5, textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>
              Role
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['manager', 'member'] as const).map(r => {
                const cfg = ROLE_CONFIG[r];
                const active = role === r;
                return (
                  <button key={r} onClick={() => setRole(r)} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 14px',
                    background: active ? cfg.bg + '33' : 'var(--app-input-bg)',
                    border: `1.5px solid ${active ? cfg.color + '66' : 'var(--app-input-border)'}`,
                    borderRadius: 11, cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      border: `2px solid ${active ? cfg.color : 'var(--app-text-faint)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: 1,
                      background: active ? cfg.color : 'transparent',
                    }}>
                      {active && <Check style={{ width: 10, height: 10, color: '#fff' }} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--app-text-primary)', marginBottom: 2 }}>{cfg.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>{cfg.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={handleSend} style={{
            width: '100%', padding: '12px 0', fontSize: 14.5, fontWeight: 600,
            background: 'var(--app-btn-primary-bg)', color: 'var(--app-btn-primary-fg)',
            border: 'none', borderRadius: 12, cursor: 'pointer',
          }}>
            Send Invite
          </button>
          <button onClick={onClose} style={{
            width: '100%', padding: '11px 0', fontSize: 13.5, fontWeight: 500,
            background: 'none', color: 'var(--app-text-muted)',
            border: '1px solid var(--app-border)', borderRadius: 12, cursor: 'pointer',
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Role Sheet ──────────────────────────────────────────────────────────

interface EditRoleProps {
  member: WorkspaceMember;
  isMobile: boolean;
  onConfirm: (role: 'manager' | 'member') => void;
  onClose: () => void;
}

function EditRoleModal({ member, isMobile, onConfirm, onClose }: EditRoleProps) {
  const [role, setRole] = useState<'manager' | 'member'>(
    member.role === 'owner' ? 'manager' : member.role
  );

  const sheet = isMobile ? {
    position: 'fixed' as const, inset: 0, zIndex: 300,
    background: 'var(--app-overlay)', display: 'flex', alignItems: 'flex-end',
  } : {
    position: 'fixed' as const, inset: 0, zIndex: 300,
    background: 'var(--app-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  };

  const card = isMobile
    ? { width: '100%', background: 'var(--app-modal-bg)', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', animation: 'sheet-up 0.22s ease' }
    : { width: '100%', maxWidth: 400, background: 'var(--app-modal-bg)', border: '1px solid var(--app-border)', borderRadius: 22, padding: '28px 28px 24px', boxShadow: '0 16px 48px rgba(0,0,0,0.22)', animation: 'modal-in 0.18s ease' };

  return (
    <div style={sheet} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--app-text-primary)' }}>Change Role</div>
            <div style={{ fontSize: 12.5, color: 'var(--app-text-muted)', marginTop: 2 }}>{member.email}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-text-muted)', padding: 4 }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {(['manager', 'member'] as const).map(r => {
            const cfg = ROLE_CONFIG[r];
            const active = role === r;
            return (
              <button key={r} onClick={() => setRole(r)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                background: active ? cfg.bg + '33' : 'var(--app-input-bg)',
                border: `1.5px solid ${active ? cfg.color + '66' : 'var(--app-input-border)'}`,
                borderRadius: 11, cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: `2px solid ${active ? cfg.color : 'var(--app-text-faint)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? cfg.color : 'transparent',
                }}>
                  {active && <Check style={{ width: 10, height: 10, color: '#fff' }} />}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--app-text-primary)' }}>{cfg.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--app-text-muted)' }}>{cfg.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onConfirm(role)} style={{
            flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600,
            background: 'var(--app-btn-primary-bg)', color: 'var(--app-btn-primary-fg)',
            border: 'none', borderRadius: 12, cursor: 'pointer',
          }}>Save Changes</button>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px 0', fontSize: 13.5, fontWeight: 500,
            background: 'none', color: 'var(--app-text-muted)',
            border: '1px solid var(--app-border)', borderRadius: 12, cursor: 'pointer',
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Member Row action menu ────────────────────────────────────────────────────

interface MemberMenuProps {
  member: WorkspaceMember;
  onEditRole: () => void;
  onRemove: () => void;
  onClose: () => void;
}

function MemberMenu({ member, onEditRole, onRemove, onClose }: MemberMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'absolute', right: 0, top: 32, zIndex: 50,
      background: 'var(--app-modal-bg)', border: '1px solid var(--app-border)',
      borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
      width: 160, overflow: 'hidden',
      animation: 'menu-in 0.14s ease',
    }}>
      <style>{`@keyframes menu-in { from { opacity:0; transform:scale(0.95) translateY(-4px); } to { opacity:1; transform:none; } }`}</style>
      {[
        { icon: <Eye style={{ width: 13, height: 13 }} />, label: 'View', action: onClose },
        { icon: <Pencil style={{ width: 13, height: 13 }} />, label: 'Edit Role', action: () => { onClose(); onEditRole(); } },
        { icon: <Trash2 style={{ width: 13, height: 13 }} />, label: 'Remove', action: () => { onClose(); onRemove(); }, danger: true },
      ].map(item => (
        <button key={item.label} onClick={item.action} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 9,
          padding: '10px 14px', background: 'none', border: 'none',
          cursor: 'pointer', fontSize: 13.5, fontWeight: 500,
          color: (item as { danger?: boolean }).danger ? '#DC2626' : 'var(--app-text-secondary)',
          textAlign: 'left',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--app-nav-hover-bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <span style={{ color: (item as { danger?: boolean }).danger ? '#DC2626' : 'var(--app-text-muted)' }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ─── Member Card ──────────────────────────────────────────────────────────────

interface MemberCardProps {
  member: WorkspaceMember;
  isOwner?: boolean;
  onEditRole: () => void;
  onRemove: () => void;
}

function MemberCard({ member, isOwner, onEditRole, onRemove }: MemberCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      background: 'var(--app-card)', border: '1px solid var(--app-border)',
      borderRadius: 14, position: 'relative',
    }}>
      <MiniAvatar name={member.email} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {member.name && (
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--app-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {member.name}
          </div>
        )}
        <div style={{ fontSize: member.name ? 12 : 13.5, color: member.name ? 'var(--app-text-muted)' : 'var(--app-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: member.name ? 400 : 500 }}>
          {member.email}
        </div>
        <div style={{ marginTop: 4 }}>
          <RoleBadge role={member.role} />
        </div>
      </div>

      {!isOwner && !confirmRemove && (
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowMenu(v => !v)} style={{
            width: 30, height: 30, borderRadius: 8,
            background: showMenu ? 'var(--app-subtle-bg)' : 'none',
            border: '1px solid transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--app-subtle-bg)')}
            onMouseLeave={e => { if (!showMenu) e.currentTarget.style.background = 'none'; }}
          >
            <MoreVertical style={{ width: 15, height: 15, color: 'var(--app-text-muted)' }} />
          </button>
          {showMenu && (
            <MemberMenu
              member={member}
              onEditRole={onEditRole}
              onRemove={() => setConfirmRemove(true)}
              onClose={() => setShowMenu(false)}
            />
          )}
        </div>
      )}

      {confirmRemove && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={onRemove} style={{
            padding: '6px 12px', fontSize: 12.5, fontWeight: 700,
            background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
          }}>Remove</button>
          <button onClick={() => setConfirmRemove(false)} style={{
            padding: '6px 10px', fontSize: 12.5,
            background: 'var(--app-subtle-bg)', color: 'var(--app-text-muted)',
            border: '1px solid var(--app-border)', borderRadius: 8, cursor: 'pointer',
          }}>Cancel</button>
        </div>
      )}
    </div>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export function WorkspaceScreen({ currentUser, accountEmail, onUpdateWorkspace, onNavigate }: Props) {
  const isMobile = useIsMobile();

  const members: WorkspaceMember[] = currentUser.members ?? [];
  const companyName = currentUser.companyName || currentUser.name;

  // Workspace info local edit state
  const [editName, setEditName] = useState(companyName);
  const [infoDirty, setInfoDirty] = useState(false);

  // Modals
  const [showInvite, setShowInvite] = useState(false);
  const [editingMember, setEditingMember] = useState<WorkspaceMember | null>(null);

  // Activity dummy data — show accountEmail as actor for first two
  const activity = [
    { Icon: UserCheck,    text: 'Rahul marked Present',     by: members[0]?.email ?? accountEmail, time: '2m ago' },
    { Icon: Receipt,      text: 'Payroll Generated',         by: accountEmail,                      time: '1h ago' },
    { Icon: CalendarDays, text: 'Holiday Added · Diwali',   by: accountEmail,                      time: '2d ago' },
    { Icon: UserCheck,    text: 'Sneha marked Half Day',    by: members[0]?.email ?? accountEmail, time: '3d ago' },
    { Icon: Users,        text: 'Employee Added · Arjun',   by: accountEmail,                      time: '5d ago' },
  ];

  const saveInfo = () => {
    const trimmed = editName.trim();
    if (!trimmed) { toast.error('Business name is required'); return; }
    onUpdateWorkspace({ ...currentUser, companyName: trimmed });
    setInfoDirty(false);
    toast.success('Workspace updated');
  };

  const handleInvite = (email: string, role: 'manager' | 'member') => {
    if (members.some(m => m.email === email)) {
      toast.error('This member is already in your workspace');
      return;
    }
    const newMember: WorkspaceMember = {
      id: `m_${Date.now()}`,
      email,
      role,
      joinedAt: new Date().toISOString(),
    };
    onUpdateWorkspace({ ...currentUser, members: [...members, newMember] });
    setShowInvite(false);
    toast.success(`Invite sent to ${email}`);
  };

  const handleEditRole = (memberId: string, role: 'manager' | 'member') => {
    const updated = members.map(m => m.id === memberId ? { ...m, role } : m);
    onUpdateWorkspace({ ...currentUser, members: updated });
    setEditingMember(null);
    toast.success('Role updated');
  };

  const handleRemove = (memberId: string) => {
    const updated = members.filter(m => m.id !== memberId);
    onUpdateWorkspace({ ...currentUser, members: updated });
    toast.success('Member removed');
  };

  const totalMembers = members.length + 1; // +1 for owner

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--app-bg)' }}>
      <div style={{ padding: isMobile ? '20px 16px 100px' : '32px 36px 48px', maxWidth: 760, margin: '0 auto' }}>

        {/* ── Page header ─────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          {isMobile && (
            <button onClick={() => onNavigate('settings')} style={{
              width: 34, height: 34, borderRadius: 10, background: 'var(--app-card)',
              border: '1px solid var(--app-border)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <ChevronLeft style={{ width: 16, height: 16, color: 'var(--app-text-muted)' }} />
            </button>
          )}
          <div>
            <h1 style={{ color: 'var(--app-text-primary)', fontSize: isMobile ? 20 : undefined, marginBottom: 2 }}>Workspace</h1>
            <p style={{ fontSize: 13, color: 'var(--app-text-muted)' }}>Manage your business workspace and team</p>
          </div>
        </div>

        {/* ── Workspace header card ─────────────────────── */}
        <div style={{
          background: 'var(--app-card)', border: '1px solid var(--app-border)',
          borderRadius: 18, padding: '20px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          {/* Logo / avatar */}
          <div style={{
            width: 56, height: 56, borderRadius: 16, flexShrink: 0,
            background: 'var(--app-btn-primary-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Building2 style={{ width: 24, height: 24, color: 'var(--app-btn-primary-fg)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--app-text-primary)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {companyName}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--app-text-muted)', marginBottom: 6 }}>
              Owner: <span style={{ color: 'var(--app-text-secondary)', fontWeight: 500 }}>{accountEmail}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 12, color: 'var(--app-text-muted)',
                background: 'var(--app-subtle-bg)', padding: '3px 9px', borderRadius: 20,
              }}>
                <Users style={{ width: 11, height: 11 }} />
                {totalMembers} {totalMembers === 1 ? 'Member' : 'Members'}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--app-text-faint)', fontFamily: 'monospace', letterSpacing: 0.5 }}>
                {workspaceId(currentUser.id)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Workspace Info ────────────────────────────── */}
        <Section title="Workspace Information">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FieldBlock label="Business Name">
              <input
                type="text"
                value={editName}
                onChange={e => { setEditName(e.target.value); setInfoDirty(true); }}
                style={{
                  width: '100%', padding: '10px 13px', fontSize: 14,
                  background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)',
                  borderRadius: 10, color: 'var(--app-text-primary)', outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
              />
            </FieldBlock>

            <FieldBlock label="Workspace ID" hint="Auto-generated · used for future sync">
              <input
                readOnly
                value={workspaceId(currentUser.id)}
                style={{
                  width: '100%', padding: '10px 13px', fontSize: 13,
                  background: 'var(--app-subtle-bg)', border: '1px solid var(--app-border)',
                  borderRadius: 10, color: 'var(--app-text-muted)', outline: 'none',
                  boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: 0.5, cursor: 'default',
                }}
              />
            </FieldBlock>

            {infoDirty && (
              <button onClick={saveInfo} style={{
                padding: '10px 22px', fontSize: 13.5, fontWeight: 600, alignSelf: 'flex-start',
                background: 'var(--app-btn-primary-bg)', color: 'var(--app-btn-primary-fg)',
                border: 'none', borderRadius: 11, cursor: 'pointer',
              }}>
                Save Changes
              </button>
            )}
          </div>
        </Section>

        {/* ── Team Members ──────────────────────────────── */}
        <Section title="Team Members" action={
          <button onClick={() => setShowInvite(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', fontSize: 13, fontWeight: 600,
            background: 'var(--app-btn-primary-bg)', color: 'var(--app-btn-primary-fg)',
            border: 'none', borderRadius: 10, cursor: 'pointer',
          }}>
            <Plus style={{ width: 13, height: 13 }} />
            Invite
          </button>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Owner row */}
            <MemberCard
              member={{ id: 'owner', email: accountEmail, role: 'owner', joinedAt: currentUser.createdAt }}
              isOwner
              onEditRole={() => {}}
              onRemove={() => {}}
            />

            {/* Members */}
            {members.map(m => (
              <MemberCard
                key={m.id}
                member={m}
                onEditRole={() => setEditingMember(m)}
                onRemove={() => handleRemove(m.id)}
              />
            ))}

            {members.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '28px 0',
                color: 'var(--app-text-muted)', fontSize: 13.5,
                border: '1.5px dashed var(--app-border)', borderRadius: 14,
              }}>
                <Users style={{ width: 28, height: 28, color: 'var(--app-text-faint)', margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 500, marginBottom: 4 }}>No team members yet</div>
                <div style={{ fontSize: 12.5 }}>Invite colleagues to collaborate on this workspace.</div>
              </div>
            )}
          </div>
        </Section>

        {/* ── Role Reference ────────────────────────────── */}
        <Section title="Roles & Permissions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['owner', 'manager', 'member'] as const).map(role => {
              const cfg = ROLE_CONFIG[role];
              return (
                <div key={role} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', background: 'var(--app-card)',
                  border: '1px solid var(--app-border)', borderRadius: 12,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: cfg.bg, color: cfg.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <cfg.icon style={{ width: 15, height: 15 }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--app-text-primary)' }}>{cfg.label}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--app-text-muted)' }}>{cfg.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── Recent Activity ───────────────────────────── */}
        <Section title="Recent Activity">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {activity.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 0',
                borderBottom: i < activity.length - 1 ? '1px solid var(--app-border-subtle)' : 'none',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: 'var(--app-subtle-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <item.Icon style={{ width: 14, height: 14, color: 'var(--app-text-muted)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--app-text-primary)', marginBottom: 2 }}>
                    {item.text}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--app-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    by {item.by}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <Clock style={{ width: 11, height: 11, color: 'var(--app-text-faint)' }} />
                  <span style={{ fontSize: 11.5, color: 'var(--app-text-faint)' }}>{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── Modals ─────────────────────────────────────── */}
      {showInvite && (
        <InviteModal
          isMobile={isMobile}
          onConfirm={handleInvite}
          onClose={() => setShowInvite(false)}
        />
      )}
      {editingMember && (
        <EditRoleModal
          member={editingMember}
          isMobile={isMobile}
          onConfirm={role => handleEditRole(editingMember.id, role)}
          onClose={() => setEditingMember(null)}
        />
      )}
    </div>
  );
}

// ─── Layout helpers ────────────────────────────────────────────────────────────

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--app-text-muted)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function FieldBlock({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 7 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--app-text-secondary)' }}>{label}</label>
        {hint && <span style={{ fontSize: 11.5, color: 'var(--app-text-faint)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
