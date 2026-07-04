const modules = [
  {
    key: "discount-hunter",
    name: "DCA 折價獵人",
    route: "/v17",
    status: "LIVE",
    health: "PASS",
    note: "V17.1 sealed. Snapshot-first. Do not change core data flow."
  },
  {
    key: "leveraged-hunter",
    name: "槓桿獵人",
    route: "/leveraged-hunter",
    status: "DRAFT",
    health: "PLANNING",
    note: "Independent 00631L diagnostic module. Not part of V17.1 universe."
  },
  {
    key: "financial-os",
    name: "Josh Financial OS",
    route: "/financial-os",
    status: "LIVE",
    health: "PROTOTYPE",
    note: "Multi-account ledger prototype with invoice sync skeleton and confirmation flow."
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
