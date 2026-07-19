## ADDED Requirements

### Requirement: Daily price sync via GitHub Actions

The system SHALL run `services/stock-price-sync` once per day via a scheduled GitHub Actions workflow, fetching the latest close price for every distinct `{market, ticker}` pair present across all users' `holdings` from finlab, and pushing results to Kang-Core via webhook rather than writing directly to Firestore.

#### Scenario: Scheduled run with holdings present

- **WHEN** the GitHub Actions schedule fires and at least one `holdings` document exists
- **THEN** the workflow calls `GET /api/holdings/tickers`, fetches prices via finlab for each returned ticker, and calls `POST /api/webhook/stock-prices` with the results

#### Scenario: No holdings exist

- **WHEN** `GET /api/holdings/tickers` returns an empty list
- **THEN** the workflow SHALL skip the finlab fetch and exit successfully without error

### Requirement: Ticker list endpoint requires CRON_SECRET

`GET /api/holdings/tickers` SHALL require `Authorization: Bearer $CRON_SECRET` and SHALL return a deduplicated list of `{ market, ticker }` across all users, without exposing per-user share counts or costs.

#### Scenario: Missing or invalid secret

- **WHEN** a request is made without a valid `CRON_SECRET` bearer token
- **THEN** the API returns HTTP 401 and no ticker data

### Requirement: Price webhook updates market_prices and holdings

`POST /api/webhook/stock-prices` SHALL require `Authorization: Bearer $CRON_SECRET`, accept a body of `{ prices: { market, ticker, price, asOfDate }[] }`, upsert each into `market_prices/{market}_{ticker}`, and batch-update `currentPrice`/`priceAsOf` on every matching `holdings` document across all users.

#### Scenario: Successful price push

- **WHEN** the webhook receives a valid price array for tickers held by multiple users
- **THEN** `market_prices` is updated for each ticker and every `holdings` document with that `{market, ticker}` gets its `currentPrice`/`priceAsOf` updated

#### Scenario: Unsupported or delisted ticker

- **WHEN** finlab cannot return a price for a given ticker (delisted, unsupported market)
- **THEN** that ticker is omitted from the webhook payload and its `holdings.currentPrice` SHALL remain at its last successfully synced value (stale-but-present, not cleared)

### Requirement: Stale price indicator

The `/assets` holdings list SHALL display how many days have elapsed since `holdings.priceAsOf` when it is older than 2 days.

#### Scenario: Price synced yesterday

- **WHEN** `priceAsOf` is 1 day before today
- **THEN** no staleness indicator is shown

#### Scenario: Price sync has been failing

- **WHEN** `priceAsOf` is more than 2 days before today
- **THEN** the UI shows a "price not updated for N days" note next to that holding
