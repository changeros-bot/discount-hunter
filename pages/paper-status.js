import { useEffect } from "react";
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
        strategyLabel: row.strategyLabel,
        description: row.description,
        rules: row.rules,
        amounts: row.amounts,
        ruleNote: row.ruleNote,
      })),
    },
  };
}

function addText(parent, text, style = {}) {
  const node = document.createElement("div");
  node.textContent = text;
  Object.assign(node.style, style);
  parent.appendChild(node);
}

function CardRuleInjector({ rows = [] }) {
  useEffect(() => {
    const map = new Map(rows.map((row) => [String(row.symbol || "").toUpperCase(), row]));
    const cards = Array.from(document.querySelectorAll("main div")).filter((el) => {
      if (el.dataset?.ruleInjected === "1") return false;
      const first = el.firstElementChild;
      const symbolNode = first?.firstElementChild?.firstElementChild;
      const symbol = String(symbolNode?.textContent || "").trim().toUpperCase();
      return map.has(symbol);
    });

    for (const card of cards) {
      const first = card.firstElementChild;
      const symbol = String(first?.firstElementChild?.firstElementChild?.textContent || "").trim().toUpperCase();
      const row = map.get(symbol);
      if (!row) continue;

      const panel = document.createElement("div");
      panel.dataset.cardRulePanel = "1";
      Object.assign(panel.style, {
        marginTop: "10px",
        padding: "10px",
        borderRadius: "14px",
        border: "1px solid rgba(34,211,238,.22)",
        background: "rgba(8,47,73,.34)",
      });
      addText(panel, row.strategyLabel, { color: "#bbf7d0", fontSize: "12px", fontWeight: "900" });
      addText(panel, row.description, { marginTop: "4px", color: "#cbd5e1", fontSize: "11px", lineHeight: "1.45" });
      addText(panel, row.rules?.length ? row.rules.map((x, i) => `D${i + 1} ${x}%`).join(" ｜ ") : "尚未設定折價層級", { marginTop: "6px", color: "#22d3ee", fontSize: "12px", fontWeight: "900" });
      addText(panel, row.amounts?.length ? row.amounts.map((x, i) => `D${i + 1} ${x}U`).join(" ｜ ") : "每筆 5U 紙上測試", { marginTop: "4px", color: "#fde68a", fontSize: "11px", fontWeight: "850" });
      addText(panel, row.ruleNote, { marginTop: "5px", color: "#94a3b8", fontSize: "10px", lineHeight: "1.4" });

      const stats = card.lastElementChild;
      card.insertBefore(panel, stats);
      card.dataset.ruleInjected = "1";
    }
  }, [rows]);
  return null;
}

export default function PaperStatusPage(props) {
  return <>
    <CardRuleInjector rows={props.restoredRules || []} />
    <PaperAutoPage {...props} />
  </>;
}
