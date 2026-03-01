import { z } from "zod";

export const TagEnum = z.enum([
    "Food",
    "Transport",
    "Entertainment",
    "Utilities",
    "Shopping",
    "Health",
    "Education",
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

export const GeminiParseResultSchema = z.object({
    type: z.enum(["accounting", "archive", "unknown"]),
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
    explanation: z.string().optional(),
    isError: z.boolean().default(false),
    errorMessage: z.string().optional(),
});

export type GeminiParseResult = z.infer<typeof GeminiParseResultSchema>;
