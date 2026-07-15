#!/usr/bin/env python3
"""Ten-year backtest for the current ratified 2560 universe and rules.

Methodology
- Universe: current deduplicated scan-enabled registry.
- Data: underlying Yahoo Finance adjusted OHLCV proxy. Binance RWA history is
  not available for ten years, so this is not presented as a Binance backtest.
- Signal: current paper_2560_bot indicators/evaluate_signal.
- Entry: next session open with 0.2% adverse slippage.
- Exit: first daily close meeting current stop/target/risk/30-session rules.
- Position sizing: fixed USD 100 per trade; overlapping trades are allowed.
"""
from __future__ import annotations

import json
import math
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import yfinance as yf

import paper_2560_bot as engine

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "config" / "2560-universe.json"
OUT = ROOT / "reports" / "backtest"
START = (date.today() - timedelta(days=3653)).isoformat()
END = (date.today() + timedelta(days=1)).isoformat()
STAKE = 100.0
SLIPPAGE = 0.002


def load_universe():
    payload = json.loads(REGISTRY.read_text(encoding="utf8"))
    seen = set()
    rows = []
    for item in payload.get("symbols", []):
        ticker = str(item.get("ticker", "")).strip().upper()
        symbol = item.get("data_symbol")
        if not ticker or ticker in seen or not item.get("scan_enabled") or not symbol:
            continue
        seen.add(ticker)
        rows.append({**item, "ticker": ticker})
    return payload, rows


def download(item):
    raw = yf.download(
        item["data_symbol"], start=START, end=END,
        auto_adjust=True, progress=False, threads=False,
    )
    if raw.empty:
        raise ValueError("no_data")
    return engine.clean(engine.flat(raw).reset_index())


def backtest_symbol(item, prices):
    trades = []
    active = None
    for i in range(len(prices)):
        row = prices.iloc[i]

        if active is not None:
            hold_days = i - active["entry_index"]
            close = float(row.close)
            current = engine.evaluate_signal(row)
            reason = None
            if close <= active["stop_price"] or current["risk_status"] == "FAILED":
                reason = "structure_or_atr_stop"
            elif close >= active["target_price"]:
                reason = "paper_target_15pct"
            elif hold_days >= engine.MAX_HOLD_DAYS:
                reason = "expired_30d"
            elif current["risk_status"] == "TOO_DEEP":
                reason = "risk_state_exit"
            if reason:
                ret = close / active["entry_price"] - 1.0
                trades.append({
                    "ticker": item["ticker"],
                    "group": item.get("group", ""),
                    "pattern": active["pattern"],
                    "signal_date": active["signal_date"],
                    "entry_date": active["entry_date"],
                    "entry_price": active["entry_price"],
                    "exit_date": row.date.strftime("%Y-%m-%d"),
                    "exit_price": close,
                    "exit_reason": reason,
                    "hold_days": hold_days,
                    "return_pct": ret,
                    "pnl_usd_100": STAKE * ret,
                })
                active = None

        if active is None and i + 1 < len(prices):
            signal = engine.evaluate_signal(row)
            pattern = signal["pattern_type"]
            if (
                signal["stage_status"] == "TRIGGERED"
                and signal["gate_status"] == "PASS"
                and signal["risk_status"] == "NORMAL"
                and engine.allowed_for_ticker(item["ticker"], pattern)
            ):
                entry = prices.iloc[i + 1]
                entry_price = float(entry.open) * (1.0 + SLIPPAGE)
                structure_stop = float(row.pullback_low) - engine.STRUCTURE_BUFFER_ATR * float(row.atr14)
                atr_stop = entry_price - engine.ATR_STOP_MULTIPLE * float(row.atr14)
                active = {
                    "pattern": pattern,
                    "signal_date": row.date.strftime("%Y-%m-%d"),
                    "entry_date": entry.date.strftime("%Y-%m-%d"),
                    "entry_index": i + 1,
                    "entry_price": entry_price,
                    "stop_price": max(structure_stop, atr_stop),
                    "target_price": entry_price * (1.0 + engine.PAPER_TARGET_RETURN),
                }

    if active is not None:
        row = prices.iloc[-1]
        close = float(row.close)
        ret = close / active["entry_price"] - 1.0
        trades.append({
            "ticker": item["ticker"], "group": item.get("group", ""),
            "pattern": active["pattern"], "signal_date": active["signal_date"],
            "entry_date": active["entry_date"], "entry_price": active["entry_price"],
            "exit_date": row.date.strftime("%Y-%m-%d"), "exit_price": close,
            "exit_reason": "end_of_test", "hold_days": len(prices) - 1 - active["entry_index"],
            "return_pct": ret, "pnl_usd_100": STAKE * ret,
        })
    return trades


