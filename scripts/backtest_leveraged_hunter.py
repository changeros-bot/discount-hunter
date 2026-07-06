#!/usr/bin/env python3
"""
Leveraged Hunter Tactical Backtest

Purpose:
- Backtest tactical observation signals for Binance tokenized-stock candidates.
- Uses underlying symbols for historical price data, not token prices.
- Output is research only. It does not produce live trading rules.

Inputs:
1. CSV mode:
   data/prices/{TICKER}.csv with columns: date, close or adj_close
2. yfinance mode if yfinance is installed.

Example:
  python scripts/backtest_leveraged_hunter.py --batch A --source yfinance
  python scripts/backtest_leveraged_hunter.py --tickers NVDA TSM AVGO MU MRVL ARM QQQ BTC-USD --source csv

Outputs:
  reports/backtests/leveraged_hunter_events.csv
  reports/backtests/leveraged_hunter_summary.csv
"""

from __future__ import annotations

import argparse
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

try:
    import pandas as pd
except ImportError as exc:  # pragma: no cover
    raise SystemExit("pandas is required. Install with: pip install pandas") from exc


BATCHES: Dict[str, List[str]] = {
    "A": ["BTC-USD", "QQQ", "NVDA", "TSM", "AVGO", "MU", "MRVL", "ARM"],
    "B": ["AAPL", "AXP", "GOOGL", "AMZN"],
    "C": ["AMD", "META", "MSFT", "COIN", "HOOD", "CRCL", "PLTR", "TSLA", "MSTR", "COHR", "CAMT", "MKSI"],
}

FORWARD_WINDOWS = (5, 10, 20, 30, 60)


@dataclass(frozen=True)
class SignalConfig:
    name: str
    min_drawdown: float
    max_drawdown: float
    require_above_ma200: bool
    require_momentum: bool


SIGNALS: Tuple[SignalConfig, ...] = (
    SignalConfig("A_回撤反彈型", -0.25, -0.08, True, True),
    SignalConfig("B_趨勢回踩型", -0.15, -0.03, True, False),
    SignalConfig("C_過度波動禁止型", -1.00, -0.25, False, False),
)


def normalize_ticker(ticker: str) -> str:
    return ticker.upper().replace("/", "-")


def load_from_csv(ticker: str, data_dir: Path) -> pd.DataFrame:
    candidates = [data_dir / f"{ticker}.csv", data_dir / f"{ticker.upper()}.csv", data_dir / f"{ticker.lower()}.csv"]
    path = next((p for p in candidates if p.exists()), None)
    if path is None:
        raise FileNotFoundError(f"Missing CSV for {ticker}. Tried: {', '.join(str(p) for p in candidates)}")
    return clean_price_df(pd.read_csv(path), ticker)


def flatten_yfinance(raw: pd.DataFrame, ticker: str) -> pd.DataFrame:
    """Return a simple DataFrame with date and close from possible yfinance shapes."""
    if raw.empty:
        raise ValueError(f"No yfinance data for {ticker}")

    df = raw.copy()
    if isinstance(df.columns, pd.MultiIndex):
        # yfinance may return either (Price, Ticker) or (Ticker, Price).
        close_candidates = []
        for col in df.columns:
            labels = [str(x).lower() for x in col]
            if "close" in labels or "adj close" in labels:
                close_candidates.append(col)
        if not close_candidates:
            raise ValueError(f"{ticker}: yfinance MultiIndex has no close column: {list(df.columns)[:5]}")
        df = pd.DataFrame({"date": df.index, "close": df[close_candidates[0]]})
    else:
        df = df.reset_index()
        rename = {c: str(c).lower().strip().replace(" ", "_") for c in df.columns}
        df = df.rename(columns=rename)
        date_col = "date" if "date" in df.columns else "datetime" if "datetime" in df.columns else None
        close_col = None
        for c in ("adj_close", "close", "price"):
            if c in df.columns:
                close_col = c
                break
        if date_col is None or close_col is None:
            raise ValueError(f"{ticker}: yfinance columns unsupported: {list(df.columns)}")
        df = pd.DataFrame({"date": df[date_col], "close": df[close_col]})
    return clean_price_df(df, ticker)


