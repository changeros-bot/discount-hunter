#!/usr/bin/env python3
"""2560 Paper Bot V0.8. Paper ledger only. No broker, no orders."""
from __future__ import annotations

import argparse, json, math
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

ALLOWED_PATTERNS = {
    "MU": {"沖量", "縮量黑馬"},
    "NBIS": {"沖量", "縮量黑馬"},
}


def flat(raw):
    if isinstance(raw.columns, pd.MultiIndex):
        level = 0
        for i in range(raw.columns.nlevels):
            vals = [str(x).lower() for x in raw.columns.get_level_values(i)]
            if any(v in {"open", "high", "low", "close", "adj close", "volume"} for v in vals):
                level = i; break
        raw = raw.copy(); raw.columns = raw.columns.get_level_values(level)
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
    out["ma25"] = out.close.rolling(25, min_periods=25).mean()
    out["ma25_rising_3d"] = (out.ma25 > out.ma25.shift(1)) & (out.ma25.shift(1) > out.ma25.shift(2))
    out["ma25_slope_5d"] = out.ma25 / out.ma25.shift(5) - 1.0
    prev = out.close.shift(1)
    tr = pd.concat([(out.high - out.low), (out.high - prev).abs(), (out.low - prev).abs()], axis=1).max(axis=1)
    out["atr14"] = tr.rolling(14, min_periods=14).mean()
    out["ma25_distance_atr"] = (out.close - out.ma25).abs() / out.atr14
    out["near_ma25"] = out.ma25_distance_atr <= 1.5
    out["above_ma25"] = out.close >= out.ma25
    out["ma25_ok"] = out.ma25_rising_3d | (out.ma25_slope_5d >= -0.003)
    out["vol5"] = out.volume.rolling(5, min_periods=5).mean()
    out["vol60"] = out.volume.rolling(60, min_periods=30).mean()
    out["vol_above"] = out.vol5 >= out.vol60
    out["vol_cross_up"] = (out.vol5 >= out.vol60) & (out.vol5.shift(1) < out.vol60.shift(1))
    out["shrink"] = out.volume <= out.vol60
    out["low_volume_20d"] = out.volume <= out.volume.rolling(20, min_periods=10).min() * 1.05
    out["ma200"] = out.close.rolling(200, min_periods=120).mean()
    out["above_ma200"] = out.close >= out.ma200
    out["ret_3d"] = out.close / out.close.shift(3) - 1.0
    out["ret_5d"] = out.close / out.close.shift(5) - 1.0
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


def classify(row):
    if not bool(row.ma25_ok): return None
    near, vol_above, vol_cross = bool(row.near_ma25), bool(row.vol_above), bool(row.vol_cross_up)
    rising = float(row.ret_3d) > 0 or float(row.ret_5d) > 0
    if not vol_above and not vol_cross and rising: return "弱量續攻"
    if bool(row.above_ma25) and vol_cross: return "沖量"
    if near and bool(row.shrink) and bool(row.low_volume_20d) and bool(row.above_ma200): return "縮量黑馬"
    if near and vol_above: return "波段"
    return None


def allowed_for_ticker(ticker, pattern):
    allowed = ALLOWED_PATTERNS.get(str(ticker).upper())
    return True if allowed is None else pattern in allowed


def new_empty_ledger():
    return pd.DataFrame(columns=["trade_id","status","ticker","industry","pattern","signal_date","entry_date","entry_price","stop_price","target_price","last_date","last_price","exit_date","exit_price","exit_reason","hold_days","return_pct","created_at","updated_at"])


def load_ledger(path):
    return pd.read_csv(path) if path.exists() else new_empty_ledger()


def trade_id(ticker, signal_date, pattern):
    return f"2560-{ticker}-{signal_date:%Y%m%d}-{pattern}"


def iso_date(v):
    return pd.to_datetime(v).strftime("%Y-%m-%d")


