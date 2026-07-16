#!/usr/bin/env python3
from pathlib import Path
import pandas as pd

ROOT = Path('reports/backtests/market_46')
STAGES = ROOT / 'watchlist_36_stage_classification.csv'

WATCHLIST_36 = [
    'NOW','QCOM','DELL','MSFT','NFLX','ADBE','SOFI','REGN','MA','V','PWR','CEG','COST','GEV','LLY','SPOT','TMUS','ACN',
    'AAPL','AMZN','KO','BAC','AXP','CVX','XOM','LIN','NOC','UNH','MU','SNDK','WDC','STX','SKHY','DRAM','OXY','PBR'
]

TAXONOMY = {
    'NOW': ('Software / Cloud', 'QUALITY_GROWTH', 'QUALITY_DISCOUNT'),
    'QCOM': ('Semiconductor / Connectivity', 'CYCLICAL_GROWTH', 'DEEP_DISCOUNT'),
    'DELL': ('AI Hardware / Servers', 'CYCLICAL_AI_INFRA', 'DEEP_DISCOUNT'),
    'MSFT': ('Mega-cap Platform / Cloud', 'QUALITY_COMPOUNDER', 'QUALITY_DISCOUNT'),
    'NFLX': ('Consumer Platform / Media', 'GROWTH_PLATFORM', 'DEEP_DISCOUNT'),
    'ADBE': ('Software / Creative', 'QUALITY_GROWTH', 'QUALITY_DISCOUNT'),
    'SOFI': ('Fintech', 'EARLY_STAGE_GROWTH', 'VENTURE_MONITOR'),
    'REGN': ('Biotech / Pharma', 'DEFENSIVE_GROWTH', 'QUALITY_DISCOUNT'),
    'MA': ('Payments', 'QUALITY_COMPOUNDER', 'QUALITY_DISCOUNT'),
    'V': ('Payments', 'QUALITY_COMPOUNDER', 'QUALITY_DISCOUNT'),
    'PWR': ('Power Grid / AI Infrastructure', 'QUALITY_GROWTH', 'QUALITY_DISCOUNT'),
    'CEG': ('Nuclear / Power', 'STRUCTURAL_GROWTH', 'GROWTH_DISCOUNT'),
    'COST': ('Consumer Defensive / Retail', 'QUALITY_COMPOUNDER', 'QUALITY_DISCOUNT'),
    'GEV': ('Power Equipment / Grid', 'STRUCTURAL_GROWTH', 'GROWTH_DISCOUNT'),
    'LLY': ('Pharma', 'QUALITY_GROWTH', 'QUALITY_DISCOUNT'),
    'SPOT': ('Consumer Platform / Audio', 'GROWTH_PLATFORM', 'GROWTH_DISCOUNT'),
    'TMUS': ('Telecom', 'DEFENSIVE_COMPOUNDER', 'QUALITY_DISCOUNT'),
    'ACN': ('IT Services / Consulting', 'QUALITY_COMPOUNDER', 'QUALITY_DISCOUNT'),
    'AAPL': ('Mega-cap Consumer Tech', 'QUALITY_COMPOUNDER', 'QUALITY_DISCOUNT'),
    'AMZN': ('Mega-cap Platform / Cloud', 'QUALITY_GROWTH', 'QUALITY_DISCOUNT'),
    'KO': ('Consumer Staples', 'DEFENSIVE_INCOME', 'INCOME_DISCOUNT'),
    'BAC': ('Banking', 'FINANCIAL_CYCLICAL', 'DEEP_DISCOUNT'),
    'AXP': ('Payments / Credit', 'QUALITY_FINANCIAL', 'QUALITY_DISCOUNT'),
    'CVX': ('Energy', 'COMMODITY_CYCLICAL', 'CYCLE_DISCOUNT'),
    'XOM': ('Energy', 'COMMODITY_CYCLICAL', 'CYCLE_DISCOUNT'),
    'LIN': ('Industrial Gases', 'QUALITY_COMPOUNDER', 'QUALITY_DISCOUNT'),
    'NOC': ('Defense', 'DEFENSIVE_INDUSTRIAL', 'QUALITY_DISCOUNT'),
    'UNH': ('Managed Care', 'DEFENSIVE_GROWTH', 'QUALITY_DISCOUNT'),
    'MU': ('AI Memory', 'CYCLICAL_AI_INFRA', 'DEEP_DISCOUNT'),
    'SNDK': ('Storage / Flash', 'CYCLICAL_AI_INFRA', 'DEEP_DISCOUNT'),
    'WDC': ('Storage / HDD', 'CYCLICAL_AI_INFRA', 'DEEP_DISCOUNT'),
    'STX': ('Storage / HDD', 'CYCLICAL_AI_INFRA', 'DEEP_DISCOUNT'),
    'SKHY': ('Memory / Korea ETF', 'DATA_PENDING', 'DATA_PENDING'),
    'DRAM': ('Memory ETF', 'DATA_PENDING', 'DATA_PENDING'),
    'OXY': ('Energy', 'COMMODITY_CYCLICAL', 'CYCLE_DISCOUNT'),
    'PBR': ('Energy / Emerging Market', 'COMMODITY_CYCLICAL', 'CYCLE_DISCOUNT'),
}

