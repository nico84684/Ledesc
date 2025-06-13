
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
  enableWeeklyReminders: boolean;
  autoBackupToDrive: boolean; // Nueva opción para backup automático
  lastBackupTimestamp?: number; // Milliseconds since epoch
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
}
