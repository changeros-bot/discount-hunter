#!/usr/bin/env python3
"""
Discount Hunter Backtest Framework

Purpose:
- Validate Discount Hunter drawdown layers before promoting them into final app rules.
- Start with price-only backtests. Quality / fundamentals are intentionally not included here.

Input options:
1. Local CSV files under data/prices/{TICKER}.csv
   Required columns: date, close OR date, adj_close
2. Optional yfinance download if yfinance is installed.

Example:
  python scripts/backtest_discount_hunter.py --tickers NVDA TSM AVGO AMD MU MRVL GOOGL AMZN META RKLB BTC-USD QQQM VOO --source yfinance
  python scripts/backtest_discount_hunter.py --tickers NVDA TSM --source csv --data-dir data/prices

Output:
  reports/backtests/discount_hunter_summary.csv
  reports/backtests/discount_hunter_events.csv
"""

from __future__ import annotations

import argparse
import csv
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

try:
    import pandas as pd
except ImportError as exc:  # pragma: no cover
    raise SystemExit("pandas is required. Install with: pip install pandas") from exc


@dataclass(frozen=True)
class Scheme:
    name: str
    layers: Tuple[float, ...]
    engine: str


DEFAULT_SCHEMES: Tuple[Scheme, ...] = (
    Scheme("ETF_A_10_20_30", (-0.10, -0.20, -0.30), "核心ETF"),
    Scheme("ETF_B_15_25_35", (-0.15, -0.25, -0.35), "核心ETF"),
    Scheme("AI_A_15_25_35_50", (-0.15, -0.25, -0.35, -0.50), "AI基礎建設"),
    Scheme("AI_B_20_30_40_55", (-0.20, -0.30, -0.40, -0.55), "AI基礎建設"),
    Scheme("AI_C_25_35_45_60", (-0.25, -0.35, -0.45, -0.60), "AI基礎建設"),
    Scheme("HIGH_GROWTH_A_35_50_65", (-0.35, -0.50, -0.65), "高成長深折扣"),
    Scheme("BTC_A_20_35_50_65_80", (-0.20, -0.35, -0.50, -0.65, -0.80), "比特幣引擎"),
    Scheme("BTC_B_25_40_55_70_85", (-0.25, -0.40, -0.55, -0.70, -0.85), "比特幣引擎"),
)

ENGINE_MAP: Dict[str, str] = {
    "VOO": "核心ETF",
    "QQQM": "核心ETF",
    "0050.TW": "核心ETF",
    "NVDA": "AI基礎建設",
    "TSM": "AI基礎建設",
    "AVGO": "AI基礎建設",
    "AMD": "AI基礎建設",
    "MU": "AI基礎建設",
    "MRVL": "AI基礎建設",
    "GOOGL": "平台型公司",
    "AMZN": "平台型公司",
    "META": "平台型公司",
    "RKLB": "高成長深折扣",
    "SPCX": "高成長深折扣",
    "ASTS": "高成長深折扣",
    "BTC-USD": "比特幣引擎",
    "BTC": "比特幣引擎",
}

FORWARD_WINDOWS = (21, 63, 126, 252)  # approx 1m / 3m / 6m / 12m trading days


def normalize_ticker(ticker: str) -> str:
    return ticker.upper().replace("/", "-")


def load_from_csv(ticker: str, data_dir: Path) -> pd.DataFrame:
    candidates = [
        data_dir / f"{ticker}.csv",
        data_dir / f"{ticker.upper()}.csv",
        data_dir / f"{ticker.lower()}.csv",
    ]
    path = next((p for p in candidates if p.exists()), None)
    if path is None:
        raise FileNotFoundError(f"Missing CSV for {ticker}. Tried: {', '.join(str(p) for p in candidates)}")
    df = pd.read_csv(path)
    return clean_price_df(df, ticker)


def load_from_yfinance(ticker: str, start: str) -> pd.DataFrame:
    try:
        import yfinance as yf  # type: ignore
    except ImportError as exc:
        raise SystemExit("yfinance is not installed. Install with: pip install yfinance") from exc
    raw = yf.download(ticker, start=start, auto_adjust=True, progress=False)
    if raw.empty:
        raise ValueError(f"No yfinance data for {ticker}")
    raw = raw.reset_index()
    raw.columns = [str(c).lower().replace(" ", "_") for c in raw.columns]
    if "date" not in raw.columns and "datetime" in raw.columns:
        raw = raw.rename(columns={"datetime": "date"})
    if "close" not in raw.columns and "adj_close" in raw.columns:
        raw = raw.rename(columns={"adj_close": "close"})
    return clean_price_df(raw, ticker)


def clean_price_df(df: pd.DataFrame, ticker: str) -> pd.DataFrame:
    columns = {c.lower().strip().replace(" ", "_"): c for c in df.columns}
    if "date" not in columns:
        raise ValueError(f"{ticker}: CSV must contain a date column")
    price_col = None
    for candidate in ("adj_close", "close", "price"):
        if candidate in columns:
            price_col = columns[candidate]
            break
    if price_col is None:
        raise ValueError(f"{ticker}: CSV must contain close, adj_close, or price")
    out = pd.DataFrame({
        "date": pd.to_datetime(df[columns["date"]]),
        "close": pd.to_numeric(df[price_col], errors="coerce"),
    })
    out = out.dropna().sort_values("date").drop_duplicates("date")
    out["ticker"] = ticker
    if len(out) < 300:
        raise ValueError(f"{ticker}: not enough price rows for backtest ({len(out)})")
    return out.reset_index(drop=True)


