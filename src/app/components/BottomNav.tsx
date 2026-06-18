import type { ElementType } from 'react';
import { LayoutDashboard, Receipt, Users, CalendarDays, Settings } from 'lucide-react';
import type { Screen } from '../App';

interface Props {
  current: Screen;
  onNavigate: (s: Screen) => void;
}

const ITEMS: { id: Screen; label: string; Icon: ElementType }[] = [
  { id: 'dashboard', label: 'Attendance', Icon: LayoutDashboard },
  { id: 'payroll',   label: 'Payroll',    Icon: Receipt },
  { id: 'employees', label: 'Team',       Icon: Users },
  { id: 'holidays',  label: 'Holidays',   Icon: CalendarDays },
  { id: 'settings',  label: 'Settings',   Icon: Settings },
];

export function BottomNav({ current, onNavigate }: Props) {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--app-card)',
        borderTop: '1px solid var(--app-border)',
        display: 'flex',
        zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {ITEMS.map(({ id, label, Icon }) => {
        const active = current === id;
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: '10px 4px 8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: active ? 'var(--app-nav-active-color)' : 'var(--app-text-muted)',
              minHeight: 56,
              position: 'relative',
            }}
          >
            {active && (
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '20%',
                  right: '20%',
                  height: 2,
                  background: 'var(--app-btn-primary-bg)',
                  borderRadius: '0 0 2px 2px',
                }}
              />
            )}
            <Icon style={{ width: 22, height: 22 }} />
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, letterSpacing: '0.01em' }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
