const { XSTOCK_CONTRACTS } = require("../../../lib/xstocks/contracts");

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const WALLET_ADDRESS = process.env.WALLET_ADDRESS || "";
const DEFAULT_ENDPOINTS = [
  "https://bsc-dataseed.binance.org/",
  "https://bsc-dataseed1.binance.org/",
  "https://bsc-dataseed2.binance.org/",
  "https://bsc-dataseed3.binance.org/",
  "https://bsc-rpc.publicnode.com",
];
const STABLE_CONTRACTS = [
  { symbol: "USDT", contractAddress: "0x55d398326f99059ff775485246999027b3197955", decimals: 18 },
  { symbol: "USDC", contractAddress: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", decimals: 18 },
  { symbol: "BUSD", contractAddress: "0xe9e7cea3dedca5984780bafc599bd69add087d56", decimals: 18 },
];

function norm(value) { return String(value || "").trim(); }
function lower(value) { return norm(value).toLowerCase(); }
function safeNumber(value) { const n = Number(value || 0); return Number.isFinite(n) ? n : 0; }
function envList(name) { return norm(process.env[name]).split(",").map(norm).filter(Boolean); }
function getRpcEndpoints() {
  return [...new Set([
    ...envList("PUBLIC_BSC_RPC_URLS"),
    ...envList("BSC_PUBLIC_RPC_URLS"),
    norm(process.env.PUBLIC_BSC_RPC_URL),
    norm(process.env.BSC_PUBLIC_RPC_URL),
    norm(process.env.BSC_RPC_URL),
    ...DEFAULT_ENDPOINTS,
  ].filter(Boolean))];
}
function topicToAddress(topic) { return `0x${String(topic || "").replace(/^0x/, "").slice(24).toLowerCase()}`; }
function amountFromRaw(value, decimals) {
  const raw = BigInt(value || "0x0");
  const scale = 10n ** BigInt(Number(decimals || 18));
  const int = raw / scale;
  const frac = raw % scale;
  return Number(`${int}.${String(frac).padStart(Number(decimals || 18), "0").slice(0, 12)}`);
}
function tokenMetaMap() {
  const map = new Map();
  for (const item of Object.values(XSTOCK_CONTRACTS || {})) {
    map.set(lower(item.contractAddress), { symbol: item.symbol, contractAddress: lower(item.contractAddress), decimals: item.decimals || 18, type: "xstock" });
  }
  for (const item of STABLE_CONTRACTS) map.set(lower(item.contractAddress), { ...item, contractAddress: lower(item.contractAddress), type: "stable" });
  return map;
}
async function rpc(method, params) {
  const errors = [];
  for (const endpoint of getRpcEndpoints()) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
      });
      const text = await response.text();
      const json = JSON.parse(text);
      if (!response.ok || json.error) throw new Error(json.error?.message || `HTTP ${response.status}`);
      return json.result;
    } catch (error) {
      errors.push(`${endpoint}: ${error.message}`);
    }
  }
  throw new Error(errors.join(" | "));
}
async function auditTxHash(txHash, walletAddress) {
  const receipt = await rpc("eth_getTransactionReceipt", [txHash]);
  if (!receipt) return { txHash, status: "NOT_FOUND" };
  const my = lower(walletAddress);
  const meta = tokenMetaMap();
  const rows = [];
  for (const log of receipt.logs || []) {
    if (lower(log.topics?.[0]) !== TRANSFER_TOPIC) continue;
    const token = meta.get(lower(log.address));
    if (!token) continue;
    const from = topicToAddress(log.topics?.[1]);
    const to = topicToAddress(log.topics?.[2]);
    if (from !== my && to !== my) continue;
    rows.push({
      symbol: token.symbol,
      type: token.type,
      direction: to === my ? "IN" : "OUT",
      contractAddress: token.contractAddress,
      from,
      to,
      amount: amountFromRaw(log.data, token.decimals),
      rawValue: String(BigInt(log.data || "0x0")),
    });
  }
  const xstockIn = rows.filter((r) => r.type === "xstock" && r.direction === "IN");
  const stableOut = rows.filter((r) => r.type === "stable" && r.direction === "OUT");
  const officialBuy = xstockIn.length > 0 && stableOut.length > 0;
  return {
    txHash,
    status: officialBuy ? "BUY_PATTERN_FOUND" : rows.length > 0 ? "TRANSFER_FOUND_NO_BUY_PATTERN" : "NO_RELEVANT_TRANSFER_LOGS",
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    officialBuy,
    xstockIn,
    stableOut,
    rows,
    reconstructedCostUsd: stableOut.reduce((sum, r) => sum + safeNumber(r.amount), 0),
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  const walletAddress = norm(req.query.address || req.body?.address || WALLET_ADDRESS);
  const rawHashes = norm(req.query.hashes || req.query.tx || req.body?.hashes || req.body?.tx || "");
  const hashes = rawHashes.split(/[\s,]+/).map(norm).filter(Boolean).filter((h) => /^0x[a-fA-F0-9]{64}$/.test(h));
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) return res.status(400).json({ ok: false, error: "wallet_address_missing_or_invalid" });
  if (hashes.length === 0) return res.status(400).json({ ok: false, error: "tx_hash_required", usage: "/api/v17/tx-source-audit?tx=0x..." });
  try {
    const results = [];
    for (const hash of hashes) results.push(await auditTxHash(hash, walletAddress));
    return res.status(200).json({
      ok: true,
      checkedAt: new Date().toISOString(),
      walletAddress: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      sourceRule: "stablecoin OUT + xStock IN in the same tx hash = verified BUY source",
      results,
      totalReconstructedCostUsd: results.reduce((sum, r) => sum + safeNumber(r.reconstructedCostUsd), 0),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "tx_source_audit_failed" });
  }
}
