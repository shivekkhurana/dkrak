import type { DCAStrategyConfig } from "@src/dca.types";
import type { KrakenConfig } from "@src/domain/kraken.types";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

export function loadConfig(configPath: string): DCAStrategyConfig {
  try {
    const configContent = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent) as DCAStrategyConfig;
    
    // Validate the configuration
    validateConfig(config);
    
    return config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load config from ${configPath}: ${error.message}`);
    }
    throw new Error(`Failed to load config from ${configPath}`);
  }
}

export function loadKrakenConfig(): KrakenConfig {
  const {
    KRAKEN_API_KEY,
    KRAKEN_API_SECRET,
    KRAKEN_API_URL = "https://api.kraken.com",
  } = process.env;

  if (!KRAKEN_API_KEY || !KRAKEN_API_SECRET) {
    throw new Error("Missing required Kraken API credentials: KRAKEN_API_KEY and KRAKEN_API_SECRET");
  }

  return {
    api_key: KRAKEN_API_KEY,
    api_secret: KRAKEN_API_SECRET,
    api_url: KRAKEN_API_URL,
  };
}

function validateConfig(config: DCAStrategyConfig): void {
  // Validate required fields
  if (!config.name) {
    throw new Error("Config must have a 'name' field");
  }
  
  if (!config.dca) {
    throw new Error("Config must have a 'dca' section");
  }
  
  if (!config.schedule) {
    throw new Error("Config must have a 'schedule' section");
  }
  
  if (!config.notifications) {
    throw new Error("Config must have a 'notifications' section");
  }

  // Validate DCA configuration
  if (!config.dca.pair || typeof config.dca.pair !== 'string') {
    throw new Error("DCA config must have a valid 'pair' field");
  }
  
  if (!config.dca.amount_usd || config.dca.amount_usd <= 0) {
    throw new Error("DCA config must have a positive 'amount_usd' field");
  }
  
  if (!config.dca.low_balance_threshold_usd || config.dca.low_balance_threshold_usd <= 0) {
    throw new Error("DCA config must have a positive 'low_balance_threshold_usd' field");
  }

  // Validate schedule configuration
  if (!config.schedule.cron || typeof config.schedule.cron !== 'string') {
    throw new Error("Schedule config must have a valid 'cron' field");
  }
  
  if (!config.schedule.timezone || typeof config.schedule.timezone !== 'string') {
    throw new Error("Schedule config must have a valid 'timezone' field");
  }

  // Validate cron expression
  validateCronExpression(config.schedule.cron);

  // Validate notifications configuration
  if (!config.notifications.ntfy_topic || typeof config.notifications.ntfy_topic !== 'string') {
    throw new Error("Notifications config must have a valid 'ntfy_topic' field");
  }
}

function validateCronExpression(cron: string): void {
  const parts = cron.split(' ');
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: ${cron} (must have 5 parts: minute hour day month weekday)`);
  }
}

export function listAvailableConfigs(): string[] {
  const configsDir = join(process.cwd(), "configs");
  const files = readdirSync(configsDir).filter(file => file.endsWith('.json'));
  return files.map(file => join(configsDir, file));
}