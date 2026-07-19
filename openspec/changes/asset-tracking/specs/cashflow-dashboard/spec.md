## ADDED Requirements

### Requirement: Monthly cash flow aggregation

The system SHALL aggregate existing `accounting` entries by calendar month (`date` field, `YYYY-MM`) into total income (`tag == "Income"`), total expense (all other tags, using `myExpenseTWD()` per entry), and net cash flow (income − expense).

#### Scenario: Month with income and expenses

- **WHEN** a user requests cash flow for a month that has both `Income`-tagged and expense-tagged entries
- **THEN** the API returns `{ month, income, expense, net }` where `net = income - expense`

#### Scenario: Month with no entries

- **WHEN** a user requests cash flow for a month with zero `accounting` entries
- **THEN** the API returns `{ month, income: 0, expense: 0, net: 0 }` instead of omitting the month

##### Example: three-month trend

| Month | Income | Expense | Net |
| --- | --- | --- | --- |
| 2026-05 | 60000 | 42000 | 18000 |
| 2026-06 | 60000 | 55000 | 5000 |
| 2026-07 | 60000 | 38000 | 22000 |

### Requirement: Cash flow trend chart on `/assets`

The `/assets` dashboard page SHALL render a chart showing the last N months (default 12) of income, expense, and net cash flow, sourced from `GET /api/dashboard/cashflow`.

#### Scenario: Default range

- **WHEN** the `/assets` page loads without a query parameter
- **THEN** it requests and displays the last 12 months of cash flow data

### Requirement: No new data storage

The cash flow aggregation SHALL read directly from the existing `accounting` collection and MUST NOT introduce a new Firestore collection or duplicate stored totals.

#### Scenario: Data consistency with `/accounting` page

- **WHEN** a user compares the monthly total shown on `/assets` cash flow chart against the sum shown on the existing `/accounting` page for the same month
- **THEN** the two totals match exactly
