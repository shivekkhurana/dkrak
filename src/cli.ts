#!/usr/bin/env bun
// CLI script to run multiple DCA strategies using Commander.js

// Load environment variables first
import "dotenv/config";

import { Command } from "commander";
import { spawn } from "child_process";
import {
  loadConfig,
  loadKrakenConfig,
  loadNotificationConfig,
  listAvailableConfigs,
} from "@src/config";
import { readdirSync, existsSync } from "fs";
import { join } from "path";
import { getBalances } from "@src/domain/kraken";
import type { KrakenConfig } from "@src/domain/kraken.types";
import { createLogger } from "@src/logger";

const logger = createLogger("cli");

const program = new Command();

program
  .name("kraken-dca")
  .description("CLI for managing Kraken DCA strategies")
  .version("1.0.0");

// Balance command
program
  .command("balance")
  .description("Show Kraken account balances")
  .option(
    "-c, --currency <currency>",
    "Show specific currency balance (e.g., USD, XBT, ETH)"
  )
  .option("-v, --verbose", "Show all balances including zero balances")
  .action(async (options: { currency?: string; verbose?: boolean }) => {
    try {
      const krakenConfig = loadKrakenConfig();

      logger.info("Fetching Kraken balances");

      const balances = await getBalances(krakenConfig);

      if (options.currency) {
        // Show specific currency
        const currency = options.currency.toUpperCase();
        const balance = balances[currency] || "0";
        const balanceNum = parseFloat(balance);

        if (balanceNum > 0 || options.verbose) {
          logger.info({ currency, balance: balanceNum }, "Currency balance");
        } else {
          logger.info({ currency, balance: 0 }, "No balance found");
        }
      } else {
        // Show all non-zero balances (or all if verbose)
        logger.info("Displaying Kraken account balances");

        const sortedBalances = Object.entries(balances)
          .filter(([_, balance]) => options.verbose || parseFloat(balance) > 0)
          .sort(([a], [b]) => a.localeCompare(b));

        if (sortedBalances.length === 0) {
          logger.info("No balances found");
          return;
        }

        // Group by asset type
        const cryptoAssets: [string, string][] = [];
        const fiatAssets: [string, string][] = [];

        sortedBalances.forEach(([asset, balance]) => {
          const balanceNum = parseFloat(balance);
          if (
            asset.startsWith("Z") ||
            asset === "USD" ||
            asset === "EUR" ||
            asset === "GBP"
          ) {
            fiatAssets.push([asset, balance]);
          } else {
            cryptoAssets.push([asset, balance]);
          }
        });

        if (fiatAssets.length > 0) {
          logger.info({ fiatAssets }, "Fiat currencies");
        }

        if (cryptoAssets.length > 0) {
          logger.info({ cryptoAssets }, "Cryptocurrencies");
        }

        // Show total USD value if available
        const usdBalance = balances["ZUSD"] || balances["USD"] || "0";
        const usdNum = parseFloat(usdBalance);
        if (usdNum > 0) {
          logger.info({ usdBalance: usdNum }, "Total USD available");
        }
      }
    } catch (error) {
      logger.error({ error }, "Error fetching balances");
      process.exit(1);
    }
  });

// List command
program
  .command("list")
  .description("List available DCA configurations")
  .action(() => {
    logger.info("Listing available DCA configurations");

    const configsDir = join(process.cwd(), "configs");
    if (existsSync(configsDir)) {
      try {
        const files = readdirSync(configsDir).filter((file) =>
          file.endsWith(".json")
        );
        if (files.length > 0) {
          logger.info({ files }, "Available configurations");
        }
      } catch (error) {
        // Ignore errors reading directory
      }
    }
  });

// Validate config command
program
  .command("validate")
  .description("Validate a configuration file without running it")
  .argument("<config>", "Path to the configuration file")
  .action((configPath: string) => {
    try {
      const config = loadConfig(configPath);
      const notificationConfig = loadNotificationConfig();
      logger.info(
        {
          configPath,
          name: config.name,
          description: config.description,
          pair: config.dca.pair,
          amount: config.dca.amount,
          currency: config.dca.currency,
          schedule: config.schedule.cron,
          timezone: config.schedule.timezone,
          notifications: notificationConfig.ntfy_topic,
        },
        "Configuration validation successful"
      );
    } catch (error) {
      logger.error({ configPath, error }, "Configuration validation failed");
      process.exit(1);
    }
  });

program.parse();
