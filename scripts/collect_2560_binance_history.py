#!/usr/bin/env python3
"""Collect Binance-provided 24h RWA snapshots into per-ticker CSV archives.

This deliberately does not fabricate older history. The archive becomes eligible
for full 2560 calculation only after it contains enough distinct daily rows.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DIR = ROOT / "data" / "2560-binance-history"


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=os.getenv("CANONICAL_BASE_URL_2560", "https://discount-hunter-sigma.vercel.app"))
    parser.add_argument("--output-dir", default=str(DEFAULT_DIR))
    return parser.parse_args()


def fetch_snapshot(base_url: str):
    request = Request(
        f"{base_url.rstrip('/')}/api/2560/binance-daily-snapshot",
        headers={"User-Agent": "discount-hunter-2560-binance-history/1.0"},
    )
    with urlopen(request, timeout=90) as response:
        payload = json.loads(response.read().decode("utf8"))
    if not payload.get("ok"):
        raise RuntimeError(payload)
    return payload


def normalize_row(row):
    return {
        "Date": row.get("date_utc"),
        "Open": row.get("open"),
        "High": row.get("high"),
        "Low": row.get("low"),
        "Close": row.get("close"),
        "Volume": row.get("volume"),
        "binance_symbol": row.get("binance_symbol"),
        "source": row.get("source"),
        "audit_status": row.get("audit_status"),
        "collected_at_utc": pd.Timestamp.utcnow().isoformat(),
    }


def upsert_csv(path: Path, row):
    incoming = pd.DataFrame([normalize_row(row)])
    if path.exists() and path.stat().st_size:
        current = pd.read_csv(path)
        frame = pd.concat([current, incoming], ignore_index=True)
    else:
        frame = incoming
    frame["Date"] = pd.to_datetime(frame["Date"], errors="coerce").dt.strftime("%Y-%m-%d")
    frame = frame.dropna(subset=["Date"]).sort_values(["Date", "collected_at_utc"])
    frame = frame.drop_duplicates(subset=["Date"], keep="last")
    frame.to_csv(path, index=False)
    return len(frame)


def main():
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    payload = fetch_snapshot(args.base_url)
    counts = {}
    for row in payload.get("rows", []):
        ticker = str(row.get("ticker", "")).strip().upper()
        if not ticker or row.get("audit_status") != "PASS":
            continue
        counts[ticker] = upsert_csv(output_dir / f"{ticker}.csv", row)

    manifest = {
        "source": payload.get("source"),
        "generated_at_utc": payload.get("generated_at_utc"),
        "collected_at_utc": pd.Timestamp.utcnow().isoformat(),
        "available_count": payload.get("available_count", 0),
        "pending_count": payload.get("pending_count", 0),
        "history_days_by_ticker": counts,
        "full_2560_ready": sorted([ticker for ticker, days in counts.items() if days >= 60]),
        "partial_price_ready": sorted([ticker for ticker, days in counts.items() if 25 <= days < 60]),
        "insufficient": sorted([ticker for ticker, days in counts.items() if days < 25]),
        "pending": payload.get("pending", []),
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf8")
    print(json.dumps(manifest, ensure_ascii=False))


if __name__ == "__main__":
    main()
