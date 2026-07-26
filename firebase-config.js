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

// Default Firebase Configuration (can be overridden by window.firebaseConfig)
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

// --- Handle Google Sign-In Popup ---
export async function signInWithGoogleFirebase() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

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
      console.log("Created new user document in Firestore for:", user.email);
    } else {
      // Update lastLogin timestamp for existing user
      await updateDoc(userRef, {
        lastLogin: serverTimestamp()
      });
      console.log("Updated lastLogin timestamp for existing user:", user.email);
    }

    if (window.onFirebaseUserLoginSuccess) {
      window.onFirebaseUserLoginSuccess(user);
    }

    return user;
  } catch (error) {
    console.warn("Firebase Google Auth Notice:", error.message);
    if (error.code === 'auth/popup-closed-by-user') {
      if (window.showToast) window.showToast("Sign in popup closed before completion.");
    } else if (error.code === 'auth/api-key-not-valid' || error.message.includes('API key')) {
      console.info("Using local authentication fallback mode.");
      if (window.fallbackGoogleLogin) {
        window.fallbackGoogleLogin();
      }
    } else {
      if (window.showToast) window.showToast(`Auth error: ${error.message}`);
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
    console.error("Error signing out:", err);
  }
}

// --- Persistent Auth Observer ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("Firebase Auth State: Signed In", user.email);
    const userData = {
      uid: user.uid,
      name: user.displayName || "Developer User",
      email: user.email || "",
      photoURL: user.photoURL || "",
      provider: "Google"
    };

    localStorage.setItem('api_nexus_authenticated_user', JSON.stringify(userData));
    if (window.updateAuthUI) window.updateAuthUI();
    if (window.closeAuthModal) window.closeAuthModal();
  } else {
    console.log("Firebase Auth State: Signed Out / Guest");
  }
});

// Attach global functions to window
window.signInWithGoogleFirebase = signInWithGoogleFirebase;
window.firebaseSignOutUser = firebaseSignOutUser;
