// ==========================================================================
// FIREBASE v10 AUTHENTICATION & FIRESTORE CONFIGURATION
// Configured with exact Firebase Console credentials for API-Finder (api-finder-5173b)
// Support both Popup & Redirect flows for 100% Mobile Browser Compatibility
// ==========================================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  GithubAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
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

// Detect Mobile Device
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

/**
 * Handle OAuth Redirect Result on Mobile Devices on page load
 */
(async function handleMobileRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      console.log("✅ [Firebase Mobile Redirect Auth Success]:", result.user.email);
      await processUserDocument(result.user, result.providerId || "google.com");
    }
  } catch (error) {
    console.error("❌ [Firebase Mobile Redirect Error]:", error);
  }
})();

/**
 * Helper to sync user state with Firestore & localStorage
 */
async function processUserDocument(user, providerName) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      displayName: user.displayName || user.email || "Developer User",
      email: user.email || "",
      photoURL: user.photoURL || "",
      provider: providerName,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });
    console.log(`📝 [Firestore Document Created] users/${user.uid}`);
  } else {
    await updateDoc(userRef, {
      lastLogin: serverTimestamp()
    });
    console.log(`⏱️ [Firestore Document Updated] users/${user.uid}`);
  }

  let finalProvider = "Google";
  if (providerName.includes("github")) finalProvider = "GitHub";

  const userData = {
    uid: user.uid,
    name: user.displayName || user.email || "Developer User",
    email: user.email || "",
    photoURL: user.photoURL || "",
    provider: finalProvider
  };

  localStorage.setItem('api_nexus_authenticated_user', JSON.stringify(userData));
  if (window.updateAuthUI) window.updateAuthUI();
  if (window.closeAuthModal) window.closeAuthModal();

  if (window.showToast) {
    window.showToast(`Welcome ${user.displayName || user.email}! Authenticated via ${finalProvider}.`);
  }

  return user;
}

/**
 * Executes official Firebase Google Authentication (Popup on Desktop, Redirect on Mobile)
 */
export async function signInWithGoogleFirebase() {
  return handleSocialLogin(googleProvider, "google.com");
}

/**
 * Executes official Firebase GitHub Authentication (Popup on Desktop, Redirect on Mobile)
 */
export async function signInWithGithubFirebase() {
  return handleSocialLogin(githubProvider, "github.com");
}

/**
 * Common Firebase OAuth Handler supporting Popup & Mobile Redirect Fallback
 */
async function handleSocialLogin(providerInstance, providerName) {
  try {
    console.log(`[Firebase Auth] Initiating auth for ${providerName} (Mobile: ${isMobileDevice})...`);
    
    if (isMobileDevice) {
      // Use Redirect Flow on Mobile Devices to bypass popup blockers
      await signInWithRedirect(auth, providerInstance);
      return;
    }

    // Try Popup Flow on Desktop
    try {
      const result = await signInWithPopup(auth, providerInstance);
      if (result && result.user) {
        return await processUserDocument(result.user, providerName);
      }
    } catch (popupError) {
      if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') {
        console.warn("Popup blocked/closed. Falling back to signInWithRedirect...");
        await signInWithRedirect(auth, providerInstance);
        return;
      }
      throw popupError;
    }
  } catch (error) {
    console.error("❌ [Firebase Auth Error Details]:", {
      code: error.code,
      message: error.message
    });

    if (error.code === 'auth/unauthorized-domain') {
      const hostname = window.location.hostname;
      const msg = `Firebase Security Notice: Domain '${hostname}' is not authorized. Add '${hostname}' in Firebase Console -> Authentication -> Settings -> Authorized domains.`;
      console.warn(msg);
      if (window.showToast) window.showToast(msg);
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
    const providerId = user.providerData && user.providerData[0] ? user.providerData[0].providerId : '';
    let providerName = 'Google';
    if (providerId.includes('github')) providerName = 'GitHub';
    
    // Check existing stored provider
    const existing = JSON.parse(localStorage.getItem('api_nexus_authenticated_user') || '{}');
    if (existing.provider && existing.provider !== 'Firebase User') {
      providerName = existing.provider;
    }

    const userData = {
      uid: user.uid,
      name: user.displayName || user.email || "Developer User",
      email: user.email || "",
      photoURL: user.photoURL || "",
      provider: providerName
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
