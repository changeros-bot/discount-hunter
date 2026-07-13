#!/usr/bin/env python3
"""Run the ratified 2560 paper engine against the unified deduplicated registry.

The scanner remains a scheduled data worker. After each run it can publish the
complete paper snapshot to the production API, which persists it in Upstash KV.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

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


def csv_records(path: Path):
    if not path.exists() or path.stat().st_size == 0:
        return []
    frame = pd.read_csv(path).fillna("")
    return frame.to_dict(orient="records")


def build_snapshot(output_dir: Path, registry_payload, symbols):
    audit_path = output_dir / "2560_last_scan.json"
    last_scan = json.loads(audit_path.read_text(encoding="utf8")) if audit_path.exists() else {}
    open_rows = csv_records(output_dir / "2560_open_positions.csv")
    closed_rows = csv_records(output_dir / "2560_closed_trades.csv")
    trades = csv_records(output_dir / "2560_paper_trades.csv")
    summary_rows = csv_records(output_dir / "2560_paper_summary.csv")

    profiles = []
    for item in symbols:
        profiles.append({
            **item,
            "trait": f"{item.get('name', item['ticker'])}｜{item.get('group', '未分類')}",
            "strategy": (
                "納入 2560 紙上掃描；等待價格 5/25 與量能 5/60 完整觸發"
                if item.get("scan_enabled") and item.get("data_symbol")
                else "已列入紙上交易母池；等待支援的市場資料來源"
            ),
        })

    pending = [row for row in open_rows if str(row.get("status", "")) == "PENDING"]
    opened = [row for row in open_rows if str(row.get("status", "")) == "OPEN"]
    summary = {
        "version": "1.0",
        "constitutionStatus": "RATIFIED",
        "engineVersion": last_scan.get("engine_version", "2560-v1.0-ratified"),
        "registryVersion": registry_payload.get("version"),
        "universeCount": len(symbols),
        "scanEnabledCount": sum(1 for x in symbols if x.get("scan_enabled") and x.get("data_symbol")),
        "dataPendingCount": sum(1 for x in symbols if not x.get("scan_enabled") or not x.get("data_symbol")),
        "universeProfiles": profiles,
        "open": len(opened),
        "pending": len(pending),
        "closed": len(closed_rows),
        "rawSummary": summary_rows[0] if summary_rows else None,
        "source": "github_actions_market_worker",
        "storageMode": "upstash_kv",
    }
    return {
        "registryVersion": registry_payload.get("version"),
        "lastScan": last_scan,
        "trades": trades,
        "open": opened,
        "pending": pending,
        "closed": closed_rows,
        "summary": summary,
    }


def publish_snapshot(snapshot):
    token = str(os.getenv("INGEST_TOKEN_2560", "")).strip()
    base_url = str(os.getenv("CANONICAL_BASE_URL_2560", "https://discount-hunter-sigma.vercel.app")).rstrip("/")
    if not token:
        print("2560 ingest skipped: INGEST_TOKEN_2560 is not configured")
        return {"published": False, "reason": "missing_ingest_token"}

    payload = json.dumps(snapshot, ensure_ascii=False).encode("utf8")
    request = Request(
        f"{base_url}/api/2560/ingest",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "discount-hunter-2560-worker/1.0",
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            body = json.loads(response.read().decode("utf8"))
            if not body.get("ok"):
                raise RuntimeError(f"2560 ingest rejected: {body}")
            print(f"2560 snapshot published: {body.get('storage', {}).get('mode', 'unknown')}")
            return {"published": True, "response": body}
    except HTTPError as exc:
        detail = exc.read().decode("utf8", errors="replace")[:500]
        raise RuntimeError(f"2560 ingest HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"2560 ingest network error: {exc.reason}") from exc


def main():
    payload, symbols = load_registry()
    enabled = install_registry(symbols)
    args = engine.parse_args()
    engine.run(args)

    output_dir = Path(args.output_dir)
    audit_path = output_dir / "2560_last_scan.json"
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

    snapshot = build_snapshot(output_dir, payload, symbols)
    publish_snapshot(snapshot)


if __name__ == "__main__":
    main()
