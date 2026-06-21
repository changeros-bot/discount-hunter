function formatUsd(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "$0";
  return `$${number.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function PortfolioDistribution({ walletSummary }) {
  const holdings = walletSummary?.holdings || [];
  const normalized = holdings
    .map((holding) => ({
      symbol: holding.symbol,
      currentValue: Number(holding.currentValue || 0),
    }))
    .filter((row) => row.symbol && row.currentValue > 0);
  const total = normalized.reduce((sum, row) => sum + row.currentValue, 0);
  const rows = normalized
    .map((row) => ({ ...row, pct: total > 0 ? (row.currentValue / total) * 100 : 0 }))
    .sort((a, b) => b.currentValue - a.currentValue);

  return <details className="portfolioChartBox">
    <summary>📊 持倉分布</summary>
    <div className="portfolioChartContent">
      {rows.length === 0 && <div className="portfolioChartNote">目前沒有可顯示的持倉分布。</div>}
      {rows.length > 0 && <>
        <div className="portfolioChartHeader">
          <span>依目前鏈上市值排序</span>
          <strong>{rows.length} 檔</strong>
        </div>
        <div className="portfolioChartRows">
          {rows.map((row) => <div className="portfolioChartRow" key={row.symbol}>
            <div className="portfolioChartMeta">
              <strong>{row.symbol}</strong>
              <span>{formatUsd(row.currentValue)}｜{row.pct.toFixed(1)}%</span>
            </div>
            <div className="portfolioChartTrack" aria-label={`${row.symbol} 占比 ${row.pct.toFixed(1)}%`}>
              <div className="portfolioChartBar" style={{ width: `${Math.max(3, Math.min(100, row.pct))}%` }} />
            </div>
          </div>)}
        </div>
      </>}
    </div>
  </details>;
}
