import { useEffect } from "react";
import FinancialOS from "./financial-os";

const ICONS = {
  飲食: "🍴",
  家用: "⌂",
  其他: "▦",
  投資: "↗",
  教育: "學",
  交通: "車",
  醫療: "＋",
  娛樂: "樂",
  金融: "$",
  固定支出: "定",
  生活用品: "品",
  居家修繕: "修",
  服飾: "衣",
};

function polishCategoryCard() {
  const heading = [...document.querySelectorAll("h2")].find((node) => node.textContent?.trim() === "區間大類支出");
  const card = heading?.closest("section");
  if (!card) return;

  card.dataset.premiumCategoryCard = "true";
  Object.assign(card.style, {
    padding: "15px",
    borderColor: "rgba(34,211,238,.34)",
    boxShadow: "0 20px 55px rgba(8,145,178,.12),0 14px 36px rgba(0,0,0,.32)",
    background: "linear-gradient(155deg,rgba(8,20,38,.98),rgba(3,18,34,.98))",
  });

  const header = heading.parentElement;
  if (header) {
    Object.assign(header.style, { alignItems: "center", marginBottom: "15px" });
    heading.style.fontSize = "20px";
    heading.style.position = "relative";
    heading.style.paddingLeft = "13px";
    if (!heading.querySelector("[data-accent]")) {
      const accent = document.createElement("span");
      accent.dataset.accent = "true";
      Object.assign(accent.style, {
        position: "absolute",
        left: "0",
        top: "1px",
        bottom: "1px",
        width: "4px",
        borderRadius: "99px",
        background: "linear-gradient(180deg,#22d3ee,#10b981)",
        boxShadow: "0 0 16px rgba(34,211,238,.5)",
      });
      heading.prepend(accent);
    }
    const right = header.lastElementChild;
    if (right && right !== heading) {
      right.style.color = "#5eead4";
      right.style.fontSize = "12px";
    }
  }

  const buttons = [...card.querySelectorAll(":scope > button")];
  buttons.forEach((button) => {
    const label = button.querySelector("b")?.textContent?.trim();
    if (!label) return;
    const open = button.style.background && button.style.background !== "transparent";
    Object.assign(button.style, {
      gridTemplateColumns: "44px 58px minmax(64px,1fr) auto 16px",
      alignItems: "center",
      gap: "9px",
      padding: "13px 11px",
      marginBottom: "9px",
      border: open ? "1px solid rgba(45,212,191,.48)" : "1px solid rgba(56,189,248,.18)",
      borderRadius: "17px",
      background: open
        ? "linear-gradient(155deg,rgba(8,47,73,.9),rgba(6,78,59,.34))"
        : "linear-gradient(155deg,rgba(15,23,42,.92),rgba(3,18,34,.88))",
      boxShadow: open ? "0 12px 30px rgba(16,185,129,.11)" : "none",
      overflow: "hidden",
    });

    let icon = button.querySelector("[data-category-icon]");
    if (!icon) {
      icon = document.createElement("span");
      icon.dataset.categoryIcon = "true";
      icon.textContent = ICONS[label] || "•";
      Object.assign(icon.style, {
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        border: "1px solid rgba(34,211,238,.42)",
        color: "#2dd4bf",
        fontSize: "18px",
        fontWeight: "1000",
        background: "rgba(8,47,73,.5)",
      });
      button.prepend(icon);
    }

    const children = [...button.children];
    const labelNode = children.find((node) => node.tagName === "B" && node.textContent?.trim() === label);
    if (labelNode) labelNode.style.fontSize = "16px";

    const progress = children.find((node) => node.tagName === "DIV");
    if (progress) {
      Object.assign(progress.style, {
        height: "10px",
        marginTop: "0",
        background: "rgba(51,65,85,.8)",
        border: "1px solid rgba(148,163,184,.08)",
      });
      const fill = progress.firstElementChild;
      if (fill) {
        fill.style.background = "linear-gradient(90deg,#22d3ee,#14b8a6,#22c55e)";
        fill.style.boxShadow = "0 0 14px rgba(34,211,238,.42)";
      }
    }

    const amount = [...button.querySelectorAll("b")].find((node) => node !== labelNode);
    if (amount) {
      amount.style.color = "#fde68a";
      amount.style.fontSize = "18px";
      amount.style.whiteSpace = "nowrap";
      const raw = amount.textContent || "";
      amount.textContent = raw.replace(/\s*›\s*$/, "").trim();
    }

    let chevron = button.querySelector("[data-chevron]");
    if (!chevron) {
      chevron = document.createElement("span");
      chevron.dataset.chevron = "true";
      chevron.textContent = "›";
      Object.assign(chevron.style, { color: "#fcd34d", fontSize: "20px", textAlign: "right" });
      button.append(chevron);
    }
  });

  const detail = [...card.children].find((node) => node.tagName === "DIV" && /支出細項/.test(node.textContent || ""));
  if (detail) {
    Object.assign(detail.style, {
      marginTop: "4px",
      padding: "13px",
      border: "1px solid rgba(34,211,238,.25)",
      borderRadius: "17px",
      background: "rgba(2,6,23,.52)",
    });
    const detailHeader = detail.firstElementChild;
    if (detailHeader) {
      detailHeader.style.marginBottom = "9px";
      const title = detailHeader.querySelector("b");
      if (title) { title.style.color = "#5eead4"; title.style.fontSize = "16px"; }
      const collapse = detailHeader.querySelector("button");
      if (collapse) Object.assign(collapse.style, {
        border: "1px solid rgba(45,212,191,.4)",
        borderRadius: "999px",
        padding: "7px 12px",
        background: "rgba(13,148,136,.10)",
        color: "#5eead4",
      });
    }
  }

  if (!card.querySelector("[data-category-hint]")) {
    const hint = document.createElement("div");
    hint.dataset.categoryHint = "true";
    hint.textContent = "ⓘ 點擊任一大類可查看該類的所有支出明細";
    Object.assign(hint.style, {
      marginTop: "10px",
      textAlign: "center",
      color: "#2dd4bf",
      fontSize: "11px",
    });
    card.append(hint);
  }
}

export default function FinancialShell() {
  useEffect(() => {
    function syncNav() {
      const nav = document.querySelector("nav");
      const grid = nav?.firstElementChild;
      if (!grid) return;
      grid.style.gridTemplateColumns = "repeat(5, minmax(0, 1fr))";
      grid.style.gap = "6px";
      if (!document.getElementById("financial-audit-nav-link")) {
        const link = document.createElement("a");
        link.id = "financial-audit-nav-link";
        link.href = "/financial-audit";
        link.textContent = "查帳";
        link.setAttribute("aria-label", "進入多元記帳本查帳頁");
        Object.assign(link.style, {
          display: "grid", placeItems: "center", minWidth: "0", boxSizing: "border-box",
          border: "1px solid rgba(212,175,55,.65)", borderRadius: "13px", padding: "9px 2px",
          background: "rgba(92,64,16,.45)", color: "#fff7bd", fontSize: "11px",
          fontWeight: "1000", lineHeight: "normal", textDecoration: "none",
        });
        grid.insertBefore(link, grid.children[2] || null);
      }
    }

    const apply = () => { syncNav(); polishCategoryCard(); };
    const timer = window.setInterval(apply, 150);
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    apply();
    const stop = window.setTimeout(() => window.clearInterval(timer), 5000);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
      observer.disconnect();
    };
  }, []);

  return <FinancialOS />;
}
