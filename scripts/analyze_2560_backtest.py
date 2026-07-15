#!/usr/bin/env python3
"""Second-stage statistical analysis for the 2560 ten-year backtest.

Outputs:
- Per-ticker Welch t-test and Mann-Whitney U versus all other trades.
- Benjamini-Hochberg false-discovery-rate adjustment.
- Holding-period/return diagnostics.
- BUILT_VOLUME parameter grid over target, ATR stop and max holding days.

This script does not change production rules. It is decision support only.
"""
from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf
from scipy import stats

import paper_2560_bot as engine

ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "reports" / "backtest"
TRADES_PATH = REPORT_DIR / "2560_10y_trades.csv"
REGISTRY_PATH = ROOT / "config" / "2560-universe.json"
START = (date.today() - timedelta(days=3653)).isoformat()
END = (date.today() + timedelta(days=1)).isoformat()
SLIPPAGE = 0.002
STAKE = 100.0

TARGETS = [0.10, 0.15, 0.20, 0.25]
ATR_STOPS = [1.0, 1.5, 2.0, 2.5]
MAX_DAYS = [15, 20, 30, 45, 60]


def bh_adjust(p_values):
    p = np.asarray(p_values, dtype=float)
    n = len(p)
    order = np.argsort(p)
    ranked = p[order]
    adjusted = np.empty(n, dtype=float)
    running = 1.0
    for i in range(n - 1, -1, -1):
        rank = i + 1
        running = min(running, ranked[i] * n / rank)
        adjusted[order[i]] = running
    return adjusted


def ticker_significance(trades):
    rows = []
    for ticker, group in trades.groupby("ticker"):
        a = group["return_pct"].dropna().astype(float).to_numpy()
        b = trades.loc[trades.ticker != ticker, "return_pct"].dropna().astype(float).to_numpy()
        if len(a) < 5 or len(b) < 20:
            continue
        t = stats.ttest_ind(a, b, equal_var=False, alternative="two-sided")
        u = stats.mannwhitneyu(a, b, alternative="two-sided")
        rows.append({
            "ticker": ticker,
            "trades": len(a),
            "mean_return": float(np.mean(a)),
            "median_return": float(np.median(a)),
            "other_mean_return": float(np.mean(b)),
            "mean_difference": float(np.mean(a) - np.mean(b)),
            "welch_t_stat": float(t.statistic),
            "welch_t_p": float(t.pvalue),
            "mann_whitney_u": float(u.statistic),
            "mann_whitney_p": float(u.pvalue),
        })
    out = pd.DataFrame(rows)
    if not out.empty:
        out["welch_t_q_bh"] = bh_adjust(out["welch_t_p"].values)
        out["mann_whitney_q_bh"] = bh_adjust(out["mann_whitney_p"].values)
        out["significantly_worse_fdr_5pct"] = (
            (out["mean_difference"] < 0)
            & ((out["welch_t_q_bh"] < 0.05) | (out["mann_whitney_q_bh"] < 0.05))
        )
        out = out.sort_values(["significantly_worse_fdr_5pct", "mean_difference"], ascending=[False, True])
    return out


def holding_analysis(trades):
    frame = trades.copy()
    frame["hold_days"] = pd.to_numeric(frame["hold_days"], errors="coerce")
    frame["return_pct"] = pd.to_numeric(frame["return_pct"], errors="coerce")
    frame = frame.dropna(subset=["hold_days", "return_pct"])
    pearson = stats.pearsonr(frame.hold_days, frame.return_pct)
    spearman = stats.spearmanr(frame.hold_days, frame.return_pct)
    bins = [-0.1, 5, 10, 15, 20, 30, 45, 60, 10_000]
    labels = ["0-5", "6-10", "11-15", "16-20", "21-30", "31-45", "46-60", "60+"]
    frame["hold_bucket"] = pd.cut(frame.hold_days, bins=bins, labels=labels)
    grouped = frame.groupby("hold_bucket", observed=False).agg(
        trades=("return_pct", "size"),
        win_rate=("return_pct", lambda x: float((x > 0).mean())),
        average_return=("return_pct", "mean"),
        median_return=("return_pct", "median"),
        total_pnl_usd_100=("return_pct", lambda x: float(x.sum() * STAKE)),
    ).reset_index()
    summary = {
        "pearson_r": float(pearson.statistic),
        "pearson_p": float(pearson.pvalue),
        "spearman_rho": float(spearman.statistic),
        "spearman_p": float(spearman.pvalue),
    }
    return summary, grouped


def load_universe():
    payload = json.loads(REGISTRY_PATH.read_text(encoding="utf8"))
    seen = set()
    rows = []
    for item in payload.get("symbols", []):
        ticker = str(item.get("ticker", "")).strip().upper()
        symbol = item.get("data_symbol")
        if not ticker or ticker in seen or not item.get("scan_enabled") or not symbol:
            continue
        seen.add(ticker)
        rows.append({**item, "ticker": ticker})
    return rows


def download(item):
    raw = yf.download(item["data_symbol"], start=START, end=END, auto_adjust=True, progress=False, threads=False)
    if raw.empty:
        raise ValueError("no_data")
    return engine.clean(engine.flat(raw).reset_index())


