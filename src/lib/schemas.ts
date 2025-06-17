
import { z } from 'zod';

export const PurchaseFormSchema = z.object({
  amount: z.coerce.number().min(0.01, "El monto debe ser mayor a 0."),
  date: z.string().min(1, "La fecha es requerida."),
  merchantName: z.string().min(1, "El nombre del comercio es requerido.").max(100, "El nombre del comercio no puede exceder los 100 caracteres."),
  merchantLocation: z.string().max(150, "La ubicación del comercio no puede exceder los 150 caracteres.").optional(),
  description: z.string().max(250, "La descripción no puede exceder los 250 caracteres.").optional(),
  // receiptImage field removed
});

export type PurchaseFormData = z.infer<typeof PurchaseFormSchema>;

export const SettingsFormSchema = z.object({
  monthlyAllowance: z.coerce.number().min(1, "El beneficio mensual debe ser mayor a 0."),
  discountPercentage: z.coerce.number().min(0, "El porcentaje no puede ser negativo.").max(100, "El porcentaje no puede ser mayor a 100."),
  alertThresholdPercentage: z.coerce.number().min(0, "El umbral no puede ser negativo.").max(100, "El umbral no puede ser mayor a 100."),
  autoBackupToDrive: z.boolean(),
  lastBackupTimestamp: z.number().optional(),
  enableEndOfMonthReminder: z.boolean(),
  daysBeforeEndOfMonthToRemind: z.coerce.number().min(1, "Debe ser al menos 1 día.").max(15, "No puede exceder los 15 días."),
});

export type SettingsFormData = z.infer<typeof SettingsFormSchema>;

export const AddMerchantFormSchema = z.object({
  name: z.string().min(1, "El nombre del comercio es requerido.").max(100, "El nombre del comercio no puede exceder los 100 caracteres."),
  location: z.string().max(150, "La ubicación no puede exceder los 150 caracteres.").optional(),
});

export type AddMerchantFormData = z.infer<typeof AddMerchantFormSchema>;

export const ContactFormSchema = z.object({
  reason: z.enum(["sugerencias", "errores", "consultas"], {
    required_error: "Debes seleccionar un motivo.",
  }),
  email: z.string().email("Por favor, ingresa un email válido.").min(1, "El email es requerido."),
  message: z.string().min(10, "El mensaje debe tener al menos 10 caracteres.").max(1000, "El mensaje no puede exceder los 1000 caracteres."),
});

export type ContactFormData = z.infer<typeof ContactFormSchema>;
