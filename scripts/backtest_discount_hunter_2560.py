#!/usr/bin/env python3
"""
Discount Hunter 2560 Technical Filter Backtest

Purpose:
- Test whether a 2560-style technical filter improves Discount Hunter D-layer signals.
- This is a filter comparison, not a new trading project.

Outputs:
  reports/backtests/discount_hunter_2560_events.csv
  reports/backtests/discount_hunter_2560_summary.csv

Default universe uses underlying symbols as proxies:
  BTC-USD, NVDA, TSM, AVGO, AMD, MRVL, GOOGL, RKLB

Notes:
- BTC uses Cycle High drawdown, but 2560 volume rules are marked BTC-lite.
- xStocks use underlying stock OHLCV from yfinance or local CSV.
- SPCX / SpaceX cannot be backtested by yfinance unless a proxy CSV is supplied.
"""

from __future__ import annotations

import argparse
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
    Scheme("AI_A_15_25_35_50", (-0.15, -0.25, -0.35, -0.50), "AI基礎建設"),
    Scheme("HIGH_GROWTH_A_35_50_65", (-0.35, -0.50, -0.65), "高成長深折扣"),
    Scheme("BTC_A_20_35_50_65_80", (-0.20, -0.35, -0.50, -0.65, -0.80), "比特幣引擎"),
)

ENGINE_MAP: Dict[str, str] = {
    "VOO": "核心ETF",
    "QQQM": "核心ETF",
    "QQQ": "核心ETF",
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
    "BTC-USD": "比特幣引擎",
    "BTC": "比特幣引擎",
}

DEFAULT_TICKERS = ("BTC-USD", "NVDA", "TSM", "AVGO", "AMD", "MRVL", "GOOGL", "RKLB")
FORWARD_WINDOWS = (21, 63, 126, 252)
FILTERS = ("D_ONLY", "D_MA25", "D_VOLUME", "D_2560")


def normalize_ticker(ticker: str) -> str:
    return ticker.upper().replace("/", "-")


def flatten_yfinance_columns(raw: pd.DataFrame, ticker: str) -> pd.DataFrame:
    if isinstance(raw.columns, pd.MultiIndex):
        # yfinance can return either (Price, Ticker) or (Ticker, Price). Pick the level that contains OHLCV names.
        lower_levels = [[str(x).lower() for x in raw.columns.get_level_values(i)] for i in range(raw.columns.nlevels)]
        price_level = 0
        for i, values in enumerate(lower_levels):
            if any(v in {"open", "high", "low", "close", "adj close", "volume"} for v in values):
                price_level = i
                break
        raw = raw.copy()
        raw.columns = raw.columns.get_level_values(price_level)
    return raw


def load_from_yfinance(ticker: str, start: str) -> pd.DataFrame:
    try:
        import yfinance as yf  # type: ignore
    except ImportError as exc:
        raise SystemExit("yfinance is not installed. Install with: pip install yfinance") from exc
    raw = yf.download(ticker, start=start, auto_adjust=True, progress=False)
    if raw.empty:
        raise ValueError(f"No yfinance data for {ticker}")
    raw = flatten_yfinance_columns(raw, ticker).reset_index()
    return clean_price_df(raw, ticker)


def load_from_csv(ticker: str, data_dir: Path) -> pd.DataFrame:
    candidates = [data_dir / f"{ticker}.csv", data_dir / f"{ticker.upper()}.csv", data_dir / f"{ticker.lower()}.csv"]
    path = next((p for p in candidates if p.exists()), None)
    if path is None:
        raise FileNotFoundError(f"Missing CSV for {ticker}. Tried: {', '.join(str(p) for p in candidates)}")
    return clean_price_df(pd.read_csv(path), ticker)


