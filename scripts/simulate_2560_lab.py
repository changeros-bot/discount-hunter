#!/usr/bin/env python3
"""2560 Lab V0.4 research simulation. No orders, no brokerage integration."""
from __future__ import annotations

import argparse, math
from pathlib import Path
from typing import Dict, Optional, Sequence

try:
    import pandas as pd
except ImportError as exc:
    raise SystemExit("pandas is required") from exc

FOCUS = {"AI半導體", "大型科技平台", "高波動成長股"}
WINDOWS = {"base_60d": 60, "risk_30d": 30, "trend_60d": 60}


def norm(t):
    return str(t).upper().replace("/", "-")


def flat(raw):
    if isinstance(raw.columns, pd.MultiIndex):
        level = 0
        for i in range(raw.columns.nlevels):
            vals = [str(x).lower() for x in raw.columns.get_level_values(i)]
            if any(v in {"open", "high", "low", "close", "adj close", "volume"} for v in vals):
                level = i; break
        raw = raw.copy(); raw.columns = raw.columns.get_level_values(level)
    return raw


def clean(df, ticker):
    cols = {str(c).lower().strip().replace(" ", "_"): c for c in df.columns}
    date_col = cols.get("date") or cols.get("datetime")
    close_col = cols.get("adj_close") or cols.get("close") or cols.get("price")
    if date_col is None or close_col is None or cols.get("volume") is None:
        raise ValueError(f"{ticker}: missing date/close/volume")
    close = pd.to_numeric(df[close_col], errors="coerce")
    out = pd.DataFrame({
        "date": pd.to_datetime(df[date_col]),
        "close": close,
        "high": pd.to_numeric(df[cols.get("high")], errors="coerce") if cols.get("high") else close,
        "low": pd.to_numeric(df[cols.get("low")], errors="coerce") if cols.get("low") else close,
        "volume": pd.to_numeric(df[cols["volume"]], errors="coerce"),
    }).dropna().sort_values("date").drop_duplicates("date")
    return indicators(out.reset_index(drop=True))


def indicators(df):
    out = df.copy()
    out["ma25"] = out["close"].rolling(25, min_periods=25).mean()
    out["vol5"] = out["volume"].rolling(5, min_periods=5).mean()
    out["vol60"] = out["volume"].rolling(60, min_periods=30).mean()
    prev = out["close"].shift(1)
    tr = pd.concat([(out["high"] - out["low"]), (out["high"] - prev).abs(), (out["low"] - prev).abs()], axis=1).max(axis=1)
    out["atr14"] = tr.rolling(14, min_periods=14).mean()
    return out.dropna().reset_index(drop=True)


def load_price(ticker, args, cache: Dict[str, pd.DataFrame]):
    if ticker in cache: return cache[ticker]
    if args.source == "csv":
        p = Path(args.data_dir) / f"{ticker}.csv"
        data = clean(pd.read_csv(p), ticker)
    else:
        import yfinance as yf
        raw = yf.download(ticker, start=args.start, auto_adjust=True, progress=False)
        data = clean(flat(raw).reset_index(), ticker)
    cache[ticker] = data
    return data


def simulate(prices, date, entry, rule, cost):
    idxs = prices.index[prices["date"] >= date].tolist()
    if not idxs: return None
    start = idxs[0]; top = entry; max_days = WINDOWS[rule]
    for d in range(1, max_days + 1):
        i = start + d
        if i >= len(prices): break
        r = prices.iloc[i]; close = float(r["close"]); top = max(top, close)
        gross = close / entry - 1.0; reason = None
        if rule == "base_60d":
            if close < float(r["ma25"]): reason = "close_below_ma25"
            elif float(r["vol5"]) < float(r["vol60"]): reason = "volume_weak"
        elif rule == "risk_30d":
            if gross <= -0.08: reason = "risk_stop"
            elif gross >= 0.15: reason = "target_reached"
        elif rule == "trend_60d":
            if close < float(r["ma25"]): reason = "close_below_ma25"
            elif close <= top - 2.0 * float(r["atr14"]): reason = "atr_trail"
        if reason:
            return {"exit_date": r["date"], "exit_price": close, "hold_days": d, "exit_reason": reason, "gross_return": gross, "net_return": gross - cost}
    i = min(start + max_days, len(prices) - 1); r = prices.iloc[i]
    gross = float(r["close"]) / entry - 1.0
    return {"exit_date": r["date"], "exit_price": float(r["close"]), "hold_days": i - start, "exit_reason": f"max_{max_days}d", "gross_return": gross, "net_return": gross - cost}


