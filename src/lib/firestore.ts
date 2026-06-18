import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

// Firestore rejects documents containing `undefined` values. Strip them out
// recursively before every write so a single undefined field never blocks a save.
function removeUndefined(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(removeUndefined);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, removeUndefined(value)])
    );
  }
  return obj;
}

export async function saveCloudData(uid: string, data: object) {
  console.log("[SAVE CALLED]", uid, data);
  console.log("[RAW PAYLOAD]", data);
  const cleanData = removeUndefined(data) as object;
  console.log("[CLEAN PAYLOAD]", cleanData);
  try {
    await setDoc(doc(db, "users", uid), cleanData);
    console.log("[SAVE SUCCESS]");
  } catch (err) {
    console.error("[SAVE FAILED]", err);
    throw err;
  }
}

export async function loadCloudData(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export function subscribeToCloudData(
  uid: string,
  callback: (data: Record<string, any>) => void
) {
  return onSnapshot(doc(db, "users", uid), (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as Record<string, any>);
    }
  });
}