ROLE = {
    'QUALITY_COMPOUNDER': '長期品質複利候選',
    'QUALITY_GROWTH': '高品質成長候選',
    'QUALITY_FINANCIAL': '品質金融候選',
    'DEFENSIVE_COMPOUNDER': '防禦型複利候選',
    'DEFENSIVE_GROWTH': '防禦成長候選',
    'DEFENSIVE_INCOME': '防禦收益候選',
    'DEFENSIVE_INDUSTRIAL': '防禦工業候選',
    'GROWTH_PLATFORM': '平台成長候選',
    'STRUCTURAL_GROWTH': '結構性成長候選',
    'CYCLICAL_GROWTH': '景氣循環成長候選',
    'CYCLICAL_AI_INFRA': 'AI硬體週期候選',
    'FINANCIAL_CYCLICAL': '金融週期候選',
    'COMMODITY_CYCLICAL': '商品週期候選',
    'EARLY_STAGE_GROWTH': '早期成長觀察',
    'DATA_PENDING': '資料待處理',
}


def main():
    stages = pd.read_csv(STAGES)
    rows = []
    for ticker in WATCHLIST_36:
        sector_group, business_type, strategy_bucket = TAXONOMY[ticker]
        rows.append({
            'ticker': ticker,
            'sector_group': sector_group,
            'business_type': business_type,
            'portfolio_role': ROLE[business_type],
            'strategy_bucket': strategy_bucket,
        })
    tax = pd.DataFrame(rows)
    out = stages.merge(tax, on='ticker', how='left')
    assert len(out) == 36 and out['ticker'].nunique() == 36
    assert out[['sector_group','business_type','portfolio_role','strategy_bucket']].notna().all().all()

    out.to_csv(ROOT / 'watchlist_36_full_taxonomy.csv', index=False)

    by_sector = out.groupby('sector_group')['ticker'].apply(lambda s: ', '.join(s.tolist())).reset_index(name='tickers')
    by_sector['count'] = by_sector['tickers'].str.count(',') + 1
    by_sector.to_csv(ROOT / 'watchlist_36_by_sector.csv', index=False)

    by_strategy = out.groupby('strategy_bucket')['ticker'].apply(lambda s: ', '.join(s.tolist())).reset_index(name='tickers')
    by_strategy['count'] = by_strategy['tickers'].str.count(',') + 1
    by_strategy.to_csv(ROOT / 'watchlist_36_by_strategy.csv', index=False)

    by_role = out.groupby('portfolio_role')['ticker'].apply(lambda s: ', '.join(s.tolist())).reset_index(name='tickers')
    by_role['count'] = by_role['tickers'].str.count(',') + 1
    by_role.to_csv(ROOT / 'watchlist_36_by_portfolio_role.csv', index=False)

    md = ['# Watchlist 36 Full Classification', '', 'All 36 names remain in the research universe.', '']
    for strategy, group in out.groupby('strategy_bucket', sort=True):
        md.append(f'## {strategy} ({len(group)})')
        for _, r in group.sort_values(['stage','ticker']).iterrows():
            md.append(f"- {r['ticker']} | {r['sector_group']} | {r['portfolio_role']} | {r['stage']}")
        md.append('')
    (ROOT / 'watchlist_36_full_taxonomy.md').write_text('\n'.join(md), encoding='utf-8')

    print(by_strategy[['strategy_bucket','count']].to_string(index=False))


if __name__ == '__main__':
    main()
