
import type { BenefitSettings } from '@/types';

export const DEFAULT_BENEFIT_SETTINGS: BenefitSettings = {
  monthlyAllowance: 68500, // ARS
  discountPercentage: 70, // Porcentaje
  alertThresholdPercentage: 80, // Example 80%
  enableWeeklyReminders: false,
  lastBackupTimestamp: 0, // 0 o null para indicar que nunca se ha hecho
};

export const APP_NAME = "LEDESC";
