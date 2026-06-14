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

  return (
    <div className="container">
      <h1>折扣獵人 V9</h1>
      <p className="subtitle">幣安換便宜戰情表｜即時價格＋52週高點</p>

      <p className="time">
        更新時間：{updatedAt ? new Date(updatedAt).toLocaleString() : "讀取中"}
      </p>

      {sortedAssets.map((a) => (
        <div className="card" key={a.symbol}>
          <div className="top">
            <div>
              <h2>{a.symbol}</h2>
              <p>{a.name}</p>
              <p>{a.grade} 級</p>
            </div>

            <div
              className="signal"
              style={{ color: a.signal?.color || "gray" }}
            >
              {a.signal?.text}
            </div>
          </div>

          <div className="row">
            <span>{a.highType || "52週高點"}</span>
            <strong>{a.high}</strong>
          </div>

          <div className="row">
            <span>現價</span>
            <strong>{a.price}</strong>
          </div>

          <div className="row">
            <span>跌幅</span>
            <strong>{a.discount}%</strong>
          </div>

          <div className="amount">
            建議投入：{a.signal?.amount || "0"}
          </div>
        </div>
      ))}
    </div>
  );
}