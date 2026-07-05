const WALLET = "0x657f5cbBC1FBE274299a6be52b5e46C3C6a9AD76";
const AMDON = "0x9f16e46c73b43bdb70861247d537bee4ae18f639";
const AMDON_BUY_BLOCK = 104486913;
const RPC_URLS = [
  process.env.BSC_RPC_URL,
  process.env.NEXT_PUBLIC_BSC_RPC_URL,
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.bnbchain.org",
  "https://bsc-dataseed2.bnbchain.org",
].filter(Boolean);

function cleanAddress(value) { return String(value || "").trim().toLowerCase(); }
function padAddress(address) {
  const clean = cleanAddress(address).replace(/^0x/, "");
  if (clean.length !== 40) throw new Error(`Invalid address: ${address}`);
  return clean.padStart(64, "0");
}
function hexToBigInt(hex) {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}
function formatUnits(raw, decimals = 18) {
  const d = Number(decimals || 18);
  const base = 10n ** BigInt(d);
  const whole = raw / base;
  const fraction = raw % base;
  const fractionText = fraction.toString().padStart(d, "0").replace(/0+$/, "");
  return `${whole.toString()}${fractionText ? `.${fractionText}` : ""}`;
}
function hexBlock(blockNumber) {
  if (blockNumber === "latest") return "latest";
  return `0x${Number(blockNumber).toString(16)}`;
}
function decodeStringResult(hex) {
  try {
    if (!hex || hex === "0x") return "";
    const clean = hex.replace(/^0x/, "");
    const buf = Buffer.from(clean, "hex");
    const text = buf.toString("utf8").replace(/\u0000/g, "").trim();
    return text;
  } catch {
    return "";
  }
}
async function rpc(url, method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`non-json ${text.slice(0, 180)}`); }
  if (!response.ok || json.error) throw new Error(json.error?.message || `HTTP ${response.status}`);
  return json.result;
}
async function tryRpc(method, params) {
  const attempts = [];
  for (const url of RPC_URLS) {
    try {
      const result = await rpc(url, method, params);
      return { ok: true, url, result, attempts };
    } catch (error) {
      attempts.push({ url, error: error.message || String(error) });
    }
  }
  return { ok: false, url: null, result: null, attempts };
}
async function ethCall(to, data, block = "latest") {
  return tryRpc("eth_call", [{ to: cleanAddress(to), data }, hexBlock(block)]);
}
async function balanceAt(block) {
  const data = `0x70a08231${padAddress(WALLET)}`;
  const call = await ethCall(AMDON, data, block);
  const raw = call.result ? hexToBigInt(call.result) : 0n;
  return {
    block,
    blockParam: hexBlock(block),
    callData: data,
    ok: call.ok,
    rpcUrl: call.url,
    rawResult: call.result,
    rawBalance: raw.toString(),
    quantity18: formatUnits(raw, 18),
    attempts: call.attempts,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  try {
    const code = await tryRpc("eth_getCode", [cleanAddress(AMDON), "latest"]);
    const latestBlock = await tryRpc("eth_blockNumber", []);
    const decimalsCall = await ethCall(AMDON, "0x313ce567", "latest");
    const symbolCall = await ethCall(AMDON, "0x95d89b41", "latest");
    const decimals = decimalsCall.result ? Number.parseInt(decimalsCall.result, 16) : 18;
    const latestBalance = await balanceAt("latest");
    const buyBlockBalance = await balanceAt(AMDON_BUY_BLOCK);
    const afterBuyBlockBalance = await balanceAt(AMDON_BUY_BLOCK + 1);
    const oldBlockBalance = await balanceAt(104486920);

    return res.status(200).json({
      ok: true,
      checkedAt: new Date().toISOString(),
      wallet: WALLET,
      amdonContract: AMDON,
      knownBuyTx: "0x85f9f3edf7776e52999a9aa7a873db6c48ff54904ccaab2ba36c46cfdcf74d17",
      knownBuyBlock: AMDON_BUY_BLOCK,
      currentBlockHex: latestBlock.result,
      currentBlockNumber: latestBlock.result ? Number.parseInt(latestBlock.result, 16) : null,
      contractCodeExists: Boolean(code.result && code.result !== "0x"),
      contractCodeSample: code.result ? `${code.result.slice(0, 20)}...${code.result.slice(-20)}` : null,
      decimals: Number.isFinite(decimals) ? decimals : 18,
      decimalsRaw: decimalsCall.result,
      symbolRaw: symbolCall.result,
      symbolDecodedBestEffort: decodeStringResult(symbolCall.result),
      latestBalance,
      buyBlockBalance,
      afterBuyBlockBalance,
      oldBlockBalance,
      interpretation: {
        ifLatestZeroButAfterBuyPositive: "AMDon was later transferred/redeemed away from this wallet, or current positive holding is not at this contract/address pair.",
        ifAllZero: "This RPC balanceOf path does not match the BscScan asset display; check contract route/address, proxy wrapper, or BscScan indexed asset source.",
        ifLatestPositive: "sync-wallet aggregation/filtering is the culprit, not balanceOf.",
      }
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || String(error), wallet: WALLET, amdonContract: AMDON });
  }
}
