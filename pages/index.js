const projects = [
  {
    id: 1,
    eyebrow: "CORE",
    title: "富邦台美股長期 DCA",
    description: "0050 / VOO / QQQM。長期核心定期定額，不做短線決策。",
    href: "/fubon-dca",
    status: "Sealed",
    accent: "#38bdf8",
  },
  {
    id: 2,
    eyebrow: "LIVE V18",
    title: "DCA 折價獵人",
    description: "App V17.1｜Playbook V18.0。品質優先，買點只是允許買入，V18.1 回測前不固定最終門檻。",
    href: "/v17",
    status: "Ready",
    accent: "#22c55e",
  },
  {
    id: 3,
    eyebrow: "PLANNING",
    title: "槓桿獵人",
    description: "00631L 與槓桿 ETF 診斷模組。等待 Exit Rule 完成後啟用。",
    href: "/leveraged-hunter",
    status: "Soon",
    accent: "#f59e0b",
  },
  {
    id: 4,
    eyebrow: "PROTOTYPE",
    title: "Josh 2026多元記帳本",
    description: "收入、支出、三帳戶、生活費、預算、資產與投資扣款。",
    href: "/josh-os",
    status: "Prototype",
    accent: "#a78bfa",
  },
];

function ProjectCard({ project }) {
  return <a href={project.href} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
    <section style={{ minHeight: 430, borderRadius: 30, overflow: "hidden", background: "linear-gradient(160deg, rgba(15,23,42,.96), rgba(2,6,23,.98))", border: `1px solid ${project.accent}55`, boxShadow: `0 22px 70px ${project.accent}22`, marginBottom: 18 }}>
      <div style={{ minHeight: 210, padding: 26, background: `radial-gradient(circle at 25% 15%, ${project.accent}33, transparent 38%), linear-gradient(135deg, rgba(8,47,73,.55), rgba(2,6,23,.92))`, borderBottom: "1px solid rgba(148,163,184,.16)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span style={{ color: project.accent, letterSpacing: 3, fontWeight: 1000, fontSize: 13 }}>{project.eyebrow}</span>
          <span style={{ color: "#e2e8f0", border: `1px solid ${project.accent}66`, background: `${project.accent}14`, padding: "7px 12px", borderRadius: 999, fontWeight: 950, fontSize: 12 }}>{project.status}</span>
        </div>
        <h2 style={{ color: "#f8fafc", fontSize: 42, lineHeight: 1.05, margin: "48px 0 0", fontWeight: 1000 }}>{project.title}</h2>
      </div>
      <div style={{ padding: 26 }}>
        <p style={{ color: "#cbd5e1", fontSize: 18, lineHeight: 1.55, margin: 0, fontWeight: 850 }}>{project.description}</p>
        <div style={{ marginTop: 30, border: "1px dashed rgba(148,163,184,.35)", borderRadius: 22, padding: "22px 18px", textAlign: "center", color: project.accent, fontSize: 18, fontWeight: 1000 }}>進入專案 →</div>
      </div>
    </section>
  </a>;
}

export default function ProjectPager() {
  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "linear-gradient(180deg,#020617 0%,#07111f 55%,#0f172a 100%)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 430, margin: "0 auto", padding: "24px 16px 34px" }}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ color: "#38bdf8", fontSize: 18, letterSpacing: 4, fontWeight: 1000 }}>Josh 2026 OS</div>
        <h1 style={{ margin: "8px 0 14px", fontSize: 46, lineHeight: 1.02, fontWeight: 1000 }}>Project Pager</h1>
        <div style={{ display: "flex", gap: 10 }}>
          {projects.map((p) => <a key={p.id} href={p.href} style={{ width: 46, height: 46, borderRadius: 999, display: "grid", placeItems: "center", color: "#dbeafe", textDecoration: "none", fontSize: 18, fontWeight: 1000, border: `1px solid ${p.accent}55`, background: "rgba(15,23,42,.78)" }}>{p.id}</a>)}
        </div>
      </header>

      <section style={{ scrollSnapType: "y mandatory" }}>
        {projects.map((project) => <div key={project.id} style={{ scrollSnapAlign: "start" }}><ProjectCard project={project} /></div>)}
      </section>

      <footer style={{ marginTop: 20, color: "#64748b", fontSize: 12, lineHeight: 1.6, fontWeight: 800 }}>
        四合一入口：富邦 DCA、折價獵人、槓桿獵人、Josh 2026多元記帳本。診斷工具保留在文件與系統頁，不放主卡。
      </footer>
    </div>
  </main>;
}
