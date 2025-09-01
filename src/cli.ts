#!/usr/bin/env bun
// CLI script to run multiple DCA strategies using Commander.js

// Load environment variables first
import "dotenv/config";

import { Command } from "commander";
import { spawn } from "child_process";
import { loadKrakenConfig, listAvailableConfigs } from "@src/config";
import { readdirSync, existsSync } from "fs";
import { join } from "path";
import { createKrakenAPI } from "@src/domain/kraken";
import type { KrakenConfig } from "@src/domain/kraken.types";

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
      const krakenAPI = createKrakenAPI(krakenConfig);

      console.log("🔍 Fetching Kraken balances...");

      const balances = await krakenAPI.getBalances();

      if (options.currency) {
        // Show specific currency
        const currency = options.currency.toUpperCase();
        const balance = balances[currency] || "0";
        const balanceNum = parseFloat(balance);

        if (balanceNum > 0 || options.verbose) {
          console.log(`\n💰 ${currency} Balance: ${balanceNum.toFixed(8)}`);
        } else {
          console.log(`\n💰 ${currency} Balance: 0 (no balance found)`);
        }
      } else {
        // Show all non-zero balances (or all if verbose)
        console.log("\n💰 Kraken Account Balances:");
        console.log("=".repeat(50));

        const sortedBalances = Object.entries(balances)
          .filter(([_, balance]) => options.verbose || parseFloat(balance) > 0)
          .sort(([a], [b]) => a.localeCompare(b));

        if (sortedBalances.length === 0) {
          console.log("No balances found.");
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
          console.log("\n💵 Fiat Currencies:");
          fiatAssets.forEach(([asset, balance]) => {
            const balanceNum = parseFloat(balance);
            console.log(`  ${asset.padEnd(8)} ${balanceNum.toFixed(2)}`);
          });
        }

        if (cryptoAssets.length > 0) {
          console.log("\n🪙 Cryptocurrencies:");
          cryptoAssets.forEach(([asset, balance]) => {
            const balanceNum = parseFloat(balance);
            console.log(`  ${asset.padEnd(8)} ${balanceNum.toFixed(8)}`);
          });
        }

        // Show total USD value if available
        const usdBalance = balances["ZUSD"] || balances["USD"] || "0";
        const usdNum = parseFloat(usdBalance);
        if (usdNum > 0) {
          console.log("\n💲 Total USD Available: $" + usdNum.toFixed(2));
        }
      }
    } catch (error) {
      console.error(
        "❌ Error fetching balances:",
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

// List command
program
  .command("list")
  .description("List available DCA configurations")
  .action(() => {
    console.log("📂 Available DCA configurations:");
    console.log("=".repeat(50));

    const configsDir = join(process.cwd(), "configs");
    if (existsSync(configsDir)) {
      try {
        const files = readdirSync(configsDir).filter((file) =>
          file.endsWith(".json")
        );
        if (files.length > 0) {
          files.forEach((file) => {
            console.log(`  configs/${file}`);
          });
        }
      } catch (error) {
        // Ignore errors reading directory
      }
    }
  });

// Run strategies command
program
  .command("dca")
  .description("Run DCA strategies")
  .argument(
    "[configs...]",
    "Paths to configuration files (if none provided, runs all available)"
  )
  .option("-v, --verbose", "Enable verbose output")
  .option("-p, --parallel", "Run strategies in parallel (default: true)")
  .option("-s, --sequential", "Run strategies sequentially")
  .action(
    async (
      configPaths: string[],
      options: { verbose?: boolean; parallel?: boolean; sequential?: boolean }
    ) => {
      // If no configs provided, use all available
      const configsToRun =
        configPaths.length > 0 ? configPaths : listAvailableConfigs();

      if (configsToRun.length === 0) {
        console.error("No configurations found");
        process.exit(1);
      }

      const runParallel = !options.sequential; // Default to parallel unless --sequential is specified

      if (options.verbose) {
        console.log(`[CLI] Starting ${configsToRun.length} DCA strategies...`);
        console.log(`[CLI] Mode: ${runParallel ? "parallel" : "sequential"}`);
        if (configPaths.length === 0) {
          console.log(
            `[CLI] No configs specified, running all available strategies`
          );
        }
      }

      if (runParallel) {
        // Run all strategies in parallel
        const processes = configsToRun.map((configPath) => {
          if (options.verbose) {
            console.log(`[CLI] Starting strategy: ${configPath}`);
          }

          return new Promise<void>((resolve, reject) => {
            const child = spawn("bun", ["run", "src/dca.ts", configPath], {
              stdio: "inherit",
              cwd: process.cwd(),
            });

            child.on("close", (code) => {
              if (code === 0) {
                if (options.verbose) {
                  console.log(
                    `[CLI] Strategy ${configPath} completed successfully`
                  );
                }
                resolve();
              } else {
                console.error(
                  `[CLI] Strategy ${configPath} failed with code ${code}`
                );
                reject(
                  new Error(`Strategy ${configPath} failed with code ${code}`)
                );
              }
            });

            child.on("error", (error) => {
              console.error(
                `[CLI] Failed to start strategy ${configPath}:`,
                error
              );
              reject(error);
            });
          });
        });

        try {
          await Promise.all(processes);
          if (options.verbose) {
            console.log("[CLI] All strategies completed successfully");
          }
        } catch (error) {
          console.error("[CLI] Some strategies failed:", error);
          process.exit(1);
        }
      } else {
        // Run strategies sequentially
        for (const configPath of configsToRun) {
          if (options.verbose) {
            console.log(`[CLI] Starting strategy: ${configPath}`);
          }

          try {
            await new Promise<void>((resolve, reject) => {
              const child = spawn("bun", ["run", "src/dca.ts", configPath], {
                stdio: "inherit",
                cwd: process.cwd(),
              });

              child.on("close", (code) => {
                if (code === 0) {
                  if (options.verbose) {
                    console.log(
                      `[CLI] Strategy ${configPath} completed successfully`
                    );
                  }
                  resolve();
                } else {
                  console.error(
                    `[CLI] Strategy ${configPath} failed with code ${code}`
                  );
                  reject(
                    new Error(`Strategy ${configPath} failed with code ${code}`)
                  );
                }
              });

              child.on("error", (error) => {
                console.error(
                  `[CLI] Failed to start strategy ${configPath}:`,
                  error
                );
                reject(error);
              });
            });
          } catch (error) {
            console.error(`[CLI] Strategy ${configPath} failed:`, error);
            if (options.verbose) {
              console.log("[CLI] Stopping execution due to strategy failure");
            }
            process.exit(1);
          }
        }

        if (options.verbose) {
          console.log("[CLI] All strategies completed successfully");
        }
      }
    }
  );

// Validate config command
program
  .command("validate")
  .description("Validate a configuration file without running it")
  .argument("<config>", "Path to the configuration file")
  .action((configPath: string) => {
    try {
      const { loadConfig } = require("./config.js");
      const config = loadConfig(configPath);
      console.log("✅ Configuration is valid!");
      console.log("");
      console.log("Configuration details:");
      console.log(`  Name: ${config.name}`);
      console.log(`  Description: ${config.description}`);
      console.log(`  Pair: ${config.dca.pair}`);
      console.log(`  Amount: $${config.dca.amount_usd}`);
      console.log(
        `  Schedule: ${config.schedule.cron} (${config.schedule.timezone})`
      );
      console.log(
        `  Notifications: ntfy.sh/${config.notifications.ntfy_topic}`
      );
    } catch (error) {
      console.error("❌ Configuration is invalid:");
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
