// kraken-dca.ts
// Bun + TS script to DCA-buy cryptocurrency on Kraken with configurable strategies and ntfy.sh notifications.

import cron from "node-cron";
import {
  loadConfig,
  loadKrakenConfig,
  loadNotificationConfig,
  listAvailableConfigs,
  type NotificationConfig,
} from "@src/config";
import type { DCAStrategyConfig } from "@src/tasks/dca.types";
import type { KrakenConfig } from "@src/domain/kraken.types";
import { getBalance, placeMarketBuy, queryOrders } from "@src/domain/kraken";
import { sendNotification } from "@src/domain/notify";
import { createLogger } from "@src/logger";

const logger = createLogger("dca");

// Parse command line arguments
const args = process.argv.slice(2);
const configPath = args[0];

if (!configPath) {
  logger.error("No config file provided");
  process.exit(1);
}

// Load configuration
let config: DCAStrategyConfig;
let krakenConfig: KrakenConfig;
let notificationConfig: NotificationConfig;

try {
  config = loadConfig(configPath);
  krakenConfig = loadKrakenConfig();
  notificationConfig = loadNotificationConfig();
} catch (error) {
  logger.error({ error }, "Configuration error");
  process.exit(1);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Poll until order closed (market orders should close quickly, but we'll still confirm)
async function waitUntilClosed(
  config: KrakenConfig,
  txid: string,
  timeoutMs = 30_000
): Promise<any | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const q = await queryOrders(config, [txid]);
    const info = q[txid];
    if (info && info.status === "closed") return info;
    await sleep(1500);
  }
  return null;
}

// ---------- Main job ----------
async function runDCAOnce() {
  try {
    logger.info({ currency: config.dca.currency }, "Checking balance");
    const balance = await getBalance(krakenConfig, config.dca.currency);
    logger.info(
      { currency: config.dca.currency, balance },
      "Balance retrieved"
    );

    if (
      balance < config.dca.low_balance_threshold ||
      balance < config.dca.amount
    ) {
      const msg = `
• Balance: ${balance.toFixed(2)} ${config.dca.currency}
• Required: ${config.dca.amount.toFixed(2)} ${config.dca.currency}
• Threshold: ${config.dca.low_balance_threshold.toFixed(2)} ${
        config.dca.currency
      }

No order was placed.`;
      await sendNotification(notificationConfig, {
        title: `Kraken DCA: Low ${config.dca.currency} balance`,
        message: msg,
      });
      logger.warn(
        {
          currency: config.dca.currency,
          balance,
          threshold: config.dca.low_balance_threshold,
        },
        "Low balance - skipping order"
      );
      return;
    }

    logger.info(
      {
        amount: config.dca.amount,
        currency: config.dca.currency,
        pair: config.dca.pair,
      },
      "Placing market buy order"
    );
    const placed = await placeMarketBuy(
      krakenConfig,
      config.dca.pair,
      config.dca.amount,
      config.dca.currency
    );
    const txid = placed.txid[0];
    logger.info({ txid }, "Order accepted, waiting for fill");

    const closed = await waitUntilClosed(krakenConfig, txid ?? "");
    const status = closed?.status ?? "unknown";
    const price = closed?.price ? Number(closed.price) : undefined;
    const vol = closed?.vol_exec ? Number(closed.vol_exec) : undefined;
    const cost = closed?.cost ? Number(closed.cost) : undefined;
    const fee = closed?.fee ? Number(closed.fee) : undefined;

    const summaryMsg = `
• Pair: ${config.dca.pair}
• Spent (target): ${config.dca.amount.toFixed(2)} ${
      config.dca.currency
    } (via oflags=viqc)
• Status: ${status}
• txid: ${txid}
• Order: ${placed.descr.order}
${price ? `• Avg price: ${price.toFixed(2)} ${config.dca.currency}\n` : ""}${
      vol ? `• Filled: ${vol}\n` : ""
    }${cost ? `• Cost: ${cost.toFixed(2)} ${config.dca.currency}\n` : ""}${
      fee ? `• Fee: ${fee.toFixed(2)} ${config.dca.currency}` : ""
    }`;

    await sendNotification(notificationConfig, {
      title: "Kraken DCA: Purchase complete",
      message: summaryMsg,
    });
    logger.info("Notification sent");
  } catch (err: any) {
    logger.error({ error: err?.message || err }, "DCA execution error");
    const errorMsg = `${String(err?.stack || err)}`;
    await sendNotification(notificationConfig, {
      title: "Kraken DCA: Error",
      message: errorMsg,
    });
  }
}

// ---------- Scheduling ----------
// Run once on startup, then by CRON schedule.
(async () => {
  logger.info(
    {
      strategy: config.name,
      description: config.description,
      pair: config.dca.pair,
      amount: config.dca.amount,
      currency: config.dca.currency,
      threshold: config.dca.low_balance_threshold,
      schedule: config.schedule.cron,
      timezone: config.schedule.timezone,
      notifications: notificationConfig.ntfy_topic,
    },
    "Starting DCA with configuration"
  );

  logger.info("Running initial DCA check");

  await runDCAOnce();

  cron.schedule(
    config.schedule.cron,
    async () => {
      logger.info({ timestamp: new Date().toISOString() }, "Triggered by cron");
      await runDCAOnce();
    },
    { timezone: config.schedule.timezone }
  );

  logger.info("Scheduler set, script will keep running");
})();
