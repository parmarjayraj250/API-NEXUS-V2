// Firebase v10 Integration for API Nexus / API Finder
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase Configuration
const defaultFirebaseConfig = {
  apiKey: "AIzaSyDemoKey_ReplaceWithYourFirebaseKey",
  authDomain: "api-finder-app.firebaseapp.com",
  projectId: "api-finder-app",
  storageBucket: "api-finder-app.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:demo1234567890"
};

const firebaseConfig = window.firebaseConfig || defaultFirebaseConfig;

// Initialize Firebase App & Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Window Exports for Application Engine
window.firebaseAuth = auth;
window.firebaseDb = db;

/**
 * Executes official Firebase Google Authentication Popup using signInWithPopup(auth, new GoogleAuthProvider())
 * Creates or updates Firestore document at users/{uid} upon successful login.
 */
export async function signInWithGoogleFirebase() {
  try {
    // Official Firebase Google Popup Sign-In
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    console.log("Firebase Google Authentication Successful for user:", user.email, "UID:", user.uid);

    // Reference Firestore user document: users/{user.uid}
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // Create new user document in Firestore
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName || "Developer User",
        email: user.email || "",
        photoURL: user.photoURL || "",
        provider: "google.com",
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });
      console.log("Firestore: Created new user document for UID:", user.uid);
    } else {
      // Update lastLogin timestamp for existing user
      await updateDoc(userRef, {
        lastLogin: serverTimestamp()
      });
      console.log("Firestore: Updated lastLogin timestamp for UID:", user.uid);
    }

    if (window.showToast) {
      window.showToast(`Welcome ${user.displayName || user.email}! Firebase Google Sign-In Successful.`);
    }

    return user;
  } catch (error) {
    console.error("Firebase Auth Error:", error.code, error.message);
    if (error.code === 'auth/popup-closed-by-user') {
      if (window.showToast) window.showToast("Sign in popup was closed before completing login.");
    } else if (error.code === 'auth/cancelled-popup-request') {
      console.warn("Popup request cancelled.");
    } else {
      if (window.showToast) window.showToast(`Firebase Auth Error: ${error.message}`);
    }
    throw error;
  }
}

// --- Handle Sign Out ---
export async function firebaseSignOutUser() {
  try {
    await signOut(auth);
    if (window.onFirebaseUserSignOut) {
      window.onFirebaseUserSignOut();
    }
  } catch (err) {
    console.error("Error signing out from Firebase:", err);
  }
}

// --- Persistent Auth Observer ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("Firebase Auth State Changed: User Signed In ->", user.email);
    const userData = {
      uid: user.uid,
      name: user.displayName || user.email || "Developer User",
      email: user.email || "",
      photoURL: user.photoURL || "",
      provider: "Google"
    };

    localStorage.setItem('api_nexus_authenticated_user', JSON.stringify(userData));
    if (window.updateAuthUI) window.updateAuthUI();
    if (window.closeAuthModal) window.closeAuthModal();
  } else {
    console.log("Firebase Auth State Changed: User Signed Out");
  }
});

// Attach global functions to window
window.signInWithGoogleFirebase = signInWithGoogleFirebase;
window.firebaseSignOutUser = firebaseSignOutUser;
