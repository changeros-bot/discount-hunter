const { sendTelegramMessage } = require("../../lib/telegram/notify");

async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      version: "16.1-telegram-test-post-only",
      previewOnly: true,
      message: "Use POST /api/telegram-test to send a Telegram test message.",
      sendsTelegram: false,
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const now = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
  const message = [
    "🚨 DCA折價獵人 Telegram 測試",
    "",
    "狀態：連線成功測試",
    `時間：${now}`,
    "",
    "下一步：接買點警報與 Wallet 異常通知。",
  ].join("\n");

  try {
    const result = await sendTelegramMessage(message);
    if (!result.ok) {
      return res.status(500).json({ ok: false, ...result });
    }
    return res.status(200).json({ ok: true, sent: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "Telegram test failed" });
  }
}

module.exports = handler;
