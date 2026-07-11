import { runAutoPaperTrading } from "../../../lib/v17-paper-engine";

const FALLBACK_MARKETS = {
  NOW: {
    price: 100,
    high52w: 100,
    discount: 0,
    source: "paper_fallback_price_market45",
  },
  QCOM: {
    price: 100,
    high52w: 100,
    discount: 0,
    source: "paper_fallback_price_market45",
  },
  DELL: {
    price: 100,
    high52w: 100,
    discount: 0,
    source: "paper_fallback_price_market45",
  },
  REGN: {
    price: 100,
    high52w: 100,
    discount: 0,
    source: "paper_fallback_price_market45",
  },
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }
    const body = req.method === "POST" ? (req.body || {}) : {};
    const markets = { ...FALLBACK_MARKETS, ...(body.markets || {}) };
    const result = await runAutoPaperTrading({ markets, force: body.force === true });
    return res.status(200).json({
      ...result,
      fallbackMarketsUsed: Object.keys(FALLBACK_MARKETS),
      fallbackNote: "Market45 紙上候選若沒有即時價格，先用 100U 基準價建倉，只用來驗證流程與 7 天追蹤；不代表真實價格。",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "paper_auto_run_failed" });
  }
}
