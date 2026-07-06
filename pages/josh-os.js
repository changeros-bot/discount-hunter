import { useEffect, useMemo, useState } from "react";

const projects = [
  {
    key: "discount-hunter",
    title: "DCA 折價獵人",
    shortTitle: "折價獵人",
    subtitle: "App V17.1｜Playbook V18.0",
    status: "LIVE",
    href: "/v17",
    emoji: "🎯",
    summary: "品質優先、價格只是觸發器、買點只是允許買入。V18.1 回測前，折扣門檻不作最終規則。",
    bullets: ["V18 Ready for Review", "V18.1 回測待完成", "自動交易逐版推進"]
  },
  {
    key: "leveraged-hunter",
    title: "槓桿獵人",
    shortTitle: "槓桿獵人",
    subtitle: "Leveraged Hunter",
    status: "DRAFT",
    href: "/leveraged-hunter",
    emoji: "⚡",
    summary: "00631L / 槓桿 ETF 專用模組。核心是 Dual Drawdown Diagnostic，不混入折價獵人分類器。",
    bullets: ["TAIEX 訊號", "00631L 實際/理論回撤", "獨立診斷模組"]
  },
  {
    key: "ledger",
    title: "Josh 2026多元記帳本",
    shortTitle: "記帳本",
    subtitle: "多元記帳本 V4.4",
    status: "LIVE",
    href: "/financial-os",
    emoji: "💰",
    summary: "收入、支出、預算、生活費、資產與投資扣款整合。以 Local DB 記錄個人現金流。",
    bullets: ["總覽 / 記帳 / 預算 / 資產", "教育分類與預算", "資產編輯與安全刪除"]
  },
  {
    key: "fubon-dca",
    title: "富邦長期 DCA",
    shortTitle: "富邦 DCA",
    subtitle: "0050 / VOO / QQQM",
    status: "SEALED",
    href: "/fubon-dca",
    emoji: "🏦",
    summary: "長期核心定期定額計畫。與折價獵人分離，不做短線決策。",
    bullets: ["0050 每月 2,000", "VOO 每月 30 USD", "QQQM 每月 30 USD"]
  }
];

function statusColors(status) {
  if (status === "LIVE" || status === "PASS") return { color: "#86efac", border: "rgba(34,197,94,.36)" };
  if (status === "SEALED" || status === "PROTOTYPE") return { color: "#bae6fd", border: "rgba(56,189,248,.35)" };
  return { color: "#fde68a", border: "rgba(245,158,11,.35)" };
}

function StatusPill({ status }) {
  const { color, border } = statusColors(status);
  return <span style={{ color, border: `1px solid ${border}`, borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 950, background: "rgba(255,255,255,.04)" }}>{status}</span>;
}

function ProjectCard({ project, index, total }) {
  return <section style={{ minHeight: "calc(100vh - 160px)", display: "flex", flexDirection: "column", justifyContent: "center", background: "linear-gradient(135deg, rgba(17,24,39,.96), rgba(15,23,42,.96))", border: "1px solid rgba(148,163,184,.22)", borderRadius: 28, padding: 20, boxShadow: "0 20px 50px rgba(0,0,0,.32)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
      <div style={{ fontSize: 46 }}>{project.emoji}</div>
      <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
        <StatusPill status={project.status} />
        <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>{index + 1} / {total}</span>
      </div>
    </div>
    <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 900, marginBottom: 8 }}>{project.subtitle}</div>
    <h1 style={{ margin: 0, color: "#f8fafc", fontSize: 32, lineHeight: 1.08, fontWeight: 1000 }}>{project.title}</h1>
    <p style={{ color: "#cbd5e1", fontSize: 15, lineHeight: 1.65, fontWeight: 750, margin: "18px 0" }}>{project.summary}</p>
    <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
      {project.bullets.map((item) => <div key={item} style={{ display: "flex", alignItems: "center", gap: 9, color: "#e2e8f0", fontSize: 14, fontWeight: 850 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: "#38bdf8", display: "inline-block" }} />{item}
      </div>)}
    </div>
    <a href={project.href} style={{ display: "block", textAlign: "center", textDecoration: "none", borderRadius: 18, padding: "15px 14px", color: "#020617", background: "linear-gradient(90deg,#38bdf8,#22c55e)", fontSize: 15, fontWeight: 1000 }}>開啟 {project.shortTitle}</a>
  </section>;
}

