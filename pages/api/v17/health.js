import { runV17SelfTest } from "../../../lib/v17-self-test";
import { getV17StorageStatus } from "../../../lib/v17-storage";
import { getAssetRegistry } from "../../../lib/v17-asset-registry";

function gate(name, ok, details = {}) {
  return { name, ok: Boolean(ok), details };
}

function hasValue(value) {
  return Boolean(String(value || "").trim());
}

function maskAddress(value) {
  const s = String(value || "").trim();
  if (s.length < 10) return "";
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

function getV17UniverseStatus() {
  const assets = getAssetRegistry().filter((asset) => ["crypto", "tokenized_stock", "tokenized_stock_etf"].includes(asset.assetType));
  const symbols = assets.map((asset) => asset.symbol);
  const btc = assets.find((asset) => asset.symbol === "BTC") || null;
  return {
    count: assets.length,
    expected: 10,
    pass: assets.length === 10 && Boolean(btc),
    symbols,
    btc: {
      included: Boolean(btc),
      referenceMode: btc?.referenceMode || null,
      discountModel: btc?.discountModel || null,
      cycleHigh: btc?.cycleHigh || null,
      cycleHighDate: btc?.cycleHighDate || null,
      updatePolicy: btc?.updatePolicy || null,
      pass: Boolean(btc && btc.referenceMode === "cycle_high" && btc.cycleHigh && btc.cycleHighDate)
    }
  };
}

function getProviderStatus() {
  const walletAddress = process.env.WALLET_ADDRESS || "";
  return {
    binanceExchange: {
      configured: hasValue(process.env.BINANCE_API_KEY) && hasValue(process.env.BINANCE_API_SECRET),
      apiKeyPresent: hasValue(process.env.BINANCE_API_KEY),
      apiSecretPresent: hasValue(process.env.BINANCE_API_SECRET),
      purpose: "BTC spot account read-only sync"
    },
    bscWallet: {
      configured: hasValue(walletAddress),
      walletAddress: maskAddress(walletAddress),
      purpose: "xStocks BSC wallet balanceOf sync"
    }
  };
}

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const selfTest = runV17SelfTest();
  const storage = getV17StorageStatus();
  const universe = getV17UniverseStatus();
  const providers = getProviderStatus();
  const failedTests = selfTest.tests.filter((test) => !test.ok);
  const failedNames = failedTests.map((test) => test.name);
  const productionUnsafe = storage.requiresDurable && !storage.durable;

  const architectureTests = ["engine_values_valid", "strategy_values_valid", "ledger_keys_separated"];
  const decisionTests = [
    "discount_calculation_basic",
    "tier_triggering_basic",
    "signal_deepest_tier_basic",
    "action_queue_deepest_layer",
    "partial_amount_stays_in_queue",
    "complete_leaves_action_queue",
    "missing_price_suspect",
    "layer_mismatch_stays_in_queue",
    "failed_event_returns_queue",
    "skip_current_layer_leaves_queue",
    "deeper_layer_reenters_after_skip",
    "same_state_no_notify",
    "price_change_notify"
  ];

  const gates = [
    gate("G0_scope_lock", true, { note: "V17 release workflow and universe freeze documents exist in repo." }),
    gate("G1_storage_safety", !productionUnsafe, storage),
    gate("G2_architecture_integrity", failedTests.every((test) => !architectureTests.includes(test.name)), { failedTests: failedNames }),
    gate("G3_action_queue_correctness", failedTests.every((test) => !decisionTests.includes(test.name)), { failedTests: failedNames }),
    gate("G4_universe_u10", universe.pass, universe),
    gate("G5_btc_cycle_high", universe.btc.pass, universe.btc),
    gate("G6_provider_visibility", true, providers),
    gate("G7_release_candidate", false, { note: "Not ready. Build test, deployed API test, mobile UI test, and release notes are still pending." }),
    gate("G8_seal_freeze", false, { note: "Not sealed. Binance Exchange sync needs production environment verification before final freeze." })
  ];

  const ok = selfTest.ok && !productionUnsafe && universe.pass && universe.btc.pass;

  return res.status(ok ? 200 : 500).json({
    ok,
    version: "v17-action-queue-v1",
    mode: "health_check",
    checkedAt: new Date().toISOString(),
    storage,
    universe,
    providers,
    selfTestSummary: selfTest.summary,
    gates,
    failedTests,
    nextRequiredActions: [
      "Run this endpoint after deployment.",
      "Run /api/prices and confirm BTC cycleHighDate is present.",
      "Run /api/binance-exchange-position after Vercel env variables are configured.",
      "Run /api/sync-wallet and confirm xStocks wallet holdings still load.",
      "Run mobile UI smoke test before V17 seal."
    ]
  });
}
