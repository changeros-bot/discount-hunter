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
    const getLevel = (x) => x.signal?.level || 99;
    return getLevel(a) - getLevel(b);
  });

  const buyList = sortedAssets.filter((a) => a.signal?.level > 0);

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

      <section className="list">
        {sortedAssets.map((a) => (
          <div className={`card ${a.signal?.level > 0 ? "active" : "idle"}`} key={a.symbol}>
            <div className="cardTop">
              <div className="titleRow">
                <div className="logoText">{a.symbol.slice(0, 2)}</div>
                <div>
                  <h2>{a.symbol}</h2>
                  <p>{a.name}</p>
                  <p className="desc">{a.grade}級 ｜ {a.description}</p>
                </div>
              </div>
              <div className="badge">{a.grade}級</div>
            </div>

            <div className={`signal ${a.signal?.level > 0 ? "green" : "gray"}`}>
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
                <div key={idx} className={a.signal?.level === idx + 1 ? "rule activeRule" : "rule"}>
                  <span>{ruleColors[idx]} 第{idx + 1}買點</span>
                  <strong>{rule}% → {a.amounts?.[idx]} 美元</strong>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="infoFooter">
        <h3>V9 操作原則</h3>
        <p>只看距離高點跌多少，不追高、不猜底；符合買點才分批投入。</p>

        <h3>資料說明</h3>
        <p>現價由 Finnhub 抓取；跌幅由 App 依「現價 ÷ 參考高點 - 1」自動計算。</p>
        <p>SPCX 因上市未滿 52 週，暫用開市以來最高點作為參考高點。</p>
        <p>目前手動高點：TSM、SPCX。其他標的優先使用 Finnhub 52週高點。</p>

        <h3>年度審查</h3>
        <p>每年 1 月 1 日或 11 月 12 日檢查一次，只問公司是否仍值得留在 V9 名單。</p>
      </section>
    </main>
  );
}