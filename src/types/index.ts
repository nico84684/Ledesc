
export interface Purchase {
  id: string;
  amount: number;
  date: string; // ISO string date
  merchantName: string;
  merchantLocation?: string; // Ubicación de la compra, puede ser diferente a la ubicación "oficial" del comercio
  description?: string; // Optional description
  receiptImageUrl?: string;
  discountApplied: number; // Amount of discount
  finalAmount: number; // amount - discountApplied
}

export interface BenefitSettings {
  monthlyAllowance: number;
  discountPercentage: number; // e.g., 15 for 15%
  alertThresholdPercentage: number; // e.g., 80 for 80%
  autoBackupToDrive: boolean;
  lastBackupTimestamp?: number; // Milliseconds since epoch for Drive/Excel backup
  enableEndOfMonthReminder: boolean; // Nuevo: Habilitar recordatorio de fin de mes
  daysBeforeEndOfMonthToRemind: number; // Nuevo: Días antes para recordar
  lastLocalSaveTimestamp?: number; // Milliseconds since epoch for local storage save
  lastEndOfMonthReminderShownForMonth?: string;
}

export interface Merchant {
  id: string;
  name: string;
  location?: string;
}

export interface AppState {
  purchases: Purchase[];
  settings: BenefitSettings;
  merchants: Merchant[];
  isSyncing?: boolean; // Optional property to track sync status
}
