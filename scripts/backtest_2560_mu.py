#!/usr/bin/env python3
"""MU 2560 standalone backtest. Research only, no order execution."""
from __future__ import annotations

import argparse
import math
from pathlib import Path
from typing import Optional, Sequence

import pandas as pd

TICKER = "MU"
WINDOWS = [5, 10, 20, 30, 60]
RULES = ["base_60d", "risk_30d", "trend_60d"]


def flat(raw: pd.DataFrame) -> pd.DataFrame:
    if isinstance(raw.columns, pd.MultiIndex):
        level = 0
        for i in range(raw.columns.nlevels):
            vals = [str(x).lower() for x in raw.columns.get_level_values(i)]
            if any(v in {"open", "high", "low", "close", "adj close", "volume"} for v in vals):
                level = i
                break
        raw = raw.copy()
        raw.columns = raw.columns.get_level_values(level)
    return raw


def clean(df: pd.DataFrame) -> pd.DataFrame:
    cols = {str(c).lower().strip().replace(" ", "_"): c for c in df.columns}
    date_col = cols.get("date") or cols.get("datetime")
    open_col = cols.get("open")
    close_col = cols.get("adj_close") or cols.get("close") or cols.get("price")
    volume_col = cols.get("volume")
    if date_col is None or close_col is None or volume_col is None:
        raise ValueError(f"{TICKER}: needs date, close, volume")
    close = pd.to_numeric(df[close_col], errors="coerce")
    out = pd.DataFrame({
        "date": pd.to_datetime(df[date_col]),
        "open": pd.to_numeric(df[open_col], errors="coerce") if open_col is not None else close,
        "close": close,
        "high": pd.to_numeric(df[cols.get("high")], errors="coerce") if cols.get("high") else close,
        "low": pd.to_numeric(df[cols.get("low")], errors="coerce") if cols.get("low") else close,
        "volume": pd.to_numeric(df[volume_col], errors="coerce"),
    }).dropna().sort_values("date").drop_duplicates("date")
    return indicators(out.reset_index(drop=True))


