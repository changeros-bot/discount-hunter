import { useEffect, useMemo, useState } from "react";

const TX_KEY = "josh-financial-os-v36-db";
const OLD_TX_KEY = "josh-financial-os-v32-tx";
const BUDGET_KEY = "josh-financial-os-v38-budgets";
const ASSET_KEY = "josh-ledger-v42-assets";
const MIGRATION_KEY = "josh-financial-os-neon-migration-v1";

function readArray(key, fallbackKey = "") {
  try {
    const raw = localStorage.getItem(key) || (fallbackKey ? localStorage.getItem(fallbackKey) : "") || "[]";
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function downloadBackup(payload) {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...payload }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `josh-financial-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const box = {
  background: "linear-gradient(160deg,rgba(17,24,39,.98),rgba(15,23,42,.98))",
  border: "1px solid rgba(34,197,94,.38)",
  borderRadius: 22,
  padding: 16,
  marginBottom: 12,
};

export default function FinancialMigrate() {
  const [payload, setPayload] = useState({ transactions: [], budgets: [], assets: [] });
  const [status, setStatus] = useState({ state: "loading", message: "讀取手機 Local DB…" });
  const [result, setResult] = useState(null);

  useEffect(() => {
    const data = {
      transactions: readArray(TX_KEY, OLD_TX_KEY),
      budgets: readArray(BUDGET_KEY),
      assets: readArray(ASSET_KEY),
    };
    setPayload(data);
    let prior = null;
    try { prior = JSON.parse(localStorage.getItem(MIGRATION_KEY) || "null"); } catch {}
    setResult(prior);
    setStatus({ state: "ready", message: prior?.ok ? "曾完成轉移；可再次安全同步最新資料。" : "資料已讀取，尚未上傳。" });
  }, []);

  const total = useMemo(() => payload.transactions.length + payload.budgets.length + payload.assets.length, [payload]);

  async function migrate() {
    if (!total) {
      setStatus({ state: "error", message: "這個瀏覽器沒有找到可轉移的資料。請用原本記帳的手機與瀏覽器開啟。" });
      return;
    }
    setStatus({ state: "working", message: "正在建立雲端備份、寫入資料並核對筆數…" });
    try {
      const response = await fetch("/api/financial/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${response.status}`);
      const uploaded = json.migration?.uploaded || {};
      const verified = uploaded.transactions === payload.transactions.length && uploaded.budgets === payload.budgets.length && uploaded.assets === payload.assets.length && json.migration?.backupStored === true;
      if (!verified) throw new Error("server_count_verification_failed");
      const receipt = { ok: true, migratedAt: new Date().toISOString(), ...json.migration };
      localStorage.setItem(MIGRATION_KEY, JSON.stringify(receipt));
      setResult(receipt);
      setStatus({ state: "done", message: "安全轉移完成：雲端原始備份與正式資料均已寫入並核對。手機資料仍保留。" });
    } catch (error) {
      setStatus({ state: "error", message: `轉移失敗：${error.message || "unknown_error"}。本機資料沒有刪除。` });
    }
  }

  const color = status.state === "done" ? "#86efac" : status.state === "error" ? "#fca5a5" : "#bae6fd";

  return <main style={{ minHeight: "100vh", color: "#f8fafc", background: "radial-gradient(circle at 50% -10%,rgba(34,197,94,.18),transparent 30%),linear-gradient(180deg,#020617,#0f172a)", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ maxWidth: 430, margin: "0 auto", padding: "20px 14px 70px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 24, fontWeight: 1000 }}>多元記帳本安全轉移</div>
        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 5, fontWeight: 800 }}>Local DB → Neon PostgreSQL｜先備份、再寫入、後核對、不刪本機</div>
      </div>

      <section style={box}>
        <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>本機待轉移資料</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 }}>
          {[["交易", payload.transactions.length], ["預算", payload.budgets.length], ["資產", payload.assets.length]].map(([label, value]) => <div key={label} style={{ padding: 12, borderRadius: 14, background: "rgba(2,6,23,.65)", textAlign: "center", border: "1px solid rgba(148,163,184,.16)" }}><div style={{ color: "#94a3b8", fontSize: 11 }}>{label}</div><div style={{ fontSize: 25, fontWeight: 1000, marginTop: 3 }}>{value}</div></div>)}
        </div>
      </section>

      <section style={{ ...box, borderColor: status.state === "error" ? "rgba(248,113,113,.5)" : "rgba(56,189,248,.38)" }}>
        <div style={{ color, fontWeight: 950, lineHeight: 1.65 }}>{status.message}</div>
        {result?.batchId && <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 8, wordBreak: "break-all" }}>轉移批次：{result.batchId}<br />時間：{result.migratedAt || "—"}</div>}
      </section>

      <section style={box}>
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>安全措施</div>
        <div style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.8 }}>
          ① 上傳前可下載 JSON 備份<br />
          ② Neon 另外保存完整原始 payload 備份<br />
          ③ 交易、預算、資產以原始 ID 冪等 upsert，不會重複灌入<br />
          ④ 回傳筆數必須與手機資料一致才判定成功<br />
          ⑤ 成功後仍不刪除 localStorage，待雲端讀寫完成後再決定切換
        </div>
      </section>

      <div style={{ display: "grid", gap: 10 }}>
        <button onClick={() => downloadBackup(payload)} disabled={!total} style={{ border: "1px solid rgba(56,189,248,.55)", borderRadius: 15, padding: 13, background: "rgba(14,116,144,.20)", color: "#bae6fd", fontWeight: 1000 }}>先下載本機 JSON 備份</button>
        <button onClick={migrate} disabled={status.state === "working" || !total} style={{ border: "1px solid rgba(34,197,94,.62)", borderRadius: 15, padding: 14, background: "linear-gradient(180deg,rgba(34,197,94,.28),rgba(20,83,45,.68))", color: "#dcfce7", fontWeight: 1000 }}>{status.state === "working" ? "轉移中，請勿關閉…" : result?.ok ? "再次同步最新資料" : "開始安全轉移"}</button>
        <a href="/financial-os" style={{ textAlign: "center", textDecoration: "none", border: "1px solid rgba(148,163,184,.28)", borderRadius: 15, padding: 12, color: "#cbd5e1", fontWeight: 900 }}>返回多元記帳本</a>
      </div>
    </div>
  </main>;
}
