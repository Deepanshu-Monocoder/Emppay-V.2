import { useState, useEffect, useRef } from 'react';
import { toast, Toaster } from 'sonner';
import { useIsMobile } from './hooks/useIsMobile';
import { ThemeProvider } from './contexts/ThemeContext';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { DashboardScreen } from './components/DashboardScreen';
import { PayrollScreen } from './components/PayrollScreen';
import { EmployeeScreen } from './components/EmployeeScreen';
import { HolidayScreen } from './components/HolidayScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { UserSelectScreen, type UserProfile, type GoogleUser } from './components/UserSelectScreen';
import { EmployeeProfileScreen } from './components/EmployeeProfileScreen';
import { SplashScreen } from './components/SplashScreen';
import { LoginScreen } from './components/LoginScreen';
import { SessionCheckScreen } from './components/SessionCheckScreen';
import type { SyncStatus } from './components/SyncIndicator';
import { auth, onAuthStateChanged, signOut, type User } from '../lib/firebase';
import { saveCloudData, loadCloudData, subscribeToCloudData } from '../lib/firestore';

// ─── Screen & data types ───────────────────────────────────────────────────────

export type Screen = 'dashboard' | 'payroll' | 'employees' | 'holidays' | 'settings' | 'employee-profile';
export type MainStatus = 'present' | 'absent';
export type SubStatus = 'full-day' | 'half-day' | 'paid-leave' | 'sick-leave' | 'unpaid-leave' | 'other';
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'intern';

export interface EmployeeDocument {
  id: string;
  name: string;
  type: 'aadhaar' | 'pan' | 'license' | 'passport' | 'company-id' | 'other';
  fileData: string;
  fileType: string;
  uploadedAt: string;
}

export interface Employee {
  id: string;
  name: string;
  salary: number;
  department: string;
  joiningDate: string;
  profilePhoto?: string;
  mobile?: string;
  alternateMobile?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  emergencyContactName?: string;
  emergencyContactNumber?: string;
  currentAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  designation?: string;
  employeeCode?: string;
  employmentType?: EmploymentType;
  documents?: EmployeeDocument[];
}

export interface EmployeeNote {
  id: string;
  employeeId: string;
  content: string;
  timestamp: string;
  author: string;
}

export interface AttendanceRecord {
  mainStatus: MainStatus | null;
  subStatus: SubStatus | null;
  reason?: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
}

export type OtherAbsenceHandling = 'full' | 'half' | 'unpaid';
export type BrandingMode = 'app-generated' | 'custom';

export interface Settings {
  companyName: string;
  currency: string;
  holidayPayable: boolean;
  halfDayValue: number;
  paidLeaveFullPay: boolean;
  sickLeaveFullPay: boolean;
  otherAbsenceHandling: OtherAbsenceHandling;
  brandingMode?: BrandingMode;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyGST?: string;
  companyLogo?: string;
  customLetterhead?: string;
}

// ─── Default data ──────────────────────────────────────────────────────────────

const defaultEmployees: Employee[] = [
  { id: 'demo-1', name: 'Demo emp', salary: 30000, department: 'General', designation: 'Staff', joiningDate: new Date().toISOString().slice(0, 10) },
];

const defaultHolidays: Holiday[] = [
  { id: '1', name: 'Republic Day',     date: '2025-01-26' },
  { id: '2', name: 'Holi',            date: '2025-03-14' },
  { id: '3', name: 'Independence Day', date: '2025-08-15' },
  { id: '4', name: 'Gandhi Jayanti',   date: '2025-10-02' },
  { id: '5', name: 'Diwali',          date: '2025-10-20' },
  { id: '6', name: 'Christmas',       date: '2025-12-25' },
];

const defaultSettings: Settings = {
  companyName: 'Kundra Corp',
  currency: 'INR',
  holidayPayable: true,
  halfDayValue: 0.5,
  paidLeaveFullPay: true,
  sickLeaveFullPay: true,
  otherAbsenceHandling: 'unpaid',
};

// ─── Old demo employee names to purge from saved data ─────────────────────────

