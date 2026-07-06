const modules = [
  {
    key: "discount-hunter",
    name: "DCA 折價獵人",
    route: "/v17",
    status: "LIVE",
    health: "V18_READY_FOR_REVIEW",
    note: "App V17.1 live. Active Playbook is Josh Portfolio V18.0 at docs/V18_DISCOUNT_HUNTER_PLAYBOOK.md. V18.1 backtests pending. V19 is future draft only."
  },
  {
    key: "leveraged-hunter",
    name: "槓桿獵人",
    route: "/leveraged-hunter",
    status: "DRAFT",
    health: "PLANNING",
    note: "Independent 00631L diagnostic module. Not part of Discount Hunter V18 engine."
  },
  {
    key: "financial-os",
    name: "Josh 2026多元記帳本",
    route: "/financial-os",
    status: "LIVE",
    health: "V4.4_LOCAL_DB",
    note: "多元記帳本 V4.4: income, expenses, budgets, living cost, manual assets, education category, and safe edit/delete."
  },
  {
    key: "fubon-dca",
    name: "富邦長期 DCA",
    route: "/fubon-dca",
    status: "SEALED",
    health: "MANUAL_CHECK",
    note: "Long-term core DCA plan. Monthly execution check only."
  }
];

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  return res.status(200).json({
    ok: true,
    registryVersion: "Josh Portfolio V18.0",
    appVersion: "Discount Hunter V17.1",
    playbook: "docs/V18_DISCOUNT_HUNTER_PLAYBOOK.md",
    futureDraft: "docs/V19_DISCOUNT_HUNTER_PLAYBOOK.md",
    updatedAt: new Date().toISOString(),
    summary: {
      total: modules.length,
      live: modules.filter((m) => m.status === "LIVE").length,
      sealed: modules.filter((m) => m.status === "SEALED").length,
      draft: modules.filter((m) => m.status === "DRAFT").length
    },
    modules
  });
}
