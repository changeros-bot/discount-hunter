#!/usr/bin/env python3
from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import pandas as pd

CANDIDATES = {
    "BAI": {
        "aliases": ["BAI"],
        "name": "BlackRock AI / AI thematic ETF candidate",
        "engine": "主題ETF",
        "schemes": ["ETF_A", "ETF_B"],
    },
    "UFO": {
        "aliases": ["UFO"],
        "name": "Space economy ETF candidate",
        "engine": "主題ETF",
        "schemes": ["ETF_A", "ETF_B"],
    },
    "CNDX": {
        "aliases": ["CNDX.L", "CNDX"],
        "name": "Nasdaq 100 UCITS ETF candidate",
        "engine": "核心ETF代理",
        "schemes": ["ETF_A", "ETF_B"],
    },
    "ARM": {
        "aliases": ["ARM"],
        "name": "AI semiconductor stock candidate",
        "engine": "AI基礎建設",
        "schemes": ["AI_A", "AI_B", "AI_C"],
    },
}

SCHEMES: Dict[str, Tuple[str, List[float]]] = {
    "ETF_A": ("ETF_A_10_20_30", [-0.10, -0.20, -0.30]),
    "ETF_B": ("ETF_B_15_25_35", [-0.15, -0.25, -0.35]),
    "AI_A": ("AI_A_15_25_35_50", [-0.15, -0.25, -0.35, -0.50]),
    "AI_B": ("AI_B_20_30_40_55", [-0.20, -0.30, -0.40, -0.55]),
    "AI_C": ("AI_C_25_35_45_60", [-0.25, -0.35, -0.45, -0.60]),
}

FORWARD_WINDOWS = (21, 63, 126, 252)
FILTERS = ("D_ONLY", "D_MA25", "D_VOLUME", "D_2560")


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


def load_price(display_symbol: str, meta: dict, start: str = "2010-01-01") -> tuple[pd.DataFrame, str]:
    import yfinance as yf

    last_error = None
    for ticker in meta["aliases"]:
        try:
            raw = yf.download(ticker, start=start, auto_adjust=True, progress=False)
            if raw.empty:
                raise ValueError("empty yfinance response")
            raw = flatten_columns(raw.reset_index())
            cols = {str(c).lower().strip().replace(" ", "_"): c for c in raw.columns}
            date_col = cols.get("date") or cols.get("datetime")
            close_col = cols.get("close") or cols.get("adj_close")
            volume_col = cols.get("volume")
            if date_col is None or close_col is None:
                raise ValueError(f"bad columns: {list(raw.columns)}")
            out = pd.DataFrame({
                "date": pd.to_datetime(raw[date_col]).dt.tz_localize(None),
                "close": pd.to_numeric(raw[close_col], errors="coerce"),
                "volume": pd.to_numeric(raw[volume_col], errors="coerce") if volume_col is not None else math.nan,
            })
            out = out.dropna(subset=["date", "close"]).sort_values("date").drop_duplicates("date").reset_index(drop=True)
            if len(out) < 300:
                raise ValueError(f"not enough rows for backtest: {len(out)}")
            out["ticker"] = display_symbol
            out["data_symbol"] = ticker
            return out, ticker
        except Exception as exc:
            last_error = exc
    raise ValueError(str(last_error) if last_error else "no data")


def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["reference_high"] = out["close"].rolling(252, min_periods=120).max()
    out["reference_mode"] = "52w_high"
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


def filter_pass(row: pd.Series, filter_name: str) -> bool:
    if filter_name == "D_ONLY":
        return True
    ma25_ok = bool(row.get("ma25_ok", False))
    near_ma25 = bool(row.get("price_near_ma25", False))
    volume_ok = bool(row.get("volume_ok", False))
    shrink_ok = bool(row.get("shrink_ok", False))
    if filter_name == "D_MA25":
        return ma25_ok
    if filter_name == "D_VOLUME":
        return volume_ok or shrink_ok
    if filter_name == "D_2560":
        return ma25_ok and near_ma25 and (volume_ok or shrink_ok)
    return False


