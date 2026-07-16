#!/usr/bin/env python3
from pathlib import Path
import pandas as pd

ROOT = Path('reports/backtests/market_46')
STAGES = ROOT / 'watchlist_36_stage_classification.csv'
TAXONOMY = ROOT / 'watchlist_36_full_taxonomy.csv'
FUNDS = ROOT / 'watchlist_36_fundamental_summary.csv'


def n(row, key, default=0.0):
    v = row.get(key)
    return default if pd.isna(v) else float(v)


def score_quality(row):
    score = 0
    rev = n(row, 'revenue_cagr', -1)
    fcf = n(row, 'fcf_cagr', -1)
    fcf_margin = n(row, 'latest_fcf_margin', -1)
    rev_stability = n(row, 'revenue_positive_year_rate')
    fcf_stability = n(row, 'fcf_positive_year_rate')
    net_cash = n(row, 'net_cash')
    score += 2 if rev >= 0.12 else 1 if rev >= 0.04 else 0
    score += 2 if fcf >= 0.12 else 1 if fcf >= 0 else 0
    score += 2 if fcf_margin >= 0.15 else 1 if fcf_margin >= 0.05 else 0
    score += 1 if rev_stability >= 0.75 else 0
    score += 1 if fcf_stability >= 0.75 else 0
    score += 1 if net_cash > 0 else 0
    return score


def score_backtest(row):
    score = 0
    years = n(row, 'history_years')
    cagr = n(row, 'cagr', -1)
    beat = n(row, 'beat_spy_rate')
    events = n(row, 'events')
    ret126 = n(row, 'avg_ret_126d')
    win126 = n(row, 'win_rate_ret_126d')
    adverse = n(row, 'avg_max_adverse_252d', -1)
    score += 2 if years >= 9.8 else 1 if years >= 5 else 0
    score += 2 if cagr >= 0.20 else 1 if cagr >= 0.10 else 0
    score += 2 if beat >= 0.70 else 1 if beat >= 0.50 else 0
    score += 2 if events >= 10 else 1 if events >= 5 else 0
    score += 2 if win126 >= 0.70 else 1 if win126 >= 0.55 else 0
    score += 1 if ret126 >= 0.20 else 0
    score += 1 if adverse > -0.18 else 0
    return score


def valuation_band(row):
    pe = n(row, 'forward_pe', 999)
    if pe < 18:
        return 'LOW'
    if pe < 28:
        return 'MEDIUM'
    if pe < 40:
        return 'HIGH'
    return 'VERY_HIGH'


def decide(row):
    strategy = row['strategy_bucket']
    status = row.get('fundamental_status', '')
    q = score_quality(row)
    b = score_backtest(row)
    val = valuation_band(row)
    events = n(row, 'events')
    years = n(row, 'history_years')
    adverse = n(row, 'avg_max_adverse_252d', -1)

    if status in {'DATA_PENDING', 'ERROR'} or strategy == 'DATA_PENDING':
        return 'DATA_REPAIR', q, b, val, '資料不足，不參與升級或淘汰'
    if years < 5:
        return 'SHORT_HISTORY_MONITOR', q, b, val, '僅用上市以來資料，暫不進正式紙上交易'
    if strategy == 'QUALITY_DISCOUNT':
        if q >= 6 and b >= 7 and val in {'LOW','MEDIUM'}:
            return 'PAPER_QUALITY_DISCOUNT', q, b, val, '品質與回測均合格，估值風險可接受'
        if q >= 6 and b >= 6:
            return 'WAIT_QUALITY_PRICE', q, b, val, '品質合格，但估值或折價不足'
        if q >= 4 and b >= 5:
            return 'SECONDARY_QUALITY_REVIEW', q, b, val, '部分通過，需再看估值與最新財報'
        return 'QUALITY_MONITOR', q, b, val, '品質或回測證據不足'
    if strategy == 'DEEP_DISCOUNT':
        if q >= 4 and b >= 7 and events >= 5 and adverse > -0.30:
            return 'PAPER_DEEP_DISCOUNT', q, b, val, '週期／高波動標的，僅限深折價紙上策略'
        if b >= 6:
            return 'CYCLE_WATCH', q, b, val, '回測可用，但基本面週期性較高'
        return 'DEEP_DISCOUNT_MONITOR', q, b, val, '尚不足以進紙上交易'
    if strategy == 'GROWTH_DISCOUNT':
        if q >= 5 and b >= 5 and years >= 5:
            return 'PAPER_GROWTH_DISCOUNT', q, b, val, '成長與回測達門檻，限紙上觀察'
        return 'GROWTH_MONITOR', q, b, val, '歷史或估值週期仍不足'
    if strategy == 'CYCLE_DISCOUNT':
        if q >= 3 and b >= 5 and events >= 5:
            return 'PAPER_CYCLE_DISCOUNT', q, b, val, '只適用商品週期紙上策略'
        return 'COMMODITY_CYCLE_MONITOR', q, b, val, '等待商品週期與現金流條件'
    if strategy == 'INCOME_DISCOUNT':
        if q >= 4 and b >= 5:
            return 'PAPER_INCOME_DISCOUNT', q, b, val, '收益型策略，需搭配股息安全檢查'
        return 'INCOME_MONITOR', q, b, val, '保留收益觀察'
    if strategy == 'VENTURE_MONITOR':
        return 'VENTURE_MONITOR', q, b, val, '早期成長，不納入一般折價規則'
    return 'MONITOR', q, b, val, '未匹配策略規則'


