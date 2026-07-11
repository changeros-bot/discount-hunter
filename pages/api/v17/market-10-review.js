import { getMarket10Review } from "../../../lib/v17-market-10-discount-candidates";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  return res.status(200).json(getMarket10Review());
}
