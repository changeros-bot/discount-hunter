import { useEffect } from "react";
import "../styles/globals.css";
import "../styles/v10.css";
import "../styles/title-gold.css";
import "../styles/hero-poster.css";
import "../styles/v15-unified.css";
import "../styles/v15-fix.css";
import "../styles/v15-color-force.css";

const UI_TRANSLATIONS = [
  ["Auto Execution Status", "自動化執行狀態"],
  ["V17.6｜Dry-run only｜不在主頁直接下單", "V17.6｜僅模擬執行｜不在主頁直接下單"],
  ["Dry-run only", "僅模擬執行"],
  ["DRY-RUN ONLY", "僅模擬，不下單"],
  ["Dry-run", "模擬執行"],
  ["dry-run", "模擬執行"],
  ["Mode：", "模式："],
  ["Risk Gate：", "風控閘門："],
  ["Drafts：", "草稿："],
  ["Simulated：", "模擬紀錄："],
  ["Readiness", "準備檢查"],
  ["Drafts", "草稿"],
  ["Log", "紀錄"],
  ["Trade Readiness", "交易準備檢查"],
  ["Semi-Auto Draft", "半自動交易草稿"],
  ["Execution Log", "執行紀錄"],
  ["V17.6 SEMI-AUTO EXECUTION FLOW", "V17.6 半自動執行流程"],
  ["V17.6 DRY-RUN DRAFTS", "V17.6 模擬交易草稿"],
  ["V17.6 EXECUTION LOG", "V17.6 執行紀錄"],
  ["Readiness Status", "準備狀態"],
  ["Candidate", "候選買點"],
  ["Risk Checks", "風控檢查"],
  ["Actions", "操作"],
  ["Create Dry-run Draft", "建立模擬草稿"],
  ["Refresh", "重新整理"],
  ["Trade Readiness / Create Draft", "交易準備檢查 / 建立草稿"],
  ["Confirm Dry-run", "確認模擬執行"],
  ["Skip", "略過"],
  ["Cancel", "取消"],
  ["Draft ID：", "草稿編號："],
  ["Risk：", "風控："],
  ["Time：", "時間："],
  ["Amount：", "金額："],
  ["Order ID：", "訂單編號："],
  ["Tx Hash：", "交易雜湊："],
  ["Error：", "錯誤："],
  ["State Machine", "狀態機"],
  ["Status Ready for Review", "狀態：待檢視"],
  ["Quality Checklist", "品質檢查表"],
  ["No real order was sent.", "沒有送出任何真實訂單。"],
  ["Confirm 只會寫入 SIMULATED 紀錄，不會真實下單。", "確認後只會寫入模擬紀錄，不會真實下單。"],
  ["交易黑盒子。V17.6 只允許 SIMULATED / BLOCKED / FAILED，不會出現真實 EXECUTED。", "交易黑盒子。V17.6 只允許模擬、阻擋、失敗三種紀錄，不會出現真實成交。"],
  ["確認 dry-run 草稿後，這裡會出現 SIMULATED 紀錄。", "確認模擬草稿後，這裡會出現模擬紀錄。"],
  ["先到 Trade Readiness 建立 dry-run draft。", "先到交易準備檢查建立模擬草稿。"],
  ["PASS / WAIT", "通過 / 等待"],
  ["BLOCKED", "已阻擋"],
  ["READY", "可建立草稿"],
  ["WAIT", "等待"],
  ["PASS", "通過"],
  ["FAIL", "失敗"],
  ["DRY_RUN", "模擬模式"],
  ["DRAFT", "草稿"],
  ["CONFIRMED", "已確認"],
  ["SKIPPED", "已略過"],
  ["CANCELLED", "已取消"],
  ["SIMULATED", "已模擬"],
  ["FAILED", "失敗"],
  ["Blocked：", "阻擋原因："],
];

const HIDE_CARD_TEXT = [
  "App V17.1",
  "Playbook Josh Portfolio",
  "Status Ready for Review",
  "狀態：待檢視",
  "中文 Quality Checklist",
  "中文 品質檢查表",
  "品質檢查表｜半自動範圍",
];

function translateText(value) {
  let next = value;
  for (const [from, to] of UI_TRANSLATIONS) {
    next = next.split(from).join(to);
  }
  return next;
}

function hideTransitionalCards(root = document.body) {
  if (typeof document === "undefined" || !root) return;
  const cards = root.querySelectorAll?.("section, details") || [];
  for (const card of cards) {
    const text = card.textContent || "";
    if (HIDE_CARD_TEXT.some((needle) => text.includes(needle))) {
      card.style.display = "none";
      card.setAttribute("data-v17-hidden", "transitional-card");
    }
  }
}

