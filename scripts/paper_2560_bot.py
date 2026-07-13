#!/usr/bin/env python3
"""2560 Paper Bot V1.0.

Implements the ratified 2560 constitution:
- price system: MA5_PRICE / MA25_PRICE
- volume system: VMA5 / VMA60
- patterns: RUSH_VOLUME / BUILT_VOLUME / VOLUME_PIT
- gate, stage, pattern and risk statuses are recorded separately

Paper ledger only. No broker integration and no real orders.
"""
from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Sequence

try:
    import pandas as pd
except ImportError as exc:
    raise SystemExit("pandas is required") from exc

UNIVERSE = {
    "AAPL": "大型科技平台", "MSFT": "大型科技平台", "GOOGL": "大型科技平台",
    "META": "大型科技平台", "AMZN": "大型科技平台", "NFLX": "大型科技平台",
    "MU": "AI半導體", "DELL": "AI基礎建設", "PLTR": "AI應用/國防軟體",
    "NBIS": "高波動AI雲端",
}

# Experimental paper parameters. These are not constitutional constants.
EXTENSION_ATR = 1.50
DEEP_DAMAGE_ATR = -1.50
ATR_STOP_MULTIPLE = 1.50
STRUCTURE_BUFFER_ATR = 0.25
MAX_HOLD_DAYS = 30
PAPER_TARGET_RETURN = 0.15

# Existing symbol-specific research constraints remain in force.
ALLOWED_PATTERNS = {
    "MU": {"RUSH_VOLUME", "VOLUME_PIT"},
    "NBIS": {"RUSH_VOLUME", "VOLUME_PIT"},
}

PATTERN_ZH = {
    "RUSH_VOLUME": "衝量",
    "BUILT_VOLUME": "做量",
    "VOLUME_PIT": "縮量坑",
}


def flat(raw):
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


def clean(df):
    cols = {str(c).lower().strip().replace(" ", "_"): c for c in df.columns}
    date_col = cols.get("date") or cols.get("datetime")
    close_col = cols.get("adj_close") or cols.get("close") or cols.get("price")
    if date_col is None or close_col is None or cols.get("volume") is None:
        raise ValueError("missing date/close/volume")
    close = pd.to_numeric(df[close_col], errors="coerce")
    open_col = cols.get("open")
    out = pd.DataFrame({
        "date": pd.to_datetime(df[date_col], utc=True).dt.tz_convert(None),
        "open": pd.to_numeric(df[open_col], errors="coerce") if open_col else close,
        "close": close,
        "high": pd.to_numeric(df[cols.get("high")], errors="coerce") if cols.get("high") else close,
        "low": pd.to_numeric(df[cols.get("low")], errors="coerce") if cols.get("low") else close,
        "volume": pd.to_numeric(df[cols["volume"]], errors="coerce"),
    }).dropna().sort_values("date").drop_duplicates("date")
    return indicators(out.reset_index(drop=True))