def built_signal_indices(prices, ticker):
    indices = []
    for i in range(len(prices) - 1):
        row = prices.iloc[i]
        signal = engine.evaluate_signal(row)
        if (
            signal["stage_status"] == "TRIGGERED"
            and signal["gate_status"] == "PASS"
            and signal["risk_status"] == "NORMAL"
            and signal["pattern_type"] == "BUILT_VOLUME"
            and engine.allowed_for_ticker(ticker, "BUILT_VOLUME")
        ):
            indices.append(i)
    return indices


def simulate_built(prices, ticker, target, atr_multiple, max_days):
    signals = built_signal_indices(prices, ticker)
    signal_set = set(signals)
    trades = []
    active = None
    for i in range(len(prices)):
        row = prices.iloc[i]
        if active is not None:
            hold = i - active["entry_index"]
            close = float(row.close)
            current = engine.evaluate_signal(row)
            reason = None
            if close <= active["stop"] or current["risk_status"] == "FAILED":
                reason = "stop_or_structure"
            elif close >= active["target"]:
                reason = "target"
            elif hold >= max_days:
                reason = "time"
            elif current["risk_status"] == "TOO_DEEP":
                reason = "too_deep"
            if reason:
                trades.append(close / active["entry"] - 1.0)
                active = None
        if active is None and i in signal_set and i + 1 < len(prices):
            signal_row = prices.iloc[i]
            entry_row = prices.iloc[i + 1]
            entry = float(entry_row.open) * (1 + SLIPPAGE)
            structure_stop = float(signal_row.pullback_low) - engine.STRUCTURE_BUFFER_ATR * float(signal_row.atr14)
            atr_stop = entry - atr_multiple * float(signal_row.atr14)
            active = {
                "entry_index": i + 1,
                "entry": entry,
                "stop": max(structure_stop, atr_stop),
                "target": entry * (1 + target),
            }
    if active is not None:
        trades.append(float(prices.iloc[-1].close) / active["entry"] - 1.0)
    return trades


def built_grid():
    universe = load_universe()
    cache = {}
    coverage = []
    for item in universe:
        try:
            prices = download(item)
            cache[item["ticker"]] = prices
            coverage.append({"ticker": item["ticker"], "status": "OK", "usable_days": len(prices)})
        except Exception as exc:  # noqa: BLE001
            coverage.append({"ticker": item["ticker"], "status": "ERROR", "error": str(exc)})

    rows = []
    for target in TARGETS:
        for atr_multiple in ATR_STOPS:
            for max_days in MAX_DAYS:
                returns = []
                for ticker, prices in cache.items():
                    returns.extend(simulate_built(prices, ticker, target, atr_multiple, max_days))
                arr = np.asarray(returns, dtype=float)
                if arr.size == 0:
                    continue
                gp = arr[arr > 0].sum() * STAKE
                gl = arr[arr <= 0].sum() * STAKE
                rows.append({
                    "target_pct": target,
                    "atr_stop_multiple": atr_multiple,
                    "max_hold_days": max_days,
                    "trades": int(arr.size),
                    "win_rate": float((arr > 0).mean()),
                    "average_return": float(arr.mean()),
                    "median_return": float(np.median(arr)),
                    "total_pnl_usd_100": float(arr.sum() * STAKE),
                    "profit_factor": None if gl == 0 else float(gp / abs(gl)),
                })
    grid = pd.DataFrame(rows).sort_values(["profit_factor", "average_return"], ascending=False)
    return grid, pd.DataFrame(coverage)


def main():
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    trades = pd.read_csv(TRADES_PATH)
    trades["return_pct"] = pd.to_numeric(trades["return_pct"], errors="coerce")
    trades = trades.dropna(subset=["return_pct"])

    significance = ticker_significance(trades)
    hold_summary, hold_buckets = holding_analysis(trades)
    grid, grid_coverage = built_grid()

    significance.to_csv(REPORT_DIR / "2560_10y_ticker_significance.csv", index=False)
    hold_buckets.to_csv(REPORT_DIR / "2560_10y_holding_buckets.csv", index=False)
    grid.to_csv(REPORT_DIR / "2560_10y_built_volume_grid.csv", index=False)
    grid_coverage.to_csv(REPORT_DIR / "2560_10y_grid_coverage.csv", index=False)

    current = grid[(grid.target_pct == 0.15) & (grid.atr_stop_multiple == 1.5) & (grid.max_hold_days == 30)]
    top = grid.head(20)
    result = {
        "ticker_tests": {
            "method": "Welch t-test and Mann-Whitney U versus all other trades; Benjamini-Hochberg FDR correction",
            "tested_tickers": int(len(significance)),
            "significantly_worse_fdr_5pct": significance.loc[significance.significantly_worse_fdr_5pct, "ticker"].tolist(),
        },
        "holding_period": hold_summary,
        "built_volume_grid": {
            "combinations": int(len(grid)),
            "current_rule": current.to_dict(orient="records"),
            "top_20": top.to_dict(orient="records"),
            "warning": "Grid results are in-sample and must not be adopted without walk-forward or out-of-sample confirmation.",
        },
        "decision_rule": "Do not exclude tickers or change BUILT_VOLUME until significance, parameter stability and out-of-sample checks agree.",
    }
    (REPORT_DIR / "2560_10y_statistical_analysis.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
