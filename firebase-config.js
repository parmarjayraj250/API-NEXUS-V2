// ==========================================================================
// FIREBASE v10 AUTHENTICATION & FIRESTORE CONFIGURATION
// Configured with exact Firebase Console credentials for API-Finder (api-finder-5173b)
// ==========================================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  GithubAuthProvider, 
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

// --- Exact Firebase Configuration from Firebase Console ---
const defaultFirebaseConfig = {
  apiKey: "AIzaSyDYR1-0A0xLoxvRRyy-_l-UMbZ5Hr95qzE",
  authDomain: "api-finder-5173b.firebaseapp.com",
  projectId: "api-finder-5173b",
  storageBucket: "api-finder-5173b.firebasestorage.app",
  messagingSenderId: "17282514910",
  appId: "1:17282514910:web:1e1ddeb6125db58a45e74f",
  measurementId: "G-VNNDF88WSH"
};

// Use window.firebaseConfig if defined in window, otherwise defaultFirebaseConfig
const activeConfig = (window.firebaseConfig && window.firebaseConfig.apiKey) ? window.firebaseConfig : defaultFirebaseConfig;

// Initialize Firebase App
const app = !getApps().length ? initializeApp(activeConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Provider Instances
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const githubProvider = new GithubAuthProvider();

// Export Services globally for debugging & app integration
window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDb = db;

/**
 * Executes official Firebase Google Authentication Popup using signInWithPopup(auth, new GoogleAuthProvider())
 */
export async function signInWithGoogleFirebase() {
  return handleSocialLogin(googleProvider, "google.com");
}

/**
 * Executes official Firebase GitHub Authentication Popup using signInWithPopup(auth, new GithubAuthProvider())
 */
export async function signInWithGithubFirebase() {
  return handleSocialLogin(githubProvider, "github.com");
}

/**
 * Common Firebase OAuth Popup Handler for Google & GitHub
 */
async function handleSocialLogin(providerInstance, providerName) {
  try {
    console.log(`[Firebase Auth] Initiating signInWithPopup for ${providerName}...`);
    
    // Official Firebase OAuth Popup
    const result = await signInWithPopup(auth, providerInstance);
    const user = result.user;

    console.log(`✅ [Firebase Auth Success] User authenticated via ${providerName}:`, {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL
    });

    // Reference Firestore user document: users/{user.uid}
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // Create new user document in Firestore with required attributes
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName || user.email || "Developer User",
        email: user.email || "",
        photoURL: user.photoURL || "",
        provider: providerName,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });
      console.log(`📝 [Firestore Document Created] Document users/${user.uid} created.`);
    } else {
      // Update lastLogin timestamp for existing user
      await updateDoc(userRef, {
        lastLogin: serverTimestamp()
      });
      console.log(`⏱️ [Firestore Document Updated] users/${user.uid} lastLogin timestamp updated.`);
    }

    const userData = {
      uid: user.uid,
      name: user.displayName || user.email || "Developer User",
      email: user.email || "",
      photoURL: user.photoURL || "",
      provider: providerName === "google.com" ? "Google" : "GitHub"
    };

    localStorage.setItem('api_nexus_authenticated_user', JSON.stringify(userData));
    if (window.updateAuthUI) window.updateAuthUI();
    if (window.closeAuthModal) window.closeAuthModal();

    if (window.showToast) {
      window.showToast(`Welcome ${user.displayName || user.email}! Authenticated via ${providerName === "google.com" ? "Google" : "GitHub"}.`);
    }

    return user;
  } catch (error) {
    // Print complete Firebase error code and message to browser console for debugging
    console.error("❌ [Firebase Auth Error Details]:", {
      code: error.code,
      message: error.message,
      email: error.customData?.email,
      credential: error.credential
    });

    if (error.code === 'auth/popup-closed-by-user') {
      if (window.showToast) window.showToast("Sign-In popup was closed before completion.");
    } else if (error.code === 'auth/account-exists-with-different-credential') {
      if (window.showToast) window.showToast("Account exists with a different credential. Please sign in using your existing provider.");
    } else if (error.code === 'auth/operation-not-allowed') {
      if (window.showToast) window.showToast(`Firebase Notice: Enable ${providerName} in Firebase Console -> Authentication -> Sign-in method.`);
    } else {
      if (window.showToast) window.showToast(`Firebase Auth Error: [${error.code}] ${error.message}`);
    }
    throw error;
  }
}

// --- Handle Sign Out ---
export async function firebaseSignOutUser() {
  try {
    await signOut(auth);
    localStorage.removeItem('api_nexus_authenticated_user');
    if (window.onFirebaseUserSignOut) {
      window.onFirebaseUserSignOut();
    }
    if (window.updateAuthUI) window.updateAuthUI();
  } catch (err) {
    console.error("Error signing out from Firebase:", err);
  }
}

// --- Persistent Auth Observer ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("Firebase Auth Observer: User Signed In ->", user.email, "UID:", user.uid);
    const userData = {
      uid: user.uid,
      name: user.displayName || user.email || "Developer User",
      email: user.email || "",
      photoURL: user.photoURL || "",
      provider: "Firebase User"
    };

    localStorage.setItem('api_nexus_authenticated_user', JSON.stringify(userData));
    if (window.updateAuthUI) window.updateAuthUI();
    if (window.closeAuthModal) window.closeAuthModal();
  } else {
    console.log("Firebase Auth Observer: User Signed Out");
    localStorage.removeItem('api_nexus_authenticated_user');
    if (window.updateAuthUI) window.updateAuthUI();
  }
});

// Dynamic Config Setter
window.setFirebaseConfig = function(customConfig) {
  window.firebaseConfig = customConfig;
  console.log("Updated window.firebaseConfig:", customConfig);
};

// Attach global functions to window
window.signInWithGoogleFirebase = signInWithGoogleFirebase;
window.signInWithGithubFirebase = signInWithGithubFirebase;
window.firebaseSignOutUser = firebaseSignOutUser;
