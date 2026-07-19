import { z } from "zod";

export const TagEnum = z.enum([
    "Food",
    "Transport",
    "Entertainment",
    "Utilities",
    "Shopping",
    "Health",
    "Education",
    "Insurance",
    "Subscription",
    "Investment",
    "Travel",
    "Loan",
    "Income",
    "Other",
]);

export const SourceEnum = z.enum(["line", "manual", "system", "line-rule", "line-image", "line-file", "threads"]);

/** 付款方式：現金 / 信用卡 / 電子支付 */
export const PaymentMethodEnum = z.enum(["cash", "credit_card", "e_payment"]);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

/**
 * 代墊 / 借貸結算資訊。
 * - paidBy="me"：我先付，counterparty 欠我（應收）
 * - paidBy="other"：對方先付，我欠 counterparty（應付）
 * - myShare：我實際該負擔的金額（原幣，統計支出只算這份）
 */
export const SettlementSchema = z.object({
    paidBy: z.enum(["me", "other"]),
    counterparty: z.string(), // 對方名稱
    myShare: z.number().nonnegative(), // 我該負擔的金額（原幣）
    settled: z.boolean().default(false),
});
export type Settlement = z.infer<typeof SettlementSchema>;

export const BaseEntrySchema = z.object({
    id: z.string().optional(), // Provided by Firestore Document ID usually
    userId: z.string().optional(), // LINE user ID for multi-user isolation
    createdAt: z.date().optional(), // Added at creation time
    source: SourceEnum.default("line"),
    originalText: z.string(), // Keep original text for reference
});

export const AccountingEntrySchema = BaseEntrySchema.extend({
    amount: z.number().positive(), // 原幣金額（在當地實際付的數字）
    tag: TagEnum,
    subTag: z.string().optional(),
    date: z.string(), // ISO String YYYY-MM-DD
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
    // ── 多幣別（出國模式）─────────────────────────────
    currency: z.string().optional(), // ISO 4217，未設定視為 TWD
    exchangeRate: z.number().positive().optional(), // 1 外幣 = ? 台幣（TWD 為 1）
    amountTWD: z.number().optional(), // 整筆換算台幣 = amount * exchangeRate（統計基準）
    // ── 付款方式 ─────────────────────────────────────
    paymentMethod: PaymentMethodEnum.optional(),
    // ── 代墊 / 借貸 ──────────────────────────────────
    settlement: SettlementSchema.optional(),
});

export type AccountingEntry = z.infer<typeof AccountingEntrySchema>;

export const ArchiveEntrySchema = BaseEntrySchema.extend({
    url: z.string().url().optional(),
    title: z.string().optional(),
    summary: z.string(),
    keywords: z.array(z.string()),
    imageUrl: z.string().url().optional(),
});
export type ArchiveEntry = z.infer<typeof ArchiveEntrySchema>;

export const ThreadsEntrySchema = BaseEntrySchema.extend({
    threadId: z.string(), // Extracted unique ID
    threadUrl: z.string().url(),
    author: z.string(), // username
    authorId: z.string().optional(),
    content: z.string(),
    publishedAt: z.string(), // ISO String
    likeCount: z.number().optional(),
    replyCount: z.number().optional(),
    isDiscovery: z.boolean().default(false), // Found via discovery mode
    isSaved: z.boolean().default(false).optional(), // Manually saved by user
    matchedKeyword: z.string().optional(), // 命中的主題追蹤關鍵字（來自 /threads 主題 追蹤）
});
export type ThreadsEntry = z.infer<typeof ThreadsEntrySchema>;

export const CalendarEntrySchema = BaseEntrySchema.extend({
    title: z.string(),
    actionDate: z.string().optional(), // YYYY-MM-DD
    actionTime: z.string().optional(), // HH:mm
    description: z.string().optional(),
    status: z.enum(["pending", "done"]).default("pending"),
    gcalEventId: z.string().optional(),
});

export type CalendarEntry = z.infer<typeof CalendarEntrySchema>;

export const FrequencyEnum = z.enum(["daily", "weekly", "monthly", "yearly"]);

