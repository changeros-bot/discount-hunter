import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

function parsePercentValue(value) {
  const number = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : NaN;
}

function getNextBuyPoint(asset) {
  const currentDepth = Math.abs(parsePercentValue(asset.discount));
  const rules = asset.rules || [];
  const amounts = asset.amounts || [];
  const ruleDepths = rules.map((rule) => Math.abs(parsePercentValue(rule))).filter(Number.isFinite);

  if (!Number.isFinite(currentDepth) || ruleDepths.length === 0) {
    return null;
  }

  let targetIndex = ruleDepths.findIndex((depth) => currentDepth < depth);
  if (targetIndex === -1) targetIndex = ruleDepths.length - 1;

  const previousDepth = targetIndex === 0 ? 0 : ruleDepths[targetIndex - 1];
  const targetDepth = ruleDepths[targetIndex];
  const range = Math.max(1, targetDepth - previousDepth);
  const rawProgress = ((currentDepth - previousDepth) / range) * 100;
  const progress = currentDepth >= targetDepth ? 100 : Math.min(100, Math.max(0, rawProgress));
  const remaining = Math.max(0, targetDepth - currentDepth);

  return {
    currentDepth,
    targetDepth,
    progress,
    remaining,
    targetAmount: amounts[targetIndex] || 0,
    level: targetIndex + 1,
  };
}

function getAlertLevel(remaining) {
  if (remaining <= 1) return { label: "即將觸發", icon: "🟢", className: "hot" };
  if (remaining <= 5) return { label: "接近買點", icon: "🟡", className: "warm" };
  return { label: "觀察", icon: "⚪", className: "idle" };
}

export default function BuyPointAlertPortal() {
  const [target, setTarget] = useState(null);
  const [assets, setAssets] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    function ensureTarget() {
      const observation = Array.from(document.querySelectorAll("details"))
        .find((node) => (node.textContent || "").includes("觀察區"));
      if (!observation) return;

      let mount = document.getElementById("buy-point-alert-anchor");
      if (!mount) {
        mount = document.createElement("div");
        mount.id = "buy-point-alert-anchor";
        observation.parentNode.insertBefore(mount, observation);
      }
      setTarget(mount);
    }

    ensureTarget();
    const timer = setInterval(ensureTarget, 1200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadAlerts() {
      try {
        const res = await fetch(`/api/prices?t=${Date.now()}`, { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        if (!res.ok) throw new Error(data.error || "買點警報讀取失敗");
        setAssets(data.data || []);
      } catch (err) {
        if (!active) return;
        setError(err.message || "買點警報讀取失敗");
      }
    }

    loadAlerts();
    const timer = setInterval(loadAlerts, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const rows = useMemo(() => {
    return (assets || [])
      .map((asset) => {
        const next = getNextBuyPoint(asset);
        if (!next) return null;
        const alert = getAlertLevel(next.remaining);
        return {
          symbol: asset.symbol,
          discount: asset.discount,
          ...next,
          ...alert,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.remaining - b.remaining)
      .slice(0, 6);
  }, [assets]);

  if (!target) return null;

  return createPortal(
    <details className="buyAlertBox">
      <summary>🔔 買點警報（{rows.length}）</summary>
      <div className="buyAlertContent">
        {error && <div className="buyAlertMessage">⚠️ {error}</div>}
        {!error && rows.length === 0 && <div className="buyAlertMessage">目前無買點警報</div>}
        {rows.map((row) => <div className={`buyAlertRow ${row.className}`} key={row.symbol}>
          <div className="buyAlertTop">
            <strong>{row.icon} {row.symbol}</strong>
            <span>{row.label}</span>
          </div>
          <div className="buyAlertMeta">
            <span>目前深度 {row.currentDepth.toFixed(1)}%</span>
            <span>下一層 {row.targetDepth.toFixed(1)}%</span>
            <span>還差 {row.remaining.toFixed(1)}%</span>
            <span>建議 {row.targetAmount}U</span>
          </div>
          <div className="buyAlertTrack">
            <div className="buyAlertFill" style={{ width: `${Math.max(4, Math.min(100, row.progress))}%` }} />
          </div>
          <div className="buyAlertProgress">進度 {row.progress.toFixed(0)}%</div>
        </div>)}
      </div>
    </details>,
    target
  );
}
