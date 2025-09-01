import crypto from "crypto";
import type {
  KrakenConfig,
  KrakenResult,
  KrakenBalances,
  KrakenOrderResult,
  KrakenQueryOrdersResult,
} from "@src/domain/kraken.types";
import { createLogger } from "@src/logger";

const logger = createLogger("kraken");

// Helper functions
function encodeBody(params: Record<string, string>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) usp.append(k, v);
  return usp.toString();
}

function sign(
  config: KrakenConfig,
  path: string,
  nonce: string,
  postBody: string
): string {
  const secret = Buffer.from(config.api_secret, "base64");
  const hash = crypto
    .createHash("sha256")
    .update(nonce + postBody)
    .digest();
  const hmac = crypto
    .createHmac("sha512", secret)
    .update(path)
    .update(hash)
    .digest("base64");
  return hmac;
}

async function privateRequest<T>(
  config: KrakenConfig,
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const path = `/0/private/${endpoint}`;
  const nonce = String(Date.now() * 1000); // microseconds to be safe
  const body = encodeBody({ nonce, ...params });
  const headers = {
    "API-Key": config.api_key,
    "API-Sign": sign(config, path, nonce, body),
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "bun/kraken-dca",
  };

  const res = await fetch(`${config.api_url}${path}`, {
    method: "POST",
    headers,
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, text }, "Kraken HTTP error");
    throw new Error(`Kraken HTTP ${res.status}: ${text}`);
  }
  const json = (await res.json()) as KrakenResult<T>;
  if (json.error && json.error.length) {
    logger.error({ errors: json.error }, "Kraken API error");
    throw new Error(`Kraken error: ${json.error.join("; ")}`);
  }
  logger.debug({ endpoint }, "Kraken API call successful");
  return json.result;
}

// Public API functions
export async function getBalances(
  config: KrakenConfig
): Promise<KrakenBalances> {
  return privateRequest<KrakenBalances>(config, "Balance");
}

export async function getBalance(
  config: KrakenConfig,
  currency: string
): Promise<number> {
  const balances = await getBalances(config);
  // Handle different currency formats (ZUSD, USD, ZEUR, EUR, etc.)
  const balanceStr = balances[`Z${currency}`] ?? balances[currency] ?? "0";
  return parseFloat(balanceStr);
}

export async function getUsdBalance(config: KrakenConfig): Promise<number> {
  return getBalance(config, "USD");
}

export async function placeMarketBuy(
  config: KrakenConfig,
  pair: string,
  amount: number,
  currency: string,
  userref?: string
): Promise<KrakenOrderResult> {
  const params: Record<string, string> = {
    pair: pair,
    type: "buy",
    ordertype: "market",
    volume: amount.toString(),
    oflags: "viqc", // volume is in quote currency
  };
  if (userref) params.userref = userref;

  return privateRequest<KrakenOrderResult>(config, "AddOrder", params);
}

export async function placeMarketBuyUSD(
  config: KrakenConfig,
  pair: string,
  usdAmount: number,
  userref?: string
): Promise<KrakenOrderResult> {
  return placeMarketBuy(config, pair, usdAmount, "USD", userref);
}

export async function queryOrders(
  config: KrakenConfig,
  txids: string[]
): Promise<KrakenQueryOrdersResult> {
  return privateRequest<KrakenQueryOrdersResult>(config, "QueryOrders", {
    txid: txids.join(","),
  });
}
