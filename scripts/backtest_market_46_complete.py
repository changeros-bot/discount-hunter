#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import math
import pandas as pd
import yfinance as yf

from backtest_market_91_discount_hunter import (
    UNIVERSE as BASE_UNIVERSE,
    add_reference,
    best_verdict,
    find_events,
    load_price,
    scheme_keys,
    summarize,
    write_csv,
)

ACTIVE_10 = ["QQQ", "NVDA", "TSM", "AVGO", "GOOGL", "AMD", "MRVL", "RKLB", "SPCX", "BTC-USD"]
WATCHLIST_1 = ["NOW", "QCOM", "DELL", "MSFT", "NFLX", "ADBE", "SOFI", "REGN", "MA", "V", "PWR", "CEG", "COST", "GEV", "LLY", "SPOT", "TMUS", "ACN"]
WATCHLIST_2 = ["AAPL", "AMZN", "KO", "BAC", "AXP", "CVX", "XOM", "LIN", "NOC", "UNH", "MU", "SNDK", "WDC", "STX", "SKHY", "DRAM", "OXY", "PBR"]
BENCHMARKS = ["SPY", "QQQ"]

ALIASES = {"BTC-USD": ["BTC-USD"], "SPCX": ["SPCX"], "SKHY": ["SKHY"], "DRAM": ["DRAM"]}
CATEGORY = {
    "QQQ": "ETF", "BTC-USD": "CRYPTO_EQUITY", "SPCX": "TOKENIZED_PRIVATE_OR_NEW",
    "SOFI": "GROWTH_STOCK", "GEV": "GROWTH_STOCK", "CEG": "GROWTH_STOCK",
    "SKHY": "ETF", "DRAM": "ETF",
}


def meta_for(symbol: str) -> dict:
    if symbol in BASE_UNIVERSE:
        return BASE_UNIVERSE[symbol]
    return {
        "name": symbol,
        "aliases": ALIASES.get(symbol, [symbol]),
        "category": CATEGORY.get(symbol, "STOCK"),
    }


def annual_metrics(symbol: str, start="2016-07-16") -> tuple[dict, pd.DataFrame]:
    px = yf.download(symbol, start=start, auto_adjust=True, progress=False)
    if px.empty:
        raise ValueError("empty price history")
    close = px["Close"]
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]
    close = close.dropna()
    monthly = close.resample("ME").last()
    yearly = close.resample("YE").last().pct_change().dropna()
    rets = close.pct_change().dropna()
    years = max((close.index[-1] - close.index[0]).days / 365.25, 1 / 365.25)
    cagr = (close.iloc[-1] / close.iloc[0]) ** (1 / years) - 1
    vol = rets.std() * math.sqrt(252)
    running = close.cummax()
    dd = close / running - 1
    rf = 0.02
    sharpe = ((rets.mean() * 252) - rf) / vol if vol and not math.isnan(vol) else math.nan
    downside = rets[rets < 0].std() * math.sqrt(252)
    sortino = ((rets.mean() * 252) - rf) / downside if downside and not math.isnan(downside) else math.nan
    summary = {
        "ticker": symbol,
        "history_start": close.index[0].date(),
        "history_end": close.index[-1].date(),
        "history_years": years,
        "full_10y": years >= 9.8,
        "total_return": close.iloc[-1] / close.iloc[0] - 1,
        "cagr": cagr,
        "annualized_volatility": vol,
        "max_drawdown": dd.min(),
        "current_drawdown": close.iloc[-1] / close.max() - 1,
        "sharpe": sharpe,
        "sortino": sortino,
    }
    annual = pd.DataFrame({"year": yearly.index.year, "ticker": symbol, "annual_return": yearly.values})
    return summary, annual


def fundamentals(symbol: str) -> dict:
    t = yf.Ticker(symbol)
    info = t.info or {}
    out = {
        "ticker": symbol,
        "market_cap": info.get("marketCap"),
        "trailing_pe": info.get("trailingPE"),
        "forward_pe": info.get("forwardPE"),
        "price_to_book": info.get("priceToBook"),
        "peg_ratio": info.get("pegRatio"),
        "enterprise_to_ebitda": info.get("enterpriseToEbitda"),
        "gross_margin": info.get("grossMargins"),
        "operating_margin": info.get("operatingMargins"),
        "profit_margin": info.get("profitMargins"),
        "roe": info.get("returnOnEquity"),
        "revenue_growth": info.get("revenueGrowth"),
        "earnings_growth": info.get("earningsGrowth"),
        "free_cash_flow": info.get("freeCashflow"),
        "operating_cash_flow": info.get("operatingCashflow"),
        "total_cash": info.get("totalCash"),
        "total_debt": info.get("totalDebt"),
        "debt_to_equity": info.get("debtToEquity"),
        "dividend_yield": info.get("dividendYield"),
    }
    return out


def group_of(symbol: str) -> str:
    if symbol in ACTIVE_10:
        return "ACTIVE_10"
    if symbol in WATCHLIST_1:
        return "WATCHLIST_1"
    return "WATCHLIST_2"


