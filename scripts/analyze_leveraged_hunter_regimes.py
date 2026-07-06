#!/usr/bin/env python3
"""
Leveraged Hunter Regime Analysis

Purpose:
- Split Signal Research trades into market/regime time slices.
- Verify whether a signal works across different periods instead of one long backtest.

Input:
- reports/backtests/leveraged_hunter_research.csv

Outputs:
- reports/backtests/leveraged_hunter_research_by_regime.csv
- reports/backtests/leveraged_hunter_research_by_regime_signal.csv
- reports/backtests/leveraged_hunter_research_by_regime_ticker.csv

Default regimes:
- 2015-2019: Pre-AI normal bull market
- 2020-2021: Covid liquidity bull market
- 2022: Rate-hike bear market
- 2023-2024: AI bull market
- 2025-now: Recent validation / out-of-sample proxy
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Optional, Sequence

try:
    import pandas as pd
except ImportError as exc:  # pragma: no cover
    raise SystemExit("pandas is required. Install with: pip install pandas") from exc


REGIMES = [
    ("2015_2019_pre_ai_bull", "2015-01-01", "2019-12-31"),
    ("2020_2021_liquidity_bull", "2020-01-01", "2021-12-31"),
    ("2022_rate_hike_bear", "2022-01-01", "2022-12-31"),
    ("2023_2024_ai_bull", "2023-01-01", "2024-12-31"),
    ("2025_now_recent_validation", "2025-01-01", None),
]


def sample_level(trades: int) -> str:
    if trades < 30:
        return "樣本不足"
    if trades < 50:
        return "初步觀察"
    if trades < 100:
        return "研究可用"
    if trades < 200:
        return "候選策略"
    return "策略研究成熟"


def max_drawdown_from_curve(values: list[float]) -> float:
    if not values:
        return 0.0
    peak = values[0]
    max_dd = 0.0
    for value in values:
        peak = max(peak, value)
        max_dd = min(max_dd, value - peak)
    return max_dd


def profit_factor(series: pd.Series):
    gross_profit = float(series[series > 0].sum())
    gross_loss = abs(float(series[series < 0].sum()))
    return gross_profit / gross_loss if gross_loss else None


def summarize(df: pd.DataFrame, group_cols: list[str]) -> pd.DataFrame:
    rows = []
    if df.empty:
        return pd.DataFrame(columns=group_cols + ["trades", "sample_level", "wins", "losses", "win_rate", "gross_pnl", "cost", "pnl", "expectancy", "profit_factor", "max_drawdown_pnl"])
    for keys, group in df.groupby(group_cols, dropna=False):
        if not isinstance(keys, tuple):
            keys = (keys,)
        pnl = group["net_pnl"]
        trades = len(group)
        row = dict(zip(group_cols, keys))
        row.update({
            "trades": trades,
            "sample_level": sample_level(trades),
            "wins": int((pnl > 0).sum()),
            "losses": int((pnl < 0).sum()),
            "win_rate": float((pnl > 0).mean()) if trades else 0.0,
            "gross_pnl": float(group["gross_pnl"].sum()),
            "cost": float(group["cost"].sum()),
            "pnl": float(pnl.sum()),
            "expectancy": float(pnl.mean()) if trades else 0.0,
            "profit_factor": profit_factor(pnl),
            "max_drawdown_pnl": max_drawdown_from_curve(group.sort_values("date")["net_pnl"].cumsum().tolist()),
        })
        rows.append(row)
    return pd.DataFrame(rows)


def attach_regime(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["regime"] = "unclassified"
    for name, start, end in REGIMES:
        start_dt = pd.Timestamp(start)
        end_dt = pd.Timestamp(end) if end else pd.Timestamp.max
        mask = (out["date"] >= start_dt) & (out["date"] <= end_dt)
        out.loc[mask, "regime"] = name
    return out


def run(args: argparse.Namespace) -> None:
    input_path = Path(args.input)
    if not input_path.exists():
        raise SystemExit(f"Missing research file: {input_path}")
    df = pd.read_csv(input_path)
    if df.empty:
        raise SystemExit("Research file is empty")
    required = {"date", "ticker", "signal", "gross_pnl", "cost", "net_pnl"}
    missing = required - set(df.columns)
    if missing:
        raise SystemExit(f"Missing required columns: {sorted(missing)}")
    df["date"] = pd.to_datetime(df["date"])
    df = attach_regime(df).sort_values("date")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    by_regime = summarize(df, ["regime"])
    by_regime_signal = summarize(df, ["regime", "signal"])
    by_regime_ticker = summarize(df, ["regime", "ticker"])

    by_regime.to_csv(output_dir / "leveraged_hunter_research_by_regime.csv", index=False)
    by_regime_signal.to_csv(output_dir / "leveraged_hunter_research_by_regime_signal.csv", index=False)
    by_regime_ticker.to_csv(output_dir / "leveraged_hunter_research_by_regime_ticker.csv", index=False)

    print("Regime analysis complete")
    print(f"Regimes: {', '.join(by_regime['regime'].astype(str).tolist())}")
    print(f"Wrote: {output_dir / 'leveraged_hunter_research_by_regime.csv'}")
    print(f"Wrote: {output_dir / 'leveraged_hunter_research_by_regime_signal.csv'}")
    print(f"Wrote: {output_dir / 'leveraged_hunter_research_by_regime_ticker.csv'}")


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Leveraged Hunter regime analysis")
    parser.add_argument("--input", default="reports/backtests/leveraged_hunter_research.csv")
    parser.add_argument("--output-dir", default="reports/backtests")
    return parser.parse_args(argv)


if __name__ == "__main__":
    run(parse_args())
