import { useMemo, useState } from "react";

const foodRows = [
  { name: "早餐", amount: 320, kind: "food" },
  { name: "午餐", amount: 480, kind: "food" },
  { name: "晚餐", amount: 400, kind: "food" },
  { name: "飲料", amount: 150, kind: "food" },
  { name: "咖啡", amount: 200, kind: "food" },
  { name: "菸", amount: 510, kind: "habit" }
];

const quickItems = ["早餐 $80", "午餐 $120", "咖啡 $50", "菸 $85", "ChatGPT $660", "Google One $65"];

const demoInvoices = [
  { id: "demo-1", date: "2026-07-04", merchant: "全家", amount: 85, suggestedCategory: "菸", account: "自用", isLivingExpense: "Y", isFixedExpense: "N", affectsBudget: "Y", status: "待確認", confidence: 0.72 },
  { id: "demo-2", date: "2026-07-04", merchant: "7-ELEVEN", amount: 80, suggestedCategory: "早餐", account: "自用", isLivingExpense: "Y", isFixedExpense: "N", affectsBudget: "Y", status: "待確認", confidence: 0.66 },
  { id: "demo-3", date: "2026-07-03", merchant: "路易莎咖啡", amount: 55, suggestedCategory: "咖啡", account: "自用", isLivingExpense: "Y", isFixedExpense: "N", affectsBudget: "Y", status: "待確認", confidence: 0.9 }
];

