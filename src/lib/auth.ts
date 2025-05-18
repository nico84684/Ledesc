
import NextAuth, { type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

// Asegúrate de tener estas variables de entorno configuradas
// GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, AUTH_SECRET

// Verificar la existencia de las variables de entorno críticas
if (!process.env.GOOGLE_CLIENT_ID) {
  throw new Error('Error de configuración: Falta la variable de entorno GOOGLE_CLIENT_ID.');
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error('Error de configuración: Falta la variable de entorno GOOGLE_CLIENT_SECRET.');
}
if (!process.env.AUTH_SECRET) {
  throw new Error('Error de configuración: Falta la variable de entorno AUTH_SECRET.');
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Es crucial solicitar los scopes correctos si planeas usar el token para Google Drive/Sheets
      // Por ahora, solo pediremos los scopes básicos para el login.
      // Para Google Drive: 'https://www.googleapis.com/auth/drive.file'
      // Para Google Sheets: 'https://www.googleapis.com/auth/spreadsheets'
      // authorization: {
      //   params: {
      //     scope: 'openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets',
      //   },
      // },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async jwt({ token, account }) {
      // Persiste el OAuth access_token en el token JWT si está disponible
      if (account) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token; // Opcional: si necesitas el id_token
      }
      return token;
    },
    async session({ session, token }) {
      // Envía propiedades al cliente, como un access_token
      // @ts-ignore // TODO: Define mejor los tipos de sesión y token
      session.accessToken = token.accessToken;
      // @ts-ignore
      session.user.id = token.sub; // El 'sub' (subject) es el ID de usuario de Google
      return session;
    },
  },
  // pages: { // Opcional: si quieres páginas personalizadas para login, error, etc.
  //   signIn: '/auth/signin',
  // }
};

export default NextAuth(authOptions);