function StatusDashboard({ statusData }) {
  const modules = statusData?.modules || [];
  const summary = statusData?.summary || { total: 4, live: 2, sealed: 1, draft: 1 };
  const normalizedModules = (modules.length ? modules : projects.map((p) => ({ key: p.key, name: p.shortTitle, route: p.href, status: p.status, health: p.key === "discount-hunter" ? "V18_READY_FOR_REVIEW" : p.status }))).map((m) => ({
    ...m,
    name: m.name === "Josh Financial OS" || m.name === "Financial OS" ? "Josh 2026多元記帳本" : m.name,
    route: m.route === "/financial-os" ? "/financial-os" : m.route
  }));

  return <section style={{ marginTop: 12, background: "rgba(17,24,39,.92)", border: "1px solid rgba(148,163,184,.18)", borderRadius: 22, padding: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 1000 }}>系統狀態</h2>
      <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 850 }}>{statusData?.registryVersion || "Josh Portfolio V18.0"}</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
      {[["總數", summary.total], ["LIVE", summary.live], ["SEALED", summary.sealed], ["DRAFT", summary.draft]].map(([label, value]) => <div key={label} style={{ background: "rgba(15,23,42,.78)", border: "1px solid rgba(148,163,184,.14)", borderRadius: 14, padding: 9, textAlign: "center" }}>
        <div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 850 }}>{label}</div>
        <div style={{ fontSize: 17, fontWeight: 1000, marginTop: 3 }}>{value}</div>
      </div>)}
    </div>
    <div style={{ display: "grid", gap: 8 }}>
      {normalizedModules.map((m) => <a key={m.key} href={m.route} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, textDecoration: "none", color: "#f8fafc", background: "rgba(15,23,42,.78)", border: "1px solid rgba(148,163,184,.14)", borderRadius: 14, padding: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 950 }}>{m.name}</div>
          <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 750, marginTop: 3 }}>{m.health}</div>
        </div>
        <StatusPill status={m.status} />
      </a>)}
    </div>
  </section>;
}

export default function JoshOSPager() {
  const [page, setPage] = useState(0);
  const [statusData, setStatusData] = useState(null);
  const project = projects[page];
  const labels = useMemo(() => projects.map((p) => p.shortTitle), []);

  useEffect(() => {
    fetch("/api/josh-os/status")
      .then((res) => res.json())
      .then((data) => { if (data?.ok) setStatusData(data); })
      .catch(() => {});
  }, []);

  function next() { setPage((p) => (p + 1) % projects.length); }
  function prev() { setPage((p) => (p - 1 + projects.length) % projects.length); }

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#0f172a 58%,#111827 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 430, margin: "0 auto", padding: "18px 14px 98px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 22, lineHeight: 1.15, fontWeight: 1000 }}>Josh OS 四合一</div>
          <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 850, marginTop: 5 }}>折價獵人｜槓桿獵人｜記帳本｜富邦 DCA</div>
        </div>
        <a href="/" style={{ color: "#bae6fd", textDecoration: "none", border: "1px solid rgba(56,189,248,.35)", borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 950 }}>首頁</a>
      </header>
      <ProjectCard project={project} index={page} total={projects.length} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        <button onClick={prev} style={{ border: "1px solid rgba(148,163,184,.22)", borderRadius: 16, padding: 13, background: "rgba(255,255,255,.04)", color: "#e2e8f0", fontWeight: 1000 }}>上一頁</button>
        <button onClick={next} style={{ border: "1px solid rgba(56,189,248,.35)", borderRadius: 16, padding: 13, background: "rgba(56,189,248,.12)", color: "#bae6fd", fontWeight: 1000 }}>下一頁</button>
      </div>
      <StatusDashboard statusData={statusData} />
    </div>
    <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "rgba(2,6,23,.92)", backdropFilter: "blur(16px)", borderTop: "1px solid rgba(148,163,184,.18)", padding: "8px 10px 10px" }}>
      <div style={{ maxWidth: 430, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
        {labels.map((label, i) => <button key={label} onClick={() => setPage(i)} style={{ border: "none", borderRadius: 12, padding: "9px 4px", background: page === i ? "rgba(56,189,248,.13)" : "transparent", color: page === i ? "#f8fafc" : "#94a3b8", fontSize: 11, fontWeight: 900 }}>{label}</button>)}
      </div>
    </nav>
  </main>;
}
