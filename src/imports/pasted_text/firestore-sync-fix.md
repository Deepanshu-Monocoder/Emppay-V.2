Project: emp pay pakka

Task: Fix Firestore synchronization completely and add a manual Cloud Refresh button as a fallback.

Current issue:

The app syncs partially, but there is a race condition and overwrite bug.

Example:

* Laptop A adds Employee David.
* Firestore updates.
* Laptop B refreshes or signs in.
* Laptop B loads stale state and writes it back.
* David disappears from Firestore and from Laptop A.

Goal:

1. Firestore is the single source of truth.
2. Auto-sync remains primary.
3. Refresh button acts as backup only.
4. No device should be able to overwrite newer cloud data with stale local state.

==================================================
PART 1 — FIX OVERWRITE BUG
==========================

In src/app/App.tsx

Find all saveCloudData() calls.

Current code contains writes similar to:

saveCloudData(firebaseUid, {
profiles: usersRef.current,
profileData: cloudProfileDataRef.current,
});

Remove ALL direct saveCloudData() calls from:

* handleCreateUser()
* handleSelectUser()
* login handlers
* profile selection handlers

Only the centralized autosave system should write to Firestore.

==================================================
PART 2 — BLOCK SAVES DURING INITIAL LOAD
========================================

Add:

const initialSyncCompleteRef = useRef(false);

When user logs in:

1. Load Firestore.
2. Restore React state.
3. Start Firestore subscription.
4. Then:

initialSyncCompleteRef.current = true;

==================================================
PART 3 — PROTECT AUTOSAVE
=========================

In every autosave useEffect:

Before:

saveCloudData(...)

Add:

if (!initialSyncCompleteRef.current) {
return;
}

This prevents:

Login
↓
Default state
↓
Autosave
↓
Firestore overwritten

==================================================
PART 4 — LAST SNAPSHOT PROTECTION
=================================

Add:

const lastCloudSnapshotRef = useRef(null);

Whenever Firestore snapshot arrives:

lastCloudSnapshotRef.current = snapshotData;

Before saveCloudData():

Compare:

JSON.stringify(payload)

with

JSON.stringify(lastCloudSnapshotRef.current)

If identical:

return;

Do not write.

Example:

if (
JSON.stringify(payload) ===
JSON.stringify(lastCloudSnapshotRef.current)
) {
return;
}

This prevents save loops.

==================================================
PART 5 — FIRESTORE LISTENER
===========================

Keep:

subscribeToCloudData(firebaseUid)

When snapshot arrives:

Update React state:

setUsers(...)
setProfileData(...)

Update:

lastCloudSnapshotRef.current = snapshotData;

Do NOT immediately write snapshot data back to Firestore.

==================================================
PART 6 — FIRESTORE FIRST
========================

Login order must be:

Firebase Auth
↓
Load Firestore
↓
Restore state
↓
Start listener
↓
Enable autosave

Never:

Firebase Auth
↓
Autosave
↓
Load Firestore

==================================================
PART 7 — ADD CLOUD REFRESH BUTTON
=================================

Add a refresh icon button beside the sync indicator at the top of the app.

Tooltip:

Refresh Cloud Data

==================================================
PART 8 — REFRESH FUNCTION
=========================

Create:

const isRefreshingRef = useRef(false);

Create:

const handleCloudRefresh = async () => {
if (!firebaseUid) return;

try {
isRefreshingRef.current = true;

```
setSyncStatus("refreshing");

const cloudData =
  await loadCloudData(firebaseUid);

if (!cloudData) {
  setSyncStatus("online");
  return;
}

setUsers(
  cloudData.profiles || []
);

setProfileData(
  cloudData.profileData || {}
);

setSyncStatus("online");

toast.success(
  "Cloud data refreshed"
);
```

} catch (err) {

```
toast.error(
  "Failed to refresh cloud data"
);

setSyncStatus("error");
```

} finally {

```
isRefreshingRef.current = false;
```

}
};

==================================================
PART 9 — REFRESH MUST BE READ ONLY
==================================

Refresh button must:

✔ Read Firestore

✔ Update local state

✔ Show latest cloud data

Refresh button must NEVER:

✖ saveCloudData()

✖ updateDoc()

✖ setDoc()

✖ run migration

✖ write to Firestore

==================================================
PART 10 — PAUSE AUTOSAVE DURING REFRESH
=======================================

In autosave useEffect:

Add:

if (isRefreshingRef.current) {
return;
}

This prevents:

Refresh
↓
State updated
↓
Autosave
↓
Cloud overwrite

==================================================
PART 11 — SYNC STATUS
=====================

Show statuses:

syncing
synced
refreshing
offline
error

Examples:

🟡 Syncing...
🟢 Synced
🔄 Refreshing...
🔴 Offline
⚠ Sync Error

==================================================
PART 12 — EXPECTED RESULT
=========================

Laptop A:

Add Employee David
↓
Firestore updates

Laptop B:

Automatically receives David
via Firestore listener

If Laptop B does not update:

User clicks Refresh Cloud
↓
Latest Firestore data loaded
↓
David appears

No data loss.

No overwrite.

No disappearing employees.

Firestore remains the source of truth.

Auto-sync remains primary.

Refresh button is only a fallback tool.
