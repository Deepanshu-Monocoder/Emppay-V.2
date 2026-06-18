PHASE 3 + PHASE 4 + PHASE 5 IMPLEMENTATION

IMPORTANT

Phase 1 and Phase 2 have already been completed.

DO NOT modify attendance engine logic.

DO NOT modify payroll formulas.

DO NOT modify working day calculations.

Use existing attendanceEngine.ts and payroll calculations as-is.

This phase focuses on:

1. Employee Experience
2. Export System Rewrite
3. Company Branding
4. Dark Mode Polish
5. Final UX Improvements

All changes must work on:

* Desktop
* Mobile

No layout breakage.

No horizontal scrolling.

==================================================
PART 1
EMPLOYEE PROFILE IMPROVEMENTS
=============================

Review:

src/app/components/EmployeeProfileScreen.tsx

(or equivalent file)

Create a complete employee profile experience.

Profile should contain:

Overview

Attendance History

Leave History

Payroll History

Calendar View

Documents

Notes

---

## EMPLOYEE SUMMARY CARD

Display:

Profile Photo

Name

Employee ID

Department

Designation

Joining Date

Salary

Phone Number

Email

Employment Type

Attendance Percentage

Present Days

Leave Count

==================================================
PART 2
DASHBOARD QUICK NAVIGATION
==========================

Review:

Dashboard attendance employee rows

Current:

Owner must:

Dashboard
→ Employees
→ Employee Profile

Remove this requirement.

---

NEW BEHAVIOR

Employee Photo

Employee Name

must be clickable.

Clicking either:

Open Employee Profile.

---

IMPORTANT

Attendance buttons must remain independent.

Example:

Photo → Profile

Name → Profile

Present → Mark Present

Absent → Mark Absent

Half Day → Mark Half Day

Leave → Mark Leave

No accidental attendance changes.

Works on desktop and mobile.

==================================================
PART 3
EMPLOYEE PROFILE PHOTO SYSTEM
=============================

Review:

PhotoUploadCrop.tsx

ProfilePhoto.tsx

Implement fully.

---

ADD EMPLOYEE

Allow:

Upload Photo

Camera Upload (Mobile)

Gallery Upload

---

PHOTO CROPPING

Add crop tool.

Allow:

Zoom

Reposition

Rotate

Circular Preview

Output:

Circular profile image

---

PROFILE PHOTO USAGE

Replace text avatars everywhere.

Current:

AS

Replace:

Employee photo

Used in:

Dashboard

Employee List

Employee Profile

Attendance Records

Payroll Records

Exports

==================================================
PART 4
EMPLOYEE DOCUMENTS
==================

Review:

DocumentManager.tsx

Add employee document support.

Optional fields:

Aadhaar

PAN

Passport

Driving License

Employment Contract

Other Files

---

SUPPORTED TYPES

PDF

PNG

JPG

JPEG

---

Allow:

Upload

Preview

Download

Replace

Delete

==================================================
PART 5
EMPLOYEE DETAILS EXPANSION
==========================

Add optional fields:

Mobile Number

Alternate Number

Email

Date of Birth

Emergency Contact

Emergency Phone

Current Address

Permanent Address

City

State

Postal Code

Country

Designation

Reporting Manager

Employee Code

==================================================
PART 6
EMPLOYEE ATTENDANCE CALENDAR
============================

Create calendar section inside Employee Profile.

---

MONTH VIEW

Allow:

Previous Month

Month Selector

Year Selector

---

NO FUTURE MONTHS

Users cannot browse beyond current month.

Users cannot browse future years.

---

CALENDAR COLORS

Green = Present

Yellow = Half Day

Blue = Paid Leave

Purple = Sick Leave

Red = Unpaid Leave

Orange = Other

Gray = Holiday

Dark Gray = Sunday Off

White = Not Marked

---

DATE DETAILS

Click Date

Show:

Date

Status

Reason

Remarks

==================================================
PART 7
EXPORT SYSTEM REWRITE
=====================

REMOVE

Summary Report

Detailed Audit Report

Export Section Checkboxes

---

NEW EXPORT FLOW

Export Data

Start Date

End Date

Export PDF

Export Excel

==================================================
PART 8
EXPORT DATE FIXES
=================

Fix existing bugs.

Current bug:

Selected date range
≠
Exported date range

Export must always use selected dates.

==================================================
PART 9
PDF EXPORT STRUCTURE
====================

For selected date range include:

Employee Information

Attendance Summary

Attendance Calendar

Full Attendance Register

Leave History

Payroll History

Payroll Calculation Breakdown

Notes

---

ATTENDANCE REGISTER

Show EVERY date.

Do NOT filter.

Do NOT show:

"Meaningful entries only"

---

Example:

01 Jun 2026  Not Marked

02 Jun 2026  Present

03 Jun 2026  Paid Leave

04 Jun 2026  Sunday Off

05 Jun 2026  Present

etc.

Every date in selected range.

---

IMPORTANT

Not Marked must appear.

Do not hide it.

==================================================
PART 10
EXCEL EXPORT
============

Workbook Structure

Sheet 1

Employee Dashboard

Sheet 2

Attendance Records

Sheet 3

Leave History

Sheet 4

Payroll History

Sheet 5

Attendance Calendar

---

Excel must use same attendance engine.

No duplicate calculations.

==================================================
PART 11
COMPANY BRANDING
================

Create:

Settings
→ Company Branding

---

BRANDING MODE

App Generated

Custom Letterhead

---

APP GENERATED

Company Logo

Company Name

Address

Phone

Email

Website

GST

---

CUSTOM LETTERHEAD

Upload:

PNG

JPG

PDF

---

Fallback:

If upload missing

Use App Generated branding.

---

Apply branding to:

PDF Exports

Payslips

Future HR Documents

==================================================
PART 12
DARK MODE POLISH
================

Review every screen.

Desktop

Mobile

---

Check:

Contrast

Text readability

Button readability

Calendar colors

Attendance colors

Export previews

---

Maintain attendance status colors.

Do not make dark mode pure black.

Use modern professional dark theme.

==================================================
PART 13
FINAL QA
========

Verify:

Employee Profile works

Calendar works

Profile Photo works

Documents work

Dashboard quick navigation works

PDF exports work

Excel exports work

Branding works

Dark Mode works

Desktop works

Mobile works

No horizontal scrolling

No broken layouts

No duplicate calculations

Before completion provide:

1. Files modified
2. Components modified
3. New components added
4. Remaining bugs
5. Mobile compatibility report
6. Desktop compatibility report
