import type { Employee, AttendanceRecord, Holiday, Settings, SubStatus } from '../App';

// ─── Timezone-safe date string helper ─────────────────────────────────────────
// Always build date strings from local year/month/day components, never from
// Date.toISOString() which converts to UTC and can shift the date by ±1 day.
export function makeDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ─── Working days ──────────────────────────────────────────────────────────────
// Working days = days in month − Sundays. Sundays are always non-working.
// Holidays do NOT reduce working days — they are separate payroll events.
export function getWorkingDays(year: number, month: number): number {
  const dim = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= dim; d++) {
    if (new Date(year, month, d).getDay() === 0) continue;
    count++;
  }
  return count;
}

// Count Sundays in a month
export function getSundayCount(year: number, month: number): number {
  const dim = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= dim; d++) {
    if (new Date(year, month, d).getDay() === 0) count++;
  }
  return count;
}

// ─── Per-month payroll result ──────────────────────────────────────────────────
export interface CalcResult {
  workingDays: number;       // total - Sundays (holidays NOT subtracted)
  markedDays: number;        // explicitly marked attendance entries
  notMarkedDays: number;     // working non-holiday days with no attendance record
  payableDays: number;       // days that contribute to salary
  leaveCount: number;        // unpaid leave count (for deduction display)
  finalSalary: number;
  fullDays: number;
  halfDays: number;
  paidLeaves: number;
  sickLeaves: number;
  unpaidLeaves: number;
  otherAbs: number;
  holidays: number;          // holiday days in this month (always payable)
  sundayOffDays: number;
}

export function calcPayroll(
  employee: Employee,
  year: number,
  month: number,
  attendance: Record<string, AttendanceRecord>,
  holidays: Holiday[],
  settings: Settings,
): CalcResult {
  const dim = new Date(year, month + 1, 0).getDate();
  let fullDays = 0, halfDays = 0, paidLeaves = 0, sickLeaves = 0, unpaidLeaves = 0, otherAbs = 0;
  let markedDays = 0, holidayCount = 0, sundayOffDays = 0;

  const holidaySet = new Set(holidays.map(h => h.date));

  for (let d = 1; d <= dim; d++) {
    const dateStr = makeDateStr(year, month, d);
    const dayOfWeek = new Date(year, month, d).getDay();

    if (dayOfWeek === 0) {
      sundayOffDays++;
      continue;
    }

    if (holidaySet.has(dateStr)) {
      holidayCount++;
      // Holidays are automatically payable — skip to next day
      continue;
    }

    const rec = attendance[`${employee.id}_${dateStr}`];
    // Not Marked: excluded entirely from payroll calculations
    if (!rec || !rec.mainStatus) continue;

    markedDays++;
    if (rec.mainStatus === 'present') {
      if (rec.subStatus === 'half-day') halfDays++;
      else fullDays++;
    } else {
      const sub = rec.subStatus as SubStatus;
      if (sub === 'paid-leave') paidLeaves++;
      else if (sub === 'sick-leave') sickLeaves++;
      else if (sub === 'unpaid-leave') unpaidLeaves++;
      else otherAbs++;
    }
  }

  // Working days = all non-Sunday days (holidays are INCLUDED in denominator per Phase 1)
  const workingDays = dim - sundayOffDays;
  const notMarkedDays = workingDays - holidayCount - markedDays;

  // ── Per-type contribution values (from settings) ──
  const halfDayContrib     = settings.halfDayValue ?? 0.5;           // 0.25 / 0.5 / 0.75 / 1.0
  const paidLeaveContrib   = settings.paidLeaveFullPay ? 1 : 0;
  const sickLeaveContrib   = settings.sickLeaveFullPay ? 1 : 0;
  const otherAbsContrib    =
    (settings.otherAbsenceHandling ?? 'unpaid') === 'full'  ? 1 :
    (settings.otherAbsenceHandling ?? 'unpaid') === 'half'  ? 0.5 : 0;
  const holidayContrib     = (settings.holidayPayable   ?? true) ? 1 : 0;

  const payableDays =
    fullDays +
    halfDays   * halfDayContrib +
    paidLeaves * paidLeaveContrib +
    sickLeaves * sickLeaveContrib +
    otherAbs   * otherAbsContrib +
    holidayCount  * holidayContrib;
  // Sundays never contribute to payable days — they are non-working days
  // unpaidLeaves always contribute 0 — intentionally excluded above

  // leaveCount = fully-deducted days (for table display of "unpaid deductions")
  const leaveCount = unpaidLeaves
    + (!settings.paidLeaveFullPay ? paidLeaves : 0)
    + (!settings.sickLeaveFullPay ? sickLeaves : 0)
    + ((settings.otherAbsenceHandling ?? 'unpaid') === 'unpaid' ? otherAbs : 0);

  const finalSalary = workingDays > 0 ? Math.round((employee.salary / workingDays) * payableDays) : 0;

  return {
    workingDays,
    markedDays,
    notMarkedDays,
    payableDays,
    leaveCount,
    finalSalary,
    fullDays,
    halfDays,
    paidLeaves,
    sickLeaves,
    unpaidLeaves,
    otherAbs,
    holidays: holidayCount,
    sundayOffDays,
  };
}

