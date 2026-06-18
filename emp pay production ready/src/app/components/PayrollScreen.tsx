import { useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileText, Printer, AlertTriangle, ChevronDown } from 'lucide-react';
import { SyncIndicator } from './SyncIndicator';
import { useIsMobile } from '../hooks/useIsMobile';
import type { Employee, AttendanceRecord, Holiday, Settings } from '../App';
import { calcPayroll, type CalcResult } from '../utils/attendanceEngine';

interface Props {
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>;
  holidays: Holiday[];
  settings: Settings;
}

type RowData = { emp: Employee } & CalcResult;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function fmt(amount: number, currency: string): string {
  const symbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  return `${symbols[currency] ?? currency + ' '}${Math.round(amount).toLocaleString('en-IN')}`;
}

function formatCurrency(amount: number, currency: string): string {
  return fmt(amount, currency);
}

// ─── HTML generators ─────────────────────────────────────────────────────────

const BASE_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;color:#111;background:#fff}
`;

function openWindow(html: string) {
  const win = window.open('', '_blank');
  if (!win) { alert('Pop-up blocked — please allow pop-ups to export documents.'); return; }
  win.document.write(html);
  win.document.close();
}

// ─── Branding header (shared by all export functions) ─────────────────────────
// Returns an HTML string that goes at the very top of every exported document.
// Handles both "app-generated" mode (logo + company details) and
// "custom" mode (letterhead image). Falls back gracefully when fields are empty.

function buildBrandingHeader(s: Settings, rightContent: string): string {
  const isCustom = s.brandingMode === 'custom';
  const hasLetterhead = isCustom && s.customLetterhead;

  if (hasLetterhead) {
    const isImageData = s.customLetterhead!.startsWith('data:image/');
    const letterheadBlock = isImageData
      ? `<img src="${s.customLetterhead}" style="width:100%;max-height:130px;object-fit:contain;display:block;" />`
      : `<div style="padding:14px 0;text-align:center;background:#f9fafb;border-radius:6px;font-size:12px;color:#6b7280;font-weight:600;letter-spacing:.05em;text-transform:uppercase">Custom Letterhead Active</div>`;
    return `<div style="margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #e5e7eb">
      ${letterheadBlock}
      <div style="display:flex;justify-content:flex-end;margin-top:10px;font-size:13px;color:#555">${rightContent}</div>
    </div>`;
  }

  // App-generated header — logo+name on left, company details on right, doc info far right
  const logoHtml = s.companyLogo
    ? `<img src="${s.companyLogo}" style="height:44px;max-width:110px;object-fit:contain;margin-right:14px;flex-shrink:0;" />`
    : '';
  const hasDetails = s.companyAddress || s.companyPhone || s.companyEmail || s.companyWebsite || s.companyGST;
  const detailsHtml = hasDetails
    ? `<div style="text-align:right;font-size:11px;color:#666;line-height:1.7;flex-shrink:0;padding-left:16px">
        ${s.companyAddress ? `<div>${s.companyAddress}</div>` : ''}
        ${s.companyPhone   ? `<div>${s.companyPhone}</div>`   : ''}
        ${s.companyEmail   ? `<div>${s.companyEmail}</div>`   : ''}
        ${s.companyWebsite ? `<div>${s.companyWebsite}</div>` : ''}
        ${s.companyGST     ? `<div>GST: ${s.companyGST}</div>` : ''}
      </div>`
    : '';

  return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #111;gap:16px">
    <div style="display:flex;align-items:center;flex:1;min-width:0">
      ${logoHtml}
      <div style="min-width:0">
        <div style="font-size:20px;font-weight:800;color:#111;letter-spacing:-0.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.companyName}</div>
      </div>
    </div>
    ${detailsHtml}
    <div style="text-align:right;flex-shrink:0;padding-left:16px;border-left:1px solid #e5e7eb">${rightContent}</div>
  </div>`;
}