const LEGACY_DEMO_NAMES = new Set([
  'arjun sharma', 'priya patel', 'rahul mehta', 'sneha joshi',
  'vikram singh', 'kavya nair', 'amit kumar', 'deepika reddy',
]);

function migrateEmployees(saved: Employee[]): Employee[] {
  const real = saved.filter(e => !LEGACY_DEMO_NAMES.has(e.name.trim().toLowerCase()));
  if (real.length === 0) return defaultEmployees;
  return real;
}

// ─── Settings migration ────────────────────────────────────────────────────────

function migrateSettings(raw: Record<string, unknown>): Settings {
  return {
    ...defaultSettings,
    ...(raw as Partial<Settings>),
    halfDayValue:
      (raw.halfDayValue as number | undefined) ??
      ((raw.halfDayEnabled === false) ? 0.25 : 0.5),
    otherAbsenceHandling:
      (raw.otherAbsenceHandling as OtherAbsenceHandling | undefined) ??
      ((raw.otherAbsencePayable === true) ? 'full' : 'unpaid'),
    holidayPayable: (raw.holidayPayable as boolean | undefined) ?? true,
  };
}

// ─── localStorage helpers (guest mode only) ────────────────────────────────────

function loadUsers(): UserProfile[] {
  try { return JSON.parse(localStorage.getItem('kc_users') ?? '[]'); }
  catch { return []; }
}

function saveUsers(users: UserProfile[]) {
  localStorage.setItem('kc_users', JSON.stringify(users));
}

