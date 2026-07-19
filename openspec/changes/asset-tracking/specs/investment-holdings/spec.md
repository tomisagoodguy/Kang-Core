## ADDED Requirements

### Requirement: Recording a buy transaction updates holding average cost

When a user records a `buy` transaction, the system SHALL upsert the corresponding `holdings` document (keyed by `${userId}_${market}_${ticker}`) using weighted-average cost: `newAvgCost = (oldShares * oldAvgCost + txShares * pricePerShare + fee) / (oldShares + txShares)`, and `newShares = oldShares + txShares`.

#### Scenario: First buy of a ticker

- **WHEN** a user buys a ticker with no existing `holdings` document
- **THEN** the system creates a `holdings` document with `shares = txShares` and `avgCost = (txShares * pricePerShare + fee) / txShares`

##### Example: average cost after two buys

| Step | Shares | Price/Share | Fee | Resulting Shares | Resulting AvgCost |
| --- | --- | --- | --- | --- | --- |
| Buy 1 | 10 | 500 | 20 | 10 | 502.00 |
| Buy 2 | 10 | 520 | 20 | 20 | 511.00 |

### Requirement: Recording a sell transaction reduces shares without changing average cost

When a user records a `sell` transaction, the system SHALL decrease `holdings.shares` by the sold quantity and MUST NOT change `holdings.avgCost`. The system SHALL reject a sell transaction where `txShares > holdings.shares`.

#### Scenario: Valid sell

- **WHEN** a user sells 5 shares of a ticker with an existing holding of 20 shares
- **THEN** the resulting holding has 15 shares and the same `avgCost` as before the sell

#### Scenario: Overselling is rejected

- **WHEN** a user attempts to sell more shares than `holdings.shares`
- **THEN** the API returns HTTP 400 and the `holdings` document is left unchanged

### Requirement: Optional linked cash-flow entry

When creating a `buy` transaction, the system SHALL offer the user a checkbox (default checked) to also create an `accounting` entry with `tag: "Investment"` and `amount = shares * pricePerShare + fee`. For `sell` transactions, the system MUST NOT offer this checkbox, because `AccountingEntrySchema.amount` only accepts positive values and the `Investment` tag's existing semantics are expense-only.

#### Scenario: Buy with cash-flow entry enabled

- **WHEN** a user submits a buy transaction with the checkbox checked
- **THEN** one `investment_transactions` document and one `accounting` document (`tag: "Investment"`) are created, linked via `linkedAccountingEntryId`

#### Scenario: Buy with cash-flow entry disabled

- **WHEN** a user submits a buy transaction with the checkbox unchecked (e.g. because they already logged the expense via LINE)
- **THEN** only the `investment_transactions` and `holdings` documents are created; no `accounting` document is created

### Requirement: Holdings list with unrealized profit/loss

The `/assets` page SHALL display each holding's ticker, shares, average cost, current price (falling back to average cost if unavailable), market value, and unrealized profit/loss (`(currentPrice - avgCost) * shares`), colored red for gain and green for loss (Taiwan convention).

#### Scenario: Current price available

- **WHEN** a holding has `currentPrice` set
- **THEN** the unrealized P&L is computed against `currentPrice` and displayed in the correct color

#### Scenario: Current price missing

- **WHEN** a holding has no `currentPrice` (never synced or ticker unsupported by finlab)
- **THEN** market value falls back to `avgCost * shares`, unrealized P&L displays as 0, and an "no current price" note is shown
