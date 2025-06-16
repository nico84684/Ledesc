
import {genkit, type PluginProvider} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

const plugins: PluginProvider[] = [];

// Lee la API key de las variables de entorno
const apiKeyCandidate = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
// Asegura que la apiKey sea una cadena no vacía, o undefined si no es válida
const apiKey = (apiKeyCandidate && apiKeyCandidate.trim() !== '') ? apiKeyCandidate.trim() : undefined;

if (apiKey) {
  plugins.push(googleAI({ apiKey }));
  // El console.log de éxito fue eliminado previamente para reducir logs
} else {
  console.warn(
    '[Genkit Init] GEMINI_API_KEY o GOOGLE_API_KEY no encontradas o están vacías en las variables de entorno. ' +
    'Los flujos que dependen directamente de modelos de GenAI (como Gemini) no funcionarán. ' +
    'Los flujos de backup/restauración a Google Drive, que usan la API de Drive directamente, deberían funcionar si la autenticación OAuth es correcta.'
  );
}

// Configuración explícita para Genkit
const genkitConfig: { plugins: PluginProvider[]; model?: string } = {
  plugins,
};

// Solo establece un modelo por defecto si el plugin de Google AI está configurado (es decir, si hay una API key)
if (apiKey) {
  genkitConfig.model = 'googleai/gemini-2.0-flash'; // Modelo por defecto si se usa googleAI
}

export const ai = genkit(genkitConfig);
