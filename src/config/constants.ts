import type { BenefitSettings } from '@/types';

export const DEFAULT_BENEFIT_SETTINGS: BenefitSettings = {
  monthlyAllowance: 500, // Example value
  discountPercentage: 15, // Example 15%
  alertThresholdPercentage: 80, // Example 80%
  enableWeeklyReminders: false,
};

export const APP_NAME = "Ledesc";
