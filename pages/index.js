import { useEffect, useState } from "react";

const ruleColors = ["🟢", "🟡", "🟠", "🔴"];

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
        <p>幣安換便宜戰情表｜即時價格 × 參考高點</p>
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
          🎯 今日可出手：{buyList.map((a) => a.symbol).join("、")}
        </section>
      )}

      <section className="strategyBox">
        <h3>V9 操作原則</h3>
        <p>只看距離高點跌多少，不追高、不猜底。</p>
        <p>符合買點才分批投入，每筆 5 / 10 / 15 / 20 美元。</p>
        <p>長期持有，不因短線漲跌賣出。</p>
      </section>

      <section className="strategyBox">
        <h3>資料說明</h3>
        <p>現價：Finnhub 即時抓取。</p>
        <p>跌幅：App 依「現價 ÷ 參考高點 - 1」自動計算。</p>
        <p>52週高點屬慢變數，必要時採手動備援，避免 API 異常造成誤判。</p>
        <p>SPCX 因上市未滿 52 週，暫用 IPO 以來高點作為參考高點。</p>
      </section>

      <section className="strategyBox">
        <h3>年度審查</h3>
        <p>每年 1 月 1 日或 11 月 12 日檢查一次。</p>
        <p>只問：公司是否仍值得留在 V9 名單？</p>
        <p>不看報酬率、不看成本、不為過去決策辯護。</p>
      </section>

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
                <p className="desc">
                  {a.grade}級 ｜ {a.description}
                </p>
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

            <div className="ruleBox">
              <h4>買點規則</h4>

              {a.rules?.map((rule, idx) => (
                <div
                  key={idx}
                  className={
                    a.signal?.level === idx + 1 ? "rule activeRule" : "rule"
                  }
                >
                  <span>
                    {ruleColors[idx]} 第{idx + 1}買點
                  </span>
                  <strong>
                    {rule}% → {a.amounts?.[idx]} 美元
                  </strong>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}