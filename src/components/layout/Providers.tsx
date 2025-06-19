
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, type User, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
// Import specific services and initialization functions
import { auth as firebaseAuthServiceFromModule, ensureFirebaseInitialized, ensureAnalyticsInitialized } from '@/lib/firebase';
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
  const { toast } = useToast();

  useEffect(() => {
    // Ensure Firebase app and auth are initialized on client mount
    ensureFirebaseInitialized(); 
    setIsFirebaseAuthReady(true); 
    
    ensureAnalyticsInitialized();
  }, []);

  useEffect(() => {
    // firebaseAuthServiceFromModule is the exported 'auth' from firebase.ts
    // It will be undefined until ensureFirebaseInitialized sets it.
    if (!isFirebaseAuthReady || !firebaseAuthServiceFromModule) {
      if (loading) setLoading(false); // Ensure loading stops if Firebase isn't ready
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuthServiceFromModule, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setAccessToken(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isFirebaseAuthReady]); 

  const signIn = useCallback(async () => {
    if (!isFirebaseAuthReady || !firebaseAuthServiceFromModule) {
      toast({ title: "Error de Autenticación", description: "El servicio de Firebase no está listo. Intenta de nuevo.", variant: "destructive" });
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    try {
      const result = await signInWithPopup(firebaseAuthServiceFromModule, provider);
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
  }, [toast, isFirebaseAuthReady]);

  const signOut = useCallback(async () => {
    if (!isFirebaseAuthReady || !firebaseAuthServiceFromModule) {
      toast({ title: "Error de Autenticación", description: "El servicio de Firebase no está listo. Intenta de nuevo.", variant: "destructive" });
      return;
    }
    try {
      await firebaseSignOut(firebaseAuthServiceFromModule);
      setAccessToken(null);
      toast({ title: "Cierre de Sesión Exitoso", description: "Has cerrado tu sesión." });
    } catch (error: any) {
      console.error("Error during sign-out:", error);
      toast({ title: "Error al Cerrar Sesión", description: error.message || "No se pudo cerrar la sesión.", variant: "destructive" });
    }
  }, [toast, isFirebaseAuthReady]);

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
