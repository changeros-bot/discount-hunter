import { useState } from 'react';
import FinancialOS from './financial-os';
import AssetHistoryPanel from '../components/AssetHistoryPanel';

export default function FinancialShell() {
  const [showAssetHistory, setShowAssetHistory] = useState(false);

  function handleClickCapture(event) {
    const button = event.target?.closest?.('button');
    const label = button?.textContent?.trim();
    if (label === '資產') setShowAssetHistory(true);
    if (['總覽', '記帳', '預算'].includes(label)) setShowAssetHistory(false);
  }

  return <div onClickCapture={handleClickCapture} style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#020617,#0f172a 55%,#111827)' }}>
    <FinancialOS />
    {showAssetHistory && <AssetHistoryPanel />}
  </div>;
}
