# Spec R5: CSS 模組化 & 頁面元件拆解

## 目標

1. 將 `globals.css` 845 行拆解為語義化的 CSS 模組
2. 將過大的頁面元件拆出子元件

## CSS 拆分計劃

### Before: 單體 globals.css (845 行)

```
globals.css
├── L1-94     CSS Variables (Light + Dark) + Radius
├── L96-127   Reset & Base
├── L128-180  Navbar
├── L182-203  Page Layout
├── L205-275  Glass Card + Tag Badge
├── L277-354  Stat Card + Accounting Card
├── L356-420  Archive Card
├── L422-441  Dashboard Layout
├── L443-498  Filter Bar + Input
├── L500-683  Modal + Card Actions
├── L685-705  Navbar Logout
├── L707-818  Login Page + Animations
├── L820-845  Responsive Breakpoints
```

### After: 模組化結構

| 新檔案 | 來源行號 | 內容 | 預估行數 |
|:---|:---:|:---|:---:|
| `globals.css` (精簡) | L1-127, L182-203 | CSS Variables + Reset + Page Layout | ~130 |
| `styles/navbar.css` | L128-180, L685-705 | Navbar 全部樣式 | ~75 |
| `styles/cards.css` | L205-420 | glass-card, tag-badge, stat-card, accounting-card, archive-card | ~220 |
| `styles/modal.css` | L500-683 | Modal + Card Action Buttons | ~185 |
| `styles/forms.css` | L443-498, L820-845 | Filter, Input, Empty State + Responsive | ~85 |
| `styles/login.css` | L707-818 | Login Page + Animations (float, spin) | ~115 |

### 在 globals.css 中使用 @import

```css
/* globals.css (精簡後) */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@import './styles/navbar.css';
@import './styles/cards.css';
@import './styles/modal.css';
@import './styles/forms.css';
@import './styles/login.css';

:root { /* CSS Variables */ }
/* Reset + Base + Page Layout only */
```

## 頁面元件拆解

### `recurring/page.tsx` (323 行 → ~150 行)

拆出：

- `components/RecurringForm.tsx` — Modal 表單（新增/編輯定期支出）
- `components/RecurringCard.tsx` — 定期支出卡片（含啟停 Toggle、刪除）

### `settings/rules/page.tsx` (275 行 → ~120 行)

拆出：

- `components/RuleEditRow.tsx` — Inline 編輯行（keyword, tag, subTag, 操作按鈕）

### `accounting/page.tsx` (202 行 → ~130 行)

拆出：

- `hooks/useAccountingFilters.ts` — 自訂 React Hook 處理 filter state 與 memo 計算

## 驗收條件

- [ ] `globals.css` 不超過 150 行
- [ ] 每個 CSS 模組檔案不超過 250 行
- [ ] `recurring/page.tsx` 不超過 160 行
- [ ] `settings/rules/page.tsx` 不超過 130 行
- [ ] 視覺呈現完全不變
