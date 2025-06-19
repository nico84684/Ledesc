
"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useCallback }
from 'react';
import { onAuthStateChanged, type User, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { ThemeProvider as NextThemesProvider } from "next-themes";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  accessToken: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setAccessToken(null); 
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    try {
      const result = await signInWithPopup(auth, provider);
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
  }, [toast]);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      setAccessToken(null); 
      toast({ title: "Cierre de Sesión Exitoso", description: "Has cerrado tu sesión." });
    } catch (error: any) {
      console.error("Error during sign-out:", error);
      toast({ title: "Error al Cerrar Sesión", description: error.message || "No se pudo cerrar la sesión.", variant: "destructive" });
    }
  }, [toast]);

  return (
    <AuthContext.Provider value={{ user, loading, accessToken, signIn, signOut }}>
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
      defaultTheme="light" // Cambiado de "system" a "light"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>{children}</AuthProvider>
    </NextThemesProvider>
  );
}