def summarize(trades, coverage, registry_version):
    frame = pd.DataFrame(trades)
    if frame.empty:
        return {
            "registry_version": registry_version,
            "period": {"start": START, "end": END},
            "stake_per_trade_usd": STAKE,
            "trades": 0,
            "coverage": coverage,
        }

    returns = frame["return_pct"].astype(float)
    pnl = frame["pnl_usd_100"].astype(float)
    wins = returns > 0
    losses = returns <= 0
    gross_profit = pnl[pnl > 0].sum()
    gross_loss = pnl[pnl < 0].sum()

    chronological = frame.sort_values(["exit_date", "ticker"]).copy()
    chronological["equity"] = 10000.0 + chronological["pnl_usd_100"].cumsum()
    chronological["peak"] = chronological["equity"].cummax()
    chronological["drawdown"] = chronological["equity"] / chronological["peak"] - 1.0

    by_ticker = frame.groupby("ticker").agg(
        trades=("ticker", "size"),
        wins=("return_pct", lambda x: int((x > 0).sum())),
        win_rate=("return_pct", lambda x: float((x > 0).mean())),
        avg_return=("return_pct", "mean"),
        total_pnl_usd=("pnl_usd_100", "sum"),
    ).sort_values("total_pnl_usd", ascending=False)
    by_pattern = frame.groupby("pattern").agg(
        trades=("pattern", "size"),
        win_rate=("return_pct", lambda x: float((x > 0).mean())),
        avg_return=("return_pct", "mean"),
        total_pnl_usd=("pnl_usd_100", "sum"),
    ).sort_values("total_pnl_usd", ascending=False)

    return {
        "registry_version": registry_version,
        "method": "underlying_adjusted_ohlcv_proxy_current_2560_rules",
        "period": {"start": START, "end": END},
        "stake_per_trade_usd": STAKE,
        "initial_reference_equity_usd": 10000.0,
        "trades": int(len(frame)),
        "winning_trades": int(wins.sum()),
        "losing_trades": int(losses.sum()),
        "win_rate": float(wins.mean()),
        "average_return_per_trade": float(returns.mean()),
        "median_return_per_trade": float(returns.median()),
        "total_pnl_usd_fixed_100_each": float(pnl.sum()),
        "gross_profit_usd": float(gross_profit),
        "gross_loss_usd": float(gross_loss),
        "profit_factor": None if gross_loss == 0 else float(gross_profit / abs(gross_loss)),
        "max_drawdown_reference_equity": float(chronological["drawdown"].min()),
        "ending_reference_equity_usd": float(chronological["equity"].iloc[-1]),
        "average_hold_days": float(frame["hold_days"].mean()),
        "coverage": coverage,
        "top_10_tickers": by_ticker.head(10).reset_index().to_dict(orient="records"),
        "bottom_10_tickers": by_ticker.tail(10).sort_values("total_pnl_usd").reset_index().to_dict(orient="records"),
        "by_pattern": by_pattern.reset_index().to_dict(orient="records"),
        "limitations": [
            "This is a ten-year underlying-market OHLCV proxy, not a ten-year Binance RWA backtest.",
            "The current 2026 universe is applied retrospectively, creating survivorship and selection bias.",
            "Signals are evaluated on adjusted daily bars; taxes, commissions and liquidity constraints are excluded except 0.2% entry slippage.",
            "Each ticker holds at most one position, while different tickers may overlap; fixed USD 100 stake is not capital constrained.",
        ],
    }, frame, by_ticker, by_pattern


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    payload, universe = load_universe()
    all_trades = []
    coverage = []
    for item in universe:
        try:
            prices = download(item)
            if prices.empty:
                raise ValueError("insufficient_indicator_history")
            trades = backtest_symbol(item, prices)
            all_trades.extend(trades)
            coverage.append({
                "ticker": item["ticker"], "data_symbol": item["data_symbol"],
                "first_usable_date": prices.iloc[0].date.strftime("%Y-%m-%d"),
                "last_date": prices.iloc[-1].date.strftime("%Y-%m-%d"),
                "usable_days": int(len(prices)), "trades": len(trades), "status": "OK",
            })
        except Exception as exc:  # noqa: BLE001
            coverage.append({"ticker": item["ticker"], "data_symbol": item["data_symbol"], "status": "ERROR", "error": str(exc)})

    result = summarize(all_trades, coverage, payload.get("version"))
    if isinstance(result, tuple):
        summary, trades, by_ticker, by_pattern = result
        trades.to_csv(OUT / "2560_10y_trades.csv", index=False)
        by_ticker.reset_index().to_csv(OUT / "2560_10y_by_ticker.csv", index=False)
        by_pattern.reset_index().to_csv(OUT / "2560_10y_by_pattern.csv", index=False)
    else:
        summary = result
        pd.DataFrame().to_csv(OUT / "2560_10y_trades.csv", index=False)

    (OUT / "2560_10y_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf8")
    pd.DataFrame(coverage).to_csv(OUT / "2560_10y_coverage.csv", index=False)
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
