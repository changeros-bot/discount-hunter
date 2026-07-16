#!/usr/bin/env python3
from pathlib import Path
import pandas as pd

ROOT = Path('reports/backtests/market_46')
TARGETS = ['PWR','AAPL','MSFT','NOW','AXP','MU','STX','DELL','WDC']


def main():
    full_summary = pd.read_csv(ROOT / 'watchlist_36_fundamental_summary.csv')
    full_history = pd.read_csv(ROOT / 'watchlist_36_five_year_fundamentals.csv')

    summary = full_summary[full_summary['ticker'].isin(TARGETS)].copy()
    history = full_history[full_history['ticker'].isin(TARGETS)].copy()
    assert len(summary) == 9 and summary['ticker'].nunique() == 9

    summary = summary.sort_values('fundamental_score', ascending=False)
    history.to_csv(ROOT / 'watchlist_9_five_year_fundamentals.csv', index=False)
    summary.to_csv(ROOT / 'watchlist_9_fundamental_summary.csv', index=False)

    errors = summary[summary['fundamental_status'].isin(['ERROR','DATA_PENDING'])][['ticker','fundamental_status']]
    errors.to_csv(ROOT / 'watchlist_9_fundamental_errors.csv', index=False)

    md = ['# Watchlist 9 Fundamental Deep Review', '', 'Derived from the completed 36-name fundamental dataset.', '']
    for i, row in summary.reset_index(drop=True).iterrows():
        score = row.get('fundamental_score')
        score_text = 'NA' if pd.isna(score) else f'{score:.2f}'
        md.append(f"{i+1}. {row['ticker']} — score {score_text} — {row['fundamental_status']}")
    (ROOT / 'watchlist_9_fundamental_summary.md').write_text('\n'.join(md), encoding='utf-8')

    print(summary[['ticker','fundamental_score','revenue_cagr','fcf_cagr','latest_fcf_margin','forward_pe']].to_string(index=False))


if __name__ == '__main__':
    main()
