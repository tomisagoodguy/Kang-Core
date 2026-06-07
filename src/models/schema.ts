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
    "Income",
    "Other",
]);

export const SourceEnum = z.enum(["line", "manual", "system", "line-rule", "line-image", "line-file", "threads"]);

export const BaseEntrySchema = z.object({
    id: z.string().optional(), // Provided by Firestore Document ID usually
    userId: z.string().optional(), // LINE user ID for multi-user isolation
    createdAt: z.date().optional(), // Added at creation time
    source: SourceEnum.default("line"),
    originalText: z.string(), // Keep original text for reference
});

export const AccountingEntrySchema = BaseEntrySchema.extend({
    amount: z.number().positive(),
    tag: TagEnum,
    subTag: z.string().optional(),
    date: z.string(), // ISO String YYYY-MM-DD
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
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

/** 前端接收的自定義標籤資料 */
export type CustomTagView = Omit<CustomTag, "id" | "parentTag"> & {
    id: string;
    parentTag: string;
};
