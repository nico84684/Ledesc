
import type { BenefitSettings } from '@/types';

export const DEFAULT_BENEFIT_SETTINGS: BenefitSettings = {
  monthlyAllowance: 68500, // ARS
  discountPercentage: 70, // Porcentaje
  alertThresholdPercentage: 80, // Example 80%
  enableWeeklyReminders: false,
  lastBackupTimestamp: 0, // 0 para indicar que nunca se ha hecho un backup Excel/Restore
};

export const APP_NAME = "LEDESC";
