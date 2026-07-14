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

  return <FinancialOS />;
}
