import crypto from "crypto";
import type { 
  KrakenConfig, 
  KrakenResult, 
  KrakenBalances, 
  KrakenOrderResult, 
  KrakenQueryOrdersResult 
} from "@src/domain/kraken.types";

export class KrakenAPI {
  private config: KrakenConfig;

  constructor(config: KrakenConfig) {
    this.config = config;
  }

  private encodeBody(params: Record<string, string>): string {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) usp.append(k, v);
    return usp.toString();
  }

  private sign(path: string, nonce: string, postBody: string): string {
    const secret = Buffer.from(this.config.api_secret, "base64");
    const hash = crypto.createHash("sha256").update(nonce + postBody).digest();
    const hmac = crypto.createHmac("sha512", secret).update(path).update(hash).digest("base64");
    return hmac;
  }

  private async privateRequest<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const path = `/0/private/${endpoint}`;
    const nonce = String(Date.now() * 1000); // microseconds to be safe
    const body = this.encodeBody({ nonce, ...params });
    const headers = {
      "API-Key": this.config.api_key,
      "API-Sign": this.sign(path, nonce, body),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "bun/kraken-dca",
    };

    const res = await fetch(`${this.config.api_url}${path}`, { method: "POST", headers, body });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Kraken HTTP ${res.status}: ${text}`);
    }
    const json = (await res.json()) as KrakenResult<T>;
    if (json.error && json.error.length) {
      throw new Error(`Kraken error: ${json.error.join("; ")}`);
    }
    return json.result;
  }

  // Get all balances
  async getBalances(): Promise<KrakenBalances> {
    return this.privateRequest<KrakenBalances>("Balance");
  }

  // Get USD balance specifically
  async getUsdBalance(): Promise<number> {
    const balances = await this.getBalances();
    const usdStr = balances["ZUSD"] ?? balances["USD"] ?? "0";
    return parseFloat(usdStr);
  }

  // Place a market buy order
  async placeMarketBuyUSD(pair: string, usdAmount: number, userref?: string): Promise<KrakenOrderResult> {
    const params: Record<string, string> = {
      pair: pair,
      type: "buy",
      ordertype: "market",
      volume: usdAmount.toString(),
      oflags: "viqc", // volume is in quote currency (USD)
    };
    if (userref) params.userref = userref;

    return this.privateRequest<KrakenOrderResult>("AddOrder", params);
  }

  // Query order status
  async queryOrders(txids: string[]): Promise<KrakenQueryOrdersResult> {
    return this.privateRequest<KrakenQueryOrdersResult>("QueryOrders", {
      txid: txids.join(","),
    });
  }
}

// Factory function to create KrakenAPI instance
export function createKrakenAPI(config: KrakenConfig): KrakenAPI {
  return new KrakenAPI(config);
}