// ─── Attendance summary over a date range ────────────────────────────────────
export interface AttendanceSummary {
  presentDays: number;
  halfDays: number;
  paidLeaves: number;
  sickLeaves: number;
  unpaidLeaves: number;
  otherAbsences: number;
  holidayDays: number;
  notMarkedDays: number;
  markedDays: number;
  sundayOffDays: number;
  totalWorkingDays: number;  // total non-Sunday days in range
  attendancePercentage: number;
}

export function calculateAttendanceSummary(
  employeeId: string,
  from: string,
  to: string,
  attendance: Record<string, AttendanceRecord>,
  holidays: Holiday[],
  settings: Settings,
): AttendanceSummary {
  const holidaySet = new Set(holidays.map(h => h.date));
  let presentDays = 0, halfDays = 0, paidLeaves = 0, sickLeaves = 0, unpaidLeaves = 0, otherAbsences = 0;
  let holidayDays = 0, markedDays = 0, sundayOffDays = 0, totalWorkingDays = 0;

  // Parse start/end from 'YYYY-MM-DD' strings directly (timezone-safe)
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const startDate = new Date(fy, fm - 1, fd);
  const endDate = new Date(ty, tm - 1, td);

  const cur = new Date(startDate);
  while (cur <= endDate) {
    const year = cur.getFullYear();
    const month = cur.getMonth();
    const day = cur.getDate();
    const dateStr = makeDateStr(year, month, day);
    const dayOfWeek = cur.getDay(); // local — always correct for weekday

    if (dayOfWeek === 0) {
      sundayOffDays++;
      cur.setDate(cur.getDate() + 1);
      continue;
    }

    totalWorkingDays++;

    if (holidaySet.has(dateStr)) {
      holidayDays++;
      cur.setDate(cur.getDate() + 1);
      continue;
    }

    const rec = attendance[`${employeeId}_${dateStr}`];
    if (rec?.mainStatus) {
      markedDays++;
      if (rec.mainStatus === 'present') {
        if (rec.subStatus === 'half-day') halfDays++;
        else presentDays++;
      } else {
        if (rec.subStatus === 'paid-leave') paidLeaves++;
        else if (rec.subStatus === 'sick-leave') sickLeaves++;
        else if (rec.subStatus === 'unpaid-leave') unpaidLeaves++;
        else otherAbsences++;
      }
    }

    cur.setDate(cur.getDate() + 1);
  }

  const notMarkedDays = totalWorkingDays - holidayDays - markedDays;
  // Attendance % based on markable days (working days that aren't holidays)
  const markableDays = totalWorkingDays - holidayDays;
  const attendancePercentage = markableDays > 0
    ? Math.round(((presentDays + halfDays * 0.5 + paidLeaves + sickLeaves) / markableDays) * 100)
    : 0;

  return {
    presentDays,
    halfDays,
    paidLeaves,
    sickLeaves,
    unpaidLeaves,
    otherAbsences,
    holidayDays,
    notMarkedDays,
    markedDays,
    sundayOffDays,
    totalWorkingDays,
    attendancePercentage,
  };
}