export const RecurringExpenseSchema = BaseEntrySchema.extend({
    amount: z.number().positive(),
    tag: TagEnum,
    description: z.string(),
    frequency: FrequencyEnum,
    dayOfMonth: z.number().min(1).max(31).optional(),
    dayOfWeek: z.number().min(0).max(6).optional(),
    monthOfYear: z.number().min(1).max(12).optional(),
    isActive: z.boolean().default(true),
    lastTriggeredAt: z.string().optional(), // ISO String
});

export type RecurringExpense = z.infer<typeof RecurringExpenseSchema>;

// ─── Loan（信貸／貸款）──────────────────────────────────
export const LoanSchema = BaseEntrySchema.extend({
    name: z.string(), // 貸款名稱，如「信貸-王小明」
    principal: z.number().positive(), // 原始本金
    annualRate: z.number().nonnegative(), // 年利率 %，如 3.5
    termMonths: z.number().int().positive(), // 總期數
    startDate: z.string(), // YYYY-MM-DD 首期扣款日
    dayOfMonth: z.number().min(1).max(31), // 每月扣款日
    monthlyPayment: z.number().positive(), // 每月應繳（等額本息公式算出）
    remainingPrincipal: z.number().nonnegative(),
    paidInstallments: z.number().int().nonnegative().default(0),
    status: z.enum(["active", "settled"]).default("active"),
    lastTriggeredAt: z.string().optional(), // 避免同日重複扣款
});

export type Loan = z.infer<typeof LoanSchema>;

// ─── Investment（投資交易 / 持股彙總 / 股價 / 淨資產快照）───────────────
export const MarketEnum = z.enum(["TW", "US"]);

export const InvestmentTransactionSchema = BaseEntrySchema.extend({
    market: MarketEnum,
    ticker: z.string(), // 股票/ETF 代號，如 "2330" 或 "AAPL"
    name: z.string().optional(), // 顯示用名稱
    side: z.enum(["buy", "sell"]),
    shares: z.number().positive(),
    pricePerShare: z.number().positive(),
    fee: z.number().nonnegative().default(0),
    date: z.string(), // YYYY-MM-DD
    linkedAccountingEntryId: z.string().optional(), // 對應的現金流紀錄（若有）
});

export type InvestmentTransaction = z.infer<typeof InvestmentTransactionSchema>;

export const HoldingSchema = z.object({
    id: z.string().optional(), // `${userId}_${market}_${ticker}`
    userId: z.string(),
    market: MarketEnum,
    ticker: z.string(),
    name: z.string().optional(),
    shares: z.number().nonnegative(),
    avgCost: z.number().nonnegative(), // 加權平均成本（每股）
    currentPrice: z.number().nonnegative().optional(),
    priceAsOf: z.string().optional(), // YYYY-MM-DD
    updatedAt: z.any().optional(),
});

export type Holding = z.infer<typeof HoldingSchema>;

// market_prices 集合文件形狀（doc id: `${market}_${ticker}`）
export const MarketPriceSchema = z.object({
    market: MarketEnum,
    ticker: z.string(),
    price: z.number().positive(),
    asOfDate: z.string(), // YYYY-MM-DD
    updatedAt: z.any().optional(),
});

export type MarketPrice = z.infer<typeof MarketPriceSchema>;

export const NetWorthSnapshotSchema = z.object({
    id: z.string().optional(),
    userId: z.string(),
    date: z.string(), // YYYY-MM-DD
    cashBalance: z.number(), // 伺服器由 cash_accounts 即時餘額算出，寫入時凍結
    investmentValueTWD: z.number(), // 伺服器算出，寫入時凍結
    loanBalance: z.number(), // 伺服器算出，寫入時凍結
    netWorth: z.number(),
    createdAt: z.any().optional(),
});

export type NetWorthSnapshot = z.infer<typeof NetWorthSnapshotSchema>;

// ─── 現金帳戶（即時餘額 + 異動流水）────────────────────────────
// doc id: userId，單一使用者只有一筆running balance
export const CashAccountSchema = z.object({
    userId: z.string(),
    balance: z.number(), // 即時現金/存款餘額
    updatedAt: z.any().optional(),
});

export type CashAccount = z.infer<typeof CashAccountSchema>;