def load_from_yfinance(ticker: str, start: str) -> pd.DataFrame:
    try:
        import yfinance as yf  # type: ignore
    except ImportError as exc:
        raise SystemExit("yfinance is not installed. Install with: pip install yfinance") from exc
    raw = yf.download(ticker, start=start, auto_adjust=True, progress=False, threads=False)
    return flatten_yfinance(raw, ticker)


def clean_price_df(df: pd.DataFrame, ticker: str) -> pd.DataFrame:
    columns = {c.lower().strip().replace(" ", "_"): c for c in map(str, df.columns)}
    if "date" not in columns:
        raise ValueError(f"{ticker}: missing date column")
    price_col = None
    for candidate in ("adj_close", "close", "price"):
        if candidate in columns:
            price_col = columns[candidate]
            break
    if price_col is None:
        raise ValueError(f"{ticker}: missing close / adj_close / price column. Columns: {list(df.columns)}")
    out = pd.DataFrame({
        "date": pd.to_datetime(df[columns["date"]]),
        "close": pd.to_numeric(df[price_col], errors="coerce"),
    }).dropna()
    out = out.sort_values("date").drop_duplicates("date").reset_index(drop=True)
    out["ticker"] = ticker
    if len(out) < 260:
        raise ValueError(f"{ticker}: not enough rows ({len(out)})")
    return out


def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["high_60"] = out["close"].rolling(60, min_periods=30).max()
    out["high_252"] = out["close"].rolling(252, min_periods=120).max()
    out["drawdown_60"] = out["close"] / out["high_60"] - 1.0
    out["drawdown_252"] = out["close"] / out["high_252"] - 1.0
    out["ma20"] = out["close"].rolling(20).mean()
    out["ma50"] = out["close"].rolling(50).mean()
    out["ma200"] = out["close"].rolling(200).mean()
    out["ret_3d"] = out["close"].pct_change(3)
    out["ret_5d"] = out["close"].pct_change(5)
    out["ret_10d"] = out["close"].pct_change(10)
    out["vol_20"] = out["close"].pct_change().rolling(20).std() * math.sqrt(252)
    out["vol_60"] = out["close"].pct_change().rolling(60).std() * math.sqrt(252)
    out["above_ma200"] = out["close"] > out["ma200"]
    out["above_ma50"] = out["close"] > out["ma50"]
    out["momentum_confirm"] = (out["ret_3d"] > 0) & (out["ret_5d"] > 0)
    return out.dropna().reset_index(drop=True)


def signal_pass(row: pd.Series, cfg: SignalConfig) -> bool:
    dd = float(row["drawdown_60"])
    if not (cfg.min_drawdown <= dd <= cfg.max_drawdown):
        return False
    if cfg.require_above_ma200 and not bool(row["above_ma200"]):
        return False
    if cfg.require_momentum and not bool(row["momentum_confirm"]):
        return False
    return True


def scan_events(df: pd.DataFrame, ticker: str) -> pd.DataFrame:
    events = []
    cooldown_until = {cfg.name: -1 for cfg in SIGNALS}
    for i, row in df.iterrows():
        for cfg in SIGNALS:
            if i <= cooldown_until[cfg.name]:
                continue
            if not signal_pass(row, cfg):
                continue
            event = {
                "ticker": ticker,
                "signal": cfg.name,
                "date": row["date"],
                "close": row["close"],
                "drawdown_60": row["drawdown_60"],
                "drawdown_252": row["drawdown_252"],
                "above_ma50": bool(row["above_ma50"]),
                "above_ma200": bool(row["above_ma200"]),
                "ret_3d_before": row["ret_3d"],
                "ret_5d_before": row["ret_5d"],
                "vol_20": row["vol_20"],
                "vol_60": row["vol_60"],
            }
            for window in FORWARD_WINDOWS:
                j = i + window
                event[f"ret_{window}d"] = (df.iloc[j]["close"] / row["close"] - 1.0) if j < len(df) else math.nan
            trough = df.iloc[i:min(i + 60, len(df))]["close"].min()
            event["max_adverse_60d"] = trough / row["close"] - 1.0
            events.append(event)
            cooldown_until[cfg.name] = i + 10
    return pd.DataFrame(events)


