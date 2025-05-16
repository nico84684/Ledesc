
export interface Purchase {
  id: string;
  amount: number;
  date: string; // ISO string date
  merchantName: string;
  receiptImageUrl?: string;
  discountApplied: number; // Amount of discount
  finalAmount: number; // amount - discountApplied
}

export interface BenefitSettings {
  monthlyAllowance: number;
  discountPercentage: number; // e.g., 15 for 15%
  alertThresholdPercentage: number; // e.g., 80 for 80%
  enableWeeklyReminders: boolean;
}

export interface AppState {
  purchases: Purchase[];
  settings: BenefitSettings;
}
