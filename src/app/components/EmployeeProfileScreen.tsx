import { useState, useMemo, useRef } from 'react';
import { ArrowLeft, Download, Pencil, Plus, Trash2, X, ChevronRight, Camera } from 'lucide-react';
import { PhotoUploadCrop } from './PhotoUploadCrop';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useIsMobile } from '../hooks/useIsMobile';
import type { Employee, AttendanceRecord, Holiday, Settings, EmployeeNote, EmployeeDocument } from '../App';
import type { UserProfile } from './UserSelectScreen';
import { ProfilePhoto } from './ProfilePhoto';
import { DocumentManager } from './DocumentManager';
import { calcPayroll, calculateAttendanceSummary, makeDateStr, type AttendanceSummary } from '../utils/attendanceEngine';

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
type SectionType = 'calendar' | 'attendance' | 'leave' | 'payroll' | 'notes';

interface DateRange {
  from: string;
  to: string;
}

// AttendanceStats is now AttendanceSummary from the engine
type AttendanceStats = AttendanceSummary;

interface PayrollRecord {
  month: string;
  payableDays: number;
  grossSalary: number;
  deductions: number;
  netSalary: number;
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

function getMonthName(monthIndex: number): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return months[monthIndex];
}

function getAttendanceColor(dateStr: string, employeeId: string, attendance: Record<string, AttendanceRecord>, holidays: Holiday[], settings: Settings): string {
  const record = attendance[`${employeeId}_${dateStr}`];

  // Check if it's a holiday
  const isHoliday = holidays.some(h => h.date === dateStr);
  if (isHoliday) return '#9CA3AF'; // Gray for holidays

  // Check if it's Sunday and Sunday off is enabled
  const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay();
  if (dayOfWeek === 0) return '#6B7280'; // Dark gray for Sunday off

  if (!record || !record.mainStatus) return 'transparent'; // Transparent for Not Marked

  // Color based on mainStatus and subStatus
  if (record.mainStatus === 'present') {
    if (record.subStatus === 'half-day') return '#F59E0B'; // Yellow for Half Day
    return '#10B981'; // Green for Present
  } else if (record.mainStatus === 'absent') {
    if (record.subStatus === 'paid-leave') return '#3B82F6'; // Blue for Paid Leave
    if (record.subStatus === 'sick-leave') return '#8B5CF6'; // Purple for Sick Leave
    if (record.subStatus === 'unpaid-leave') return '#EF4444'; // Red for Unpaid Leave
    if (record.subStatus === 'other') return '#F97316'; // Orange for Other
  }

  return '#FFFFFF';
}

function getAttendanceCode(dateStr: string, employeeId: string, attendance: Record<string, AttendanceRecord>, holidays: Holiday[]): string {
  const record = attendance[`${employeeId}_${dateStr}`];
  const isHoliday = holidays.some(h => h.date === dateStr);

  if (isHoliday) return 'H';
  if (!record) return '';

  if (record.mainStatus === 'present') {
    if (record.subStatus === 'half-day') return 'HD';
    return 'P';
  } else if (record.mainStatus === 'absent') {
    if (record.subStatus === 'paid-leave') return 'PL';
    if (record.subStatus === 'sick-leave') return 'SL';
    if (record.subStatus === 'unpaid-leave') return 'UL';
    if (record.subStatus === 'other') return 'O';
  }

  return '';
}

function getAttendanceLabel(dateStr: string, employeeId: string, attendance: Record<string, AttendanceRecord>, holidays: Holiday[], settings: Settings): string {
  const record = attendance[`${employeeId}_${dateStr}`];
  const isHoliday = holidays.some(h => h.date === dateStr);
  const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay();

  if (isHoliday) return 'Holiday';
  if (dayOfWeek === 0) return 'Sunday Off';
  if (!record || !record.mainStatus) return 'Not Marked';

  if (record.mainStatus === 'present') {
    if (record.subStatus === 'half-day') return 'Half Day';
    return 'Present';
  } else if (record.mainStatus === 'absent') {
    if (record.subStatus === 'paid-leave') return 'Paid Leave';
    if (record.subStatus === 'sick-leave') return 'Sick Leave';
    if (record.subStatus === 'unpaid-leave') return 'Unpaid Leave';
    if (record.subStatus === 'other') return 'Other Absence';
  }

  return 'Not Marked';
}

function getMonthStats(year: number, month: number, employeeId: string, attendance: Record<string, AttendanceRecord>, holidays: Holiday[]): {
  present: number;
  halfDay: number;
  paidLeave: number;
  sickLeave: number;
  unpaidLeave: number;
  other: number;
} {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const stats = { present: 0, halfDay: 0, paidLeave: 0, sickLeave: 0, unpaidLeave: 0, other: 0 };

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const record = attendance[`${employeeId}_${dateStr}`];

    if (!record) continue;

    if (record.mainStatus === 'present') {
      if (record.subStatus === 'half-day') stats.halfDay++;
      else stats.present++;
    } else if (record.mainStatus === 'absent') {
      if (record.subStatus === 'paid-leave') stats.paidLeave++;
      else if (record.subStatus === 'sick-leave') stats.sickLeave++;
      else if (record.subStatus === 'unpaid-leave') stats.unpaidLeave++;
      else if (record.subStatus === 'other') stats.other++;
    }
  }

  return stats;
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
  // Delegate entirely to the shared engine
  return calculateAttendanceSummary(employeeId, dateRange.from, dateRange.to, attendance, holidays, settings);
}

