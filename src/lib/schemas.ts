
import { z } from 'zod';

export const PurchaseFormSchema = z.object({
  amount: z.coerce.number().min(0.01, "El monto debe ser mayor a 0."),
  date: z.string().min(1, "La fecha es requerida."),
  merchantName: z.string().min(1, "El nombre del comercio es requerido.").max(100, "El nombre del comercio no puede exceder los 100 caracteres."),
  merchantLocation: z.string().max(150, "La ubicación del comercio no puede exceder los 150 caracteres.").optional(),
  description: z.string().max(250, "La descripción no puede exceder los 250 caracteres.").optional(),
  receiptImage: z.custom<File | undefined>()
    .refine(file => file === undefined || file.size <= 5 * 1024 * 1024, `El tamaño máximo del archivo es 5MB.`)
    .refine(file => file === undefined || ["image/jpeg", "image/png", "image/webp"].includes(file.type),
      "Solo se permiten formatos .jpg, .png, .webp."
    ).optional(),
});

export type PurchaseFormData = z.infer<typeof PurchaseFormSchema>;

const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

export const SettingsFormSchema = z.object({
  monthlyAllowance: z.coerce.number().min(1, "El beneficio mensual debe ser mayor a 0."),
  discountPercentage: z.coerce.number().min(0, "El porcentaje no puede ser negativo.").max(100, "El porcentaje no puede ser mayor a 100."),
  alertThresholdPercentage: z.coerce.number().min(0, "El umbral no puede ser negativo.").max(100, "El umbral no puede ser mayor a 100."),
  enableWeeklyReminders: z.boolean(),
  preferredBackupTime: z.string()
    .refine((time) => time === '' || timeRegex.test(time), {
      message: "La hora debe estar en formato HH:mm o vacía.",
    })
    .optional(),
  lastBackupTimestamp: z.number().optional(), // Solo para lectura, no editable directamente
});

export type SettingsFormData = z.infer<typeof SettingsFormSchema>;

export const AddMerchantFormSchema = z.object({
  name: z.string().min(1, "El nombre del comercio es requerido.").max(100, "El nombre del comercio no puede exceder los 100 caracteres."),
  location: z.string().max(150, "La ubicación no puede exceder los 150 caracteres.").optional(),
});

export type AddMerchantFormData = z.infer<typeof AddMerchantFormSchema>;
