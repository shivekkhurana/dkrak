import type { DCAStrategyConfig } from "@src/tasks/dca.types";
import type { KrakenConfig } from "@src/domain/kraken.types";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { createLogger } from "@src/logger";

const logger = createLogger("config");

export interface NotificationConfig {
  ntfy_topic: string;
}

export function loadConfig(configPath: string): DCAStrategyConfig {
  try {
    logger.info({ configPath }, "Loading configuration");
    const configContent = readFileSync(configPath, "utf-8");
    const config = JSON.parse(configContent) as DCAStrategyConfig;

    // Validate the configuration
    validateConfig(config);
    logger.info({ configPath }, "Configuration loaded successfully");

    return config;
  } catch (error) {
    logger.error({ configPath, error }, "Failed to load configuration");
    if (error instanceof Error) {
      throw new Error(
        `Failed to load config from ${configPath}: ${error.message}`
      );
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
    throw new Error(
      "Missing required Kraken API credentials: KRAKEN_API_KEY and KRAKEN_API_SECRET"
    );
  }

  return {
    api_key: KRAKEN_API_KEY,
    api_secret: KRAKEN_API_SECRET,
    api_url: KRAKEN_API_URL,
  };
}

export function loadNotificationConfig(): NotificationConfig {
  const { NTFY_TOPIC } = process.env;

  if (!NTFY_TOPIC) {
    throw new Error("Missing required notification configuration: NTFY_TOPIC");
  }

  return {
    ntfy_topic: NTFY_TOPIC,
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

  // Validate DCA configuration
  if (!config.dca.pair || typeof config.dca.pair !== "string") {
    throw new Error("DCA config must have a valid 'pair' field");
  }

  if (!config.dca.amount || config.dca.amount <= 0) {
    throw new Error("DCA config must have a positive 'amount' field");
  }

  if (!config.dca.currency || typeof config.dca.currency !== "string") {
    throw new Error("DCA config must have a valid 'currency' field");
  }

  if (
    !config.dca.low_balance_threshold ||
    config.dca.low_balance_threshold <= 0
  ) {
    throw new Error(
      "DCA config must have a positive 'low_balance_threshold' field"
    );
  }

  // Validate schedule configuration
  if (!config.schedule.cron || typeof config.schedule.cron !== "string") {
    throw new Error("Schedule config must have a valid 'cron' field");
  }

  if (
    !config.schedule.timezone ||
    typeof config.schedule.timezone !== "string"
  ) {
    throw new Error("Schedule config must have a valid 'timezone' field");
  }

  // Validate cron expression
  validateCronExpression(config.schedule.cron);
}

function validateCronExpression(cron: string): void {
  const parts = cron.split(" ");
  if (parts.length !== 5) {
    throw new Error(
      `Invalid cron expression: ${cron} (must have 5 parts: minute hour day month weekday)`
    );
  }
}

export function listAvailableConfigs(): string[] {
  const configsDir = join(process.cwd(), "configs");
  const files = readdirSync(configsDir).filter((file) =>
    file.endsWith(".json")
  );
  return files.map((file) => join(configsDir, file));
}