def indicators(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["ma25"] = out["close"].rolling(25, min_periods=25).mean()
    out["ma25_rising_3d"] = (out["ma25"] > out["ma25"].shift(1)) & (out["ma25"].shift(1) > out["ma25"].shift(2))
    out["ma25_slope_5d"] = out["ma25"] / out["ma25"].shift(5) - 1.0
    prev = out["close"].shift(1)
    tr = pd.concat([(out["high"] - out["low"]), (out["high"] - prev).abs(), (out["low"] - prev).abs()], axis=1).max(axis=1)
    out["atr14"] = tr.rolling(14, min_periods=14).mean()
    out["ma25_distance_atr"] = (out["close"] - out["ma25"]).abs() / out["atr14"]
    out["near_ma25"] = out["ma25_distance_atr"] <= 1.5
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


def pattern(row: pd.Series) -> Optional[str]:
    if not bool(row["ma25_ok"]):
        return None
    near = bool(row["near_ma25"])
    vol_above = bool(row["vol_above"])
    vol_cross = bool(row["vol_cross_up"])
    shrink = bool(row["shrink"])
    low_vol = bool(row["low_volume_20d"])
    above_200 = bool(row["above_ma200"])
    rising = float(row["ret_3d"]) > 0 or float(row["ret_5d"]) > 0
    if not vol_above and not vol_cross and rising:
        return "弱量續攻"
    if bool(row["above_ma25"]) and vol_cross:
        return "沖量"
    if near and shrink and low_vol and above_200:
        return "縮量黑馬"
    if near and vol_above:
        return "波段"
    return None


def make_events(prices: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for i, row in prices.iterrows():
        p = pattern(row)
        if not p:
            continue
        event = {
            "ticker": TICKER,
            "industry": "AI半導體",
            "pattern": p,
            "date": row.date,
            "close": row.close,
            "ma25": row.ma25,
            "vol5": row.vol5,
            "vol60": row.vol60,
            "above_ma200": row.above_ma200,
        }
        for w in WINDOWS:
            event[f"ret_{w}d"] = prices.iloc[i+w].close / row.close - 1 if i + w < len(prices) else math.nan
        rows.append(event)
    return pd.DataFrame(rows)


def entry_from_next_open(prices: pd.DataFrame, signal_date, slippage: float):
    idxs = prices.index[prices["date"] > signal_date].tolist()
    if not idxs:
        return None
    idx = idxs[0]
    row = prices.iloc[idx]
    return idx, row.date, float(row.open) * (1 + slippage)


def simulate_trade(prices: pd.DataFrame, signal_date, rule: str, cost: float, slippage: float):
    entry = entry_from_next_open(prices, signal_date, slippage)
    if entry is None:
        return None
    start, entry_date, entry_price = entry
    max_days = 30 if rule == "risk_30d" else 60
    top = entry_price
    for d in range(1, max_days + 1):
        i = start + d
        if i >= len(prices):
            break
        r = prices.iloc[i]
        close = float(r.close)
        top = max(top, close)
        gross = close / entry_price - 1
        reason = None
        if rule == "base_60d":
            if close < float(r.ma25):
                reason = "close_below_ma25"
            elif float(r.vol5) < float(r.vol60):
                reason = "volume_weak"
        elif rule == "risk_30d":
            if gross <= -0.08:
                reason = "risk_stop"
            elif gross >= 0.15:
                reason = "target_reached"
        elif rule == "trend_60d":
            if close < float(r.ma25):
                reason = "close_below_ma25"
            elif close <= top - 2 * float(r.atr14):
                reason = "atr_trail"
        if reason:
            return {"entry_date": entry_date, "entry_price": entry_price, "exit_date": r.date, "exit_price": close, "hold_days": d, "exit_reason": reason, "gross_return": gross, "net_return": gross - cost}
    i = min(start + max_days, len(prices) - 1)
    r = prices.iloc[i]
    gross = float(r.close) / entry_price - 1
    return {"entry_date": entry_date, "entry_price": entry_price, "exit_date": r.date, "exit_price": float(r.close), "hold_days": i - start, "exit_reason": f"max_{max_days}d", "gross_return": gross, "net_return": gross - cost}


def summarize(df: pd.DataFrame, cols) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame()
    rows = []
    for keys, g in df.groupby(list(cols), dropna=False):
        if not isinstance(keys, tuple):
            keys = (keys,)
        wins = g[g.net_return > 0]
        losses = g[g.net_return <= 0]
        gross_profit = wins.net_return.sum()
        gross_loss = abs(losses.net_return.sum())
        row = {c: v for c, v in zip(cols, keys)}
        row.update({
            "trades": len(g),
            "win_rate": (g.net_return > 0).mean(),
            "avg_net_return": g.net_return.mean(),
            "median_net_return": g.net_return.median(),
            "avg_hold_days": g.hold_days.mean(),
            "profit_factor": gross_profit / gross_loss if gross_loss > 0 else math.nan,
            "worst": g.net_return.min(),
            "best": g.net_return.max(),
        })
        rows.append(row)
    return pd.DataFrame(rows).sort_values(list(cols))


def fmt(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for c in out.columns:
        if c.startswith("ret_") or c in {"gross_return", "net_return", "win_rate", "avg_net_return", "median_net_return", "worst", "best", "cost", "slippage"}:
            out[c] = out[c].map(lambda x: "" if pd.isna(x) else f"{x:.2%}")
        if c in {"avg_hold_days", "profit_factor"}:
            out[c] = out[c].map(lambda x: "" if pd.isna(x) else f"{x:.2f}")
    return out


def load_prices(args) -> pd.DataFrame:
    if args.source == "csv":
        return clean(pd.read_csv(Path(args.data_dir) / f"{TICKER}.csv"))
    import yfinance as yf
    raw = yf.download(TICKER, start=args.start, auto_adjust=True, progress=False)
    if raw.empty:
        raise ValueError("No yfinance data for MU")
    return clean(flat(raw).reset_index())


def run(args):
    prices = load_prices(args)
    events = make_events(prices)
    rows = []
    for _, event in events.iterrows():
        for rule in RULES:
            result = simulate_trade(prices, event.date, rule, args.cost, args.slippage)
            if result:
                rows.append({"ticker": TICKER, "industry": "AI半導體", "pattern": event.pattern, "signal_date": event.date, "rule": rule, "cost": args.cost, "slippage": args.slippage, **result})
    trades = pd.DataFrame(rows)
    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    fmt(events).to_csv(out / "mu_2560_events.csv", index=False)
    fmt(trades).to_csv(out / "mu_2560_trades.csv", index=False)
    fmt(summarize(trades, ("rule",))).to_csv(out / "mu_2560_summary.csv", index=False)
    fmt(summarize(trades, ("pattern", "rule"))).to_csv(out / "mu_2560_by_pattern.csv", index=False)
    fmt(summarize(trades, ("rule", "exit_reason"))).to_csv(out / "mu_2560_by_exit.csv", index=False)
    print(f"MU 2560 complete. events={len(events)}, trades={len(trades)}")


def parse_args(argv: Optional[Sequence[str]] = None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", choices=("csv", "yfinance"), default="yfinance")
    ap.add_argument("--data-dir", default="data/prices")
    ap.add_argument("--output-dir", default="reports/backtests")
    ap.add_argument("--start", default="2010-01-01")
    ap.add_argument("--cost", type=float, default=0.002)
    ap.add_argument("--slippage", type=float, default=0.002)
    return ap.parse_args(argv)


if __name__ == "__main__":
    run(parse_args())
