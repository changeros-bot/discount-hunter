const assets = [
  { symbol: "QQQ", name: "Invesco QQQ", grade: "A+ 核心ETF", high: 560, price: 520, rules: [-15, -25, -35, -50] },
  { symbol: "NVDA", name: "NVIDIA", grade: "A 核心資產", high: 150, price: 126, rules: [-15, -25, -35, -50] },
  { symbol: "TSM", name: "台積電", grade: "A 核心資產", high: 220, price: 198, rules: [-15, -25, -35, -50] },
  { symbol: "AVGO", name: "Broadcom", grade: "A 核心資產", high: 280, price: 245, rules: [-15, -25, -35, -50] },
  { symbol: "SPCX", name: "SpaceX / Ondo Tokenized", grade: "A- 高成長潛力", high: 100, price: 78, rules: [-20, -35, -50, -65] },
  { symbol: "GOOGL", name: "Alphabet", grade: "B 成長型資產", high: 200, price: 156, rules: [-20, -35, -50, -65] },
  { symbol: "AMD", name: "Advanced Micro Devices", grade: "B 成長型資產", high: 180, price: 150, rules: [-20, -35, -50, -65] },
  { symbol: "MRVL", name: "Marvell Technology", grade: "B 成長型資產", high: 120, price: 76, rules: [-20, -35, -50, -65] },
  { symbol: "RKLB", name: "Rocket Lab", grade: "C 高風險資產", high: 40, price: 28, rules: [-25, -40, -60] },
];

function getSignal(drop, rules) {
  if (drop <= rules[3]) return { text: "第四買點", amount: "20 美元", color: "#ef4444" };
  if (drop <= rules[2]) return { text: "第三買點", amount: "15 美元", color: "#f97316" };
  if (drop <= rules[1]) return { text: "第二買點", amount: "10 美元", color: "#eab308" };
  if (drop <= rules[0]) return { text: "第一買點", amount: "5 美元", color: "#22c55e" };
  return { text: "尚未到買點", amount: "0", color: "#64748b" };
}

export default function Home() {
  return (
    <div className="container">
      <h1>折扣獵人 V4</h1>
      <p style={{ textAlign: "center", color: "#94a3b8" }}>
        幣安換便宜戰情表 V9｜只看距離 52 週高點跌多少
      </p>

      {assets.map((a) => {
        const drop = ((a.price / a.high) - 1) * 100;
        const signal = getSignal(drop, a.rules);

        return (
          <div className="card" key={a.symbol}>
            <h2>{a.symbol}</h2>
            <p>{a.name}</p>
            <p>{a.grade}</p>
            <p>52週高點：{a.high}</p>
            <p>現價：{a.price}</p>
            <p>跌幅：{drop.toFixed(1)}%</p>
            <p style={{ color: signal.color, fontWeight: "bold" }}>
              {signal.text}
            </p>
            <p>建議投入：{signal.amount}</p>
          </div>
        );
      })}
    </div>
  );
}