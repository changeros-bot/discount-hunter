#!/usr/bin/env python3
"""
Leveraged Hunter Trade Simulation

Purpose:
- Convert Leveraged Hunter tactical events into a simple trade simulation.
- This is research only. It does not execute trades.

Josh baseline parameters:
- Single buy: 5U
- Total capital: 50U
- Single asset limit: 15U
- Take profit: 12%
- Stop loss: 8%
- Holding window: 30 days

Validation upgrades:
- Signal C is risk-off / no-trade.
- Adds commission, spread, slippage cost model.
- Adds expectancy, profit factor, sample level, and max drawdown proxy.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Optional, Sequence

try:
    import pandas as pd
except ImportError as exc:  # pragma: no cover
    raise SystemExit("pandas is required. Install with: pip install pandas") from exc


RISK_OFF_SIGNALS = {"C_過度波動禁止型"}


@dataclass
class PositionState:
    invested: float = 0.0
    open_trades: int = 0


@dataclass
class PortfolioState:
    cash_limit: float
    single_limit: float
    trade_size: float
    total_invested: float = 0.0
    realized_pnl: float = 0.0
    gross_pnl: float = 0.0
    total_cost: float = 0.0
    positions: Dict[str, PositionState] = field(default_factory=dict)
    skipped_budget: int = 0
    skipped_limit: int = 0
    skipped_risk_off: int = 0
    trades: int = 0
    wins: int = 0
    losses: int = 0

    def can_trade(self, ticker: str) -> tuple[bool, str]:
        pos = self.positions.setdefault(ticker, PositionState())
        if self.total_invested + self.trade_size > self.cash_limit:
            return False, "總資金上限"
        if pos.invested + self.trade_size > self.single_limit:
            return False, "單檔上限"
        return True, "OK"

    def record_trade(self, ticker: str, gross_pnl: float, cost: float) -> float:
        net_pnl = gross_pnl - cost
        pos = self.positions.setdefault(ticker, PositionState())
        pos.invested += self.trade_size
        pos.open_trades += 1
        self.total_invested += self.trade_size
        self.gross_pnl += gross_pnl
        self.total_cost += cost
        self.realized_pnl += net_pnl
        self.trades += 1
        if net_pnl > 0:
            self.wins += 1
        elif net_pnl < 0:
            self.losses += 1
        return net_pnl


def parse_pct(value) -> float:
    if pd.isna(value):
        return 0.0
    if isinstance(value, str):
        v = value.strip()
        if not v:
            return 0.0
        if v.endswith("%"):
            return float(v[:-1]) / 100.0
        return float(v)
    return float(value)


def choose_exit_return(row: pd.Series, take_profit: float, stop_loss: float, hold_col: str) -> tuple[float, str]:
    adverse = parse_pct(row.get("max_adverse_60d", 0))
    fwd = parse_pct(row.get(hold_col, 0))
    if adverse <= -abs(stop_loss):
        return -abs(stop_loss), "停損"
    if fwd >= take_profit:
        return take_profit, "停利"
    return fwd, "時間出場"


def round_trip_cost(trade_size: float, commission_bps: float, spread_bps: float, slippage_bps: float) -> float:
    # Round-trip cost assumes entry + exit. bps = basis points, 100 bps = 1%.
    total_bps = 2.0 * (commission_bps + spread_bps + slippage_bps)
    return trade_size * total_bps / 10000.0


def sample_level(trades: int) -> str:
    if trades < 30:
        return "樣本不足"
    if trades < 50:
        return "初步觀察"
    if trades < 100:
        return "研究可用"
    if trades < 200:
        return "候選策略"
    return "策略研究成熟"


def append_skip(rows, row, reason, state):
    rows.append({
        "date": row["date"],
        "ticker": str(row["ticker"]),
        "signal": row.get("signal", ""),
        "action": "SKIP",
        "reason": reason,
        "trade_size": 0,
        "exit_return": 0,
        "gross_pnl": 0,
        "cost": 0,
        "net_pnl": 0,
        "realized_pnl": state.realized_pnl,
        "total_invested": state.total_invested,
    })


def max_drawdown_from_curve(values: list[float]) -> float:
    if not values:
        return 0.0
    peak = values[0]
    max_dd = 0.0
    for value in values:
        peak = max(peak, value)
        dd = value - peak
        max_dd = min(max_dd, dd)
    return max_dd


def run(args: argparse.Namespace) -> None:
    events_path = Path(args.events)
    if not events_path.exists():
        raise SystemExit(f"Missing events file: {events_path}")
    df = pd.read_csv(events_path)
    if df.empty:
        raise SystemExit("Events file is empty")
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date")

    state = PortfolioState(cash_limit=args.total_capital, single_limit=args.single_limit, trade_size=args.trade_size)
    rows = []
    hold_col = f"ret_{args.hold_days}d"
    if hold_col not in df.columns:
        raise SystemExit(f"Missing column {hold_col}; rerun backtest with --forward-windows including {args.hold_days}, or choose available hold days")

    for _, row in df.iterrows():
        ticker = str(row["ticker"])
        signal = str(row.get("signal", ""))
        if args.exclude_risk_off and signal in RISK_OFF_SIGNALS:
            state.skipped_risk_off += 1
            append_skip(rows, row, "風險訊號不交易", state)
            continue

        ok, reason = state.can_trade(ticker)
        if not ok:
            if reason == "總資金上限":
                state.skipped_budget += 1
            else:
                state.skipped_limit += 1
            append_skip(rows, row, reason, state)
            continue

        exit_return, exit_reason = choose_exit_return(row, args.take_profit, args.stop_loss, hold_col)
        gross_pnl = args.trade_size * exit_return
        cost = round_trip_cost(args.trade_size, args.commission_bps, args.spread_bps, args.slippage_bps)
        net_pnl = state.record_trade(ticker, gross_pnl, cost)
        rows.append({
            "date": row["date"],
            "ticker": ticker,
            "signal": signal,
            "action": "TRADE",
            "reason": exit_reason,
            "trade_size": args.trade_size,
            "exit_return": exit_return,
            "gross_pnl": gross_pnl,
            "cost": cost,
            "net_pnl": net_pnl,
            "realized_pnl": state.realized_pnl,
            "total_invested": state.total_invested,
        })

    out = pd.DataFrame(rows)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(output, index=False)

    traded = out[out["action"] == "TRADE"].copy()
    if not traded.empty:
        by_ticker = traded.groupby("ticker", dropna=False).agg(
            trades=("ticker", "count"),
            gross_pnl=("gross_pnl", "sum"),
            cost=("cost", "sum"),
            pnl=("net_pnl", "sum"),
            avg_return=("exit_return", "mean"),
        ).reset_index()
        by_signal = traded.groupby("signal", dropna=False).agg(
            trades=("signal", "count"),
            gross_pnl=("gross_pnl", "sum"),
            cost=("cost", "sum"),
            pnl=("net_pnl", "sum"),
            avg_return=("exit_return", "mean"),
        ).reset_index()
        gross_profit = traded.loc[traded["net_pnl"] > 0, "net_pnl"].sum()
        gross_loss = abs(traded.loc[traded["net_pnl"] < 0, "net_pnl"].sum())
        expectancy = traded["net_pnl"].mean()
        profit_factor = gross_profit / gross_loss if gross_loss else None
        max_drawdown = max_drawdown_from_curve(traded["realized_pnl"].tolist())
    else:
        by_ticker = pd.DataFrame(columns=["ticker", "trades", "gross_pnl", "cost", "pnl", "avg_return"])
        by_signal = pd.DataFrame(columns=["signal", "trades", "gross_pnl", "cost", "pnl", "avg_return"])
        expectancy = 0.0
        profit_factor = None
        max_drawdown = 0.0

    by_ticker.to_csv(output.with_name(output.stem + "_by_ticker.csv"), index=False)
    by_signal.to_csv(output.with_name(output.stem + "_by_signal.csv"), index=False)

    summary = pd.DataFrame([{
        "total_capital": args.total_capital,
        "trade_size": args.trade_size,
        "single_limit": args.single_limit,
        "hold_days": args.hold_days,
        "take_profit": args.take_profit,
        "stop_loss": args.stop_loss,
        "commission_bps": args.commission_bps,
        "spread_bps": args.spread_bps,
        "slippage_bps": args.slippage_bps,
        "round_trip_cost_bps": 2.0 * (args.commission_bps + args.spread_bps + args.slippage_bps),
        "trades": state.trades,
        "sample_level": sample_level(state.trades),
        "wins": state.wins,
        "losses": state.losses,
        "win_rate": state.wins / state.trades if state.trades else 0,
        "total_invested": state.total_invested,
        "gross_pnl": state.gross_pnl,
        "total_cost": state.total_cost,
        "realized_pnl": state.realized_pnl,
        "expectancy_per_trade": expectancy,
        "profit_factor": profit_factor,
        "max_drawdown_pnl": max_drawdown,
        "return_on_used_capital": state.realized_pnl / state.total_invested if state.total_invested else 0,
        "skipped_budget": state.skipped_budget,
        "skipped_limit": state.skipped_limit,
        "skipped_risk_off": state.skipped_risk_off,
        "research_status": "不可判定" if state.trades < 30 else "可初步觀察",
    }])
    summary_path = output.with_name(output.stem + "_summary.csv")
    summary.to_csv(summary_path, index=False)

    print(f"Simulation complete. Trades: {state.trades}, Gross PnL: {state.gross_pnl:.2f}U, Cost: {state.total_cost:.2f}U, Net PnL: {state.realized_pnl:.2f}U")
    print(f"Sample level: {sample_level(state.trades)}")
    print(f"Skipped risk-off: {state.skipped_risk_off}")
    print(f"Wrote: {output}")
    print(f"Wrote: {summary_path}")
    print(f"Wrote: {output.with_name(output.stem + '_by_ticker.csv')}")
    print(f"Wrote: {output.with_name(output.stem + '_by_signal.csv')}")


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Leveraged Hunter trade simulation")
    parser.add_argument("--events", default="reports/backtests/leveraged_hunter_events.csv")
    parser.add_argument("--output", default="reports/backtests/leveraged_hunter_simulation.csv")
    parser.add_argument("--total-capital", type=float, default=50.0)
    parser.add_argument("--trade-size", type=float, default=5.0)
    parser.add_argument("--single-limit", type=float, default=15.0)
    parser.add_argument("--hold-days", type=int, choices=(5, 10, 20, 30, 60), default=30)
    parser.add_argument("--take-profit", type=float, default=0.12)
    parser.add_argument("--stop-loss", type=float, default=0.08)
    parser.add_argument("--commission-bps", type=float, default=10.0)
    parser.add_argument("--spread-bps", type=float, default=15.0)
    parser.add_argument("--slippage-bps", type=float, default=10.0)
    parser.add_argument("--exclude-risk-off", action="store_true", default=True)
    return parser.parse_args(argv)


if __name__ == "__main__":
    run(parse_args())
