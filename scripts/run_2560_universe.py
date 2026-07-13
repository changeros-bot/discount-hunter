#!/usr/bin/env python3
"""Run the ratified 2560 paper engine against the unified deduplicated registry."""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

import paper_2560_bot as engine

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "config" / "2560-universe.json"


def load_registry():
    payload = json.loads(REGISTRY_PATH.read_text(encoding="utf8"))
    symbols = payload.get("symbols", [])
    seen = set()
    unique = []
    for item in symbols:
        ticker = str(item.get("ticker", "")).upper().strip()
        if not ticker or ticker in seen:
            continue
        seen.add(ticker)
        unique.append({**item, "ticker": ticker})
    return payload, unique


def install_registry(symbols):
    enabled = [item for item in symbols if item.get("scan_enabled") and item.get("data_symbol")]
    metadata = {item["ticker"]: item for item in enabled}

    engine.UNIVERSE = {
        item["ticker"]: item.get("group") or item.get("list") or "未分類"
        for item in enabled
    }

    def mapped_load_price(ticker, args):
        item = metadata[ticker]
        data_symbol = item.get("data_symbol") or ticker
        if args.source == "csv":
            primary = Path(args.data_dir) / f"{ticker}.csv"
            fallback = Path(args.data_dir) / f"{data_symbol}.csv"
            source = primary if primary.exists() else fallback
            return engine.clean(pd.read_csv(source))

        import yfinance as yf

        raw = yf.download(data_symbol, start=args.start, auto_adjust=True, progress=False)
        if raw.empty:
            raise ValueError(f"no data for {ticker} via {data_symbol}")
        return engine.clean(engine.flat(raw).reset_index())

    engine.load_price = mapped_load_price
    return enabled


def main():
    payload, symbols = load_registry()
    enabled = install_registry(symbols)
    args = engine.parse_args()
    engine.run(args)

    audit_path = Path(args.output_dir) / "2560_last_scan.json"
    if audit_path.exists():
        audit = json.loads(audit_path.read_text(encoding="utf8"))
        audit["registry_version"] = payload.get("version")
        audit["registry_count"] = len(symbols)
        audit["scan_enabled_count"] = len(enabled)
        audit["data_pending"] = [
            {
                "ticker": item["ticker"],
                "name": item.get("name", ""),
                "list": item.get("list", ""),
                "reason": "MARKET_DATA_SOURCE_PENDING",
            }
            for item in symbols
            if not item.get("scan_enabled") or not item.get("data_symbol")
        ]
        audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf8")


if __name__ == "__main__":
    main()
