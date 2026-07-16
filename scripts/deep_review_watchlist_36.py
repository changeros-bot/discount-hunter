#!/usr/bin/env python3
from pathlib import Path
import math
import pandas as pd
import yfinance as yf

ROOT = Path('reports/backtests/market_46')
TAXONOMY = ROOT / 'watchlist_36_full_taxonomy.csv'
WATCHLIST_36 = [
    'NOW','QCOM','DELL','MSFT','NFLX','ADBE','SOFI','REGN','MA','V','PWR','CEG','COST','GEV','LLY','SPOT','TMUS','ACN',
    'AAPL','AMZN','KO','BAC','AXP','CVX','XOM','LIN','NOC','UNH','MU','SNDK','WDC','STX','SKHY','DRAM','OXY','PBR'
]
DATA_PENDING = {'SKHY','DRAM'}

LINE_ALIASES = {
    'revenue': ['Total Revenue', 'Operating Revenue'],
    'operating_income': ['Operating Income'],
    'net_income': ['Net Income', 'Net Income Common Stockholders'],
    'operating_cash_flow': ['Operating Cash Flow', 'Total Cash From Operating Activities'],
    'capital_expenditure': ['Capital Expenditure', 'Capital Expenditures'],
    'free_cash_flow': ['Free Cash Flow'],
    'total_debt': ['Total Debt'],
    'cash': ['Cash Cash Equivalents And Short Term Investments', 'Cash And Cash Equivalents'],
}


def first_row(frame, names):
    if frame is None or frame.empty:
        return pd.Series(dtype=float)
    for name in names:
        if name in frame.index:
            return pd.to_numeric(frame.loc[name], errors='coerce')
    return pd.Series(dtype=float)


def cagr(values):
    s = pd.Series(values).dropna()
    if len(s) < 2 or s.iloc[0] <= 0 or s.iloc[-1] <= 0:
        return math.nan
    return (s.iloc[-1] / s.iloc[0]) ** (1 / (len(s) - 1)) - 1


def positive_rate(values):
    s = pd.Series(values).dropna()
    if len(s) < 3:
        return math.nan
    d = s.diff().dropna()
    return (d > 0).mean()


def latest(s):
    s = pd.Series(s).dropna()
    return s.iloc[-1] if len(s) else math.nan