def indicators(df):
    out = df.copy()

    # Price system: MA5 / MA25.
    out["ma5_price"] = out.close.rolling(5, min_periods=5).mean()
    out["ma25_price"] = out.close.rolling(25, min_periods=25).mean()
    out["ma25_slope_5d"] = out.ma25_price / out.ma25_price.shift(5) - 1.0
    out["ma25_rising_or_flat"] = out.ma25_slope_5d >= -0.003
    out["ma5_cross_above_25"] = (
        (out.ma5_price >= out.ma25_price)
        & (out.ma5_price.shift(1) < out.ma25_price.shift(1))
    )

    prev_close = out.close.shift(1)
    tr = pd.concat([
        out.high - out.low,
        (out.high - prev_close).abs(),
        (out.low - prev_close).abs(),
    ], axis=1).max(axis=1)
    out["atr14"] = tr.rolling(14, min_periods=14).mean()
    out["distance_to_ma25_atr"] = (out.close - out.ma25_price) / out.atr14
    out["near_ma25"] = out.distance_to_ma25_atr.between(-1.0, 1.0)
    out["above_ma25"] = out.close >= out.ma25_price

    # A practical retest proxy: recent low touched MA25/ATR zone and price has reclaimed it.
    recent_low = out.low.rolling(5, min_periods=3).min()
    out["price_retest_25"] = recent_low <= (out.ma25_price + 0.25 * out.atr14)
    out["price_turning_up"] = (out.close > out.close.shift(1)) & (out.ma5_price >= out.ma5_price.shift(1))
    out["price_retest_25_and_rebound"] = out.price_retest_25 & out.above_ma25 & out.price_turning_up

    # Volume system: VMA5 / VMA60.
    out["vma5"] = out.volume.rolling(5, min_periods=5).mean()
    out["vma60"] = out.volume.rolling(60, min_periods=30).mean()
    out["vma5_cross_above_60"] = (
        (out.vma5 >= out.vma60)
        & (out.vma5.shift(1) < out.vma60.shift(1))
    )
    out["vma5_above_60"] = out.vma5 >= out.vma60
    out["vma5_turning_up"] = (out.vma5 > out.vma5.shift(1)) & (out.vma5.shift(1) <= out.vma5.shift(2))

    # "Built volume": before today's setup, VMA5 touched or crossed VMA60 in the prior 20 sessions.
    prior_touch = (out.vma5 >= out.vma60 * 0.97).shift(1)
    out["prior_vma5_touched_or_crossed_60"] = prior_touch.rolling(20, min_periods=5).max().fillna(False).astype(bool)

    # "Volume pit": established VMA5/VMA60 structure, then 1-2 exceptionally quiet sessions.
    sustained = (out.vma5 >= out.vma60 * 0.98).shift(1)
    out["vma5_sustained_above_60"] = sustained.rolling(5, min_periods=3).sum() >= 3
    low_volume_20 = out.volume <= out.volume.rolling(20, min_periods=10).min() * 1.05
    out["recent_volume_pit"] = low_volume_20 | low_volume_20.shift(1).fillna(False)

    # Structure and distribution risk.
    out["pullback_low"] = out.low.rolling(10, min_periods=5).min().shift(1)
    out["pullback_low_broken"] = out.close < out.pullback_low
    body_return = out.close / out.open - 1.0
    out["major_distribution"] = (
        (body_return <= -0.03)
        & (out.volume >= out.vma60 * 1.5)
    ) | (
        ((out.high - out.close) > (out.close - out.low).clip(lower=0) * 1.5)
        & (out.volume >= out.vma60 * 1.5)
    )

    out["ma200"] = out.close.rolling(200, min_periods=120).mean()
    out["above_ma200"] = out.close >= out.ma200
    return out.dropna().reset_index(drop=True)


def load_price(ticker, args):
    if args.source == "csv":
        path = Path(args.data_dir) / f"{ticker}.csv"
        return clean(pd.read_csv(path))
    import yfinance as yf
    raw = yf.download(ticker, start=args.start, auto_adjust=True, progress=False)
    if raw.empty:
        raise ValueError(f"no data for {ticker}")
    return clean(flat(raw).reset_index())