export const CashTransactionTypeEnum = z.enum([
    "deposit", // 手動存入，如薪水入帳
    "withdrawal", // 手動提出
    "adjustment", // 手動校正為指定餘額（如第一次設定期初餘額）
    "investment_buy", // 買股票自動扣減（系統寫入，不可手動新增）
    "investment_sell", // 賣股票自動增加（系統寫入，不可手動新增）
]);

export const CashTransactionSchema = z.object({
    id: z.string().optional(),
    userId: z.string(),
    type: CashTransactionTypeEnum,
    amount: z.number(), // 對餘額的淨影響（正數增加、負數減少）
    description: z.string().optional(),
    date: z.string(), // YYYY-MM-DD
    linkedInvestmentTransactionId: z.string().optional(),
    createdAt: z.any().optional(),
});

export type CashTransaction = z.infer<typeof CashTransactionSchema>;
export type CashTransactionType = z.infer<typeof CashTransactionTypeEnum>;

// ─── 旅程紀錄（旅遊模式關閉時自動落地）────────────────────────────
export const TripSchema = z.object({
    id: z.string().optional(),
    userId: z.string(),
    destination: z.string().nullable(), // 啟動時未偵測到目的地則為 null
    startDate: z.string(), // YYYY-MM-DD（旅遊模式啟動日）
    endDate: z.string(), // YYYY-MM-DD（旅遊模式關閉日）
    days: z.number().positive(), // 含頭尾天數
    totalTWD: z.number().nonnegative(), // 期間 Travel 標籤支出加總（myExpenseTWD），關閉時凍結
    currency: z.string().nullable().optional(), // 當地幣別
    createdAt: z.any().optional(),
});

export type Trip = z.infer<typeof TripSchema>;

export const GeminiParseResultSchema = z.object({
    type: z.enum(["accounting", "archive", "calendar", "recurring", "query", "clear_memory", "unknown"]),
    accountingDataList: z.array(AccountingEntrySchema.omit({
        id: true,
        createdAt: true,
        source: true,
        originalText: true,
    })).optional(),
    accountingData: AccountingEntrySchema.omit({
        id: true,
        createdAt: true,
        source: true,
        originalText: true,
    }).optional(),
    archiveData: ArchiveEntrySchema.omit({
        id: true,
        createdAt: true,
        source: true,
        originalText: true,
    }).optional(),
    calendarData: CalendarEntrySchema.omit({
        id: true,
        createdAt: true,
        source: true,
        originalText: true,
    }).optional(),
    queryData: z.object({
        queryType: z.enum(["expense", "archive", "calendar", "semantic_search"]),
        tag: z.string().optional(),
        period: z.string().optional(),
        limit: z.number().optional(),
        semanticQuery: z.string().optional(), // For RAG search
    }).optional(),
    recurringData: RecurringExpenseSchema.omit({
        id: true,
        createdAt: true,
        isActive: true,
        lastTriggeredAt: true,
    }).optional(),
    explanation: z.string().optional(),
    isError: z.boolean().default(false),
    errorMessage: z.string().optional(),
});

export type GeminiParseResult = z.infer<typeof GeminiParseResultSchema>;

export const CustomTagSchema = z.object({
    id: z.string().optional(),
    userId: z.string().optional(),
    name: z.string(),
    parentTag: TagEnum,
    createdAt: z.date().optional(),
});

export type CustomTag = z.infer<typeof CustomTagSchema>;

// ─── Classification Rule ───────────────────────────────────
export const ClassificationRuleSchema = z.object({
    id: z.string().optional(),
    keyword: z.string(),
    tag: z.string(),
    subTag: z.string().nullable().optional(),
    confidence: z.number().default(0.8),
    hitCount: z.number().default(0),
    source: z.enum(["auto", "manual"]).default("auto"),
    lastUsed: z.any(), // Timestamp
    createdAt: z.any().optional(), // Timestamp
});

export type ClassificationRule = z.infer<typeof ClassificationRuleSchema>;

// ─── Budget ──────────────────────────────────────────────
export const BudgetSchema = z.object({
    id: z.string().optional(),
    userId: z.string(),
    tag: z.string().nullable(), // null means total budget
    monthlyLimit: z.number(),
    createdAt: z.any(),
    updatedAt: z.any().optional(),
});

