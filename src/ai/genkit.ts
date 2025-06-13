
import {genkit, type PluginProvider} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import dotenv from 'dotenv';

dotenv.config(); // Cargar variables de entorno desde .env (si existe)

const plugins: PluginProvider[] = [];

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (apiKey) {
  plugins.push(googleAI({ apiKey }));
  console.log('[Genkit Init] Google AI plugin loaded with API key.');
} else {
  console.warn(
    '[Genkit Init] GEMINI_API_KEY o GOOGLE_API_KEY no encontradas en las variables de entorno. ' +
    'Los flujos dependientes de Google AI (Gemini) no funcionarán. ' +
    'El flujo de backup a Google Drive debería funcionar si no utiliza modelos generativos.'
  );
}

export const ai = genkit({
  plugins,
  // Establecer un modelo por defecto condicionalmente solo si el plugin está activo.
  // El campo 'model' en el nivel superior de la configuración de genkit() es un valor por defecto.
  // Si el plugin googleAI no está cargado, este modelo no será válido.
  ...(apiKey && { model: 'googleai/gemini-2.0-flash' }),
  // Habilitar el logger de telemetría puede ser útil para depuración, pero opcional.
  // enableTracing: true, // Descomentar si necesitas tracing detallado
});

// Se eliminó el console.log que causaba el error.
// console.log(`[Genkit Init] Genkit inicializado con ${plugins.length} plugin(s).`);
