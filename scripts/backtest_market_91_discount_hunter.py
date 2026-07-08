#!/usr/bin/env python3
from __future__ import annotations

import math
from pathlib import Path
from typing import Dict, List, Tuple
import pandas as pd

# Source: user screenshots 2026-07-08, de-duplicated to underlying symbols.
# This is a broad research screen, not an approval list.
UNIVERSE: Dict[str, dict] = {
    "STLD": {"name": "Steel Dynamics", "aliases": ["STLD"], "category": "STOCK"},
    "PEP": {"name": "PepsiCo", "aliases": ["PEP"], "category": "STOCK"},
    "PFE": {"name": "Pfizer", "aliases": ["PFE"], "category": "STOCK"},
    "EQT": {"name": "EQT", "aliases": ["EQT"], "category": "ENERGY_STOCK"},
    "HUBB": {"name": "Hubbell", "aliases": ["HUBB"], "category": "STOCK"},
    "AVGO": {"name": "Broadcom", "aliases": ["AVGO"], "category": "AI_STOCK"},
    "UNP": {"name": "Union Pacific", "aliases": ["UNP"], "category": "STOCK"},
    "PDD": {"name": "PDD", "aliases": ["PDD"], "category": "CHINA_STOCK"},
    "MRK": {"name": "Merck", "aliases": ["MRK"], "category": "STOCK"},
    "COST": {"name": "Costco", "aliases": ["COST"], "category": "STOCK"},
    "UNG": {"name": "US Natural Gas ETF", "aliases": ["UNG"], "category": "COMMODITY_ETF"},
    "VZ": {"name": "Verizon", "aliases": ["VZ"], "category": "STOCK"},
    "AGG": {"name": "iShares Core US Aggregate Bond ETF", "aliases": ["AGG"], "category": "BOND_ETF"},
    "NVDA": {"name": "Nvidia", "aliases": ["NVDA"], "category": "AI_STOCK"},
    "HPE": {"name": "HPE", "aliases": ["HPE"], "category": "STOCK"},
    "ADBE": {"name": "Adobe", "aliases": ["ADBE"], "category": "STOCK"},
    "ECH": {"name": "iShares MSCI Chile ETF", "aliases": ["ECH"], "category": "COUNTRY_ETF"},
    "VNQ": {"name": "Vanguard Real Estate ETF", "aliases": ["VNQ"], "category": "SECTOR_ETF"},
    "UBER": {"name": "Uber", "aliases": ["UBER"], "category": "GROWTH_STOCK"},
    "LMT": {"name": "Lockheed Martin", "aliases": ["LMT"], "category": "DEFENSE_STOCK"},
    "CMG": {"name": "Chipotle", "aliases": ["CMG"], "category": "STOCK"},
    "MA": {"name": "Mastercard", "aliases": ["MA"], "category": "STOCK"},
    "STNG": {"name": "Scorpio Tankers", "aliases": ["STNG"], "category": "CYCLICAL_STOCK"},
    "META": {"name": "Meta", "aliases": ["META"], "category": "MEGACAP_STOCK"},
    "SPOT": {"name": "Spotify", "aliases": ["SPOT"], "category": "GROWTH_STOCK"},
    "HII": {"name": "Huntington Ingalls", "aliases": ["HII"], "category": "DEFENSE_STOCK"},
    "ECO": {"name": "Okeanis Eco Tankers", "aliases": ["ECO"], "category": "CYCLICAL_STOCK"},
    "UMC": {"name": "UMC", "aliases": ["UMC"], "category": "SEMICONDUCTOR_STOCK"},
    "INTU": {"name": "Intuit", "aliases": ["INTU"], "category": "STOCK"},
    "EQIX": {"name": "Equinix", "aliases": ["EQIX"], "category": "REIT_STOCK"},
    "JAAA": {"name": "Janus AAA CLO ETF", "aliases": ["JAAA"], "category": "BOND_ETF"},
    "USFR": {"name": "WisdomTree Floating Rate Treasury ETF", "aliases": ["USFR"], "category": "BOND_ETF"},
    "ACN": {"name": "Accenture", "aliases": ["ACN"], "category": "STOCK"},
    "SGOV": {"name": "iShares 0-3 Month Treasury ETF", "aliases": ["SGOV"], "category": "BOND_ETF"},
    "BIL": {"name": "SPDR 1-3 Month T-Bill ETF", "aliases": ["BIL"], "category": "BOND_ETF"},
    "BABA": {"name": "Alibaba", "aliases": ["BABA", "9988.HK"], "category": "CHINA_STOCK"},
    "SOXS": {"name": "Direxion Daily Semiconductor Bear 3X ETF", "aliases": ["SOXS"], "category": "INVERSE_LEVERAGED_ETF"},
    "OXY": {"name": "Occidental Petroleum", "aliases": ["OXY"], "category": "ENERGY_STOCK"},
    "BNO": {"name": "US Brent Oil Fund", "aliases": ["BNO"], "category": "COMMODITY_ETF"},
    "USO": {"name": "US Oil Fund", "aliases": ["USO"], "category": "COMMODITY_ETF"},
    "SQQQ": {"name": "ProShares UltraPro Short QQQ", "aliases": ["SQQQ"], "category": "INVERSE_LEVERAGED_ETF"},
    "WLK": {"name": "Westlake", "aliases": ["WLK"], "category": "CYCLICAL_STOCK"},
    "COP": {"name": "ConocoPhillips", "aliases": ["COP"], "category": "ENERGY_STOCK"},
    "CVX": {"name": "Chevron", "aliases": ["CVX"], "category": "ENERGY_STOCK"},
    "XOM": {"name": "Exxon Mobil", "aliases": ["XOM"], "category": "ENERGY_STOCK"},
    "NET": {"name": "Cloudflare", "aliases": ["NET"], "category": "GROWTH_STOCK"},
    "VDE": {"name": "Vanguard Energy ETF", "aliases": ["VDE"], "category": "SECTOR_ETF"},
    "BRLN": {"name": "BlackRock Floating Rate Loan ETF", "aliases": ["BRLN"], "category": "BOND_ETF"},
    "BIDU": {"name": "Baidu", "aliases": ["BIDU"], "category": "CHINA_STOCK"},
    "REGN": {"name": "Regeneron", "aliases": ["REGN"], "category": "STOCK"},
    "WMB": {"name": "Williams", "aliases": ["WMB"], "category": "ENERGY_STOCK"},
    "PBR": {"name": "Petrobras", "aliases": ["PBR"], "category": "ENERGY_STOCK"},
    "HAL": {"name": "Halliburton", "aliases": ["HAL"], "category": "ENERGY_STOCK"},
    "ENB": {"name": "Enbridge", "aliases": ["ENB"], "category": "ENERGY_STOCK"},
    "KWEB": {"name": "KraneShares China Internet ETF", "aliases": ["KWEB"], "category": "COUNTRY_ETF"},
    "FXI": {"name": "iShares China Large-Cap ETF", "aliases": ["FXI"], "category": "COUNTRY_ETF"},
    "BILI": {"name": "Bilibili", "aliases": ["BILI"], "category": "CHINA_STOCK"},
    "JD": {"name": "JD.com", "aliases": ["JD"], "category": "CHINA_STOCK"},
    "TMUS": {"name": "T-Mobile US", "aliases": ["TMUS"], "category": "STOCK"},
    "SLB": {"name": "Schlumberger", "aliases": ["SLB"], "category": "ENERGY_STOCK"},
    "NJ": {"name": "NJ screenshot ticker", "aliases": ["NJ"], "category": "UNKNOWN"},
    "T": {"name": "AT&T", "aliases": ["T"], "category": "STOCK"},
    "PG": {"name": "Procter & Gamble", "aliases": ["PG"], "category": "STOCK"},
    "PSON": {"name": "PSON screenshot ticker", "aliases": ["PSON"], "category": "UNKNOWN_ETF"},
    "NUE": {"name": "Nucor", "aliases": ["NUE"], "category": "CYCLICAL_STOCK"},
    "SBUX": {"name": "Starbucks", "aliases": ["SBUX"], "category": "STOCK"},
    "DASH": {"name": "DoorDash", "aliases": ["DASH"], "category": "GROWTH_STOCK"},
    "AAON": {"name": "AAON", "aliases": ["AAON"], "category": "STOCK"},
    "UNH": {"name": "UnitedHealth", "aliases": ["UNH"], "category": "STOCK"},
    "MCD": {"name": "McDonald's", "aliases": ["MCD"], "category": "STOCK"},
    "DELL": {"name": "Dell", "aliases": ["DELL"], "category": "AI_STOCK"},
    "KO": {"name": "Coca-Cola", "aliases": ["KO"], "category": "STOCK"},
    "LLY": {"name": "Eli Lilly", "aliases": ["LLY"], "category": "STOCK"},
    "WMT": {"name": "Walmart", "aliases": ["WMT"], "category": "STOCK"},
    "OIH": {"name": "VanEck Oil Services ETF", "aliases": ["OIH"], "category": "SECTOR_ETF"},
    "PSQ": {"name": "ProShares Short QQQ", "aliases": ["PSQ"], "category": "INVERSE_ETF"},
    "GRAB": {"name": "Grab", "aliases": ["GRAB"], "category": "GROWTH_STOCK"},
    "TCOM": {"name": "Trip.com", "aliases": ["TCOM"], "category": "CHINA_STOCK"},
    "NFLX": {"name": "Netflix", "aliases": ["NFLX"], "category": "MEGACAP_STOCK"},
    "PYPL": {"name": "PayPal", "aliases": ["PYPL"], "category": "GROWTH_STOCK"},
    "QCOM": {"name": "Qualcomm", "aliases": ["QCOM"], "category": "SEMICONDUCTOR_STOCK"},
    "SPYB": {"name": "SPDR S&P 500 Buyback ETF / screenshot SPYB", "aliases": ["SPYB"], "category": "ETF"},
    "MU": {"name": "Micron", "aliases": ["MU", "MUB"], "category": "AI_STOCK"},
    "TSM": {"name": "TSMC", "aliases": ["TSM"], "category": "AI_STOCK"},
    "NOW": {"name": "ServiceNow", "aliases": ["NOW"], "category": "GROWTH_STOCK"},
    "SMCI": {"name": "Super Micro Computer", "aliases": ["SMCI"], "category": "AI_STOCK"},
    "ORCL": {"name": "Oracle", "aliases": ["ORCL"], "category": "MEGACAP_STOCK"},
    "ARM": {"name": "ARM", "aliases": ["ARM"], "category": "SEMICONDUCTOR_STOCK"},
    "SPCX": {"name": "SpaceX tokenized stock", "aliases": ["SPCX"], "category": "TOKENIZED_PRIVATE_OR_NEW"},
    "SNDK": {"name": "SanDisk", "aliases": ["SNDK"], "category": "SEMICONDUCTOR_STOCK"},
    "COIN": {"name": "Coinbase", "aliases": ["COIN"], "category": "CRYPTO_EQUITY"},
}