function buildPayrollHTML(rows: RowData[], month: number, year: number, settings: Settings): string {
  const mn = MONTH_NAMES[month];
  const { currency } = settings;
  const totalGross = rows.reduce((s, r) => s + r.emp.salary, 0);
  const totalNet   = rows.reduce((s, r) => s + r.finalSalary, 0);
  const wd = rows[0]?.workingDays ?? 0;

  const tableRows = rows.map((r, i) => {
    const notMarkedBadge = r.notMarkedDays > 0
      ? `<span style="background:#F3F4F6;color:#6B7280;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600">${r.notMarkedDays} not marked</span>`
      : '';
    const marked = r.markedDays === r.workingDays
      ? `<span style="background:#F0FDF4;color:#16A34A;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600">${r.markedDays}/${r.workingDays}</span>`
      : `<span style="background:#FEF9C3;color:#854D0E;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600">${r.markedDays}/${r.workingDays}</span>`;
    const leaves = r.leaveCount > 0
      ? `<span style="background:#FEF2F2;color:#DC2626;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600">${r.leaveCount} unpaid</span>`
      : `<span style="color:#ccc">—</span>`;
    return `<tr style="background:${i % 2 === 1 ? '#FAFAFA' : '#fff'}">
      <td style="padding:11px 14px;font-size:12.5px;border-bottom:1px solid #f2f2f2">${i + 1}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #f2f2f2"><strong style="font-size:13px">${r.emp.name}</strong><br><span style="font-size:11px;color:#999">${r.emp.department}</span></td>
      <td style="padding:11px 14px;font-size:12.5px;border-bottom:1px solid #f2f2f2">${r.workingDays}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #f2f2f2">${marked} ${notMarkedBadge}</td>
      <td style="padding:11px 14px;font-size:12.5px;border-bottom:1px solid #f2f2f2">${r.payableDays}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #f2f2f2">${leaves}</td>
      <td style="padding:11px 14px;font-size:12.5px;border-bottom:1px solid #f2f2f2">${fmt(r.emp.salary, currency)}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #f2f2f2"><strong style="font-size:13px">${fmt(r.finalSalary, currency)}</strong></td>
    </tr>`;
  }).join('');

  const rightBlock = `<div style="font-size:20px;font-weight:700">Payroll Statement</div>
    <div style="font-size:15px;font-weight:600;color:#333;margin-top:4px">${mn} ${year}</div>
    <div style="font-size:11px;color:#888;margin-top:4px">${rows.length} employees · ${wd} working days</div>
    <div style="font-size:11px;color:#bbb;margin-top:3px">Generated ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payroll — ${mn} ${year}</title>
<style>${BASE_CSS}
body{padding:48px}
.cards{display:flex;gap:14px;margin-bottom:28px}
.card{flex:1;background:#f8f8f8;border-radius:10px;padding:14px 18px}
.card-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:6px}
.card-value{font-size:18px;font-weight:700}
table{width:100%;border-collapse:collapse}
th{background:#f5f5f5;padding:10px 14px;text-align:left;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#888;border-bottom:2px solid #e8e8e8}
tfoot td{font-weight:700;font-size:13px;background:#f5f5f5;border-top:2px solid #ccc;padding:12px 14px}
.footer{margin-top:40px;font-size:10.5px;color:#bbb;text-align:center;padding-top:14px;border-top:1px solid #f0f0f0}
@media print{body{padding:28px}}
</style></head><body>
${buildBrandingHeader(settings, rightBlock)}
<div class="cards">
  <div class="card"><div class="card-label">Employees</div><div class="card-value">${rows.length}</div></div>
  <div class="card"><div class="card-label">Working Days</div><div class="card-value">${wd}</div></div>
  <div class="card"><div class="card-label">Gross Payroll</div><div class="card-value">${fmt(totalGross, currency)}</div></div>
  <div class="card"><div class="card-label">Deductions</div><div class="card-value" style="color:#DC2626">${fmt(totalGross - totalNet, currency)}</div></div>
  <div class="card"><div class="card-label">Net Payroll</div><div class="card-value" style="color:#16A34A">${fmt(totalNet, currency)}</div></div>
</div>
<table>
  <thead><tr><th>#</th><th>Employee</th><th>Work Days</th><th>Marked / Not Marked</th><th>Payable Days</th><th>Unpaid Leaves</th><th>Gross Salary</th><th>Final Salary</th></tr></thead>
  <tbody>${tableRows}</tbody>
  <tfoot><tr><td colspan="6">Total (${rows.length} employees)</td><td>${fmt(totalGross, currency)}</td><td>${fmt(totalNet, currency)}</td></tr></tfoot>
</table>
<div class="footer">Computer-generated payroll statement · ${settings.companyName} · ${mn} ${year}</div>
<script>setTimeout(()=>window.print(),400)</script>
</body></html>`;
}

