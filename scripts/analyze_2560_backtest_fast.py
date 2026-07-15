#!/usr/bin/env python3
"""Optimized second-stage validation for the 2560 ten-year backtest."""
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
OUT = ROOT / "reports" / "backtest"
TRADES = OUT / "2560_10y_trades.csv"
REGISTRY = ROOT / "config" / "2560-universe.json"
START = (date.today() - timedelta(days=3653)).isoformat()
END = (date.today() + timedelta(days=1)).isoformat()
TARGETS = [0.10, 0.15, 0.20, 0.25]
ATR_STOPS = [1.0, 1.5, 2.0, 2.5]
MAX_DAYS = [15, 20, 30, 45, 60]
SLIPPAGE = 0.002


def bh(pvals):
    p = np.asarray(pvals, float)
    n = len(p)
    order = np.argsort(p)
    ranked = p[order]
    out = np.empty(n)
    running = 1.0
    for i in range(n - 1, -1, -1):
        running = min(running, ranked[i] * n / (i + 1))
        out[order[i]] = running
    return out


def significance(trades):
    rows = []
    all_returns = trades.return_pct.to_numpy(float)
    for ticker, g in trades.groupby("ticker"):
        a = g.return_pct.to_numpy(float)
        b = trades.loc[trades.ticker != ticker, "return_pct"].to_numpy(float)
        if len(a) < 5:
            continue
        t = stats.ttest_ind(a, b, equal_var=False)
        u = stats.mannwhitneyu(a, b, alternative="two-sided")
        rows.append({
            "ticker": ticker, "trades": len(a), "mean_return": a.mean(),
            "median_return": np.median(a), "overall_mean": all_returns.mean(),
            "mean_difference_vs_others": a.mean() - b.mean(),
            "welch_p": t.pvalue, "mann_whitney_p": u.pvalue,
        })
    df = pd.DataFrame(rows)
    df["welch_q_bh"] = bh(df.welch_p)
    df["mann_whitney_q_bh"] = bh(df.mann_whitney_p)
    df["significantly_worse_fdr_5pct"] = (
        (df.mean_difference_vs_others < 0)
        & ((df.welch_q_bh < 0.05) | (df.mann_whitney_q_bh < 0.05))
    )
    return df.sort_values(["significantly_worse_fdr_5pct", "mean_difference_vs_others"], ascending=[False, True])


def holding(trades):
    p = stats.pearsonr(trades.hold_days, trades.return_pct)
    s = stats.spearmanr(trades.hold_days, trades.return_pct)
    bins = [-1, 5, 10, 15, 20, 30, 45, 60, 10000]
    labels = ["0-5", "6-10", "11-15", "16-20", "21-30", "31-45", "46-60", "60+"]
    x = trades.copy()
    x["bucket"] = pd.cut(x.hold_days, bins=bins, labels=labels)
    buckets = x.groupby("bucket", observed=False).return_pct.agg(
        trades="size", win_rate=lambda z: (z > 0).mean(),
        average_return="mean", median_return="median", total_return="sum",
    ).reset_index()
    return {
        "pearson_r": float(p.statistic), "pearson_p": float(p.pvalue),
        "spearman_rho": float(s.statistic), "spearman_p": float(s.pvalue),
    }, buckets


def time_splits(trades):
    x = trades.copy()
    x["exit_date"] = pd.to_datetime(x.exit_date)
    x["period"] = np.where(x.exit_date < "2021-07-15", "2016-2021", "2021-2026")
    rows = []
    for (period, pattern), g in x.groupby(["period", "pattern"]):
        gp = g.loc[g.return_pct > 0, "return_pct"].sum()
        gl = g.loc[g.return_pct <= 0, "return_pct"].sum()
        rows.append({
            "period": period, "pattern": pattern, "trades": len(g),
            "win_rate": (g.return_pct > 0).mean(), "average_return": g.return_pct.mean(),
            "median_return": g.return_pct.median(), "profit_factor": None if gl == 0 else gp / abs(gl),
        })
    return pd.DataFrame(rows)


def universe():
    payload = json.loads(REGISTRY.read_text(encoding="utf8"))
    seen = set()
    rows = []
    for x in payload["symbols"]:
        ticker = str(x.get("ticker", "")).upper()
        if ticker and ticker not in seen and x.get("scan_enabled") and x.get("data_symbol"):
            seen.add(ticker)
            rows.append(x)
    return rows


