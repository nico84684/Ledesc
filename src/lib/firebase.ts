
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
    console.warn("[Firebase Core] Not initializing on server (ensureFirebaseInitialized).");
    return { app, auth };
  }

  if (app && auth) {
    // Already initialized
    return { app, auth };
  }

  try {
    if (getApps().length === 0) {
      console.log("[Firebase Core] Initializing FirebaseApp...");
      app = initializeApp(firebaseConfig);
      console.log("[Firebase Core] FirebaseApp initialized.");
    } else {
      app = getApps()[0];
      console.log("[Firebase Core] FirebaseApp instance retrieved.");
    }

    if (app && !auth) {
        console.log("[Firebase Core] Initializing Firebase Auth...");
        auth = getAuth(app);
        console.log("[Firebase Core] Firebase Auth initialized.");
    } else if (!app) {
        console.warn("[Firebase Core] FirebaseApp is not available after initialization attempt (ensureFirebaseInitialized).");
    }
  } catch (error: any) {
    console.error("[Firebase Core] Error during Firebase App/Auth initialization (ensureFirebaseInitialized):", error, error.stack);
  }
  return { app, auth };
}


export function ensureAnalyticsInitialized(): Analytics | undefined {
  if (typeof window === 'undefined') {
    console.warn("[Firebase Analytics] Not initializing on server (ensureAnalyticsInitialized).");
    return undefined;
  }

  const { app: initializedApp } = ensureFirebaseInitialized();

  if (!initializedApp) {
    console.warn("[Firebase Analytics] Firebase app not available for Analytics initialization (ensureAnalyticsInitialized).");
    return undefined;
  }

  if (analytics) {
    // Already initialized
    return analytics;
  }

  try {
    console.log("[Firebase Analytics] Initializing Firebase Analytics (lazily)...");
    analytics = getAnalytics(initializedApp);
    console.log("[Firebase Analytics] Firebase Analytics lazily initialized.");
  } catch (error: any) {
    console.error("[Firebase Analytics] Error during Analytics initialization (ensureAnalyticsInitialized):", error, error.stack);
  }
  return analytics;
}

// Export them, they will be undefined until ensureFirebaseInitialized/ensureAnalyticsInitialized are called
export { app, auth, analytics };