export type Budget = z.infer<typeof BudgetSchema>;

// ─── Forecast（月底結餘預測快照與校準）──────────────────────
// doc id: `${userId}_${date}`，每日 cron 覆寫當日快照，同月累積成完整曲線
export const ForecastSnapshotSchema = z.object({
    userId: z.string(),
    monthYear: z.string(), // YYYY-MM
    date: z.string(), // YYYY-MM-DD，快照當天
    daysElapsed: z.number().int().nonnegative(),
    daysInMonth: z.number().int().positive(),
    variableSoFar: z.number(), // 已花費的變動支出（不含定期支出）
    variableProjectionRemaining: z.number(), // 剩餘天數 × 變動日均（校準後）
    upcomingRecurring: z.number(), // 剩餘天數內預計觸發的定期支出
    projectedExpense: z.number(), // 預測本月總支出
    biasMultiplierUsed: z.number(), // 產生此快照時套用的校準係數
    createdAt: z.any(),
});

export type ForecastSnapshot = z.infer<typeof ForecastSnapshotSchema>;

// doc id: userId。滾動校準係數：actual/predicted 的指數移動平均，用來修正未來「變動支出」預測
export const ForecastCalibrationSchema = z.object({
    userId: z.string(),
    biasMultiplier: z.number().default(1),
    sampleCount: z.number().int().nonnegative().default(0),
    lastCalibratedMonth: z.string().optional(), // YYYY-MM，避免同月重複校準
    updatedAt: z.any().optional(),
});

export type ForecastCalibration = z.infer<typeof ForecastCalibrationSchema>;

// ─── 前端用型別（API 回傳後 id 一定存在，createdAt 為 ISO string）─────────
/** 前端接收的記帳資料（id 必填、createdAt 為 string） */
export type AccountingEntryView = Omit<AccountingEntry, "id" | "createdAt" | "tag"> & {
    id: string;
    tag: string;
    createdAt?: string;
    imageUrl?: string;
};

/** 前端接收的存檔資料 */
export type ArchiveEntryView = Omit<ArchiveEntry, "id" | "createdAt"> & {
    id: string;
    createdAt?: string;
};

/** 前端接收的 Threads 資料 */
export type ThreadsEntryView = Omit<ThreadsEntry, "id" | "createdAt"> & {
    id: string;
    createdAt?: string;
};

/** 前端接收的行事曆資料 */
export type CalendarEntryView = Omit<CalendarEntry, "id" | "createdAt"> & {
    id: string;
    createdAt?: string;
};

/** 前端接收的定期支出資料 */
export type RecurringExpenseView = Omit<RecurringExpense, "id" | "createdAt" | "tag"> & {
    id: string;
    tag: string;
    createdAt?: string;
};

/** 前端接收的貸款資料 */
export type LoanView = Omit<Loan, "id" | "createdAt"> & {
    id: string;
    createdAt?: string;
};

/** 前端接收的投資交易資料 */
export type InvestmentTransactionView = Omit<InvestmentTransaction, "id" | "createdAt"> & {
    id: string;
    createdAt?: string;
};

/** 前端接收的持股彙總資料 */
export type HoldingView = Omit<Holding, "id" | "updatedAt"> & {
    id: string;
    updatedAt?: string;
};

/** 前端接收的淨資產快照資料 */
export type NetWorthSnapshotView = Omit<NetWorthSnapshot, "id" | "createdAt"> & {
    id: string;
    createdAt?: string;
};

/** 前端接收的現金帳戶資料 */
export type CashAccountView = Omit<CashAccount, "updatedAt"> & {
    updatedAt?: string;
};

/** 前端接收的現金異動流水資料 */
export type CashTransactionView = Omit<CashTransaction, "id" | "createdAt"> & {
    id: string;
    createdAt?: string;
};

/** 前端接收的旅程紀錄資料 */
export type TripView = Omit<Trip, "id" | "createdAt"> & {
    id: string;
    createdAt?: string;
};

/** 前端接收的自定義標籤資料 */
export type CustomTagView = Omit<CustomTag, "id" | "parentTag"> & {
    id: string;
    parentTag: string;
};
