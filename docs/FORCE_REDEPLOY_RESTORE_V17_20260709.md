# Force redeploy: restore /v17 discount hunter layout

Time: 2026-07-09

Purpose:
- Force Vercel to rebuild after reverting `/pages/v17.js` to the pre-paper-trading layout.
- `/v17` must remain the live Discount Hunter page only.
- Paper trading must remain isolated in `/market-91-paper` and must not appear on `/v17`.

Expected `/v17` blocks:
1. 系統邊界
2. 今日 Action Gate
3. 現金與預算
4. 真實持倉
5. 觀察區
6. 入口

Forbidden on `/v17`:
- Paper Trading ON
- 紙上交易買點
- 紙上交易績效測試
- `/api/v17/market-91-paper` fetch