def evaluate_signal(row):
    """Return gate/stage/pattern/risk/reason without mixing state dimensions."""
    result = {
        "gate_status": "PASS",
        "stage_status": "WATCH",
        "pattern_type": "NONE",
        "risk_status": "NORMAL",
        "reason": "WAITING_FOR_PRICE_SETUP",
    }

    if not bool(row.ma25_rising_or_flat):
        result.update(gate_status="REJECTED", reason="MA25_NOT_UP")
        return result
    if bool(row.pullback_low_broken) or bool(row.major_distribution):
        result.update(stage_status="FAILED", risk_status="FAILED", reason="STRUCTURE_BROKEN")
        return result

    distance = float(row.distance_to_ma25_atr)
    if distance > EXTENSION_ATR:
        result.update(risk_status="EXTENDED", reason="PRICE_EXTENDED")
        return result
    if distance < DEEP_DAMAGE_ATR:
        result.update(risk_status="TOO_DEEP", reason="PRICE_TOO_DEEP")
        return result

    price_setup = bool(row.ma5_cross_above_25) or bool(row.price_retest_25_and_rebound)
    if not price_setup:
        return result

    result.update(stage_status="PRICE_SETUP", reason="WAITING_FOR_VOLUME_CONFIRM")

    # Three constitutional pattern branches.
    if bool(row.vma5_cross_above_60):
        result.update(stage_status="TRIGGERED", pattern_type="RUSH_VOLUME", reason="VMA5_CROSS_VMA60")
        return result

    if bool(row.prior_vma5_touched_or_crossed_60) and bool(row.price_retest_25_and_rebound) and bool(row.vma5_above_60):
        result.update(stage_status="TRIGGERED", pattern_type="BUILT_VOLUME", reason="PRIOR_VOLUME_BUILT")
        return result

    if bool(row.vma5_sustained_above_60) and bool(row.recent_volume_pit) and bool(row.price_turning_up):
        result.update(stage_status="TRIGGERED", pattern_type="VOLUME_PIT", reason="ESTABLISHED_VOLUME_WITH_PIT")
        return result

    if float(row.vma5) < float(row.vma60):
        result.update(gate_status="REJECTED", reason="VOLUME_BELOW_60_FALSE_START")
        return result

    result.update(stage_status="VOLUME_SETUP", reason="VOLUME_STRUCTURE_INCOMPLETE")
    return result


def allowed_for_ticker(ticker, pattern):
    allowed = ALLOWED_PATTERNS.get(str(ticker).upper())
    return True if allowed is None else pattern in allowed


def new_empty_ledger():
    return pd.DataFrame(columns=[
        "trade_id", "status", "ticker", "industry", "pattern", "pattern_zh",
        "gate_status", "stage_status", "risk_status", "signal_reason",
        "signal_date", "entry_date", "entry_price", "stop_price", "target_price",
        "pullback_low", "atr14", "last_date", "last_price", "exit_date", "exit_price",
        "exit_reason", "hold_days", "return_pct", "created_at", "updated_at",
    ])


def load_ledger(path):
    ledger = pd.read_csv(path) if path.exists() else new_empty_ledger()
    for col in new_empty_ledger().columns:
        if col not in ledger.columns:
            ledger[col] = ""
    return ledger


def trade_id(ticker, signal_date, pattern):
    return f"2560-{ticker}-{signal_date:%Y%m%d}-{pattern}"


def iso_date(v):
    return pd.to_datetime(v).strftime("%Y-%m-%d")


