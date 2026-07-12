import PaperAutoPage, { getServerSideProps as getPaperProps } from "./paper-auto";
import { ASSET_REGISTRY } from "../lib/v17-asset-registry";
import { getAllPaperDiscountRules } from "../lib/v17-paper-discount-rules";

function norm(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/ON$/, "");
}

function strategyLabel(value) {
  const map = {
    dca_discount: "DCA＋折價加碼",
    discount_only: "只在折價層級買入",
    pure_dca: "純定投",
    trend: "趨勢策略",
    swing: "波段策略",
  };
  return map[value] || value || "紙上折價驗證";
}

function enrichPosition(row, preparedRules) {
  const key = norm(row.symbol);
  const core = ASSET_REGISTRY.find((asset) => norm(asset.symbol) === key);
  const prepared = preparedRules[key] || null;
  const source = core || prepared || {};
  const rules = Array.isArray(source.rules) ? source.rules : (row.rules || []);
  const amounts = Array.isArray(source.amounts) ? source.amounts : [];
  const discount = Math.abs(Number(row.discountFromHighPct || row.highProgress?.discountFromHighPct || 0));
  const currentPrice = Number(row.currentPrice || row.price || 0);
  const derivedHigh = discount < 100 && currentPrice > 0 ? currentPrice / (1 - discount / 100) : 0;
  const highProgress = row.highProgress?.enabled ? row.highProgress : {
    enabled: true,
    progressPct: Math.max(0, Math.min(100, 100 - discount)),
    currentPrice,
    high52w: derivedHigh,
    discountFromHighPct: -discount,
  };
  return {
    ...row,
    rules,
    amounts,
    strategy: core?.strategy || "paper_discount",
    strategyLabel: strategyLabel(core?.strategy),
    description: core?.description || prepared?.note || row.name || "紙上折價驗證",
    conviction: core?.conviction || "Paper",
    ruleNote: prepared?.note || core?.backtestConclusion || core?.reEvaluateTrigger || "僅供紙上驗證，禁止自動轉真倉。",
    highProgress,
  };
}

export async function getServerSideProps(ctx) {
  const result = await getPaperProps(ctx);
  const props = result?.props || {};
  const preparedRules = getAllPaperDiscountRules();
  const positions = Array.isArray(props.initialSummary?.positions)
    ? props.initialSummary.positions.map((row) => enrichPosition(row, preparedRules))
    : [];
  return {
    ...result,
    props: {
      ...props,
      initialSummary: props.initialSummary ? { ...props.initialSummary, positions } : props.initialSummary,
      restoredRules: positions.map((row) => ({
        symbol: row.symbol,
        name: row.name,
        strategyLabel: row.strategyLabel,
        description: row.description,
        conviction: row.conviction,
        rules: row.rules,
        amounts: row.amounts,
        ruleNote: row.ruleNote,
      })),
    },
  };
}

function RulesPanel({ rows = [] }) {
  if (!rows.length) return null;
  return <section style={{ maxWidth: 560, margin: "14px auto 0", padding: "0 14px", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',Arial,sans-serif" }}>
    <div style={{ border: "1px solid rgba(34,211,238,.35)", background: "rgba(8,47,73,.42)", borderRadius: 20, padding: 14, color: "#e2e8f0" }}>
      <h2 style={{ margin: "0 0 8px", color: "#67e8f9", fontSize: 18 }}>買點規則與策略已恢復</h2>
      <div style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.55, marginBottom: 10 }}>進度條依各標的正式折價層級計算；D1、D2、D3、D4 代表由淺到深的分批買點。全部仍是紙上交易，禁止自動轉真倉。</div>
      <details>
        <summary style={{ cursor: "pointer", fontWeight: 1000, color: "#bae6fd" }}>展開 28 檔策略與買點</summary>
        <div style={{ display: "grid", gap: 9, marginTop: 10 }}>
          {rows.map((row) => <div key={row.symbol} style={{ border: "1px solid rgba(148,163,184,.18)", background: "rgba(2,6,23,.58)", borderRadius: 14, padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ color: "#f8fafc" }}>{row.symbol}</strong><span style={{ color: "#bbf7d0", fontSize: 12, fontWeight: 900 }}>{row.strategyLabel}</span></div>
            <div style={{ marginTop: 5, color: "#cbd5e1", fontSize: 12 }}>{row.description}</div>
            <div style={{ marginTop: 6, color: "#22d3ee", fontSize: 12, fontWeight: 900 }}>{row.rules?.length ? row.rules.map((x, i) => `D${i + 1} ${x}%`).join(" ｜ ") : "尚未設定折價層級"}</div>
            <div style={{ marginTop: 4, color: "#fde68a", fontSize: 12 }}>{row.amounts?.length ? row.amounts.map((x, i) => `D${i + 1} ${x}U`).join(" ｜ ") : "每筆 5U 紙上測試"}</div>
            <div style={{ marginTop: 5, color: "#94a3b8", fontSize: 11, lineHeight: 1.45 }}>{row.ruleNote}</div>
          </div>)}
        </div>
      </details>
    </div>
  </section>;
}

export default function PaperStatusPage(props) {
  return <>
    <RulesPanel rows={props.restoredRules || []} />
    <PaperAutoPage {...props} />
  </>;
}
