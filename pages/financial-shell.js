import { useEffect } from "react";
import FinancialOS from "./financial-os";

export default function FinancialShell() {
  useEffect(() => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const nav = document.querySelector("nav");
      const grid = nav?.firstElementChild;
      if (!grid) {
        if (attempts >= 40) window.clearInterval(timer);
        return;
      }

      grid.style.gridTemplateColumns = "repeat(5, minmax(0, 1fr))";
      grid.style.gap = "6px";

      if (!document.getElementById("financial-audit-nav-link")) {
        const link = document.createElement("a");
        link.id = "financial-audit-nav-link";
        link.href = "/financial-audit";
        link.textContent = "查帳";
        link.setAttribute("aria-label", "進入多元記帳本查帳頁");
        Object.assign(link.style, {
          display: "grid",
          placeItems: "center",
          minWidth: "0",
          boxSizing: "border-box",
          border: "1px solid rgba(212,175,55,.65)",
          borderRadius: "13px",
          padding: "9px 2px",
          background: "rgba(92,64,16,.45)",
          color: "#fff7bd",
          fontSize: "11px",
          fontWeight: "1000",
          lineHeight: "normal",
          textDecoration: "none",
        });
        grid.insertBefore(link, grid.children[2] || null);
      }
      window.clearInterval(timer);
    }, 100);

    return () => window.clearInterval(timer);
  }, []);

  return <div className="financial-shell-v53">
    <FinancialOS />
    <style jsx global>{`
      .financial-shell-v53 main > div > section:nth-of-type(4) {
        padding: 15px !important;
        border-color: rgba(34, 211, 238, .34) !important;
        background: linear-gradient(155deg, rgba(8, 20, 38, .98), rgba(3, 18, 34, .98)) !important;
        box-shadow: 0 18px 48px rgba(8,145,178,.12), 0 12px 32px rgba(0,0,0,.3) !important;
      }
      .financial-shell-v53 main > div > section:nth-of-type(4) > div:first-child {
        align-items: center !important;
        margin-bottom: 14px !important;
      }
      .financial-shell-v53 main > div > section:nth-of-type(4) > div:first-child h2 {
        position: relative;
        padding-left: 14px;
        font-size: 20px !important;
      }
      .financial-shell-v53 main > div > section:nth-of-type(4) > div:first-child h2::before {
        content: "";
        position: absolute;
        left: 0;
        top: 1px;
        bottom: 1px;
        width: 4px;
        border-radius: 999px;
        background: linear-gradient(180deg,#22d3ee,#10b981);
        box-shadow: 0 0 15px rgba(34,211,238,.5);
      }
      .financial-shell-v53 main > div > section:nth-of-type(4) > div:first-child > b {
        color: #5eead4 !important;
        white-space: nowrap;
      }
      .financial-shell-v53 main > div > section:nth-of-type(4) > button {
        appearance: none !important;
        -webkit-appearance: none !important;
        width: 100% !important;
        display: grid !important;
        grid-template-columns: 42px 58px minmax(72px,1fr) auto 16px !important;
        align-items: center !important;
        gap: 9px !important;
        margin: 0 0 10px !important;
        padding: 14px 11px !important;
        border: 1px solid rgba(56,189,248,.18) !important;
        border-radius: 18px !important;
        background: linear-gradient(155deg,rgba(15,23,42,.95),rgba(3,18,34,.9)) !important;
        box-shadow: none !important;
        color: #f8fafc !important;
        text-align: left !important;
        overflow: hidden;
      }
      .financial-shell-v53 main > div > section:nth-of-type(4) > button::before {
        width: 40px;
        height: 40px;
        display: grid;
        place-items: center;
        border: 1px solid rgba(34,211,238,.42);
        border-radius: 50%;
        background: rgba(8,47,73,.5);
        color: #2dd4bf;
        font-size: 18px;
        font-weight: 1000;
      }
      .financial-shell-v53 main > div > section:nth-of-type(4) > button:nth-of-type(1)::before { content: "🍴"; }
      .financial-shell-v53 main > div > section:nth-of-type(4) > button:nth-of-type(2)::before { content: "⌂"; }
      .financial-shell-v53 main > div > section:nth-of-type(4) > button:nth-of-type(3)::before { content: "▦"; }
      .financial-shell-v53 main > div > section:nth-of-type(4) > button:nth-of-type(4)::before { content: "↗"; }
      .financial-shell-v53 main > div > section:nth-of-type(4) > button > b:first-of-type {
        font-size: 16px !important;
      }
      .financial-shell-v53 main > div > section:nth-of-type(4) > button > div {
        height: 10px !important;
        margin-top: 0 !important;
        border: 1px solid rgba(148,163,184,.08);
        background: rgba(51,65,85,.82) !important;
      }
      .financial-shell-v53 main > div > section:nth-of-type(4) > button > div > div {
        background: linear-gradient(90deg,#22d3ee,#14b8a6,#22c55e) !important;
        box-shadow: 0 0 14px rgba(34,211,238,.4);
      }
      .financial-shell-v53 main > div > section:nth-of-type(4) > button > b:last-of-type {
        color: #fde68a !important;
        font-size: 18px !important;
        white-space: nowrap;
      }
      .financial-shell-v53 main > div > section:nth-of-type(4) > button > b:last-of-type::after {
        content: "›";
        display: inline-block;
        margin-left: 8px;
        color: #fcd34d;
        font-size: 21px;
      }
      .financial-shell-v53 main > div > section:nth-of-type(4) > div:not(:first-child) {
        margin-top: 2px !important;
        padding: 13px !important;
        border: 1px solid rgba(34,211,238,.23) !important;
        border-radius: 17px !important;
        background: rgba(2,6,23,.5) !important;
      }
      .financial-shell-v53 main > div > section:nth-of-type(4) > div:not(:first-child) > div:first-child b {
        color: #5eead4 !important;
        font-size: 16px !important;
      }
      .financial-shell-v53 main > div > section:nth-of-type(4) > div:not(:first-child) button {
        appearance: none !important;
        -webkit-appearance: none !important;
        border: 1px solid rgba(45,212,191,.4) !important;
        border-radius: 999px !important;
        padding: 7px 12px !important;
        background: rgba(13,148,136,.1) !important;
        color: #5eead4 !important;
      }
      @media (max-width: 380px) {
        .financial-shell-v53 main > div > section:nth-of-type(4) > button {
          grid-template-columns: 38px 52px minmax(54px,1fr) auto 12px !important;
          gap: 7px !important;
          padding: 12px 9px !important;
        }
        .financial-shell-v53 main > div > section:nth-of-type(4) > button::before {
          width: 36px;
          height: 36px;
          font-size: 16px;
        }
      }
    `}</style>
  </div>;
}
