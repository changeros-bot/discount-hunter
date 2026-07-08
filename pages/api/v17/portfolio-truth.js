const { fetchSpotAccount } = require("../../../lib/v17/binance-exchange-provider");

const STRATEGY_ASSETS = ["BTC", "QQQON", "NVDAON", "TSMON", "AVGOON", "GOOGLON", "AMDON", "MRVLON", "SPCXON", "RKLBON"];
const WALLET_CASH_TOKENS = [
  { symbol: "USDT", chain: "BSC", contractAddress: "0x55d398326f99059ff775485246999027b3197955", decimals: 18 },
];
const EXCHANGE_CASH_ASSETS = ["USDT"];

function num(value) {
  const n = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function symbolKey(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function holdingValue(holding) {
  return num(holding?.currentValue ?? holding?.marketValue ?? holding?.positionValue ?? holding?.rawCurrentValue ?? holding?.value);
}
function hasAppVerifiableCost(holding) {
  const cost = num(holding?.totalCost ?? holding?.cost ?? holding?.costBasis);
  if (!(cost > 0)) return false;
  if (holding?.costBasisMissing) return false;
  const source = String(holding?.costBasisSource || "");
  return source.includes("transfer_history")
    || source.includes("binance_myTrades")
    || source.includes("verified_tx_hash_receipt");
}
function mergeHoldingsBySymbol(...groups) {
  const map = new Map();
  for (const group of groups || []) {
    for (const holding of group || []) {
      const symbol = symbolKey(holding?.symbol);
      if (!symbol || num(holding?.quantity) <= 0) continue;
      map.set(symbol, { ...holding, symbol });
    }
  }
  return [...map.values()];
}
function strategyHoldingsOnly(holdings) {
  const allowed = new Set(STRATEGY_ASSETS);
  return (holdings || []).filter((h) => allowed.has(symbolKey(h.symbol)) && num(h.quantity) > 0);
}
function portfolioSummary({ wallet, exchange }) {
  const merged = mergeHoldingsBySymbol(wallet?.holdings || [], exchange?.holdings || []);
  const live = strategyHoldingsOnly(merged);
  const known = live.filter(hasAppVerifiableCost);
  const missing = live.filter((h) => !hasAppVerifiableCost(h));
  const totalCost = known.reduce((sum, h) => sum + num(h.totalCost ?? h.cost ?? h.costBasis), 0);
  const currentValue = live.reduce((sum, h) => sum + holdingValue(h), 0);
  const costReady = live.length > 0 && missing.length === 0;
  const pnl = costReady ? currentValue - totalCost : null;
  const pnlPct = costReady && totalCost > 0 ? pnl / totalCost : null;
  const heldSymbols = new Set(live.map((h) => symbolKey(h.symbol)));
  return {
    holdings: live,
    holdingCount: live.length,
    heldSymbols: [...heldSymbols],
    knownCount: known.length,
    missingCount: missing.length,
    missingSymbols: missing.map((h) => h.symbol).filter(Boolean),
    totalCost: costReady ? totalCost : null,
    currentValue,
    pnl,
    pnlPct,
    costReady,
  };
}
function parsePercentValue(value) {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}
function assetModel(asset) {
  const key = symbolKey(asset?.symbol);
  if (key === "BTC") return "Cycle High 回撤";
  if (key.includes("SPCX")) return "上市以來高點回撤";
  return "52週高點回撤";
}
function nextBuyPoint(asset) {
  const currentDepth = Math.abs(parsePercentValue(asset.discount));
  const rules = asset.rules || [];
  const amounts = asset.amounts || [];
  const ruleDepths = rules.map((rule) => Math.abs(parsePercentValue(rule))).filter(Number.isFinite);
  if (!Number.isFinite(currentDepth) || ruleDepths.length === 0) return null;
  let targetIndex = ruleDepths.findIndex((depth) => currentDepth < depth);
  if (targetIndex === -1) targetIndex = ruleDepths.length - 1;
  const previousDepth = targetIndex === 0 ? 0 : ruleDepths[targetIndex - 1];
  const targetDepth = ruleDepths[targetIndex];
  const range = Math.max(1, targetDepth - previousDepth);
  const reached = currentDepth >= targetDepth;
  const progress = reached ? 100 : Math.min(100, Math.max(0, ((currentDepth - previousDepth) / range) * 100));
  return {
    tier: `D${targetIndex + 1}`,
    currentDepth,
    targetDepth,
    remaining: Math.max(0, targetDepth - currentDepth),
    progress,
    reached,
    amount: amounts[targetIndex] || 0,
    model: assetModel(asset),
  };
}
function signalRows(assets, heldSymbols) {
  const held = new Set((heldSymbols || []).map(symbolKey));
  const rows = (assets || []).map((asset) => {
    const symbol = symbolKey(asset.symbol);
    if (!held.has(symbol)) return null;
    const next = nextBuyPoint(asset);
    if (!next) return null;
    return { symbol: asset.symbol, key: symbol, name: asset.name, ...next };
  }).filter(Boolean);
  return {
    reached: rows.filter((r) => r.reached).sort((a, b) => b.targetDepth - a.targetDepth),
    near: rows.filter((r) => !r.reached && r.progress >= 95).sort((a, b) => b.progress - a.progress),
    all: rows,
    suggestedTotal: rows.filter((r) => r.reached || r.progress >= 95).reduce((sum, r) => sum + num(r.amount), 0),
  };
}
function baseUrlFromReq(req) {
  const host = req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${host}`;
}
async function readJsonSafe(response) {
  return response ? response.json().catch(() => ({})) : {};
}
function btcPriceFromPrices(prices) {
  const btc = (prices?.data || []).find((row) => symbolKey(row?.symbol) === "BTC");
  return num(btc?.price);
}
function isEvmAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || "").trim());
}
function padAddress(address) {
  return String(address || "").trim().toLowerCase().replace(/^0x/, "").padStart(64, "0");
}
function formatUnits(raw, decimals) {
  const d = Number.isFinite(Number(decimals)) ? Number(decimals) : 18;
  const base = 10n ** BigInt(d);
  const whole = raw / base;
  const fraction = raw % base;
  const fractionText = fraction.toString().padStart(d, "0").replace(/0+$/, "");
  return Number(`${whole.toString()}${fractionText ? `.${fractionText}` : ""}`);
}
async function rpcCall(url, method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await response.json();
  if (!response.ok || json.error) throw new Error(json.error?.message || `RPC HTTP ${response.status}`);
  return json.result;
}
async function fetchBscBalanceOf(contractAddress, walletAddress, decimals = 18) {
  const urls = [process.env.BSC_RPC_URL, "https://bsc-dataseed.binance.org", "https://bsc-dataseed1.bnbchain.org"].filter(Boolean);
  const data = `0x70a08231${padAddress(walletAddress)}`;
  const errors = [];
  for (const url of urls) {
    try {
      const result = await rpcCall(url, "eth_call", [{ to: contractAddress, data }, "latest"]);
      if (!result || result === "0x") return { quantity: 0, error: "empty_return" };
      return { quantity: formatUnits(BigInt(result), decimals), error: null };
    } catch (error) {
      errors.push(error.message);
    }
  }
  return { quantity: 0, error: errors.join(" | ") || "rpc_error" };
}
async function walletCash() {
  const walletAddress = String(process.env.WALLET_ADDRESS || "").trim();
  if (!isEvmAddress(walletAddress)) return { totalUSDT: 0, items: [], ok: false, error: "invalid_wallet_address" };
  const items = [];
  for (const token of WALLET_CASH_TOKENS) {
    const result = await fetchBscBalanceOf(token.contractAddress, walletAddress, token.decimals);
    items.push({ ...token, quantity: result.quantity, valueUSDT: result.quantity, error: result.error });
  }
  return { ok: true, totalUSDT: items.reduce((sum, x) => sum + num(x.valueUSDT), 0), items };
}
async function exchangeCash() {
  try {
    const account = await fetchSpotAccount();
    const items = EXCHANGE_CASH_ASSETS.map((asset) => {
      const row = (account?.balances || []).find((b) => symbolKey(b.asset) === asset);
      const free = num(row?.free);
      const locked = num(row?.locked);
      return { asset, free, locked, total: free + locked, valueUSDT: free + locked };
    });
    return { ok: true, totalUSDT: items.reduce((sum, x) => sum + num(x.valueUSDT), 0), items };
  } catch (error) {
    return { ok: false, totalUSDT: 0, items: [], error: error.message };
  }
}
function appSummaryFromPortfolio(summary) {
  const missingValue = (summary.holdings || []).filter((h) => !hasAppVerifiableCost(h)).reduce((sum, h) => sum + holdingValue(h), 0);
  return {
    count: summary.holdingCount,
    knownCount: summary.knownCount,
    totalValue: summary.currentValue,
    missingValue,
    totalCostReady: summary.costReady,
    totalCost: summary.totalCost,
    totalPnl: summary.pnl,
    totalPnlPct: summary.pnlPct,
    costMissingCount: summary.missingCount,
    missingSymbols: summary.missingSymbols,
  };
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  try {
    const base = baseUrlFromReq(req);
    const [walletRes, pricesRes] = await Promise.all([
      fetch(`${base}/api/sync-wallet?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}), cache: "no-store" }),
      fetch(`${base}/api/prices?t=${Date.now()}`, { cache: "no-store" }),
    ]);
    const wallet = await readJsonSafe(walletRes);
    const prices = await readJsonSafe(pricesRes);
    const btcPrice = btcPriceFromPrices(prices);
    const exchangeRes = await fetch(`${base}/api/binance-exchange-position?btcPrice=${encodeURIComponent(btcPrice)}&t=${Date.now()}`, { cache: "no-store" }).catch(() => null);
    const exchange = await readJsonSafe(exchangeRes);
    if (!walletRes.ok || !pricesRes.ok || wallet?.ok === false || prices?.ok === false) {
      return res.status(500).json({ ok: false, error: "source_fetch_failed", wallet: wallet?.error || walletRes.status, prices: prices?.error || pricesRes.status });
    }
    const summary = portfolioSummary({ wallet, exchange });
    const signals = signalRows(prices?.data || [], summary.heldSymbols);
    const [walletCashData, exchangeCashData] = await Promise.all([walletCash(), exchangeCash()]);
    const cash = {
      walletUSDT: walletCashData.totalUSDT,
      exchangeUSDT: exchangeCashData.totalUSDT,
      totalUSDT: walletCashData.totalUSDT + exchangeCashData.totalUSDT,
      wallet: walletCashData,
      exchange: exchangeCashData,
      monthlyBudgetTwd: 3000,
      monthlyDcaTwd: 1500,
      monthlyDipTwd: 1500,
    };
    return res.status(200).json({
      ok: true,
      version: "portfolio-truth-v1",
      sourcePolicy: "single_summary_for_app_and_telegram",
      updatedAt: new Date().toISOString(),
      strategyAssets: STRATEGY_ASSETS,
      monitorCount: num(prices?.count) || (prices?.data || []).length,
      summary,
      appSummary: appSummaryFromPortfolio(summary),
      signals,
      cash,
      diagnostics: {
        walletOk: wallet?.ok !== false,
        exchangeConfigured: Boolean(exchange?.configured),
        walletHoldingCount: Array.isArray(wallet?.holdings) ? wallet.holdings.length : 0,
        exchangeHoldingCount: Array.isArray(exchange?.holdings) ? exchange.holdings.length : 0,
        priceCount: (prices?.data || []).length,
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "portfolio truth failed" });
  }
}

module.exports = handler;
