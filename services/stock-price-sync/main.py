"""
每日股價同步：抓 Kang-Core 持股清單 -> finlab 收盤價 -> POST 回 Kang-Core webhook。
不直接寫 Firestore，只透過 CRON_SECRET 驗證的 HTTP 端點溝通（比照 threads-scraper 架構）。
"""
import os
import sys

import requests
import finlab
from finlab import data

KANG_CORE_API_BASE_URL = os.environ["KANG_CORE_API_BASE_URL"].strip().rstrip("/")
CRON_SECRET = os.environ["CRON_SECRET"].strip()
HEADERS = {"Authorization": f"Bearer {CRON_SECRET}"}


def fetch_tickers() -> list[dict]:
    res = requests.get(f"{KANG_CORE_API_BASE_URL}/api/holdings/tickers", headers=HEADERS, timeout=30)
    res.raise_for_status()
    return res.json().get("tickers", [])


def latest_tw_prices(tickers: list[str]) -> dict[str, tuple[float, str]]:
    """回傳 {ticker: (price, asOfDate)}，找不到的 ticker 不會出現在結果中。"""
    close = data.get("price:收盤價")
    if close.empty:
        return {}
    latest_row = close.iloc[-1]
    as_of = str(close.index[-1].date())
    result = {}
    for ticker in tickers:
        if ticker in latest_row.index and latest_row[ticker] == latest_row[ticker]:  # 排除 NaN
            result[ticker] = (float(latest_row[ticker]), as_of)
    return result


def latest_us_prices(tickers: list[str]) -> dict[str, tuple[float, str]]:
    """先查個股 us_price，查不到的再查 ETF/基金 us_fund_price。"""
    result: dict[str, tuple[float, str]] = {}
    remaining = set(tickers)

    data.set_market("us")
    stock_close = data.get("us_price:adj_close")
    if not stock_close.empty:
        latest_row = stock_close.iloc[-1]
        as_of = str(stock_close.index[-1].date())
        for ticker in list(remaining):
            if ticker in latest_row.index and latest_row[ticker] == latest_row[ticker]:
                result[ticker] = (float(latest_row[ticker]), as_of)
                remaining.discard(ticker)

    if remaining:
        data.set_market("us_fund")
        fund_close = data.get("us_fund_price:adj_close")
        if not fund_close.empty:
            latest_row = fund_close.iloc[-1]
            as_of = str(fund_close.index[-1].date())
            for ticker in list(remaining):
                if ticker in latest_row.index and latest_row[ticker] == latest_row[ticker]:
                    result[ticker] = (float(latest_row[ticker]), as_of)

    return result


def push_prices(prices: list[dict]) -> None:
    res = requests.post(
        f"{KANG_CORE_API_BASE_URL}/api/webhook/stock-prices",
        headers=HEADERS,
        json={"prices": prices},
        timeout=30,
    )
    res.raise_for_status()
    print(f"[stock-price-sync] webhook response: {res.json()}")


def main() -> None:
    finlab.login(os.environ["FINLAB_API_TOKEN"])

    tickers = fetch_tickers()
    if not tickers:
        print("[stock-price-sync] 無任何持股，略過同步")
        return

    tw_tickers = [t["ticker"] for t in tickers if t["market"] == "TW"]
    us_tickers = [t["ticker"] for t in tickers if t["market"] == "US"]

    prices: list[dict] = []

    if tw_tickers:
        for ticker, (price, as_of) in latest_tw_prices(tw_tickers).items():
            prices.append({"market": "TW", "ticker": ticker, "price": price, "asOfDate": as_of})

    if us_tickers:
        for ticker, (price, as_of) in latest_us_prices(us_tickers).items():
            prices.append({"market": "US", "ticker": ticker, "price": price, "asOfDate": as_of})

    if not prices:
        print("[stock-price-sync] finlab 沒有回傳任何價格，略過推送")
        return

    push_prices(prices)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 — 排程腳本頂層需要印出完整錯誤並以非 0 結束
        print(f"[stock-price-sync] 失敗: {exc}", file=sys.stderr)
        sys.exit(1)
