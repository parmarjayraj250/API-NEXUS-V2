// ==========================================================================
// FIREBASE v10 AUTHENTICATION & FIRESTORE CONFIGURATION
// Paste your exact config from Firebase Console -> Project Settings -> General
// ==========================================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
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

// --- STEP 1: Paste Your Firebase Project Keys Here ---
const defaultFirebaseConfig = {
  apiKey: "AIzaSyDemoKey_ReplaceWithYourFirebaseKey",
  authDomain: "api-finder-app.firebaseapp.com",
  projectId: "api-finder-app",
  storageBucket: "api-finder-app.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:demo1234567890"
};

// Use window.firebaseConfig if defined in window, otherwise defaultFirebaseConfig
const activeConfig = (window.firebaseConfig && window.firebaseConfig.apiKey) ? window.firebaseConfig : defaultFirebaseConfig;

// Initialize Firebase App
const app = !getApps().length ? initializeApp(activeConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Export Services globally for debugging & app integration
window.firebaseApp = app;
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

    console.log("✅ Firebase Google Auth Success:", user.email, "UID:", user.uid);

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
      console.log("📝 Firestore: Created new user document at users/" + user.uid);
    } else {
      // Update lastLogin timestamp for existing user
      await updateDoc(userRef, {
        lastLogin: serverTimestamp()
      });
      console.log("⏱️ Firestore: Updated lastLogin timestamp at users/" + user.uid);
    }

    if (window.showToast) {
      window.showToast(`Welcome ${user.displayName || user.email}! Signed in via Firebase.`);
    }

    return user;
  } catch (error) {
    console.error("❌ Firebase Auth Error:", error.code, error.message);
    
    if (error.code === 'auth/api-key-not-valid' || error.message.includes('API key')) {
      const msg = "Firebase Notice: Replace placeholder apiKey in firebase-config.js with your key from Firebase Console.";
      console.warn(msg);
      if (window.showToast) window.showToast(msg);
      if (window.fallbackSocialLogin) window.fallbackSocialLogin('Google');
    } else if (error.code === 'auth/popup-closed-by-user') {
      if (window.showToast) window.showToast("Google Sign-In popup closed.");
    } else {
      if (window.showToast) window.showToast(`Firebase Auth: ${error.message}`);
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
    console.log("Firebase Auth Observer: Signed In ->", user.email);
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
    console.log("Firebase Auth Observer: Guest mode");
  }
});

// Dynamic Config Setter
window.setFirebaseConfig = function(customConfig) {
  window.firebaseConfig = customConfig;
  console.log("Updated window.firebaseConfig:", customConfig);
};

// Attach global functions to window
window.signInWithGoogleFirebase = signInWithGoogleFirebase;
window.firebaseSignOutUser = firebaseSignOutUser;
