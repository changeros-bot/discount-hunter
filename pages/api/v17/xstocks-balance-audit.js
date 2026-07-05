const { fetchWalletBalancesViaRpc } = require("../../../lib/xstocks/rpcBalances");
const { WATCHLIST } = require("../../../lib/xstocks/constants");

function cleanAddress(value) { return String(value || "").trim(); }
function maskAddress(address) { const a = cleanAddress(address); return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : ""; }
function upper(value) { return String(value || "").trim().toUpperCase(); }
function normalizeSymbol(symbol) { const s = upper(symbol); return s.endsWith("ON") ? s : `${s}ON`; }
function safeNumber(value) { const n = Number(value || 0); return Number.isFinite(n) ? n : 0; }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  const walletAddress = cleanAddress(process.env.WALLET_ADDRESS);
  const expectedSymbols = WATCHLIST.map(normalizeSymbol);
  try {
    const result = await fetchWalletBalancesViaRpc(walletAddress, WATCHLIST, []);
    const positiveHoldings = (result.holdings || []).filter((h) => safeNumber(h.quantity) > 0).map((h) => normalizeSymbol(h.symbol));
    const contractDiagnostics = (result.contractHoldings || []).map((h) => ({
      symbol: normalizeSymbol(h.symbol),
      quantity: h.quantity === null || h.quantity === undefined ? null : safeNumber(h.quantity),
      rawBalance: h.rawBalance || null,
      isZeroBalance: Boolean(h.isZeroBalance),
      callStatus: h.callStatus || null,
      errorMessage: h.errorMessage || null,
      contractAddress: h.contractAddress || null,
      source: h.source || null,
      decimals: h.decimals || null,
    }));
    const checkedSymbols = [...new Set(contractDiagnostics.map((h) => h.symbol).filter(Boolean))];
    const zeroBalanceSymbols = [...new Set(contractDiagnostics.filter((h) => h.callStatus === "ok" && safeNumber(h.quantity) <= 0).map((h) => h.symbol))];
    const rpcErrorSymbols = [...new Set(contractDiagnostics.filter((h) => h.callStatus && h.callStatus !== "ok").map((h) => h.symbol))];
    const missingCheckedSymbols = expectedSymbols.filter((s) => !checkedSymbols.includes(s));
    const missingPositiveSymbols = expectedSymbols.filter((s) => !positiveHoldings.includes(s));
    return res.status(200).json({
      ok: true,
      checkedAt: new Date().toISOString(),
      walletAddress: maskAddress(walletAddress),
      expectedSymbolCount: expectedSymbols.length,
      expectedSymbols,
      checkedSymbolCount: checkedSymbols.length,
      checkedSymbols,
      positiveSymbolCount: positiveHoldings.length,
      positiveHoldings,
      missingPositiveSymbols,
      zeroBalanceSymbols,
      rpcErrorSymbols,
      missingCheckedSymbols,
      amdon: contractDiagnostics.filter((h) => h.symbol === "AMDON"),
      contractDiagnostics,
      balanceErrors: result.errors || [],
      checkedBlockNumber: result.checkedBlockNumber || null,
      verdict: missingCheckedSymbols.length || rpcErrorSymbols.length ? "BALANCE_SCAN_INCOMPLETE" : missingPositiveSymbols.length ? "ALL_CHECKED_BUT_SOME_ZERO_BALANCE" : "ALL_EXPECTED_POSITIVE",
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || String(error), walletAddress: maskAddress(walletAddress), expectedSymbols });
  }
}
