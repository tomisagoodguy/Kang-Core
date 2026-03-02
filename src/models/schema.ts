import { z } from "zod";

export const TagEnum = z.enum([
    "Food",
    "Transport",
    "Entertainment",
    "Utilities",
    "Shopping",
    "Health",
    "Education",
    "Income",
    "Other",
]);

export const SourceEnum = z.enum(["line", "manual", "system"]);

export const BaseEntrySchema = z.object({
    id: z.string().optional(), // Provided by Firestore Document ID usually
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

export const CalendarEntrySchema = BaseEntrySchema.extend({
    title: z.string(),
    actionDate: z.string().optional(), // YYYY-MM-DD
    actionTime: z.string().optional(), // HH:mm
    description: z.string().optional(),
});

export type CalendarEntry = z.infer<typeof CalendarEntrySchema>;

export const FrequencyEnum = z.enum(["daily", "weekly", "monthly", "yearly"]);

export const RecurringExpenseSchema = z.object({
    id: z.string().optional(),
    amount: z.number().positive(),
    tag: TagEnum,
    description: z.string(),
    frequency: FrequencyEnum,
    dayOfMonth: z.number().min(1).max(31).optional(),
    dayOfWeek: z.number().min(0).max(6).optional(),
    monthOfYear: z.number().min(1).max(12).optional(),
    isActive: z.boolean().default(true),
    lastTriggeredAt: z.string().optional(), // ISO String
    createdAt: z.date().optional(),
});

export type RecurringExpense = z.infer<typeof RecurringExpenseSchema>;

export const GeminiParseResultSchema = z.object({
    type: z.enum(["accounting", "archive", "calendar", "recurring", "query", "clear_memory", "unknown"]),
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
    name: z.string(),
    parentTag: TagEnum,
    createdAt: z.date().optional(),
});

export type CustomTag = z.infer<typeof CustomTagSchema>;