def prepare(item):
    raw = yf.download(item["data_symbol"], start=START, end=END, auto_adjust=True, progress=False, threads=False)
    if raw.empty:
        raise ValueError("no_data")
    p = engine.clean(engine.flat(raw).reset_index())
    evaluations = [engine.evaluate_signal(row) for _, row in p.iterrows()]
    built = np.array([
        e["stage_status"] == "TRIGGERED" and e["gate_status"] == "PASS"
        and e["risk_status"] == "NORMAL" and e["pattern_type"] == "BUILT_VOLUME"
        and engine.allowed_for_ticker(item["ticker"], "BUILT_VOLUME")
        for e in evaluations
    ], dtype=bool)
    failed = np.array([e["risk_status"] == "FAILED" for e in evaluations], dtype=bool)
    too_deep = np.array([e["risk_status"] == "TOO_DEEP" for e in evaluations], dtype=bool)
    return p, built, failed, too_deep


def simulate(prepared, target, atr_mult, max_days):
    returns = []
    for ticker, (p, built, failed, too_deep) in prepared.items():
        active = None
        for i in range(len(p)):
            row = p.iloc[i]
            if active:
                hold = i - active[0]
                close = float(row.close)
                if close <= active[2] or failed[i] or close >= active[3] or hold >= max_days or too_deep[i]:
                    returns.append(close / active[1] - 1)
                    active = None
            if active is None and i + 1 < len(p) and built[i]:
                entry = float(p.iloc[i + 1].open) * (1 + SLIPPAGE)
                structure = float(row.pullback_low) - engine.STRUCTURE_BUFFER_ATR * float(row.atr14)
                atr_stop = entry - atr_mult * float(row.atr14)
                active = (i + 1, entry, max(structure, atr_stop), entry * (1 + target))
        if active:
            returns.append(float(p.iloc[-1].close) / active[1] - 1)
    return np.asarray(returns, float)


def grid_search():
    prepared = {}
    coverage = []
    for item in universe():
        try:
            prepared[item["ticker"]] = prepare(item)
            coverage.append({"ticker": item["ticker"], "status": "OK", "usable_days": len(prepared[item["ticker"]][0])})
        except Exception as exc:
            coverage.append({"ticker": item["ticker"], "status": "ERROR", "error": str(exc)})
    rows = []
    for target in TARGETS:
        for atr in ATR_STOPS:
            for days in MAX_DAYS:
                r = simulate(prepared, target, atr, days)
                gp, gl = r[r > 0].sum(), r[r <= 0].sum()
                rows.append({
                    "target_pct": target, "atr_stop_multiple": atr, "max_hold_days": days,
                    "trades": len(r), "win_rate": (r > 0).mean(), "average_return": r.mean(),
                    "median_return": np.median(r), "total_pnl_usd_100": r.sum() * 100,
                    "profit_factor": None if gl == 0 else gp / abs(gl),
                })
    return pd.DataFrame(rows).sort_values(["profit_factor", "average_return"], ascending=False), pd.DataFrame(coverage)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    trades = pd.read_csv(TRADES)
    trades.return_pct = pd.to_numeric(trades.return_pct, errors="coerce")
    trades.hold_days = pd.to_numeric(trades.hold_days, errors="coerce")
    trades = trades.dropna(subset=["return_pct", "hold_days"])

    sig = significance(trades)
    hold_summary, hold_buckets = holding(trades)
    splits = time_splits(trades)
    grid, coverage = grid_search()

    sig.to_csv(OUT / "2560_10y_ticker_significance.csv", index=False)
    hold_buckets.to_csv(OUT / "2560_10y_holding_buckets.csv", index=False)
    splits.to_csv(OUT / "2560_10y_time_splits.csv", index=False)
    grid.to_csv(OUT / "2560_10y_built_volume_grid.csv", index=False)
    coverage.to_csv(OUT / "2560_10y_grid_coverage.csv", index=False)

    current = grid[(grid.target_pct == 0.15) & (grid.atr_stop_multiple == 1.5) & (grid.max_hold_days == 30)]
    result = {
        "ticker_tests": {
            "tested_tickers": len(sig),
            "significantly_worse_fdr_5pct": sig.loc[sig.significantly_worse_fdr_5pct, "ticker"].tolist(),
        },
        "holding_period": hold_summary,
        "time_split": splits.to_dict(orient="records"),
        "built_volume_grid": {
            "combinations": len(grid), "current_rule": current.to_dict(orient="records"),
            "top_20": grid.head(20).to_dict(orient="records"),
            "warning": "In-sample grid only; no production rule change without walk-forward confirmation.",
        },
        "decision": "KEEP_CURRENT_RULES_PENDING_WALK_FORWARD",
    }
    (OUT / "2560_10y_statistical_analysis.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
