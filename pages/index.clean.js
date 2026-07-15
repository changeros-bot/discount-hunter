const projects = [
  {
    id: 1,
    eyebrow: "LIVE CORE",
    title: "DCA 折價獵人",
    description: "正式主頁只保留已上線核心名單；紙上候選不得自動升格，必須 Josh 明確同意才可進折價獵人。",
    href: "/v17",
    status: "LIVE",
    accent: "#22c55e",
  },
  {
    id: 2,
    eyebrow: "LOCAL DB",
    title: "Josh 2026多元記帳本",
    description: "收入、支出、薪轉、預算、生活費、資產同步與安全刪除。版本 V4.6。",
    href: "/financial-os",
    status: "LIVE",
    accent: "#a78bfa",
  },
  {
    id: 3,
    eyebrow: "SEALED CORE",
    title: "富邦長期 DCA",
    description: "0050 / VOO / QQQM。長期核心定期定額計畫，與折價獵人分離，不做短線決策。",
    href: "/fubon-dca",
    status: "SEALED",
    accent: "#38bdf8",
  },
];

function ProjectCard({ project }) {
  return <a href={project.href} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
    <section style={{ borderRadius: 24, overflow: "hidden", background: "linear-gradient(160deg, rgba(15,23,42,.96), rgba(2,6,23,.98))", border: `1px solid ${project.accent}55`, boxShadow: `0 18px 46px ${project.accent}18`, marginBottom: 14 }}>
      <div style={{ padding: 20, background: `radial-gradient(circle at 20% 10%, ${project.accent}33, transparent 38%), linear-gradient(135deg, rgba(8,47,73,.42), rgba(2,6,23,.92))`, borderBottom: "1px solid rgba(148,163,184,.14)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span style={{ color: project.accent, letterSpacing: 3, fontWeight: 1000, fontSize: 12 }}>{project.eyebrow}</span>
          <span style={{ color: "#e2e8f0", border: `1px solid ${project.accent}66`, background: `${project.accent}14`, padding: "6px 10px", borderRadius: 999, fontWeight: 950, fontSize: 11 }}>{project.status}</span>
        </div>
        <h2 style={{ color: "#f8fafc", fontSize: 28, lineHeight: 1.08, margin: "26px 0 0", fontWeight: 1000 }}>{project.title}</h2>
      </div>
      <div style={{ padding: 18 }}>
        <p style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.55, margin: 0, fontWeight: 850 }}>{project.description}</p>
        <div style={{ marginTop: 16, border: `1px solid ${project.accent}44`, borderRadius: 16, padding: "13px 12px", textAlign: "center", color: project.accent, fontSize: 14, fontWeight: 1000 }}>進入專案 →</div>
      </div>
    </section>
  </a>;
}

export default function ProjectPager() {
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 430, margin: "0 auto", padding: "24px 16px 34px" }}>
      <header style={{ marginBottom: 18 }}>
        <div style={{ color: "#38bdf8", fontSize: 18, letterSpacing: 4, fontWeight: 1000 }}>Josh 2026 OS</div>
        <h1 style={{ margin: "8px 0 14px", fontSize: 42, lineHeight: 1.02, fontWeight: 1000 }}>Project Pager</h1>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {projects.map((p) => <a key={p.id} href={p.href} style={{ width: 46, height: 46, borderRadius: 999, display: "grid", placeItems: "center", color: "#dbeafe", textDecoration: "none", fontSize: 18, fontWeight: 1000, border: `1px solid ${p.accent}55`, background: "rgba(15,23,42,.78)" }}>{p.id}</a>)}
        </div>
      </header>

      <section>
        {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
      </section>

      <footer style={{ marginTop: 18, color: "#64748b", fontSize: 12, lineHeight: 1.6, fontWeight: 800 }}>
        入口：折價獵人、Josh 2026多元記帳本、富邦 DCA。
      </footer>
    </div>
  </main>;
}