def collect(ticker):
    if ticker in DATA_PENDING:
        return pd.DataFrame(), {'ticker': ticker, 'fundamental_status': 'DATA_PENDING'}

    t = yf.Ticker(ticker)
    inc, cf, bs = t.financials, t.cashflow, t.balance_sheet
    info = t.info or {}
    cols = sorted(set(inc.columns).union(cf.columns).union(bs.columns))

    src_map = {}
    for key, aliases in LINE_ALIASES.items():
        src = inc if key in {'revenue','operating_income','net_income'} else cf if key in {'operating_cash_flow','capital_expenditure','free_cash_flow'} else bs
        src_map[key] = first_row(src, aliases)

    records = []
    for col in cols:
        rec = {'ticker': ticker, 'fiscal_year': pd.Timestamp(col).year}
        for key, s in src_map.items():
            rec[key] = s.get(col, math.nan)
        if pd.isna(rec['free_cash_flow']) and pd.notna(rec['operating_cash_flow']) and pd.notna(rec['capital_expenditure']):
            rec['free_cash_flow'] = rec['operating_cash_flow'] + rec['capital_expenditure']
        rec['operating_margin_calc'] = rec['operating_income'] / rec['revenue'] if pd.notna(rec['operating_income']) and rec['revenue'] else math.nan
        rec['net_margin_calc'] = rec['net_income'] / rec['revenue'] if pd.notna(rec['net_income']) and rec['revenue'] else math.nan
        rec['fcf_margin_calc'] = rec['free_cash_flow'] / rec['revenue'] if pd.notna(rec['free_cash_flow']) and rec['revenue'] else math.nan
        records.append(rec)

    hist = pd.DataFrame(records).sort_values('fiscal_year').tail(5)
    summary = {
        'ticker': ticker,
        'fundamental_status': 'OK' if len(hist) >= 3 else 'LIMITED',
        'years_available': len(hist),
        'revenue_cagr': cagr(hist.get('revenue')),
        'operating_income_cagr': cagr(hist.get('operating_income')),
        'net_income_cagr': cagr(hist.get('net_income')),
        'fcf_cagr': cagr(hist.get('free_cash_flow')),
        'revenue_positive_year_rate': positive_rate(hist.get('revenue')),
        'fcf_positive_year_rate': positive_rate(hist.get('free_cash_flow')),
        'latest_operating_margin': latest(hist.get('operating_margin_calc')),
        'latest_net_margin': latest(hist.get('net_margin_calc')),
        'latest_fcf_margin': latest(hist.get('fcf_margin_calc')),
        'latest_total_debt': latest(hist.get('total_debt')),
        'latest_cash': latest(hist.get('cash')),
        'trailing_pe': info.get('trailingPE'),
        'forward_pe': info.get('forwardPE'),
        'price_to_book': info.get('priceToBook'),
        'enterprise_to_ebitda': info.get('enterpriseToEbitda'),
        'revenue_growth_snapshot': info.get('revenueGrowth'),
        'earnings_growth_snapshot': info.get('earningsGrowth'),
    }
    if pd.notna(summary['latest_cash']) and pd.notna(summary['latest_total_debt']):
        summary['net_cash'] = summary['latest_cash'] - summary['latest_total_debt']
    else:
        summary['net_cash'] = math.nan

    score = 0.0
    score += max(min(summary['revenue_cagr'] if pd.notna(summary['revenue_cagr']) else -0.2, 0.5), -0.2) * 30
    score += max(min(summary['fcf_cagr'] if pd.notna(summary['fcf_cagr']) else -0.2, 0.5), -0.2) * 25
    score += (summary['revenue_positive_year_rate'] if pd.notna(summary['revenue_positive_year_rate']) else 0) * 15
    score += (summary['fcf_positive_year_rate'] if pd.notna(summary['fcf_positive_year_rate']) else 0) * 15
    score += max(min(summary['latest_fcf_margin'] if pd.notna(summary['latest_fcf_margin']) else 0, 0.4), -0.2) * 25
    if pd.notna(summary['net_cash']) and summary['net_cash'] > 0:
        score += 5
    summary['fundamental_score'] = score
    return hist, summary


def main():
    taxonomy = pd.read_csv(TAXONOMY)[['ticker','sector_group','business_type','portfolio_role','strategy_bucket','stage']]
    histories, summaries, errors = [], [], []
    for ticker in WATCHLIST_36:
        try:
            hist, summary = collect(ticker)
            if not hist.empty:
                histories.append(hist)
            summaries.append(summary)
        except Exception as exc:
            summaries.append({'ticker': ticker, 'fundamental_status': 'ERROR'})
            errors.append({'ticker': ticker, 'error': str(exc)})

    hist_df = pd.concat(histories, ignore_index=True) if histories else pd.DataFrame()
    sum_df = pd.DataFrame(summaries).merge(taxonomy, on='ticker', how='left')
    assert len(sum_df) == 36 and sum_df['ticker'].nunique() == 36

    sum_df = sum_df.sort_values(['fundamental_status','strategy_bucket','fundamental_score'], ascending=[True,True,False])
    hist_df.to_csv(ROOT / 'watchlist_36_five_year_fundamentals.csv', index=False)
    sum_df.to_csv(ROOT / 'watchlist_36_fundamental_summary.csv', index=False)
    pd.DataFrame(errors).to_csv(ROOT / 'watchlist_36_fundamental_errors.csv', index=False)

    md = ['# Watchlist 36 Fundamental Deep Review', '', 'All 36 names are retained; data-pending names are not scored.', '']
    for strategy, group in sum_df.groupby('strategy_bucket', sort=True):
        md.append(f'## {strategy} ({len(group)})')
        for _, r in group.sort_values('fundamental_score', ascending=False).iterrows():
            score = r.get('fundamental_score')
            score_text = 'NA' if pd.isna(score) else f'{score:.2f}'
            md.append(f"- {r['ticker']} | score {score_text} | {r['fundamental_status']} | {r['stage']}")
        md.append('')
    (ROOT / 'watchlist_36_fundamental_summary.md').write_text('\n'.join(md), encoding='utf-8')
    print(sum_df[['ticker','strategy_bucket','fundamental_status','fundamental_score']].to_string(index=False))


if __name__ == '__main__':
    main()
