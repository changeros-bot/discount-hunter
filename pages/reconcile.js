import { useState } from "react";

async function readJsonOrThrow(response, label) {
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) {
    throw new Error(`${label}_failed:${data?.error || data?.message || response.status}`);
  }
  return data;
}

function nonEmptyArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label}_empty`);
  }
  return value;
}

export default function Reconcile() {
  const [text, setText] = useState("尚未執行");

  async function run() {
    setText("對帳中...");
    try {
      const pricesRes = await fetch("/api/prices?t=" + Date.now(), { cache: "no-store" });
      const prices = await readJsonOrThrow(pricesRes, "prices");
      const assets = nonEmptyArray(prices.data, "prices_data");

      const walletRes = await fetch("/api/sync-wallet?t=" + Date.now(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const wallet = await readJsonOrThrow(walletRes, "wallet");
      const holdings = nonEmptyArray(wallet.holdings, "wallet_holdings");

      const res = await fetch("/api/reconcile-tiers?t=" + Date.now(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets, holdings })
      });
      const data = await readJsonOrThrow(res, "reconcile_tiers");
      setText(JSON.stringify(data, null, 2));
    } catch (e) {
      setText(e.message || "error");
    }
  }

  return <main style={{ minHeight: "100vh", background: "#020617", color: "white", padding: 16 }}>
    <h1>Ledger 對帳補登</h1>
    <button onClick={run} style={{ padding: 14, width: "100%" }}>開始對帳補登</button>
    <pre style={{ whiteSpace: "pre-wrap", marginTop: 16 }}>{text}</pre>
  </main>;
}
