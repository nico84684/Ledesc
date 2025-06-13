
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // Import getAuth
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

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  console.log("[Firebase] App initialized.");
} else {
  app = getApps()[0];
  console.log("[Firebase] App already initialized.");
}

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);
console.log("[Firebase] Auth initialized.");

// REMINDER: To fix (auth/unauthorized-domain) errors,
// you MUST add your application's domain (e.g., from Firebase Studio or your hosting provider)
// to the list of "Authorized domains" in the Firebase Console:
// Firebase Console -> Your Project -> Authentication -> Sign-in method -> Authorized domains.

let analytics: Analytics | undefined;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
    console.log("[Firebase] Analytics initialized.");
  } catch (error) {
    console.warn("[Firebase] Analytics could not be initialized:", error);
  }
}

export { app, auth, analytics }; // Export auth
