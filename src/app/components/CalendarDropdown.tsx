import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

interface Props {
  selectedDate: string;
  maxDate?: string;
  onChange: (date: string) => void;
  displayFormat?: 'full' | 'short';
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDisplayDate(dateStr: string, format: 'full' | 'short'): { dayName: string; monthName: string; day: number; year: number; month: number } {
  const d = new Date(dateStr + 'T00:00:00');
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return {
    dayName: format === 'full' ? DAY_NAMES[d.getDay()] : DAY_NAMES_SHORT[d.getDay()],
    monthName: format === 'full' ? MONTHS[d.getMonth()] : MONTHS_SHORT[d.getMonth()],
    day: d.getDate(),
    month: d.getMonth(),
    year: d.getFullYear(),
  };
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function CalendarDropdown({ selectedDate, maxDate, onChange, displayFormat = 'full' }: Props) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fmt = formatDisplayDate(selectedDate, displayFormat);
  const [selectedDay, setSelectedDay] = useState(fmt.day);
  const [selectedMonth, setSelectedMonth] = useState(fmt.month);
  const [selectedYear, setSelectedYear] = useState(fmt.year);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 26 }, (_, i) => currentYear - 20 + i);
  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);

  useEffect(() => {
    if (!isMobile && isOpen) {
      function handleClickOutside(event: MouseEvent) {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, isMobile]);

  useEffect(() => {
    if (isOpen) {
      const fmt = formatDisplayDate(selectedDate, displayFormat);
      setSelectedDay(fmt.day);
      setSelectedMonth(fmt.month);
      setSelectedYear(fmt.year);
    }
  }, [isOpen, selectedDate, displayFormat]);

  // Adjust day if it exceeds days in selected month
  useEffect(() => {
    const maxDays = getDaysInMonth(selectedYear, selectedMonth);
    if (selectedDay > maxDays) {
      setSelectedDay(maxDays);
    }
  }, [selectedYear, selectedMonth, selectedDay]);

  const handleApply = () => {
    const newDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    onChange(newDate);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setIsOpen(false);
  };

  // Button
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          textAlign: 'center',
          padding: '6px 14px',
          background: 'var(--app-card)',
          border: '1px solid var(--app-input-border)',
          borderRadius: 10,
          minWidth: isMobile ? 130 : 160,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          justifyContent: 'center',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: isMobile ? 12.5 : 13.5, fontWeight: 600, color: 'var(--app-text-primary)' }}>
            {fmt.dayName}, {fmt.monthName} {fmt.day}
          </div>
          <div style={{ fontSize: 11, color: 'var(--app-text-muted)' }}>{fmt.year}</div>
        </div>
        <ChevronDown style={{ width: 14, height: 14, color: 'var(--app-text-muted)', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--app-overlay)',
              zIndex: 100,
            }}
            onClick={() => setIsOpen(false)}
          />

          {/* Picker Panel */}
          <div
            ref={dropdownRef}
            onClick={e => e.stopPropagation()}
            style={{
              position: isMobile ? 'fixed' : 'absolute',
              ...(isMobile ? {
                bottom: 0,
                left: 0,
                right: 0,
                borderRadius: '20px 20px 0 0',
              } : {
                top: '100%',
                right: 0,
                marginTop: 4,
                borderRadius: 12,
              }),
              background: 'var(--app-modal-bg)',
              border: '1px solid var(--app-border)',
              padding: isMobile ? '24px 20px 32px' : 16,
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              zIndex: 101,
              width: isMobile ? '100%' : 280,
              maxHeight: isMobile ? '80vh' : 'auto',
            }}
          >
            {/* Drag handle on mobile */}
            {isMobile && (
              <div style={{ width: 36, height: 4, background: 'var(--app-border)', borderRadius: 2, margin: '0 auto 20px' }} />
            )}

            {/* Title */}
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--app-text-primary)', margin: '0 0 16px 0', textAlign: isMobile ? 'center' : 'left' }}>
              Select Date
            </h3>

            {/* Dropdown Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {/* Month */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: 6 }}>
                  Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 14,
                    border: '1px solid var(--app-input-border)',
                    borderRadius: 8,
                    background: 'var(--app-input-bg)',
                    color: 'var(--app-text-primary)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {MONTHS.map((month, idx) => (
                    <option key={idx} value={idx}>{month}</option>
                  ))}
                </select>
              </div>

              {/* Year */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: 6 }}>
                  Year
                </label>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 14,
                    border: '1px solid var(--app-input-border)',
                    borderRadius: 8,
                    background: 'var(--app-input-bg)',
                    color: 'var(--app-text-primary)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--app-text-muted)', marginBottom: 6 }}>
                  Date
                </label>
                <select
                  value={selectedDay}
                  onChange={e => setSelectedDay(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 14,
                    border: '1px solid var(--app-input-border)',
                    borderRadius: 8,
                    background: 'var(--app-input-bg)',
                    color: 'var(--app-text-primary)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleCancel}
                style={{
                  flex: 1,
                  padding: isMobile ? '12px 0' : '10px 0',
                  fontSize: 14,
                  fontWeight: 500,
                  background: 'var(--app-btn-secondary-bg)',
                  border: '1px solid var(--app-btn-secondary-border)',
                  borderRadius: 10,
                  color: 'var(--app-btn-secondary-fg)',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                style={{
                  flex: 1,
                  padding: isMobile ? '12px 0' : '10px 0',
                  fontSize: 14,
                  fontWeight: 600,
                  background: 'var(--app-btn-primary-bg)',
                  border: 'none',
                  borderRadius: 10,
                  color: 'var(--app-btn-primary-fg)',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
