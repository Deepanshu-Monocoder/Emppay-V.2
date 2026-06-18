import { useState, useMemo } from 'react';
import { ArrowLeft, Download, Pencil, Calendar, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useIsMobile } from '../hooks/useIsMobile';
import type { Employee, AttendanceRecord, Holiday, Settings, EmployeeNote } from '../App';
import type { UserProfile } from './UserSelectScreen';

interface Props {
  employee: Employee;
  employees: Employee[];
  onUpdateEmployees: (employees: Employee[]) => void;
  attendance: Record<string, AttendanceRecord>;
  holidays: Holiday[];
  settings: Settings;
  employeeNotes: EmployeeNote[];
  onUpdateNotes: (notes: EmployeeNote[]) => void;
  onNavigateBack: () => void;
  currentUser: UserProfile;
}

type DateRangePreset = 'this-month' | 'last-month' | 'last-3-months' | 'last-6-months' | 'this-year' | 'all-time' | 'custom';

interface DateRange {
  from: string;
  to: string;
}

interface AttendanceStats {
  presentDays: number;
  halfDays: number;
  paidLeaves: number;
  sickLeaves: number;
  unpaidLeaves: number;
  otherAbsences: number;
  totalWorkingDays: number;
  attendancePercentage: number;
}

interface PayrollRecord {
  month: string;
  payableDays: number;
  grossSalary: number;
  deductions: number;
  netSalary: number;
}

