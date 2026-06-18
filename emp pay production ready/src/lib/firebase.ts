import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyDKEgDFxP7OZcCG59qU5biCPZCA_Gk2cHo",
  authDomain:        "emppay-59ff2.firebaseapp.com",
  projectId:         "emppay-59ff2",
  storageBucket:     "emppay-59ff2.firebasestorage.app",
  messagingSenderId: "939219672633",
  appId:             "1:939219672633:web:cb4be32edeb78defabf7e8",
};

// Initialise once — safe across hot-reload and React StrictMode
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

export const auth           = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db             = getFirestore(app);

// Re-export helpers so callers never import firebase/auth directly
export { signInWithPopup, signOut, onAuthStateChanged, type User };