function buildPayslipHTML(row: RowData, month: number, year: number, settings: Settings): string {
  const mn = MONTH_NAMES[month];
  const { currency } = settings;
  const deduction = row.emp.salary - row.finalSalary;
  const joined = new Date(row.emp.joiningDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const pills = [
    row.fullDays     > 0 ? `<span style="background:#F0FDF4;color:#16A34A;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">✓ ${row.fullDays} Full Day${row.fullDays !== 1 ? 's' : ''}</span>` : '',
    row.halfDays     > 0 ? `<span style="background:#FEFCE8;color:#CA8A04;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">◑ ${row.halfDays} Half Day${row.halfDays !== 1 ? 's' : ''}</span>` : '',
    row.paidLeaves   > 0 ? `<span style="background:#EFF6FF;color:#2563EB;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">● ${row.paidLeaves} Paid Leave${row.paidLeaves !== 1 ? 's' : ''}</span>` : '',
    row.sickLeaves   > 0 ? `<span style="background:#FFF7ED;color:#EA580C;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">+ ${row.sickLeaves} Sick Leave${row.sickLeaves !== 1 ? 's' : ''}</span>` : '',
    row.unpaidLeaves > 0 ? `<span style="background:#FEF2F2;color:#DC2626;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">✗ ${row.unpaidLeaves} Unpaid Leave${row.unpaidLeaves !== 1 ? 's' : ''}</span>` : '',
    row.otherAbs     > 0 ? `<span style="background:#FEF2F2;color:#DC2626;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">✗ ${row.otherAbs} Other Absence${row.otherAbs !== 1 ? 's' : ''}</span>` : '',
    row.notMarkedDays > 0 ? `<span style="background:#F3F4F6;color:#6B7280;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">○ ${row.notMarkedDays} Not Marked</span>` : '',
  ].filter(Boolean).join(' ');

  const slipRight = `<div style="font-size:18px;font-weight:700">${mn} ${year}</div>
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#999;margin-top:4px">Salary Payslip</div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payslip — ${row.emp.name} — ${mn} ${year}</title>
<style>${BASE_CSS}
body{padding:52px;max-width:680px;margin:0 auto}
.sec{margin-bottom:26px}.sec-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#aaa;padding-bottom:7px;border-bottom:1px solid #f0f0f0;margin-bottom:14px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 32px}
.f .lbl{font-size:10.5px;color:#aaa;margin-bottom:3px}.f .val{font-size:13.5px;font-weight:500}
table{width:100%;border-collapse:collapse}
table td{padding:10px 0;border-bottom:1px solid #f5f5f5;font-size:13px}
table td:last-child{text-align:right;font-weight:500}
.total td{padding-top:15px;font-size:17px;font-weight:700;border-top:2.5px solid #111;border-bottom:none}
.ded{color:#DC2626}
.pills{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
.footer{margin-top:48px;font-size:10px;color:#ccc;text-align:center;padding-top:14px;border-top:1px solid #f5f5f5}
@media print{body{padding:32px}}
</style></head><body>
${buildBrandingHeader(settings, slipRight)}
<div class="sec"><div class="sec-title">Employee Details</div>
  <div class="grid">
    <div class="f"><div class="lbl">Full Name</div><div class="val">${row.emp.name}</div></div>
    <div class="f"><div class="lbl">Employee ID</div><div class="val">#${row.emp.id}</div></div>
    <div class="f"><div class="lbl">Department</div><div class="val">${row.emp.department}</div></div>
    <div class="f"><div class="lbl">Date of Joining</div><div class="val">${joined}</div></div>
  </div>
</div>
<div class="sec"><div class="sec-title">Attendance Summary</div>
  <div class="grid">
    <div class="f"><div class="lbl">Working Days in Month</div><div class="val">${row.workingDays}</div></div>
    <div class="f"><div class="lbl">Days Marked</div><div class="val">${row.markedDays}</div></div>
    <div class="f"><div class="lbl">Not Marked Days</div><div class="val" style="${row.notMarkedDays > 0 ? 'color:#6B7280' : ''}">${row.notMarkedDays}</div></div>
    <div class="f"><div class="lbl">Payable Days</div><div class="val">${row.payableDays}</div></div>
    <div class="f"><div class="lbl">Unpaid Absences</div><div class="val" style="${row.leaveCount > 0 ? 'color:#DC2626' : ''}">${row.leaveCount}</div></div>
    <div class="f"><div class="lbl">Holidays</div><div class="val">${row.holidays}</div></div>
  </div>
  ${pills ? `<div class="pills">${pills}</div>` : ''}
</div>
<div class="sec"><div class="sec-title">Salary Breakdown</div>
  <table>
    <tr><td>Gross Monthly Salary</td><td>${fmt(row.emp.salary, currency)}</td></tr>
    ${deduction > 0 ? `<tr><td class="ded">Deduction (${row.leaveCount} unpaid day${row.leaveCount !== 1 ? 's' : ''})</td><td class="ded">− ${fmt(deduction, currency)}</td></tr>` : ''}
    <tr class="total"><td>Net Salary Payable</td><td>${fmt(row.finalSalary, currency)}</td></tr>
  </table>
</div>
<div class="footer">Computer-generated payslip · Does not require a signature · ${settings.companyName} · ${mn} ${year}</div>
<script>setTimeout(()=>window.print(),400)</script>
</body></html>`;
}

function buildAllPayslipsHTML(rows: RowData[], month: number, year: number, settings: Settings): string {
  const mn = MONTH_NAMES[month];
  const { currency } = settings;
  const slipRight = `<div style="font-size:17px;font-weight:700">${mn} ${year}</div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#999;margin-top:3px">Salary Payslip</div>`;
  const brandingHtml = buildBrandingHeader(settings, slipRight);

  const slips = rows.map((row, idx) => {
    const deduction = row.emp.salary - row.finalSalary;
    const joined = new Date(row.emp.joiningDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const isLast = idx === rows.length - 1;
    return `
    <div style="padding:48px;max-width:700px;margin:0 auto;${isLast ? '' : 'page-break-after:always;border-bottom:4px dashed #e0e0e0;margin-bottom:0;padding-bottom:48px'}">
      ${brandingHtml}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 28px;margin-bottom:22px">
        <div><div style="font-size:10px;color:#aaa;margin-bottom:2px">Employee</div><div style="font-size:14px;font-weight:600">${row.emp.name}</div></div>
        <div><div style="font-size:10px;color:#aaa;margin-bottom:2px">Department</div><div style="font-size:13px;font-weight:500">${row.emp.department}</div></div>
        <div><div style="font-size:10px;color:#aaa;margin-bottom:2px">Employee ID</div><div style="font-size:13px">#${row.emp.id}</div></div>
        <div><div style="font-size:10px;color:#aaa;margin-bottom:2px">Date of Joining</div><div style="font-size:13px">${joined}</div></div>
      </div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#aaa;padding-bottom:6px;border-bottom:1px solid #f0f0f0;margin-bottom:12px">Attendance</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
        <div><div style="font-size:10px;color:#aaa;margin-bottom:2px">Working Days</div><div style="font-size:14px;font-weight:600">${row.workingDays}</div></div>
        <div><div style="font-size:10px;color:#aaa;margin-bottom:2px">Marked Days</div><div style="font-size:14px;font-weight:600">${row.markedDays}</div></div>
        <div><div style="font-size:10px;color:#aaa;margin-bottom:2px">Not Marked</div><div style="font-size:14px;font-weight:600;${row.notMarkedDays > 0 ? 'color:#6B7280' : ''}">${row.notMarkedDays}</div></div>
        <div><div style="font-size:10px;color:#aaa;margin-bottom:2px">Payable Days</div><div style="font-size:14px;font-weight:600">${row.payableDays}</div></div>
      </div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#aaa;padding-bottom:6px;border-bottom:1px solid #f0f0f0;margin-bottom:12px">Salary</div>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:9px 0;border-bottom:1px solid #f5f5f5;font-size:13px">Gross Monthly Salary</td><td style="padding:9px 0;border-bottom:1px solid #f5f5f5;font-size:13px;text-align:right;font-weight:500">${fmt(row.emp.salary, currency)}</td></tr>
        ${deduction > 0 ? `<tr><td style="padding:9px 0;border-bottom:1px solid #f5f5f5;font-size:13px;color:#DC2626">Deductions (${row.leaveCount} unpaid days)</td><td style="padding:9px 0;border-bottom:1px solid #f5f5f5;font-size:13px;text-align:right;font-weight:500;color:#DC2626">− ${fmt(deduction, currency)}</td></tr>` : ''}
        <tr><td style="padding:14px 0 0;font-size:17px;font-weight:700;border-top:2.5px solid #111">Net Salary Payable</td><td style="padding:14px 0 0;font-size:17px;font-weight:700;border-top:2.5px solid #111;text-align:right">${fmt(row.finalSalary, currency)}</td></tr>
      </table>
      <div style="margin-top:28px;font-size:10px;color:#ccc;text-align:center;padding-top:12px;border-top:1px solid #f5f5f5">Computer-generated payslip · ${settings.companyName} · ${mn} ${year}</div>
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payslips — ${mn} ${year}</title>
<style>${BASE_CSS}@media print{.pagebreak{page-break-after:always}}</style></head>
<body>${slips}<script>setTimeout(()=>window.print(),400)</script></body></html>`;
}

// ─── Chip helper ─────────────────────────────────────────────────────────────
function Chip({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: bg, border: `1px solid ${color}30`, borderRadius: 20 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{count}</span>
      <span style={{ fontSize: 11.5, color, opacity: 0.85 }}>{label}</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PayrollScreen({ employees, attendance, holidays, settings }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const shiftMonth = (dir: number) => {
    let m = month + dir, y = year;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    setMonth(m); setYear(y);
  };

  const rows: RowData[] = employees.map(emp => ({
    emp,
    ...calcPayroll(emp, year, month, attendance, holidays, settings),
  }));

  const totalGross  = rows.reduce((s, r) => s + r.emp.salary, 0);
  const totalNet    = rows.reduce((s, r) => s + r.finalSalary, 0);
  const totalDeduct = totalGross - totalNet;
  const workingDays = rows[0]?.workingDays ?? 0;
  const { currency } = settings;

  // Attendance incomplete: any employee with not-marked days this month
  const totalNotMarked = rows.reduce((s, r) => s + r.notMarkedDays, 0);

  const isMobile = useIsMobile();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const handleExportPDF    = () => openWindow(buildPayrollHTML(rows, month, year, settings));
  const handleAllPayslips  = () => openWindow(buildAllPayslipsHTML(rows, month, year, settings));
  const handlePayslip = (row: RowData) => openWindow(buildPayslipHTML(row, month, year, settings));

  const MonthSelector = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--app-card)', border: '1px solid var(--app-border)', borderRadius: 12, padding: '5px 8px' }}>
      <button onClick={() => shiftMonth(-1)} style={{ width: 30, height: 30, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-text-muted)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ChevronLeft style={{ width: 16, height: 16 }} />
      </button>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-text-primary)', minWidth: isMobile ? 110 : 128, textAlign: 'center' }}>
        {MONTH_NAMES[month]} {year}
      </span>
      <button onClick={() => shiftMonth(1)} style={{ width: 30, height: 30, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-text-muted)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ChevronRight style={{ width: 16, height: 16 }} />
      </button>
    </div>
  );

  return (
    <div style={{ padding: isMobile ? '20px 16px' : '32px 36px', maxWidth: isMobile ? '100%' : 1060, margin: '0 auto' }}>

      {/* ── Header ── */}
      {isMobile ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h1 style={{ color: 'var(--app-text-primary)', fontSize: 20, marginBottom: 2 }}>Payroll</h1>
              <p style={{ fontSize: 12.5, color: 'var(--app-text-muted)' }}>{employees.length} employees · {workingDays} work days</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SyncIndicator />
              <MonthSelector />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleExportPDF} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', fontSize: 13, fontWeight: 500, background: 'var(--app-btn-secondary-bg)', border: '1px solid var(--app-btn-secondary-border)', borderRadius: 10, color: 'var(--app-btn-secondary-fg)', cursor: 'pointer' }}>
              <FileText style={{ width: 14, height: 14 }} /> PDF
            </button>
            <button onClick={handleAllPayslips} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', fontSize: 13, fontWeight: 600, background: 'var(--app-btn-primary-bg)', border: 'none', borderRadius: 10, color: 'var(--app-btn-primary-fg)', cursor: 'pointer' }}>
              <Download style={{ width: 14, height: 14 }} /> Payslips
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ color: 'var(--app-text-primary)', marginBottom: 2 }}>Payroll</h1>
            <p style={{ fontSize: 13.5, color: 'var(--app-text-muted)' }}>{workingDays} working days · {employees.length} employees</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SyncIndicator />
            <MonthSelector />
            <button onClick={handleExportPDF} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 500, background: 'var(--app-btn-secondary-bg)', border: '1px solid var(--app-btn-secondary-border)', borderRadius: 12, color: 'var(--app-btn-secondary-fg)', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--app-btn-secondary-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--app-btn-secondary-bg)')}>
              <FileText style={{ width: 14, height: 14 }} /> Export PDF
            </button>
            <button onClick={handleAllPayslips} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, background: 'var(--app-btn-primary-bg)', border: 'none', borderRadius: 12, color: 'var(--app-btn-primary-fg)', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--app-btn-primary-bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--app-btn-primary-bg)')}>
              <Download style={{ width: 14, height: 14 }} /> Download All Payslips
            </button>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: isMobile ? 10 : 14, marginBottom: isMobile ? 16 : 24 }}>
        {[
          { label: 'Employees',   value: String(employees.length),            sub: 'on payroll',   color: 'var(--app-text-primary)' },
          { label: 'Work Days',   value: String(workingDays),                  sub: MONTH_NAMES[month], color: 'var(--app-text-primary)' },
          { label: 'Gross',       value: formatCurrency(totalGross, currency),  sub: 'total payroll', color: 'var(--app-text-primary)' },
          { label: 'Deductions',  value: formatCurrency(totalDeduct, currency), sub: 'unpaid leaves', color: totalDeduct > 0 ? '#DC2626' : 'var(--app-text-muted)' },
          { label: 'Net Payroll', value: formatCurrency(totalNet, currency),    sub: 'after cuts',   color: '#16A34A' },
        ].map(card => (
          <div key={card.label} style={{ background: 'var(--app-card)', border: '1px solid var(--app-border)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</div>
            <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: card.color, lineHeight: 1.1 }}>{card.value}</div>
            <div style={{ fontSize: 11, color: 'var(--app-text-muted)', marginTop: 3 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Attendance Incomplete Warning ── */}
      {totalNotMarked > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '12px 16px',
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: 12,
          marginBottom: isMobile ? 16 : 20,
        }}>
          <AlertTriangle style={{ width: 18, height: 18, color: '#D97706', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#92400E', marginBottom: 2 }}>
              Attendance Incomplete
            </div>
            <div style={{ fontSize: 12.5, color: '#92400E' }}>
              {totalNotMarked} working day{totalNotMarked !== 1 ? 's are' : ' is'} still Not Marked across {rows.filter(r => r.notMarkedDays > 0).length} employee{rows.filter(r => r.notMarkedDays > 0).length !== 1 ? 's' : ''}.
              Payroll calculations may be inaccurate — mark attendance first for best results.
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile: Employee cards ── */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(row => {
            const { emp, workingDays: wd, markedDays, notMarkedDays, payableDays, leaveCount, finalSalary } = row;
            const allMarked = notMarkedDays === 0;
            return (
              <div key={emp.id} style={{ background: 'var(--app-card)', border: '1px solid var(--app-border)', borderRadius: 14, padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-text-primary)' }}>{emp.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginTop: 1 }}>{emp.department}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--app-text-primary)' }}>{formatCurrency(finalSalary, currency)}</div>
                    {leaveCount > 0 && <div style={{ fontSize: 11.5, color: '#DC2626', marginTop: 1 }}>−{formatCurrency(emp.salary - finalSalary, currency)}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--app-text-muted)', background: 'var(--app-subtle-bg)', borderRadius: 20, padding: '3px 10px' }}>
                    {wd} work days
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, borderRadius: 20, padding: '3px 10px', background: allMarked ? '#F0FDF4' : '#FEFCE8', color: allMarked ? '#16A34A' : '#854D0E' }}>
                    {markedDays}/{wd} marked
                  </span>
                  {notMarkedDays > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 600, background: '#FFFBEB', color: '#D97706', borderRadius: 20, padding: '3px 10px' }}>
                      ⚠ {notMarkedDays} not marked
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--app-text-muted)', background: 'var(--app-subtle-bg)', borderRadius: 20, padding: '3px 10px' }}>
                    {payableDays} payable
                  </span>
                  {leaveCount > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 600, background: '#FEF2F2', color: '#DC2626', borderRadius: 20, padding: '3px 10px' }}>
                      {leaveCount} unpaid
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--app-border-subtle)' }}>
                  <span style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>Gross: {formatCurrency(emp.salary, currency)}</span>
                  <button
                    onClick={() => handlePayslip(row)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12.5, fontWeight: 500, background: 'var(--app-subtle-bg)', border: 'none', borderRadius: 8, color: 'var(--app-text-secondary)', cursor: 'pointer' }}
                  >
                    <Printer style={{ width: 13, height: 13 }} /> Payslip
                  </button>
                </div>
              </div>
            );
          })}
          <p style={{ fontSize: 12, color: 'var(--app-text-muted)', textAlign: 'center', padding: '4px 0' }}>
            Net total: <strong style={{ color: 'var(--app-text-primary)' }}>{formatCurrency(totalNet, currency)}</strong>
          </p>
        </div>
      ) : (
        /* ── Desktop: Table ── */
        <>
        <div style={{ background: 'var(--app-card)', border: '1px solid var(--app-border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 88px 120px 96px 80px 110px 130px 44px', padding: '10px 20px', background: 'var(--app-table-header-bg)', borderBottom: '1px solid var(--app-border-subtle)' }}>
            {['Employee', 'Work Days', 'Marked / Pending', 'Payable Days', 'Unpaid', 'Gross Salary', 'Final Salary', ''].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
            ))}
          </div>

        {rows.map(row => {
          const { emp, workingDays: wd, markedDays, notMarkedDays, payableDays, leaveCount, finalSalary, fullDays, halfDays, paidLeaves, sickLeaves, unpaidLeaves, otherAbs, holidays: hols, sundayOffDays } = row;
          const allMarked = notMarkedDays === 0;
          const isExpanded = expandedRow === emp.id;
          return (
            <div key={emp.id} style={{ borderBottom: '1px solid var(--app-border-subtle)' }}>
              {/* Main row */}
              <div
                style={{ display: 'grid', gridTemplateColumns: '1fr 88px 120px 96px 80px 110px 130px 44px', padding: '13px 20px', alignItems: 'center', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--app-card-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => setExpandedRow(isExpanded ? null : emp.id)}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--app-text-primary)' }}>{emp.name}</div>
                    <ChevronDown style={{ width: 13, height: 13, color: 'var(--app-text-muted)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }} />
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--app-text-muted)' }}>{emp.department}</div>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--app-text-secondary)' }}>{wd}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{
                      padding: '2px 9px', fontSize: 12, fontWeight: 600, borderRadius: 20,
                      border: `1px solid ${allMarked ? '#BBF7D0' : (markedDays === 0 ? 'var(--app-border)' : '#FDE68A')}`,
                      color: allMarked ? '#16A34A' : (markedDays === 0 ? 'var(--app-text-muted)' : '#854D0E'),
                      display: 'inline-block',
                    }}
                  >
                    {markedDays}/{wd}
                  </span>
                  {notMarkedDays > 0 && (
                    <span style={{ fontSize: 11, color: '#D97706' }}>
                      ⚠ {notMarkedDays} not marked
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--app-text-secondary)' }}>{payableDays}</div>
                <div>
                  {leaveCount > 0
                    ? <span style={{ fontSize: 12.5, color: '#DC2626', fontWeight: 600 }}>{leaveCount} day{leaveCount !== 1 ? 's' : ''}</span>
                    : <span style={{ fontSize: 13, color: 'var(--app-text-faint)' }}>—</span>
                  }
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--app-text-secondary)' }}>
                  {formatCurrency(emp.salary, currency)}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--app-text-primary)' }}>
                  {formatCurrency(finalSalary, currency)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={e => { e.stopPropagation(); handlePayslip(row); }} title="Download payslip"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-text-muted)', padding: 6, borderRadius: 8 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'var(--app-subtle-bg)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-text-muted)'; (e.currentTarget as HTMLElement).style.background = 'none'; }}>
                    <Printer style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>

              {/* Expandable breakdown */}
              {isExpanded && (
                <div style={{ padding: '10px 20px 16px 20px', background: 'var(--app-table-header-bg)', borderTop: '1px solid var(--app-border-subtle)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                    Attendance Breakdown — {MONTH_NAMES[month]} {year}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {fullDays > 0 && <Chip label="Present" count={fullDays} color="#16A34A" bg="#F0FDF4" />}
                    {halfDays > 0 && <Chip label={`Half Day ×${settings.halfDayValue}`} count={halfDays} color="#CA8A04" bg="#FEFCE8" />}
                    {paidLeaves > 0 && <Chip label="Paid Leave" count={paidLeaves} color="#2563EB" bg="#EFF6FF" />}
                    {sickLeaves > 0 && <Chip label="Sick Leave" count={sickLeaves} color="#7C3AED" bg="#F5F3FF" />}
                    {unpaidLeaves > 0 && <Chip label="Unpaid Leave" count={unpaidLeaves} color="#DC2626" bg="#FEF2F2" />}
                    {otherAbs > 0 && <Chip label="Other Absence" count={otherAbs} color="#EA580C" bg="#FFF7ED" />}
                    {hols > 0 && <Chip label="Holidays" count={hols} color="#6B7280" bg="var(--app-subtle-bg)" />}
                    {sundayOffDays > 0 && <Chip label="Sundays Off" count={sundayOffDays} color="#6B7280" bg="var(--app-subtle-bg)" />}
                    {notMarkedDays > 0 && <Chip label="Not Marked" count={notMarkedDays} color="#D97706" bg="#FFFBEB" />}
                  </div>
                  <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--app-card)', borderRadius: 8, border: '1px solid var(--app-border)', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: 'var(--app-text-muted)' }}>Working days: </span>
                      <strong style={{ color: 'var(--app-text-primary)' }}>{wd}</strong>
                    </div>
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: 'var(--app-text-muted)' }}>Payable days: </span>
                      <strong style={{ color: 'var(--app-text-primary)' }}>{payableDays}</strong>
                    </div>
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: 'var(--app-text-muted)' }}>Daily rate: </span>
                      <strong style={{ color: 'var(--app-text-primary)' }}>{formatCurrency(Math.round(emp.salary / wd), currency)}</strong>
                    </div>
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: 'var(--app-text-muted)' }}>Formula: </span>
                      <span style={{ color: 'var(--app-text-secondary)', fontFamily: 'monospace' }}>({formatCurrency(emp.salary, currency)} ÷ {wd}) × {payableDays} = <strong style={{ color: '#16A34A' }}>{formatCurrency(finalSalary, currency)}</strong></span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 88px 120px 96px 80px 110px 130px 44px', padding: '12px 20px', borderTop: '1px solid var(--app-border)', background: 'var(--app-table-header-bg)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--app-text-secondary)' }}>Total ({rows.length} employees)</div>
          <div /><div /><div /><div />
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--app-text-secondary)' }}>{formatCurrency(totalGross, currency)}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--app-text-primary)' }}>{formatCurrency(totalNet, currency)}</div>
          <div />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
        {[
          { label: `Full Day = 1`, color: '#16A34A' },
          { label: `Half Day = ${settings.halfDayValue}`, color: '#CA8A04' },
          { label: `Holiday = ${settings.holidayPayable ? 1 : 0}`, color: '#6B7280' },
          { label: 'Sunday Off = 0', color: '#94A3B8' },
          { label: 'Unpaid Leave = 0', color: '#DC2626' },
          { label: 'Not Marked = 0', color: '#D97706' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
            <span style={{ fontSize: 11, color: 'var(--app-text-muted)' }}>{item.label}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--app-text-faint)', textAlign: 'center', marginTop: 6 }}>
        Click any employee row to see the full attendance breakdown · Change rules in Settings
      </p>
      </>
      )}
    </div>
  );
}
