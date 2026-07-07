#!/usr/bin/env python3
from __future__ import annotations

import math
from pathlib import Path
import pandas as pd

TICKERS = ["BTC-USD", "NVDA", "TSM", "AMD", "AVGO", "MRVL", "RKLB", "GOOGL", "QQQ"]
WINDOWS = [21, 63, 126, 252]
SCHEMES = {
    "BTC-USD": [("BTC_A", [-0.20, -0.35, -0.50, -0.65, -0.80]), ("BTC_B", [-0.25, -0.40, -0.55, -0.70, -0.85])],
    "QQQ": [("ETF_A", [-0.10, -0.20, -0.30]), ("ETF_B", [-0.15, -0.25, -0.35])],
    "RKLB": [("HIGH_GROWTH_A", [-0.35, -0.50, -0.65])],
}
AI_SCHEMES = [("AI_A", [-0.15, -0.25, -0.35, -0.50]), ("AI_B", [-0.20, -0.30, -0.40, -0.55]), ("AI_C", [-0.25, -0.35, -0.45, -0.60])]

ENGINE = {
    "BTC-USD": "比特幣引擎",
    "QQQ": "核心ETF",
    "RKLB": "高成長深折扣",
    "NVDA": "AI基礎建設",
    "TSM": "AI基礎建設",
    "AMD": "AI基礎建設",
    "AVGO": "AI基礎建設",
    "MRVL": "AI基礎建設",
    "GOOGL": "平台型公司",
}


def flatten_columns(df: pd.DataFrame) -> pd.DataFrame:
    if isinstance(df.columns, pd.MultiIndex):
        level = 0
        for i in range(df.columns.nlevels):
            vals = [str(x).lower() for x in df.columns.get_level_values(i)]
            if any(v in {"date", "open", "high", "low", "close", "adj close", "volume"} for v in vals):
                level = i
                break
        df = df.copy()
        df.columns = df.columns.get_level_values(level)
    return df


def load_price(ticker: str) -> pd.DataFrame:
    import yfinance as yf
    raw = yf.download(ticker, start="2010-01-01", auto_adjust=True, progress=False)
    if raw.empty:
        raise ValueError(f"no data for {ticker}")
    raw = flatten_columns(raw.reset_index())
    cols = {str(c).lower().strip().replace(" ", "_"): c for c in raw.columns}
    date_col = cols.get("date") or cols.get("datetime")
    close_col = cols.get("close") or cols.get("adj_close")
    if date_col is None or close_col is None:
        raise ValueError(f"bad columns for {ticker}: {list(raw.columns)}")
    out = pd.DataFrame({"date": pd.to_datetime(raw[date_col]).dt.tz_localize(None), "close": pd.to_numeric(raw[close_col], errors="coerce")})
    out = out.dropna().sort_values("date").drop_duplicates("date").reset_index(drop=True)
    out["ticker"] = ticker
    return out


def add_reference(df: pd.DataFrame, ticker: str) -> pd.DataFrame:
    out = df.copy()
    if ticker == "BTC-USD":
        out["reference_high"] = out["close"].cummax()
        out["reference_mode"] = "cycle_high"
    else:
        out["reference_high"] = out["close"].rolling(252, min_periods=120).max()
        out["reference_mode"] = "52w_high"
    out["drawdown"] = out["close"] / out["reference_high"] - 1
    return out.dropna().reset_index(drop=True)


def schemes_for(ticker: str):
    return SCHEMES.get(ticker, AI_SCHEMES)


def find_events(df: pd.DataFrame, ticker: str) -> pd.DataFrame:
    rows = []
    for scheme, layers in schemes_for(ticker):
        state = {layer: False for layer in layers}
        for i, r in df.iterrows():
            dd = float(r.drawdown)
            if dd > -0.05:
                state = {layer: False for layer in layers}
            for idx, layer in enumerate(layers):
                if dd <= layer and not state[layer]:
                    state[layer] = True
                    e = {
                        "ticker": ticker,
                        "engine": ENGINE.get(ticker, "AI基礎建設"),
                        "scheme": scheme,
                        "layer": f"L{idx+1}",
                        "threshold": layer,
                        "date": r.date,
                        "close": float(r.close),
                        "reference_high": float(r.reference_high),
                        "reference_mode": r.reference_mode,
                        "drawdown": dd,
                    }
                    for w in WINDOWS:
                        e[f"ret_{w}d"] = float(df.iloc[i+w].close) / float(r.close) - 1 if i + w < len(df) else math.nan
                    e["max_adverse_252d"] = df.iloc[i:min(i+252, len(df))].close.min() / float(r.close) - 1
                    rows.append(e)
    return pd.DataFrame(rows)


def pct(x):
    return "" if pd.isna(x) else f"{x:.2%}"


def main():
    out_dir = Path("reports/backtests")
    out_dir.mkdir(parents=True, exist_ok=True)
    events = []
    skipped = []
    for ticker in TICKERS:
        try:
            events.append(find_events(add_reference(load_price(ticker), ticker), ticker))
        except Exception as exc:
            skipped.append({"ticker": ticker, "status": "DATA_PENDING", "error": str(exc)})
            print(f"SKIP {ticker}: {exc}")
    ev = pd.concat(events, ignore_index=True) if events else pd.DataFrame()
    if ev.empty:
        ev.to_csv(out_dir / "discount_hunter_events.csv", index=False)
        pd.DataFrame(skipped).to_csv(out_dir / "discount_hunter_pending.csv", index=False)
        print("No events")
        return
    rows = []
    for keys, g in ev.groupby(["ticker", "engine", "scheme", "reference_mode"]):
        ticker, engine, scheme, mode = keys
        row = {"ticker": ticker, "engine": engine, "scheme": scheme, "reference_mode": mode, "events": len(g), "avg_drawdown_at_trigger": g.drawdown.mean(), "avg_max_adverse_252d": g.max_adverse_252d.mean()}
        for w in WINDOWS:
            col = f"ret_{w}d"
            row[f"avg_{col}"] = g[col].mean()
            row[f"win_rate_{col}"] = (g[col] > 0).mean()
        rows.append(row)
    sm = pd.DataFrame(rows).sort_values(["engine", "ticker", "scheme"])
    for frame in (ev, sm):
        for col in frame.columns:
            if col.startswith("ret_") or col.startswith("avg_ret_") or col.startswith("win_rate_") or col in {"threshold", "drawdown", "avg_drawdown_at_trigger", "avg_max_adverse_252d", "max_adverse_252d"}:
                frame[col] = frame[col].map(pct)
    ev.to_csv(out_dir / "discount_hunter_events.csv", index=False)
    sm.to_csv(out_dir / "discount_hunter_summary.csv", index=False)
    if skipped:
        pd.DataFrame(skipped).to_csv(out_dir / "discount_hunter_pending.csv", index=False)
    print(f"Core Discount Hunter backtest complete. Events: {len(ev)}")


if __name__ == "__main__":
    main()
