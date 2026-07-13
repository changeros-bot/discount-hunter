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
  ["Dry-run only", "僅模擬執行"],
  ["DRY-RUN ONLY", "僅模擬，不下單"],
  ["Dry-run", "模擬執行"],
  ["dry-run", "模擬執行"],
  ["Readiness", "準備檢查"],
  ["Drafts", "草稿"],
  ["Log", "紀錄"],
  ["Trade Readiness", "交易準備檢查"],
  ["Semi-Auto Draft", "半自動交易草稿"],
  ["Execution Log", "執行紀錄"],
  ["Candidate", "候選買點"],
  ["Actions", "操作"],
  ["Refresh", "重新整理"],
  ["Confirm Dry-run", "確認模擬執行"],
  ["Skip", "略過"],
  ["Cancel", "取消"],
  ["BLOCKED", "已阻擋"],
  ["READY", "可建立草稿"],
  ["PASS", "通過"],
  ["FAIL", "失敗"],
  ["SIMULATED", "已模擬"],
  ["FAILED", "失敗"],
];

const HIDE_CARD_TEXT = ["App V17.1", "Playbook Josh Portfolio", "Status Ready for Review", "狀態：待檢視", "中文 Quality Checklist", "中文 品質檢查表", "品質檢查表｜半自動範圍"];

