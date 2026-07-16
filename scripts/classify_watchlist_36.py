#!/usr/bin/env python3
from pathlib import Path
import pandas as pd

ROOT = Path('reports/backtests/market_46')
MASTER = ROOT / 'market_46_master_ranking.csv'
STATUS = ROOT / 'market_46_status.csv'

WATCHLIST_1 = ["NOW", "QCOM", "DELL", "MSFT", "NFLX", "ADBE", "SOFI", "REGN", "MA", "V", "PWR", "CEG", "COST", "GEV", "LLY", "SPOT", "TMUS", "ACN"]
WATCHLIST_2 = ["AAPL", "AMZN", "KO", "BAC", "AXP", "CVX", "XOM", "LIN", "NOC", "UNH", "MU", "SNDK", "WDC", "STX", "SKHY", "DRAM", "OXY", "PBR"]
WATCHLIST_36 = WATCHLIST_1 + WATCHLIST_2


def n(row, key, default=0.0):
    v = row.get(key)
    return default if pd.isna(v) else float(v)


def classify(row):
    ticker = row['ticker']
    status = row.get('status', '')
    years = n(row, 'history_years')
    cagr = n(row, 'cagr', -9)
    mdd = n(row, 'max_drawdown', -1)
    beat_spy = n(row, 'beat_spy_rate')
    beat_qqq = n(row, 'beat_qqq_rate')
    events = n(row, 'events')
    ret126 = n(row, 'avg_ret_126d')
    win126 = n(row, 'win_rate_ret_126d')
    current_dd = n(row, 'current_drawdown')

    if status != 'OK' or ticker in {'SKHY', 'DRAM'}:
        return 'F_DATA_PENDING', '資料或代號不足，保留但不參與正式排序'
    if years < 5:
        return 'E_SHORT_HISTORY', '上市歷史不足五年，只做上市以來觀察'
    if years < 9.8:
        return 'D_5Y_PLUS', '具五年以上資料，但不和完整十年組直接比較'

    sample_ok = events >= 5
    strong_discount = sample_ok and ret126 >= 0.15 and win126 >= 0.60
    long_term_strong = cagr >= 0.20 and beat_spy >= 0.60
    quality_stable = cagr >= 0.15 and mdd >= -0.45 and beat_spy >= 0.60
    cyclical_risk = cagr >= 0.25 and (mdd <= -0.55 or win126 < 0.60)

    if long_term_strong and strong_discount and not cyclical_risk:
        return 'A_PRIORITY_DEEP_REVIEW', '十年績效、年度勝率與折價樣本同時合格'
    if cyclical_risk:
        return 'B_CYCLICAL_OR_HIGH_DRAWDOWN', '長期報酬高，但週期性、回撤或折價勝率需要額外限制'
    if quality_stable and not sample_ok:
        return 'B_QUALITY_WAIT_FOR_PRICE', '長期品質較穩，但深跌樣本不足，不能證明折價策略'
    if strong_discount or (cagr >= 0.15 and beat_spy >= 0.50):
        return 'C_SECONDARY_REVIEW', '部分條件合格，保留第二輪基本面與估值審查'
    if current_dd <= -0.30:
        return 'C_SPECIAL_SITUATION_REVIEW', '目前跌幅較深，但長期統計不足以直接升級'
    return 'D_MONITOR', '保留觀察，現階段沒有足夠證據升級或淘汰'


def main():
    master = pd.read_csv(MASTER)
    status = pd.read_csv(STATUS)[['ticker', 'status', 'error']]
    df = master[master['ticker'].isin(WATCHLIST_36)].merge(status, on='ticker', how='left')
    assert len(df) == 36 and df['ticker'].nunique() == 36

    labels = df.apply(classify, axis=1, result_type='expand')
    df['stage'] = labels[0]
    df['stage_reason'] = labels[1]
    df['watchlist_order'] = df['ticker'].map({t: i for i, t in enumerate(WATCHLIST_36)})

    cols = [
        'ticker', 'group', 'stage', 'stage_reason', 'status', 'history_years', 'full_10y',
        'cagr', 'max_drawdown', 'current_drawdown', 'sharpe', 'sortino',
        'beat_spy_rate', 'beat_qqq_rate', 'avg_alpha_spy', 'avg_alpha_qqq',
        'events', 'avg_ret_126d', 'win_rate_ret_126d', 'avg_ret_252d',
        'win_rate_ret_252d', 'avg_max_adverse_252d', 'discount_verdict',
        'revenue_growth', 'earnings_growth', 'profit_margin', 'free_cash_flow',
        'forward_pe', 'trailing_pe', 'error'
    ]
    out = df[cols].sort_values(['stage', 'cagr'], ascending=[True, False])
    out.to_csv(ROOT / 'watchlist_36_stage_classification.csv', index=False)

    counts = out.groupby('stage').size().reset_index(name='count')
    counts.to_csv(ROOT / 'watchlist_36_stage_counts.csv', index=False)

    md = ['# Watchlist 36 Stage Classification', '', 'No name is automatically removed at this stage.', '']
    for stage, group in out.groupby('stage', sort=True):
        md.append(f'## {stage} ({len(group)})')
        md.append(', '.join(group['ticker'].tolist()))
        md.append('')
    (ROOT / 'watchlist_36_stage_classification.md').write_text('\n'.join(md), encoding='utf-8')

    print(counts.to_string(index=False))


if __name__ == '__main__':
    main()