def summary(df, cols):
    if df.empty: return pd.DataFrame()
    rows = []
    for keys, g in df.groupby(list(cols), dropna=False):
        if not isinstance(keys, tuple): keys = (keys,)
        wins = g[g.net_return > 0]; losses = g[g.net_return <= 0]
        gp = wins.net_return.sum(); gl = abs(losses.net_return.sum())
        row = {c: v for c, v in zip(cols, keys)}
        row.update({"trades": len(g), "win_rate": (g.net_return > 0).mean(), "avg_net_return": g.net_return.mean(), "median_net_return": g.net_return.median(), "avg_hold_days": g.hold_days.mean(), "profit_factor": gp / gl if gl > 0 else math.nan, "worst": g.net_return.min(), "best": g.net_return.max()})
        rows.append(row)
    return pd.DataFrame(rows).sort_values(list(cols))


def fmt(df):
    out = df.copy()
    for c in out.columns:
        if c in {"gross_return", "net_return", "win_rate", "avg_net_return", "median_net_return", "worst", "best"}:
            out[c] = out[c].map(lambda x: "" if pd.isna(x) else f"{x:.2%}")
        if c in {"avg_hold_days", "profit_factor"}:
            out[c] = out[c].map(lambda x: "" if pd.isna(x) else f"{x:.2f}")
    return out


def run(args):
    events = pd.read_csv(args.input_events)
    events["date"] = pd.to_datetime(events["date"])
    events = events[events["industry"].isin(FOCUS)]
    cache = {}; rows = []
    for _, e in events.iterrows():
        try:
            p = load_price(norm(e.ticker), args, cache)
            for rule in args.rules:
                result = simulate(p, e.date, float(e.close), rule, args.cost)
                if result:
                    rows.append({"ticker": norm(e.ticker), "industry": e.industry, "pattern": e.pattern, "entry_date": e.date, "entry_price": float(e.close), "rule": rule, "cost": args.cost, **result})
        except Exception as exc:
            print(f"SKIP {e.ticker}: {exc}")
    trades = pd.DataFrame(rows); out = Path(args.output_dir); out.mkdir(parents=True, exist_ok=True)
    fmt(trades).to_csv(out / "2560_sim_events.csv", index=False)
    fmt(summary(trades, ("rule",))).to_csv(out / "2560_sim_summary.csv", index=False)
    fmt(summary(trades, ("industry", "rule"))).to_csv(out / "2560_sim_by_industry.csv", index=False)
    fmt(summary(trades, ("pattern", "rule"))).to_csv(out / "2560_sim_by_pattern.csv", index=False)
    fmt(summary(trades, ("rule", "exit_reason"))).to_csv(out / "2560_sim_by_exit.csv", index=False)
    print(f"2560 lab simulation complete. Rows: {len(trades)}")


def parse_args(argv: Optional[Sequence[str]] = None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--input-events", default="reports/backtests/2560_sector_events.csv")
    ap.add_argument("--source", choices=("csv", "yfinance"), default="yfinance")
    ap.add_argument("--data-dir", default="data/prices")
    ap.add_argument("--output-dir", default="reports/backtests")
    ap.add_argument("--start", default="2010-01-01")
    ap.add_argument("--cost", type=float, default=0.002)
    ap.add_argument("--rules", nargs="+", default=["base_60d", "risk_30d", "trend_60d"])
    return ap.parse_args(argv)

if __name__ == "__main__":
    run(parse_args())
