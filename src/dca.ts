// kraken-dca.ts
// Bun + TS script to DCA-buy cryptocurrency on Kraken with configurable strategies and ntfy.sh notifications.

import cron from "node-cron";
import {
  loadConfig,
  loadKrakenConfig,
  listAvailableConfigs,
} from "@src/config";
import type { DCAStrategyConfig } from "@src/dca.types";
import type { KrakenConfig } from "@src/domain/kraken.types";
import { createKrakenAPI } from "@src/domain/kraken";
import { createNotificationService } from "@src/domain/notify";

// Parse command line arguments
const args = process.argv.slice(2);
const configPath = args[0];

if (!configPath) {
  console.error("Usage: bun run src/dca.ts <config-file.json>");
  console.error("");
  console.error("Available configs:");
  listAvailableConfigs().forEach((config) => {
    console.error(`  ${config}`);
  });
  console.error("");
  console.error("Example: bun run src/dca.ts configs/bitcoin-weekly.json");
  process.exit(1);
}

// Load configuration
let config: DCAStrategyConfig;
let krakenConfig: KrakenConfig;

try {
  config = loadConfig(configPath);
  krakenConfig = loadKrakenConfig();
} catch (error) {
  console.error(
    "Configuration error:",
    error instanceof Error ? error.message : error
  );
  process.exit(1);
}

// Initialize services
const krakenAPI = createKrakenAPI(krakenConfig);
const notificationService = createNotificationService(config.notifications);

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Poll until order closed (market orders should close quickly, but we'll still confirm)
async function waitUntilClosed(
  txid: string,
  timeoutMs = 30_000
): Promise<any | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const q = await krakenAPI.queryOrders([txid]);
    const info = q[txid];
    if (info && info.status === "closed") return info;
    await sleep(1500);
  }
  return null;
}

// ---------- Main job ----------
async function runDCAOnce() {
  try {
    console.log(`[DCA] Checking USD balance...`);
    const usd = await krakenAPI.getUsdBalance();
    console.log(`[DCA] USD balance: ${usd.toFixed(2)}`);

    if (
      usd < config.dca.low_balance_threshold_usd ||
      usd < config.dca.amount_usd
    ) {
      const msg = `Kraken USD balance is low.

• Balance: **$${usd.toFixed(2)}**
• Required (DCA_USD): **$${config.dca.amount_usd.toFixed(2)}**
• Threshold (LOW_BALANCE_THRESHOLD_USD): **$${config.dca.low_balance_threshold_usd.toFixed(
        2
      )}**

No order was placed.`;
      await notificationService.sendWarning(
        "Kraken DCA: Low USD balance",
        msg,
        ["kraken", "dca"]
      );
      console.warn("[DCA] Low balance – notification sent, skipping order.");
      return;
    }

    const tag = `DCA_${config.dca.pair}_${new Date()
      .toISOString()
      .slice(0, 10)}`;
    console.log(
      `[DCA] Placing market buy: $${config.dca.amount_usd} of ${config.dca.pair} ...`
    );
    const placed = await krakenAPI.placeMarketBuyUSD(
      config.dca.pair,
      config.dca.amount_usd,
      tag
    );
    const txid = placed.txid[0];
    console.log(`[DCA] Order accepted. txid=${txid}. Waiting for fill...`);

    const closed = await waitUntilClosed(txid ?? "");
    const status = closed?.status ?? "unknown";
    const price = closed?.price ? Number(closed.price) : undefined;
    const vol = closed?.vol_exec ? Number(closed.vol_exec) : undefined;
    const cost = closed?.cost ? Number(closed.cost) : undefined;
    const fee = closed?.fee ? Number(closed.fee) : undefined;

    const summaryMsg = `Kraken DCA market buy completed (or accepted):

• Pair: **${config.dca.pair}**
• Spent (target): **$${config.dca.amount_usd.toFixed(2)}** (via \`oflags=viqc\`)
• Status: **${status}**
• txid: \`${txid}\`
• Order: \`${placed.descr.order}\`
${price ? `• Avg price: **$${price.toFixed(2)}**\n` : ""}${
      vol ? `• Filled (BTC): **${vol}**\n` : ""
    }${cost ? `• Cost (USD): **$${cost.toFixed(2)}**\n` : ""}${
      fee ? `• Fee (USD): **$${fee.toFixed(2)}**` : ""
    }`;
    await notificationService.sendSuccess(
      "Kraken DCA: Purchase complete",
      summaryMsg,
      ["kraken", "dca"]
    );
    console.log("[DCA] Notification sent.");
  } catch (err: any) {
    console.error("[DCA] Error:", err?.message || err);
    const errorMsg = `Kraken DCA Error:

\`\`\`
${String(err?.stack || err)}
\`\`\``;
    await notificationService.sendError("Kraken DCA: Error", errorMsg, [
      "kraken",
      "dca",
    ]);
  }
}

// ---------- Scheduling ----------
// Run once on startup, then by CRON schedule.
(async () => {
  console.log(`[DCA] Starting with configuration:`);
  console.log(`  • Strategy: ${config.name}`);
  console.log(`  • Description: ${config.description}`);
  console.log(`  • Pair: ${config.dca.pair}`);
  console.log(`  • DCA Amount: $${config.dca.amount_usd.toFixed(2)}`);
  console.log(
    `  • Low Balance Threshold: $${config.dca.low_balance_threshold_usd.toFixed(
      2
    )}`
  );
  console.log(
    `  • Schedule: ${config.schedule.cron} (${config.schedule.timezone})`
  );
  console.log(`  • Notifications: ntfy.sh/${config.notifications.ntfy_topic}`);
  console.log(`[DCA] Running initial DCA check...`);

  await runDCAOnce();

  cron.schedule(
    config.schedule.cron,
    async () => {
      console.log(`[DCA] Triggered by cron at ${new Date().toISOString()}`);
      await runDCAOnce();
    },
    { timezone: config.schedule.timezone }
  );

  console.log("[DCA] Scheduler set. Script will keep running…");
})();
