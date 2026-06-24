import { useState } from "react";

export default function Reconcile() {
  const [text, setText] = useState("尚未執行");

  async function run() {
    setText("對帳中...");
    try {
      const pricesRes = await fetch("/api/prices?t=" + Date.now(), { cache: "no-store" });
      const prices = await pricesRes.json();
      const walletRes = await fetch("/api/sync-wallet?t=" + Date.now(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const wallet = await walletRes.json();
      const res = await fetch("/api/reconcile-ledger?t=" + Date.now(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: prices.data || [], holdings: wallet.holdings || [] })
      });
      const data = await res.json();
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