def find_events(df: pd.DataFrame, display_symbol: str, meta: dict, scheme_key: str) -> pd.DataFrame:
    scheme_name, layers = SCHEMES[scheme_key]
    events = []
    state = {layer: False for layer in layers}
    for i, row in df.iterrows():
        dd = float(row["drawdown"])
        if dd > -0.05:
            state = {layer: False for layer in layers}
        for layer_index, layer in enumerate(layers):
            if dd <= layer and not state[layer]:
                state[layer] = True
                base = {
                    "ticker": display_symbol,
                    "data_symbol": row.get("data_symbol", display_symbol),
                    "name": meta["name"],
                    "engine": meta["engine"],
                    "scheme": scheme_name,
                    "layer": f"D{layer_index + 1}",
                    "threshold": layer,
                    "date": row["date"],
                    "close": float(row["close"]),
                    "reference_high": float(row["reference_high"]),
                    "reference_mode": row["reference_mode"],
                    "drawdown": dd,
                    "ma25_slope_5d": float(row.get("ma25_slope_5d", math.nan)),
                    "volume_ok": bool(row.get("volume_ok", False)),
                    "shrink_ok": bool(row.get("shrink_ok", False)),
                    "price_near_ma25": bool(row.get("price_near_ma25", False)),
                }
                for window in FORWARD_WINDOWS:
                    future_idx = i + window
                    base[f"ret_{window}d"] = float(df.iloc[future_idx]["close"]) / float(row["close"]) - 1.0 if future_idx < len(df) else math.nan
                base["max_adverse_252d"] = df.iloc[i:min(i + 252, len(df))]["close"].min() / float(row["close"]) - 1.0
                for filter_name in FILTERS:
                    event = dict(base)
                    event["filter"] = filter_name
                    event["filter_pass"] = filter_pass(row, filter_name)
                    events.append(event)
    return pd.DataFrame(events)