def main() -> None:
    symbols = ACTIVE_10 + WATCHLIST_1 + WATCHLIST_2
    assert len(symbols) == 46 and len(set(symbols)) == 46
    out_dir = Path("reports/backtests/market_46")
    out_dir.mkdir(parents=True, exist_ok=True)

    all_events, status_rows, perf_rows, annual_rows, fund_rows = [], [], [], [], []
    for symbol in symbols:
        meta = meta_for(symbol)
        try:
            prices, data_symbol = load_price(symbol, meta, start="2010-01-01")
            prices = add_reference(prices)
            for key in scheme_keys(meta["category"]):
                all_events.append(find_events(prices, symbol, meta, key))
            status_rows.append({"ticker": symbol, "group": group_of(symbol), "data_symbol": data_symbol, "status": "OK", "rows": len(prices), "error": ""})
        except Exception as exc:
            status_rows.append({"ticker": symbol, "group": group_of(symbol), "data_symbol": " / ".join(meta["aliases"]), "status": "DATA_PENDING", "rows": 0, "error": str(exc)})

        try:
            p, a = annual_metrics(meta["aliases"][0])
            p["group"] = group_of(symbol)
            perf_rows.append(p)
            a["group"] = group_of(symbol)
            annual_rows.append(a)
        except Exception as exc:
            perf_rows.append({"ticker": symbol, "group": group_of(symbol), "performance_error": str(exc)})

        try:
            f = fundamentals(meta["aliases"][0])
            f["group"] = group_of(symbol)
            fund_rows.append(f)
        except Exception as exc:
            fund_rows.append({"ticker": symbol, "group": group_of(symbol), "fundamentals_error": str(exc)})

    benchmark_annual = {}
    for benchmark in BENCHMARKS:
        try:
            _, a = annual_metrics(benchmark)
            benchmark_annual[benchmark] = a.set_index("year")["annual_return"]
        except Exception:
            benchmark_annual[benchmark] = pd.Series(dtype=float)

    annual = pd.concat(annual_rows, ignore_index=True) if annual_rows else pd.DataFrame()
    if not annual.empty:
        for benchmark, series in benchmark_annual.items():
            annual[f"{benchmark.lower()}_return"] = annual["year"].map(series)
            annual[f"alpha_vs_{benchmark.lower()}"] = annual["annual_return"] - annual[f"{benchmark.lower()}_return"]
            annual[f"beat_{benchmark.lower()}"] = annual[f"alpha_vs_{benchmark.lower()}"] > 0

    events = pd.concat(all_events, ignore_index=True) if all_events else pd.DataFrame()
    discount_summary = summarize(events)
    discount_best = best_verdict(discount_summary)
    if not discount_best.empty:
        discount_best["group"] = discount_best["ticker"].map(group_of)

    perf = pd.DataFrame(perf_rows)
    funds = pd.DataFrame(fund_rows)
    merged = perf.merge(funds, on=["ticker", "group"], how="outer")
    if not discount_best.empty:
        keep = ["ticker", "scheme", "events", "avg_ret_126d", "win_rate_ret_126d", "avg_ret_252d", "win_rate_ret_252d", "avg_max_adverse_252d", "discount_verdict"]
        merged = merged.merge(discount_best[keep], on="ticker", how="left")

    if not annual.empty:
        score = annual.groupby("ticker").agg(
            years=("year", "count"),
            beat_spy_rate=("beat_spy", "mean"),
            beat_qqq_rate=("beat_qqq", "mean"),
            avg_alpha_spy=("alpha_vs_spy", "mean"),
            avg_alpha_qqq=("alpha_vs_qqq", "mean"),
        ).reset_index()
        merged = merged.merge(score, on="ticker", how="left")

    merged["rank_score"] = (
        merged.get("cagr", 0).fillna(-1) * 35
        + merged.get("beat_spy_rate", 0).fillna(0) * 15
        + merged.get("beat_qqq_rate", 0).fillna(0) * 10
        + merged.get("avg_ret_126d", 0).fillna(0) * 15
        + merged.get("win_rate_ret_126d", 0).fillna(0) * 10
        + merged.get("revenue_growth", 0).fillna(0) * 8
        + merged.get("profit_margin", 0).fillna(0) * 7
        - merged.get("max_drawdown", 0).abs().fillna(1) * 15
    )
    merged = merged.sort_values("rank_score", ascending=False)

    write_csv(events, out_dir / "market_46_events.csv")
    write_csv(discount_summary, out_dir / "market_46_discount_full_summary.csv")
    write_csv(discount_best, out_dir / "market_46_discount_best.csv")
    write_csv(perf, out_dir / "market_46_performance.csv")
    write_csv(annual, out_dir / "market_46_annual_vs_spy_qqq.csv")
    funds.to_csv(out_dir / "market_46_fundamentals.csv", index=False)
    merged.to_csv(out_dir / "market_46_master_ranking.csv", index=False)
    pd.DataFrame(status_rows).to_csv(out_dir / "market_46_status.csv", index=False)
    print(f"Unified 46-name backtest complete: {len(symbols)} symbols")
    print(f"Reports: {out_dir}")


if __name__ == "__main__":
    main()
