#!/usr/bin/env python3
"""
2560 Sector Lab Backtest

Research only. Not a trading system.
Adds:
- benchmark-adjusted excess returns
- ATR-normalized MA25 distance
- SPY benchmark MA200 status as an analysis tag, not a filter
Outputs:
- reports/backtests/2560_sector_events.csv
- reports/backtests/2560_sector_summary.csv
- reports/backtests/2560_sector_by_industry.csv
- reports/backtests/2560_sector_by_pattern.csv
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path
from typing import Dict, Optional, Sequence

try:
    import pandas as pd
except ImportError as exc:
    raise SystemExit("pandas is required. Install with: pip install pandas") from exc

UNIVERSE: Dict[str, str] = {
    "NVDA": "AI半導體", "AVGO": "AI半導體", "AMD": "AI半導體", "TSM": "AI半導體", "MU": "AI半導體", "MRVL": "AI半導體", "SMCI": "AI半導體",
    "AAPL": "大型科技平台", "MSFT": "大型科技平台", "GOOGL": "大型科技平台", "META": "大型科技平台", "AMZN": "大型科技平台", "NFLX": "大型科技平台",
    "TSLA": "高波動成長股", "PLTR": "高波動成長股", "COIN": "高波動成長股", "HOOD": "高波動成長股", "RKLB": "高波動成長股", "SOFI": "高波動成長股",
    "JPM": "金融支付", "BAC": "金融支付", "AXP": "金融支付", "MA": "金融支付", "V": "金融支付", "PYPL": "金融支付",
    "XOM": "能源原物料", "CVX": "能源原物料", "OXY": "能源原物料", "COP": "能源原物料", "FCX": "能源原物料",
    "CAT": "工業基建", "GE": "工業基建", "DE": "工業基建", "ETN": "工業基建", "PWR": "工業基建",
    "KO": "防禦消費", "PEP": "防禦消費", "WMT": "防禦消費", "COST": "防禦消費", "PG": "防禦消費", "MCD": "防禦消費",
    "QQQ": "ETF對照", "SPY": "ETF對照", "SMH": "ETF對照", "SOXX": "ETF對照",
}

FORWARD_WINDOWS = (5, 10, 20, 30, 60)


def normalize_ticker(ticker: str) -> str:
    return ticker.upper().replace("/", "-")


def flatten_columns(raw: pd.DataFrame) -> pd.DataFrame:
    if isinstance(raw.columns, pd.MultiIndex):
        levels = [[str(x).lower() for x in raw.columns.get_level_values(i)] for i in range(raw.columns.nlevels)]
        price_level = 0
        for i, values in enumerate(levels):
            if any(v in {"open", "high", "low", "close", "adj close", "volume"} for v in values):
                price_level = i
                break
        raw = raw.copy()
        raw.columns = raw.columns.get_level_values(price_level)
    return raw


def load_yfinance(ticker: str, start: str) -> pd.DataFrame:
    try:
        import yfinance as yf  # type: ignore
    except ImportError as exc:
        raise SystemExit("yfinance is not installed. Install with: pip install yfinance") from exc
    raw = yf.download(ticker, start=start, auto_adjust=True, progress=False)
    if raw.empty:
        raise ValueError(f"No data for {ticker}")
    return clean_price_df(flatten_columns(raw).reset_index(), ticker)


def load_csv(ticker: str, data_dir: Path) -> pd.DataFrame:
    path = next((p for p in [data_dir / f"{ticker}.csv", data_dir / f"{ticker.upper()}.csv", data_dir / f"{ticker.lower()}.csv"] if p.exists()), None)
    if path is None:
        raise FileNotFoundError(f"Missing CSV for {ticker}")
    return clean_price_df(pd.read_csv(path), ticker)


def clean_price_df(df: pd.DataFrame, ticker: str) -> pd.DataFrame:
    columns = {str(c).lower().strip().replace(" ", "_"): c for c in df.columns}
    date_col = columns.get("date") or columns.get("datetime")
    close_col = columns.get("adj_close") or columns.get("close") or columns.get("price")
    high_col = columns.get("high")
    low_col = columns.get("low")
    volume_col = columns.get("volume")
    if date_col is None or close_col is None or volume_col is None:
        raise ValueError(f"{ticker}: needs date, close, volume")
    close = pd.to_numeric(df[close_col], errors="coerce")
    out = pd.DataFrame({
        "date": pd.to_datetime(df[date_col]),
        "close": close,
        "high": pd.to_numeric(df[high_col], errors="coerce") if high_col is not None else close,
        "low": pd.to_numeric(df[low_col], errors="coerce") if low_col is not None else close,
        "volume": pd.to_numeric(df[volume_col], errors="coerce"),
    })
    out = out.dropna().sort_values("date").drop_duplicates("date")
    out["ticker"] = ticker
    if len(out) < 260:
        raise ValueError(f"{ticker}: not enough rows ({len(out)})")
    return out.reset_index(drop=True)


def add_indicators(df: pd.DataFrame, atr_multiplier: float) -> pd.DataFrame:
    out = df.copy()
    out["ma25"] = out["close"].rolling(25, min_periods=25).mean()
    out["ma25_rising_3d"] = (out["ma25"] > out["ma25"].shift(1)) & (out["ma25"].shift(1) > out["ma25"].shift(2))
    out["ma25_slope_5d"] = out["ma25"] / out["ma25"].shift(5) - 1.0
    prev_close = out["close"].shift(1)
    true_range = pd.concat([
        out["high"] - out["low"],
        (out["high"] - prev_close).abs(),
        (out["low"] - prev_close).abs(),
    ], axis=1).max(axis=1)
    out["atr14"] = true_range.rolling(14, min_periods=14).mean()
    out["ma25_distance_atr"] = (out["close"] - out["ma25"]).abs() / out["atr14"]
    out["near_ma25"] = out["ma25_distance_atr"] <= atr_multiplier
    out["above_ma25"] = out["close"] >= out["ma25"]
    out["ma25_ok"] = out["ma25_rising_3d"] | (out["ma25_slope_5d"] >= -0.003)
    out["vol5"] = out["volume"].rolling(5, min_periods=5).mean()
    out["vol60"] = out["volume"].rolling(60, min_periods=30).mean()
    out["vol_above"] = out["vol5"] >= out["vol60"]
    out["vol_cross_up"] = (out["vol5"] >= out["vol60"]) & (out["vol5"].shift(1) < out["vol60"].shift(1))
    out["shrink"] = out["volume"] <= out["vol60"]
    out["low_volume_20d"] = out["volume"] <= out["volume"].rolling(20, min_periods=10).min() * 1.05
    out["ma200"] = out["close"].rolling(200, min_periods=120).mean()
    out["above_ma200"] = out["close"] >= out["ma200"]
    out["ret_3d"] = out["close"] / out["close"].shift(3) - 1.0
    out["ret_5d"] = out["close"] / out["close"].shift(5) - 1.0
    return out.dropna().reset_index(drop=True)


def add_benchmark_state(benchmark: pd.DataFrame) -> pd.DataFrame:
    out = benchmark.copy().sort_values("date").reset_index(drop=True)
    out["ma200"] = out["close"].rolling(200, min_periods=120).mean()
    out["benchmark_above_ma200"] = out["close"] >= out["ma200"]
    return out.dropna(subset=["ma200"]).reset_index(drop=True)


def classify_pattern(row: pd.Series) -> Optional[str]:
    if not bool(row["ma25_ok"]):
        return None
    near = bool(row["near_ma25"])
    vol_above = bool(row["vol_above"])
    vol_cross = bool(row["vol_cross_up"])
    shrink = bool(row["shrink"])
    low_vol = bool(row["low_volume_20d"])
    above_200 = bool(row.get("above_ma200", False))
    rising = float(row["ret_3d"]) > 0 or float(row["ret_5d"]) > 0
    if not vol_above and not vol_cross and rising:
        return "誘多"
    if bool(row["above_ma25"]) and vol_cross:
        return "沖量"
    if near and vol_above:
        return "波段"
    if near and shrink and low_vol and above_200:
        return "縮量黑馬"
    return None


def benchmark_row(benchmark: pd.DataFrame, event_date: pd.Timestamp) -> Optional[pd.Series]:
    if benchmark.empty:
        return None
    idx_list = benchmark.index[benchmark["date"] >= event_date].tolist()
    if not idx_list:
        return None
    return benchmark.iloc[idx_list[0]]


def benchmark_return(benchmark: pd.DataFrame, event_date: pd.Timestamp, window: int) -> float:
    start = benchmark_row(benchmark, event_date)
    if start is None:
        return math.nan
    start_idx = int(start.name)
    end_idx = start_idx + window
    if end_idx >= len(benchmark):
        return math.nan
    start_close = float(benchmark.iloc[start_idx]["close"])
    end_close = float(benchmark.iloc[end_idx]["close"])
    if start_close <= 0:
        return math.nan
    return end_close / start_close - 1.0


def find_events(df: pd.DataFrame, ticker: str, industry: str, benchmark: pd.DataFrame, benchmark_name: str) -> pd.DataFrame:
    rows = []
    cooldown = {"誘多": -9999, "沖量": -9999, "波段": -9999, "縮量黑馬": -9999}
    for i, row in df.iterrows():
        pattern = classify_pattern(row)
        if not pattern:
            continue
        if i - cooldown[pattern] < 10:
            continue
        cooldown[pattern] = i
        b_row = benchmark_row(benchmark, row["date"])
        event = {
            "date": row["date"], "ticker": ticker, "industry": industry, "pattern": pattern,
            "close": row["close"], "benchmark": benchmark_name,
            "benchmark_above_ma200": bool(b_row["benchmark_above_ma200"]) if b_row is not None else None,
            "above_ma200": bool(row["above_ma200"]),
            "ma25_rising_3d": bool(row["ma25_rising_3d"]),
            "ma25_slope_5d": row["ma25_slope_5d"],
            "atr14": row["atr14"],
            "ma25_distance_atr": row["ma25_distance_atr"],
            "vol5_over_vol60": row["vol5"] / row["vol60"] if row["vol60"] else math.nan,
        }
        for window in FORWARD_WINDOWS:
            idx = i + window
            raw_ret = (float(df.iloc[idx]["close"]) / float(row["close"]) - 1.0) if idx < len(df) else math.nan
            bench_ret = benchmark_return(benchmark, row["date"], window)
            event[f"ret_{window}d"] = raw_ret
            event[f"bench_ret_{window}d"] = bench_ret
            event[f"excess_ret_{window}d"] = raw_ret - bench_ret if not pd.isna(raw_ret) and not pd.isna(bench_ret) else math.nan
        trough = df.iloc[i:min(i + 60, len(df))]["close"].min()
        event["max_adverse_60d"] = trough / float(row["close"]) - 1.0
        rows.append(event)
    return pd.DataFrame(rows)


def summarize(events: pd.DataFrame, group_cols: Sequence[str]) -> pd.DataFrame:
    if events.empty:
        return pd.DataFrame()
    rows = []
    for keys, group in events.groupby(list(group_cols), dropna=False):
        if not isinstance(keys, tuple):
            keys = (keys,)
        row = {col: value for col, value in zip(group_cols, keys)}
        row["events"] = len(group)
        row["avg_max_adverse_60d"] = group["max_adverse_60d"].mean()
        for window in FORWARD_WINDOWS:
            ret_col = f"ret_{window}d"
            excess_col = f"excess_ret_{window}d"
            row[f"avg_{ret_col}"] = group[ret_col].mean()
            row[f"win_rate_{ret_col}"] = (group[ret_col] > 0).mean()
            row[f"avg_{excess_col}"] = group[excess_col].mean()
            row[f"excess_win_rate_{window}d"] = (group[excess_col] > 0).mean()
        rows.append(row)
    return pd.DataFrame(rows).sort_values(list(group_cols))


def pct_format(x: float) -> str:
    if pd.isna(x):
        return ""
    return f"{x:.2%}"


def save_outputs(events: pd.DataFrame, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    summary = summarize(events, ("industry", "pattern"))
    by_industry = summarize(events, ("industry",))
    by_pattern = summarize(events, ("pattern",))
    by_market = summarize(events, ("benchmark_above_ma200", "industry"))
    frames = [events.copy(), summary.copy(), by_industry.copy(), by_pattern.copy(), by_market.copy()]
    for frame in frames:
        for col in frame.columns:
            if col.startswith("ret_") or col.startswith("bench_ret_") or col.startswith("excess_ret_") or col.startswith("avg_ret_") or col.startswith("avg_excess_ret_") or col.startswith("win_rate_") or col.startswith("excess_win_rate_") or col in {"max_adverse_60d", "avg_max_adverse_60d", "ma25_slope_5d"}:
                frame[col] = frame[col].map(pct_format)
            if col in {"vol5_over_vol60", "ma25_distance_atr", "atr14"}:
                frame[col] = frame[col].map(lambda x: "" if pd.isna(x) else f"{x:.2f}")
    frames[0].to_csv(output_dir / "2560_sector_events.csv", index=False)
    frames[1].to_csv(output_dir / "2560_sector_summary.csv", index=False)
    frames[2].to_csv(output_dir / "2560_sector_by_industry.csv", index=False)
    frames[3].to_csv(output_dir / "2560_sector_by_pattern.csv", index=False)
    frames[4].to_csv(output_dir / "2560_sector_by_market.csv", index=False)


def run(args: argparse.Namespace) -> None:
    tickers = [normalize_ticker(t) for t in (args.tickers or list(UNIVERSE.keys()))]
    all_events = []
    benchmark_name = normalize_ticker(args.benchmark)
    benchmark_raw = load_csv(benchmark_name, Path(args.data_dir)) if args.source == "csv" else load_yfinance(benchmark_name, args.start)
    benchmark = add_benchmark_state(benchmark_raw)
    for ticker in tickers:
        industry = UNIVERSE.get(ticker, args.default_industry)
        try:
            prices = load_csv(ticker, Path(args.data_dir)) if args.source == "csv" else load_yfinance(ticker, args.start)
            events = find_events(add_indicators(prices, args.atr_multiplier), ticker, industry, benchmark, benchmark_name)
            if not events.empty:
                all_events.append(events)
            print(f"OK {ticker}: events={len(events)}")
        except Exception as exc:
            print(f"SKIP {ticker}: {exc}")
    events = pd.concat(all_events, ignore_index=True) if all_events else pd.DataFrame()
    save_outputs(events, Path(args.output_dir))
    print(f"2560 sector lab complete. Events: {len(events)}. Benchmark: {benchmark_name}. ATR multiplier: {args.atr_multiplier}")


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="2560 sector lab backtest")
    parser.add_argument("--tickers", nargs="+")
    parser.add_argument("--source", choices=("csv", "yfinance"), default="yfinance")
    parser.add_argument("--data-dir", default="data/prices")
    parser.add_argument("--output-dir", default="reports/backtests")
    parser.add_argument("--start", default="2010-01-01")
    parser.add_argument("--benchmark", default="SPY")
    parser.add_argument("--atr-multiplier", type=float, default=1.5)
    parser.add_argument("--default-industry", default="未分類")
    return parser.parse_args(argv)


if __name__ == "__main__":
    run(parse_args())