function money(n) {
  if (n === null || n === undefined) return "$—";
  return `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function Card({ children, style }) {
  return <section style={{ background: "rgba(17,24,39,.92)", border: "1px solid rgba(148,163,184,.18)", borderRadius: 22, padding: 16, marginBottom: 12, boxShadow: "0 12px 34px rgba(0,0,0,.26)", ...style }}>{children}</section>;
}

function SectionTitle({ title, right }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 950 }}>{title}</h2>
    {right ? <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>{right}</span> : null}
  </div>;
}

function Metric({ label, value, sub }) {
  return <Card style={{ marginBottom: 0, padding: 14 }}>
    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{label}</div>
    <div style={{ color: "#f8fafc", fontSize: 24, fontWeight: 1000 }}>{value}</div>
    {sub ? <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 750, marginTop: 6, lineHeight: 1.35 }}>{sub}</div> : null}
  </Card>;
}

function BarRow({ row, max }) {
  const pct = max > 0 ? Math.max(4, Math.round((row.amount / max) * 100)) : 0;
  const isHabit = row.kind === "habit";
  return <div style={{ display: "grid", gridTemplateColumns: "58px 1fr 64px", alignItems: "center", gap: 10, margin: "12px 0" }}>
    <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 900 }}>{row.name}</div>
    <div style={{ height: 14, borderRadius: 999, background: "#243044", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: isHabit ? "linear-gradient(90deg,#f59e0b,#ef4444)" : "linear-gradient(90deg,#38bdf8,#22c55e)" }} />
    </div>
    <div style={{ textAlign: "right", fontSize: 13, fontWeight: 950 }}>{money(row.amount)}</div>
  </div>;
}

function Pill({ children, tone = "normal" }) {
  const color = tone === "warn" ? "#fde68a" : tone === "blue" ? "#bae6fd" : tone === "good" ? "#86efac" : "#cbd5e1";
  const border = tone === "warn" ? "rgba(245,158,11,.35)" : tone === "blue" ? "rgba(56,189,248,.35)" : tone === "good" ? "rgba(34,197,94,.35)" : "rgba(148,163,184,.24)";
  return <span style={{ border: `1px solid ${border}`, color, borderRadius: 999, padding: "6px 9px", fontSize: 12, fontWeight: 850, background: "rgba(255,255,255,.04)" }}>{children}</span>;
}

function ListRow({ title, sub, value, tone }) {
  const color = tone === "good" ? "#86efac" : tone === "bad" ? "#fca5a5" : "#f8fafc";
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid rgba(148,163,184,.12)" }}>
    <div>
      <div style={{ fontSize: 14, fontWeight: 950 }}>{title}</div>
      {sub ? <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 750, marginTop: 4, lineHeight: 1.35 }}>{sub}</div> : null}
    </div>
    <div style={{ color, fontSize: 14, fontWeight: 1000, whiteSpace: "nowrap" }}>{value}</div>
  </div>;
}

function TinyButton({ children, onClick, disabled, tone = "blue" }) {
  const bg = tone === "good" ? "rgba(34,197,94,.16)" : "rgba(56,189,248,.14)";
  const border = tone === "good" ? "rgba(34,197,94,.36)" : "rgba(56,189,248,.34)";
  const color = tone === "good" ? "#bbf7d0" : "#bae6fd";
  return <button onClick={onClick} disabled={disabled} style={{ border: `1px solid ${border}`, background: disabled ? "rgba(51,65,85,.55)" : bg, color: disabled ? "#94a3b8" : color, borderRadius: 12, padding: "8px 10px", fontWeight: 950, fontSize: 12 }}>{children}</button>;
}

function InvoiceSyncCard() {
  const [syncState, setSyncState] = useState({ loading: false, data: null, error: "" });
  const [confirmedMap, setConfirmedMap] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [confirmingId, setConfirmingId] = useState("");

  const sourceInvoices = syncState.data?.invoices || demoInvoices;
  const invoices = sourceInvoices.map((item) => confirmedMap[item.id] ? { ...item, status: "已入帳" } : item);
  const summary = {
    count: invoices.length,
    pendingCount: invoices.filter((item) => item.status !== "已入帳").length,
    totalAmount: invoices.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  };

  async function syncInvoices() {
    setSyncState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const res = await fetch("/api/financial-os/invoices/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data?.ok === false) throw new Error(data?.message || "發票同步失敗");
      setSyncState({ loading: false, data, error: "" });
    } catch (err) {
      setSyncState((prev) => ({ ...prev, loading: false, error: err.message || "發票同步失敗" }));
    }
  }

  async function confirmInvoice(item) {
    setConfirmingId(item.id);
    setSyncState((prev) => ({ ...prev, error: "" }));
    try {
      const res = await fetch("/api/financial-os/invoices/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice: item })
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) throw new Error(data?.message || "確認入帳失敗");
      setConfirmedMap((prev) => ({ ...prev, [item.id]: true }));
      setTransactions((prev) => [data.transaction, ...prev.filter((tx) => tx.sourceInvoiceId !== item.id)]);
    } catch (err) {
      setSyncState((prev) => ({ ...prev, error: err.message || "確認入帳失敗" }));
    } finally {
      setConfirmingId("");
    }
  }

  return <Card>
    <SectionTitle title="載具發票同步" right={syncState.data ? syncState.data.mode : "Demo"} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
      <Metric label="本次發票" value={summary.count} sub="同步筆數" />
      <Metric label="待確認" value={summary.pendingCount} sub="不直接入帳" />
      <Metric label="金額" value={money(summary.totalAmount)} sub="候選支出" />
    </div>
    <button onClick={syncInvoices} disabled={syncState.loading} style={{ display: "block", width: "100%", border: "none", borderRadius: 16, background: syncState.loading ? "#334155" : "linear-gradient(90deg,#38bdf8,#22c55e)", color: syncState.loading ? "#cbd5e1" : "#020617", fontWeight: 1000, padding: 14, fontSize: 15, marginBottom: 12 }}>
      {syncState.loading ? "同步中..." : "立即同步載具發票"}
    </button>
    {syncState.error ? <div style={{ color: "#fca5a5", fontSize: 13, fontWeight: 850, marginBottom: 10 }}>{syncState.error}</div> : null}
    {syncState.data?.message ? <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 750, lineHeight: 1.45, marginBottom: 10 }}>{syncState.data.message}</div> : null}
    <div style={{ display: "grid", gap: 8 }}>
      {invoices.map((item) => {
        const isBooked = item.status === "已入帳";
        return <div key={item.id} style={{ background: "rgba(15,23,42,.78)", border: "1px solid rgba(148,163,184,.16)", borderRadius: 14, padding: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 950 }}>{item.merchant}</div>
              <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 750, marginTop: 4 }}>{item.date}｜AI：{item.suggestedCategory}｜信心 {Math.round(Number(item.confidence || 0) * 100)}%</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 1000 }}>{money(item.amount)}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <Pill tone={isBooked ? "good" : "warn"}>{item.status}</Pill>
            <Pill tone="blue">生活費 Y</Pill>
            <Pill>{isBooked ? "已產生交易草稿" : "確認後入帳"}</Pill>
          </div>
          {!isBooked ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
            <TinyButton tone="good" disabled={confirmingId === item.id} onClick={() => confirmInvoice(item)}>{confirmingId === item.id ? "處理中..." : "確認入帳"}</TinyButton>
            <TinyButton disabled>改分類</TinyButton>
          </div> : null}
        </div>;
      })}
    </div>
    {transactions.length ? <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(148,163,184,.16)" }}>
      <SectionTitle title="已入帳交易草稿" right={`${transactions.length} 筆`} />
      {transactions.map((tx) => <ListRow key={tx.id} title={`${tx.date}｜${tx.category}`} sub={`${tx.account}｜${tx.note}`} value={money(tx.amount)} tone="good" />)}
    </div> : null}
  </Card>;
}

function DashboardScreen() {
  const maxFood = useMemo(() => Math.max(...foodRows.map((r) => r.amount)), []);
  const foodTotal = foodRows.reduce((sum, row) => sum + row.amount, 0);
  const livingBudget = 8000;
  const livingUsed = 1776;
  const ratio = Math.round((foodTotal / livingBudget) * 1000) / 10;

  return <>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
      <Metric label="總資產" value="$—" sub="等待補現金、銀行、投資資料" />
      <Metric label="本月現金流" value="$—" sub="收入 - 支出 - 投資轉出" />
      <Metric label="生活費預算" value={money(livingBudget)} sub="日常可控消費" />
      <Metric label="生活費已用" value={money(livingUsed)} sub={`剩餘 ${money(livingBudget - livingUsed)}`} />
    </div>
    <Card>
      <SectionTitle title="飲食大類｜細項支出" right="本月" />
      {foodRows.map((row) => <BarRow key={row.name} row={row} max={maxFood} />)}
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(148,163,184,.16)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1", fontSize: 12, fontWeight: 850, marginBottom: 8 }}>
          <span>飲食＋習慣消費佔生活費</span><span>{ratio}%</span>
        </div>
        <div style={{ height: 9, borderRadius: 999, background: "#243044", overflow: "hidden" }}>
          <div style={{ width: `${ratio}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#22c55e,#f59e0b)" }} />
        </div>
      </div>
      <div style={{ marginTop: 14, background: "rgba(56,189,248,.08)", border: "1px solid rgba(56,189,248,.22)", borderRadius: 14, padding: 12, color: "#dbeafe", fontSize: 13, lineHeight: 1.55, fontWeight: 750 }}>
        <b>AI 初判：</b>目前最大細項是 <span style={{ color: "#fde68a" }}>菸 {money(510)}</span>，其次是午餐 {money(480)}。這張卡的用途是快速找出「生活費真正被哪個細項吃掉」。
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <Pill tone="blue">飲食</Pill><Pill tone="blue">咖啡</Pill><Pill tone="warn">菸：可獨立 KPI</Pill>
      </div>
    </Card>
    <Card>
      <SectionTitle title="三帳戶狀態" right="V1 固定" />
      <ListRow title="🏠 家用" sub="家庭支出 / 共用資金" value="$—" />
      <ListRow title="👤 自用" sub="薪水與日常生活費" value="$—" />
      <ListRow title="📈 投資" sub="富邦、Binance、xStocks" value="$—" />
    </Card>
    <Card>
      <SectionTitle title="Money Flow" right="V1.5 草稿" />
      <pre style={{ margin: 0, whiteSpace: "pre", overflowX: "auto", color: "#cbd5e1", background: "rgba(15,23,42,.65)", border: "1px solid rgba(148,163,184,.16)", padding: 12, borderRadius: 14, fontSize: 12, lineHeight: 1.55 }}>{`薪水
  │
  ▼
自用帳戶
  ├──► 家用 20,000
  ├──► 投資 5,000
  └──► 生活費 8,000
        ├── 早餐
        ├── 午餐
        ├── 咖啡
        └── 菸`}</pre>
    </Card>
  </>;
}

