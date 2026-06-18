import { useIsMobile } from '../hooks/useIsMobile';
import type { Employee, AttendanceRecord, MainStatus, SubStatus } from '../App';
import { ProfilePhoto } from './ProfilePhoto';

interface Props {
  employee: Employee;
  record: AttendanceRecord;
  onUpdate: (record: AttendanceRecord) => void;
  onNavigateToProfile?: () => void;
}

const BADGE: Record<SubStatus, { label: string; bg: string; color: string; border: string }> = {
  'full-day':     { label: 'Full Day',     bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
  'half-day':     { label: 'Half Day',     bg: '#FEFCE8', color: '#CA8A04', border: '#FDE68A' },
  'paid-leave':   { label: 'Paid Leave',   bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  'sick-leave':   { label: 'Sick Leave',   bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA' },
  'unpaid-leave': { label: 'Unpaid Leave', bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  'other':        { label: 'Other',        bg: '#F9FAFB', color: '#6B7280', border: '#E5E7EB' },
};

function StatusBadge({ record }: { record: AttendanceRecord }) {
  if (!record.mainStatus) {
    return <span style={{ fontSize: 11.5, color: 'var(--app-text-faint)', fontStyle: 'italic' }}>Not Marked</span>;
  }
  if (record.subStatus && BADGE[record.subStatus]) {
    const c = BADGE[record.subStatus];
    return (
      <span style={{
        padding: '3px 10px', fontSize: 11.5, fontWeight: 600,
        background: c.bg, color: c.color, border: `1px solid ${c.border}`,
        borderRadius: 20, whiteSpace: 'nowrap',
      }}>
        {c.label}
      </span>
    );
  }
  return <span style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>—</span>;
}

function Pill({
  label, active, onClick,
  activeBg, activeColor,
  grow = false,
}: {
  label: string; active: boolean; onClick: () => void;
  activeBg: string; activeColor: string; grow?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: grow ? 1 : undefined,
        padding: '7px 14px',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        background: active ? activeBg : 'var(--app-pill-inactive-bg)',
        color: active ? activeColor : 'var(--app-pill-inactive-color)',
        border: `1px solid ${active ? activeBg : 'var(--app-pill-inactive-border)'}`,
        borderRadius: 20,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.1s',
      }}
    >
      {label}
    </button>
  );
}

const PRESENT_SUBS = [
  { key: 'full-day' as SubStatus,  label: 'Full Day',  activeBg: '#16A34A', activeColor: '#fff' },
  { key: 'half-day' as SubStatus,  label: 'Half Day',  activeBg: '#CA8A04', activeColor: '#fff' },
];

const ABSENT_SUBS = [
  { key: 'paid-leave'   as SubStatus, label: 'Paid Leave',   activeBg: '#2563EB', activeColor: '#fff' },
  { key: 'sick-leave'   as SubStatus, label: 'Sick Leave',   activeBg: '#EA580C', activeColor: '#fff' },
  { key: 'unpaid-leave' as SubStatus, label: 'Unpaid Leave', activeBg: '#DC2626', activeColor: '#fff' },
  { key: 'other'        as SubStatus, label: 'Other',        activeBg: '#6B7280', activeColor: '#fff' },
];

export function AttendanceRow({ employee, record, onUpdate, onNavigateToProfile }: Props) {
  const isMobile = useIsMobile();

  const setMain = (main: MainStatus) => {
    if (record.mainStatus === main) { onUpdate({ mainStatus: null, subStatus: null, reason: undefined }); return; }
    onUpdate({ mainStatus: main, subStatus: main === 'present' ? 'full-day' : 'paid-leave', reason: undefined });
  };
  const setSub = (sub: SubStatus) => {
    if (sub !== 'other') {
      onUpdate({ ...record, subStatus: sub, reason: undefined });
    } else {
      onUpdate({ ...record, subStatus: sub });
    }
  };
  const setReason = (reason: string) => onUpdate({ ...record, reason: reason || undefined });

  const subList = record.mainStatus === 'present' ? PRESENT_SUBS : record.mainStatus === 'absent' ? ABSENT_SUBS : [];
  const showReasonInput = record.subStatus === 'other';

  if (isMobile) {
    return (
      <div
        style={{
          background: 'var(--app-card)',
          borderRadius: 14,
          border: '1px solid var(--app-border)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Name row — photo+name clickable, badge independent */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onNavigateToProfile ? (
            <button
              onClick={onNavigateToProfile}
              style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
            >
              <ProfilePhoto name={employee.name} photoUrl={employee.profilePhoto} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-text-primary)', lineHeight: 1.2 }}>
                  {employee.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginTop: 1 }}>
                  {employee.department}
                </div>
              </div>
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <ProfilePhoto name={employee.name} photoUrl={employee.profilePhoto} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-text-primary)', lineHeight: 1.2 }}>
                  {employee.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginTop: 1 }}>
                  {employee.department}
                </div>
              </div>
            </div>
          )}
          <StatusBadge record={record} />
        </div>

        {/* Main toggle */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setMain('present')}
            style={{
              flex: 1,
              padding: '10px 0',
              fontSize: 13.5,
              fontWeight: 600,
              borderRadius: 10,
              border: `1.5px solid ${record.mainStatus === 'present' ? '#BBF7D0' : 'var(--app-input-border)'}`,
              background: record.mainStatus === 'present' ? '#F0FDF4' : 'var(--app-input-bg)',
              color: record.mainStatus === 'present' ? '#16A34A' : 'var(--app-text-muted)',
              cursor: 'pointer',
            }}
          >
            Present
          </button>
          <button
            onClick={() => setMain('absent')}
            style={{
              flex: 1,
              padding: '10px 0',
              fontSize: 13.5,
              fontWeight: 600,
              borderRadius: 10,
              border: `1.5px solid ${record.mainStatus === 'absent' ? '#FECACA' : 'var(--app-input-border)'}`,
              background: record.mainStatus === 'absent' ? '#FEF2F2' : 'var(--app-input-bg)',
              color: record.mainStatus === 'absent' ? '#DC2626' : 'var(--app-text-muted)',
              cursor: 'pointer',
            }}
          >
            Absent
          </button>
        </div>

        {/* Sub-status pills */}
        {subList.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {subList.map(s => (
              <Pill
                key={s.key}
                label={s.label}
                active={record.subStatus === s.key}
                onClick={() => setSub(s.key)}
                activeBg={s.activeBg}
                activeColor={s.activeColor}
                grow
              />
            ))}
          </div>
        )}

        {/* Reason input for "Other" */}
        {showReasonInput && (
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: 6 }}>
              Reason (Optional)
            </label>
            <input
              type="text"
              value={record.reason || ''}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g., Vehicle Breakdown, Family Emergency"
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: 13,
                background: 'var(--app-input-bg)',
                border: '1px solid var(--app-input-border)',
                borderRadius: 8,
                outline: 'none',
                boxSizing: 'border-box',
                color: 'var(--app-text-primary)',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
              onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
            />
          </div>
        )}
      </div>
    );
  }

  // ── Desktop layout ──────────────────────────────────────────
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 24px',
        borderBottom: '1px solid var(--app-border-subtle)',
        minHeight: 60,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--app-card-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Name — photo+name clickable */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 200, flexShrink: 0 }}>
        {onNavigateToProfile ? (
          <button
            onClick={onNavigateToProfile}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
          >
            <ProfilePhoto name={employee.name} photoUrl={employee.profilePhoto} size={34} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--app-text-primary)', lineHeight: 1.3 }}>
                {employee.name}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--app-text-muted)' }}>{employee.department}</div>
            </div>
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ProfilePhoto name={employee.name} photoUrl={employee.profilePhoto} size={34} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--app-text-primary)', lineHeight: 1.3 }}>
                {employee.name}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--app-text-muted)' }}>{employee.department}</div>
            </div>
          </div>
        )}
      </div>

      {/* Main pills */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <Pill label="Present" active={record.mainStatus === 'present'} onClick={() => setMain('present')} activeBg="#DCFCE7" activeColor="#15803D" />
        <Pill label="Absent"  active={record.mainStatus === 'absent'}  onClick={() => setMain('absent')}  activeBg="#FEE2E2" activeColor="#B91C1C" />
      </div>

      {/* Sub pills */}
      <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        {subList.map(s => (
          <Pill
            key={s.key}
            label={s.label}
            active={record.subStatus === s.key}
            onClick={() => setSub(s.key)}
            activeBg={s.activeBg}
            activeColor={s.activeColor}
          />
        ))}
        {showReasonInput && (
          <input
            type="text"
            value={record.reason || ''}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason (Optional)"
            style={{
              flex: 1,
              minWidth: 200,
              padding: '7px 12px',
              fontSize: 12,
              background: 'var(--app-input-bg)',
              border: '1px solid var(--app-input-border)',
              borderRadius: 8,
              outline: 'none',
              color: 'var(--app-text-primary)',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
            onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
          />
        )}
      </div>

      {/* Badge */}
      <div style={{ flexShrink: 0, width: 110, textAlign: 'right' }}>
        <StatusBadge record={record} />
      </div>
    </div>
  );
}