def run(args):
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    ledger_path = out_dir / "2560_paper_trades.csv"
    ledger = load_ledger(ledger_path)
    now = datetime.now(timezone.utc).isoformat()
    price_cache = {}
    scan_rows = []
    scan_errors = []
    new_signals = []

    for ticker, industry in UNIVERSE.items():
        try:
            prices = load_price(ticker, args)
            price_cache[ticker] = prices
            last = prices.iloc[-1]
            signal = evaluate_signal(last)
            pattern = signal["pattern_type"]
            allowed = bool(
                signal["gate_status"] == "PASS"
                and signal["stage_status"] == "TRIGGERED"
                and signal["risk_status"] == "NORMAL"
                and pattern != "NONE"
                and allowed_for_ticker(ticker, pattern)
            )
            scan_rows.append({
                "ticker": ticker,
                "industry": industry,
                "latest_market_date": iso_date(last.date),
                "close": round(float(last.close), 4),
                "ma5_price": round(float(last.ma5_price), 4),
                "ma25_price": round(float(last.ma25_price), 4),
                "vma5": round(float(last.vma5), 2),
                "vma60": round(float(last.vma60), 2),
                "distance_to_ma25_atr": round(float(last.distance_to_ma25_atr), 3),
                "gate_status": signal["gate_status"],
                "stage_status": signal["stage_status"],
                "pattern_type": pattern,
                "pattern_zh": PATTERN_ZH.get(pattern, ""),
                "risk_status": signal["risk_status"],
                "reason": signal["reason"],
                "allowed_signal": allowed,
            })

            if allowed:
                tid = trade_id(ticker, last.date, pattern)
                exists = (ledger.trade_id == tid).any() if not ledger.empty else False
                has_open = ((ledger.ticker == ticker) & ledger.status.isin(["PENDING", "OPEN"])).any() if not ledger.empty else False
                if not exists and not has_open:
                    row = {
                        "trade_id": tid,
                        "status": "PENDING",
                        "ticker": ticker,
                        "industry": industry,
                        "pattern": pattern,
                        "pattern_zh": PATTERN_ZH.get(pattern, pattern),
                        "gate_status": signal["gate_status"],
                        "stage_status": signal["stage_status"],
                        "risk_status": signal["risk_status"],
                        "signal_reason": signal["reason"],
                        "signal_date": iso_date(last.date),
                        "entry_date": "",
                        "entry_price": "",
                        "stop_price": "",
                        "target_price": "",
                        "pullback_low": float(last.pullback_low),
                        "atr14": float(last.atr14),
                        "last_date": iso_date(last.date),
                        "last_price": float(last.close),
                        "exit_date": "",
                        "exit_price": "",
                        "exit_reason": "",
                        "hold_days": "",
                        "return_pct": "",
                        "created_at": now,
                        "updated_at": now,
                    }
                    ledger = pd.concat([ledger, pd.DataFrame([row])], ignore_index=True)
                    new_signals.append({
                        "ticker": ticker,
                        "pattern": pattern,
                        "pattern_zh": PATTERN_ZH.get(pattern, pattern),
                        "signal_date": iso_date(last.date),
                        "trade_id": tid,
                    })
        except Exception as exc:
            scan_errors.append({"ticker": ticker, "error": str(exc)})
            print(f"SCAN SKIP {ticker}: {exc}")

    for i, trade in ledger.iterrows():
        try:
            ticker = trade.ticker
            prices = price_cache.get(ticker) or load_price(ticker, args)
            last = prices.iloc[-1]
            status = str(trade.status)

            if status == "PENDING":
                signal_date = pd.to_datetime(trade.signal_date)
                idxs = prices.index[prices.date > signal_date].tolist()
                if idxs:
                    entry = prices.iloc[idxs[0]]
                    entry_price = float(entry.open) * (1.0 + args.slippage)
                    pullback_low = float(trade.pullback_low) if str(trade.pullback_low) not in {"", "nan"} else float(last.pullback_low)
                    atr14 = float(trade.atr14) if str(trade.atr14) not in {"", "nan"} else float(last.atr14)
                    structure_stop = pullback_low - STRUCTURE_BUFFER_ATR * atr14
                    atr_stop = entry_price - ATR_STOP_MULTIPLE * atr14
                    stop_price = max(structure_stop, atr_stop)
                    target_price = entry_price * (1.0 + PAPER_TARGET_RETURN)
                    ledger.loc[i, [
                        "status", "entry_date", "entry_price", "stop_price", "target_price",
                        "last_date", "last_price", "updated_at",
                    ]] = [
                        "OPEN", iso_date(entry.date), entry_price, stop_price, target_price,
                        iso_date(last.date), float(last.close), now,
                    ]

            elif status == "OPEN":
                entry_price = float(trade.entry_price)
                entry_date = pd.to_datetime(trade.entry_date)
                idxs = prices.index[prices.date >= entry_date].tolist()
                hold_days = len(idxs) - 1 if idxs else 0
                close = float(last.close)
                ret = close / entry_price - 1.0
                stop_price = float(trade.stop_price) if str(trade.stop_price) not in {"", "nan"} else entry_price - ATR_STOP_MULTIPLE * float(last.atr14)
                target_price = float(trade.target_price) if str(trade.target_price) not in {"", "nan"} else entry_price * (1.0 + PAPER_TARGET_RETURN)

                current_signal = evaluate_signal(last)
                reason = None
                if close <= stop_price or current_signal["risk_status"] == "FAILED":
                    reason = "structure_or_atr_stop"
                elif close >= target_price:
                    reason = "paper_target_15pct"
                elif hold_days >= MAX_HOLD_DAYS:
                    reason = "expired_30d"
                elif current_signal["risk_status"] in {"EXTENDED", "TOO_DEEP"}:
                    reason = "risk_state_exit"

                ledger.loc[i, [
                    "last_date", "last_price", "hold_days", "return_pct",
                    "gate_status", "stage_status", "risk_status", "signal_reason", "updated_at",
                ]] = [
                    iso_date(last.date), close, hold_days, ret,
                    current_signal["gate_status"], current_signal["stage_status"],
                    current_signal["risk_status"], current_signal["reason"], now,
                ]
                if reason:
                    ledger.loc[i, [
                        "status", "exit_date", "exit_price", "exit_reason", "updated_at",
                    ]] = ["CLOSED", iso_date(last.date), close, reason, now]
        except Exception as exc:
            scan_errors.append({"ticker": getattr(trade, "ticker", ""), "error": f"UPDATE: {exc}"})
            print(f"UPDATE SKIP {getattr(trade, 'ticker', '')}: {exc}")

    ledger.to_csv(ledger_path, index=False)
    open_pos = ledger[ledger.status.isin(["PENDING", "OPEN"])] if not ledger.empty else ledger
    closed = ledger[ledger.status == "CLOSED"] if not ledger.empty else ledger
    open_pos.to_csv(out_dir / "2560_open_positions.csv", index=False)
    closed.to_csv(out_dir / "2560_closed_trades.csv", index=False)

    if closed.empty:
        summary = pd.DataFrame([{
            "closed_trades": 0, "win_rate": "", "avg_return": "",
            "median_return": "", "profit_factor": "",
        }])
    else:
        returns = pd.to_numeric(closed.return_pct, errors="coerce")
        wins = returns[returns > 0]
        losses = returns[returns <= 0]
        pf = wins.sum() / abs(losses.sum()) if abs(losses.sum()) > 0 else math.nan
        summary = pd.DataFrame([{
            "closed_trades": len(closed),
            "win_rate": f"{(returns > 0).mean():.2%}",
            "avg_return": f"{returns.mean():.2%}",
            "median_return": f"{returns.median():.2%}",
            "profit_factor": "" if pd.isna(pf) else f"{pf:.2f}",
        }])
    summary.to_csv(out_dir / "2560_paper_summary.csv", index=False)

    audit = {
        "ok": len(scan_errors) == 0,
        "engine_version": "2560-v1.0-ratified",
        "run_at_utc": now,
        "source": args.source,
        "universe_count": len(UNIVERSE),
        "scanned_count": len(scan_rows),
        "error_count": len(scan_errors),
        "new_signal_count": len(new_signals),
        "new_signals": new_signals,
        "errors": scan_errors,
        "scans": scan_rows,
    }
    (out_dir / "2560_last_scan.json").write_text(
        json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf8"
    )
    print(
        "2560 paper bot done. "
        f"Scanned: {len(scan_rows)}/{len(UNIVERSE)} "
        f"New signals: {len(new_signals)} Errors: {len(scan_errors)} "
        f"Open/Pending: {len(open_pos)} Closed: {len(closed)}"
    )


def parse_args(argv: Optional[Sequence[str]] = None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=("csv", "yfinance"), default="yfinance")
    parser.add_argument("--data-dir", default="data/prices")
    parser.add_argument("--output-dir", default="reports/paper")
    parser.add_argument("--start", default="2024-01-01")
    parser.add_argument("--slippage", type=float, default=0.002)
    return parser.parse_args(argv)


if __name__ == "__main__":
    run(parse_args())