function EntryScreen() {
  return <>
    <InvoiceSyncCard />
    <Card>
      <SectionTitle title="快速記帳" right="五交易類型" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {["➕ 收入", "➖ 支出", "⇄ 轉帳", "🤝 借款", "💰 還款", "📷 收據"].map((x) => <div key={x} style={{ border: "1px solid rgba(148,163,184,.22)", background: "rgba(255,255,255,.04)", color: "#e2e8f0", borderRadius: 14, padding: "10px 8px", textAlign: "center", fontSize: 13, fontWeight: 900 }}>{x}</div>)}
      </div>
    </Card>
    <Card>
      <SectionTitle title="新增支出" right="Prototype" />
      {["金額｜$80", "帳戶｜自用", "分類｜早餐", "生活費｜Y", "固定支出｜N", "預算｜Y", "備註｜早餐 / 可省略"].map((x) => {
        const [label, value] = x.split("｜");
        return <div key={x} style={{ background: "rgba(15,23,42,.85)", border: "1px solid rgba(148,163,184,.22)", borderRadius: 14, padding: 12, color: "#e2e8f0", fontSize: 14, marginBottom: 10 }}>
          <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 850, marginBottom: 5 }}>{label}</div>{value}
        </div>;
      })}
      <button style={{ display: "block", width: "100%", border: "none", borderRadius: 16, background: "linear-gradient(90deg,#38bdf8,#22c55e)", color: "#020617", fontWeight: 1000, padding: 14, fontSize: 15, marginTop: 12 }}>儲存這筆</button>
    </Card>
    <Card>
      <SectionTitle title="常用細項" right="一鍵帶入" />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{quickItems.map((item) => <Pill key={item} tone={item.includes("菸") ? "warn" : item.includes("早餐") || item.includes("午餐") || item.includes("咖啡") ? "blue" : "normal"}>{item}</Pill>)}</div>
    </Card>
  </>;
}

