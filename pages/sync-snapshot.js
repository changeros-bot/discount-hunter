const SNAPSHOT = {
  RKLBon: { value: 5.11802, price: 110.22, type: "dipBuy", levels: [1], label: "第一買點" },
  AVGOon: { value: 4.96575, price: 393.84, type: "dipBuy", levels: [1], label: "第一買點" },
  MRVLon: { value: 5.08161, price: 306.68, type: "monthlyDca", levels: [], label: "今日DCA" },
  NVDAon: { value: 5.0423, price: 211.43, type: "monthlyDca", levels: [], label: "今日DCA" },
  TSMon: { value: 4.99885, price: 441.19, type: "monthlyDca", levels: [], label: "今日DCA" },
  AMDon: { value: 5.02267, price: 548.49, type: "monthlyDca", levels: [], label: "今日DCA" },
  QQQon: { value: 5.01754, price: 745.9, type: "monthlyDca", levels: [], label: "今日DCA" },
  GOOGLon: { value: 4.96886, price: 367.97, type: "monthlyDca", levels: [], label: "今日DCA" },
  SPCXon: { value: 4.90445, price: 212.62, type: "monthlyDca", levels: [], label: "今日DCA" }
};

function todayText() {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function buildData() {
  const date = todayText();
  const holdings = {};
  const tradeHistory = [];
  Object.entries(SNAPSHOT).forEach(([symbol, item], index) => {
    const qty = item.value / item.price;
    holdings[symbol] = {
      qty: String(Number(qty.toFixed(10))),
      cost: String(item.price),
      type: item.type,
      executedLevels: item.levels,
      note: `${item.label}｜依 Binance 錢包截圖同步`
    };
    tradeHistory.push({
      id: `snapshot-${date}-${index}-${symbol}`,
      date,
      symbol,
      level: item.levels[0] || 0,
      levelName: item.levels[0] ? "第一層" : "DCA",
      amount: item.value,
      price: item.price,
      note: "依 Binance 錢包截圖同步"
    });
  });
  return { holdings, tradeHistory };
}

export default function SyncSnapshot() {
  function syncNow() {
    const { holdings, tradeHistory } = buildData();
    localStorage.setItem("discountHunterHoldings", JSON.stringify(holdings));
    localStorage.setItem("discountHunterTradeHistory", JSON.stringify(tradeHistory));
    alert("已同步 9 檔：7 檔 DCA + 2 檔第一買點。返回 V15 即可查看。");
    location.href = "/index-v15";
  }

  return (
    <main style={{ minHeight: "100vh", background: "#020617", color: "white", padding: 24, fontFamily: "system-ui" }}>
      <h1>Binance 截圖持倉同步</h1>
      <p style={{ color: "#cbd5e1", lineHeight: 1.6 }}>依你今天的 Binance 錢包截圖，先手動同步 9 檔持倉與交易日誌。CSV 到了之後再改成完整匯入。</p>
      <button onClick={syncNow} style={{ width: "100%", padding: 16, borderRadius: 14, border: 0, background: "#2563eb", color: "white", fontWeight: 900, fontSize: 18 }}>同步 9 檔持倉</button>
      <div style={{ marginTop: 20, background: "#0f172a", padding: 16, borderRadius: 14 }}>
        {Object.entries(SNAPSHOT).map(([symbol, item]) => (
          <div key={symbol} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e293b" }}>
            <span>{symbol}｜{item.label}</span><strong>{item.value}U</strong>
          </div>
        ))}
      </div>
    </main>
  );
}
