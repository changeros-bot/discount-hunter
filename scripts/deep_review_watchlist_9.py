#!/usr/bin/env python3
from pathlib import Path
import math
import pandas as pd
import yfinance as yf

ROOT = Path('reports/backtests/market_46')
TARGETS = ['PWR','AAPL','MSFT','NOW','AXP','MU','STX','DELL','WDC']

LINE_ALIASES = {
    'revenue': ['Total Revenue', 'Operating Revenue'],
    'operating_income': ['Operating Income'],
    'net_income': ['Net Income', 'Net Income Common Stockholders'],
    'operating_cash_flow': ['Operating Cash Flow', 'Total Cash From Operating Activities'],
    'capital_expenditure': ['Capital Expenditure', 'Capital Expenditures'],
    'free_cash_flow': ['Free Cash Flow'],
    'total_debt': ['Total Debt'],
    'cash': ['Cash Cash Equivalents And Short Term Investments', 'Cash And Cash Equivalents'],
    'stockholders_equity': ['Stockholders Equity', 'Total Stockholder Equity'],
}


def first_row(frame: pd.DataFrame, names):
    if frame is None or frame.empty:
        return pd.Series(dtype=float)
    for name in names:
        if name in frame.index:
            s = frame.loc[name]
            return pd.to_numeric(s, errors='coerce')
    return pd.Series(dtype=float)


def cagr(values):
    s = pd.Series(values).dropna()
    if len(s) < 2 or s.iloc[-1] <= 0 or s.iloc[0] <= 0:
        return math.nan
    years = len(s) - 1
    return (s.iloc[-1] / s.iloc[0]) ** (1 / years) - 1


def slope_quality(values):
    s = pd.Series(values).dropna()
    if len(s) < 3:
        return math.nan
    diffs = s.diff().dropna()
    return (diffs > 0).mean()


def collect(ticker):
    t = yf.Ticker(ticker)
    inc = t.financials
    cf = t.cashflow
    bs = t.balance_sheet
    info = t.info or {}

    cols = sorted(set(inc.columns).union(cf.columns).union(bs.columns))
    rows = []
    series_map = {}
    for key, aliases in LINE_ALIASES.items():
        src = inc if key in {'revenue','operating_income','net_income'} else cf if key in {'operating_cash_flow','capital_expenditure','free_cash_flow'} else bs
        s = first_row(src, aliases)
        series_map[key] = s

    for col in cols:
        year = pd.Timestamp(col).year
        rec = {'ticker': ticker, 'fiscal_year': year}
        for key, s in series_map.items():
            rec[key] = s.get(col, math.nan)
        if pd.isna(rec['free_cash_flow']) and pd.notna(rec['operating_cash_flow']) and pd.notna(rec['capital_expenditure']):
            rec['free_cash_flow'] = rec['operating_cash_flow'] + rec['capital_expenditure']
        rec['operating_margin_calc'] = rec['operating_income'] / rec['revenue'] if rec['revenue'] and pd.notna(rec['operating_income']) else math.nan
        rec['net_margin_calc'] = rec['net_income'] / rec['revenue'] if rec['revenue'] and pd.notna(rec['net_income']) else math.nan
        rec['fcf_margin_calc'] = rec['free_cash_flow'] / rec['revenue'] if rec['revenue'] and pd.notna(rec['free_cash_flow']) else math.nan
        rows.append(rec)

    hist = pd.DataFrame(rows).sort_values('fiscal_year').tail(5)
    summary = {
        'ticker': ticker,
        'years_available': len(hist),
        'revenue_cagr': cagr(hist['revenue']),
        'operating_income_cagr': cagr(hist['operating_income']),
        'net_income_cagr': cagr(hist['net_income']),
        'fcf_cagr': cagr(hist['free_cash_flow']),
        'revenue_positive_year_rate': slope_quality(hist['revenue']),
        'fcf_positive_year_rate': slope_quality(hist['free_cash_flow']),
        'latest_operating_margin': hist['operating_margin_calc'].dropna().iloc[-1] if hist['operating_margin_calc'].notna().any() else math.nan,
        'latest_net_margin': hist['net_margin_calc'].dropna().iloc[-1] if hist['net_margin_calc'].notna().any() else math.nan,
        'latest_fcf_margin': hist['fcf_margin_calc'].dropna().iloc[-1] if hist['fcf_margin_calc'].notna().any() else math.nan,
        'latest_total_debt': hist['total_debt'].dropna().iloc[-1] if hist['total_debt'].notna().any() else math.nan,
        'latest_cash': hist['cash'].dropna().iloc[-1] if hist['cash'].notna().any() else math.nan,
        'net_cash': (hist['cash'].dropna().iloc[-1] - hist['total_debt'].dropna().iloc[-1]) if hist['cash'].notna().any() and hist['total_debt'].notna().any() else math.nan,
        'trailing_pe': info.get('trailingPE'),
        'forward_pe': info.get('forwardPE'),
        'price_to_book': info.get('priceToBook'),
        'enterprise_to_ebitda': info.get('enterpriseToEbitda'),
        'revenue_growth_snapshot': info.get('revenueGrowth'),
        'earnings_growth_snapshot': info.get('earningsGrowth'),
    }

    score = 0.0
    score += max(min((summary['revenue_cagr'] if pd.notna(summary['revenue_cagr']) else -0.2), 0.5), -0.2) * 30
    score += max(min((summary['fcf_cagr'] if pd.notna(summary['fcf_cagr']) else -0.2), 0.5), -0.2) * 25
    score += (summary['revenue_positive_year_rate'] if pd.notna(summary['revenue_positive_year_rate']) else 0) * 15
    score += (summary['fcf_positive_year_rate'] if pd.notna(summary['fcf_positive_year_rate']) else 0) * 15
    score += max(min((summary['latest_fcf_margin'] if pd.notna(summary['latest_fcf_margin']) else 0), 0.4), -0.2) * 25
    if pd.notna(summary['net_cash']) and summary['net_cash'] > 0:
        score += 5
    summary['fundamental_score'] = score
    return hist, summary


def main():
    histories, summaries, errors = [], [], []
    for ticker in TARGETS:
        try:
            hist, summary = collect(ticker)
            histories.append(hist)
            summaries.append(summary)
        except Exception as exc:
            errors.append({'ticker': ticker, 'error': str(exc)})

    hist_df = pd.concat(histories, ignore_index=True) if histories else pd.DataFrame()
    sum_df = pd.DataFrame(summaries).sort_values('fundamental_score', ascending=False)
    err_df = pd.DataFrame(errors)

    hist_df.to_csv(ROOT / 'watchlist_9_five_year_fundamentals.csv', index=False)
    sum_df.to_csv(ROOT / 'watchlist_9_fundamental_summary.csv', index=False)
    err_df.to_csv(ROOT / 'watchlist_9_fundamental_errors.csv', index=False)

    md = ['# Watchlist 9 Fundamental Deep Review', '']
    for i, row in sum_df.reset_index(drop=True).iterrows():
        md.append(f"{i+1}. {row['ticker']} — score {row['fundamental_score']:.2f}")
    if errors:
        md += ['', '## Errors'] + [f"- {x['ticker']}: {x['error']}" for x in errors]
    (ROOT / 'watchlist_9_fundamental_summary.md').write_text('\n'.join(md), encoding='utf-8')
    print(sum_df[['ticker','fundamental_score','revenue_cagr','fcf_cagr','latest_fcf_margin','forward_pe']].to_string(index=False))


if __name__ == '__main__':
    main()
