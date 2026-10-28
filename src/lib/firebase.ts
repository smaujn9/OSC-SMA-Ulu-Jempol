import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  setPersistence, 
  browserLocalPersistence, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInAnonymously, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Explicitly set browserLocalPersistence to prevent session loss in sandboxed iframes and desktop browsers
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn("Ralat menetapkan Firebase Auth browserLocalPersistence:", err);
  });
}

// Use initializeFirestore with experimentalForceLongPolling: true to ensure connection stability inside sandboxed iframes
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId);

const storage = getStorage(app);

// Basic Google login provider - NO sensitive scopes, allowing all users to sign in without 403 access_denied verification block
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Separate Google Drive provider for committee members / admins to link Google Drive / Google Sheets
const googleDriveProvider = new GoogleAuthProvider();
googleDriveProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleDriveProvider.addScope('https://www.googleapis.com/auth/drive');
googleDriveProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleDriveProvider.setCustomParameters({
  prompt: 'consent select_account'
});

export { app, auth, db, googleProvider, googleDriveProvider, signInWithPopup, signInAnonymously, signOut, onAuthStateChanged, storage };
export type { FirebaseUser };
