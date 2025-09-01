export interface DCAConfig {
  pair: string;
  amount: number;
  currency: string; // The currency to buy with (e.g., "USD", "EUR", "USDT")
  low_balance_threshold: number;
}

export interface ScheduleConfig {
  cron: string;
  timezone: string;
}

export interface DCAStrategyConfig {
  name: string;
  description: string;
  dca: DCAConfig;
  schedule: ScheduleConfig;
}
