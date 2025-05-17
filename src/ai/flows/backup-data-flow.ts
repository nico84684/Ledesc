
'use server';
/**
 * @fileOverview Flujo de Genkit para respaldar datos de la aplicación en Google Sheets.
 *
 * - backupDataToDrive - Función que maneja el proceso de respaldo.
 * - BackupDataInput - El tipo de entrada para la función de respaldo.
 * - BackupDataOutput - El tipo de retorno para la función de respaldo.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { APP_NAME, DEFAULT_BENEFIT_SETTINGS } from '@/config/constants';
import { format, parseISO } from 'date-fns';
// No importamos googleapis aquí directamente en el scope global para evitar errores si no está configurado.
// Se accederá a través del tool.

// Esquemas Zod para los datos de la aplicación (similares a los de src/types/index.ts)
const PurchaseSchema = z.object({
  id: z.string(),
  amount: z.number(),
  date: z.string(), // ISO string date
  merchantName: z.string(),
  description: z.string().optional(),
  receiptImageUrl: z.string().optional(),
  discountApplied: z.number(),
  finalAmount: z.number(),
});

const BenefitSettingsSchema = z.object({
  monthlyAllowance: z.number(),
  discountPercentage: z.number(),
  alertThresholdPercentage: z.number(),
  enableWeeklyReminders: z.boolean(),
});

const BackupDataInputSchema = z.object({
  purchases: z.array(PurchaseSchema).describe("Lista de todas las compras del usuario."),
  settings: BenefitSettingsSchema.describe("Configuración actual del beneficio del usuario."),
});
export type BackupDataInput = z.infer<typeof BackupDataInputSchema>;

const BackupDataOutputSchema = z.object({
  success: z.boolean().describe("Indica si el respaldo fue exitoso (simulado)."),
  message: z.string().describe("Un mensaje describiendo el resultado del respaldo."),
  spreadsheetUrl: z.string().optional().describe("URL de la Google Sheet creada (simulada)."),
});
export type BackupDataOutput = z.infer<typeof BackupDataOutputSchema>;


const getAuthenticatedSheetsClientTool = ai.defineTool(
  {
    name: 'getAuthenticatedSheetsClient',
    description: 'Proporciona un cliente (simulado) de la API de Google Sheets. En una aplicación real, esto manejaría la autenticación OAuth 2.0.',
    outputSchema: z.any(), // Debería ser el tipo del cliente de googleapis.sheets, pero es complejo para definir en Zod sin la instancia.
  },
  async () => {
    console.warn(
      'getAuthenticatedSheetsClientTool: La autenticación completa con Google Drive/Sheets no está implementada en este prototipo.' +
      'Se devolverá un cliente simulado que registrará las acciones en la consola.'
    );
    // Devolvemos un mock que simula la interfaz de googleapis.sheets().spreadsheets
    return {
      spreadsheets: {
        create: async (params: any) => {
          console.log('[SIMULACIÓN API GOOGLE SHEETS] Creando nueva hoja de cálculo con parámetros:', JSON.stringify(params, null, 2));
          const mockSpreadsheetId = `mock_spreadsheet_${Date.now()}`;
          const mockSpreadsheetUrl = `https://docs.google.com/spreadsheets/d/${mockSpreadsheetId}/edit`;
          console.log(`[SIMULACIÓN API GOOGLE SHEETS] Hoja de cálculo simulada creada con ID: ${mockSpreadsheetId}`);
          return {
            data: {
              spreadsheetId: mockSpreadsheetId,
              spreadsheetUrl: mockSpreadsheetUrl,
              properties: { title: params.resource.properties.title },
            },
          };
        },
        values: {
          batchUpdate: async (params: any) => {
            console.log('[SIMULACIÓN API GOOGLE SHEETS] Actualizando valores en lote en la hoja de cálculo:', JSON.stringify(params, null, 2));
            console.log(`[SIMULACIÓN API GOOGLE SHEETS] Datos simulados escritos en la hoja con ID: ${params.spreadsheetId}`);
            return {
              data: {
                spreadsheetId: params.spreadsheetId,
                totalUpdatedRows: params.resource.data.reduce((acc:any, d:any) => acc + (d.values ? d.values.length : 0), 0),
                totalUpdatedCells: params.resource.data.reduce((acc:any, d:any) => acc + (d.values ? d.values.length * d.values[0].length : 0), 0),
              }
            };
          },
        },
      },
    };
  }
);


const backupDataToDriveFlow = ai.defineFlow(
  {
    name: 'backupDataToDriveFlow',
    inputSchema: BackupDataInputSchema,
    outputSchema: BackupDataOutputSchema,
    system: "Eres un asistente que respalda los datos de la aplicación en una Google Sheet. Utilizarás la herramienta proporcionada para obtener un cliente (simulado) de Google Sheets y luego crear/actualizar la hoja de cálculo."
  },
  async (input) => {
    // @ts-ignore: El tipo del cliente simulado es 'any'
    const sheetsApi = await getAuthenticatedSheetsClientTool() as any; // Forzar tipo para el mock

    if (!sheetsApi || !sheetsApi.spreadsheets) {
      return { success: false, message: "Error: El cliente simulado de Google Sheets no se pudo obtener." };
    }

    const spreadsheetTitle = `${APP_NAME} Backup - ${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}`;

    try {
      const createResponse = await sheetsApi.spreadsheets.create({
        resource: {
          properties: {
            title: spreadsheetTitle,
          },
          sheets: [ // Definir las hojas al crear el spreadsheet
            { properties: { title: 'Compras' } },
            { properties: { title: 'Configuracion' } },
          ],
        },
      });

      const spreadsheetId = createResponse.data.spreadsheetId;
      const spreadsheetUrl = createResponse.data.spreadsheetUrl;

      if (!spreadsheetId) {
        return { success: false, message: "Error: No se pudo simular la creación de la hoja de cálculo." };
      }

      console.log(`[FLUJO GENKIT] Hoja de cálculo simulada creada: ID ${spreadsheetId}, URL: ${spreadsheetUrl}`);

      // Preparar datos para la hoja "Compras"
      const purchaseHeaders = ['ID', 'Monto Original ($)', 'Fecha', 'Comercio', 'Descripción', 'Descuento Aplicado ($)', 'Monto Final ($)', 'URL Recibo'];
      const purchaseRows = input.purchases.map(p => [
        p.id,
        p.amount,
        format(parseISO(p.date), 'yyyy-MM-dd HH:mm:ss'),
        p.merchantName,
        p.description || '',
        p.discountApplied,
        p.finalAmount,
        p.receiptImageUrl || ''
      ]);

      // Preparar datos para la hoja "Configuracion"
      const settingsHeaders = ['Configuración', 'Valor'];
      const settingsRows = Object.entries(input.settings || DEFAULT_BENEFIT_SETTINGS).map(([key, value]) => [
          key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()), // Formatear clave
          String(value)
        ]);

      const dataPayload = [
        {
          range: 'Compras!A1', // Escribir en la hoja "Compras"
          values: [purchaseHeaders, ...purchaseRows],
        },
        {
          range: 'Configuracion!A1', // Escribir en la hoja "Configuracion"
          values: [settingsHeaders, ...settingsRows],
        },
      ];

      await sheetsApi.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: {
          valueInputOption: 'USER_ENTERED',
          data: dataPayload,
        },
      });
      
      console.log(`[FLUJO GENKIT] Datos simulados escritos en la hoja de cálculo.`);

      return {
        success: true,
        message: `Datos respaldados (simuladamente) en Google Sheet. Título: "${spreadsheetTitle}". Por favor, revisa la consola para ver los detalles de la simulación.`,
        spreadsheetUrl: spreadsheetUrl
      };

    } catch (error: any) {
      console.error('[FLUJO GENKIT] Error durante la simulación de respaldo en Google Sheets:', error);
      return { success: false, message: `Error durante la simulación de respaldo: ${error.message || 'Error desconocido'}` };
    }
  }
);

/**
 * Envuelve el flujo de Genkit para exportarlo y usarlo desde acciones del servidor.
 */
export async function backupDataToDrive(input: BackupDataInput): Promise<BackupDataOutput> {
  try {
    return await backupDataToDriveFlow(input);
  } catch (error: any) {
    console.error('Error al ejecutar el flujo backupDataToDriveFlow:', error);
    return {
      success: false,
      message: `Error inesperado al procesar el respaldo: ${error.message || 'Error desconocido'}`
    };
  }
}
