import { useState, type ElementType, type ReactNode } from 'react';
import { Check, LogOut, Sun, Moon, Monitor, Lock, Upload, X, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '../hooks/useIsMobile';
import type { Settings, OtherAbsenceHandling, BrandingMode } from '../App';
import type { UserProfile } from './UserSelectScreen';
import { useTheme, type ThemePreference } from '../contexts/ThemeContext';
import { getWorkingDays, getSundayCount } from '../utils/attendanceEngine';

interface Props {
  settings: Settings;
  onUpdateSettings: (settings: Settings) => void;
  currentUser: UserProfile;
  onSwitchUser: () => void;
}

const CURRENCY_OPTIONS = [
  { value: 'INR', label: '₹ Indian Rupee (INR)' },
  { value: 'USD', label: '$ US Dollar (USD)' },
  { value: 'EUR', label: '€ Euro (EUR)' },
  { value: 'GBP', label: '£ British Pound (GBP)' },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative rounded-full transition-colors flex-shrink-0"
      style={{
        width: 44,
        height: 24,
        background: checked ? 'var(--app-btn-primary-bg)' : 'var(--app-border)',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <span
        className="absolute rounded-full transition-transform"
        style={{
          width: 18,
          height: 18,
          background: checked ? 'var(--app-btn-primary-fg)' : 'var(--app-card)',
          top: 3,
          left: checked ? 23 : 3,
        }}
      />
    </button>
  );
}

function Field({ label, hint, children, isMobile, toggleRow }: { label: string; hint?: string; children: ReactNode; isMobile?: boolean; toggleRow?: boolean }) {
  return (
    <div
      style={{
        padding: '16px 0',
        borderBottom: '1px solid var(--app-border-subtle)',
        display: 'flex',
        flexDirection: (isMobile && !toggleRow) ? 'column' : 'row',
        alignItems: (isMobile && !toggleRow) ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: (isMobile && !toggleRow) ? 8 : 0,
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--app-text-primary)' }}>{label}</div>
        {hint && <div style={{ fontSize: 12.5, color: 'var(--app-text-muted)', marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ marginLeft: (isMobile && !toggleRow) ? 0 : 24, width: (isMobile && !toggleRow) ? '100%' : 'auto' }}>{children}</div>
    </div>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: ElementType }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function WorkingDaysPreview() {
  const now = new Date();
  const months = [0, 1, 2].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset - 1, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const dim = new Date(y, m + 1, 0).getDate();
    const sundays = getSundayCount(y, m);
    const workingDays = getWorkingDays(y, m);
    return { label: `${MONTH_NAMES[m]} ${y}`, dim, sundays, workingDays, isCurrent: offset === 1 };
  });

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {months.map(({ label, dim, sundays, workingDays, isCurrent }) => (
        <div key={label} style={{
          flex: 1,
          minWidth: 0,
          background: isCurrent ? 'var(--app-nav-active-bg)' : 'var(--app-input-bg)',
          border: `1px solid ${isCurrent ? 'var(--app-btn-primary-bg)' : 'var(--app-border)'}`,
          borderRadius: 10,
          padding: '10px 12px',
        }}>
          <div style={{ fontSize: 11, color: 'var(--app-text-muted)', marginBottom: 6, fontWeight: isCurrent ? 600 : 400 }}>
            {label}{isCurrent ? ' · Current' : ''}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: isCurrent ? 'var(--app-btn-primary-bg)' : 'var(--app-text-primary)' }}>
            {workingDays}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--app-text-muted)', marginTop: 3 }}>
            {dim} days − {sundays} Sunday{sundays !== 1 ? 's' : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SettingsScreen({ settings, onUpdateSettings, currentUser, onSwitchUser }: Props) {
  const isMobile = useIsMobile();
  const [local, setLocal] = useState<Settings>({ ...settings });
  const [saved, setSaved] = useState(false);
  const { theme, setTheme } = useTheme();

  const update = (patch: Partial<Settings>) => {
    setLocal(prev => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const handleSave = () => {
    onUpdateSettings(local);
    setSaved(true);
    toast.success('Settings saved successfully');
    setTimeout(() => setSaved(false), 2500);
  };

  const inputStyle = {
    padding: '8px 12px',
    fontSize: 13.5,
    background: 'var(--app-input-bg)',
    border: '1px solid var(--app-input-border)',
    borderRadius: 8,
    color: 'var(--app-text-primary)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  };

  const sectionStyle = {
    background: 'var(--app-card)',
    border: '1px solid var(--app-border)',
    borderRadius: 16,
    padding: isMobile ? '4px 16px' : '4px 24px',
    marginBottom: 20,
  };

  const sectionLabel = {
    fontSize: 11.5,
    fontWeight: 700,
    color: 'var(--app-text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.07em',
    padding: '16px 0 4px',
  };

  return (
    <div style={{ padding: isMobile ? '20px 16px 16px' : '32px 36px', maxWidth: 640, margin: '0 auto' }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 style={{ color: 'var(--app-text-primary)', marginBottom: 2, fontSize: isMobile ? 20 : undefined }}>Settings</h1>
          <p style={{ fontSize: 13.5, color: 'var(--app-text-muted)' }}>Configure your workspace preferences</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 rounded-xl transition"
          style={{
            padding: isMobile ? '9px 14px' : '9px 20px',
            fontSize: 13.5,
            fontWeight: 600,
            background: saved ? '#16A34A' : 'var(--app-btn-primary-bg)',
            color: saved ? '#fff' : 'var(--app-btn-primary-fg)',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {saved ? <Check style={{ width: 15, height: 15 }} /> : null}
          {saved ? 'Saved!' : isMobile ? 'Save' : 'Save Changes'}
        </button>
      </div>

      {/* Appearance section */}
      <div style={sectionStyle}>
        <div style={sectionLabel}>Appearance</div>
        <div style={{ padding: '14px 0' }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--app-text-primary)', marginBottom: 4 }}>Theme</div>
          <div style={{ fontSize: 12.5, color: 'var(--app-text-muted)', marginBottom: 12 }}>Choose how the app looks on your device</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
              const active = theme === value;
              return (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    padding: '12px 8px',
                    borderRadius: 12,
                    border: `2px solid ${active ? 'var(--app-btn-primary-bg)' : 'var(--app-border)'}`,
                    background: active ? 'var(--app-nav-active-bg)' : 'var(--app-input-bg)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <Icon style={{ width: 18, height: 18, color: active ? 'var(--app-btn-primary-bg)' : 'var(--app-text-muted)' }} />
                  <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? 'var(--app-text-primary)' : 'var(--app-text-muted)' }}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Company section */}
      <div style={sectionStyle}>
        <div style={sectionLabel}>Company</div>

        <Field label="Company Name" hint="Shown in the sidebar and on payslips" isMobile={isMobile}>
          <input
            type="text"
            value={local.companyName}
            onChange={e => update({ companyName: e.target.value })}
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')}
            onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')}
          />
        </Field>

        <Field label="Currency" hint="Used for salary display across the app" isMobile={isMobile}>
          <select
            value={local.currency}
            onChange={e => update({ currency: e.target.value })}
            style={inputStyle}
          >
            {CURRENCY_OPTIONS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Attendance section */}
      <div style={sectionStyle}>
        <div style={sectionLabel}>Attendance</div>

        {/* Live Working Days Preview */}
        <div style={{ padding: '16px 0' }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--app-text-primary)', marginBottom: 4 }}>Working Days</div>
          <div style={{ fontSize: 12.5, color: 'var(--app-text-muted)', marginBottom: 12 }}>Auto-calculated · working days = total days − Sundays (holidays included in count)</div>
          <WorkingDaysPreview />
        </div>
      </div>

      {/* Payroll Rules section */}
      <div style={sectionStyle}>
        <div style={sectionLabel}>Payroll Rules</div>

        {/* Holiday Payable */}
        <Field label="Holiday Payable" hint="Public holidays count as payable days in salary calculation" isMobile={isMobile} toggleRow>
          <Toggle checked={local.holidayPayable} onChange={v => update({ holidayPayable: v })} />
        </Field>

        {/* Half Day Value */}
        <Field label="Half Day Value" hint="How many payable days a half day attendance counts as" isMobile={isMobile}>
          <div style={{ display: 'flex', gap: 6 }}>
            {([0.25, 0.5, 0.75, 1.0] as const).map(v => (
              <button
                key={v}
                onClick={() => update({ halfDayValue: v })}
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: local.halfDayValue === v ? 700 : 400,
                  borderRadius: 8,
                  border: `1.5px solid ${local.halfDayValue === v ? 'var(--app-btn-primary-bg)' : 'var(--app-border)'}`,
                  background: local.halfDayValue === v ? 'var(--app-nav-active-bg)' : 'var(--app-input-bg)',
                  color: local.halfDayValue === v ? 'var(--app-text-primary)' : 'var(--app-text-muted)',
                  cursor: 'pointer',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </Field>

        {/* Paid Leave */}
        <Field label="Paid Leave = full pay" hint="When off, paid leave is treated as unpaid" isMobile={isMobile} toggleRow>
          <Toggle checked={local.paidLeaveFullPay} onChange={v => update({ paidLeaveFullPay: v })} />
        </Field>

        {/* Sick Leave */}
        <Field label="Sick Leave = full pay" hint="When off, sick leave is treated as unpaid" isMobile={isMobile} toggleRow>
          <Toggle checked={local.sickLeaveFullPay} onChange={v => update({ sickLeaveFullPay: v })} />
        </Field>

        {/* Other Absence */}
        <Field label="Other Absence" hint="Pay rule applied to absences marked as 'Other'" isMobile={isMobile}>
          <div style={{ display: 'flex', gap: 6 }}>
            {([
              { value: 'full',   label: 'Full Pay' },
              { value: 'half',   label: 'Half Pay' },
              { value: 'unpaid', label: 'Unpaid'   },
            ] as { value: OtherAbsenceHandling; label: string }[]).map(opt => (
              <button
                key={opt.value}
                onClick={() => update({ otherAbsenceHandling: opt.value })}
                style={{
                  padding: '6px 12px',
                  fontSize: 12.5,
                  fontWeight: local.otherAbsenceHandling === opt.value ? 700 : 400,
                  borderRadius: 8,
                  border: `1.5px solid ${local.otherAbsenceHandling === opt.value ? 'var(--app-btn-primary-bg)' : 'var(--app-border)'}`,
                  background: local.otherAbsenceHandling === opt.value ? 'var(--app-nav-active-bg)' : 'var(--app-input-bg)',
                  color: local.otherAbsenceHandling === opt.value ? 'var(--app-text-primary)' : 'var(--app-text-muted)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Unpaid Leave — read-only */}
        <div style={{ padding: '14px 0', borderBottom: '1px solid var(--app-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--app-text-primary)' }}>Unpaid Leave</div>
            <div style={{ fontSize: 12.5, color: 'var(--app-text-muted)', marginTop: 2 }}>Always deducted from salary · not configurable</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8 }}>
            <Lock style={{ width: 11, height: 11, color: '#DC2626' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#DC2626' }}>Not Payable</span>
          </div>
        </div>

        {/* Not Marked — read-only */}
        <div style={{ padding: '14px 0', borderBottom: '1px solid var(--app-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--app-text-primary)' }}>Not Marked</div>
            <div style={{ fontSize: 12.5, color: 'var(--app-text-muted)', marginTop: 2 }}>Unmarked days are excluded from all calculations</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--app-subtle-bg)', border: '1px solid var(--app-border)', borderRadius: 8 }}>
            <Lock style={{ width: 11, height: 11, color: 'var(--app-text-muted)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text-muted)' }}>Excluded</span>
          </div>
        </div>
      </div>

      {/* Salary Formula section */}
      <div style={{ ...sectionStyle, marginBottom: 0 }}>
        <div style={sectionLabel}>Salary Formula Preview</div>
        <div style={{ padding: '14px 0' }}>
          <div style={{ fontSize: 12.5, color: 'var(--app-text-muted)', marginBottom: 10 }}>
            Live formula based on your current settings. Save to apply changes.
          </div>
          <div style={{ background: 'var(--app-input-bg)', border: '1px solid var(--app-border)', borderRadius: 10, padding: '12px 16px', fontFamily: 'monospace', fontSize: isMobile ? 11 : 12.5, color: 'var(--app-text-secondary)', lineHeight: 1.8, overflowX: 'auto' }}>
            <div style={{ color: 'var(--app-text-muted)', fontSize: isMobile ? 10 : 11, marginBottom: 4 }}>// payable days formula</div>
            <div>payable = full_days</div>
            <div style={{ paddingLeft: 12 }}>+ half_days × <strong>{local.halfDayValue}</strong></div>
            <div style={{ paddingLeft: 12, color: local.paidLeaveFullPay ? 'var(--app-text-secondary)' : '#9CA3AF' }}>
              {local.paidLeaveFullPay ? '+ paid_leaves × 1' : '+ paid_leaves × 0  // unpaid'}
            </div>
            <div style={{ paddingLeft: 12, color: local.sickLeaveFullPay ? 'var(--app-text-secondary)' : '#9CA3AF' }}>
              {local.sickLeaveFullPay ? '+ sick_leaves × 1' : '+ sick_leaves × 0  // unpaid'}
            </div>
            <div style={{ paddingLeft: 12 }}>
              + other_abs × <strong>
                {local.otherAbsenceHandling === 'full' ? 1 : local.otherAbsenceHandling === 'half' ? 0.5 : 0}
              </strong>
              {local.otherAbsenceHandling === 'half' ? '  // half pay' : local.otherAbsenceHandling === 'unpaid' ? '  // unpaid' : '  // full pay'}
            </div>
            <div style={{ paddingLeft: 12, color: local.holidayPayable ? 'var(--app-text-secondary)' : '#9CA3AF' }}>
              {local.holidayPayable ? '+ holidays × 1' : '+ holidays × 0  // not payable'}
            </div>
            <div style={{ marginTop: 8, borderTop: '1px solid var(--app-border-subtle)', paddingTop: 8 }}>
              working_days = days_in_month − sundays
            </div>
            <div>final_salary = (salary ÷ working_days) × payable</div>
            <div style={{ color: 'var(--app-text-muted)', fontSize: isMobile ? 10 : 11, marginTop: 4 }}>// sundays, unpaid_leaves, and not_marked always = 0</div>
          </div>
        </div>
      </div>

      {/* Company Branding section */}
      <div style={{ ...sectionStyle, marginTop: 20 }}>
        <div style={sectionLabel}>Company Branding</div>
        <div style={{ fontSize: 12.5, color: 'var(--app-text-muted)', marginBottom: 4, padding: '8px 0 0' }}>Used in PDF exports and payslips</div>

        {/* Branding mode */}
        <Field label="Branding Mode" hint="Choose how exports are branded" isMobile={isMobile}>
          <div style={{ display: 'flex', gap: 6 }}>
            {([
              { value: 'app-generated' as const, label: 'App Generated' },
              { value: 'custom' as const, label: 'Custom Letterhead' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => update({ brandingMode: opt.value })}
                style={{
                  padding: '6px 12px', fontSize: 12.5, whiteSpace: 'nowrap',
                  fontWeight: local.brandingMode === opt.value ? 700 : 400,
                  borderRadius: 8,
                  border: `1.5px solid ${local.brandingMode === opt.value ? 'var(--app-btn-primary-bg)' : 'var(--app-border)'}`,
                  background: local.brandingMode === opt.value ? 'var(--app-nav-active-bg)' : 'var(--app-input-bg)',
                  color: local.brandingMode === opt.value ? 'var(--app-text-primary)' : 'var(--app-text-muted)',
                  cursor: 'pointer',
                }}
              >{opt.label}</button>
            ))}
          </div>
        </Field>

        {(local.brandingMode ?? 'app-generated') === 'app-generated' && (
          <>
            {/* Company Logo */}
            <div style={{ padding: '16px 0', borderBottom: '1px solid var(--app-border-subtle)' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--app-text-primary)', marginBottom: 4 }}>Company Logo</div>
              <div style={{ fontSize: 12.5, color: 'var(--app-text-muted)', marginBottom: 10 }}>PNG or JPG, shown in PDF header</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {local.companyLogo ? (
                  <div style={{ position: 'relative' }}>
                    <img src={local.companyLogo} alt="Logo" style={{ height: 48, maxWidth: 120, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--app-border)' }} />
                    <button
                      onClick={() => update({ companyLogo: undefined })}
                      style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#DC2626', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                    >
                      <X style={{ width: 10, height: 10, color: '#fff' }} />
                    </button>
                  </div>
                ) : (
                  <div style={{ width: 80, height: 48, background: 'var(--app-input-bg)', border: '1px dashed var(--app-border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 style={{ width: 20, height: 20, color: 'var(--app-text-muted)' }} />
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 500, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: 'var(--app-text-secondary)', cursor: 'pointer' }}>
                  <Upload style={{ width: 13, height: 13 }} />
                  {local.companyLogo ? 'Change' : 'Upload'}
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    onClick={e => { (e.target as HTMLInputElement).value = ''; }}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const r = new FileReader();
                      r.onload = () => update({ companyLogo: r.result as string });
                      r.readAsDataURL(f);
                    }}
                  />
                </label>
              </div>
            </div>

            <Field label="Company Address" isMobile={isMobile}>
              <input type="text" value={local.companyAddress || ''} onChange={e => update({ companyAddress: e.target.value })} placeholder="123 Main St, City" style={inputStyle} onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')} onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')} />
            </Field>
            <Field label="Company Phone" isMobile={isMobile}>
              <input type="tel" value={local.companyPhone || ''} onChange={e => update({ companyPhone: e.target.value })} placeholder="+91 XXXXX XXXXX" style={inputStyle} onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')} onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')} />
            </Field>
            <Field label="Company Email" isMobile={isMobile}>
              <input type="email" value={local.companyEmail || ''} onChange={e => update({ companyEmail: e.target.value })} placeholder="info@company.com" style={inputStyle} onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')} onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')} />
            </Field>
            <Field label="Website" isMobile={isMobile}>
              <input type="text" value={local.companyWebsite || ''} onChange={e => update({ companyWebsite: e.target.value })} placeholder="www.company.com" style={inputStyle} onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')} onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')} />
            </Field>
            <Field label="GST Number" isMobile={isMobile}>
              <input type="text" value={local.companyGST || ''} onChange={e => update({ companyGST: e.target.value })} placeholder="22AAAAA0000A1Z5" style={inputStyle} onFocus={e => (e.target.style.borderColor = 'var(--app-input-focus)')} onBlur={e => (e.target.style.borderColor = 'var(--app-input-border)')} />
            </Field>
          </>
        )}

        {local.brandingMode === 'custom' && (
          <div style={{ padding: '16px 0', borderBottom: '1px solid var(--app-border-subtle)' }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--app-text-primary)', marginBottom: 4 }}>Custom Letterhead</div>
            <div style={{ fontSize: 12.5, color: 'var(--app-text-muted)', marginBottom: 10 }}>PNG, JPG or PDF used as PDF header (800×120px recommended for images)</div>

            {local.customLetterhead ? (
              (() => {
                const isImage = local.customLetterhead.startsWith('data:image/');
                return (
                  <div style={{ marginBottom: 10 }}>
                    {isImage ? (
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <img src={local.customLetterhead} alt="Letterhead" style={{ height: 72, maxWidth: '100%', objectFit: 'contain', borderRadius: 8, border: '1px solid var(--app-border)', display: 'block' }} />
                        <button
                          onClick={() => update({ customLetterhead: undefined })}
                          style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#DC2626', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                        >
                          <X style={{ width: 10, height: 10, color: '#fff' }} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--app-success-bg)', border: '1px solid var(--app-border)', borderRadius: 10 }}>
                        <Upload style={{ width: 14, height: 14, color: 'var(--app-success-color)' }} />
                        <span style={{ fontSize: 13, color: 'var(--app-success-color)', fontWeight: 500, flex: 1 }}>PDF letterhead uploaded</span>
                        <button
                          onClick={() => update({ customLetterhead: undefined })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: 2 }}
                        >
                          <X style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div style={{ width: '100%', height: 64, background: 'var(--app-input-bg)', border: '1px dashed var(--app-border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>No letterhead uploaded</span>
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 500, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, color: 'var(--app-text-secondary)', cursor: 'pointer', width: 'fit-content' }}>
              <Upload style={{ width: 13, height: 13 }} />
              {local.customLetterhead ? 'Replace Letterhead' : 'Upload Letterhead'}
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
                style={{ display: 'none' }}
                onClick={e => { (e.target as HTMLInputElement).value = ''; }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = () => update({ customLetterhead: r.result as string });
                  r.readAsDataURL(f);
                }}
              />
            </label>
            <div style={{ fontSize: 11, color: 'var(--app-text-muted)', marginTop: 6 }}>
              If no letterhead is uploaded, App Generated branding will be used as fallback.
            </div>
          </div>
        )}
      </div>

      {/* Branding Preview */}
      <div style={{ ...sectionStyle, marginTop: 0 }}>
        <div style={sectionLabel}>Branding Preview</div>
        <div style={{ padding: '4px 0 16px' }}>
          <div style={{ fontSize: 12.5, color: 'var(--app-text-muted)', marginBottom: 12 }}>
            Live preview of how your branding appears in exports.
          </div>

          {/* Preview card */}
          <div style={{ background: '#ffffff', border: '1px solid var(--app-border)', borderRadius: 12, padding: '20px 22px', color: '#111' }}>
            {(local.brandingMode ?? 'app-generated') === 'custom' && local.customLetterhead && local.customLetterhead.startsWith('data:image/') ? (
              <>
                <img src={local.customLetterhead} alt="Letterhead preview" style={{ width: '100%', maxHeight: 90, objectFit: 'contain', display: 'block', marginBottom: 14 }} />
                <div style={{ fontSize: 10.5, color: '#6b7280', textAlign: 'center', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Custom Letterhead Active</div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 14, borderBottom: '2px solid #111', marginBottom: 14 }}>
                {local.companyLogo ? (
                  <img src={local.companyLogo} alt="Logo" style={{ height: 40, maxWidth: 90, objectFit: 'contain', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Building2 style={{ width: 18, height: 18, color: '#9ca3af' }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#111', marginBottom: 2 }}>
                    {local.companyName || 'Company Name'}
                  </div>
                  {local.companyAddress && (
                    <div style={{ fontSize: 11.5, color: '#555', marginBottom: 2 }}>{local.companyAddress}</div>
                  )}
                  {(local.companyPhone || local.companyEmail || local.companyWebsite) && (
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {[local.companyPhone, local.companyEmail, local.companyWebsite].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {local.companyGST && (
                    <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>GST: {local.companyGST}</div>
                  )}
                </div>
              </div>
            )}
            {/* Sample content */}
            <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, marginBottom: 8 }}>Payroll Statement · June 2026</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Employees: 8', 'Working Days: 26', 'Net Payroll: ₹3,45,000'].map(t => (
                <div key={t} style={{ flex: 1, background: '#f8f8f8', borderRadius: 6, padding: '7px 10px' }}>
                  <div style={{ fontSize: 10, color: '#aaa', marginBottom: 3 }}>{t.split(':')[0]}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{t.split(':')[1]?.trim()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Profile section — mobile only (desktop has sidebar) */}
      {isMobile && (
        <div style={{ ...sectionStyle, marginTop: 20, marginBottom: 0 }}>
          <div style={sectionLabel}>Profile</div>
          <div style={{ padding: '14px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: '#EDE9FE', color: '#6D28D9',
              fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {currentUser.name.trim().split(' ').reduce((acc, p, i, arr) =>
                arr.length >= 2 ? (i === 0 ? p[0] : i === arr.length - 1 ? acc + p[0] : acc) : p.slice(0, 2), ''
              ).toUpperCase().slice(0, 2)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-text-primary)' }}>{currentUser.name}</div>
              <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginTop: 1 }}>Saved on this device</div>
            </div>
            <button
              onClick={onSwitchUser}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 500, background: 'var(--app-subtle-bg)', border: 'none', borderRadius: 10, color: 'var(--app-text-secondary)', cursor: 'pointer' }}
            >
              <LogOut style={{ width: 13, height: 13 }} />
              Switch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
