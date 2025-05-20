
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics, type Analytics } from "firebase/analytics";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBTs8eDliTZFsYILU09WWM-Tdh1RpmEGSY",
  authDomain: "ledescapp.firebaseapp.com",
  projectId: "ledescapp",
  storageBucket: "ledescapp.firebasestorage.app", // Actualizado al valor que proporcionaste
  messagingSenderId: "1068604912509",
  appId: "1:1068604912509:web:e0cb345e0e9a225aef9214",
  measurementId: "G-Y8NS9CH2WF"
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

let analytics: Analytics | undefined;
if (typeof window !== 'undefined') {
  // Initialize Analytics only on the client side
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.warn("Firebase Analytics could not be initialized:", error);
    // This can happen if Firebase is blocked or due to other client-side issues.
    // The app can continue without Analytics.
  }
}

export { app, auth, googleProvider, analytics };
