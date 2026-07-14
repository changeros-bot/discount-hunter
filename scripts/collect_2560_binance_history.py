#!/usr/bin/env python3
"""Build Binance-first 2560 history from the RWA K-line endpoint.

Price history is backfilled from Binance's RWA token K-line endpoint. That
endpoint currently returns OHLC but a reserved/zero volume field, so volume is
not fabricated. We append Binance dynamic stockInfo.volume only for the current
UTC day and let the volume archive mature naturally.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DIR = ROOT / "data" / "2560-binance-history"
UNIVERSE_PATH = ROOT / "config" / "2560-universe.json"
LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai"
DYNAMIC_URL = "https://www.binance.com/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/rwa/dynamic/ai"
KLINE_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/dex/market/token/kline/ai"
HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Encoding": "identity",
    "User-Agent": "discount-hunter-2560-binance-history/2.0",
    "clienttype": "web",
    "lang": "en",
    "Origin": "https://www.binance.com",
    "Referer": "https://www.binance.com/en/markets/overview/rwa",
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", default=str(DEFAULT_DIR))
    parser.add_argument("--limit", type=int, default=300)
    parser.add_argument("--sleep", type=float, default=0.08)
    return parser.parse_args()


def fetch_json(url: str, params: dict | None = None):
    if params:
        url = f"{url}?{urlencode(params)}"
    request = Request(url, headers=HEADERS)
    with urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf8"))
    if isinstance(payload, dict) and payload.get("success") is False:
        raise RuntimeError(payload)
    return payload


def as_array(value):
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        for key_path in (("data", "list"), ("data", "rows"), ("data",), ("list",), ("rows",)):
            node = value
            for key in key_path:
                if not isinstance(node, dict) or key not in node:
                    node = None
                    break
                node = node[key]
            if isinstance(node, list):
                return node
    return []


def symbol_of(item):
    return str(item.get("symbol") or item.get("ticker") or "").strip().upper()


def load_universe():
    payload = json.loads(UNIVERSE_PATH.read_text(encoding="utf8"))
    seen = set()
    tickers = []
    for item in payload.get("symbols", []):
        ticker = str(item.get("ticker", "")).strip().upper()
        if ticker and ticker not in seen and ticker != "BTC":
            seen.add(ticker)
            tickers.append(ticker)
    return tickers


def choose_metadata(items, ticker):
    candidates = [item for item in items if symbol_of(item) in {f"{ticker}ON", ticker}]
    if not candidates:
        return None
    # Binance exposes the same asset on multiple chains. Prefer BSC 56 because
    # it is the verified route used by the App examples, then Ethereum 1.
    priority = {"56": 0, "1": 1, "CT_501": 2}
    candidates.sort(key=lambda item: priority.get(str(item.get("chainId")), 99))
    return candidates[0]


def parse_kline(payload, multiplier):
    infos = payload.get("data", {}).get("klineInfos", []) if isinstance(payload, dict) else []
    rows = []
    divisor = multiplier if multiplier > 0 else 1.0
    for item in infos:
        if not isinstance(item, list) or len(item) < 7:
            continue
        opened = pd.to_datetime(int(item[0]), unit="ms", utc=True)
        rows.append({
            "Date": opened.strftime("%Y-%m-%d"),
            "Open": float(item[1]) / divisor,
            "High": float(item[2]) / divisor,
            "Low": float(item[3]) / divisor,
            "Close": float(item[4]) / divisor,
            "Volume": pd.NA,
            "KlineReservedVolume": float(item[5] or 0),
            "close_time_utc": pd.to_datetime(int(item[6]), unit="ms", utc=True).isoformat(),
            "price_source": "binance_rwa_kline_utc_1d",
            "volume_source": "unavailable_in_binance_kline",
        })
    return pd.DataFrame(rows)


def dynamic_fields(payload):
    root = payload.get("data", {}) if isinstance(payload, dict) else {}
    token = root.get("tokenInfo", {}) or {}
    stock = root.get("stockInfo", {}) or {}
    status = root.get("statusInfo", {}) or {}
    multiplier = float(token.get("sharesMultiplier") or 1)
    return {
        "multiplier": multiplier,
        "reference_volume": float(stock.get("volume") or 0),
        "token_volume_24h_usd": float(token.get("volume24h") or 0),
        "market_status": status.get("marketStatus"),
    }


def merge_history(path: Path, fresh: pd.DataFrame, meta: dict, token_symbol: str):
    if path.exists() and path.stat().st_size:
        current = pd.read_csv(path)
    else:
        current = pd.DataFrame()

    frame = pd.concat([current, fresh], ignore_index=True, sort=False)
    frame["Date"] = pd.to_datetime(frame["Date"], errors="coerce").dt.strftime("%Y-%m-%d")
    frame = frame.dropna(subset=["Date"])

    today = pd.Timestamp.utcnow().strftime("%Y-%m-%d")
    current_volume = meta.get("reference_volume", 0)
    if current_volume > 0:
        mask = frame["Date"] == today
        frame.loc[mask, "Volume"] = current_volume
        frame.loc[mask, "volume_source"] = "binance_dynamic_stockInfo.volume"

    frame["binance_symbol"] = token_symbol
    frame["shares_multiplier"] = meta.get("multiplier", 1)
    frame.loc[frame["Date"] == today, "token_volume_24h_usd"] = meta.get("token_volume_24h_usd", 0)
    frame.loc[frame["Date"] == today, "market_status"] = meta.get("market_status")
    frame["collected_at_utc"] = pd.Timestamp.utcnow().isoformat()

    frame = frame.sort_values(["Date", "collected_at_utc"]).drop_duplicates(subset=["Date"], keep="last")
    numeric = ["Open", "High", "Low", "Close", "Volume"]
    for column in numeric:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame.to_csv(path, index=False)
    return {
        "price_days": int(frame["Close"].notna().sum()),
        "volume_days": int((frame["Volume"].fillna(0) > 0).sum()),
    }


def main():
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    token_list = as_array(fetch_json(LIST_URL, {"type": 1}))
    status = {}
    pending = []

    for ticker in load_universe():
        meta_item = choose_metadata(token_list, ticker)
        if not meta_item:
            pending.append({"ticker": ticker, "reason": "BINANCE_RWA_SYMBOL_NOT_FOUND"})
            continue
        chain_id = meta_item.get("chainId")
        contract = meta_item.get("contractAddress")
        token_symbol = symbol_of(meta_item)
        if not chain_id or not contract:
            pending.append({"ticker": ticker, "reason": "BINANCE_RWA_IDENTIFIER_MISSING"})
            continue
        try:
            dynamic = fetch_json(DYNAMIC_URL, {"chainId": chain_id, "contractAddress": contract})
            fields = dynamic_fields(dynamic)
            kline = fetch_json(KLINE_URL, {
                "chainId": chain_id,
                "contractAddress": contract,
                "interval": "1d",
                "limit": min(max(args.limit, 1), 300),
            })
            fresh = parse_kline(kline, fields["multiplier"])
            if fresh.empty:
                raise RuntimeError("BINANCE_KLINE_EMPTY")
            counts = merge_history(output_dir / f"{ticker}.csv", fresh, fields, token_symbol)
            status[ticker] = {
                **counts,
                "binance_symbol": token_symbol,
                "chain_id": chain_id,
                "contract_address": contract,
                "market_status": fields.get("market_status"),
            }
        except Exception as error:  # noqa: BLE001
            pending.append({"ticker": ticker, "token_symbol": token_symbol, "reason": str(error)})
        time.sleep(args.sleep)

    full_ready = sorted([t for t, c in status.items() if c["price_days"] >= 60 and c["volume_days"] >= 60])
    price_ready_volume_pending = sorted([t for t, c in status.items() if c["price_days"] >= 60 and c["volume_days"] < 60])
    manifest = {
        "source": "binance_rwa_kline_utc_1d + binance_dynamic_stockInfo.volume",
        "collected_at_utc": pd.Timestamp.utcnow().isoformat(),
        "available_count": len(status),
        "pending_count": len(pending),
        "history_by_ticker": status,
        "full_2560_ready": full_ready,
        "price_ready_volume_pending": price_ready_volume_pending,
        "pending": pending,
        "limitations": [
            "Binance RWA 1d bars use UTC day boundaries, not US regular-session boundaries.",
            "The K-line reserved volume field is zero; volume is accumulated from Binance dynamic stockInfo.volume only from collection day onward.",
            "Corporate-action back-adjustment is not documented and remains unverified.",
        ],
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf8")
    print(json.dumps(manifest, ensure_ascii=False))


if __name__ == "__main__":
    main()
