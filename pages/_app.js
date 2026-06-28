import { useEffect, useMemo, useState } from "react";
import "../styles/globals.css";
import "../styles/v10.css";
import "../styles/title-gold.css";
import "../styles/hero-poster.css";
import "../styles/v15-unified.css";
import "../styles/v15-fix.css";
import "../styles/v15-color-force.css";
import Head from "next/head";

function formatTime(isoString) {
  if (!isoString) return "讀取中";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "讀取中";
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

async function fetchWalletSummary() {
  const res = await fetch("/api/sync-wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "錢包資料讀取失敗");
  return data;
}

const CHANGELOG_ITEMS = [
  {
    version: "V16-M Audit-018",
    date: "2026/06/28",
    commit: "eabc1dd",
    items: ["更新紀錄改為 V16-M 稽核格式", "新增日期、版本與 Commit 欄位", "最新修正置頂顯示"],
  },
  {
    version: "V16-M Audit-017",
    date: "2026/06/28",
    commit: "53eddc8",
    items: ["Ledger 檢查正式化", "PASS / FAIL 面板", "Debug JSON 改為開發詳細資料"],
  },
  {
    version: "V16-M Audit-016",
    date: "2026/06/27",
    commit: "b84b82e",
    items: ["補登 Ledger 前強制 Live Wallet Sync", "未偵測到真實鏈上持倉時拒絕補登", "避免舊 Wallet 快照造成錯誤登帳"],
  },
  {
    version: "V16-M Audit-015",
    date: "2026/06/27",
    commit: "ecd68c3",
    items: ["移除 Legacy BuyPointAlertPortal", "首頁不再顯示舊買點警報容器", "今日決策、已登帳持倉區、觀察區三區分流"],
  },
  {
    version: "V15.8",
    date: "Legacy",
    commit: "--",
    items: ["新增更新紀錄系統", "保留 Footer 版本號與最後同步時間"],
  },
];

function Changelog() {
  return <details className="changelogBox">
    <summary>📜 更新紀錄</summary>
    <div className="changelogContent">
      {CHANGELOG_ITEMS.map((entry) => <section key={`${entry.version}-${entry.commit}`}>
        <strong>{entry.date}｜{entry.version}</strong>
        <p style={{ margin: "6px 0", color: "#94a3b8", fontWeight: 850 }}>Commit：{entry.commit}</p>
        <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
          {entry.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>)}
    </div>
  </details>;
}

function HoldingsDistribution() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadDistribution() {
      try {
        const data = await fetchWalletSummary();
        if (!active) return;
        setSummary(data);
      } catch (err) {
        if (!active) return;
        setError(err.message || "持倉分布讀取失敗");
      }
    }
    loadDistribution();
    return () => { active = false; };
  }, []);

  const rows = useMemo(() => {
    const holdings = summary?.holdings || [];
    const total = holdings.reduce((sum, holding) => sum + Number(holding.currentValue || 0), 0);
    if (!total) return [];
    return holdings
      .map((holding) => {
        const value = Number(holding.currentValue || 0);
        return { symbol: holding.symbol, value, pct: (value / total) * 100 };
      })
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [summary]);

  return <details className="holdingsChartBox">
    <summary>📊 持倉分布</summary>
    <div className="holdingsChartContent">
      {error && <div className="chartMessage">⚠️ {error}</div>}
      {!error && rows.length === 0 && <div className="chartMessage">讀取持倉分布中…</div>}
      {rows.map((row) => <div className="holdingBarRow" key={row.symbol}>
        <div className="holdingBarMeta"><strong>{row.symbol}</strong><span>${row.value.toFixed(2)}｜{row.pct.toFixed(1)}%</span></div>
        <div className="holdingBarTrack"><div className="holdingBarFill" style={{ width: `${Math.max(3, Math.min(100, row.pct))}%` }} /></div>
      </div>)}
    </div>
  </details>;
}

function HistorySummary() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      try {
        const data = await fetchWalletSummary();
        if (!active) return;
        setSummary(data);
      } catch (err) {
        if (!active) return;
        setError(err.message || "歷史紀錄讀取失敗");
      }
    }
    loadHistory();
    return () => { active = false; };
  }, []);

  const counts = summary?.debugCounts || {};
  const holdingSymbols = Array.isArray(counts.holdingSymbols) ? counts.holdingSymbols : [];

  return <details className="historyBox">
    <summary>📒 歷史紀錄</summary>
    <div className="historyContent">
      {error && <div className="chartMessage">⚠️ {error}</div>}
      {!error && !summary && <div className="chartMessage">讀取歷史摘要中…</div>}
      {summary && <>
        <div className="historyGrid">
          <div><span>Transfers</span><strong>{counts.totalTransfers ?? 0}</strong></div>
          <div><span>Ledger</span><strong>{counts.buyRecordsCount ?? 0}</strong></div>
          <div><span>Holdings</span><strong>{counts.holdingsCount ?? 0}</strong></div>
          <div><span>最後同步</span><strong>{formatTime(summary.lastSyncTime || summary.checkedAt)}</strong></div>
        </div>
        <div className="historyNote"><strong>資料來源</strong><p>{summary.source || "讀取中"}</p></div>
        {holdingSymbols.length > 0 && <div className="historyNote"><strong>持倉標的</strong><p>{holdingSymbols.join("、")}</p></div>}
      </>}
    </div>
  </details>;
}

export default function App({ Component, pageProps }) {
  return <>
    <Head>
      <title>DCA 折價獵人</title>
      <meta name="description" content="DCA 折價獵人：手機版追蹤儀表板。" />
      <meta property="og:title" content="DCA 折價獵人" />
      <meta property="og:description" content="手機版追蹤儀表板，快速查看狀態與更新。" />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content="DCA 折價獵人" />
      <meta name="twitter:description" content="手機版追蹤儀表板，快速查看狀態與更新。" />
    </Head>
    <Component {...pageProps} />
    <Changelog />
    <HoldingsDistribution />
    <HistorySummary />
  </>;
}
