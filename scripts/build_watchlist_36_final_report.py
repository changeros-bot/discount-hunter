#!/usr/bin/env python3
from pathlib import Path
import pandas as pd

ROOT = Path('reports/backtests/market_46')
DECISIONS = ROOT / 'watchlist_36_group_decision_summary.csv'

DECISION_LABELS = {
    'PAPER_QUALITY_DISCOUNT': '品質折價紙上交易',
    'PAPER_DEEP_DISCOUNT': '深度折價紙上交易',
    'PAPER_GROWTH_DISCOUNT': '成長折價紙上交易',
    'PAPER_CYCLE_DISCOUNT': '商品週期紙上交易',
    'PAPER_INCOME_DISCOUNT': '收益折價紙上交易',
    'WAIT_QUALITY_PRICE': '品質合格，等待更好價格',
    'SECONDARY_QUALITY_REVIEW': '品質次級審查',
    'CYCLE_WATCH': '週期觀察',
    'GROWTH_MONITOR': '成長觀察',
    'COMMODITY_CYCLE_MONITOR': '商品週期觀察',
    'INCOME_MONITOR': '收益觀察',
    'QUALITY_MONITOR': '品質觀察',
    'DEEP_DISCOUNT_MONITOR': '深度折價觀察',
    'VENTURE_MONITOR': '早期成長觀察',
    'SHORT_HISTORY_MONITOR': '短歷史觀察',
    'DATA_REPAIR': '資料修復',
    'MONITOR': '一般觀察',
}


def main():
    df = pd.read_csv(DECISIONS)
    assert len(df) == 36 and df['ticker'].nunique() == 36
    df['decision_zh'] = df['decision'].map(DECISION_LABELS).fillna(df['decision'])

    paper_mask = df['decision'].str.startswith('PAPER_', na=False)
    wait_mask = df['decision'].eq('WAIT_QUALITY_PRICE')
    review_mask = df['decision'].isin(['SECONDARY_QUALITY_REVIEW','CYCLE_WATCH'])
    monitor_mask = ~(paper_mask | wait_mask | review_mask)

    tiers = []
    for mask, tier, meaning in [
        (paper_mask, 'TIER_1_PAPER_CANDIDATE', '已通過組內規則，可進紙上交易候選池'),
        (wait_mask, 'TIER_2_WAIT_FOR_PRICE', '品質通過，但價格或估值尚未通過'),
        (review_mask, 'TIER_3_CONTINUE_REVIEW', '部分通過，需繼續審查週期或基本面'),
        (monitor_mask, 'TIER_4_MONITOR_OR_REPAIR', '保留觀察、短歷史或資料修復'),
    ]:
        part = df[mask].copy()
        part['final_tier'] = tier
        part['tier_meaning'] = meaning
        tiers.append(part)
    final = pd.concat(tiers, ignore_index=True)

    tier_order = {
        'TIER_1_PAPER_CANDIDATE': 1,
        'TIER_2_WAIT_FOR_PRICE': 2,
        'TIER_3_CONTINUE_REVIEW': 3,
        'TIER_4_MONITOR_OR_REPAIR': 4,
    }
    final['tier_order'] = final['final_tier'].map(tier_order)
    final = final.sort_values(['tier_order','strategy_bucket','quality_points','backtest_points'], ascending=[True,True,False,False])

    final.to_csv(ROOT / 'watchlist_36_final_classification.csv', index=False)

    counts = final.groupby(['final_tier','decision_zh']).size().reset_index(name='count')
    counts.to_csv(ROOT / 'watchlist_36_final_counts.csv', index=False)

    md = [
        '# Watchlist 36 Final Classification',
        '',
        'Research and paper-trading classification only. No live orders and no automatic promotion to the formal 10-name roster.',
        '',
    ]
    for tier, group in final.groupby('final_tier', sort=False):
        md.append(f'## {tier} ({len(group)})')
        for _, r in group.iterrows():
            md.append(
                f"- {r['ticker']} | {r['decision_zh']} | {r['strategy_bucket']} | "
                f"Q{int(r['quality_points'])}/B{int(r['backtest_points'])} | {r['valuation_band']}"
            )
        md.append('')
    (ROOT / 'watchlist_36_final_classification.md').write_text('\n'.join(md), encoding='utf-8')

    print(counts.to_string(index=False))


if __name__ == '__main__':
    main()