def add_drawdown_columns(df: pd.DataFrame, engine: str) -> pd.DataFrame:
    out = df.copy()
    if engine == "比特幣引擎":
        out["reference_high"] = out["close"].cummax()
    else:
        out["reference_high"] = out["close"].rolling(252, min_periods=120).max()
    out["drawdown"] = out["close"] / out["reference_high"] - 1.0
    return out.dropna().reset_index(drop=True)


def compatible_schemes(engine: str) -> List[Scheme]:
    if engine == "核心ETF":
        return [s for s in DEFAULT_SCHEMES if s.engine == "核心ETF"]
    if engine == "比特幣引擎":
        return [s for s in DEFAULT_SCHEMES if s.engine == "比特幣引擎"]
    if engine == "高成長深折扣":
        return [s for s in DEFAULT_SCHEMES if s.engine == "高成長深折扣"]
    return [s for s in DEFAULT_SCHEMES if s.engine == "AI基礎建設"]


def layer_name(index: int) -> str:
    return f"L{index + 1}"


def find_events(df: pd.DataFrame, scheme: Scheme) -> pd.DataFrame:
    events = []
    triggered_state = {layer: False for layer in scheme.layers}
    prev_drawdown = None

    for i, row in df.iterrows():
        dd = float(row["drawdown"])
        # Reset layer state after full recovery to within -5% of high.
        if dd > -0.05:
            triggered_state = {layer: False for layer in scheme.layers}
        for layer_index, layer in enumerate(scheme.layers):
            crossed = dd <= layer and not triggered_state[layer]
            if crossed:
                triggered_state[layer] = True
                event = {
                    "ticker": row["ticker"],
                    "engine": scheme.engine,
                    "scheme": scheme.name,
                    "layer": layer_name(layer_index),
                    "threshold": layer,
                    "date": row["date"],
                    "close": row["close"],
                    "reference_high": row["reference_high"],
                    "drawdown": dd,
                }
                for window in FORWARD_WINDOWS:
                    future_idx = i + window
                    if future_idx < len(df):
                        future_close = float(df.iloc[future_idx]["close"])
                        event[f"ret_{window}d"] = future_close / float(row["close"]) - 1.0
                    else:
                        event[f"ret_{window}d"] = math.nan
                trough = df.iloc[i:min(i + 252, len(df))]["close"].min()
                event["max_adverse_252d"] = trough / float(row["close"]) - 1.0
                events.append(event)
        prev_drawdown = dd
    return pd.DataFrame(events)


def summarize_events(events: pd.DataFrame) -> pd.DataFrame:
    if events.empty:
        return pd.DataFrame()
    rows = []
    for keys, g in events.groupby(["ticker", "engine", "scheme"]):
        ticker, engine, scheme = keys
        row = {
            "ticker": ticker,
            "engine": engine,
            "scheme": scheme,
            "events": len(g),
            "avg_drawdown_at_trigger": g["drawdown"].mean(),
            "avg_max_adverse_252d": g["max_adverse_252d"].mean(),
        }
        for window in FORWARD_WINDOWS:
            col = f"ret_{window}d"
            row[f"avg_{col}"] = g[col].mean()
            row[f"win_rate_{col}"] = (g[col] > 0).mean()
        rows.append(row)
    return pd.DataFrame(rows).sort_values(["engine", "ticker", "scheme"])


def pct_format(x: float) -> str:
    if pd.isna(x):
        return ""
    return f"{x:.2%}"


def save_outputs(events: pd.DataFrame, summary: pd.DataFrame, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    events_out = events.copy()
    summary_out = summary.copy()
    for frame in (events_out, summary_out):
        for col in frame.columns:
            if col.startswith("ret_") or col.startswith("avg_ret_") or col.startswith("win_rate_") or col in {"drawdown", "threshold", "avg_drawdown_at_trigger", "avg_max_adverse_252d", "max_adverse_252d"}:
                frame[col] = frame[col].map(pct_format)
    events_out.to_csv(output_dir / "discount_hunter_events.csv", index=False)
    summary_out.to_csv(output_dir / "discount_hunter_summary.csv", index=False)


def run(args: argparse.Namespace) -> None:
    all_events = []
    for raw_ticker in args.tickers:
        ticker = normalize_ticker(raw_ticker)
        engine = ENGINE_MAP.get(ticker, args.default_engine)
        if args.source == "csv":
            prices = load_from_csv(ticker, Path(args.data_dir))
        else:
            prices = load_from_yfinance(ticker, args.start)
        prices = add_drawdown_columns(prices, engine)
        for scheme in compatible_schemes(engine):
            all_events.append(find_events(prices, scheme))

    events = pd.concat(all_events, ignore_index=True) if all_events else pd.DataFrame()
    summary = summarize_events(events)
    save_outputs(events, summary, Path(args.output_dir))
    print(f"Backtest complete. Events: {len(events)}")
    print(f"Wrote: {Path(args.output_dir) / 'discount_hunter_events.csv'}")
    print(f"Wrote: {Path(args.output_dir) / 'discount_hunter_summary.csv'}")


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Discount Hunter price-layer backtest")
    parser.add_argument("--tickers", nargs="+", required=True)
    parser.add_argument("--source", choices=("csv", "yfinance"), default="csv")
    parser.add_argument("--data-dir", default="data/prices")
    parser.add_argument("--output-dir", default="reports/backtests")
    parser.add_argument("--start", default="2010-01-01")
    parser.add_argument("--default-engine", default="AI基礎建設", choices=("核心ETF", "AI基礎建設", "高成長深折扣", "比特幣引擎"))
    return parser.parse_args(argv)


if __name__ == "__main__":
    run(parse_args())
