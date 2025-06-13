
"use client";

import { GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/layout/Providers'; // Corrected import path
import { LogIn, LogOut, UserCircle, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';

export function AuthButton() {
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    // Optionally, add scopes for Google Drive here when implementing actual Drive backup
    // provider.addScope('https://www.googleapis.com/auth/drive.file');
    try {
      await signInWithPopup(auth, provider);
      toast({ title: "Inicio de Sesión Exitoso", description: "Has iniciado sesión con Google." });
    } catch (error: any) {
      console.error("Error during Google sign-in:", error);
      toast({ title: "Error de Inicio de Sesión", description: error.message || "No se pudo iniciar sesión con Google.", variant: "destructive" });
    }
  };

  const handleSignOut = async () => {
    try {
      await firebaseSignOut(auth);
      toast({ title: "Cierre de Sesión Exitoso", description: "Has cerrado tu sesión." });
    } catch (error: any) {
      console.error("Error during sign-out:", error);
      toast({ title: "Error al Cerrar Sesión", description: error.message || "No se pudo cerrar la sesión.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <Button variant="outline" size="icon" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || "Usuario"} />
              <AvatarFallback>
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : <UserCircle />)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.displayName || "Usuario"}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Cerrar sesión</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button onClick={handleSignIn} variant="outline">
      <LogIn className="mr-2 h-4 w-4" />
      Iniciar Sesión con Google
    </Button>
  );
}
