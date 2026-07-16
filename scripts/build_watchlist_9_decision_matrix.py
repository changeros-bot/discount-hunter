#!/usr/bin/env python3
from pathlib import Path
import pandas as pd

ROOT = Path('reports/backtests/market_46')
BACKTEST = ROOT / 'watchlist_36_stage_classification.csv'
FUND = ROOT / 'watchlist_9_fundamental_summary.csv'

TARGETS = ['PWR','AAPL','MSFT','NOW','AXP','MU','STX','DELL','WDC']
CYCLICAL = {'MU','STX','DELL','WDC'}


def safe(row, key, default=0.0):
    v = row.get(key)
    return default if pd.isna(v) else float(v)


def decide(row):
    ticker = row['ticker']
    cagr = safe(row, 'cagr')
    beat_spy = safe(row, 'beat_spy_rate')
    events = safe(row, 'events')
    ret126 = safe(row, 'avg_ret_126d')
    win126 = safe(row, 'win_rate_ret_126d')
    adverse = safe(row, 'avg_max_adverse_252d', -1)
    current_dd = safe(row, 'current_drawdown')
    rev_cagr = safe(row, 'revenue_cagr', -1)
    fcf_cagr = safe(row, 'fcf_cagr', -1)
    fcf_margin = safe(row, 'latest_fcf_margin', -1)
    forward_pe = safe(row, 'forward_pe', 999)
    net_cash = safe(row, 'net_cash')

    quality = 0
    quality += 2 if rev_cagr >= 0.12 else 1 if rev_cagr >= 0.05 else 0
    quality += 2 if fcf_cagr >= 0.12 else 1 if fcf_cagr >= 0 else 0
    quality += 2 if fcf_margin >= 0.15 else 1 if fcf_margin >= 0.05 else 0
    quality += 1 if net_cash > 0 else 0

    backtest = 0
    backtest += 2 if cagr >= 0.25 else 1 if cagr >= 0.15 else 0
    backtest += 2 if beat_spy >= 0.7 else 1 if beat_spy >= 0.5 else 0
    backtest += 2 if events >= 10 else 1 if events >= 5 else 0
    backtest += 2 if win126 >= 0.7 else 1 if win126 >= 0.55 else 0
    backtest += 1 if ret126 >= 0.2 else 0

    valuation_risk = 'HIGH' if forward_pe >= 35 else 'MEDIUM' if forward_pe >= 22 else 'LOW'
    drawdown_risk = 'HIGH' if adverse <= -0.22 else 'MEDIUM' if adverse <= -0.14 else 'LOW'

    if ticker in CYCLICAL:
        if quality >= 4 and backtest >= 6:
            action = 'PAPER_TRADE_DEEP_DISCOUNT'
        else:
            action = 'CYCLE_WATCH_ONLY'
    else:
        if quality >= 5 and backtest >= 6 and valuation_risk != 'HIGH':
            action = 'PAPER_TRADE_QUALITY_DISCOUNT'
        elif quality >= 5 and backtest >= 5:
            action = 'WAIT_FOR_BETTER_PRICE'
        else:
            action = 'CONTINUE_REVIEW'

    # Current drawdown is descriptive only; it must not override quality and sample checks.
    return pd.Series({
        'quality_points': quality,
        'backtest_points': backtest,
        'valuation_risk': valuation_risk,
        'post_entry_drawdown_risk': drawdown_risk,
        'decision': action,
        'current_drawdown_snapshot': current_dd,
    })


def main():
    bt = pd.read_csv(BACKTEST)
    fu = pd.read_csv(FUND)
    df = bt[bt['ticker'].isin(TARGETS)].merge(fu, on='ticker', how='inner', suffixes=('', '_fund'))
    assert len(df) == 9 and df['ticker'].nunique() == 9
    decisions = df.apply(decide, axis=1)
    out = pd.concat([df, decisions], axis=1)
    order = {
        'PAPER_TRADE_QUALITY_DISCOUNT': 1,
        'PAPER_TRADE_DEEP_DISCOUNT': 2,
        'WAIT_FOR_BETTER_PRICE': 3,
        'CONTINUE_REVIEW': 4,
        'CYCLE_WATCH_ONLY': 5,
    }
    out['decision_order'] = out['decision'].map(order)
    out = out.sort_values(['decision_order','quality_points','backtest_points'], ascending=[True,False,False])
    out.to_csv(ROOT / 'watchlist_9_decision_matrix.csv', index=False)

    summary_cols = [
        'ticker','decision','quality_points','backtest_points','valuation_risk',
        'post_entry_drawdown_risk','cagr','current_drawdown','beat_spy_rate','events',
        'avg_ret_126d','win_rate_ret_126d','avg_max_adverse_252d','revenue_cagr',
        'fcf_cagr','latest_fcf_margin','net_cash','forward_pe'
    ]
    out[summary_cols].to_csv(ROOT / 'watchlist_9_decision_summary.csv', index=False)

    md = ['# Watchlist 9 Decision Matrix', '', 'This is a research and paper-trading gate, not a live-order instruction.', '']
    for decision, group in out.groupby('decision', sort=False):
        md.append(f'## {decision} ({len(group)})')
        md.append(', '.join(group['ticker'].tolist()))
        md.append('')
    (ROOT / 'watchlist_9_decision_matrix.md').write_text('\n'.join(md), encoding='utf-8')
    print(out[summary_cols].to_string(index=False))


if __name__ == '__main__':
    main()
