
"use client";

import { useState, useEffect } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import { 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  type User 
} from "firebase/auth";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, UserCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoadingSpinner } from "../common/LoadingSpinner";

export function AuthButton() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[AuthButton] Subscribing to onAuthStateChanged.");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("[AuthButton] onAuthStateChanged: User IS signed IN.", { uid: user.uid, email: user.email, displayName: user.displayName });
      } else {
        console.log("[AuthButton] onAuthStateChanged: User IS signed OUT.");
      }
      setCurrentUser(user);
      setLoading(false);
      console.log("[AuthButton] onAuthStateChanged: setLoading(false), currentUser set.");
    });
    return () => {
      console.log("[AuthButton] Unsubscribing from onAuthStateChanged.");
      unsubscribe();
    }; 
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    console.log("[AuthButton] handleSignIn: Attempting sign-in...");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log("[AuthButton] handleSignIn: signInWithPopup promise resolved. Result:", result);
      if (result && result.user) {
        console.log("[AuthButton] handleSignIn: User details from signInWithPopup result:", { uid: result.user.uid, email: result.user.email, displayName: result.user.displayName });
      } else {
        console.warn("[AuthButton] handleSignIn: signInWithPopup result or result.user is null/undefined.");
      }
      // No es necesario llamar a setLoading(false) aquí si onAuthStateChanged lo hace.
      // onAuthStateChanged debería ser el único responsable de actualizar currentUser y setLoading.
    } catch (error: any) { 
      console.error("[AuthButton] handleSignIn: Error during signInWithPopup:", { code: error.code, message: error.message });
      if (error.code === 'auth/popup-closed-by-user') {
        console.info("[AuthButton] handleSignIn: Firebase sign-in popup closed by user.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        console.info("[AuthButton] handleSignIn: Firebase sign-in popup request cancelled.");
      } else {
        console.error("[AuthButton] handleSignIn: Other Firebase sign-in error:", error);
      }
      // Si hay un error, onAuthStateChanged podría no dispararse con un nuevo usuario, 
      // o podría dispararse con `null`. El `setLoading(false)` en `onAuthStateChanged`
      // debería eventualmente ejecutarse. Si no, la UI podría quedar en "loading".
      // Para asegurar que la UI no quede en "loading" en caso de error aquí,
      // podemos considerar un setLoading(false) si `onAuthStateChanged` no lo hace.
      // Por ahora, confiamos en que onAuthStateChanged (que siempre se llama al inicio y en cambios) limpiará el loading.
      // De hecho, si aquí ocurre un error, onAuthStateChanged ya se habrá ejecutado al inicio
      // con user=null y loading=false. Si luego el usuario intenta loguearse y falla aquí,
      // setLoading(true) se llamó, pero si onAuthStateChanged no se vuelve a disparar, quedaría en true.
      // Por lo tanto, es prudente poner setLoading(false) en el catch si el error no es uno que
      // vaya a ser seguido por una llamada a onAuthStateChanged.
      setLoading(false); // Asegurar que el spinner se detenga si hay un error aquí.
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    console.log("[AuthButton] handleSignOut: Attempting sign-out...");
    try {
      await firebaseSignOut(auth);
      console.log("[AuthButton] handleSignOut: firebaseSignOut successful.");
      // onAuthStateChanged will handle setting currentUser to null and setLoading(false)
    } catch (error) {
      console.error("[AuthButton] handleSignOut: Error signing out:", error);
      setLoading(false); // Asegurar que el spinner se detenga si hay un error aquí.
    }
  };

  if (loading) {
    return <Button variant="ghost" size="sm" disabled><LoadingSpinner size={16} className="mr-2" />Cargando...</Button>;
  }

  if (currentUser) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={currentUser.photoURL ?? undefined} alt={currentUser.displayName ?? "Usuario"} />
              <AvatarFallback>
                {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : <UserCircle size={20}/>}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {currentUser.displayName}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {currentUser.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button onClick={handleSignIn} variant="outline" size="sm">
      <LogIn className="mr-2 h-4 w-4" />
      Iniciar Sesión con Google
    </Button>
  );
}

