import { useEffect, useMemo, useState } from "react";

const ruleColors = ["🟢", "🟡", "🟠", "🔴"];
const levelNames = ["", "第一層", "第二層", "第三層", "第四層"];
const levelClasses = ["idle", "level1", "level2", "level3", "level4"];

function parseAmount(value) {
  const number = Number(String(value || "0").replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

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

  const sortedAssets = useMemo(() => {
    return [...assets].sort((a, b) => {
      const getLevel = (x) => x.signal?.level || 99;
      return getLevel(a) - getLevel(b);
    });
  }, [assets]);

  const buyList = sortedAssets.filter((a) => a.signal?.level > 0);
  const idleList = sortedAssets.filter((a) => !a.signal?.level);
  const totalAmount = buyList.reduce((sum, asset) => sum + parseAmount(asset.signal?.amount), 0);

  return (
    <main className="page">
      <section className="hero compactHero">
        <div className="versionPill">DCA 折價獵人 V10</div>
        <h1>今日戰情室</h1>
        <p>30秒決策：今天該不該買、買哪幾檔、總共投入多少。</p>
        <div className="update">
          更新：{updatedAt ? new Date(updatedAt).toLocaleString() : "讀取中"}
        </div>
      </section>

      <section className="warRoom">
        <div className="warRoomHeader">
          <div>
            <span>今日訊號</span>
            <strong>{buyList.length} 檔</strong>
          </div>
          <div>
            <span>建議總投入</span>
            <strong>{totalAmount}U</strong>
          </div>
        </div>

        {buyList.length > 0 ? (
          <div className="missionList">
            {buyList.map((asset) => {
              const level = asset.signal?.level || 0;
              const amount = parseAmount(asset.signal?.amount);

              return (
                <div className={`missionItem ${levelClasses[level] || "idle"}`} key={asset.symbol}>
                  <div className="missionLeft">
                    <span className="signalDot">{ruleColors[level - 1]}</span>
                    <div>
                      <strong>{asset.symbol}</strong>
                      <p>{levelNames[level]}｜回撤 {asset.discount}%</p>
                    </div>
                  </div>
                  <div className="missionAmount">{amount}U</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="emptyMission">
            <strong>今天沒有任務</strong>
            <p>沒有標的達到買點，保持現金，關掉 App。</p>
          </div>
        )}
      </section>

      <section className="quickRule">
        <div><span>🟢 第一層</span><strong>5U</strong></div>
        <div><span>🟡 第二層</span><strong>10U</strong></div>
        <div><span>🟠 第三層</span><strong>15U</strong></div>
        <div><span>🔴 第四層</span><strong>20U</strong></div>
      </section>

      <section className="sectionTitle">
        <h2>全部監控</h2>
        <p>已達買點自動置頂；未達買點收在下方。</p>
      </section>

      <section className="list">
        {buyList.map((a) => (
          <AssetCard asset={a} key={a.symbol} />
        ))}

        {idleList.length > 0 && (
          <details className="idleGroup">
            <summary>尚未到買點｜{idleList.length} 檔</summary>
            <div className="idleList">
              {idleList.map((a) => (
                <AssetCard asset={a} key={a.symbol} />
              ))}
            </div>
          </details>
        )}
      </section>

      <section className="infoFooter">
        <h3>V10 產品原則</h3>
        <p>首頁只回答一件事：今天要不要買、買多少。任何會讓30秒變成3分鐘的功能，都先不要放進首頁。</p>

        <h3>資料說明</h3>
        <p>現價由 Finnhub 抓取；跌幅由 App 依「現價 ÷ 參考高點 - 1」自動計算。</p>
        <p>SPCX 因上市未滿 52 週，暫用開市以來最高點作為參考高點。</p>
      </section>
    </main>
  );
}

function AssetCard({ asset }) {
  const level = asset.signal?.level || 0;
  const levelClass = levelClasses[level] || "idle";

  return (
    <div className={`card ${level > 0 ? "active" : "idle"} ${levelClass}`}>
      <div className="cardTop">
        <div className="titleRow">
          <div className="logoText">{asset.symbol.slice(0, 2)}</div>
          <div>
            <h2>{asset.symbol}</h2>
            <p>{asset.name}</p>
            <p className="desc">{asset.grade}級 ｜ {asset.description}</p>
          </div>
        </div>
        <div className="badge">{asset.grade}級</div>
      </div>

      <div className={`signal ${levelClass}`}>
        {level > 0 ? `${ruleColors[level - 1]} ${levelNames[level]}｜建議 ${parseAmount(asset.signal?.amount)}U` : "尚未到買點"}
      </div>

      <div className="dataGrid">
        <div>
          <span>{asset.highType || "52週高點"}</span>
          <strong>{asset.high}</strong>
        </div>
        <div>
          <span>現價</span>
          <strong>{asset.price}</strong>
        </div>
        <div>
          <span>回撤</span>
          <strong>{asset.discount}%</strong>
        </div>
        <div>
          <span>建議投入</span>
          <strong>{parseAmount(asset.signal?.amount)}U</strong>
        </div>
      </div>

      <div className="ruleBox">
        <h4>買點規則</h4>
        {asset.rules?.map((rule, idx) => (
          <div key={idx} className={level === idx + 1 ? "rule activeRule" : "rule"}>
            <span>{ruleColors[idx]} 第{idx + 1}層</span>
            <strong>{rule}% → {asset.amounts?.[idx]}U</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
