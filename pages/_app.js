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
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return <Component {...pageProps} />;
}
