import V17Dashboard from "../pages/v17";
import FubonDcaDashboard from "./FubonDcaDashboard";
import LeveragedHunterDashboard from "./LeveragedHunterDashboard";

const projects = [
  {
    key: "discount-hunter",
    title: "DCA 折價獵人",
    status: "V17.1 Active",
    description: "BTC + xStocks 折價買點、Action Queue、持倉與成本。",
    component: <V17Dashboard />
  },
  {
    key: "fubon-dca",
    title: "富邦長期台美股 DCA",
    status: "Core Engine",
    description: "0050 / VOO / QQQM 長期定期定額。",
    component: <FubonDcaDashboard />
  },
  {
    key: "leveraged-hunter",
    title: "槓桿獵人",
    status: "Tactical Engine",
    description: "高風險槓桿 ETF，只做獨立風控。",
    component: <LeveragedHunterDashboard />
  },
  {
    key: "josh-financial-os",
    title: "Josh Financial OS",
    status: "Coming Soon",
    description: "收入、支出、家庭現金流與資產總覽。"
  }
];

function PlaceholderProject({ project }) {
  return (
    <div className="pager-placeholder">
      <span>{project.status}</span>
      <h2>{project.title}</h2>
      <p>{project.description}</p>
      <div className="pager-placeholder-box">Coming Soon</div>
    </div>
  );
}

export default function ProjectPagerShell() {
  return (
    <main className="pager-app">
      <header className="pager-top">
        <p>Josh Investment OS</p>
        <h1>Project Pager</h1>

        <div className="pager-dots">
          {projects.map((project, index) => (
            <a
              key={project.key}
              href={`#${project.key}`}
              aria-label={project.title}
            >
              {index + 1}
            </a>
          ))}
        </div>
      </header>

      <section className="pager-track">
        {projects.map((project) => (
          <section
            key={project.key}
            id={project.key}
            className="pager-screen"
          >
            <div className="pager-card">
              <div className="pager-card-head">
                <span>{project.status}</span>
                <h2>{project.title}</h2>
                <p>{project.description}</p>
              </div>

              <div className="pager-card-body">
                {project.component
                  ? project.component
                  : <PlaceholderProject project={project} />}
              </div>
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}