SCHEMES: Dict[str, Tuple[str, List[float]]] = {
    "ETF_A": ("ETF_A_10_20_30", [-0.10, -0.20, -0.30]),
    "ETF_B": ("ETF_B_15_25_35", [-0.15, -0.25, -0.35]),
    "STOCK_A": ("STOCK_A_15_25_35_50", [-0.15, -0.25, -0.35, -0.50]),
    "STOCK_B": ("STOCK_B_20_30_40_55", [-0.20, -0.30, -0.40, -0.55]),
    "STOCK_C": ("STOCK_C_25_35_45_60", [-0.25, -0.35, -0.45, -0.60]),
    "HIGH_VOL_A": ("HIGH_VOL_A_35_50_65", [-0.35, -0.50, -0.65]),
    "BOND_A": ("BOND_A_03_05_08", [-0.03, -0.05, -0.08]),
}
FORWARD_WINDOWS = (21, 63, 126, 252)


def scheme_keys(category: str) -> List[str]:
    if category in {"BOND_ETF"}:
        return ["BOND_A"]
    if category in {"ETF", "SECTOR_ETF", "COUNTRY_ETF", "COMMODITY_ETF"}:
        return ["ETF_A", "ETF_B"]
    if category in {"INVERSE_ETF", "INVERSE_LEVERAGED_ETF", "UNKNOWN_ETF"}:
        return ["HIGH_VOL_A"]
    if category in {"CRYPTO_EQUITY", "GROWTH_STOCK", "CHINA_STOCK", "CYCLICAL_STOCK", "ENERGY_STOCK"}:
        return ["STOCK_B", "STOCK_C"]
    return ["STOCK_A", "STOCK_B", "STOCK_C"]


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
            if date_col is None or close_col is None:
                raise ValueError(f"bad columns: {list(raw.columns)}")
            out = pd.DataFrame({
                "date": pd.to_datetime(raw[date_col]).dt.tz_localize(None),
                "close": pd.to_numeric(raw[close_col], errors="coerce"),
            })
            out = out.dropna().sort_values("date").drop_duplicates("date").reset_index(drop=True)
            if len(out) < 260:
                raise ValueError(f"not enough rows for backtest: {len(out)}")
            out["ticker"] = display_symbol
            out["data_symbol"] = ticker
            return out, ticker
        except Exception as exc:
            last_error = exc
    raise ValueError(str(last_error) if last_error else "no data")


