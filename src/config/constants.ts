
import type { BenefitSettings } from '@/types';

export const DEFAULT_BENEFIT_SETTINGS: BenefitSettings = {
  monthlyAllowance: 68500, // ARS
  discountPercentage: 70, // Porcentaje
  alertThresholdPercentage: 80, // Example 80%
  enableWeeklyReminders: false,
};

export const APP_NAME = "LEDESC";

