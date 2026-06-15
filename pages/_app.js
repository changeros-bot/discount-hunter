import "../styles/globals.css";
import Head from "next/head";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>DCA折價獵人 V10</title>

        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" />

        <meta name="theme-color" content="#071a33" />
        <meta name="mobile-web-app-capable" content="yes" />
      </Head>

      <Component {...pageProps} />
    </>
  );
}