function loadUserData(userId: string) {
  try {
    const s = localStorage.getItem(`kc_data_${userId}`);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function saveUserData(userId: string, data: object) {
  localStorage.setItem(`kc_data_${userId}`, JSON.stringify(data));
}

const todayStr = (() => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
})();

// ─── Auth stage ────────────────────────────────────────────────────────────────
//
//  splash  ──(onAuthStateChanged fires)──► login  (no session)
//                                      ──► authed (active session)
//  login   ──(signInWithPopup OK → onAuthStateChanged)──► authed
//  authed  ──(profile selected)──► main app
//  main app ──(switch profile)──► authed
//  main app ──(logout → signOut → onAuthStateChanged)──► login

type AuthStage = 'splash' | 'login' | 'session-check' | 'authed';

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const isMobile = useIsMobile();

  // ── Auth state ───────────────────────────────────────────────────────────────
  const [authStage, setAuthStage] = useState<AuthStage>('splash');
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);

  // ── Cloud sync refs ───────────────────────────────────────────────────────────
  //
  // initialSyncCompleteRef — stays false until Firestore data has been fully
  //   loaded and restored into React state. The auto-save effect checks this
  //   before every write, which prevents any default or stale state from being
  //   written to Firestore during login or page refresh.
  const initialSyncCompleteRef = useRef(false);

  // lastCloudSnapshotRef — the most recent Firestore document received either
  //   from the initial load or from the real-time listener. The auto-save
  //   compares the outgoing payload against this to avoid pointless writes and
  //   break the snapshot → save → snapshot loop.
  const lastCloudSnapshotRef = useRef<Record<string, unknown> | null>(null);

  // isRefreshingRef — true while handleCloudRefresh is running. The auto-save
  //   effect skips during this window so the manually loaded state is not
  //   immediately overwritten.
  const isRefreshingRef = useRef(false);

  // skipSaveRef — true for the render that follows a Firestore snapshot update,
  //   preventing the auto-save from writing the snapshot data back to Firestore.
  const skipSaveRef = useRef(false);

  // Debounce timer for Firestore writes — avoids hammering on rapid changes.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Holds latest per-profile data keyed by profileId (avoids stale closures).
  const cloudProfileDataRef = useRef<Record<string, Record<string, unknown>>>({});

  // ── Profile / user data ──────────────────────────────────────────────────────
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Start empty — populated from Firestore (cloud) or localStorage (guest).
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Non-stale refs used inside async callbacks / subscriptions.
  const usersRef = useRef<UserProfile[]>([]);
  const currentUserRef = useRef<UserProfile | null>(null);
  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [employeeNotes, setEmployeeNotes] = useState<EmployeeNote[]>([]);

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function restoreProfileData(data: Record<string, unknown> | null) {
    setEmployees(data?.employees ? migrateEmployees(data.employees as Employee[]) : defaultEmployees);
    setAttendance((data?.attendance as Record<string, AttendanceRecord>) ?? {});
    setHolidays((data?.holidays as Holiday[]) ?? defaultHolidays);
    setSettings(data?.settings ? migrateSettings(data.settings as Record<string, unknown>) : defaultSettings);
    setEmployeeNotes((data?.employeeNotes as EmployeeNote[]) ?? []);
  }

  // ── Firebase auth listener ────────────────────────────────────────────────────
  //
  // Login order: Firebase Auth → Load Firestore → Restore state →
  //              Start listener → Enable auto-save.
  //
  // Auto-save is gated by initialSyncCompleteRef so it cannot fire until the
  // Firestore load resolves. This prevents any device from overwriting cloud
  // data with stale defaults on login or page refresh.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        const uid = firebaseUser.uid;

        // Block all writes until load completes.
        initialSyncCompleteRef.current = false;

        setFirebaseUid(uid);
        setGoogleUser({
          displayName: firebaseUser.displayName,
          email:       firebaseUser.email,
          photoURL:    firebaseUser.photoURL,
        });
        setSyncStatus('syncing');

        // ── 1. Load Firestore (source of truth) ─────────────────────────────
        const cloudData = await loadCloudData(uid);

        if (cloudData) {
          // Firestore document exists — restore from cloud.
          cloudProfileDataRef.current = (cloudData.profileData as Record<string, Record<string, unknown>>) ?? {};
          lastCloudSnapshotRef.current = cloudData as Record<string, unknown>;
          setUsers((cloudData.profiles as UserProfile[]) ?? []);
        } else {
          // ── 2. One-time migration ────────────────────────────────────────
          // No Firestore document yet. Upload any existing localStorage data
          // exactly once. Never overwrites an existing Firestore document.
          const localUsers = loadUsers();
          const profileData: Record<string, Record<string, unknown>> = {};
          for (const u of localUsers) {
            const d = loadUserData(u.id);
            if (d) profileData[u.id] = d;
          }
          const migrationPayload = { profiles: localUsers, profileData };
          cloudProfileDataRef.current = profileData;
          lastCloudSnapshotRef.current = migrationPayload as Record<string, unknown>;
          setUsers(localUsers);
          // Fire-and-forget — this only runs when no cloud doc exists.
          saveCloudData(uid, migrationPayload).catch(console.error);
        }

        // ── 3. State restored; now allow writes. ─────────────────────────────
        initialSyncCompleteRef.current = true;
        setSyncStatus('synced');
        setAuthStage('authed');
      } else {
        // Signed out — reset everything and fall back to guest/localStorage.
        initialSyncCompleteRef.current = false;
        lastCloudSnapshotRef.current = null;
        cloudProfileDataRef.current = {};
        setFirebaseUid(null);
        setCurrentUser(null);
        setGoogleUser(null);
        setSyncStatus('offline');
        setUsers(loadUsers());
        setAuthStage('login');
      }
    });
    return unsubscribe;
  }, []);

  // ── Real-time Firestore subscription ─────────────────────────────────────────
  // Subscribes while a Google user is active. When another device writes to
  // Firestore the snapshot updates local React state. The skipSaveRef flag
  // prevents the auto-save from immediately writing the snapshot data back.
  useEffect(() => {
    if (!firebaseUid) return;

    const unsubscribe = subscribeToCloudData(firebaseUid, (data) => {
      // Record the snapshot so auto-save can compare before writing.
      lastCloudSnapshotRef.current = data as Record<string, unknown>;

      // Mark this render as remote — auto-save will skip it.
      skipSaveRef.current = true;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      const profiles = (data.profiles as UserProfile[]) ?? [];
      cloudProfileDataRef.current = (data.profileData as Record<string, Record<string, unknown>>) ?? {};
      setUsers(profiles);

      // If a profile is currently active, refresh its data from the snapshot.
      const cur = currentUserRef.current;
      if (cur) {
        const pd = cloudProfileDataRef.current[cur.id] ?? null;
        restoreProfileData(pd);
      }
    });

    return unsubscribe;
  }, [firebaseUid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save: cloud or localStorage ─────────────────────────────────────────
  //
  // Guards (checked in order):
  //  1. initialSyncCompleteRef — never write before Firestore has been read.
  //  2. isRefreshingRef        — never write during a manual cloud refresh.
  //  3. skipSaveRef            — skip the render that came from a Firestore snapshot.
  //  4. Payload equality check — don't write if data matches lastCloudSnapshotRef.
  useEffect(() => {
    console.log("[AUTOSAVE TRIGGERED]");
    console.log("[SYNC FLAG]", initialSyncCompleteRef.current);

    if (!currentUser) { console.log("[AUTOSAVE SKIP] no currentUser"); return; }

    // Guard 1 — Firestore load has not completed yet.
    if (!initialSyncCompleteRef.current) { console.log("[AUTOSAVE SKIP] initialSyncComplete=false"); return; }

    // Guard 2 — Manual refresh in progress.
    if (isRefreshingRef.current) { console.log("[AUTOSAVE SKIP] isRefreshing=true"); return; }

    // Guard 3 — This state change was triggered by a remote Firestore snapshot.
    if (skipSaveRef.current) {
      console.log("[AUTOSAVE SKIP] skipSave=true (remote snapshot)");
      skipSaveRef.current = false;
      return;
    }

    // Sanitise every optional field that could carry `undefined` values.
    // Firestore rejects documents with undefined — removeUndefined() in
    // firestore.ts is the final safety net, but clean at the source too.
    const safeEmployees = employees.map(e => ({
      ...e,
      profilePhoto:            e.profilePhoto            ?? null,
      mobile:                  e.mobile                  ?? null,
      alternateMobile:         e.alternateMobile         ?? null,
      email:                   e.email                   ?? null,
      dateOfBirth:             e.dateOfBirth             ?? null,
      gender:                  e.gender                  ?? null,
      emergencyContactName:    e.emergencyContactName    ?? null,
      emergencyContactNumber:  e.emergencyContactNumber  ?? null,
      currentAddress:          e.currentAddress          ?? null,
      city:                    e.city                    ?? null,
      state:                   e.state                   ?? null,
      postalCode:              e.postalCode              ?? null,
      country:                 e.country                 ?? null,
      designation:             e.designation             ?? null,
      employeeCode:            e.employeeCode            ?? null,
      employmentType:          e.employmentType          ?? null,
      documents:               (e.documents ?? []).map(d => ({
        ...d,
        fileData: d.fileData ?? '',
        fileType: d.fileType ?? '',
      })),
    }));

    const profilePayload = {
      employees:     safeEmployees,
      attendance:    attendance    ?? {},
      holidays:      holidays      ?? [],
      settings:      settings      ?? defaultSettings,
      employeeNotes: (employeeNotes ?? []).map(n => ({
        ...n,
        content:   n.content   ?? '',
        author:    n.author    ?? '',
        timestamp: n.timestamp ?? '',
      })),
    };

    if (firebaseUid) {
      const newProfileData = {
        ...cloudProfileDataRef.current,
        [currentUser.id]: profilePayload,
      };
      const savePayload = {
        profiles: usersRef.current,
        profileData: newProfileData,
      };

      console.log("[AUTOSAVE STATE]", { users: usersRef.current, profileData: newProfileData });

      // Guard 4 — Skip write if the data is identical to what Firestore already has.
      if (JSON.stringify(savePayload) === JSON.stringify(lastCloudSnapshotRef.current)) {
        console.log("[AUTOSAVE SKIP] payload identical to lastCloudSnapshot");
        return;
      }

      cloudProfileDataRef.current = newProfileData;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveCloudData(firebaseUid, savePayload).catch(console.error);
      }, 1500);
    } else {
      console.log("[AUTOSAVE] guest mode — writing localStorage");
      // Guest mode — localStorage only.
      saveUserData(currentUser.id, profilePayload);
    }
  }, [employees, attendance, holidays, settings, employeeNotes, currentUser, firebaseUid]);

  // ── Auth handlers ─────────────────────────────────────────────────────────────

  // "Guest" — skip Firebase auth, go straight to profile selection.
  // No async cloud load; allow writes immediately.
  const handleGuestLogin = () => {
    setGoogleUser(null);
    setSyncStatus('offline');
    initialSyncCompleteRef.current = true;
    setAuthStage('authed');
  };

  // "Switch Profile" — stays authenticated, returns to profile selection.
  const handleSwitchUser = () => {
    setCurrentUser(null);
  };

  // "Logout" — Firebase signOut → onAuthStateChanged fires → authStage → 'login'.
  const handleSignOut = async () => {
    setCurrentUser(null);
    try {
      await signOut(auth);
    } catch {
      // onAuthStateChanged will still fire and clean up state.
    }
  };

  // ── Cloud refresh (read-only fallback) ────────────────────────────────────────
  // Manually loads the latest Firestore document and updates local state.
  // Never writes to Firestore. Pauses auto-save during the operation.
  const handleCloudRefresh = async () => {
    if (!firebaseUid || isRefreshingRef.current) return;

    try {
      isRefreshingRef.current = true;
      setSyncStatus('refreshing');

      // Cancel any pending debounced save so we don't overwrite after loading.
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      const cloudData = await loadCloudData(firebaseUid);
      if (!cloudData) {
        setSyncStatus('synced');
        return;
      }

      const profiles = (cloudData.profiles as UserProfile[]) ?? [];
      const profileData = (cloudData.profileData as Record<string, Record<string, unknown>>) ?? {};

      lastCloudSnapshotRef.current = cloudData as Record<string, unknown>;
      cloudProfileDataRef.current = profileData;

      // Mark next renders as coming from a remote load so auto-save skips them.
      skipSaveRef.current = true;
      setUsers(profiles);

      const cur = currentUserRef.current;
      if (cur) {
        const pd = profileData[cur.id] ?? null;
        restoreProfileData(pd);
      }

      setSyncStatus('synced');
      toast.success('Cloud data refreshed');
    } catch {
      toast.error('Failed to refresh cloud data');
      setSyncStatus('error');
    } finally {
      isRefreshingRef.current = false;
    }
  };

  // ── Profile handlers ──────────────────────────────────────────────────────────

  const handleSelectUser = (user: UserProfile) => {
    // Cloud users load from the in-memory ref; guest users load from localStorage.
    const data: Record<string, unknown> | null = firebaseUid
      ? (cloudProfileDataRef.current[user.id] ?? null)
      : loadUserData(user.id);

    restoreProfileData(data);
    setCurrentScreen('dashboard');

    const updated: UserProfile = { ...user, lastActive: new Date().toISOString() };
    setUsers(prev => {
      const next = prev.map(u => u.id === user.id ? updated : u);
      // Guest mode: persist immediately via localStorage.
      // Cloud mode: the auto-save effect handles it when currentUser changes.
      if (!firebaseUid) saveUsers(next);
      return next;
    });
    setCurrentUser(updated);
    // Cloud: auto-save will fire on the currentUser change above and write
    // usersRef.current (with the updated lastActive) + profile data to Firestore.
  };

  const handleCreateUser = (name: string): UserProfile => {
    const newUser: UserProfile = {
      id: `u_${Date.now()}`,
      name,
      ownerEmail: googleUser?.email ?? undefined,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    };
    const next = [...users, newUser];
    setUsers(next);
    // Guest mode: persist immediately.
    // Cloud mode: the subsequent handleSelectUser call will trigger auto-save,
    // which writes usersRef.current (now including newUser) to Firestore.
    if (!firebaseUid) saveUsers(next);
    return newUser;
  };

  // ── Attendance helpers ────────────────────────────────────────────────────────

  const updateAttendance = (employeeId: string, date: string, record: AttendanceRecord) => {
    setAttendance(prev => ({ ...prev, [`${employeeId}_${date}`]: record }));
  };

  const getAttendance = (employeeId: string, date: string): AttendanceRecord =>
    attendance[`${employeeId}_${date}`] ?? { mainStatus: null, subStatus: null };

  // ── Employee profile navigation ───────────────────────────────────────────────

  const navigateToEmployeeProfile = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setCurrentScreen('employee-profile');
  };

  const navigateBackToEmployees = () => {
    setSelectedEmployeeId(null);
    setCurrentScreen('employees');
  };

  // ── Auth gate renders ─────────────────────────────────────────────────────────

  if (authStage === 'splash') {
    return <ThemeProvider><SplashScreen /></ThemeProvider>;
  }

  if (authStage === 'login') {
    return (
      <ThemeProvider>
        <Toaster position="top-center" richColors />
        <LoginScreen onGuestLogin={handleGuestLogin} />
      </ThemeProvider>
    );
  }

  if (authStage === 'session-check') {
    return <ThemeProvider><SessionCheckScreen /></ThemeProvider>;
  }

  // authStage === 'authed' from here on

  if (!currentUser) {
    return (
      <ThemeProvider>
        <Toaster position="top-center" richColors />
        <UserSelectScreen
          users={users}
          onSelect={handleSelectUser}
          onCreateUser={handleCreateUser}
          googleUser={googleUser}
          onSignOut={handleSignOut}
        />
      </ThemeProvider>
    );
  }

  // ── Main app ──────────────────────────────────────────────────────────────────

  return (
    <ThemeProvider>
      <div style={{
        display: 'flex',
        height: '100dvh',
        overflow: 'hidden',
        background: 'var(--app-bg)',
        flexDirection: isMobile ? 'column' : 'row',
      }}>
        <Toaster position={isMobile ? 'top-center' : 'bottom-right'} richColors />

        {!isMobile && (
          <Sidebar
            currentScreen={currentScreen}
            onNavigate={setCurrentScreen}
            companyName={settings.companyName}
            currentUser={currentUser}
            onSwitchUser={handleSwitchUser}
            onSignOut={handleSignOut}
            googleUser={googleUser}
            syncStatus={syncStatus}
            onCloudRefresh={firebaseUid ? handleCloudRefresh : undefined}
          />
        )}

        <main style={{ flex: 1, overflowY: 'auto', minWidth: 0, paddingBottom: isMobile ? 72 : 0 }}>
          {currentScreen === 'dashboard' && (
            <DashboardScreen
              employees={employees}
              holidays={holidays}
              settings={settings}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              getAttendance={getAttendance}
              updateAttendance={updateAttendance}
              onUpdateHolidays={setHolidays}
              onNavigateToProfile={navigateToEmployeeProfile}
            />
          )}
          {currentScreen === 'payroll' && (
            <PayrollScreen
              employees={employees}
              attendance={attendance}
              holidays={holidays}
              settings={settings}
            />
          )}
          {currentScreen === 'employees' && (
            <EmployeeScreen
              employees={employees}
              onUpdateEmployees={(next) => {
                console.log("[EMPLOYEE ADDED/UPDATED]", next);
                setEmployees(next);
              }}
              onNavigateToProfile={navigateToEmployeeProfile}
            />
          )}
          {currentScreen === 'employee-profile' && selectedEmployeeId && (
            <EmployeeProfileScreen
              employee={employees.find(e => e.id === selectedEmployeeId)!}
              employees={employees}
              onUpdateEmployees={setEmployees}
              attendance={attendance}
              holidays={holidays}
              settings={settings}
              employeeNotes={employeeNotes}
              onUpdateNotes={setEmployeeNotes}
              onNavigateBack={navigateBackToEmployees}
              currentUser={currentUser}
            />
          )}
          {currentScreen === 'holidays' && (
            <HolidayScreen
              holidays={holidays}
              onUpdateHolidays={setHolidays}
            />
          )}
          {currentScreen === 'settings' && (
            <SettingsScreen
              settings={settings}
              onUpdateSettings={setSettings}
              currentUser={currentUser}
              onSwitchUser={handleSwitchUser}
            />
          )}
        </main>

        {isMobile && (
          <BottomNav current={currentScreen} onNavigate={setCurrentScreen} />
        )}
      </div>
    </ThemeProvider>
  );
}