def clean_price_df(df: pd.DataFrame, ticker: str) -> pd.DataFrame:
    columns = {str(c).lower().strip().replace(" ", "_"): c for c in df.columns}
    if "date" not in columns and "datetime" not in columns:
        raise ValueError(f"{ticker}: data must contain a date column")
    date_col = columns.get("date") or columns.get("datetime")
    close_col = None
    for candidate in ("adj_close", "close", "price"):
        if candidate in columns:
            close_col = columns[candidate]
            break
    if close_col is None:
        raise ValueError(f"{ticker}: data must contain close, adj_close, or price")
    volume_col = columns.get("volume")
    out = pd.DataFrame({
        "date": pd.to_datetime(df[date_col]),
        "close": pd.to_numeric(df[close_col], errors="coerce"),
        "volume": pd.to_numeric(df[volume_col], errors="coerce") if volume_col is not None else math.nan,
    })
    out = out.dropna(subset=["date", "close"]).sort_values("date").drop_duplicates("date")
    out["ticker"] = ticker
    if len(out) < 300:
        raise ValueError(f"{ticker}: not enough rows for backtest ({len(out)})")
    return out.reset_index(drop=True)


def add_indicators(df: pd.DataFrame, engine: str) -> pd.DataFrame:
    out = df.copy()
    if engine == "比特幣引擎":
        out["reference_high"] = out["close"].cummax()
    else:
        out["reference_high"] = out["close"].rolling(252, min_periods=120).max()
    out["drawdown"] = out["close"] / out["reference_high"] - 1.0
    out["ma25"] = out["close"].rolling(25, min_periods=25).mean()
    out["ma25_slope_5d"] = out["ma25"] / out["ma25"].shift(5) - 1.0
    out["vol5"] = out["volume"].rolling(5, min_periods=5).mean()
    out["vol60"] = out["volume"].rolling(60, min_periods=30).mean()
    out["volume_ok"] = out["vol5"] >= out["vol60"]
    out["shrink_ok"] = out["volume"] <= out["vol60"]
    out["price_near_ma25"] = (out["close"] / out["ma25"] - 1.0).abs() <= 0.035
    out["ma25_ok"] = out["ma25_slope_5d"] >= -0.005
    return out.dropna(subset=["reference_high", "drawdown", "ma25"]).reset_index(drop=True)


def compatible_schemes(engine: str) -> List[Scheme]:
    if engine == "核心ETF":
        return [s for s in DEFAULT_SCHEMES if s.engine == "核心ETF"]
    if engine == "比特幣引擎":
        return [s for s in DEFAULT_SCHEMES if s.engine == "比特幣引擎"]
    if engine == "高成長深折扣":
        return [s for s in DEFAULT_SCHEMES if s.engine == "高成長深折扣"]
    return [s for s in DEFAULT_SCHEMES if s.engine == "AI基礎建設"]


def layer_name(index: int) -> str:
    return f"D{index + 1}"


def filter_pass(row: pd.Series, filter_name: str, engine: str) -> bool:
    if filter_name == "D_ONLY":
        return True
    ma25_ok = bool(row.get("ma25_ok", False))
    near_ma25 = bool(row.get("price_near_ma25", False))
    volume_ok = bool(row.get("volume_ok", False))
    shrink_ok = bool(row.get("shrink_ok", False))
    if engine == "比特幣引擎":
        # BTC-lite: do not force stock-style volume rule; only trend check.
        if filter_name in {"D_MA25", "D_VOLUME", "D_2560"}:
            return ma25_ok
    if filter_name == "D_MA25":
        return ma25_ok
    if filter_name == "D_VOLUME":
        return volume_ok or shrink_ok
    if filter_name == "D_2560":
        return ma25_ok and near_ma25 and (volume_ok or shrink_ok)
    return False


def find_events(df: pd.DataFrame, scheme: Scheme) -> pd.DataFrame:
    events = []
    triggered_state = {layer: False for layer in scheme.layers}
    for i, row in df.iterrows():
        dd = float(row["drawdown"])
        if dd > -0.05:
            triggered_state = {layer: False for layer in scheme.layers}
        for layer_index, layer in enumerate(scheme.layers):
            if dd <= layer and not triggered_state[layer]:
                triggered_state[layer] = True
                base = {
                    "ticker": row["ticker"],
                    "engine": scheme.engine,
                    "scheme": scheme.name,
                    "layer": layer_name(layer_index),
                    "threshold": layer,
                    "date": row["date"],
                    "close": row["close"],
                    "reference_high": row["reference_high"],
                    "drawdown": dd,
                    "ma25": row["ma25"],
                    "ma25_slope_5d": row["ma25_slope_5d"],
                    "vol5": row["vol5"],
                    "vol60": row["vol60"],
                    "volume_ok": bool(row.get("volume_ok", False)),
                    "shrink_ok": bool(row.get("shrink_ok", False)),
                    "price_near_ma25": bool(row.get("price_near_ma25", False)),
                }
                for filter_name in FILTERS:
                    event = dict(base)
                    event["filter"] = filter_name
                    event["filter_pass"] = filter_pass(row, filter_name, scheme.engine)
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
    return pd.DataFrame(events)


