import "../styles/globals.css";
import "../styles/v10.css";
import "../styles/title-gold.css";
import "../styles/hero-poster.css";
import "../styles/v15-unified.css";
import "../styles/v15-fix.css";
import Head from "next/head";

function Changelog() {
  return <details className="changelogBox">
    <summary>📜 更新紀錄</summary>
    <div className="changelogContent">
      <section>
        <strong>V15.8</strong>
        <p>新增更新紀錄系統，保留 Footer 版本號與最後同步時間。</p>
      </section>
      <section>
        <strong>V15.7</strong>
        <p>重新同步按鈕、Loading 狀態、Toast 提示、手機版優化、移除部署率、Security 強化、Accessibility 強化。</p>
      </section>
      <section>
        <strong>V15.6</strong>
        <p>首頁 Index 重構，保留今日決策、鏈上持倉、動態排序與 30 秒決策流程。</p>
      </section>
    </div>
  </details>;
}

export default function App({ Component, pageProps }) {
  return <>
    <Head>
      <title>DCA 折價獵人</title>
      <meta name="description" content="DCA 折價獵人：手機版追蹤儀表板。" />
      <meta property="og:title" content="DCA 折價獵人" />
      <meta property="og:description" content="手機版追蹤儀表板，快速查看狀態與更新。" />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content="DCA 折價獵人" />
      <meta name="twitter:description" content="手機版追蹤儀表板，快速查看狀態與更新。" />
    </Head>
    <Component {...pageProps} />
    <Changelog />
  </>;
}
