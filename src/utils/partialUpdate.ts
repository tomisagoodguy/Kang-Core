/** 任何 PUT 都不允許由前端修改的歸屬／系統欄位 */
const DEFAULT_IMMUTABLE_FIELDS = ["id", "userId", "createdAt", "source", "originalText"];

/**
 * 從 Zod `.partial()` 解析結果中只挑出 body 實際帶的欄位，並排除不可改的欄位。
 *
 * Zod 4 的 `.partial()` 仍會套用欄位 default（例如 source="line"、isActive=true、paidInstallments=0），
 * 直接 `update(result.data)` 會把沒送的欄位蓋回預設值。
 *
 * @param parsed - schema.partial().safeParse(body).data
 * @param body - 原始 request body
 * @param extraImmutable - 該集合額外禁止修改的欄位
 */
export function pickProvidedFields<T extends Record<string, unknown>>(
    parsed: T,
    body: unknown,
    extraImmutable: string[] = [],
): Partial<T> {
    if (typeof body !== "object" || body === null) return {};
    const immutable = new Set([...DEFAULT_IMMUTABLE_FIELDS, ...extraImmutable]);
    return Object.fromEntries(
        Object.entries(parsed).filter(([key]) => key in body && !immutable.has(key)),
    ) as Partial<T>;
}
