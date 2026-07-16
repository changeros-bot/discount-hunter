#!/usr/bin/env python3
from pathlib import Path
import pandas as pd

ROOT = Path('reports/backtests/market_46')
MASTER = ROOT / 'market_46_master_ranking.csv'
STATUS = ROOT / 'market_46_status.csv'

NON_COMPARABLE = {'SPCX', 'SKHY', 'DRAM'}
MIN_CORE_YEARS = 9.8
MIN_SECONDARY_YEARS = 5.0
MIN_DISCOUNT_EVENTS = 5


def main() -> None:
    df = pd.read_csv(MASTER)
    st = pd.read_csv(STATUS)[['ticker', 'status', 'error']]
    df = df.merge(st, on='ticker', how='left')

    df['data_quality'] = 'OK'
    df.loc[df['ticker'].isin(NON_COMPARABLE), 'data_quality'] = 'NON_COMPARABLE_SYMBOL'
    df.loc[df['status'].ne('OK'), 'data_quality'] = 'DATA_PENDING'
    df.loc[df['history_years'].fillna(0).lt(MIN_SECONDARY_YEARS) & df['data_quality'].eq('OK'), 'data_quality'] = 'SHORT_HISTORY'

    df['history_tier'] = 'SHORT'
    df.loc[df['history_years'].fillna(0).ge(MIN_SECONDARY_YEARS), 'history_tier'] = '5Y_PLUS'
    df.loc[df['history_years'].fillna(0).ge(MIN_CORE_YEARS), 'history_tier'] = 'FULL_10Y'

    df['discount_sample_ok'] = df['events'].fillna(0).ge(MIN_DISCOUNT_EVENTS)
    df['eligible_core_rank'] = (
        df['data_quality'].eq('OK')
        & df['history_tier'].eq('FULL_10Y')
        & df['ticker'].ne('BTC-USD')
    )
    df['eligible_secondary_rank'] = (
        df['data_quality'].eq('OK')
        & df['history_tier'].eq('5Y_PLUS')
        & df['ticker'].ne('BTC-USD')
    )

    # Original score is retained for reproducibility but is not trusted across short histories.
    df['validated_score'] = df['rank_score']
    df.loc[~df['discount_sample_ok'], 'validated_score'] = (
        df.loc[~df['discount_sample_ok'], 'validated_score']
        - 10
    )

    core = df[df['eligible_core_rank']].sort_values('validated_score', ascending=False).copy()
    core.insert(0, 'validated_rank', range(1, len(core) + 1))

    secondary = df[df['eligible_secondary_rank']].sort_values('validated_score', ascending=False).copy()
    secondary.insert(0, 'validated_rank', range(1, len(secondary) + 1))

    excluded = df[~df['eligible_secondary_rank']].sort_values(['data_quality', 'history_years'], ascending=[True, False]).copy()

    core.to_csv(ROOT / 'market_46_validated_full10y_ranking.csv', index=False)
    secondary.to_csv(ROOT / 'market_46_validated_5yplus_ranking.csv', index=False)
    excluded.to_csv(ROOT / 'market_46_excluded_or_short_history.csv', index=False)

    print(f'Validated full-10y names: {len(core)}')
    print(f'Validated 5y+ names: {len(secondary)}')
    print(f'Excluded/short/data-pending: {len(excluded)}')


if __name__ == '__main__':
    main()
