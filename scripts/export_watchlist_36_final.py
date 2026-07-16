#!/usr/bin/env python3
from pathlib import Path
import pandas as pd

ROOT = Path('reports/backtests/market_46')
SRC = ROOT / 'watchlist_36_group_decision_summary.csv'
OUT = ROOT / 'watchlist_36_final.csv'

KEEP = [
    'ticker','strategy_bucket','fundamental_status','quality_points','backtest_points',
    'valuation_band','decision','decision_reason'
]

RENAME = {
    'strategy_bucket': 'strategy',
    'quality_points': 'quality_score',
    'backtest_points': 'backtest_score',
    'decision_reason': 'reason',
}


def main():
    df = pd.read_csv(SRC)
    assert len(df) == 36 and df['ticker'].nunique() == 36
    final = df[KEEP].rename(columns=RENAME)
    final.to_csv(OUT, index=False)
    print(final.to_string(index=False))


if __name__ == '__main__':
    main()