function calculatePayrollRecords(
  employee: Employee,
  dateRange: DateRange,
  attendance: Record<string, AttendanceRecord>,
  holidays: Holiday[],
  settings: Settings
): PayrollRecord[] {
  const records: PayrollRecord[] = [];

  // Parse dates using local components (timezone-safe — never use toISOString for date strings)
  const [fy, fm, fd] = dateRange.from.split('-').map(Number);
  const [ty, tm, td] = dateRange.to.split('-').map(Number);
  const startDate = new Date(fy, fm - 1, fd);
  const endDate = new Date(ty, tm - 1, td);

  // Iterate month-by-month and use the shared calcPayroll engine for each
  const curMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  while (curMonth <= endDate) {
    const year = curMonth.getFullYear();
    const month = curMonth.getMonth();
    const monthStr = curMonth.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

    const result = calcPayroll(employee, year, month, attendance, holidays, settings);
    const deductions = employee.salary - result.finalSalary;

    records.push({
      month: monthStr,
      payableDays: Math.round(result.payableDays * 10) / 10,
      grossSalary: employee.salary,
      deductions: deductions > 0 ? deductions : 0,
      netSalary: result.finalSalary,
    });

    curMonth.setMonth(curMonth.getMonth() + 1);
  }

  // Ensure range end is respected — startDate/endDate may be mid-month
  // For partial months the engine still calculates the full month, which is acceptable
  // (partial-month proration is a Phase 2 concern per the refactor spec)
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
  const [expandedSection, setExpandedSection] = useState<SectionType>('calendar');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this-month');
  const [customDateRange, setCustomDateRange] = useState<DateRange>({ from: '', to: '' });
  const [showExportModal, setShowExportModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState<EmployeeNote | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [showEditEmployee, setShowEditEmployee] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [editForm, setEditForm] = useState({
    name: employee.name,
    salary: String(employee.salary),
    department: employee.department,
    joiningDate: employee.joiningDate,
    designation: employee.designation || '',
    employeeCode: employee.employeeCode || '',
    employmentType: employee.employmentType || '',
    mobile: employee.mobile || '',
    alternateMobile: employee.alternateMobile || '',
    email: employee.email || '',
    dateOfBirth: employee.dateOfBirth || '',
    gender: employee.gender || '',
    emergencyContactName: employee.emergencyContactName || '',
    emergencyContactNumber: employee.emergencyContactNumber || '',
    currentAddress: employee.currentAddress || '',
    city: employee.city || '',
    state: employee.state || '',
    postalCode: employee.postalCode || '',
    country: employee.country || '',
  });

  // Calendar view state
  const today = new Date();
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

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

    // Parse dates using local components (timezone-safe — never use toISOString for date strings)
    const [fy, fm, fd] = dateRange.from.split('-').map(Number);
    const [ty, tm, td] = dateRange.to.split('-').map(Number);
    const startDate = new Date(fy, fm - 1, fd);
    const endDate = new Date(ty, tm - 1, td);
    const holidaySet = new Set(holidays.map(h => h.date));

    const cur = new Date(startDate);
    while (cur <= endDate) {
      // Build date string from LOCAL components — never .toISOString() which converts to UTC
      const dateStr = makeDateStr(cur.getFullYear(), cur.getMonth(), cur.getDate());
      const dayOfWeek = cur.getDay(); // local weekday — 0=Sunday, 6=Saturday
      const isHoliday = holidaySet.has(dateStr);

      let status = 'Not Marked';
      let remarks = '';
      let reason: string | undefined = undefined;

      if (dayOfWeek === 0) {
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
        // else: Not Marked — status remains 'Not Marked'
      }

      history.push({ date: dateStr, day: getDayName(dateStr), status, remarks, reason });
      cur.setDate(cur.getDate() + 1);
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
        ? {
            ...e,
            name: editForm.name.trim(),
            salary: Number(editForm.salary),
            department: editForm.department,
            joiningDate: editForm.joiningDate,
            designation: editForm.designation || undefined,
            employeeCode: editForm.employeeCode || undefined,
            employmentType: (editForm.employmentType as Employee['employmentType']) || undefined,
            mobile: editForm.mobile || undefined,
            alternateMobile: editForm.alternateMobile || undefined,
            email: editForm.email || undefined,
            dateOfBirth: editForm.dateOfBirth || undefined,
            gender: (editForm.gender as Employee['gender']) || undefined,
            emergencyContactName: editForm.emergencyContactName || undefined,
            emergencyContactNumber: editForm.emergencyContactNumber || undefined,
            currentAddress: editForm.currentAddress || undefined,
            city: editForm.city || undefined,
            state: editForm.state || undefined,
            postalCode: editForm.postalCode || undefined,
            country: editForm.country || undefined,
          }
        : e
    ));
    toast.success('Employee updated');
    setShowEditEmployee(false);
  };

  const handlePhotoSave = (photoData: string) => {
    onUpdateEmployees(employees.map(e =>
      e.id === employee.id ? { ...e, profilePhoto: photoData } : e
    ));
    setShowPhotoUpload(false);
    toast.success('Profile photo updated');
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

  // Build full attendance history for any date range (used by export handlers)
  function buildAttendanceHistory(from: string, to: string) {
    const history: Array<{ date: string; day: string; status: string; remarks: string; reason?: string }> = [];
    if (!from || !to) return history;
    const [fy, fm, fd] = from.split('-').map(Number);
    const [ty, tm, td] = to.split('-').map(Number);
    const startDate = new Date(fy, fm - 1, fd);
    const endDate = new Date(ty, tm - 1, td);
    const holidaySet = new Set(holidays.map(h => h.date));
    const cur = new Date(startDate);
    while (cur <= endDate) {
      const dateStr = makeDateStr(cur.getFullYear(), cur.getMonth(), cur.getDate());
      const dayOfWeek = cur.getDay();
      const isHoliday = holidaySet.has(dateStr);
      let status = 'Not Marked';
      let remarks = '';
      let reason: string | undefined;
      if (dayOfWeek === 0) {
        status = 'Sunday Off';
      } else if (isHoliday) {
        const h = holidays.find(h => h.date === dateStr);
        status = 'Holiday';
        remarks = h?.name || '';
      } else {
        const rec = attendance[`${employee.id}_${dateStr}`];
        if (rec?.mainStatus === 'present') {
          status = rec.subStatus === 'half-day' ? 'Half Day' : 'Present';
        } else if (rec?.mainStatus === 'absent') {
          if (rec.subStatus === 'paid-leave') status = 'Paid Leave';
          else if (rec.subStatus === 'sick-leave') status = 'Sick Leave';
          else if (rec.subStatus === 'unpaid-leave') status = 'Unpaid Leave';
          else if (rec.subStatus === 'other') { status = 'Other Absence'; reason = rec.reason; }
        }
      }
      history.push({ date: dateStr, day: getDayName(dateStr), status, remarks, reason });
      cur.setDate(cur.getDate() + 1);
    }
    return history;
  }

  const handleExportExcel = (from: string, to: string) => {
    const wb = XLSX.utils.book_new();
    const nowStr = new Date().toLocaleString('en-IN');
    const exportHistory = buildAttendanceHistory(from, to);
    const exportLeaveHistory = exportHistory.filter(h =>
      h.status === 'Paid Leave' || h.status === 'Sick Leave' || h.status === 'Unpaid Leave'
    ).map(h => ({ date: h.date, leaveType: h.status, duration: '1 day', remarks: h.remarks, reason: h.reason }));
    const exportPayroll = calculatePayrollRecords(employee, { from, to }, attendance, holidays, settings);
    const exportStats = calculateAttendanceSummary(employee.id, from, to, attendance, holidays, settings);
    const today = nowStr;

    // SHEET 1 - EMPLOYEE DASHBOARD
    const dashboardData: any[][] = [
      [settings.companyName],
      ['Employee Report'],
      ['Report Period:', `${formatDate(from)} - ${formatDate(to)}`],
      ['Generated:', nowStr],
      [],
      ['EMPLOYEE PROFILE'],
      ['Name', employee.name],
      ['Employee ID', employee.id],
      ['Department', employee.department],
      ['Designation', employee.designation || '-'],
      ['Employee Code', employee.employeeCode || '-'],
      ['Monthly Salary', `₹${employee.salary.toLocaleString('en-IN')}`],
      ['Joining Date', formatDate(employee.joiningDate)],
      ['Employment Type', employee.employmentType ? employee.employmentType.replace('-', ' ').toUpperCase() : '-'],
      ['Mobile', employee.mobile || '-'],
      ['Email', employee.email || '-'],
      [],
      ['ATTENDANCE SUMMARY'],
      ['Metric', 'Value'],
      ['Present Days', exportStats.presentDays],
      ['Half Days', exportStats.halfDays],
      ['Paid Leaves', exportStats.paidLeaves],
      ['Sick Leaves', exportStats.sickLeaves],
      ['Unpaid Leaves', exportStats.unpaidLeaves],
      ['Other Absences', exportStats.otherAbsences],
      ['Attendance %', `${exportStats.attendancePercentage}%`],
      [],
      ['PAYROLL SUMMARY'],
      ['Month', 'Payable Days', 'Gross Salary', 'Deductions', 'Net Salary'],
      ...exportPayroll.slice(0, 5).map(p => [p.month, p.payableDays, p.grossSalary, p.deductions, p.netSalary]),
    ];

    const wsDashboard = XLSX.utils.aoa_to_sheet(dashboardData);
    wsDashboard['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsDashboard, 'Dashboard');

    // SHEET 2 - ATTENDANCE RECORDS (every date in range)
    const attendanceData: any[][] = [
      ['Attendance Records'],
      ['Date Range:', `${formatDate(from)} - ${formatDate(to)}`],
      ['Total Days:', exportHistory.length],
      [],
      ['Date', 'Day', 'Status', 'Remarks', 'Reason'],
      ...exportHistory.map(h => [h.date, h.day, h.status, h.remarks, h.reason || '']),
    ];

    const wsAttendance = XLSX.utils.aoa_to_sheet(attendanceData);
    wsAttendance['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 30 }];
    wsAttendance['!freeze'] = { xSplit: 0, ySplit: 5 };
    XLSX.utils.book_append_sheet(wb, wsAttendance, 'Attendance Records');

    // SHEET 3 - LEAVE HISTORY
    const leaveData: any[][] = [
      ['Leave History'],
      ['Date Range:', `${formatDate(from)} - ${formatDate(to)}`],
      ['Total Leaves:', exportLeaveHistory.length],
      [],
      ['Date', 'Leave Type', 'Duration', 'Reason', 'Remarks'],
      ...exportLeaveHistory.map(h => [h.date, h.leaveType, h.duration, h.reason || '', h.remarks]),
    ];

    const wsLeave = XLSX.utils.aoa_to_sheet(leaveData);
    wsLeave['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 30 }, { wch: 25 }];
    wsLeave['!freeze'] = { xSplit: 0, ySplit: 5 };
    XLSX.utils.book_append_sheet(wb, wsLeave, 'Leave History');

    // SHEET 4 - PAYROLL HISTORY
    const payrollData: any[][] = [
      ['Payroll History'],
      ['Date Range:', `${formatDate(from)} - ${formatDate(to)}`],
      ['Total Months:', exportPayroll.length],
      [],
      ['Month', 'Payable Days', 'Gross Salary (₹)', 'Deductions (₹)', 'Net Salary (₹)'],
      ...exportPayroll.map(p => [p.month, p.payableDays, p.grossSalary, p.deductions, p.netSalary]),
    ];

    const wsPayroll = XLSX.utils.aoa_to_sheet(payrollData);
    wsPayroll['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    wsPayroll['!freeze'] = { xSplit: 0, ySplit: 5 };
    XLSX.utils.book_append_sheet(wb, wsPayroll, 'Payroll History');

    // SHEET 5 - ATTENDANCE CALENDAR (all dates)
    const calendarData: any[][] = [
      ['Attendance Calendar'],
      ['Date Range:', `${formatDate(from)} - ${formatDate(to)}`],
      [],
      ['LEGEND'],
      ['P = Present', 'HD = Half Day', 'PL = Paid Leave'],
      ['SL = Sick Leave', 'UL = Unpaid Leave', 'O = Other Absence', 'H = Holiday', 'S = Sunday Off', '- = Not Marked'],
      [],
      ['Date', 'Day', 'Status', 'Code'],
    ];

    const getStatusCode = (status: string) => {
      const codes: Record<string, string> = {
        'Present': 'P', 'Half Day': 'HD', 'Paid Leave': 'PL',
        'Sick Leave': 'SL', 'Unpaid Leave': 'UL', 'Other Absence': 'O',
        'Holiday': 'H', 'Sunday Off': 'S', 'Not Marked': '-',
      };
      return codes[status] || '-';
    };

    calendarData.push(...exportHistory.map(h => [
      h.date,
      h.day,
      h.status,
      getStatusCode(h.status),
    ]));

    const wsCalendar = XLSX.utils.aoa_to_sheet(calendarData);
    wsCalendar['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 8 }];
    wsCalendar['!freeze'] = { xSplit: 0, ySplit: 8 };
    XLSX.utils.book_append_sheet(wb, wsCalendar, 'Attendance Calendar');

    // Export the workbook
    const fileName = `${employee.name.replace(/\s+/g, '_')}_Report.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('Professional Excel report downloaded');
  };

  const handleExportPDF = (from: string, to: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const nowStr2 = new Date().toLocaleString('en-IN');
    let yPos = 15;

    const exportHistory2 = buildAttendanceHistory(from, to);
    const exportLeaveHistory2 = exportHistory2.filter(h =>
      h.status === 'Paid Leave' || h.status === 'Sick Leave' || h.status === 'Unpaid Leave'
    ).map(h => ({ date: h.date, leaveType: h.status, duration: '1 day', remarks: h.remarks, reason: h.reason }));
    const exportPayroll2 = calculatePayrollRecords(employee, { from, to }, attendance, holidays, settings);
    const exportStats2 = calculateAttendanceSummary(employee.id, from, to, attendance, holidays, settings);

    // Build branding header
    const hasLetterhead = !!(settings.brandingMode === 'custom' && settings.customLetterhead);

    // PAGE 1 - Header & Employee Information
    if (hasLetterhead && settings.customLetterhead) {
      doc.addImage(settings.customLetterhead, 'JPEG', 0, 0, pageWidth, 40);
      yPos = 45;
    } else {
      doc.setFillColor(17, 24, 39);
      doc.rect(0, 0, pageWidth, 35, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text(settings.companyName, pageWidth / 2, 14, { align: 'center' });
      if (settings.companyAddress) {
        doc.setFontSize(9);
        doc.text(settings.companyAddress, pageWidth / 2, 22, { align: 'center' });
      }
      doc.setFontSize(12);
      doc.text('Employee Report', pageWidth / 2, 30, { align: 'center' });
      yPos = 45;
    }

    doc.setTextColor(0, 0, 0);

    // Employee Information
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Employee Profile', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const info = [
      ['Name:', employee.name],
      ['Employee ID:', employee.id],
      ['Department:', employee.department],
      ['Designation:', employee.designation || '-'],
      ['Employee Code:', employee.employeeCode || '-'],
      ['Monthly Salary:', `₹${employee.salary.toLocaleString('en-IN')}`],
      ['Joining Date:', formatDate(employee.joiningDate)],
      ['Employment Type:', employee.employmentType ? employee.employmentType.replace('-', ' ').toUpperCase() : '-'],
      ['Mobile:', employee.mobile || '-'],
      ['Email:', employee.email || '-'],
    ];
    info.forEach(([label, value]) => {
      doc.setFont(undefined, 'bold');
      doc.text(label, 14, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(String(value), 65, yPos);
      yPos += 6;
    });
    yPos += 4;

    // Report Period
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Report Period: ${formatDate(from)} - ${formatDate(to)}`, 14, yPos);
    yPos += 4;
    doc.text(`Generated: ${nowStr2}`, 14, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 10;

    // Attendance Summary
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Attendance Summary', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: [
        ['Present Days', String(exportStats2.presentDays)],
        ['Half Days', String(exportStats2.halfDays)],
        ['Paid Leaves', String(exportStats2.paidLeaves)],
        ['Sick Leaves', String(exportStats2.sickLeaves)],
        ['Unpaid Leaves', String(exportStats2.unpaidLeaves)],
        ['Other Absences', String(exportStats2.otherAbsences)],
        ['Not Marked Days', String(exportStats2.notMarkedDays)],
        ['Attendance %', `${exportStats2.attendancePercentage}%`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [17, 24, 39], fontSize: 10, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold' } },
      margin: { left: 14 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Payroll Summary
    if (exportPayroll2.length > 0 && yPos < 200) {
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Payroll Summary', 14, yPos);
      yPos += 8;

      autoTable(doc, {
        startY: yPos,
        head: [['Month', 'Days', 'Gross (₹)', 'Deductions (₹)', 'Net (₹)']],
        body: exportPayroll2.slice(0, 6).map(p => [
          p.month, String(p.payableDays),
          p.grossSalary.toLocaleString('en-IN'), String(p.deductions), p.netSalary.toLocaleString('en-IN'),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [17, 24, 39], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14 },
      });
    }

    // PAGE 2 - Full Attendance Register (ALL dates including Not Marked)
    if (exportHistory2.length > 0) {
      doc.addPage();
      yPos = 15;

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(`Full Attendance Register (${exportHistory2.length} days)`, 14, yPos);
      yPos += 10;

      autoTable(doc, {
        startY: yPos,
        head: [['Date', 'Day', 'Status', 'Remarks / Reason']],
        body: exportHistory2.map(h => [
          h.date,
          h.day,
          h.status,
          [h.remarks, h.reason].filter(Boolean).join(' — ') || '-',
        ]),
        theme: 'grid',
        headStyles: { fillColor: [17, 24, 39], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
        styles: { cellPadding: 2 },
      });
    }

    // PAGE 3 - Leave History
    if (exportLeaveHistory2.length > 0) {
      doc.addPage();
      yPos = 15;

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Leave History', 14, yPos);
      yPos += 10;

      autoTable(doc, {
        startY: yPos,
        head: [['Date', 'Leave Type', 'Duration', 'Reason']],
        body: exportLeaveHistory2.map(h => [h.date, h.leaveType, h.duration, h.reason || '-']),
        theme: 'grid',
        headStyles: { fillColor: [17, 24, 39], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
        styles: { cellPadding: 2 },
      });
    }

    // PAGE 4 - Full Payroll History
    if (exportPayroll2.length > 0) {
      doc.addPage();
      yPos = 15;

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Payroll History', 14, yPos);
      yPos += 10;

      autoTable(doc, {
        startY: yPos,
        head: [['Month', 'Payable Days', 'Gross Salary (₹)', 'Deductions (₹)', 'Net Salary (₹)']],
        body: exportPayroll2.map(p => [
          p.month, String(p.payableDays),
          p.grossSalary.toLocaleString('en-IN'), String(p.deductions), p.netSalary.toLocaleString('en-IN'),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [17, 24, 39], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });
    }

    // PAGE 5 - Notes
    if (employeeNotesFiltered.length > 0) {
      doc.addPage();
      yPos = 15;

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Employee Notes', 14, yPos);
      yPos += 10;

      autoTable(doc, {
        startY: yPos,
        head: [['Date', 'Author', 'Note']],
        body: employeeNotesFiltered.map(n => [formatDateTime(n.timestamp), n.author, n.content]),
        theme: 'grid',
        headStyles: { fillColor: [17, 24, 39], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
        styles: { cellPadding: 2 },
        columnStyles: { 2: { cellWidth: 100 } },
      });
    }

    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
      doc.text(
        `${settings.companyName} - Confidential`,
        14,
        doc.internal.pageSize.getHeight() - 10
      );
    }

    const fileName = `${employee.name.replace(/\s+/g, '_')}_Report_${from}_${to}.pdf`;
    doc.save(fileName);
    toast.success('PDF report downloaded');
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--app-bg)' }}>
        {/* Header - Fixed */}
        <div style={{
          background: 'var(--app-card)',
          borderBottom: '1px solid var(--app-border)',
          padding: isMobile ? '12px 16px' : '16px 36px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isMobile ? 12 : 0 }}>
            <button
              onClick={onNavigateBack}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-text-muted)', fontSize: 14, padding: 0 }}
            >
              <ArrowLeft style={{ width: 16, height: 16 }} />
              {!isMobile && 'Back'}
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setEditForm({
                    name: employee.name, salary: String(employee.salary),
                    department: employee.department, joiningDate: employee.joiningDate,
                    designation: employee.designation || '', employeeCode: employee.employeeCode || '',
                    employmentType: employee.employmentType || '', mobile: employee.mobile || '',
                    alternateMobile: employee.alternateMobile || '', email: employee.email || '',
                    dateOfBirth: employee.dateOfBirth || '', gender: employee.gender || '',
                    emergencyContactName: employee.emergencyContactName || '',
                    emergencyContactNumber: employee.emergencyContactNumber || '',
                    currentAddress: employee.currentAddress || '', city: employee.city || '',
                    state: employee.state || '', postalCode: employee.postalCode || '', country: employee.country || '',
                  });
                  setShowEditEmployee(true);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? '9px 14px' : '7px 14px', fontSize: 13, fontWeight: 500, background: 'var(--app-subtle-bg)', color: 'var(--app-text-secondary)', border: 'none', borderRadius: 10, cursor: 'pointer' }}
              >
                <Pencil style={{ width: 14, height: 14 }} />
                {!isMobile && 'Edit'}
              </button>
              <button
                onClick={() => setShowExportModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? '9px 16px' : '7px 14px', fontSize: 13, fontWeight: 600, background: 'var(--app-btn-primary-bg)', color: 'var(--app-btn-primary-fg)', border: 'none', borderRadius: 10, cursor: 'pointer' }}
              >
                <Download style={{ width: 14, height: 14 }} />
                {isMobile ? 'Export' : 'Export Data'}
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '0 0 16px 0' : '24px 36px' }}>
          {/* Employee Summary Card */}
          <div style={{
            background: 'var(--app-card)',
            border: '1px solid var(--app-border)',
            borderRadius: isMobile ? 0 : 16,
            padding: isMobile ? '20px 16px' : '24px',
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <ProfilePhoto name={employee.name} photoUrl={employee.profilePhoto} size={isMobile ? 56 : 64} />
                <button
                  onClick={() => setShowPhotoUpload(true)}
                  title="Change photo"
                  style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'var(--app-btn-primary-bg)', border: '2px solid var(--app-card)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0,
                  }}
                >
                  <Camera style={{ width: 10, height: 10, color: 'var(--app-btn-primary-fg)' }} />
                </button>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: isMobile ? 18 : 22, color: 'var(--app-text-primary)', margin: '0 0 6px 0' }}>{employee.name}</h1>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 13, color: 'var(--app-text-muted)', marginBottom: 8 }}>
                  <span>{employee.department}</span>
                  <span>•</span>
                  <span>ID: {employee.id}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 13 }}>
                  <span style={{ padding: '3px 10px', background: '#F0FDF4', color: '#16A34A', borderRadius: 20, fontSize: 12, fontWeight: 500 }}>
                    ₹{employee.salary.toLocaleString('en-IN')}/mo
                  </span>
                  <span style={{ padding: '3px 10px', background: 'var(--app-subtle-bg)', color: 'var(--app-text-muted)', borderRadius: 20, fontSize: 12 }}>
                    Since {formatDate(employee.joiningDate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: 12,
              paddingTop: 16,
              borderTop: '1px solid var(--app-border-subtle)'
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--app-text-muted)', marginBottom: 4 }}>Present</div>
                <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#16A34A' }}>{stats.presentDays}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--app-text-muted)', marginBottom: 4 }}>Leaves</div>
                <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#F59E0B' }}>{stats.paidLeaves + stats.sickLeaves + stats.unpaidLeaves}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--app-text-muted)', marginBottom: 4 }}>Attendance</div>
                <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: 'var(--app-text-primary)' }}>{stats.attendancePercentage}%</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--app-text-muted)', marginBottom: 4 }}>Est. Salary</div>
                <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#059669' }}>
                  ₹{payrollRecords[0] ? payrollRecords[0].netSalary.toLocaleString('en-IN') : '0'}
                </div>
              </div>
            </div>

            {/* Additional Employee Information */}
            {(employee.mobile || employee.email || employee.designation || employee.currentAddress) && (
              <div style={{ paddingTop: 16, borderTop: '1px solid var(--app-border-subtle)', marginTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
                  {/* Employment Details */}
                  {(employee.designation || employee.employeeCode || employee.employmentType) && (
                    <div>
                      <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text-primary)', marginBottom: 10 }}>Employment Details</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {employee.designation && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--app-text-muted)' }}>Designation:</span>
                            <span style={{ color: 'var(--app-text-primary)', fontWeight: 500 }}>{employee.designation}</span>
                          </div>
                        )}
                        {employee.employeeCode && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--app-text-muted)' }}>Employee Code:</span>
                            <span style={{ color: 'var(--app-text-primary)', fontWeight: 500 }}>{employee.employeeCode}</span>
                          </div>
                        )}
                        {employee.employmentType && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--app-text-muted)' }}>Employment Type:</span>
                            <span style={{ color: 'var(--app-text-primary)', fontWeight: 500, textTransform: 'capitalize' }}>{employee.employmentType.replace('-', ' ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Contact Information */}
                  {(employee.mobile || employee.alternateMobile || employee.email) && (
                    <div>
                      <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text-primary)', marginBottom: 10 }}>Contact Information</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {employee.mobile && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--app-text-muted)' }}>Mobile:</span>
                            <span style={{ color: 'var(--app-text-primary)', fontWeight: 500 }}>{employee.mobile}</span>
                          </div>
                        )}
                        {employee.alternateMobile && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--app-text-muted)' }}>Alternate:</span>
                            <span style={{ color: 'var(--app-text-primary)', fontWeight: 500 }}>{employee.alternateMobile}</span>
                          </div>
                        )}
                        {employee.email && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--app-text-muted)' }}>Email:</span>
                            <span style={{ color: 'var(--app-text-primary)', fontWeight: 500 }}>{employee.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Personal Details */}
                  {(employee.dateOfBirth || employee.gender) && (
                    <div>
                      <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text-primary)', marginBottom: 10 }}>Personal Details</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {employee.dateOfBirth && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--app-text-muted)' }}>Date of Birth:</span>
                            <span style={{ color: 'var(--app-text-primary)', fontWeight: 500 }}>{formatDate(employee.dateOfBirth)}</span>
                          </div>
                        )}
                        {employee.gender && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--app-text-muted)' }}>Gender:</span>
                            <span style={{ color: 'var(--app-text-primary)', fontWeight: 500, textTransform: 'capitalize' }}>{employee.gender}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Emergency Contact */}
                  {(employee.emergencyContactName || employee.emergencyContactNumber) && (
                    <div>
                      <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text-primary)', marginBottom: 10 }}>Emergency Contact</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {employee.emergencyContactName && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--app-text-muted)' }}>Name:</span>
                            <span style={{ color: 'var(--app-text-primary)', fontWeight: 500 }}>{employee.emergencyContactName}</span>
                          </div>
                        )}
                        {employee.emergencyContactNumber && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--app-text-muted)' }}>Number:</span>
                            <span style={{ color: 'var(--app-text-primary)', fontWeight: 500 }}>{employee.emergencyContactNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Address Information - Full Width */}
                {(employee.currentAddress || employee.city) && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--app-border-subtle)' }}>
                    <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text-primary)', marginBottom: 10 }}>Address Information</h4>
                    {employee.currentAddress && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--app-text-muted)', marginBottom: 4 }}>Address</div>
                        <div style={{ fontSize: 13, color: 'var(--app-text-primary)' }}>{employee.currentAddress}</div>
                      </div>
                    )}
                    {(employee.city || employee.state || employee.postalCode || employee.country) && (
                      <div style={{ fontSize: 13, color: 'var(--app-text-muted)' }}>
                        {[employee.city, employee.state, employee.postalCode, employee.country].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Documents Section */}
          <div style={{
            background: 'var(--app-card)',
            border: '1px solid var(--app-border)',
            borderRadius: isMobile ? 0 : 16,
            padding: isMobile ? '20px 16px' : '24px',
            marginBottom: 16
          }}>
            <DocumentManager
              documents={employee.documents || []}
              onDocumentsChange={(docs) => {
                onUpdateEmployees(employees.map(e =>
                  e.id === employee.id ? { ...e, documents: docs } : e
                ));
              }}
              isMobile={isMobile}
            />
          </div>

          {/* Sticky Date Filter */}
          <div style={{
            background: 'var(--app-card)',
            border: '1px solid var(--app-border)',
            borderRadius: isMobile ? 0 : 12,
            padding: isMobile ? '16px' : '16px 20px',
            marginBottom: 16,
            position: isMobile ? 'sticky' : 'relative',
            top: isMobile ? 0 : 'auto',
            zIndex: 9,
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { label: 'This Month', value: 'this-month' as DateRangePreset },
                { label: 'Last Month', value: 'last-month' as DateRangePreset },
                { label: 'Last 3M', value: 'last-3-months' as DateRangePreset },
                { label: 'This Year', value: 'this-year' as DateRangePreset },
                { label: 'All Time', value: 'all-time' as DateRangePreset },
              ].map(preset => (
                <button
                  key={preset.value}
                  onClick={() => setDateRangePreset(preset.value)}
                  style={{
                    padding: '7px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    background: dateRangePreset === preset.value ? 'var(--app-btn-primary-bg)' : 'var(--app-input-bg)',
                    color: dateRangePreset === preset.value ? 'var(--app-btn-primary-fg)' : 'var(--app-text-muted)',
                    border: '1px solid',
                    borderColor: dateRangePreset === preset.value ? 'var(--app-btn-primary-bg)' : 'var(--app-input-border)',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--app-text-muted)', marginTop: 8 }}>
              {formatDate(dateRange.from)} — {formatDate(dateRange.to)}
            </div>
          </div>

          {/* Analytics Summary Cards - Responsive Grid */}
          {isMobile && (
            <div style={{ marginBottom: 16, padding: '0 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { label: 'Half Days', value: stats.halfDays, color: '#F59E0B' },
                  { label: 'Paid Leaves', value: stats.paidLeaves, color: '#3B82F6' },
                  { label: 'Sick Leaves', value: stats.sickLeaves, color: '#8B5CF6' },
                  { label: 'Unpaid', value: stats.unpaidLeaves, color: '#EF4444' },
                  { label: 'Other', value: stats.otherAbsences, color: 'var(--app-text-muted)' },
                  { label: 'Working Days', value: stats.totalWorkingDays, color: 'var(--app-text-primary)' },
                ].map(card => (
                  <div key={card.label} style={{
                    background: 'var(--app-card)',
                    border: '1px solid var(--app-border)',
                    borderRadius: 12,
                    padding: '12px 10px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--app-text-muted)', marginBottom: 4 }}>{card.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: card.color }}>{card.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isMobile && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Half Days', value: stats.halfDays, color: '#F59E0B' },
                { label: 'Paid Leaves', value: stats.paidLeaves, color: '#3B82F6' },
                { label: 'Sick Leaves', value: stats.sickLeaves, color: '#8B5CF6' },
                { label: 'Unpaid Leaves', value: stats.unpaidLeaves, color: '#EF4444' },
                { label: 'Other Absences', value: stats.otherAbsences, color: 'var(--app-text-muted)' },
                { label: 'Total Working Days', value: stats.totalWorkingDays, color: 'var(--app-text-primary)' },
              ].map(card => (
                <div key={card.label} style={{ background: 'var(--app-card)', border: '1px solid var(--app-border)', borderRadius: 12, padding: '16px' }}>
                  <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginBottom: 6 }}>{card.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: card.color }}>{card.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Expandable Sections (Mobile) or Tabs (Desktop) */}
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 16px' }}>
              {/* Calendar View Section */}
              <div style={{ background: 'var(--app-card)', border: '1px solid var(--app-border)', borderRadius: 12, overflow: 'hidden' }}>
                <button
                  onClick={() => setExpandedSection(expandedSection === 'calendar' ? null as any : 'calendar')}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: 'none',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--app-text-primary)' }}>Calendar View</div>
                  </div>
                  <ChevronRight style={{
                    width: 18,
                    height: 18,
                    color: 'var(--app-text-muted)',
                    transition: 'transform 0.2s',
                    transform: expandedSection === 'calendar' ? 'rotate(90deg)' : 'rotate(0deg)'
                  }} />
                </button>

                {expandedSection === 'calendar' && (() => {
                  const monthStats = getMonthStats(calendarYear, calendarMonth, employee.id, attendance, holidays);

                  return (
                    <div style={{ borderTop: '1px solid var(--app-border-subtle)', padding: '16px' }}>
                      {/* Month/Year Navigation */}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                          <select
                            value={calendarMonth}
                            onChange={(e) => setCalendarMonth(Number(e.target.value))}
                            style={{
                              padding: '8px 10px',
                              fontSize: 13,
                              fontWeight: 600,
                              border: '1px solid var(--app-input-border)',
                              borderRadius: 8,
                              background: 'var(--app-input-bg)',
                              cursor: 'pointer',
                              flex: 1
                            }}
                          >
                            {Array.from({ length: 12 }, (_, i) => (
                              <option key={i} value={i}>{getMonthName(i)}</option>
                            ))}
                          </select>
                          <select
                            value={calendarYear}
                            onChange={(e) => setCalendarYear(Number(e.target.value))}
                            style={{
                              padding: '8px 10px',
                              fontSize: 13,
                              fontWeight: 600,
                              border: '1px solid var(--app-input-border)',
                              borderRadius: 8,
                              background: 'var(--app-input-bg)',
                              cursor: 'pointer',
                              width: 90
                            }}
                          >
                            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                              <option key={year} value={year}>{year}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => {
                              if (calendarMonth === 0) {
                                setCalendarMonth(11);
                                setCalendarYear(calendarYear - 1);
                              } else {
                                setCalendarMonth(calendarMonth - 1);
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: '8px',
                              background: 'var(--app-input-bg)',
                              border: '1px solid var(--app-input-border)',
                              borderRadius: 8,
                              fontSize: 13,
                              fontWeight: 500,
                              cursor: 'pointer'
                            }}
                          >
                            ← Previous
                          </button>
                          <button
                            onClick={() => {
                              const nowY = today.getFullYear(), nowM = today.getMonth();
                              if (calendarYear > nowY || (calendarYear === nowY && calendarMonth >= nowM)) return;
                              if (calendarMonth === 11) {
                                setCalendarMonth(0);
                                setCalendarYear(calendarYear + 1);
                              } else {
                                setCalendarMonth(calendarMonth + 1);
                              }
                            }}
                            disabled={calendarYear > today.getFullYear() || (calendarYear === today.getFullYear() && calendarMonth >= today.getMonth())}
                            style={{
                              flex: 1,
                              padding: '8px',
                              background: 'var(--app-input-bg)',
                              border: '1px solid var(--app-input-border)',
                              borderRadius: 8,
                              fontSize: 13,
                              fontWeight: 500,
                              cursor: (calendarYear > today.getFullYear() || (calendarYear === today.getFullYear() && calendarMonth >= today.getMonth())) ? 'not-allowed' : 'pointer',
                              opacity: (calendarYear > today.getFullYear() || (calendarYear === today.getFullYear() && calendarMonth >= today.getMonth())) ? 0.4 : 1,
                            }}
                          >
                            Next →
                          </button>
                        </div>
                      </div>

                      {/* Month Summary */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
                        {[
                          { label: 'Present', value: monthStats.present, color: '#10B981' },
                          { label: 'Half Day', value: monthStats.halfDay, color: '#F59E0B' },
                          { label: 'Paid Leave', value: monthStats.paidLeave, color: '#3B82F6' },
                          { label: 'Sick Leave', value: monthStats.sickLeave, color: '#8B5CF6' },
                          { label: 'Unpaid', value: monthStats.unpaidLeave, color: '#EF4444' },
                          { label: 'Other', value: monthStats.other, color: '#F97316' },
                        ].map(item => (
                          <div key={item.label} style={{ background: 'var(--app-input-bg)', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 10, height: 10, background: item.color, borderRadius: 2, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 10, color: 'var(--app-text-muted)' }}>{item.label}</div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--app-text-primary)' }}>{item.value}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Calendar Grid */}
                      <div style={{ marginBottom: 12 }}>
                        {/* Day Headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 6 }}>
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                            <div key={idx} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--app-text-muted)', padding: '4px 0' }}>
                              {day}
                            </div>
                          ))}
                        </div>

                        {/* Calendar Days - Mobile Optimized */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                          {(() => {
                            const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
                            const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                            const days: JSX.Element[] = [];

                            // Empty cells for days before month starts
                            for (let i = 0; i < firstDay; i++) {
                              days.push(<div key={`empty-${i}`} />);
                            }

                            // Actual days
                            for (let day = 1; day <= daysInMonth; day++) {
                              const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                              const bgColor = getAttendanceColor(dateStr, employee.id, attendance, holidays, settings);
                              const code = getAttendanceCode(dateStr, employee.id, attendance, holidays);

                              days.push(
                                <button
                                  key={day}
                                  onClick={() => setSelectedCalendarDate(dateStr)}
                                  style={{
                                    minHeight: 48,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 2,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    background: bgColor,
                                    color: bgColor === 'transparent' ? 'var(--app-text-primary)' : '#FFFFFF',
                                    border: selectedCalendarDate === dateStr ? '2px solid var(--app-btn-primary-bg)' : '1px solid var(--app-border-subtle)',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    padding: '4px 2px'
                                  }}
                                >
                                  <div>{day}</div>
                                  {code && <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.9 }}>{code}</div>}
                                </button>
                              );
                            }

                            return days;
                          })()}
                        </div>
                      </div>

                      {/* Compact Legend */}
                      <div style={{ background: 'var(--app-input-bg)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--app-text-primary)', marginBottom: 6 }}>Legend</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px' }}>
                          {[
                            { label: 'P', full: 'Present', color: '#10B981' },
                            { label: 'HD', full: 'Half Day', color: '#F59E0B' },
                            { label: 'PL', full: 'Paid Leave', color: '#3B82F6' },
                            { label: 'SL', full: 'Sick Leave', color: '#8B5CF6' },
                            { label: 'UL', full: 'Unpaid', color: '#EF4444' },
                            { label: 'O', full: 'Other', color: '#F97316' },
                            { label: 'H', full: 'Holiday', color: 'var(--app-text-muted)' },
                          ].map(item => (
                            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <div style={{ width: 14, height: 14, background: item.color, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff' }}>
                                {item.label}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--app-text-muted)' }}>{item.full}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Selected Date Details - Bottom Sheet Style */}
                      {selectedCalendarDate && (() => {
                        const record = attendance[`${employee.id}_${selectedCalendarDate}`];
                        const isHoliday = holidays.find(h => h.date === selectedCalendarDate);
                        const displayStatus = getAttendanceLabel(selectedCalendarDate, employee.id, attendance, holidays, settings);

                        return (
                          <div style={{ background: 'var(--app-btn-primary-bg)', borderRadius: 10, padding: 14, color: 'var(--app-btn-primary-fg)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>
                                {formatDate(selectedCalendarDate)}
                              </div>
                              <button
                                onClick={() => setSelectedCalendarDate(null)}
                                style={{ background: 'rgba(128,128,128,0.2)', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6 }}
                              >
                                <X style={{ width: 14, height: 14, color: 'var(--app-btn-primary-fg)' }} />
                              </button>
                            </div>
                            {isHoliday ? (
                              <div>
                                <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>
                                  <strong>Status:</strong> Holiday
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.9 }}>
                                  <strong>Name:</strong> {isHoliday.name}
                                </div>
                              </div>
                            ) : record ? (
                              <div>
                                <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>
                                  <strong>Status:</strong> {displayStatus}
                                </div>
                                {record.subStatus && record.subStatus !== 'full-day' && (
                                  <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>
                                    <strong>Type:</strong> {record.subStatus.replace(/-/g, ' ')}
                                  </div>
                                )}
                                {record.reason && (
                                  <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>
                                    <strong>Reason:</strong> {record.reason}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ fontSize: 12, opacity: 0.7 }}>No attendance record</div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>

              {/* Attendance Section */}
              <div style={{ background: 'var(--app-card)', border: '1px solid var(--app-border)', borderRadius: 12, overflow: 'hidden' }}>
                <button
                  onClick={() => setExpandedSection(expandedSection === 'attendance' ? null as any : 'attendance')}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: 'none',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--app-text-primary)' }}>Attendance History</div>
                    <div style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>({attendanceHistory.length})</div>
                  </div>
                  <ChevronRight style={{
                    width: 18,
                    height: 18,
                    color: 'var(--app-text-muted)',
                    transition: 'transform 0.2s',
                    transform: expandedSection === 'attendance' ? 'rotate(90deg)' : 'rotate(0deg)'
                  }} />
                </button>

                {expandedSection === 'attendance' && (
                  <div style={{ borderTop: '1px solid var(--app-border-subtle)', maxHeight: 400, overflowY: 'auto' }}>
                    {attendanceHistory.map((record, idx) => (
                      <div key={idx} style={{ padding: '14px 16px', borderBottom: idx < attendanceHistory.length - 1 ? '1px solid var(--app-border-subtle)' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--app-text-primary)' }}>{formatDate(record.date)}</div>
                            <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginTop: 2 }}>{record.day}</div>
                          </div>
                          <span style={{
                            padding: '4px 10px',
                            fontSize: 11,
                            borderRadius: 20,
                            fontWeight: 500,
                            background: record.status === 'Present' ? '#D1FAE5' : record.status === 'Half Day' ? '#FEF3C7' : record.status.includes('Leave') ? '#DBEAFE' : 'var(--app-subtle-bg)',
                            color: record.status === 'Present' ? '#065F46' : record.status === 'Half Day' ? '#92400E' : record.status.includes('Leave') ? '#1D4ED8' : 'var(--app-text-muted)',
                          }}>
                            {record.status}
                          </span>
                        </div>
                        {record.reason && (
                          <div style={{ fontSize: 12, color: 'var(--app-text-muted)', fontStyle: 'italic', marginTop: 4 }}>
                            Reason: {record.reason}
                          </div>
                        )}
                        {record.remarks && (
                          <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginTop: 4 }}>{record.remarks}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Leave Section */}
              <div style={{ background: 'var(--app-card)', border: '1px solid var(--app-border)', borderRadius: 12, overflow: 'hidden' }}>
                <button
                  onClick={() => setExpandedSection(expandedSection === 'leave' ? null as any : 'leave')}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: 'none',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--app-text-primary)' }}>Leave History</div>
                    <div style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>({leaveHistory.length})</div>
                  </div>
                  <ChevronRight style={{
                    width: 18,
                    height: 18,
                    color: 'var(--app-text-muted)',
                    transition: 'transform 0.2s',
                    transform: expandedSection === 'leave' ? 'rotate(90deg)' : 'rotate(0deg)'
                  }} />
                </button>

                {expandedSection === 'leave' && (
                  <div style={{ borderTop: '1px solid var(--app-border-subtle)', maxHeight: 400, overflowY: 'auto' }}>
                    {leaveHistory.length === 0 ? (
                      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--app-text-muted)', fontSize: 14 }}>
                        No leave records for this period
                      </div>
                    ) : (
                      leaveHistory.map((record, idx) => (
                        <div key={idx} style={{ padding: '14px 16px', borderBottom: idx < leaveHistory.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--app-text-primary)' }}>{formatDate(record.date)}</div>
                              <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginTop: 2 }}>{record.leaveType}</div>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>{record.duration}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Payroll Section */}
              <div style={{ background: 'var(--app-card)', border: '1px solid var(--app-border)', borderRadius: 12, overflow: 'hidden' }}>
                <button
                  onClick={() => setExpandedSection(expandedSection === 'payroll' ? null as any : 'payroll')}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: 'none',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--app-text-primary)' }}>Payroll History</div>
                    <div style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>({payrollRecords.length})</div>
                  </div>
                  <ChevronRight style={{
                    width: 18,
                    height: 18,
                    color: 'var(--app-text-muted)',
                    transition: 'transform 0.2s',
                    transform: expandedSection === 'payroll' ? 'rotate(90deg)' : 'rotate(0deg)'
                  }} />
                </button>

                {expandedSection === 'payroll' && (
                  <div style={{ borderTop: '1px solid var(--app-border-subtle)', maxHeight: 400, overflowY: 'auto' }}>
                    {payrollRecords.map((record, idx) => (
                      <div key={idx} style={{ padding: '16px', borderBottom: idx < payrollRecords.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--app-text-primary)', marginBottom: 10 }}>{record.month}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--app-text-muted)' }}>Payable Days:</span>
                            <span style={{ fontWeight: 500, color: 'var(--app-text-primary)' }}>{record.payableDays}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--app-text-muted)' }}>Gross Salary:</span>
                            <span style={{ fontWeight: 500, color: 'var(--app-text-primary)' }}>₹{record.grossSalary.toLocaleString('en-IN')}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--app-text-muted)' }}>Deductions:</span>
                            <span style={{ fontWeight: 500, color: '#EF4444' }}>₹{record.deductions}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, paddingTop: 6, borderTop: '1px solid var(--app-border-subtle)' }}>
                            <span style={{ fontWeight: 600, color: 'var(--app-text-primary)' }}>Net Salary:</span>
                            <span style={{ fontWeight: 700, color: '#059669' }}>₹{record.netSalary.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes Section */}
              <div style={{ background: 'var(--app-card)', border: '1px solid var(--app-border)', borderRadius: 12, overflow: 'hidden' }}>
                <button
                  onClick={() => setExpandedSection(expandedSection === 'notes' ? null as any : 'notes')}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: 'none',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--app-text-primary)' }}>Employee Notes</div>
                    <div style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>({employeeNotesFiltered.length})</div>
                  </div>
                  <ChevronRight style={{
                    width: 18,
                    height: 18,
                    color: 'var(--app-text-muted)',
                    transition: 'transform 0.2s',
                    transform: expandedSection === 'notes' ? 'rotate(90deg)' : 'rotate(0deg)'
                  }} />
                </button>

                {expandedSection === 'notes' && (
                  <div style={{ borderTop: '1px solid var(--app-border-subtle)' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--app-border-subtle)' }}>
                      <button
                        onClick={() => { setNoteContent(''); setEditingNote(null); setShowNoteModal(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 500, background: 'var(--app-btn-primary-bg)', color: 'var(--app-btn-primary-fg)', border: 'none', borderRadius: 8, cursor: 'pointer', width: '100%', justifyContent: 'center' }}
                      >
                        <Plus style={{ width: 14, height: 14 }} />
                        Add Note
                      </button>
                    </div>
                    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                      {employeeNotesFiltered.length === 0 ? (
                        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--app-text-muted)', fontSize: 14 }}>
                          No notes yet
                        </div>
                      ) : (
                        employeeNotesFiltered.map((note, idx) => (
                          <div key={note.id} style={{ padding: '14px 16px', borderBottom: idx < employeeNotesFiltered.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                            <div style={{ fontSize: 11, color: 'var(--app-text-muted)', marginBottom: 6 }}>
                              {formatDateTime(note.timestamp)} • {note.author}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--app-text-secondary)', marginBottom: 8, whiteSpace: 'pre-wrap' }}>{note.content}</div>
                            <div style={{ display: 'flex', gap: 12 }}>
                              <button
                                onClick={() => { setNoteContent(note.content); setEditingNote(note); setShowNoteModal(true); }}
                                style={{ fontSize: 12, color: 'var(--app-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
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
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Desktop tabs
            <>
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--app-border)' }}>
                {[
                  { label: 'Calendar View', value: 'calendar' as const },
                  { label: 'Attendance History', value: 'attendance' as const },
                  { label: 'Leave History', value: 'leave' as const },
                  { label: 'Payroll History', value: 'payroll' as const },
                  { label: 'Notes', value: 'notes' as const },
                ].map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => setExpandedSection(tab.value)}
                    style={{
                      padding: '10px 16px',
                      fontSize: 13,
                      fontWeight: 500,
                      background: 'none',
                      color: expandedSection === tab.value ? 'var(--app-text-primary)' : 'var(--app-text-muted)',
                      border: 'none',
                      borderBottom: expandedSection === tab.value ? '2px solid var(--app-btn-primary-bg)' : '2px solid transparent',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ background: 'var(--app-card)', border: '1px solid var(--app-border)', borderRadius: 16, overflow: 'hidden' }}>
                {expandedSection === 'calendar' && (() => {
                  const monthStats = getMonthStats(calendarYear, calendarMonth, employee.id, attendance, holidays);

                  return (
                    <div style={{ padding: '24px' }}>
                      {/* Month/Year Navigation */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                        <button
                          onClick={() => {
                            if (calendarMonth === 0) {
                              setCalendarMonth(11);
                              setCalendarYear(calendarYear - 1);
                            } else {
                              setCalendarMonth(calendarMonth - 1);
                            }
                          }}
                          style={{
                            padding: '10px 20px',
                            background: 'var(--app-input-bg)',
                            border: '1px solid var(--app-input-border)',
                            borderRadius: 8,
                            fontSize: 14,
                            fontWeight: 500,
                            cursor: 'pointer'
                          }}
                        >
                          ← Previous
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <select
                            value={calendarMonth}
                            onChange={(e) => setCalendarMonth(Number(e.target.value))}
                            style={{
                              padding: '8px 14px',
                              fontSize: 16,
                              fontWeight: 600,
                              border: '1px solid var(--app-input-border)',
                              borderRadius: 8,
                              background: 'var(--app-input-bg)',
                              cursor: 'pointer'
                            }}
                          >
                            {Array.from({ length: 12 }, (_, i) => (
                              <option key={i} value={i}>{getMonthName(i)}</option>
                            ))}
                          </select>
                          <select
                            value={calendarYear}
                            onChange={(e) => setCalendarYear(Number(e.target.value))}
                            style={{
                              padding: '8px 14px',
                              fontSize: 16,
                              fontWeight: 600,
                              border: '1px solid var(--app-input-border)',
                              borderRadius: 8,
                              background: 'var(--app-input-bg)',
                              cursor: 'pointer'
                            }}
                          >
                            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                              <option key={year} value={year}>{year}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => {
                            const nowY = today.getFullYear(), nowM = today.getMonth();
                            if (calendarYear > nowY || (calendarYear === nowY && calendarMonth >= nowM)) return;
                            if (calendarMonth === 11) {
                              setCalendarMonth(0);
                              setCalendarYear(calendarYear + 1);
                            } else {
                              setCalendarMonth(calendarMonth + 1);
                            }
                          }}
                          disabled={calendarYear > today.getFullYear() || (calendarYear === today.getFullYear() && calendarMonth >= today.getMonth())}
                          style={{
                            padding: '10px 20px',
                            background: 'var(--app-input-bg)',
                            border: '1px solid var(--app-input-border)',
                            borderRadius: 8,
                            fontSize: 14,
                            fontWeight: 500,
                            cursor: (calendarYear > today.getFullYear() || (calendarYear === today.getFullYear() && calendarMonth >= today.getMonth())) ? 'not-allowed' : 'pointer',
                            opacity: (calendarYear > today.getFullYear() || (calendarYear === today.getFullYear() && calendarMonth >= today.getMonth())) ? 0.4 : 1,
                          }}
                        >
                          Next →
                        </button>
                      </div>

                      {/* Month Summary Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 }}>
                        {[
                          { label: 'Present', value: monthStats.present, color: '#10B981' },
                          { label: 'Half Day', value: monthStats.halfDay, color: '#F59E0B' },
                          { label: 'Paid Leave', value: monthStats.paidLeave, color: '#3B82F6' },
                          { label: 'Sick Leave', value: monthStats.sickLeave, color: '#8B5CF6' },
                          { label: 'Unpaid', value: monthStats.unpaidLeave, color: '#EF4444' },
                          { label: 'Other', value: monthStats.other, color: '#F97316' },
                        ].map(item => (
                          <div key={item.label} style={{ background: 'var(--app-input-bg)', borderRadius: 12, padding: 16, textAlign: 'center', border: '1px solid var(--app-input-border)' }}>
                            <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginBottom: 6 }}>{item.label}</div>
                            <div style={{ fontSize: 28, fontWeight: 700, color: item.color }}>{item.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Calendar Grid */}
                      <div style={{ marginBottom: 24 }}>
                        {/* Day Headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 12 }}>
                          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                            <div key={day} style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--app-text-muted)', padding: '8px 0' }}>
                              {day}
                            </div>
                          ))}
                        </div>

                        {/* Calendar Days - Desktop with Full Labels */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
                          {(() => {
                            const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
                            const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                            const days: JSX.Element[] = [];

                            // Empty cells for days before month starts
                            for (let i = 0; i < firstDay; i++) {
                              days.push(<div key={`empty-${i}`} />);
                            }

                            // Actual days
                            for (let day = 1; day <= daysInMonth; day++) {
                              const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                              const bgColor = getAttendanceColor(dateStr, employee.id, attendance, holidays, settings);
                              const label = getAttendanceLabel(dateStr, employee.id, attendance, holidays, settings);

                              days.push(
                                <button
                                  key={day}
                                  onClick={() => setSelectedCalendarDate(dateStr)}
                                  style={{
                                    minHeight: 80,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    fontSize: 18,
                                    fontWeight: 600,
                                    background: bgColor,
                                    color: bgColor === 'transparent' ? 'var(--app-text-primary)' : '#FFFFFF',
                                    border: selectedCalendarDate === dateStr ? '3px solid var(--app-btn-primary-bg)' : '1px solid var(--app-border-subtle)',
                                    borderRadius: 12,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    padding: '12px 8px'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (bgColor !== 'transparent') {
                                      e.currentTarget.style.opacity = '0.9';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.opacity = '1';
                                  }}
                                >
                                  <div>{day}</div>
                                  {label && <div style={{ fontSize: 10, fontWeight: 600, textAlign: 'center', lineHeight: '1.2', opacity: 0.95 }}>{label}</div>}
                                </button>
                              );
                            }

                            return days;
                          })()}
                        </div>
                      </div>

                      {/* Color Legend and Selected Date Details */}
                      <div style={{ display: 'grid', gridTemplateColumns: selectedCalendarDate ? '1fr 1fr' : '1fr', gap: 16 }}>
                        {/* Color Legend */}
                        <div style={{ background: 'var(--app-input-bg)', borderRadius: 12, padding: 16, border: '1px solid var(--app-input-border)' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-text-primary)', marginBottom: 12 }}>Color Legend</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                            {[
                              { label: 'Present', color: '#10B981' },
                              { label: 'Half Day', color: '#F59E0B' },
                              { label: 'Paid Leave', color: '#3B82F6' },
                              { label: 'Sick Leave', color: '#8B5CF6' },
                              { label: 'Unpaid Leave', color: '#EF4444' },
                              { label: 'Other Absence', color: '#F97316' },
                              { label: 'Holiday', color: 'var(--app-text-muted)' },
                            ].map(item => (
                              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 18, height: 18, background: item.color, borderRadius: 6 }} />
                                <div style={{ fontSize: 13, color: 'var(--app-text-muted)', fontWeight: 500 }}>{item.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Selected Date Details */}
                        {selectedCalendarDate && (() => {
                          const record = attendance[`${employee.id}_${selectedCalendarDate}`];
                          const isHoliday = holidays.find(h => h.date === selectedCalendarDate);
                          const displayStatus = getAttendanceLabel(selectedCalendarDate, employee.id, attendance, holidays, settings);

                          return (
                            <div style={{ background: 'var(--app-btn-primary-bg)', borderRadius: 12, padding: 18, color: 'var(--app-btn-primary-fg)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <div style={{ fontSize: 16, fontWeight: 600 }}>
                                  {formatDate(selectedCalendarDate)}
                                </div>
                                <button
                                  onClick={() => setSelectedCalendarDate(null)}
                                  style={{ background: 'rgba(128,128,128,0.2)', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6 }}
                                >
                                  <X style={{ width: 18, height: 18, color: 'var(--app-btn-primary-fg)' }} />
                                </button>
                              </div>
                              {isHoliday ? (
                                <div>
                                  <div style={{ fontSize: 14, opacity: 0.95, marginBottom: 8 }}>
                                    <strong>Status:</strong> Holiday
                                  </div>
                                  <div style={{ fontSize: 14, opacity: 0.95 }}>
                                    <strong>Name:</strong> {isHoliday.name}
                                  </div>
                                </div>
                              ) : record ? (
                                <div>
                                  <div style={{ fontSize: 14, opacity: 0.95, marginBottom: 8 }}>
                                    <strong>Status:</strong> {displayStatus}
                                  </div>
                                  {record.subStatus && record.subStatus !== 'full-day' && (
                                    <div style={{ fontSize: 14, opacity: 0.95, marginBottom: 8 }}>
                                      <strong>Type:</strong> {record.subStatus.replace(/-/g, ' ')}
                                    </div>
                                  )}
                                  {record.reason && (
                                    <div style={{ fontSize: 14, opacity: 0.95, marginBottom: 8 }}>
                                      <strong>Reason:</strong> {record.reason}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div style={{ fontSize: 14, opacity: 0.75 }}>No attendance record for this date</div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}

                {expandedSection === 'attendance' && (
                  <div>
                    <div style={{ padding: '20px', borderBottom: '1px solid var(--app-border-subtle)' }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-text-primary)', margin: 0 }}>
                        Attendance Records ({attendanceHistory.length} days)
                      </h3>
                    </div>
                    <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                      {attendanceHistory.map((record, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '120px 80px 140px 1fr',
                            gap: 12,
                            padding: '12px 20px',
                            borderBottom: '1px solid #F9FAFB',
                          }}
                        >
                          <div style={{ fontSize: 13, color: 'var(--app-text-primary)' }}>{formatDate(record.date)}</div>
                          <div style={{ fontSize: 13, color: 'var(--app-text-muted)' }}>{record.day}</div>
                          <div>
                            <span style={{
                              padding: '3px 10px',
                              fontSize: 11,
                              borderRadius: 20,
                              fontWeight: 500,
                              background: record.status === 'Present' ? '#D1FAE5' : record.status === 'Half Day' ? '#FEF3C7' : record.status.includes('Leave') ? '#DBEAFE' : 'var(--app-subtle-bg)',
                              color: record.status === 'Present' ? '#065F46' : record.status === 'Half Day' ? '#92400E' : record.status.includes('Leave') ? '#1D4ED8' : 'var(--app-text-muted)',
                            }}>
                              {record.status}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--app-text-muted)' }}>
                            {record.remarks}
                            {record.reason && (
                              <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: 'var(--app-text-muted)', fontStyle: 'italic' }}>
                                Reason: {record.reason}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {expandedSection === 'leave' && (
                  <div>
                    <div style={{ padding: '20px', borderBottom: '1px solid var(--app-border-subtle)' }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-text-primary)', margin: 0 }}>
                        Leave Records ({leaveHistory.length} leaves)
                      </h3>
                    </div>
                    <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                      {leaveHistory.length === 0 ? (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--app-text-muted)', fontSize: 14 }}>
                          No leave records for this period
                        </div>
                      ) : (
                        leaveHistory.map((record, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '120px 140px 100px 1fr',
                              gap: 12,
                              padding: '12px 20px',
                              borderBottom: '1px solid #F9FAFB',
                            }}
                          >
                            <div style={{ fontSize: 13, color: 'var(--app-text-primary)' }}>{formatDate(record.date)}</div>
                            <div style={{ fontSize: 13, color: 'var(--app-text-muted)' }}>{record.leaveType}</div>
                            <div style={{ fontSize: 13, color: 'var(--app-text-muted)' }}>{record.duration}</div>
                            <div style={{ fontSize: 13, color: 'var(--app-text-muted)' }}>{record.remarks}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {expandedSection === 'payroll' && (
                  <div>
                    <div style={{ padding: '20px', borderBottom: '1px solid var(--app-border-subtle)' }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-text-primary)', margin: 0 }}>
                        Payroll Records ({payrollRecords.length} months)
                      </h3>
                    </div>
                    <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                      {payrollRecords.map((record, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '120px 100px 120px 100px 120px',
                            gap: 12,
                            padding: '12px 20px',
                            borderBottom: '1px solid #F9FAFB',
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--app-text-primary)' }}>{record.month}</div>
                          <div style={{ fontSize: 13, color: 'var(--app-text-muted)' }}>{record.payableDays} days</div>
                          <div style={{ fontSize: 13, color: 'var(--app-text-muted)' }}>₹{record.grossSalary.toLocaleString('en-IN')}</div>
                          <div style={{ fontSize: 13, color: '#EF4444' }}>₹{record.deductions}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>₹{record.netSalary.toLocaleString('en-IN')}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {expandedSection === 'notes' && (
                  <div>
                    <div style={{ padding: '20px', borderBottom: '1px solid var(--app-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-text-primary)', margin: 0 }}>
                        Employee Notes ({employeeNotesFiltered.length})
                      </h3>
                      <button
                        onClick={() => { setNoteContent(''); setEditingNote(null); setShowNoteModal(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: 12, fontWeight: 500, background: 'var(--app-btn-primary-bg)', color: 'var(--app-btn-primary-fg)', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                      >
                        <Plus style={{ width: 14, height: 14 }} />
                        Add Note
                      </button>
                    </div>
                    <div style={{ maxHeight: 500, overflowY: 'auto', padding: '20px' }}>
                      {employeeNotesFiltered.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--app-text-muted)', fontSize: 14, padding: '20px 0' }}>
                          No notes yet. Add a note to track important information.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          {employeeNotesFiltered.map(note => (
                            <div key={note.id} style={{ position: 'relative', paddingLeft: 24, borderLeft: '2px solid #E5E7EB' }}>
                              <div style={{ position: 'absolute', left: -5, top: 0, width: 8, height: 8, background: 'var(--app-btn-primary-bg)', borderRadius: '50%' }} />
                              <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginBottom: 4 }}>
                                {formatDateTime(note.timestamp)} • {note.author}
                              </div>
                              <div style={{ fontSize: 13, color: 'var(--app-text-secondary)', marginBottom: 8, whiteSpace: 'pre-wrap' }}>{note.content}</div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  onClick={() => { setNoteContent(note.content); setEditingNote(note); setShowNoteModal(true); }}
                                  style={{ fontSize: 12, color: 'var(--app-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
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
            </>
          )}
        </div>
      </div>

      {/* Edit Employee Modal */}
      {showEditEmployee && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'var(--app-overlay)', zIndex: 100, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowEditEmployee(false); }}
        >
          <div style={{
            background: 'var(--app-card)',
            width: isMobile ? '100%' : 460,
            borderRadius: isMobile ? '20px 20px 0 0' : 20,
            padding: isMobile ? '24px 20px 32px' : 28,
            maxHeight: isMobile ? '92dvh' : 'auto',
            overflowY: 'auto',
          }}>
            {isMobile && <div style={{ width: 36, height: 4, background: 'var(--app-border)', borderRadius: 2, margin: '0 auto 20px' }} />}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ color: 'var(--app-text-primary)', margin: 0 }}>Edit Employee</h2>
              <button onClick={() => setShowEditEmployee(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-text-muted)', padding: 4 }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {/* Edit form — all fields */}
            {(() => {
              const fi = (type: string, label: string, key: keyof typeof editForm) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 5 }}>{label}</label>
                  <input type={type} value={editForm[key] as string} onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', fontSize: 13.5, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 9, outline: 'none', boxSizing: 'border-box', color: 'var(--app-text-primary)' }} />
                </div>
              );
              const sectionLabel = (label: string) => (
                <div key={label} style={{ fontSize: 11, fontWeight: 700, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 16, marginBottom: 4 }}>{label}</div>
              );
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sectionLabel('Basic Information')}
                  {fi('text', 'Full Name *', 'name')}
                  {fi('number', 'Monthly Salary *', 'salary')}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 5 }}>Department *</label>
                    <select value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', fontSize: 13.5, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 9, outline: 'none', boxSizing: 'border-box', color: 'var(--app-text-primary)' }}>
                      {['Engineering', 'Design', 'HR', 'Sales', 'Marketing', 'Finance', 'Operations', 'Product'].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  {fi('date', 'Joining Date *', 'joiningDate')}

                  {sectionLabel('Employment Details')}
                  {fi('text', 'Designation', 'designation')}
                  {fi('text', 'Employee Code', 'employeeCode')}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 5 }}>Employment Type</label>
                    <select value={editForm.employmentType} onChange={e => setEditForm({ ...editForm, employmentType: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', fontSize: 13.5, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 9, outline: 'none', boxSizing: 'border-box', color: 'var(--app-text-primary)' }}>
                      <option value="">— Select —</option>
                      <option value="full-time">Full Time</option>
                      <option value="part-time">Part Time</option>
                      <option value="contract">Contract</option>
                      <option value="intern">Intern</option>
                    </select>
                  </div>

                  {sectionLabel('Contact Information')}
                  {fi('tel', 'Mobile Number', 'mobile')}
                  {fi('tel', 'Alternate Number', 'alternateMobile')}
                  {fi('email', 'Email Address', 'email')}

                  {sectionLabel('Personal Details')}
                  {fi('date', 'Date of Birth', 'dateOfBirth')}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 5 }}>Gender</label>
                    <select value={editForm.gender} onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', fontSize: 13.5, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 9, outline: 'none', boxSizing: 'border-box', color: 'var(--app-text-primary)' }}>
                      <option value="">— Select —</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {sectionLabel('Emergency Contact')}
                  {fi('text', 'Emergency Contact Name', 'emergencyContactName')}
                  {fi('tel', 'Emergency Contact Phone', 'emergencyContactNumber')}

                  {sectionLabel('Address')}
                  {fi('text', 'Current Address', 'currentAddress')}
                  {fi('text', 'City', 'city')}
                  {fi('text', 'State', 'state')}
                  {fi('text', 'Postal Code', 'postalCode')}
                  {fi('text', 'Country', 'country')}
                </div>
              );
            })()}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowEditEmployee(false)} style={{ flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 500, background: 'var(--app-card)', border: '1px solid var(--app-input-border)', borderRadius: 12, color: 'var(--app-text-secondary)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSaveEmployee} style={{ flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600, background: 'var(--app-btn-primary-bg)', border: 'none', borderRadius: 12, color: 'var(--app-btn-primary-fg)', cursor: 'pointer' }}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'var(--app-overlay)', zIndex: 100, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowNoteModal(false); }}
        >
          <div style={{
            background: 'var(--app-card)',
            width: isMobile ? '100%' : 500,
            borderRadius: isMobile ? '20px 20px 0 0' : 20,
            padding: isMobile ? '24px 20px 32px' : 28,
            maxHeight: isMobile ? '92dvh' : 'auto',
            overflowY: 'auto',
          }}>
            {isMobile && <div style={{ width: 36, height: 4, background: 'var(--app-border)', borderRadius: 2, margin: '0 auto 20px' }} />}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ color: 'var(--app-text-primary)', margin: 0 }}>{editingNote ? 'Edit Note' : 'Add Note'}</h2>
              <button onClick={() => setShowNoteModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-text-muted)', padding: 4 }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--app-text-secondary)', marginBottom: 6 }}>Note</label>
              <textarea
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                placeholder="Enter note content..."
                style={{ width: '100%', minHeight: 120, padding: '10px 12px', fontSize: 14, background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)', borderRadius: 10, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', color: 'var(--app-text-primary)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowNoteModal(false)} style={{ flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 500, background: 'var(--app-card)', border: '1px solid var(--app-input-border)', borderRadius: 12, color: 'var(--app-text-secondary)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleAddNote} style={{ flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600, background: 'var(--app-btn-primary-bg)', border: 'none', borderRadius: 12, color: 'var(--app-btn-primary-fg)', cursor: 'pointer' }}>
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
          defaultFrom={dateRange.from}
          defaultTo={dateRange.to}
          onClose={() => setShowExportModal(false)}
          onExportExcel={handleExportExcel}
          onExportPDF={handleExportPDF}
        />
      )}

      {/* Photo Upload */}
      {showPhotoUpload && (
        <PhotoUploadCrop
          currentPhoto={employee.profilePhoto}
          onSave={handlePhotoSave}
          onCancel={() => setShowPhotoUpload(false)}
        />
      )}
    </>
  );
}

function ExportModal({
  isMobile,
  defaultFrom,
  defaultTo,
  onClose,
  onExportExcel,
  onExportPDF,
}: {
  isMobile: boolean;
  defaultFrom: string;
  defaultTo: string;
  onClose: () => void;
  onExportExcel: (from: string, to: string) => void;
  onExportPDF: (from: string, to: string) => void;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const inputStyle: React.CSSProperties = {
    flex: 1, padding: '10px 12px', fontSize: 14,
    background: 'var(--app-input-bg)', border: '1px solid var(--app-input-border)',
    borderRadius: 10, outline: 'none', color: 'var(--app-text-primary)',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'var(--app-overlay)', zIndex: 100, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--app-card)',
        width: isMobile ? '100%' : 440,
        borderRadius: isMobile ? '20px 20px 0 0' : 20,
        padding: isMobile ? '24px 20px 32px' : 28,
        maxHeight: isMobile ? '80dvh' : 'auto',
        overflowY: 'auto',
      }}>
        {isMobile && <div style={{ width: 36, height: 4, background: 'var(--app-border)', borderRadius: 2, margin: '0 auto 20px' }} />}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: 'var(--app-text-primary)', margin: 0, fontSize: 18 }}>Export Data</h2>
            <p style={{ fontSize: 12, color: 'var(--app-text-muted)', margin: '4px 0 0' }}>All sections included: attendance, payroll, leaves, notes</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-text-muted)', padding: 4 }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--app-text-secondary)', marginBottom: 8 }}>Start Date</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--app-text-secondary)', marginBottom: 8 }}>End Date</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inputStyle} />
        </div>

        {(!from || !to || from > to) && (
          <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, marginBottom: 16, fontSize: 13, color: '#DC2626' }}>
            Please select a valid date range.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => { if (from && to && from <= to) { onExportExcel(from, to); onClose(); } }}
            disabled={!from || !to || from > to}
            style={{ flex: 1, padding: '12px 0', fontSize: 14, fontWeight: 600, background: '#059669', border: 'none', borderRadius: 12, color: '#fff', cursor: (!from || !to || from > to) ? 'not-allowed' : 'pointer', opacity: (!from || !to || from > to) ? 0.5 : 1 }}
          >
            Export Excel
          </button>
          <button
            onClick={() => { if (from && to && from <= to) { onExportPDF(from, to); onClose(); } }}
            disabled={!from || !to || from > to}
            style={{ flex: 1, padding: '12px 0', fontSize: 14, fontWeight: 600, background: '#DC2626', border: 'none', borderRadius: 12, color: '#fff', cursor: (!from || !to || from > to) ? 'not-allowed' : 'pointer', opacity: (!from || !to || from > to) ? 0.5 : 1 }}
          >
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}
