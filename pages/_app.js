import "../styles/globals.css";
import "../styles/v10.css";
import "../styles/title-gold.css";
import "../styles/hero-poster.css";
import "../styles/v15-unified.css";
import "../styles/v15-fix.css";
import Head from "next/head";

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
  </>;
}
