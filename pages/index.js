import { useEffect, useState } from "react";

export default function Home() {
  const [assets, setAssets] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    fetch("/api/prices")
      .then((res) => res.json())
      .then((data) => {
        setAssets(data.data || []);
        setUpdatedAt(data.updatedAt || "");
      });
  }, []);

  const sortedAssets = [...assets].sort((a, b) => {
    const order = {
      "第四買點": 1,
      "第三買點": 2,
      "第二買點": 3,
      "第一買點": 4,
      "尚未到買點": 5
    };
    return order[a.signal?.text] - order[b.signal?.text];
  });

  const buyList = sortedAssets.filter((a) => a.signal?.text !== "尚未到買點");

  return (
    <main className="page">
      <section className="hero">
        <h1>折扣獵人 V9</h1>
        <p>幣安換便宜戰情表｜即時價格 × 52週高點</p>
        <div className="update">
          更新：{updatedAt ? new Date(updatedAt).toLocaleString() : "讀取中"}
        </div>
      </section>

      <section className="summary">
        <div>
          <span>今日可出手</span>
          <strong>{buyList.length} 檔</strong>
        </div>
        <div>
          <span>監控名單</span>
          <strong>{assets.length} 檔</strong>
        </div>
      </section>

      {buyList.length > 0 && (
        <section className="alertBox">
          🎯 今日可出手：
          {buyList.map((a) => a.symbol).join("、")}
        </section>
      )}

      <section className="list">
        {sortedAssets.map((a) => (
          <div
            className={`card ${
              a.signal?.text === "尚未到買點" ? "idle" : "active"
            }`}
            key={a.symbol}
          >
            <div className="cardTop">
              <div>
                <h2>{a.symbol}</h2>
                <p>{a.name}</p>
              </div>

              <div className="badge">{a.grade}級</div>
            </div>

            <div
              className={`signal ${
                a.signal?.text === "尚未到買點" ? "gray" : "green"
              }`}
            >
              {a.signal?.text}
            </div>

            <div className="dataGrid">
              <div>
                <span>{a.highType || "52週高點"}</span>
                <strong>{a.high}</strong>
              </div>
              <div>
                <span>現價</span>
                <strong>{a.price}</strong>
              </div>
              <div>
                <span>跌幅</span>
                <strong>{a.discount}%</strong>
              </div>
              <div>
                <span>建議投入</span>
                <strong>{a.signal?.amount || "0"}</strong>
              </div>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}