def summarize_events(events: pd.DataFrame) -> pd.DataFrame:
    if events.empty:
        return pd.DataFrame()
    rows = []
    passed = events[events["filter_pass"] == True].copy()
    for keys, g in passed.groupby(["engine", "scheme", "filter"]):
        engine, scheme, filter_name = keys
        row = {
            "engine": engine,
            "scheme": scheme,
            "filter": filter_name,
            "events": len(g),
            "avg_drawdown_at_trigger": g["drawdown"].mean(),
            "avg_max_adverse_252d": g["max_adverse_252d"].mean(),
        }
        for window in FORWARD_WINDOWS:
            col = f"ret_{window}d"
            row[f"avg_{col}"] = g[col].mean()
            row[f"win_rate_{col}"] = (g[col] > 0).mean()
        rows.append(row)
    return pd.DataFrame(rows).sort_values(["engine", "scheme", "filter"])


def pct_format(x: float) -> str:
    if pd.isna(x):
        return ""
    return f"{x:.2%}"


def save_outputs(events: pd.DataFrame, summary: pd.DataFrame, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    events_out = events.copy()
    summary_out = summary.copy()
    pct_cols = {"drawdown", "threshold", "avg_drawdown_at_trigger", "avg_max_adverse_252d", "max_adverse_252d", "ma25_slope_5d"}
    for frame in (events_out, summary_out):
        for col in frame.columns:
            if col.startswith("ret_") or col.startswith("avg_ret_") or col.startswith("win_rate_") or col in pct_cols:
                frame[col] = frame[col].map(pct_format)
    events_out.to_csv(output_dir / "discount_hunter_2560_events.csv", index=False)
    summary_out.to_csv(output_dir / "discount_hunter_2560_summary.csv", index=False)


def run(args: argparse.Namespace) -> None:
    all_events = []
    for raw_ticker in args.tickers:
        ticker = normalize_ticker(raw_ticker)
        engine = ENGINE_MAP.get(ticker, args.default_engine)
        try:
            if args.source == "csv":
                prices = load_from_csv(ticker, Path(args.data_dir))
            else:
                prices = load_from_yfinance(ticker, args.start)
            prices = add_indicators(prices, engine)
            for scheme in compatible_schemes(engine):
                all_events.append(find_events(prices, scheme))
        except Exception as exc:
            print(f"SKIP {ticker}: {exc}")
    events = pd.concat(all_events, ignore_index=True) if all_events else pd.DataFrame()
    summary = summarize_events(events)
    save_outputs(events, summary, Path(args.output_dir))
    print(f"2560 filter backtest complete. Raw rows: {len(events)}")
    print(f"Wrote: {Path(args.output_dir) / 'discount_hunter_2560_events.csv'}")
    print(f"Wrote: {Path(args.output_dir) / 'discount_hunter_2560_summary.csv'}")


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Discount Hunter 2560 technical filter backtest")
    parser.add_argument("--tickers", nargs="+", default=list(DEFAULT_TICKERS))
    parser.add_argument("--source", choices=("csv", "yfinance"), default="yfinance")
    parser.add_argument("--data-dir", default="data/prices")
    parser.add_argument("--output-dir", default="reports/backtests")
    parser.add_argument("--start", default="2010-01-01")
    parser.add_argument("--default-engine", default="AI基礎建設", choices=("核心ETF", "AI基礎建設", "高成長深折扣", "比特幣引擎"))
    return parser.parse_args(argv)


if __name__ == "__main__":
    run(parse_args())
