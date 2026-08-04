import { useEffect, useMemo, useState } from 'react';

const RATE = 32.5;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const nt = (n) => '$' + Number(n || 0).toLocaleString('zh-TW', { maximumFractionDigits: 0 });

export default function AssetHistoryPanel() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('正在建立今日資產快照…');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const [financialRes, ledgerRes] = await Promise.all([
          fetch('/api/financial/data?limit=1&t=' + Date.now(), { cache: 'no-store' }),
          fetch('/api/wallet-ledger?t=' + Date.now(), { cache: 'no-store' }),
        ]);
        const financial = await financialRes.json();
        const ledger = await ledgerRes.json();
        if (!financialRes.ok || financial.ok === false) throw new Error(financial.error || '資產讀取失敗');

        const manual = (financial.assets || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const investmentUsd = Number(ledger.portfolioMarketValue ?? ledger.currentValue ?? ledger.marketValue ?? 0);
        const total = manual + investmentUsd * RATE;

        const saveRes = await fetch('/api/financial/asset-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: today(), total, manual, investmentUsd, rate: RATE }),
        });
        const saved = await saveRes.json();
        if (!saveRes.ok || saved.ok === false) throw new Error(saved.error || '快照儲存失敗');

        const historyRes = await fetch('/api/financial/asset-history?limit=5000&t=' + Date.now(), { cache: 'no-store' });
        const history = await historyRes.json();
        if (!historyRes.ok || history.ok === false) throw new Error(history.error || '歷史讀取失敗');
        if (!cancelled) {
          setRows(Array.isArray(history.rows) ? history.rows : []);
          setStatus('今日快照已同步 Neon｜歷史紀錄持續累積');
        }
      } catch (error) {
        if (!cancelled) setStatus('資產曲線載入失敗：' + error.message);
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  const chart = useMemo(() => {
    if (!rows.length) return null;
    const data = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const values = data.map((item) => Number(item.total || 0));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = Math.max(1, max - min);
    const width = 360;
    const height = 190;
    const left = 48;
    const right = 12;
    const top = 18;
    const bottom = 34;
    const x = (index) => left + (data.length === 1 ? (width - left - right) / 2 : index * (width - left - right) / (data.length - 1));
    const y = (value) => top + (max - value) * (height - top - bottom) / spread;
    const points = data.map((item, index) => `${x(index)},${y(Number(item.total || 0))}`).join(' ');
    const labelStep = Math.max(1, Math.ceil(data.length / 6));
    return { data, min, max, width, height, left, right, top, bottom, x, y, points, labelStep };
  }, [rows]);

  const orderedRows = useMemo(() => [...rows].sort((a, b) => a.date.localeCompare(b.date)), [rows]);
  const latest = orderedRows.length ? orderedRows[orderedRows.length - 1] : null;
  const previous = orderedRows.length > 1 ? orderedRows[orderedRows.length - 2] : null;
  const change = latest && previous ? Number(latest.total) - Number(previous.total) : 0;

  return <section style={{ maxWidth: 430, margin: '0 auto', padding: '0 14px 130px', color: '#f8fafc', background: 'linear-gradient(180deg,#111827,#0f172a)' }}>
    <div style={{ background: 'linear-gradient(160deg,rgba(17,24,39,.97),rgba(8,18,34,.97))', border: '1px solid rgba(56,189,248,.42)', borderRadius: 22, padding: 16, boxShadow: '0 16px 40px rgba(0,0,0,.28)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12, alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 950 }}>每日資產變化曲線</h2>
        <b style={{ color: '#86efac', fontSize: 12 }}>累計 {rows.length || 0} 天</b>
      </div>

      {latest && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div><div style={{ color: '#94a3b8', fontSize: 11 }}>最新總資產</div><b style={{ fontSize: 26 }}>{nt(latest.total)}</b></div>
        <div style={{ textAlign: 'right' }}><div style={{ color: '#94a3b8', fontSize: 11 }}>較前一日</div><b style={{ color: change > 0 ? '#86efac' : change < 0 ? '#fca5a5' : '#cbd5e1', fontSize: 18 }}>{change > 0 ? '+' : ''}{nt(change)}</b></div>
      </div>}

      {chart ? <svg viewBox={`0 0 ${chart.width} ${chart.height}`} width="100%" role="img" aria-label="完整每日總資產變化曲線">
        <line x1={chart.left} y1={chart.top} x2={chart.left} y2={chart.height - chart.bottom} stroke="rgba(148,163,184,.25)" />
        <line x1={chart.left} y1={chart.height - chart.bottom} x2={chart.width - chart.right} y2={chart.height - chart.bottom} stroke="rgba(148,163,184,.25)" />
        <text x="2" y={chart.top + 5} fill="#94a3b8" fontSize="10">{nt(chart.max)}</text>
        <text x="2" y={chart.height - chart.bottom} fill="#94a3b8" fontSize="10">{nt(chart.min)}</text>
        {chart.data.length > 1 && <polyline fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={chart.points} />}
        {chart.data.map((item, index) => <g key={item.date}>
          <circle cx={chart.x(index)} cy={chart.y(Number(item.total || 0))} r={chart.data.length > 90 ? 2 : 4} fill="#86efac"><title>{item.date}｜{nt(item.total)}</title></circle>
          {(index === 0 || index === chart.data.length - 1 || index % chart.labelStep === 0) && <text x={chart.x(index)} y={chart.height - 10} textAnchor="middle" fill="#94a3b8" fontSize="9">{item.date.slice(5)}</text>}
        </g>)}
      </svg> : <div style={{ color: '#94a3b8', padding: '24px 0' }}>今天會建立第一個基準點，明天開始形成曲線。</div>}

      <div style={{ color: status.includes('失敗') ? '#fca5a5' : '#86efac', fontSize: 11, marginTop: 8, fontWeight: 900 }}>{status}</div>
      <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 5 }}>歷史資料永久累積；每天保存一筆，同一天資產變動時更新當日快照，不重複新增。</div>
    </div>
  </section>;
}
