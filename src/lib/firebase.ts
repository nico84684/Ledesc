// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  setPersistence, // Importar setPersistence
  inMemoryPersistence, // Importar inMemoryPersistence
  browserLocalPersistence, // Para referencia futura
  onAuthStateChanged // Para logs
} from "firebase/auth";
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

const auth = getAuth(app);
console.log("[Firebase] Auth instance obtained.");
const googleProvider = new GoogleAuthProvider();
console.log("[Firebase] GoogleAuthProvider instance created.");

// Configurar persistencia ANTES de cualquier operación de autenticación
// Intentamos inMemoryPersistence para evitar problemas de acceso al almacenamiento.
if (typeof window !== 'undefined') {
  setPersistence(auth, inMemoryPersistence)
    .then(() => {
      console.log("[Firebase] Auth persistence successfully set to inMemoryPersistence.");
    })
    .catch((error) => {
      console.error("[Firebase] Error setting auth persistence to inMemoryPersistence:", error);
      // Como fallback, podríamos intentar no establecer persistencia explícitamente
      // o intentar browserLocalPersistence si el error no es por acceso,
      // pero si el error es "Access to storage is not allowed", browserLocalPersistence también fallaría.
    });
} else {
  console.log("[Firebase] Not in browser, skipping setPersistence.");
}

// Log para onAuthStateChanged para depuración
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("[Firebase] onAuthStateChanged: User IS signed IN (from firebase.ts). UID:", user.uid);
  } else {
    console.log("[Firebase] onAuthStateChanged: User IS signed OUT (from firebase.ts).");
  }
});


let analytics: Analytics | undefined;
if (typeof window !== 'undefined') {
  // Initialize Analytics only on the client side
  try {
    analytics = getAnalytics(app);
    console.log("[Firebase] Analytics initialized.");
  } catch (error) {
    console.warn("[Firebase] Analytics could not be initialized:", error);
  }
}

export { app, auth, googleProvider, analytics };
