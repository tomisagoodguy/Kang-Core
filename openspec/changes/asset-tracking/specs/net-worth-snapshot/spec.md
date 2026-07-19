## ADDED Requirements

### Requirement: Manual cash input with server-computed investment and loan values

When a user creates a `net_worth_snapshots` entry, the system SHALL accept a manually entered `cashBalance` from the user, and MUST compute `investmentValueTWD` and `loanBalance` on the server rather than trusting client-submitted values.

#### Scenario: Snapshot creation

- **WHEN** a user submits a snapshot with `cashBalance = 200000`
- **THEN** the server computes `investmentValueTWD` from the user's current `holdings` and `loanBalance` from the user's `active` `loans`, and stores `netWorth = cashBalance + investmentValueTWD - loanBalance`

#### Scenario: Client attempts to override computed fields

- **WHEN** a POST body includes `investmentValueTWD` or `loanBalance` fields set by the client
- **THEN** the server ignores those fields and recomputes them from `holdings`/`loans`

### Requirement: USD holdings converted to TWD using live exchange rate

When computing `investmentValueTWD`, the system SHALL convert `market == "US"` holdings' market value to TWD using `fetchRateToTWD("USD")`, and SHALL sum `market == "TW"` holdings' market value directly (already in TWD).

#### Scenario: Mixed TW and US holdings

- **WHEN** a user holds both TW-market and US-market tickers with `currentPrice` set
- **THEN** `investmentValueTWD` equals the sum of TW holdings' market value plus US holdings' market value multiplied by the live USD→TWD rate

### Requirement: Loan balance excludes settled loans

`loanBalance` SHALL be the sum of `remainingPrincipal` across the user's `loans` documents where `status == "active"`, excluding `settled` loans.

#### Scenario: One active, one settled loan

- **WHEN** a user has one loan with `remainingPrincipal = 300000, status = "active"` and one with `remainingPrincipal = 0, status = "settled"`
- **THEN** `loanBalance` equals 300000

### Requirement: Net worth trend chart

The `/assets` page SHALL render a chronological line chart of `netWorth` from all of the user's `net_worth_snapshots`, ordered by `date` ascending.

#### Scenario: Multiple snapshots over time

- **WHEN** a user has recorded snapshots for three different months
- **THEN** the chart displays three points in chronological order, not creation order

##### Example: out-of-order creation still sorts by date

| Created Order | date | netWorth |
| --- | --- | --- |
| 1st | 2026-07-01 | 850000 |
| 2nd | 2026-05-01 | 800000 |
| 3rd | 2026-06-01 | 820000 |

Chart displays points in order: 2026-05-01 (800000), 2026-06-01 (820000), 2026-07-01 (850000).