function BudgetScreen() {
  return <>
    <Card><SectionTitle title="本月預算" right="2026-07" />
      <ListRow title="生活費" sub="早餐、午餐、晚餐、飲料、咖啡、菸、手機、訂閱" value="$8,000" />
      <ListRow title="固定支出" sub="ChatGPT、Google One、手機月攤" value="$1,611" />
      <ListRow title="投資" sub="0050 / VOO / QQQM / 折價獵人" value="$—" />
    </Card>
    <Card><SectionTitle title="未來預算" right="提醒" />
      <ListRow title="空大學費" sub="非生活費，可能有減免" value="$11,280" tone="bad" />
      <ListRow title="筆電" sub="95 分以上規格" value="$13,000" />
      <ListRow title="機車維修" sub="7/10 待處理" value="$4,000" tone="bad" />
    </Card>
  </>;
}

function AssetsScreen() {
  return <>
    <Card><SectionTitle title="資產中心" right="手動版" />
      <ListRow title="現金" sub="身上現金" value="$—" />
      <ListRow title="銀行" sub="台幣帳戶" value="$—" />
      <ListRow title="ETF" sub="0050 / VOO / QQQM" value="$—" />
      <ListRow title="Crypto" sub="BTC / USDT" value="$—" />
      <ListRow title="xStocks" sub="NVDAon / TSMon / AVGOon..." value="$—" />
    </Card>
    <Card><SectionTitle title="借貸狀態" right="內外部" />
      <div style={{ color: "#dbeafe", background: "rgba(56,189,248,.08)", border: "1px solid rgba(56,189,248,.22)", borderRadius: 14, padding: 12, fontSize: 13, lineHeight: 1.65, fontWeight: 750 }}>
        這裡未來分兩層：<br />1. 三帳戶內部借款：家用 ↔ 自用 ↔ 投資。<br />2. 外部債務：母親、弟弟、朋友 USDT、保單借款。
      </div>
    </Card>
  </>;
}

export default function FinancialOSPage() {
  const [tab, setTab] = useState("dashboard");
  const tabs = [
    ["dashboard", "總覽"],
    ["entry", "記帳"],
    ["budget", "預算"],
    ["assets", "資產"]
  ];

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#0f172a 55%,#111827 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 430, margin: "0 auto", padding: "18px 14px 94px" }}>
      <section style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 1000, letterSpacing: .2, lineHeight: 1.18 }}>Josh Financial OS</div>
          <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800, marginTop: 5 }}>Multi-Account Financial OS｜App Prototype V1.4</div>
        </div>
        <div style={{ padding: "6px 10px", border: "1px solid #334155", borderRadius: 999, fontSize: 12, color: "#cbd5e1", background: "rgba(255,255,255,.04)", whiteSpace: "nowrap", fontWeight: 900 }}>2026-07</div>
      </section>
      {tab === "dashboard" ? <DashboardScreen /> : null}
      {tab === "entry" ? <EntryScreen /> : null}
      {tab === "budget" ? <BudgetScreen /> : null}
      {tab === "assets" ? <AssetsScreen /> : null}
    </div>
    <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "rgba(2,6,23,.92)", backdropFilter: "blur(16px)", borderTop: "1px solid rgba(148,163,184,.18)", padding: "8px 10px 10px" }}>
      <div style={{ maxWidth: 430, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
        {tabs.map(([key, label]) => <button key={key} onClick={() => setTab(key)} style={{ border: "none", textAlign: "center", color: tab === key ? "#f8fafc" : "#94a3b8", fontSize: 11, fontWeight: 900, padding: "9px 4px", borderRadius: 12, background: tab === key ? "rgba(56,189,248,.13)" : "transparent" }}>{label}</button>)}
      </div>
    </nav>
  </main>;
}
