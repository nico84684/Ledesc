
import type { BenefitSettings } from '@/types';

export const DEFAULT_BENEFIT_SETTINGS: BenefitSettings = {
  monthlyAllowance: 68500, // ARS
  discountPercentage: 70, // Porcentaje
  alertThresholdPercentage: 80, // Example 80%
  autoBackupToDrive: false,
  lastBackupTimestamp: 0, 
  enableEndOfMonthReminder: false, // Nuevo
  daysBeforeEndOfMonthToRemind: 3, // Nuevo: Por defecto 3 días antes
};

export const APP_NAME = "LEDESC";
