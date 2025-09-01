export interface DCAConfig {
  pair: string;
  amount_usd: number;
  low_balance_threshold_usd: number;
}

export interface ScheduleConfig {
  cron: string;
  timezone: string;
}

export interface NotificationConfig {
  ntfy_topic: string;
}

export interface DCAStrategyConfig {
  name: string;
  description: string;
  dca: DCAConfig;
  schedule: ScheduleConfig;
  notifications: NotificationConfig;
}
