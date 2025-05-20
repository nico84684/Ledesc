
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will handle setting currentUser and setLoading(false) on success
    } catch (error: any) { // Especificar 'any' para acceder a 'code'
      if (error.code === 'auth/popup-closed-by-user') {
        console.info("Firebase sign-in popup closed by user.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        console.info("Firebase sign-in popup request cancelled (e.g., multiple popups opened).");
      } else {
        console.error("Error signing in with Google:", error);
        // Consider showing a toast message to the user for other types of errors
      }
      setLoading(false); // Ensure loading is stopped on any sign-in error
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged will handle setting currentUser to null and setLoading(false)
    } catch (error) {
      console.error("Error signing out:", error);
      // Consider showing a toast message to the user
      setLoading(false);
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
