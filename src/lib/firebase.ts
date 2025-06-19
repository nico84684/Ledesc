
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth"; // Import Auth type
import { getAnalytics, type Analytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBTs8eDliTZFsYILU09WWM-Tdh1RpmEGSY",
  authDomain: "ledescapp.firebaseapp.com",
  projectId: "ledescapp",
  storageBucket: "ledescapp.firebasestorage.app",
  messagingSenderId: "1068604912509",
  appId: "1:1068604912509:web:e0cb345e0e9a225aef9214",
  measurementId: "G-Y8NS9CH2WF"
};

// Declare Firebase services without initializing them
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let analytics: Analytics | undefined;

export function ensureFirebaseInitialized(): { app: FirebaseApp | undefined, auth: Auth | undefined } {
  if (typeof window === 'undefined') {
    // console.log("[Firebase Core] Not initializing on server.");
    return { app, auth };
  }
  if (app && auth) { // Check if both app and auth are already initialized
    // console.log("[Firebase Core] App and Auth already initialized.");
    return { app, auth };
  }

  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
      console.log("[Firebase Core] App initialized.");
    } else {
      app = getApps()[0];
      console.log("[Firebase Core] App instance retrieved.");
    }
    // Initialize auth only if app is successfully initialized/retrieved
    if (app && !auth) { 
        auth = getAuth(app);
        console.log("[Firebase Core] Auth initialized.");
    }
  } catch (error) {
    console.error("[Firebase Core] Error initializing Firebase App or Auth:", error);
    // app and auth might remain undefined or partially defined
  }
  return { app, auth };
}


export function ensureAnalyticsInitialized(): Analytics | undefined {
  if (typeof window === 'undefined') {
    // console.log("[Firebase Analytics] Not initializing on server.");
    return undefined;
  }

  const { app: initializedApp } = ensureFirebaseInitialized(); // Ensure app and auth are ready

  if (!initializedApp) { // Check if app initialization was successful via the return
    console.warn("[Firebase Analytics] Firebase app not available for Analytics initialization.");
    return undefined;
  }

  if (analytics) {
    // console.log("[Firebase Analytics] Already initialized.");
    return analytics;
  }

  try {
    // Pass the initializedApp explicitly, not the module-level 'app' which might be stale
    analytics = getAnalytics(initializedApp); 
    console.log("[Firebase Analytics] Analytics lazily initialized.");
  } catch (error) {
    console.error("[Firebase Analytics] Error lazy-initializing Analytics:", error);
    // analytics remains undefined
  }
  return analytics;
}

// Export them, they will be undefined until ensureFirebaseInitialized is called
export { app, auth, analytics };