def add_reference(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["reference_high"] = out["close"].rolling(252, min_periods=120).max()
    out["reference_mode"] = "52w_high"
    out["drawdown"] = out["close"] / out["reference_high"] - 1
    return out.dropna(subset=["reference_high", "drawdown"]).reset_index(drop=True)


def find_events(df: pd.DataFrame, display_symbol: str, meta: dict, scheme_key: str) -> pd.DataFrame:
    scheme_name, layers = SCHEMES[scheme_key]
    rows = []
    state = {layer: False for layer in layers}
    for i, r in df.iterrows():
        dd = float(r.drawdown)
        if dd > -0.05:
            state = {layer: False for layer in layers}
        for idx, layer in enumerate(layers):
            if dd <= layer and not state[layer]:
                state[layer] = True
                e = {
                    "ticker": display_symbol,
                    "data_symbol": r.get("data_symbol", display_symbol),
                    "name": meta["name"],
                    "category": meta["category"],
                    "scheme": scheme_name,
                    "layer": f"D{idx+1}",
                    "threshold": layer,
                    "date": r.date,
                    "close": float(r.close),
                    "reference_high": float(r.reference_high),
                    "reference_mode": r.reference_mode,
                    "drawdown": dd,
                }
                for w in FORWARD_WINDOWS:
                    e[f"ret_{w}d"] = float(df.iloc[i+w].close) / float(r.close) - 1 if i + w < len(df) else math.nan
                e["max_adverse_252d"] = df.iloc[i:min(i+252, len(df))].close.min() / float(r.close) - 1
                rows.append(e)
    return pd.DataFrame(rows)


def summarize(events: pd.DataFrame) -> pd.DataFrame:
    if events.empty:
        return pd.DataFrame()
    rows = []
    for keys, g in events.groupby(["ticker", "data_symbol", "name", "category", "scheme", "reference_mode"]):
        ticker, data_symbol, name, category, scheme, reference_mode = keys
        row = {
            "ticker": ticker,
            "data_symbol": data_symbol,
            "name": name,
            "category": category,
            "scheme": scheme,
            "reference_mode": reference_mode,
            "events": len(g),
            "avg_drawdown_at_trigger": g["drawdown"].mean(),
            "avg_max_adverse_252d": g["max_adverse_252d"].mean(),
        }
        for w in FORWARD_WINDOWS:
            col = f"ret_{w}d"
            row[f"avg_{col}"] = g[col].mean()
            row[f"win_rate_{col}"] = (g[col] > 0).mean()
        rows.append(row)
    return pd.DataFrame(rows).sort_values(["ticker", "scheme"])


def policy_note(category: str) -> str:
    if category in {"INVERSE_ETF", "INVERSE_LEVERAGED_ETF"}:
        return "EXCLUDE_POLICY_INVERSE_OR_LEVERAGED"
    if category in {"BOND_ETF"}:
        return "RESERVE_TOOL_NOT_DISCOUNT_HUNTER_TARGET"
    if category in {"UNKNOWN", "UNKNOWN_ETF", "TOKENIZED_PRIVATE_OR_NEW"}:
        return "DATA_OR_SYMBOL_NEEDS_MANUAL_CONFIRMATION"
    return "OK"


def verdict(row: pd.Series) -> str:
    note = policy_note(str(row.get("category", "")))
    if note != "OK":
        return note
    events = int(row.get("events", 0))
    avg126 = row.get("avg_ret_126d", math.nan)
    win126 = row.get("win_rate_ret_126d", math.nan)
    adverse = row.get("avg_max_adverse_252d", math.nan)
    if events < 5:
        return "WATCH_SAMPLE_LOW"
    if pd.notna(avg126) and pd.notna(win126) and avg126 > 0 and win126 >= 0.60 and (pd.isna(adverse) or adverse > -0.25):
        return "STRONG_RESEARCH_CANDIDATE"
    if pd.notna(avg126) and pd.notna(win126) and avg126 > 0 and win126 >= 0.55 and (pd.isna(adverse) or adverse > -0.35):
        return "RESEARCH_CANDIDATE"
    if pd.notna(avg126) and avg126 > 0:
        return "WATCH"
    return "NO"


def best_verdict(summary: pd.DataFrame) -> pd.DataFrame:
    if summary.empty:
        return pd.DataFrame()
    s = summary.copy()
    s["discount_verdict"] = s.apply(verdict, axis=1)
    s["policy_note"] = s["category"].map(policy_note)
    s["score"] = s["avg_ret_126d"].fillna(-9) + s["win_rate_ret_126d"].fillna(0) * 0.15 - s["avg_max_adverse_252d"].abs().fillna(0) * 0.10
    return s.sort_values(["ticker", "score"], ascending=[True, False]).groupby("ticker").head(1).drop(columns=["score"])


def pct_format(x):
    if pd.isna(x):
        return ""
    if isinstance(x, (int, float)):
        return f"{x:.2%}"
    return x


def write_csv(df: pd.DataFrame, path: Path) -> None:
    out = df.copy()
    pct_cols = {"threshold", "drawdown", "avg_drawdown_at_trigger", "avg_max_adverse_252d", "max_adverse_252d"}
    for col in out.columns:
        if col.startswith("ret_") or col.startswith("avg_ret_") or col.startswith("win_rate_") or col in pct_cols:
            out[col] = out[col].map(pct_format)
    out.to_csv(path, index=False)


def main() -> None:
    out_dir = Path("reports/backtests/market_91")
    out_dir.mkdir(parents=True, exist_ok=True)
    all_events = []
    status_rows = []
    for display_symbol, meta in UNIVERSE.items():
        try:
            prices, data_symbol = load_price(display_symbol, meta)
            prices = add_reference(prices)
            for key in scheme_keys(meta["category"]):
                all_events.append(find_events(prices, display_symbol, meta, key))
            status_rows.append({"ticker": display_symbol, "data_symbol": data_symbol, "status": "OK", "rows": len(prices), "category": meta["category"], "error": ""})
        except Exception as exc:
            status_rows.append({"ticker": display_symbol, "data_symbol": " / ".join(meta["aliases"]), "status": "DATA_PENDING", "rows": 0, "category": meta["category"], "error": str(exc)})
            print(f"SKIP {display_symbol}: {exc}")
    events = pd.concat(all_events, ignore_index=True) if all_events else pd.DataFrame()
    summary = summarize(events)
    best = best_verdict(summary)
    write_csv(events, out_dir / "market_91_events.csv")
    write_csv(summary, out_dir / "market_91_full_summary.csv")
    write_csv(best, out_dir / "market_91_best_verdict.csv")
    pd.DataFrame(status_rows).to_csv(out_dir / "market_91_status.csv", index=False)
    print("Market 91 Discount Hunter backtest complete")
    print(f"Universe: {len(UNIVERSE)}")
    print(f"Events: {len(events)}")
    print(f"Wrote reports to {out_dir}")


if __name__ == "__main__":
    main()