def summarize(events: pd.DataFrame) -> pd.DataFrame:
    if events.empty:
        return pd.DataFrame(columns=["ticker", "signal", "events"])
    rows = []
    for (ticker, signal), group in events.groupby(["ticker", "signal"]):
        row = {"ticker": ticker, "signal": signal, "events": len(group), "avg_drawdown_60": group["drawdown_60"].mean(), "avg_max_adverse_60d": group["max_adverse_60d"].mean(), "avg_vol_20": group["vol_20"].mean()}
        for window in FORWARD_WINDOWS:
            col = f"ret_{window}d"
            row[f"avg_{col}"] = group[col].mean()
            row[f"win_rate_{col}"] = (group[col] > 0).mean()
        rows.append(row)
    return pd.DataFrame(rows).sort_values(["ticker", "signal"])


def pct(x):
    if pd.isna(x):
        return ""
    return f"{x:.2%}"


def save_outputs(events: pd.DataFrame, summary: pd.DataFrame, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    events_out = events.copy()
    summary_out = summary.copy()
    pct_cols = [c for c in list(events_out.columns) + list(summary_out.columns) if c.startswith("ret_") or c.startswith("avg_ret_") or c.startswith("win_rate_") or c in {"drawdown_60", "drawdown_252", "avg_drawdown_60", "max_adverse_60d", "avg_max_adverse_60d", "vol_20", "vol_60", "avg_vol_20", "ret_3d_before", "ret_5d_before"}]
    for col in set(pct_cols):
        if col in events_out.columns:
            events_out[col] = events_out[col].map(pct)
        if col in summary_out.columns:
            summary_out[col] = summary_out[col].map(pct)
    events_out.to_csv(output_dir / "leveraged_hunter_events.csv", index=False)
    summary_out.to_csv(output_dir / "leveraged_hunter_summary.csv", index=False)


def resolve_tickers(args: argparse.Namespace) -> List[str]:
    if args.tickers:
        return [normalize_ticker(t) for t in args.tickers]
    tickers = []
    for batch in args.batch:
        tickers.extend(BATCHES[batch.upper()])
    return list(dict.fromkeys(tickers))


def run(args: argparse.Namespace) -> None:
    tickers = resolve_tickers(args)
    all_events = []
    failures = []
    for ticker in tickers:
        try:
            prices = load_from_csv(ticker, Path(args.data_dir)) if args.source == "csv" else load_from_yfinance(ticker, args.start)
            enriched = add_indicators(prices)
            events = scan_events(enriched, ticker)
            if not events.empty:
                all_events.append(events)
            print(f"OK {ticker}: rows={len(prices)} events={len(events)}")
        except Exception as exc:  # keep batch alive; record failure for logs
            failures.append((ticker, str(exc)))
            print(f"WARN {ticker}: {exc}")
    events = pd.concat(all_events, ignore_index=True) if all_events else pd.DataFrame()
    summary = summarize(events)
    save_outputs(events, summary, Path(args.output_dir))
    print(f"Leveraged Hunter backtest complete. Tickers: {', '.join(tickers)}")
    print(f"Events: {len(events)}")
    if failures:
        print("Skipped tickers:")
        for ticker, reason in failures:
            print(f"- {ticker}: {reason}")
    print(f"Wrote: {Path(args.output_dir) / 'leveraged_hunter_events.csv'}")
    print(f"Wrote: {Path(args.output_dir) / 'leveraged_hunter_summary.csv'}")
    if events.empty:
        raise SystemExit("No events generated; cannot run simulation")


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Leveraged Hunter tactical backtest")
    parser.add_argument("--batch", nargs="+", choices=("A", "B", "C"), default=["A"])
    parser.add_argument("--tickers", nargs="+")
    parser.add_argument("--source", choices=("csv", "yfinance"), default="csv")
    parser.add_argument("--data-dir", default="data/prices")
    parser.add_argument("--output-dir", default="reports/backtests")
    parser.add_argument("--start", default="2015-01-01")
    return parser.parse_args(argv)


if __name__ == "__main__":
    run(parse_args())
