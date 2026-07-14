#!/usr/bin/env python3
"""Run the ratified 2560 paper engine against the unified registry.

Hybrid mode uses Binance RWA OHLC as the price source and Yahoo only for the
underlying stock's historical daily volume. It never substitutes Yahoo OHLC.
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
BINANCE_HISTORY_DIR = ROOT / "data" / "2560-binance-history"
HYBRID_DATA_DIR_SENTINEL = "hybrid"
HYBRID_SOURCE_LABEL = "binance_rwa_ohlc+yahoo_underlying_volume"


def load_registry():
    payload = json.loads(REGISTRY_PATH.read_text(encoding="utf8"))
    seen = set()
    unique = []
    for item in payload.get("symbols", []):
        ticker = str(item.get("ticker", "")).upper().strip()
        if not ticker or ticker in seen:
            continue
        seen.add(ticker)
        unique.append({**item, "ticker": ticker})
    return payload, unique


def merge_binance_price_with_underlying_volume(ticker: str, data_symbol: str, start: str):
    price_path = BINANCE_HISTORY_DIR / f"{ticker}.csv"
    if not price_path.exists() or price_path.stat().st_size == 0:
        raise ValueError(f"BINANCE_PRICE_HISTORY_PENDING:{ticker}:file_missing")

    price = pd.read_csv(price_path)
    required = {"Date", "Open", "High", "Low", "Close"}
    if not required.issubset(price.columns):
        raise ValueError(f"BINANCE_PRICE_HISTORY_INVALID:{ticker}:missing_ohlc")
    price = price[["Date", "Open", "High", "Low", "Close"]].copy()
    price["Date"] = pd.to_datetime(price["Date"], utc=True, errors="coerce").dt.tz_convert(None).dt.normalize()
    for column in ["Open", "High", "Low", "Close"]:
        price[column] = pd.to_numeric(price[column], errors="coerce")
    price = price.dropna().drop_duplicates("Date", keep="last")

    import yfinance as yf

    raw_volume = yf.download(data_symbol, start=start, auto_adjust=False, progress=False)
    if raw_volume.empty:
        raise ValueError(f"UNDERLYING_VOLUME_MISSING:{ticker}:{data_symbol}")
    raw_volume = engine.flat(raw_volume).reset_index()
    cols = {str(c).lower().strip().replace(" ", "_"): c for c in raw_volume.columns}
    date_col = cols.get("date") or cols.get("datetime")
    volume_col = cols.get("volume")
    if date_col is None or volume_col is None:
        raise ValueError(f"UNDERLYING_VOLUME_INVALID:{ticker}:{data_symbol}")
    volume = pd.DataFrame({
        "Date": pd.to_datetime(raw_volume[date_col], utc=True, errors="coerce").dt.tz_convert(None).dt.normalize(),
        "Volume": pd.to_numeric(raw_volume[volume_col], errors="coerce"),
    }).dropna()
    volume = volume[volume.Volume > 0].drop_duplicates("Date", keep="last")

    merged = price.merge(volume, on="Date", how="inner").sort_values("Date")
    if len(merged) < 60:
        raise ValueError(f"HYBRID_HISTORY_PENDING:{ticker}:matched_days={len(merged)}/60")
    return engine.clean(merged.reset_index(drop=True))


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
        hybrid_mode = args.source == "csv" and str(args.data_dir).strip().lower() == HYBRID_DATA_DIR_SENTINEL

        if hybrid_mode:
            # BTC has no RWA token file. Keep its existing market feed separate
            # until Binance Spot historical klines are added to this worker.
            if ticker == "BTC":
                import yfinance as yf
                raw = yf.download(data_symbol, start=args.start, auto_adjust=True, progress=False)
                if raw.empty:
                    raise ValueError("BTC_HISTORY_MISSING")
                return engine.clean(engine.flat(raw).reset_index())
            return merge_binance_price_with_underlying_volume(ticker, data_symbol, args.start)

        if args.source == "csv":
            primary = Path(args.data_dir) / f"{ticker}.csv"
            fallback = Path(args.data_dir) / f"{data_symbol}.csv"
            source = primary if primary.exists() else fallback
            if not source.exists():
                raise ValueError(f"csv missing: {ticker}")
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
    return pd.read_csv(path).fillna("").to_dict(orient="records")


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

    request = Request(
        f"{base_url}/api/2560/ingest",
        data=json.dumps(snapshot, ensure_ascii=False).encode("utf8"),
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
    hybrid_mode = args.source == "csv" and str(args.data_dir).strip().lower() == HYBRID_DATA_DIR_SENTINEL
    engine.run(args)

    output_dir = Path(args.output_dir)
    audit_path = output_dir / "2560_last_scan.json"
    if audit_path.exists():
        audit = json.loads(audit_path.read_text(encoding="utf8"))
        audit["registry_version"] = payload.get("version")
        audit["registry_count"] = len(symbols)
        audit["scan_enabled_count"] = len(enabled)
        audit["data_pending"] = [
            {"ticker": item["ticker"], "name": item.get("name", ""), "list": item.get("list", ""), "reason": "MARKET_DATA_SOURCE_PENDING"}
            for item in symbols
            if not item.get("scan_enabled") or not item.get("data_symbol")
        ]
        if hybrid_mode:
            audit["source"] = HYBRID_SOURCE_LABEL
            audit["source_detail"] = {
                "price_ohlc": "Binance RWA UTC 1d K-line divided by sharesMultiplier",
                "volume": "Yahoo Finance underlying daily share volume",
                "btc_exception": "BTC currently uses its existing BTC-USD feed until Binance Spot history is added",
            }
            pending_errors = [x for x in audit.get("errors", []) if any(tag in str(x.get("error", "")) for tag in ["BINANCE_PRICE_HISTORY_PENDING", "HYBRID_HISTORY_PENDING"])]
            audit["hybrid_history_pending"] = pending_errors
            audit["errors"] = [x for x in audit.get("errors", []) if x not in pending_errors]
            audit["error_count"] = len(audit["errors"])
            audit["ok"] = audit["error_count"] == 0
        audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf8")

    publish_snapshot(build_snapshot(output_dir, payload, symbols))


if __name__ == "__main__":
    main()
