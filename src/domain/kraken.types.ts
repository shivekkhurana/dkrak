export interface KrakenConfig {
  api_key: string;
  api_secret: string;
  api_url?: string;
}

export interface KrakenResult<T> {
  error: string[];
  result: T;
}

export interface KrakenBalances {
  [key: string]: string;
}

export interface KrakenOrderResult {
  descr: { order: string };
  txid: string[];
}

export interface KrakenOrderInfo {
  status: "pending" | "open" | "closed" | "canceled" | string;
  vol_exec?: string; // executed volume (base currency)
  cost?: string; // total cost (quote currency)
  fee?: string; // total fee paid (quote currency)
  price?: string; // average price
  descr?: { order: string };
  closetm?: number;
  opentm?: number;
}

export interface KrakenQueryOrdersResult {
  [key: string]: KrakenOrderInfo;
}