function Initials({ name, size = 64 }: { name: string; size?: number }) {
  const parts = name.trim().split(' ');
  const initials = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);
  const palettes = [
    { bg: '#EDE9FE', color: '#6D28D9' }, { bg: '#DBEAFE', color: '#1D4ED8' },
    { bg: '#D1FAE5', color: '#065F46' }, { bg: '#FEF3C7', color: '#92400E' },
    { bg: '#FCE7F3', color: '#9D174D' }, { bg: '#E0F2FE', color: '#075985' },
  ];
  const p = palettes[name.charCodeAt(0) % palettes.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: p.bg, color: p.color, fontSize: size * 0.36, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {initials.toUpperCase()}
    </div>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getDayName(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
}

function getDateRange(preset: DateRangePreset, joiningDate: string): DateRange {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  switch (preset) {
    case 'this-month': {
      const from = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      const to = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { from, to };
    }
    case 'last-month': {
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const from = `${lastMonthYear}-${String(lastMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(lastMonthYear, lastMonth + 1, 0).getDate();
      const to = `${lastMonthYear}-${String(lastMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { from, to };
    }
    case 'last-3-months': {
      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const from = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      const to = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { from, to };
    }
    case 'last-6-months': {
      const sixMonthsAgo = new Date(today);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const from = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      const to = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { from, to };
    }
    case 'this-year': {
      const from = `${currentYear}-01-01`;
      const to = `${currentYear}-12-31`;
      return { from, to };
    }
    case 'all-time': {
      return { from: joiningDate, to: `${currentYear}-12-31` };
    }
    default:
      return { from: '', to: '' };
  }
}

function calculateAttendanceStats(
  employeeId: string,
  dateRange: DateRange,
  attendance: Record<string, AttendanceRecord>,
  holidays: Holiday[],
  settings: Settings
): AttendanceStats {
  const stats: AttendanceStats = {
    presentDays: 0,
    halfDays: 0,
    paidLeaves: 0,
    sickLeaves: 0,
    unpaidLeaves: 0,
    otherAbsences: 0,
    totalWorkingDays: 0,
    attendancePercentage: 0,
  };

  const startDate = new Date(dateRange.from + 'T00:00:00');
  const endDate = new Date(dateRange.to + 'T00:00:00');
  const holidaySet = new Set(holidays.map(h => h.date));

  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const isSunday = currentDate.getDay() === 0;
    const isHoliday = holidaySet.has(dateStr);

    if (!isSunday || !settings.sundayOff) {
      if (!isHoliday) {
        stats.totalWorkingDays++;
        const record = attendance[`${employeeId}_${dateStr}`];

        if (record?.mainStatus === 'present') {
          if (record.subStatus === 'half-day') {
            stats.halfDays++;
          } else {
            stats.presentDays++;
          }
        } else if (record?.mainStatus === 'absent') {
          if (record.subStatus === 'paid-leave') stats.paidLeaves++;
          else if (record.subStatus === 'sick-leave') stats.sickLeaves++;
          else if (record.subStatus === 'unpaid-leave') stats.unpaidLeaves++;
          else if (record.subStatus === 'other') stats.otherAbsences++;
        }
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const totalPresent = stats.presentDays + (stats.halfDays * 0.5);
  stats.attendancePercentage = stats.totalWorkingDays > 0
    ? Math.round((totalPresent / stats.totalWorkingDays) * 100)
    : 0;

  return stats;
}

function calculatePayrollRecords(
  employee: Employee,
  dateRange: DateRange,
  attendance: Record<string, AttendanceRecord>,
  holidays: Holiday[],
  settings: Settings
): PayrollRecord[] {
  const records: PayrollRecord[] = [];
  const startDate = new Date(dateRange.from + 'T00:00:00');
  const endDate = new Date(dateRange.to + 'T00:00:00');

  let currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  while (currentMonth <= endDate) {
    const monthStart = new Date(currentMonth);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const rangeStart = monthStart < startDate ? startDate : monthStart;
    const rangeEnd = monthEnd > endDate ? endDate : monthEnd;

    const monthStr = `${monthStart.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;

    let payableDays = 0;
    const holidaySet = new Set(holidays.map(h => h.date));

    let currentDate = new Date(rangeStart);
    while (currentDate <= rangeEnd) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const isSunday = currentDate.getDay() === 0;
      const isHoliday = holidaySet.has(dateStr);

      if (!isSunday || !settings.sundayOff) {
        if (!isHoliday) {
          const record = attendance[`${employee.id}_${dateStr}`];

          if (!record || record.mainStatus === null) {
            payableDays += 1;
          } else if (record.mainStatus === 'present') {
            payableDays += record.subStatus === 'half-day' ? 0.5 : 1;
          } else if (record.mainStatus === 'absent') {
            if (record.subStatus === 'paid-leave' && settings.paidLeaveFullPay) payableDays += 1;
            else if (record.subStatus === 'sick-leave' && settings.sickLeaveFullPay) payableDays += 1;
            else if (record.subStatus === 'other' && settings.otherAbsencePayable) payableDays += 1;
            else if (record.subStatus === 'half-day' && settings.halfDayEnabled) payableDays += 0.5;
          }
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const grossSalary = employee.salary;
    const deductions = 0;
    const dailyRate = grossSalary / settings.workingDaysPerMonth;
    const netSalary = Math.round(dailyRate * payableDays);

    records.push({
      month: monthStr,
      payableDays: Math.round(payableDays * 10) / 10,
      grossSalary,
      deductions,
      netSalary,
    });

    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }

  return records.reverse();
}

export function EmployeeProfileScreen({
  employee,
  employees,
  onUpdateEmployees,
  attendance,
  holidays,
  settings,
  employeeNotes,
  onUpdateNotes,
  onNavigateBack,
  currentUser,
}: Props) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'attendance' | 'leave' | 'payroll' | 'notes'>('attendance');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this-month');
  const [customDateRange, setCustomDateRange] = useState<DateRange>({ from: '', to: '' });
  const [showExportModal, setShowExportModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState<EmployeeNote | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [showEditEmployee, setShowEditEmployee] = useState(false);
  const [editForm, setEditForm] = useState({
    name: employee.name,
    salary: String(employee.salary),
    department: employee.department,
    joiningDate: employee.joiningDate,
  });

  const dateRange = dateRangePreset === 'custom'
    ? customDateRange
    : getDateRange(dateRangePreset, employee.joiningDate);

  const stats = useMemo(() =>
    calculateAttendanceStats(employee.id, dateRange, attendance, holidays, settings),
    [employee.id, dateRange, attendance, holidays, settings]
  );

  const payrollRecords = useMemo(() =>
    calculatePayrollRecords(employee, dateRange, attendance, holidays, settings),
    [employee, dateRange, attendance, holidays, settings]
  );

  const employeeNotesFiltered = employeeNotes.filter(n => n.employeeId === employee.id).sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const attendanceHistory = useMemo(() => {
    const history: Array<{ date: string; day: string; status: string; remarks: string; reason?: string }> = [];
    const startDate = new Date(dateRange.from + 'T00:00:00');
    const endDate = new Date(dateRange.to + 'T00:00:00');
    const holidaySet = new Set(holidays.map(h => h.date));

    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const isSunday = currentDate.getDay() === 0;
      const isHoliday = holidaySet.has(dateStr);

      let status = 'Not Marked';
      let remarks = '';
      let reason: string | undefined = undefined;

      if (isSunday && settings.sundayOff) {
        status = 'Sunday Off';
      } else if (isHoliday) {
        const holiday = holidays.find(h => h.date === dateStr);
        status = 'Holiday';
        remarks = holiday?.name || '';
      } else {
        const record = attendance[`${employee.id}_${dateStr}`];
        if (record?.mainStatus === 'present') {
          status = record.subStatus === 'half-day' ? 'Half Day' : 'Present';
        } else if (record?.mainStatus === 'absent') {
          if (record.subStatus === 'paid-leave') status = 'Paid Leave';
          else if (record.subStatus === 'sick-leave') status = 'Sick Leave';
          else if (record.subStatus === 'unpaid-leave') status = 'Unpaid Leave';
          else if (record.subStatus === 'other') {
            status = 'Other Absence';
            reason = record.reason;
          }
        }
      }

      history.push({
        date: dateStr,
        day: getDayName(dateStr),
        status,
        remarks,
        reason,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return history.reverse();
  }, [employee.id, dateRange, attendance, holidays, settings]);

  const leaveHistory = useMemo(() => {
    return attendanceHistory
      .filter(h => h.status === 'Paid Leave' || h.status === 'Sick Leave' || h.status === 'Unpaid Leave')
      .map(h => ({
        date: h.date,
        leaveType: h.status,
        duration: '1 day',
        remarks: h.remarks,
      }));
  }, [attendanceHistory]);

  const handleSaveEmployee = () => {
    if (!editForm.name.trim() || !editForm.salary || !editForm.department || !editForm.joiningDate) {
      toast.error('All fields are required');
      return;
    }

    onUpdateEmployees(employees.map(e =>
      e.id === employee.id
        ? { ...e, name: editForm.name.trim(), salary: Number(editForm.salary), department: editForm.department, joiningDate: editForm.joiningDate }
        : e
    ));
    toast.success('Employee updated');
    setShowEditEmployee(false);
  };

  const handleAddNote = () => {
    if (!noteContent.trim()) {
      toast.error('Note content is required');
      return;
    }

    if (editingNote) {
      onUpdateNotes(employeeNotes.map(n =>
        n.id === editingNote.id
          ? { ...n, content: noteContent.trim() }
          : n
      ));
      toast.success('Note updated');
    } else {
      const newNote: EmployeeNote = {
        id: `note_${Date.now()}`,
        employeeId: employee.id,
        content: noteContent.trim(),
        timestamp: new Date().toISOString(),
        author: currentUser.name,
      };
      onUpdateNotes([...employeeNotes, newNote]);
      toast.success('Note added');
    }

    setNoteContent('');
    setEditingNote(null);
    setShowNoteModal(false);
  };

  const handleDeleteNote = (noteId: string) => {
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    onUpdateNotes(employeeNotes.filter(n => n.id !== noteId));
    toast.success('Note deleted');
  };

  const handleExportExcel = (includeInfo: boolean, includeAttendance: boolean, includeLeave: boolean, includePayroll: boolean, includeNotes: boolean) => {
    const wb = XLSX.utils.book_new();

    if (includeInfo) {
      const wsData = [
        ['Employee Information'],
        [],
        ['Name', employee.name],
        ['Employee ID', employee.id],
        ['Department', employee.department],
        ['Monthly Salary', `₹${employee.salary.toLocaleString('en-IN')}`],
        ['Joining Date', formatDate(employee.joiningDate)],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Employee Info');
    }

    if (includeAttendance) {
      const wsData = [
        ['Attendance Records'],
        ['Date Range', `${formatDate(dateRange.from)} to ${formatDate(dateRange.to)}`],
        [],
        ['Date', 'Day', 'Status', 'Remarks', 'Reason'],
        ...attendanceHistory.map(h => [h.date, h.day, h.status, h.remarks, h.reason || '']),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    }

    if (includeLeave) {
      const wsData = [
        ['Leave Records'],
        ['Date Range', `${formatDate(dateRange.from)} to ${formatDate(dateRange.to)}`],
        [],
        ['Date', 'Leave Type', 'Duration', 'Remarks'],
        ...leaveHistory.map(h => [h.date, h.leaveType, h.duration, h.remarks]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Leave History');
    }

    if (includePayroll) {
      const wsData = [
        ['Payroll Records'],
        ['Date Range', `${formatDate(dateRange.from)} to ${formatDate(dateRange.to)}`],
        [],
        ['Month', 'Payable Days', 'Gross Salary', 'Deductions', 'Net Salary'],
        ...payrollRecords.map(p => [p.month, p.payableDays, `₹${p.grossSalary.toLocaleString('en-IN')}`, `₹${p.deductions}`, `₹${p.netSalary.toLocaleString('en-IN')}`]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Payroll');
    }

    if (includeNotes) {
      const wsData = [
        ['Employee Notes'],
        [],
        ['Date', 'Author', 'Note'],
        ...employeeNotesFiltered.map(n => [formatDateTime(n.timestamp), n.author, n.content]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Notes');
    }

    XLSX.writeFile(wb, `${employee.name}_Report.xlsx`);
    toast.success('Excel file downloaded');
  };

  const handleExportPDF = (includeInfo: boolean, includeAttendance: boolean, includeLeave: boolean, includePayroll: boolean, includeNotes: boolean) => {
    const doc = new jsPDF();
    let yPos = 20;

    doc.setFontSize(16);
    doc.text(settings.companyName, 105, yPos, { align: 'center' });
    yPos += 10;
    doc.setFontSize(14);
    doc.text('Employee Report', 105, yPos, { align: 'center' });
    yPos += 15;

    if (includeInfo) {
      doc.setFontSize(12);
      doc.text('Employee Information', 14, yPos);
      yPos += 7;
      doc.setFontSize(10);
      doc.text(`Name: ${employee.name}`, 14, yPos);
      yPos += 6;
      doc.text(`Employee ID: ${employee.id}`, 14, yPos);
      yPos += 6;
      doc.text(`Department: ${employee.department}`, 14, yPos);
      yPos += 6;
      doc.text(`Monthly Salary: ₹${employee.salary.toLocaleString('en-IN')}`, 14, yPos);
      yPos += 6;
      doc.text(`Joining Date: ${formatDate(employee.joiningDate)}`, 14, yPos);
      yPos += 10;
    }

    doc.setFontSize(10);
    doc.text(`Date Range: ${formatDate(dateRange.from)} to ${formatDate(dateRange.to)}`, 14, yPos);
    yPos += 10;

    if (includeAttendance && attendanceHistory.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['Date', 'Day', 'Status', 'Remarks', 'Reason']],
        body: attendanceHistory.slice(0, 50).map(h => [h.date, h.day, h.status, h.remarks, h.reason || '']),
        theme: 'grid',
        headStyles: { fillColor: [17, 24, 39] },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    if (includePayroll && payrollRecords.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      autoTable(doc, {
        startY: yPos,
        head: [['Month', 'Payable Days', 'Gross Salary', 'Deductions', 'Net Salary']],
        body: payrollRecords.map(p => [
          p.month,
          String(p.payableDays),
          `₹${p.grossSalary.toLocaleString('en-IN')}`,
          `₹${p.deductions}`,
          `₹${p.netSalary.toLocaleString('en-IN')}`,
        ]),
        theme: 'grid',
        headStyles: { fillColor: [17, 24, 39] },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    doc.save(`${employee.name}_Report.pdf`);
    toast.success('PDF file downloaded');
  };

  return (
    <>
      <div style={{ padding: isMobile ? '16px' : '32px 36px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={onNavigateBack}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 14, padding: '4px 0', marginBottom: 16 }}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
            Back to Employees
          </button>

          <div style={{
            background: '#fff',
            border: '1px solid #EBEBED',
            borderRadius: 16,
            padding: isMobile ? '20px' : '28px',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 16 : 24,
            alignItems: isMobile ? 'flex-start' : 'center',
          }}>
            <Initials name={employee.name} size={isMobile ? 56 : 64} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: isMobile ? 20 : 24, color: '#111827', margin: '0 0 4px 0' }}>{employee.name}</h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13, color: '#6B7280' }}>
                <span>ID: {employee.id}</span>
                <span>•</span>
                <span>{employee.department}</span>
                <span>•</span>
                <span>₹{employee.salary.toLocaleString('en-IN')}/mo</span>
                <span>•</span>
                <span>Joined {formatDate(employee.joiningDate)}</span>
              </div>
              <div style={{ marginTop: 8 }}>
                <span style={{ padding: '4px 12px', fontSize: 12, background: '#D1FAE5', color: '#065F46', borderRadius: 20, fontWeight: 500 }}>
                  Active
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => { setEditForm({ name: employee.name, salary: String(employee.salary), department: employee.department, joiningDate: employee.joiningDate }); setShowEditEmployee(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontSize: 13, fontWeight: 500, background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 10, cursor: 'pointer' }}
              >
                <Pencil style={{ width: 14, height: 14 }} />
                Edit
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontSize: 13, fontWeight: 500, background: '#111827', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}
              >
                <Download style={{ width: 14, height: 14 }} />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Date Range Filter */}
        <div style={{ background: '#fff', border: '1px solid #EBEBED', borderRadius: 16, padding: isMobile ? '16px' : '20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Calendar style={{ width: 16, height: 16, color: '#6B7280' }} />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>Date Range Filter</h3>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'This Month', value: 'this-month' as DateRangePreset },
              { label: 'Last Month', value: 'last-month' as DateRangePreset },
              { label: 'Last 3 Months', value: 'last-3-months' as DateRangePreset },
              { label: 'Last 6 Months', value: 'last-6-months' as DateRangePreset },
              { label: 'This Year', value: 'this-year' as DateRangePreset },
              { label: 'All Time', value: 'all-time' as DateRangePreset },
            ].map(preset => (
              <button
                key={preset.value}
                onClick={() => setDateRangePreset(preset.value)}
                style={{
                  padding: '7px 14px',
                  fontSize: 12,
                  fontWeight: 500,
                  background: dateRangePreset === preset.value ? '#111827' : '#F9FAFB',
                  color: dateRangePreset === preset.value ? '#fff' : '#6B7280',
                  border: '1px solid',
                  borderColor: dateRangePreset === preset.value ? '#111827' : '#E5E7EB',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {dateRangePreset === 'custom' && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input
                type="date"
                value={customDateRange.from}
                onChange={e => setCustomDateRange({ ...customDateRange, from: e.target.value })}
                style={{ flex: 1, minWidth: 140, padding: '8px 12px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none' }}
              />
              <input
                type="date"
                value={customDateRange.to}
                onChange={e => setCustomDateRange({ ...customDateRange, to: e.target.value })}
                style={{ flex: 1, minWidth: 140, padding: '8px 12px', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none' }}
              />
            </div>
          )}

          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>
            Showing: {formatDate(dateRange.from)} to {formatDate(dateRange.to)}
          </div>
        </div>

        {/* Summary Analytics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 20,
          overflowX: isMobile ? 'auto' : 'visible',
        }}>
          {[
            { label: 'Present Days', value: stats.presentDays, color: '#10B981' },
            { label: 'Half Days', value: stats.halfDays, color: '#F59E0B' },
            { label: 'Paid Leaves', value: stats.paidLeaves, color: '#3B82F6' },
            { label: 'Sick Leaves', value: stats.sickLeaves, color: '#8B5CF6' },
            { label: 'Unpaid Leaves', value: stats.unpaidLeaves, color: '#EF4444' },
            { label: 'Other Absences', value: stats.otherAbsences, color: '#6B7280' },
            { label: 'Total Working Days', value: stats.totalWorkingDays, color: '#111827' },
            { label: 'Attendance %', value: `${stats.attendancePercentage}%`, color: '#059669' },
          ].map(card => (
            <div key={card.label} style={{ background: '#fff', border: '1px solid #EBEBED', borderRadius: 12, padding: '16px' }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #E5E7EB', overflowX: 'auto' }}>
          {[
            { label: 'Attendance History', value: 'attendance' as const },
            { label: 'Leave History', value: 'leave' as const },
            { label: 'Payroll History', value: 'payroll' as const },
            { label: 'Notes', value: 'notes' as const },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              style={{
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 500,
                background: 'none',
                color: activeTab === tab.value ? '#111827' : '#6B7280',
                border: 'none',
                borderBottom: activeTab === tab.value ? '2px solid #111827' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ background: '#fff', border: '1px solid #EBEBED', borderRadius: 16, overflow: 'hidden' }}>
          {activeTab === 'attendance' && (
            <div>
              <div style={{ padding: isMobile ? '16px' : '20px', borderBottom: '1px solid #F3F4F6' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>
                  Attendance Records ({attendanceHistory.length} days)
                </h3>
              </div>
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {attendanceHistory.map((record, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '120px 80px 140px 1fr',
                      gap: 12,
                      padding: isMobile ? '14px 16px' : '12px 20px',
                      borderBottom: '1px solid #F9FAFB',
                    }}
                  >
                    <div style={{ fontSize: 13, color: '#111827' }}>{formatDate(record.date)}</div>
                    <div style={{ fontSize: 13, color: '#6B7280' }}>{record.day}</div>
                    <div>
                      <span style={{
                        padding: '3px 10px',
                        fontSize: 11,
                        borderRadius: 20,
                        fontWeight: 500,
                        background: record.status === 'Present' ? '#D1FAE5' : record.status === 'Half Day' ? '#FEF3C7' : record.status.includes('Leave') ? '#DBEAFE' : '#F3F4F6',
                        color: record.status === 'Present' ? '#065F46' : record.status === 'Half Day' ? '#92400E' : record.status.includes('Leave') ? '#1D4ED8' : '#6B7280',
                      }}>
                        {record.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#9CA3AF' }}>
                      {record.remarks}
                      {record.reason && (
                        <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>
                          Reason: {record.reason}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'leave' && (
            <div>
              <div style={{ padding: isMobile ? '16px' : '20px', borderBottom: '1px solid #F3F4F6' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>
                  Leave Records ({leaveHistory.length} leaves)
                </h3>
              </div>
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {leaveHistory.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
                    No leave records for this period
                  </div>
                ) : (
                  leaveHistory.map((record, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '120px 140px 100px 1fr',
                        gap: 12,
                        padding: isMobile ? '14px 16px' : '12px 20px',
                        borderBottom: '1px solid #F9FAFB',
                      }}
                    >
                      <div style={{ fontSize: 13, color: '#111827' }}>{formatDate(record.date)}</div>
                      <div style={{ fontSize: 13, color: '#6B7280' }}>{record.leaveType}</div>
                      <div style={{ fontSize: 13, color: '#6B7280' }}>{record.duration}</div>
                      <div style={{ fontSize: 13, color: '#9CA3AF' }}>{record.remarks}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'payroll' && (
            <div>
              <div style={{ padding: isMobile ? '16px' : '20px', borderBottom: '1px solid #F3F4F6' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>
                  Payroll Records ({payrollRecords.length} months)
                </h3>
              </div>
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {payrollRecords.map((record, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '120px 100px 120px 100px 120px',
                      gap: 12,
                      padding: isMobile ? '14px 16px' : '12px 20px',
                      borderBottom: '1px solid #F9FAFB',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{record.month}</div>
                    <div style={{ fontSize: 13, color: '#6B7280' }}>{record.payableDays} days</div>
                    <div style={{ fontSize: 13, color: '#6B7280' }}>₹{record.grossSalary.toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: 13, color: '#EF4444' }}>₹{record.deductions}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>₹{record.netSalary.toLocaleString('en-IN')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div>
              <div style={{ padding: isMobile ? '16px' : '20px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>
                  Employee Notes ({employeeNotesFiltered.length})
                </h3>
                <button
                  onClick={() => { setNoteContent(''); setEditingNote(null); setShowNoteModal(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: 12, fontWeight: 500, background: '#111827', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                >
                  <Plus style={{ width: 14, height: 14 }} />
                  Add Note
                </button>
              </div>
              <div style={{ maxHeight: 500, overflowY: 'auto', padding: isMobile ? '16px' : '20px' }}>
                {employeeNotesFiltered.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 14, padding: '20px 0' }}>
                    No notes yet. Add a note to track important information.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {employeeNotesFiltered.map(note => (
                      <div key={note.id} style={{ position: 'relative', paddingLeft: 24, borderLeft: '2px solid #E5E7EB' }}>
                        <div style={{ position: 'absolute', left: -5, top: 0, width: 8, height: 8, background: '#111827', borderRadius: '50%' }} />
                        <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 4 }}>
                          {formatDateTime(note.timestamp)} • {note.author}
                        </div>
                        <div style={{ fontSize: 13, color: '#374151', marginBottom: 8, whiteSpace: 'pre-wrap' }}>{note.content}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => { setNoteContent(note.content); setEditingNote(note); setShowNoteModal(true); }}
                            style={{ fontSize: 12, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            style={{ fontSize: 12, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Employee Modal */}
      {showEditEmployee && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowEditEmployee(false); }}
        >
          <div style={{
            background: '#fff',
            width: isMobile ? '100%' : 460,
            borderRadius: isMobile ? '20px 20px 0 0' : 20,
            padding: isMobile ? '24px 20px 32px' : 28,
            maxHeight: isMobile ? '92dvh' : 'auto',
            overflowY: 'auto',
          }}>
            {isMobile && <div style={{ width: 36, height: 4, background: '#E5E7EB', borderRadius: 2, margin: '0 auto 20px' }} />}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ color: '#111827', margin: 0 }}>Edit Employee</h2>
              <button onClick={() => setShowEditEmployee(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Monthly Salary</label>
                <input
                  type="number"
                  value={editForm.salary}
                  onChange={e => setEditForm({ ...editForm, salary: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Department</label>
                <select
                  value={editForm.department}
                  onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, outline: 'none', boxSizing: 'border-box' }}
                >
                  {['Engineering', 'Design', 'HR', 'Sales', 'Marketing', 'Finance', 'Operations', 'Product'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Joining Date</label>
                <input
                  type="date"
                  value={editForm.joiningDate}
                  onChange={e => setEditForm({ ...editForm, joiningDate: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 14, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowEditEmployee(false)} style={{ flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 500, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, color: '#374151', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSaveEmployee} style={{ flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600, background: '#111827', border: 'none', borderRadius: 12, color: '#fff', cursor: 'pointer' }}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowNoteModal(false); }}
        >
          <div style={{
            background: '#fff',
            width: isMobile ? '100%' : 500,
            borderRadius: isMobile ? '20px 20px 0 0' : 20,
            padding: isMobile ? '24px 20px 32px' : 28,
            maxHeight: isMobile ? '92dvh' : 'auto',
            overflowY: 'auto',
          }}>
            {isMobile && <div style={{ width: 36, height: 4, background: '#E5E7EB', borderRadius: 2, margin: '0 auto 20px' }} />}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ color: '#111827', margin: 0 }}>{editingNote ? 'Edit Note' : 'Add Note'}</h2>
              <button onClick={() => setShowNoteModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Note</label>
              <textarea
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                placeholder="Enter note content..."
                style={{ width: '100%', minHeight: 120, padding: '10px 12px', fontSize: 14, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowNoteModal(false)} style={{ flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 500, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, color: '#374151', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleAddNote} style={{ flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600, background: '#111827', border: 'none', borderRadius: 12, color: '#fff', cursor: 'pointer' }}>
                {editingNote ? 'Update Note' : 'Add Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          isMobile={isMobile}
          dateRange={dateRange}
          onClose={() => setShowExportModal(false)}
          onExportExcel={handleExportExcel}
          onExportPDF={handleExportPDF}
        />
      )}
    </>
  );
}

function ExportModal({
  isMobile,
  dateRange,
  onClose,
  onExportExcel,
  onExportPDF,
}: {
  isMobile: boolean;
  dateRange: DateRange;
  onClose: () => void;
  onExportExcel: (info: boolean, attendance: boolean, leave: boolean, payroll: boolean, notes: boolean) => void;
  onExportPDF: (info: boolean, attendance: boolean, leave: boolean, payroll: boolean, notes: boolean) => void;
}) {
  const [customFrom, setCustomFrom] = useState(dateRange.from);
  const [customTo, setCustomTo] = useState(dateRange.to);
  const [includeInfo, setIncludeInfo] = useState(true);
  const [includeAttendance, setIncludeAttendance] = useState(true);
  const [includeLeave, setIncludeLeave] = useState(true);
  const [includePayroll, setIncludePayroll] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff',
        width: isMobile ? '100%' : 520,
        borderRadius: isMobile ? '20px 20px 0 0' : 20,
        padding: isMobile ? '24px 20px 32px' : 28,
        maxHeight: isMobile ? '92dvh' : 'auto',
        overflowY: 'auto',
      }}>
        {isMobile && <div style={{ width: 36, height: 4, background: '#E5E7EB', borderRadius: 2, margin: '0 auto 20px' }} />}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ color: '#111827', margin: 0 }}>Export Data</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Date Range</label>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              style={{ flex: 1, padding: '10px 12px', fontSize: 14, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, outline: 'none' }}
            />
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              style={{ flex: 1, padding: '10px 12px', fontSize: 14, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 10 }}>Include in Export</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Employee Information', checked: includeInfo, onChange: setIncludeInfo },
              { label: 'Attendance Records', checked: includeAttendance, onChange: setIncludeAttendance },
              { label: 'Leave Records', checked: includeLeave, onChange: setIncludeLeave },
              { label: 'Payroll Records', checked: includePayroll, onChange: setIncludePayroll },
              { label: 'Notes', checked: includeNotes, onChange: setIncludeNotes },
            ].map(item => (
              <label key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={e => item.onChange(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14, color: '#374151' }}>{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => { onExportExcel(includeInfo, includeAttendance, includeLeave, includePayroll, includeNotes); onClose(); }}
            style={{ flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600, background: '#059669', border: 'none', borderRadius: 12, color: '#fff', cursor: 'pointer' }}
          >
            Export Excel
          </button>
          <button
            onClick={() => { onExportPDF(includeInfo, includeAttendance, includeLeave, includePayroll, includeNotes); onClose(); }}
            style={{ flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600, background: '#DC2626', border: 'none', borderRadius: 12, color: '#fff', cursor: 'pointer' }}
          >
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}