def run(args):
    out_dir = Path(args.output_dir); out_dir.mkdir(parents=True, exist_ok=True)
    ledger_path = out_dir / "2560_paper_trades.csv"
    ledger = load_ledger(ledger_path)
    now = datetime.now(timezone.utc).isoformat()
    price_cache = {}
    scan_rows = []
    scan_errors = []
    new_signals = []

    for ticker, industry in UNIVERSE.items():
        try:
            p = load_price(ticker, args); price_cache[ticker] = p
            last = p.iloc[-1]
            pattern = classify(last)
            allowed = bool(pattern and allowed_for_ticker(ticker, pattern))
            scan_rows.append({
                "ticker": ticker,
                "industry": industry,
                "latest_market_date": iso_date(last.date),
                "close": round(float(last.close), 4),
                "pattern": pattern or "",
                "allowed_signal": allowed,
            })
            if allowed:
                tid = trade_id(ticker, last.date, pattern)
                exists = (ledger.trade_id == tid).any() if not ledger.empty else False
                has_open = ((ledger.ticker == ticker) & (ledger.status == "OPEN")).any() if not ledger.empty else False
                if not exists and not has_open:
                    idxs = p.index[p.date > last.date].tolist()
                    entry_date = ""
                    entry_price = ""
                    if idxs:
                        e = p.iloc[idxs[0]]
                        entry_date = e.date
                        entry_price = float(e.open) * (1.0 + args.slippage)
                    row = {
                        "trade_id": tid, "status": "PENDING", "ticker": ticker, "industry": industry, "pattern": pattern,
                        "signal_date": iso_date(last.date), "entry_date": iso_date(entry_date) if entry_date != "" else "", "entry_price": entry_price,
                        "stop_price": "", "target_price": "", "last_date": iso_date(last.date), "last_price": float(last.close),
                        "exit_date": "", "exit_price": "", "exit_reason": "", "hold_days": "", "return_pct": "",
                        "created_at": now, "updated_at": now,
                    }
                    ledger = pd.concat([ledger, pd.DataFrame([row])], ignore_index=True)
                    new_signals.append({"ticker": ticker, "pattern": pattern, "signal_date": iso_date(last.date), "trade_id": tid})
        except Exception as exc:
            msg = f"SCAN SKIP {ticker}: {exc}"
            scan_errors.append({"ticker": ticker, "error": str(exc)})
            print(msg)

    for i, tr in ledger.iterrows():
        try:
            ticker = tr.ticker
            p = price_cache.get(ticker)
            if p is None:
                p = load_price(ticker, args)
            last = p.iloc[-1]
            status = str(tr.status)
            if status == "PENDING":
                sdate = pd.to_datetime(tr.signal_date)
                idxs = p.index[p.date > sdate].tolist()
                if idxs:
                    e = p.iloc[idxs[0]]
                    ep = float(e.open) * (1.0 + args.slippage)
                    ledger.loc[i, ["status","entry_date","entry_price","stop_price","target_price","last_date","last_price","updated_at"]] = ["OPEN", iso_date(e.date), ep, ep * 0.92, ep * 1.15, iso_date(last.date), float(last.close), now]
            elif status == "OPEN":
                ep = float(tr.entry_price); entry_date = pd.to_datetime(tr.entry_date)
                idxs = p.index[p.date >= entry_date].tolist()
                hold = len(idxs) - 1 if idxs else 0
                close = float(last.close); ret = close / ep - 1.0
                reason = None
                if ret <= -0.08: reason = "stop_loss_8pct"
                elif ret >= 0.15: reason = "take_profit_15pct"
                elif hold >= 30: reason = "max_30d"
                ledger.loc[i, ["last_date","last_price","hold_days","return_pct","updated_at"]] = [iso_date(last.date), close, hold, ret, now]
                if reason:
                    ledger.loc[i, ["status","exit_date","exit_price","exit_reason","updated_at"]] = ["CLOSED", iso_date(last.date), close, reason, now]
        except Exception as exc:
            scan_errors.append({"ticker": getattr(tr, "ticker", ""), "error": f"UPDATE: {exc}"})
            print(f"UPDATE SKIP {getattr(tr, 'ticker', '')}: {exc}")

    ledger.to_csv(ledger_path, index=False)
    open_pos = ledger[ledger.status.isin(["PENDING", "OPEN"])] if not ledger.empty else ledger
    closed = ledger[ledger.status == "CLOSED"] if not ledger.empty else ledger
    open_pos.to_csv(out_dir / "2560_open_positions.csv", index=False)
    closed.to_csv(out_dir / "2560_closed_trades.csv", index=False)

    if closed.empty:
        summary = pd.DataFrame([{"closed_trades":0,"win_rate":"","avg_return":"","median_return":"","profit_factor":""}])
    else:
        returns = pd.to_numeric(closed.return_pct, errors="coerce")
        wins = returns[returns > 0]; losses = returns[returns <= 0]
        pf = wins.sum() / abs(losses.sum()) if abs(losses.sum()) > 0 else math.nan
        summary = pd.DataFrame([{"closed_trades":len(closed),"win_rate":f"{(returns>0).mean():.2%}","avg_return":f"{returns.mean():.2%}","median_return":f"{returns.median():.2%}","profit_factor":"" if pd.isna(pf) else f"{pf:.2f}"}])
    summary.to_csv(out_dir / "2560_paper_summary.csv", index=False)

    audit = {
        "ok": len(scan_errors) == 0,
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
    (out_dir / "2560_last_scan.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf8")
    print(f"2560 paper bot done. Scanned: {len(scan_rows)}/{len(UNIVERSE)} New signals: {len(new_signals)} Errors: {len(scan_errors)} Open/Pending: {len(open_pos)} Closed: {len(closed)}")


def parse_args(argv: Optional[Sequence[str]] = None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", choices=("csv", "yfinance"), default="yfinance")
    ap.add_argument("--data-dir", default="data/prices")
    ap.add_argument("--output-dir", default="reports/paper")
    ap.add_argument("--start", default="2024-01-01")
    ap.add_argument("--slippage", type=float, default=0.002)
    return ap.parse_args(argv)

if __name__ == "__main__":
    run(parse_args())
