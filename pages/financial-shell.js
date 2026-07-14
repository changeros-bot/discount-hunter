import FinancialOS from "./financial-os";

export default function FinancialShell() {
  return <>
    <FinancialOS />
    <a
      href="/financial-audit"
      aria-label="進入多元記帳本查帳頁"
      style={{
        position: "fixed",
        right: 14,
        bottom: 76,
        zIndex: 9999,
        minWidth: 86,
        textAlign: "center",
        textDecoration: "none",
        border: "1px solid rgba(212,175,55,.78)",
        borderRadius: 16,
        padding: "11px 14px",
        background: "linear-gradient(180deg,rgba(250,204,21,.34),rgba(92,64,16,.92))",
        color: "#fff7bd",
        fontSize: 13,
        fontWeight: 1000,
        boxShadow: "0 10px 28px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.35)",
        backdropFilter: "blur(10px)",
      }}
    >
      查帳
    </a>
  </>;
}
