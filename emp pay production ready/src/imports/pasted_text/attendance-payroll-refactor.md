PHASE 1 — ATTENDANCE & PAYROLL FOUNDATION REFACTOR

IMPORTANT

This is Phase 1 only.

Do NOT modify:

* Export system
* Employee photos
* Branding
* Calendar UI
* Employee profile enhancements
* Document uploads

Focus only on attendance and payroll foundation logic.

All changes must work identically on:

* Desktop
* Mobile
* PDF generation
* Excel generation

No separate logic should exist for different platforms.

==================================================
STEP 1
MAKE attendanceEngine.ts THE SINGLE SOURCE OF TRUTH
===================================================

Review:

src/app/utils/attendanceEngine.ts

This file must become the primary source of all attendance calculations.

Any attendance or payroll calculations found elsewhere should eventually call this engine.

Create or consolidate functions such as:

calculateWorkingDays()

calculateAttendanceSummary()

calculatePayroll()

calculateAttendancePercentage()

Do NOT duplicate calculation logic across screens.

==================================================
STEP 2
REMOVE FIXED WORKING DAY ASSUMPTIONS
====================================

Search project-wide for:

"26 working days"

workingDays = 26

or any hardcoded working day values.

Remove hardcoded assumptions.

Working days must be calculated dynamically.

==================================================
STEP 3
UPDATE WORKING DAY CALCULATION
==============================

Current code found in attendanceEngine.ts:

const workingDays = dim - sundayOffDays - holidayCount;

This logic is no longer correct.

Replace with logic matching:

# Working Days

## Days In Month

Sunday Off Days

Holidays should NOT reduce working days.

Reason:

Holidays are separate attendance/payroll events.

Example:

June 2026

30 days
4 Sundays

Working Days = 26

Even if holidays exist.

==================================================
STEP 4
AUDIT DASHBOARD WORKING DAY CALCULATIONS
========================================

Review:

src/app/components/DashboardScreen.tsx

Current logic contains:

if (holidays.some(h => h.date === ds)) continue;

Review all working day calculations and update them to use the shared attendance engine.

Dashboard must not maintain independent working-day logic.

Dashboard must display values returned by attendanceEngine.ts.

==================================================
STEP 5
NOT MARKED BECOMES A REAL ATTENDANCE STATE
==========================================

Current default attendance state should become:

Not Marked

Rules:

Not Marked:

* Is not Present
* Is not Absent
* Is not Holiday
* Is not Sunday Off
* Is not Leave

It simply means:

Attendance has not been recorded yet.

Do not automatically convert Not Marked into any other state.

==================================================
STEP 6
SUNDAY OFF RULES
================

Sunday Off should only occur when:

settings.sundayOff === true

AND

date.getDay() === 0

Verify all implementations.

Sunday Off must never appear on Saturdays.

==================================================
STEP 7
INVESTIGATE SATURDAY/SUNDAY BUG
===============================

Current exports show:

Sat → Sunday Off

This is incorrect.

Audit:

* date parsing
* timezone conversions
* weekday calculations
* export date formatting

Verify that:

0 = Sunday

6 = Saturday

Ensure Saturday is treated as a normal working day.

Do not introduce Saturday holiday logic.

==================================================
STEP 8
LIVE WORKING DAY PREVIEW
========================

Remove editable Working Days setting.

Replace with read-only display.

Example:

Current Month: June 2026

Total Days: 30

Sunday Offs: 4

Working Days: 26

Display updates automatically when settings change.

Display is informational only.

Users cannot edit it.

==================================================
STEP 9
UNIFIED CALCULATIONS
====================

Ensure the following screens all consume the same attendance engine:

Dashboard

Payroll

Employee Profile

Attendance History

Future Exports

Mobile Version

Desktop Version

No duplicate calculations.

==================================================
STEP 10
DO NOT MODIFY EXPORTS YET
=========================

Do not redesign PDFs.

Do not redesign Excel exports.

Only ensure foundational attendance calculations are correct.

Export redesign happens in Phase 4.

==================================================
SUCCESS CRITERIA
================

After implementation:

✓ No hardcoded 26-day assumptions

✓ Working days auto-calculated

✓ Holidays do not reduce working days

✓ Not Marked is a real attendance state

✓ Sunday Off only appears on actual Sundays

✓ Saturdays remain normal working days

✓ Dashboard uses attendance engine

✓ Payroll uses attendance engine

✓ Employee Profile uses attendance engine

✓ Mobile and Desktop use identical calculations

✓ Live Working Days preview works correctly

Before finishing, provide a summary of:

1. Files modified
2. Functions modified
3. Remaining duplicated logic (if any)
4. Potential risks before Phase 2
