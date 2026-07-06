#!/usr/bin/env python3
"""
Leveraged Hunter Trade Simulation

Purpose:
- Convert Leveraged Hunter tactical events into two outputs:
  1. Sandbox simulation: respects Josh's 50U / 5U / 15U capital rules.
  2. Signal Research mode: ignores capital limits and measures every eligible signal.

Research only. This does not execute trades.

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


def research_status(trades: int) -> str:
    if trades < 30:
        return "不可判定"
    if trades < 100:
        return "只可研究"
    return "可做候選比較"


def max_drawdown_from_curve(values: list[float]) -> float:
    if not values:
        return 0.0
    peak = values[0]
    max_dd = 0.0
    for value in values:
        peak = max(peak, value)
        max_dd = min(max_dd, value - peak)
    return max_dd


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


def build_trade_row(row: pd.Series, args: argparse.Namespace, hold_col: str, cumulative_pnl: float = 0.0) -> tuple[dict, float]:
    exit_return, exit_reason = choose_exit_return(row, args.take_profit, args.stop_loss, hold_col)
    gross_pnl = args.trade_size * exit_return
    cost = round_trip_cost(args.trade_size, args.commission_bps, args.spread_bps, args.slippage_bps)
    net_pnl = gross_pnl - cost
    realized_pnl = cumulative_pnl + net_pnl
    return {
        "date": row["date"],
        "ticker": str(row["ticker"]),
        "signal": str(row.get("signal", "")),
        "action": "TRADE",
        "reason": exit_reason,
        "trade_size": args.trade_size,
        "exit_return": exit_return,
        "gross_pnl": gross_pnl,
        "cost": cost,
        "net_pnl": net_pnl,
        "realized_pnl": realized_pnl,
    }, realized_pnl


def summarize_trades(traded: pd.DataFrame, args: argparse.Namespace, mode: str, skipped_budget: int = 0, skipped_limit: int = 0, skipped_risk_off: int = 0) -> pd.DataFrame:
    if traded.empty:
        trades = wins = losses = 0
        total_invested = gross_pnl = total_cost = realized_pnl = expectancy = max_dd = 0.0
        profit_factor = None
    else:
        trades = len(traded)
        wins = int((traded["net_pnl"] > 0).sum())
        losses = int((traded["net_pnl"] < 0).sum())
        total_invested = float(trades * args.trade_size)
        gross_pnl = float(traded["gross_pnl"].sum())
        total_cost = float(traded["cost"].sum())
        realized_pnl = float(traded["net_pnl"].sum())
        expectancy = float(traded["net_pnl"].mean())
        gross_profit = float(traded.loc[traded["net_pnl"] > 0, "net_pnl"].sum())
        gross_loss = abs(float(traded.loc[traded["net_pnl"] < 0, "net_pnl"].sum()))
        profit_factor = gross_profit / gross_loss if gross_loss else None
        max_dd = max_drawdown_from_curve(traded["realized_pnl"].tolist())
    return pd.DataFrame([{
        "mode": mode,
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
        "trades": trades,
        "sample_level": sample_level(trades),
        "wins": wins,
        "losses": losses,
        "win_rate": wins / trades if trades else 0,
        "total_invested": total_invested,
        "gross_pnl": gross_pnl,
        "total_cost": total_cost,
        "realized_pnl": realized_pnl,
        "expectancy_per_trade": expectancy,
        "profit_factor": profit_factor,
        "max_drawdown_pnl": max_dd,
        "return_on_used_capital": realized_pnl / total_invested if total_invested else 0,
        "skipped_budget": skipped_budget,
        "skipped_limit": skipped_limit,
        "skipped_risk_off": skipped_risk_off,
        "research_status": research_status(trades),
    }])


def write_breakdowns(traded: pd.DataFrame, output: Path) -> None:
    if not traded.empty:
        by_ticker = traded.groupby("ticker", dropna=False).agg(
            trades=("ticker", "count"), gross_pnl=("gross_pnl", "sum"), cost=("cost", "sum"), pnl=("net_pnl", "sum"), avg_return=("exit_return", "mean")
        ).reset_index()
        by_signal = traded.groupby("signal", dropna=False).agg(
            trades=("signal", "count"), gross_pnl=("gross_pnl", "sum"), cost=("cost", "sum"), pnl=("net_pnl", "sum"), avg_return=("exit_return", "mean")
        ).reset_index()
    else:
        by_ticker = pd.DataFrame(columns=["ticker", "trades", "gross_pnl", "cost", "pnl", "avg_return"])
        by_signal = pd.DataFrame(columns=["signal", "trades", "gross_pnl", "cost", "pnl", "avg_return"])
    by_ticker.to_csv(output.with_name(output.stem + "_by_ticker.csv"), index=False)
    by_signal.to_csv(output.with_name(output.stem + "_by_signal.csv"), index=False)


def run(args: argparse.Namespace) -> None:
    events_path = Path(args.events)
    if not events_path.exists():
        raise SystemExit(f"Missing events file: {events_path}")
    df = pd.read_csv(events_path)
    if df.empty:
        raise SystemExit("Events file is empty")
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date")

    hold_col = f"ret_{args.hold_days}d"
    if hold_col not in df.columns:
        raise SystemExit(f"Missing column {hold_col}; rerun backtest with required forward window")

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    # 1. Sandbox simulation: respects 50U capital and 15U single-asset limit.
    state = PortfolioState(cash_limit=args.total_capital, single_limit=args.single_limit, trade_size=args.trade_size)
    sandbox_rows = []
    for _, row in df.iterrows():
        ticker = str(row["ticker"])
        signal = str(row.get("signal", ""))
        if args.exclude_risk_off and signal in RISK_OFF_SIGNALS:
            state.skipped_risk_off += 1
            append_skip(sandbox_rows, row, "風險訊號不交易", state)
            continue
        ok, reason = state.can_trade(ticker)
        if not ok:
            if reason == "總資金上限":
                state.skipped_budget += 1
            else:
                state.skipped_limit += 1
            append_skip(sandbox_rows, row, reason, state)
            continue
        trade_row, _ = build_trade_row(row, args, hold_col, state.realized_pnl)
        net_pnl = state.record_trade(ticker, trade_row["gross_pnl"], trade_row["cost"])
        trade_row["net_pnl"] = net_pnl
        trade_row["realized_pnl"] = state.realized_pnl
        trade_row["total_invested"] = state.total_invested
        sandbox_rows.append(trade_row)

    sandbox = pd.DataFrame(sandbox_rows)
    sandbox.to_csv(output, index=False)
    sandbox_traded = sandbox[sandbox["action"] == "TRADE"].copy()
    write_breakdowns(sandbox_traded, output)
    sandbox_summary = summarize_trades(sandbox_traded, args, "sandbox_50u", state.skipped_budget, state.skipped_limit, state.skipped_risk_off)
    sandbox_summary.to_csv(output.with_name(output.stem + "_summary.csv"), index=False)

    # 2. Signal Research mode: ignores capital limits, excludes risk-off signals, trades every eligible signal.
    research_rows = []
    research_pnl = 0.0
    research_skipped_risk_off = 0
    for _, row in df.iterrows():
        signal = str(row.get("signal", ""))
        if args.exclude_risk_off and signal in RISK_OFF_SIGNALS:
            research_skipped_risk_off += 1
            continue
        trade_row, research_pnl = build_trade_row(row, args, hold_col, research_pnl)
        research_rows.append(trade_row)

    research_output = output.with_name(output.stem.replace("simulation", "research") + ".csv")
    research = pd.DataFrame(research_rows)
    research.to_csv(research_output, index=False)
    write_breakdowns(research, research_output)
    research_summary = summarize_trades(research, args, "signal_research", 0, 0, research_skipped_risk_off)
    research_summary.to_csv(research_output.with_name(research_output.stem + "_summary.csv"), index=False)

    print(f"Sandbox complete. Trades: {len(sandbox_traded)}, Net PnL: {float(sandbox_traded['net_pnl'].sum()) if not sandbox_traded.empty else 0:.2f}U")
    print(f"Signal Research complete. Trades: {len(research)}, Net PnL: {float(research['net_pnl'].sum()) if not research.empty else 0:.2f}U")
    print(f"Sandbox sample level: {sample_level(len(sandbox_traded))}")
    print(f"Research sample level: {sample_level(len(research))}")
    print(f"Wrote: {output}")
    print(f"Wrote: {output.with_name(output.stem + '_summary.csv')}")
    print(f"Wrote: {research_output}")
    print(f"Wrote: {research_output.with_name(research_output.stem + '_summary.csv')}")


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
