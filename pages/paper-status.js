import { useEffect } from "react";
import PaperAutoPage, { getServerSideProps as getPaperProps } from "./paper-auto";
import { ASSET_REGISTRY } from "../lib/v17-asset-registry";
import { getAllPaperDiscountRules } from "../lib/v17-paper-discount-rules";

function norm(symbol) { return String(symbol || "").trim().toUpperCase().replace(/ON$/, ""); }
function n(value, digits = 2) { const x = Number(value || 0); return Number.isFinite(x) ? x.toFixed(digits) : "0.00"; }
function esc(value) { return String(value ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
function strategyLabel(value) {
  return ({ dca_discount: "DCA＋折價加碼", discount_only: "只在折價層級買入", pure_dca: "純定投", trend: "趨勢策略", swing: "波段策略" }[value]) || value || "紙上折價驗證";
}
function enrichPosition(row, preparedRules) {
  const core = ASSET_REGISTRY.find((asset) => norm(asset.symbol) === norm(row.symbol));
  const prepared = preparedRules[norm(row.symbol)] || null;
  const source = core || prepared || {};
  const rules = Array.isArray(source.rules) ? source.rules : (row.rules || []);
  const amounts = Array.isArray(source.amounts) ? source.amounts : [];
  const discount = Math.abs(Number(row.discountFromHighPct || row.highProgress?.discountFromHighPct || 0));
  const currentPrice = Number(row.currentPrice || row.price || 0);
  const derivedHigh = discount < 100 && currentPrice > 0 ? currentPrice / (1 - discount / 100) : 0;
  return {
    ...row,
    rules,
    amounts,
    strategy: core?.strategy || "paper_discount",
    strategyLabel: strategyLabel(core?.strategy),
    description: core?.description || prepared?.note || row.name || "紙上折價驗證",
    conviction: core?.conviction || "Paper",
    ruleNote: prepared?.note || core?.backtestConclusion || core?.reEvaluateTrigger || "僅供紙上驗證，禁止自動轉真倉。",
    highProgress: row.highProgress?.enabled ? row.highProgress : { enabled: true, progressPct: 100 - discount, currentPrice, high52w: derivedHigh, discountFromHighPct: -discount },
  };
}
function tierInfo(row) {
  const rules = (row.rules || []).map((x) => Math.abs(Number(x))).filter(Number.isFinite);
  const discount = Math.abs(Number(row.discountFromHighPct ?? row.highProgress?.discountFromHighPct ?? 0));
  let idx = -1;
  rules.forEach((x, i) => { if (discount >= x) idx = i; });
  const prev = idx >= 0 ? rules[idx] : 0;
  const next = idx + 1 < rules.length ? rules[idx + 1] : (rules[idx] || rules[0] || 100);
  const pct = idx >= rules.length - 1 && rules.length ? 100 : Math.max(2, Math.min(98, next > prev ? ((discount - prev) / (next - prev)) * 100 : 100));
  return { idx, discount, pct, current: idx >= 0 ? `D${idx + 1}` : "D1", next: idx + 1 < rules.length ? `D${idx + 2}` : "MAX", label: idx >= 0 ? `已完成：D${idx + 1}` : "尚未到達：D1" };
}

export async function getServerSideProps(ctx) {
  const result = await getPaperProps(ctx);
  const props = result?.props || {};
  const preparedRules = getAllPaperDiscountRules();
  const positions = Array.isArray(props.initialSummary?.positions) ? props.initialSummary.positions.map((row) => enrichPosition(row, preparedRules)) : [];
  return { ...result, props: { ...props, initialSummary: props.initialSummary ? { ...props.initialSummary, positions } : props.initialSummary } };
}

function V17CardSkin({ rows = [] }) {
  useEffect(() => {
    const map = new Map(rows.map((row) => [String(row.symbol || "").toUpperCase(), row]));
    const cards = Array.from(document.querySelectorAll("main div")).filter((el) => {
      if (el.dataset?.v17PaperSkin === "1") return false;
      const symbol = String(el.firstElementChild?.firstElementChild?.firstElementChild?.textContent || "").trim().toUpperCase();
      return map.has(symbol);
    });
    for (const card of cards) {
      const symbol = String(card.firstElementChild?.firstElementChild?.firstElementChild?.textContent || "").trim().toUpperCase();
      const row = map.get(symbol);
      if (!row) continue;
      const t = tierInfo(row);
      const pnl = Number(row.pnl || 0);
      const pnlPct = Number(row.pnlPct || 0) * 100;
      const rules = row.rules || [];
      const amounts = row.amounts || [];
      const hp = row.highProgress || {};
      const tierCards = rules.map((rule, i) => {
        const active = t.idx === i;
        const done = t.idx >= i;
        return `<div style="flex:1;min-width:0;padding:9px 4px;border-radius:13px;text-align:center;border:1px solid ${active ? "rgba(34,211,238,.65)" : "rgba(148,163,184,.18)"};background:${active ? "rgba(8,145,178,.22)" : done ? "rgba(15,118,110,.12)" : "rgba(2,6,23,.35)"};box-shadow:${active ? "0 0 18px rgba(34,211,238,.22)" : "none"}"><div style="font-weight:1000;color:${active ? "#67e8f9" : "#cbd5e1"}">D${i + 1}</div><div style="font-size:11px;color:#94a3b8">${esc(rule)}%</div><div style="font-size:10px;color:#fde68a">${esc(amounts[i] ?? 5)}U</div></div>`;
      }).join("");
      card.style.padding = "13px";
      card.style.borderRadius = "22px";
      card.style.background = "linear-gradient(180deg,rgba(6,78,59,.28),rgba(2,6,23,.82))";
      card.style.border = "1px solid rgba(34,197,94,.28)";
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div><div style="display:flex;align-items:center;gap:8px"><span style="width:12px;height:12px;border-radius:50%;background:#34d399;box-shadow:0 0 14px #34d399"></span><strong style="font-size:22px;color:#f8fafc">${esc(row.symbol)}</strong></div><div style="margin-left:20px;color:#94a3b8;font-size:12px;font-weight:850">${esc(row.name || "—")}</div></div>
          <div style="padding:6px 10px;border-radius:999px;border:1px solid rgba(250,204,21,.35);color:#fde68a;background:rgba(120,53,15,.16);font-weight:1000">${esc(t.current)}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;margin-top:12px;border:1px solid rgba(59,130,246,.18);border-radius:15px;overflow:hidden;background:rgba(2,6,23,.48)">
          ${[["現價",`$${n(row.currentPrice)}`],["高點",`$${n(hp.high52w)}`],["數量",n(row.quantity,4)],["成本",`$${n(row.amountUSDT)}`],["市值",`$${n(row.currentValue)}`],["損益",`$${n(pnl)}`],["報酬率",`${n(pnlPct)}%`],["距52週高點降低",`${n(Math.abs(Number(row.discountFromHighPct || 0)),1)}%`]].map(([k,v],i)=>`<div style="padding:11px;border-right:${i%2===0?"1px solid rgba(59,130,246,.16)":"0"};border-bottom:${i<6?"1px solid rgba(59,130,246,.12)":"0"}"><div style="font-size:10px;color:#7dd3fc;font-weight:900">${k}</div><div style="margin-top:3px;color:${k==="損益"||k==="報酬率"?(pnl>=0?"#86efac":"#fb7185"):"#f8fafc"};font-size:15px;font-weight:1000">${v}</div></div>`).join("")}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:10px"><span style="padding:5px 9px;border-radius:999px;background:rgba(8,145,178,.16);border:1px solid rgba(34,211,238,.22);color:#67e8f9;font-size:11px;font-weight:900">${esc(row.description)}</span><span style="padding:5px 9px;border-radius:999px;background:rgba(120,53,15,.18);border:1px solid rgba(250,204,21,.22);color:#fde68a;font-size:11px;font-weight:900">Quality：${esc(row.conviction || "Paper")}</span><span style="padding:5px 9px;border-radius:999px;background:rgba(30,41,59,.7);color:#cbd5e1;font-size:11px;font-weight:900">紙上交易</span></div>
        <div style="margin-top:10px;padding:11px;border-radius:13px;background:rgba(16,185,129,.12);border:1px solid rgba(34,197,94,.18);color:#bbf7d0;font-size:17px;font-weight:1000">${esc(t.label)}</div>
        <div style="margin-top:9px;padding:11px;border-radius:15px;background:rgba(2,6,23,.48);border:1px solid rgba(59,130,246,.16)"><div style="display:flex;justify-content:space-between;color:#cbd5e1;font-size:12px;font-weight:900"><span>${esc(t.current)}</span><span>${esc(t.next)}</span></div><div style="height:8px;background:#083344;border-radius:999px;margin-top:8px;position:relative"><div style="height:100%;width:${t.pct}%;background:linear-gradient(90deg,#22d3ee,#2dd4bf);border-radius:999px"></div><span style="position:absolute;left:calc(${t.pct}% - 7px);top:-3px;width:14px;height:14px;border-radius:50%;background:#67e8f9;box-shadow:0 0 14px #22d3ee"></span></div><div style="margin-top:7px;color:#22d3ee;font-size:12px;font-weight:1000">${n(t.pct,0)}%</div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px"><div style="padding:11px;border-radius:14px;background:rgba(120,53,15,.16);border:1px solid rgba(251,146,60,.24)"><div style="display:flex;justify-content:space-between;color:#fde68a;font-weight:1000"><span>Quality</span><span>${esc(row.conviction || "Paper")}</span></div><div style="margin-top:5px;color:#e2e8f0;font-size:11px;line-height:1.45">${esc(row.ruleNote)}</div></div><div style="padding:11px;border-radius:14px;background:rgba(120,53,15,.16);border:1px solid rgba(251,146,60,.24)"><div style="display:flex;justify-content:space-between;color:#fde68a;font-weight:1000"><span>${esc(row.strategyLabel)}</span><span>策略</span></div><div style="margin-top:5px;color:#e2e8f0;font-size:11px;line-height:1.45">固定紙上驗證；禁止自動轉真倉</div></div></div>
        <div style="margin-top:12px;color:#67e8f9;font-weight:1000">層級規則</div><div style="display:flex;gap:7px;margin-top:7px">${tierCards}</div>`;
      card.dataset.v17PaperSkin = "1";
    }
  }, [rows]);
  return null;
}

export default function PaperStatusPage(props) {
  const rows = props.initialSummary?.positions || [];
  return <><V17CardSkin rows={rows} /><PaperAutoPage {...props} /></>;
}
