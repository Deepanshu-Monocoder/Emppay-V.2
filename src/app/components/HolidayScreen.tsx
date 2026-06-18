import { useState } from 'react';
import { Plus, Trash2, CalendarDays } from 'lucide-react';
import { SyncIndicator } from './SyncIndicator';
import { toast } from 'sonner';
import { useIsMobile } from '../hooks/useIsMobile';
import type { Holiday } from '../App';

interface Props {
  holidays: Holiday[];
  onUpdateHolidays: (holidays: Holiday[]) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHolidayDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    day: d.getDate(),
    monthShort: MONTH_NAMES[d.getMonth()].slice(0, 3),
    month: d.getMonth(),
    year: d.getFullYear(),
    dayName: DAY_NAMES[d.getDay()],
  };
}

function groupByMonth(holidays: Holiday[]): Record<string, Holiday[]> {
  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
  const groups: Record<string, Holiday[]> = {};
  sorted.forEach(h => {
    const d = new Date(h.date + 'T00:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(h);
  });
  return groups;
}

export function HolidayScreen({ holidays, onUpdateHolidays }: Props) {
  const isMobile = useIsMobile();
  const [addDate, setAddDate] = useState('');
  const [addName, setAddName] = useState('');
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAdd = () => {
    if (!addDate) { setError('Please select a date.'); return; }
    if (!addName.trim()) { setError('Please enter a holiday name.'); return; }
    if (holidays.some(h => h.date === addDate)) { setError('A holiday is already set for this date.'); return; }

    onUpdateHolidays([
      ...holidays,
      { id: String(Date.now()), name: addName.trim(), date: addDate },
    ]);
    toast.success(`${addName.trim()} added as holiday`);
    setAddDate('');
    setAddName('');
    setError('');
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    const holiday = holidays.find(h => h.id === id);
    onUpdateHolidays(holidays.filter(h => h.id !== id));
    if (holiday) toast.success(`${holiday.name} removed`);
  };

  const groups = groupByMonth(holidays);

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    background: 'var(--app-input-bg)',
    border: '1px solid var(--app-input-border)',
    borderRadius: 10,
    color: 'var(--app-text-primary)',
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ padding: isMobile ? '20px 16px 16px' : '32px 36px', maxWidth: isMobile ? '100%' : 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div>
          <h1 style={{ color: 'var(--app-text-primary)', marginBottom: 2, fontSize: isMobile ? 20 : undefined }}>Holidays</h1>
          <p style={{ fontSize: 13, color: 'var(--app-text-muted)' }}>
            {holidays.length} holidays · Sundays off by default
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SyncIndicator />
          <button
          onClick={() => { setShowAddForm(!showAddForm); setError(''); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', fontSize: 13.5, fontWeight: 600,
            background: showAddForm ? 'var(--app-btn-secondary-bg)' : 'var(--app-btn-primary-bg)',
            color: showAddForm ? 'var(--app-btn-secondary-fg)' : 'var(--app-btn-primary-fg)',
            border: showAddForm ? '1px solid var(--app-btn-secondary-border)' : 'none',
            borderRadius: 12,
            cursor: 'pointer',
          }}
        >
          <Plus style={{ width: 15, height: 15 }} />
          Add Holiday
        </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div style={{ background: 'var(--app-card)', border: '1px solid var(--app-border)', borderRadius: 16, padding: '20px 24px', marginBottom: 24 }}>
          <h4 style={{ color: 'var(--app-text-primary)', marginBottom: 14 }}>New Holiday</h4>
          {error && (
            <div style={{ background: '#FEF2F2', color: '#DC2626', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10, alignItems: isMobile ? 'stretch' : 'flex-end' }}>
            <div style={{ flex: isMobile ? undefined : '0 0 160px' }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: 5 }}>Date</label>
              <input
                type="date"
                value={addDate}
                onChange={e => { setAddDate(e.target.value); setError(''); }}
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: 5 }}>Holiday Name</label>
              <input
                type="text"
                value={addName}
                onChange={e => { setAddName(e.target.value); setError(''); }}
                placeholder="e.g. Diwali"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
                onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              />
            </div>
            <button
              onClick={handleAdd}
              style={{ padding: '9px 20px', fontSize: 13.5, fontWeight: 600, background: 'var(--app-btn-primary-bg)', color: 'var(--app-btn-primary-fg)', border: 'none', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Holiday list */}
      {Object.keys(groups).length === 0 ? (
        <div style={{ background: 'var(--app-card)', border: '1px solid var(--app-border)', borderRadius: 16, padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, background: 'var(--app-subtle-bg)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <CalendarDays style={{ width: 22, height: 22, color: 'var(--app-text-muted)' }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 4 }}>No holidays added</div>
          <div style={{ fontSize: 13, color: 'var(--app-text-muted)' }}>Add public holidays to exclude them from absence calculations.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.entries(groups).map(([monthKey, monthHolidays]) => {
            const [y, m] = monthKey.split('-').map(Number);
            return (
              <div key={monthKey}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  {MONTH_NAMES[m - 1]} {y}
                </div>
                <div style={{ background: 'var(--app-card)', border: '1px solid var(--app-border)', borderRadius: 16, overflow: 'hidden' }}>
                  {monthHolidays.map((h, i) => {
                    const fmt = formatHolidayDate(h.date);
                    return (
                      <div
                        key={h.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 20px', borderBottom: i === monthHolidays.length - 1 ? 'none' : '1px solid var(--app-border-subtle)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--app-card-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* Date badge */}
                        <div style={{ width: 48, padding: '6px 0', background: 'var(--app-subtle-bg)', borderRadius: 10, flexShrink: 0, textAlign: 'center' }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--app-text-primary)', lineHeight: 1 }}>{fmt.day}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--app-text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>{fmt.monthShort}</div>
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--app-text-primary)' }}>{h.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginTop: 1 }}>{fmt.dayName}</div>
                        </div>

                        <span style={{ padding: '3px 10px', fontSize: 11.5, fontWeight: 500, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 20, color: '#EA580C', flexShrink: 0 }}>
                          Public Holiday
                        </span>

                        <button
                          onClick={() => handleDelete(h.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-text-muted)', padding: 4, borderRadius: 6, marginLeft: 4 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#DC2626'; (e.currentTarget as HTMLElement).style.background = '#FEF2F2'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)'; (e.currentTarget as HTMLElement).style.background = 'none'; }}
                        >
                          <Trash2 style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Note */}
      <div style={{ marginTop: 24, padding: '14px 18px', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>ℹ️</span>
        <p style={{ fontSize: 12.5, color: '#0369A1', margin: 0, lineHeight: 1.6 }}>
          Holidays are automatically excluded from attendance counts and payroll calculations.
          Sundays are always excluded when "Sunday Off" is enabled in Settings.
        </p>
      </div>
    </div>
  );
}
