export default async function handler(req, res) {
  const symbols = ["QQQ","NVDA"];

  try {
    const url =
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}`;

    const response = await fetch(url);

    const data = await response.json();

    res.status(200).json(data);

  } catch(error) {

    res.status(500).json({
      error:error.message
    });

  }
}