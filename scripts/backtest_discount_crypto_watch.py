#!/usr/bin/env python3
"""Discount Hunter crypto watch backtest. Research only; no trading, no alerts."""
from __future__ import annotations

import argparse, math
from pathlib import Path
from typing import Optional, Sequence

try:
    import pandas as pd
except ImportError as exc:
    raise SystemExit("pandas is required") from exc

LAYERS = (-0.50, -0.65, -0.80, -0.90)
WINDOWS = (7, 14, 30, 60, 90)
DEFAULT_TICKERS = ("MUSDT", "BPUSDT")


def clean_price_df(df: pd.DataFrame, ticker: str) -> pd.DataFrame:
    cols = {str(c).lower().strip().replace(" ", "_"): c for c in df.columns}
    date_col = cols.get("date") or cols.get("timeopen") or cols.get("time_open") or cols.get("timestamp")
    close_col = cols.get("close") or cols.get("price")
    if date_col is None or close_col is None:
        raise ValueError(f"{ticker}: CSV must contain date/timeOpen and close")
    out = pd.DataFrame({
        "date": pd.to_datetime(df[date_col]).dt.tz_localize(None),
        "open": pd.to_numeric(df[cols.get("open", close_col)], errors="coerce"),
        "high": pd.to_numeric(df[cols.get("high", close_col)], errors="coerce"),
        "low": pd.to_numeric(df[cols.get("low", close_col)], errors="coerce"),
        "close": pd.to_numeric(df[close_col], errors="coerce"),
        "volume": pd.to_numeric(df[cols.get("volume", close_col)], errors="coerce"),
    }).dropna(subset=["date", "close"]).sort_values("date").drop_duplicates("date")
    out["ticker"] = ticker
    return out.reset_index(drop=True)


def load_csv(ticker: str, data_dir: Path) -> pd.DataFrame:
    candidates = [data_dir / f"{ticker}.csv", data_dir / f"{ticker.upper()}.csv", data_dir / f"{ticker.lower()}.csv"]
    path = next((p for p in candidates if p.exists()), None)
    if path is None:
        raise FileNotFoundError(f"{ticker}: DATA_PENDING. Missing CSV in {data_dir}")
    try:
        df = pd.read_csv(path)
        if len(df.columns) == 1 and ";" in str(df.columns[0]):
            df = pd.read_csv(path, sep=";")
    except UnicodeDecodeError:
        df = pd.read_csv(path, encoding="utf-8-sig")
    return clean_price_df(df, ticker)


def add_drawdown(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["reference_high"] = out["close"].cummax()
    out["drawdown"] = out["close"] / out["reference_high"] - 1.0
    return out


def layer_name(i: int) -> str:
    return f"L{i + 1}"


def find_events(df: pd.DataFrame, layers=LAYERS) -> pd.DataFrame:
    events = []
    triggered = {layer: False for layer in layers}
    last_high = None
    for i, row in df.iterrows():
        high = float(row["reference_high"])
        dd = float(row["drawdown"])
        if last_high is None or high > last_high:
            triggered = {layer: False for layer in layers}
            last_high = high
        if dd > -0.20:
            triggered = {layer: False for layer in layers}
        for li, layer in enumerate(layers):
            if dd <= layer and not triggered[layer]:
                triggered[layer] = True
                event = {
                    "ticker": row["ticker"],
                    "date": row["date"],
                    "layer": layer_name(li),
                    "threshold": layer,
                    "close": float(row["close"]),
                    "reference_high": high,
                    "drawdown": dd,
                    "data_status": "OK",
                    "research_status": "CRYPTO_WATCH_ONLY",
                }
                for w in WINDOWS:
                    idx = i + w
                    event[f"ret_{w}d"] = float(df.iloc[idx]["close"]) / float(row["close"]) - 1.0 if idx < len(df) else math.nan
                future = df.iloc[i:min(i + 90, len(df))]
                event["max_adverse_90d"] = future["close"].min() / float(row["close"]) - 1.0 if len(future) else math.nan
                events.append(event)
    return pd.DataFrame(events)


def summarize(events: pd.DataFrame) -> pd.DataFrame:
    if events.empty:
        return pd.DataFrame()
    rows = []
    for keys, g in events.groupby(["ticker", "layer"], dropna=False):
        ticker, layer = keys
        row = {
            "ticker": ticker,
            "layer": layer,
            "events": len(g),
            "avg_drawdown_at_trigger": g["drawdown"].mean(),
            "avg_max_adverse_90d": g["max_adverse_90d"].mean(),
        }
        for w in WINDOWS:
            col = f"ret_{w}d"
            row[f"avg_{col}"] = g[col].mean()
            row[f"win_rate_{col}"] = (g[col] > 0).mean()
        rows.append(row)
    return pd.DataFrame(rows).sort_values(["ticker", "layer"])


def fmt_pct(x):
    if pd.isna(x):
        return ""
    return f"{x:.2%}"


def save(events: pd.DataFrame, summary: pd.DataFrame, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    e = events.copy()
    s = summary.copy()
    for frame in (e, s):
        for col in frame.columns:
            if col.startswith("ret_") or col.startswith("avg_ret_") or col.startswith("win_rate_") or col in {"threshold", "drawdown", "avg_drawdown_at_trigger", "avg_max_adverse_90d", "max_adverse_90d"}:
                frame[col] = frame[col].map(fmt_pct)
    e.to_csv(out / "discount_hunter_crypto_watch_events.csv", index=False)
    s.to_csv(out / "discount_hunter_crypto_watch_summary.csv", index=False)


def run(args):
    frames = []
    pending = []
    for raw in args.tickers:
        ticker = raw.upper().replace("/", "-")
        try:
            prices = load_csv(ticker, Path(args.data_dir))
            if len(prices) < args.min_rows:
                pending.append({"ticker": ticker, "data_status": "DATA_TOO_SHORT", "rows": len(prices)})
                continue
            frames.append(find_events(add_drawdown(prices)))
        except Exception as exc:
            pending.append({"ticker": ticker, "data_status": "DATA_PENDING", "error": str(exc)})
    events = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    summary = summarize(events)
    out = Path(args.output_dir)
    save(events, summary, out)
    if pending:
        pd.DataFrame(pending).to_csv(out / "discount_hunter_crypto_watch_pending.csv", index=False)
    print(f"Crypto watch backtest complete. Events: {len(events)}")
    print(f"Wrote: {out / 'discount_hunter_crypto_watch_events.csv'}")
    print(f"Wrote: {out / 'discount_hunter_crypto_watch_summary.csv'}")


def parse_args(argv: Optional[Sequence[str]] = None):
    ap = argparse.ArgumentParser(description="Discount Hunter crypto watch backtest")
    ap.add_argument("--tickers", nargs="+", default=list(DEFAULT_TICKERS))
    ap.add_argument("--data-dir", default="data/crypto-watch")
    ap.add_argument("--output-dir", default="reports/backtests")
    ap.add_argument("--min-rows", type=int, default=30)
    return ap.parse_args(argv)

if __name__ == "__main__":
    run(parse_args())
