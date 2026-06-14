const assets = [
  { symbol: "QQQ", name: "Invesco QQQ", grade: "A+ 核心ETF", high: 748.65, price: 721.37, rules: [-15, -25, -35, -50] },
  { symbol: "NVDA", name: "NVIDIA", grade: "A 核心資產", high: 236.54, price: 205.14, rules: [-15, -25, -35, -50] },
  { symbol: "TSM", name: "Taiwan Semiconductor", grade: "A 核心資產", high: 450.16, price: 423.77, rules: [-15, -25, -35, -50] },
  { symbol: "AVGO", name: "Broadcom", grade: "A 核心資產", high: 495.00, price: 381.91, rules: [-15, -25, -35, -50] },
  { symbol: "SPCX", name: "SpaceX Tokenized", grade: "A- 高成長潛力", high: 176.00, price: 161.29, rules: [-20, -35, -50, -65] },
  { symbol: "GOOGL", name: "Alphabet", grade: "B 成長型資產", high: 408.61, price: 359.67, rules: [-20, -35, -50, -65] },
  { symbol: "AMD", name: "Advanced Micro Devices", grade: "B 成長型資產", high: 546.44, price: 511.05, rules: [-20, -35, -50, -65] },
  { symbol: "MRVL", name: "Marvell", grade: "B 成長型資產", high: 324.20, price: 279.58, rules: [-20, -35, -50, -65] },
  { symbol: "RKLB", name: "Rocket Lab", grade: "C 高風險資產", high: 151.00, price: 102.40, rules: [-25, -40, -60] }
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