function addV17PaperLinks() {
  if (typeof document === "undefined") return;
  if (!location.pathname.startsWith("/v17")) return;
  if (document.querySelector("[data-v17-paper-links='true']")) return;

  const cards = [...document.querySelectorAll("section")];
  const autoCard = cards.find((card) => (card.textContent || "").includes("自動化執行狀態") || (card.textContent || "").includes("Auto Execution Status"));
  if (!autoCard) return;

  const row = document.createElement("div");
  row.setAttribute("data-v17-paper-links", "true");
  row.style.display = "grid";
  row.style.gridTemplateColumns = "1fr 1fr";
  row.style.gap = "8px";
  row.style.marginTop = "8px";

  const links = [
    ["/paper-auto", "紙上測試", "rgba(168,85,247,.14)", "rgba(168,85,247,.28)", "#ddd6fe"],
    ["/market-45-review", "45檔總表", "rgba(20,184,166,.14)", "rgba(20,184,166,.28)", "#99f6e4"],
  ];
  for (const [href, text, bg, border, color] of links) {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = text;
    a.style.textAlign = "center";
    a.style.textDecoration = "none";
    a.style.padding = "9px 6px";
    a.style.borderRadius = "12px";
    a.style.background = bg;
    a.style.border = `1px solid ${border}`;
    a.style.color = color;
    a.style.fontSize = "12px";
    a.style.fontWeight = "1000";
    row.appendChild(a);
  }
  autoCard.appendChild(row);
}

function addPaperApprovalGate() {
  if (typeof document === "undefined") return;
  if (!location.pathname.startsWith("/paper-auto")) return;

  const textNodes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  for (const node of textNodes) {
    const value = node.nodeValue || "";
    const next = value
      .replaceAll("已滿4週，可進下一階段覆核", "已滿4週，只取得升格提案資格；必須 Josh 明確同意才可進折扣獵人")
      .replaceAll("未滿 4 週不得進折扣獵人觀察區", "未滿4週不得進折扣獵人；滿4週也只取得提案資格，必須 Josh 明確同意才可升格")
      .replaceAll("不得顯示在折扣獵人觀察區，不得成為真實買入或自動交易名單。", "不得顯示在折扣獵人觀察區；滿4週後也只能提出升格建議，必須 Josh 明確同意，才可進折扣獵人正式名單。")
      .replaceAll("未滿 4 週：不得進折扣獵人觀察區、不得真實下單、不得自動交易。", "未滿4週：不得進折扣獵人；滿4週：只取得提案資格；進折扣獵人必須 Josh 明確同意。不得真實下單、不得自動交易。");
    if (next !== value) node.nodeValue = next;
  }

  if (document.querySelector("[data-paper-approval-gate='true']")) return;
  const header = document.querySelector("main header");
  if (!header) return;
  const gate = document.createElement("section");
  gate.setAttribute("data-paper-approval-gate", "true");
  gate.style.marginTop = "12px";
  gate.style.border = "1px solid rgba(245,158,11,.40)";
  gate.style.background = "rgba(245,158,11,.10)";
  gate.style.borderRadius = "16px";
  gate.style.padding = "11px";
  gate.style.color = "#fde68a";
  gate.style.fontSize = "12px";
  gate.style.fontWeight = "1000";
  gate.style.lineHeight = "1.55";
  gate.textContent = "升格閘門：4週紙上驗證通過 ≠ 自動進折扣獵人；只能提出升格建議。必須 Josh 明確同意，才可進折扣獵人正式名單 / 觀察區 / 主頁。";
  header.insertAdjacentElement("afterend", gate);
}

function localizeNode(root) {
  if (typeof document === "undefined" || !root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(tag)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const next = translateText(node.nodeValue || "");
    if (next !== node.nodeValue) node.nodeValue = next;
  }
  hideTransitionalCards(root.nodeType === 1 ? root : document.body);
  addV17PaperLinks();
  addPaperApprovalGate();
}

export default function App({ Component, pageProps }) {
  useEffect(() => {
    localizeNode(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          const next = translateText(mutation.target.nodeValue || "");
          if (next !== mutation.target.nodeValue) mutation.target.nodeValue = next;
        }
        for (const node of mutation.addedNodes || []) {
          localizeNode(node);
        }
      }
      hideTransitionalCards(document.body);
      addV17PaperLinks();
      addPaperApprovalGate();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return <Component {...pageProps} />;
}