function translateText(value) {
  let next = value;
  for (const [from, to] of UI_TRANSLATIONS) next = next.split(from).join(to);
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
  const links = [["/paper-auto", "紙上測試", "rgba(168,85,247,.14)", "rgba(168,85,247,.28)", "#ddd6fe"], ["/market-45-review", "45檔總表", "rgba(20,184,166,.14)", "rgba(20,184,166,.28)", "#99f6e4"]];
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

function normalizePaperAutoLabels() {
  if (typeof document === "undefined") return;
  if (!location.pathname.startsWith("/paper-auto")) return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const value = node.nodeValue || "";
    let next = value
      .replaceAll("M45紙上", "預備名單")
      .replaceAll("M91紙上", "預備名單")
      .replaceAll("M10紙上", "預備名單")
      .replaceAll("產業紙上", "預備名單")
      .replaceAll("Market45紙上測試", "預備名單")
      .replaceAll("Market91審核紙上測試", "預備名單")
      .replaceAll("Market10折價候選", "預備名單")
      .replaceAll("紙上候選：", "預備名單：")
      .replaceAll("4週紙上驗證區", "預備名單 4週紙上驗證區")
      .replaceAll("已有 7 天內 OPEN 紙上測試；防重複建倉", "已有 OPEN 紙上部位；防重複建倉");
    if (/核心10檔 \d+｜4週紙上 \d+｜M45 \d+｜M91 \d+｜M10 \d+｜產業 \d+/.test(next)) {
      const core = next.match(/核心10檔 (\d+)/)?.[1] || "10";
      const prepared = next.match(/4週紙上 (\d+)/)?.[1] || "18";
      next = `核心10檔 ${core}｜預備名單 ${prepared}`;
    }
    if (next !== value) node.nodeValue = next;
  }
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function setNativeInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function addFinancialDateShortcuts() {
  if (typeof document === "undefined") return;
  if (!location.pathname.startsWith("/financial-os")) return;
  if (document.querySelector("[data-financial-date-shortcuts='true']")) return;
  const section = [...document.querySelectorAll("section")].find((card) => (card.textContent || "").includes("日期篩選"));
  if (!section) return;
  const inputs = [...section.querySelectorAll("input[type='date']")];
  if (inputs.length < 2) return;
  const row = document.createElement("div");
  row.setAttribute("data-financial-date-shortcuts", "true");
  row.style.display = "grid";
  row.style.gridTemplateColumns = "repeat(3, 1fr)";
  row.style.gap = "7px";
  row.style.marginTop = "10px";
  const now = new Date();
  const monthRange = (offset = 0) => {
    const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    return [first, offset === 0 ? now : last];
  };
  const payrollRange = () => {
    const start = new Date(now.getFullYear(), now.getDate() >= 10 ? now.getMonth() : now.getMonth() - 1, 10);
    return [start, now];
  };
  const makeRange = { "本月": () => monthRange(0), "上月": () => monthRange(-1), "發薪後": payrollRange };
  for (const label of Object.keys(makeRange)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.style.border = "1px solid rgba(212,175,55,.58)";
    btn.style.borderRadius = "12px";
    btn.style.padding = "9px 6px";
    btn.style.background = "linear-gradient(180deg,rgba(250,204,21,.22),rgba(92,64,16,.60))";
    btn.style.color = "#fff7bd";
    btn.style.fontWeight = "1000";
    btn.style.fontSize = "12px";
    btn.onclick = () => {
      const [start, end] = makeRange[label]();
      setNativeInputValue(inputs[0], formatDate(start));
      setNativeInputValue(inputs[1], formatDate(end));
    };
    row.appendChild(btn);
  }
  const anchor = inputs[1].parentElement || section;
  anchor.insertAdjacentElement("afterend", row);
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

function clarifyV17Holdings() {
  if (typeof document === "undefined") return;
  if (!location.pathname.startsWith("/v17")) return;

  const sections = [...document.querySelectorAll("section")];
  const holdings = sections.find((section) => {
    const text = section.textContent || "";
    return text.includes("真實持倉") && text.includes("總投入") && text.includes("目前市值");
  });
  if (holdings && !holdings.querySelector("[data-v17-holdings-scope='true']")) {
    const note = document.createElement("div");
    note.setAttribute("data-v17-holdings-scope", "true");
    note.style.marginTop = "10px";
    note.style.padding = "10px";
    note.style.borderRadius = "12px";
    note.style.background = "rgba(14,165,233,.10)";
    note.style.border = "1px solid rgba(14,165,233,.24)";
    note.style.color = "#bae6fd";
    note.style.fontSize = "11px";
    note.style.fontWeight = "850";
    note.style.lineHeight = "1.55";
    note.textContent = "口徑說明：此卡是折價獵人策略持倉＝Web3 xStocks＋交易所 BTC；不含 Web3 錢包內作為 gas／現金的 BNB。Binance 錢包首頁總額則包含 BNB、但不包含交易所 BTC，因此兩個總額不能直接互相比對。";
    holdings.appendChild(note);
  }

  const chart = sections.find((section) => {
    const text = section.textContent || "";
    return text.includes("真實持倉總市值（USD）") && text.includes("每分鐘保存一次");
  });
  if (chart) {
    const walker = document.createTreeWalker(chart, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const value = node.nodeValue || "";
      if (value.includes("真實持倉總市值（USD）")) node.nodeValue = value.replace("真實持倉總市值（USD）", "策略持倉市值歷史（USD）");
      if (value.includes("每分鐘保存一次真實持倉總市值")) node.nodeValue = value.replace("每分鐘保存一次真實持倉總市值", "每分鐘保存一次策略持倉總市值；加碼、減碼與轉入都會造成曲線跳動");
    }
    if (!chart.querySelector("[data-v17-chart-warning='true']")) {
      const warning = document.createElement("div");
      warning.setAttribute("data-v17-chart-warning", "true");
      warning.style.marginTop = "9px";
      warning.style.padding = "9px";
      warning.style.borderRadius = "11px";
      warning.style.background = "rgba(245,158,11,.10)";
      warning.style.border = "1px solid rgba(245,158,11,.24)";
      warning.style.color = "#fde68a";
      warning.style.fontSize = "10px";
      warning.style.fontWeight = "850";
      warning.style.lineHeight = "1.5";
      warning.textContent = "注意：這條線是總市值，不是績效曲線。新增 MRVL 10U 會讓市值跳升；點選舊時間點時，圖上金額也會和上方即時市值不同。區間變動不可直接當作投資報酬。";
      chart.appendChild(warning);
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
  addV17PaperLinks();
  addPaperApprovalGate();
  normalizePaperAutoLabels();
  addFinancialDateShortcuts();
  clarifyV17Holdings();
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
        for (const node of mutation.addedNodes || []) localizeNode(node);
      }
      hideTransitionalCards(document.body);
      addV17PaperLinks();
      addPaperApprovalGate();
      normalizePaperAutoLabels();
      addFinancialDateShortcuts();
      clarifyV17Holdings();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return <Component {...pageProps} />;
}