def summarize(events: pd.DataFrame) -> pd.DataFrame:
    if events.empty:
        return pd.DataFrame()
    rows = []
    passed = events[events["filter_pass"] == True].copy()
    for keys, g in passed.groupby(["ticker", "data_symbol", "name", "engine", "scheme", "filter"]):
        ticker, data_symbol, name, engine, scheme, filter_name = keys
        row = {
            "ticker": ticker,
            "data_symbol": data_symbol,
            "name": name,
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
    return pd.DataFrame(rows).sort_values(["ticker", "scheme", "filter"])


def verdict_discount(row: pd.Series) -> str:
    events = int(row.get("events", 0))
    avg126 = row.get("avg_ret_126d", math.nan)
    win126 = row.get("win_rate_ret_126d", math.nan)
    adverse = row.get("avg_max_adverse_252d", math.nan)
    if events < 5:
        return "WATCH_SAMPLE_LOW"
    if pd.notna(avg126) and pd.notna(win126) and avg126 > 0 and win126 >= 0.55 and (pd.isna(adverse) or adverse > -0.30):
        return "CANDIDATE"
    if pd.notna(avg126) and avg126 > 0:
        return "WATCH"
    return "NO"


def best_discount(summary: pd.DataFrame) -> pd.DataFrame:
    d = summary[summary["filter"] == "D_ONLY"].copy()
    if d.empty:
        return pd.DataFrame()
    d["discount_verdict"] = d.apply(verdict_discount, axis=1)
    d["score"] = d["avg_ret_126d"].fillna(-9) + d["win_rate_ret_126d"].fillna(0) * 0.10 - d["avg_max_adverse_252d"].abs().fillna(0) * 0.10
    return d.sort_values(["ticker", "score"], ascending=[True, False]).groupby("ticker").head(1).drop(columns=["score"])


def best_2560(summary: pd.DataFrame) -> pd.DataFrame:
    if summary.empty:
        return pd.DataFrame()
    rows = []
    for (ticker, scheme), group in summary.groupby(["ticker", "scheme"]):
        base = group[group["filter"] == "D_ONLY"]
        f2560 = group[group["filter"] == "D_2560"]
        if base.empty or f2560.empty:
            continue
        b = base.iloc[0]
        f = f2560.iloc[0]
        verdict = "NO"
        if int(f["events"]) < 3:
            verdict = "WATCH_SAMPLE_LOW"
        elif (f["avg_ret_63d"] >= b["avg_ret_63d"] or f["avg_ret_126d"] >= b["avg_ret_126d"]) and f["avg_max_adverse_252d"] >= b["avg_max_adverse_252d"] - 0.05:
            verdict = "FILTER_CANDIDATE"
        elif f["avg_ret_126d"] > 0:
            verdict = "WATCH"
        row = f.to_dict()
        row["baseline_events"] = int(b["events"])
        row["baseline_avg_ret_63d"] = b["avg_ret_63d"]
        row["baseline_avg_ret_126d"] = b["avg_ret_126d"]
        row["baseline_avg_max_adverse_252d"] = b["avg_max_adverse_252d"]
        row["filter_verdict"] = verdict
        row["score"] = f["avg_ret_126d"] - b["avg_ret_126d"] + (f["avg_ret_63d"] - b["avg_ret_63d"])
        rows.append(row)
    out = pd.DataFrame(rows)
    if out.empty:
        return out
    return out.sort_values(["ticker", "score"], ascending=[True, False]).groupby("ticker").head(1).drop(columns=["score"])


def pct_format(x):
    if pd.isna(x):
        return ""
    if isinstance(x, (int, float)):
        return f"{x:.2%}"
    return x


def write_csv(df: pd.DataFrame, path: Path) -> None:
    out = df.copy()
    pct_cols = {"threshold", "drawdown", "avg_drawdown_at_trigger", "avg_max_adverse_252d", "max_adverse_252d", "ma25_slope_5d", "avg_ret_21d", "avg_ret_63d", "avg_ret_126d", "avg_ret_252d", "win_rate_ret_21d", "win_rate_ret_63d", "win_rate_ret_126d", "win_rate_ret_252d", "baseline_avg_ret_63d", "baseline_avg_ret_126d", "baseline_avg_max_adverse_252d"}
    for col in out.columns:
        if col in pct_cols:
            out[col] = out[col].map(pct_format)
    out.to_csv(path, index=False)


def main() -> None:
    out_dir = Path("reports/backtests/candidate_four")
    out_dir.mkdir(parents=True, exist_ok=True)
    all_events = []
    status_rows = []
    for display_symbol, meta in CANDIDATES.items():
        try:
            prices, data_symbol = load_price(display_symbol, meta)
            prices = add_indicators(prices)
            for scheme_key in meta["schemes"]:
                all_events.append(find_events(prices, display_symbol, meta, scheme_key))
            status_rows.append({"ticker": display_symbol, "data_symbol": data_symbol, "status": "OK", "rows": len(prices), "error": ""})
        except Exception as exc:
            status_rows.append({"ticker": display_symbol, "data_symbol": " / ".join(meta["aliases"]), "status": "DATA_PENDING", "rows": 0, "error": str(exc)})
            print(f"SKIP {display_symbol}: {exc}")
    events = pd.concat(all_events, ignore_index=True) if all_events else pd.DataFrame()
    summary = summarize(events)
    discount_best = best_discount(summary)
    filter_best = best_2560(summary)
    write_csv(events, out_dir / "candidate_four_events.csv")
    write_csv(summary, out_dir / "candidate_four_full_summary.csv")
    write_csv(discount_best, out_dir / "candidate_four_discount_verdict.csv")
    write_csv(filter_best, out_dir / "candidate_four_2560_verdict.csv")
    pd.DataFrame(status_rows).to_csv(out_dir / "candidate_four_status.csv", index=False)
    print("Candidate four backtest complete")
    print(f"Events: {len(events)}")
    print(f"Wrote reports to {out_dir}")


if __name__ == "__main__":
    main()
