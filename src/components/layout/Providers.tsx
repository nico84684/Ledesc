
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, type User, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, type Auth } from 'firebase/auth';
// Import ONLY the initialization functions, not the variables
import { ensureFirebaseInitialized, ensureAnalyticsInitialized } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { ThemeProvider as NextThemesProvider } from "next-themes";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  accessToken: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  isFirebaseAuthReady: boolean; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFirebaseAuthReady, setIsFirebaseAuthReady] = useState(false);
  const [authInstance, setAuthInstance] = useState<Auth | undefined>(undefined); // State to hold the auth instance
  const { toast } = useToast();

  useEffect(() => {
    // Ensure Firebase app and auth are initialized on client mount
    const { auth } = ensureFirebaseInitialized(); 
    setAuthInstance(auth); // Store the instance in state
    setIsFirebaseAuthReady(true); 
    ensureAnalyticsInitialized();
  }, []);

  useEffect(() => {
    // Now this effect depends on the authInstance state
    if (!isFirebaseAuthReady || !authInstance) {
      if (loading) setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(authInstance, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setAccessToken(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isFirebaseAuthReady, authInstance]); // Dependency on authInstance

  const signIn = useCallback(async () => {
    if (!isFirebaseAuthReady || !authInstance) { // Use authInstance
      toast({ title: "Error de Autenticación", description: "El servicio de Firebase no está listo. Intenta de nuevo.", variant: "destructive" });
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    try {
      const result = await signInWithPopup(authInstance, provider); // Use authInstance
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
      }
      setUser(result.user);
      toast({ title: "Inicio de Sesión Exitoso", description: "Has iniciado sesión con Google." });
    } catch (error: any) {
      console.error("Error during Google sign-in:", error);
      setAccessToken(null);
      toast({ title: "Error de Inicio de Sesión", description: error.message || "No se pudo iniciar sesión con Google.", variant: "destructive" });
    }
  }, [toast, isFirebaseAuthReady, authInstance]); // Dependency on authInstance

  const signOut = useCallback(async () => {
    if (!isFirebaseAuthReady || !authInstance) { // Use authInstance
      toast({ title: "Error de Autenticación", description: "El servicio de Firebase no está listo. Intenta de nuevo.", variant: "destructive" });
      return;
    }
    try {
      await firebaseSignOut(authInstance); // Use authInstance
      setAccessToken(null);
      toast({ title: "Cierre de Sesión Exitoso", description: "Has cerrado tu sesión." });
    } catch (error: any) {
      console.error("Error during sign-out:", error);
      toast({ title: "Error al Cerrar Sesión", description: error.message || "No se pudo cerrar la sesión.", variant: "destructive" });
    }
  }, [toast, isFirebaseAuthReady, authInstance]); // Dependency on authInstance

  return (
    <AuthContext.Provider value={{ user, loading, accessToken, signIn, signOut, isFirebaseAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>{children}</AuthProvider>
    </NextThemesProvider>
  );
}
