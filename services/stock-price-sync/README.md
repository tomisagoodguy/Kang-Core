# stock-price-sync

每日透過 [finlab](https://ai.finlab.tw/) 同步 Kang-Core 使用者持股清單的最新收盤價，推送到 Kang-Core 的 `/api/webhook/stock-prices` 端點（`CRON_SECRET` 驗證），由 GitHub Actions（`.github/workflows/stock-price-sync.yml`）排程執行。

## 環境變數

- `FINLAB_API_TOKEN`
- `KANG_CORE_API_BASE_URL`（Kang-Core 部署網址，例如 `https://kang-core.vercel.app`）
- `CRON_SECRET`

## 本機執行

```bash
uv run --with "finlab>=1.5.9" python main.py
```