def main():
    stages = pd.read_csv(STAGES)
    taxonomy = pd.read_csv(TAXONOMY)[['ticker','sector_group','business_type','portfolio_role','strategy_bucket']]
    funds = pd.read_csv(FUNDS)

    # Keep price/backtest fields from stages and fundamental/valuation fields from funds.
    overlap = set(stages.columns).intersection(funds.columns) - {'ticker'}
    stages = stages.drop(columns=[c for c in overlap if c in stages.columns])
    funds = funds.drop(columns=[c for c in ['sector_group','business_type','portfolio_role','strategy_bucket','stage'] if c in funds.columns])

    df = stages.merge(taxonomy, on='ticker', how='left').merge(funds, on='ticker', how='left')
    assert len(df) == 36 and df['ticker'].nunique() == 36

    results = df.apply(decide, axis=1, result_type='expand')
    results.columns = ['decision','quality_points','backtest_points','valuation_band','decision_reason']
    out = pd.concat([df, results], axis=1)

    priority = {
        'PAPER_QUALITY_DISCOUNT': 1,'PAPER_DEEP_DISCOUNT': 2,'PAPER_GROWTH_DISCOUNT': 3,
        'PAPER_CYCLE_DISCOUNT': 4,'PAPER_INCOME_DISCOUNT': 5,'WAIT_QUALITY_PRICE': 6,
        'SECONDARY_QUALITY_REVIEW': 7,'CYCLE_WATCH': 8,'GROWTH_MONITOR': 9,
        'COMMODITY_CYCLE_MONITOR': 10,'INCOME_MONITOR': 11,'QUALITY_MONITOR': 12,
        'DEEP_DISCOUNT_MONITOR': 13,'VENTURE_MONITOR': 14,'SHORT_HISTORY_MONITOR': 15,
        'DATA_REPAIR': 16,'MONITOR': 17,
    }
    out['decision_order'] = out['decision'].map(priority).fillna(99)
    out = out.sort_values(['decision_order','strategy_bucket','quality_points','backtest_points'], ascending=[True,True,False,False])

    summary_cols = [
        'ticker','sector_group','portfolio_role','strategy_bucket','stage','decision','decision_reason',
        'quality_points','backtest_points','valuation_band','fundamental_status','history_years','cagr',
        'current_drawdown','beat_spy_rate','events','avg_ret_126d','win_rate_ret_126d',
        'avg_max_adverse_252d','revenue_cagr','fcf_cagr','latest_fcf_margin','net_cash','forward_pe'
    ]
    missing = [c for c in summary_cols if c not in out.columns]
    assert not missing, f'Missing columns: {missing}'
    out[summary_cols].to_csv(ROOT / 'watchlist_36_group_decision_summary.csv', index=False)
    print(out[['ticker','strategy_bucket','decision','quality_points','backtest_points','valuation_band']].to_string(index=False))


if __name__ == '__main__':
    main()
