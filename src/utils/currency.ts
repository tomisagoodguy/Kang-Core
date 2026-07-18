/**
 * 多幣別工具：幣別定義、文字偵測、目的地對應、統計換算。
 *
 * 設計原則：
 * - `amount` 一律存「原幣金額」（在當地實際付的數字）。
 * - `amountTWD` 存「整筆換算台幣」= amount * exchangeRate（現金流／收據總額）。
 * - 統計支出時用 {@link myExpenseTWD}：有代墊時只算「我的那一份」換算台幣。
 */

import { fetchRateToTWD } from "@/lib/exchangeRate";

export interface CurrencyDef {
    /** ISO 4217 代碼，例如 "JPY" */
    code: string;
    /** 顯示符號，例如 "¥" */
    symbol: string;
    /** 中文／英文關鍵字，用於從訊息文字推斷幣別 */
    keywords: string[];
    /** 顯示金額時的小數位數（日圓/韓元為 0） */
    decimals: number;
}

export const CURRENCIES: Record<string, CurrencyDef> = {
    TWD: { code: "TWD", symbol: "NT$", keywords: ["台幣", "新台幣", "twd", "ntd"], decimals: 0 },
    JPY: { code: "JPY", symbol: "¥", keywords: ["日幣", "日圓", "日元", "円", "yen", "jpy"], decimals: 0 },
    USD: { code: "USD", symbol: "US$", keywords: ["美金", "美元", "鎂", "usd", "dollar"], decimals: 2 },
    EUR: { code: "EUR", symbol: "€", keywords: ["歐元", "歐", "euro", "eur"], decimals: 2 },
    KRW: { code: "KRW", symbol: "₩", keywords: ["韓元", "韓幣", "won", "krw"], decimals: 0 },
    THB: { code: "THB", symbol: "฿", keywords: ["泰銖", "銖", "baht", "thb"], decimals: 2 },
    GBP: { code: "GBP", symbol: "£", keywords: ["英鎊", "鎊", "pound", "gbp"], decimals: 2 },
    HKD: { code: "HKD", symbol: "HK$", keywords: ["港幣", "港元", "hkd"], decimals: 2 },
    SGD: { code: "SGD", symbol: "S$", keywords: ["新加坡幣", "星幣", "sgd"], decimals: 2 },
    CNY: { code: "CNY", symbol: "RMB", keywords: ["人民幣", "rmb", "cny"], decimals: 2 },
    AUD: { code: "AUD", symbol: "A$", keywords: ["澳幣", "澳元", "aud"], decimals: 2 },
    VND: { code: "VND", symbol: "₫", keywords: ["越南盾", "盾", "vnd"], decimals: 0 },
    CZK: { code: "CZK", symbol: "Kč", keywords: ["克朗", "捷克克朗", "捷克幣", "czk"], decimals: 0 },
};

/** 目的地關鍵字 → 預設幣別（旅遊模式啟動時推斷用） */
const DESTINATION_CURRENCY: Record<string, string> = {
    日本: "JPY", 東京: "JPY", 大阪: "JPY", 京都: "JPY", 名古屋: "JPY", 福岡: "JPY", 北海道: "JPY", 沖繩: "JPY",
    美國: "USD", 紐約: "USD", 洛杉磯: "USD", 舊金山: "USD",
    韓國: "KRW", 首爾: "KRW", 釜山: "KRW", 濟州: "KRW",
    泰國: "THB", 曼谷: "THB", 清邁: "THB", 清萊: "THB", 芭達雅: "THB",
    德國: "EUR", 柏林: "EUR", 慕尼黑: "EUR", 法蘭克福: "EUR", 漢堡: "EUR",
    法國: "EUR", 巴黎: "EUR", 義大利: "EUR", 羅馬: "EUR", 米蘭: "EUR",
    西班牙: "EUR", 巴塞隆納: "EUR", 荷蘭: "EUR", 瑞士: "EUR", 葡萄牙: "EUR", 希臘: "EUR",
    奧地利: "EUR", 維也納: "EUR", 薩爾斯堡: "EUR", 哈修塔特: "EUR",
    捷克: "CZK", 布拉格: "CZK", 庫倫洛夫: "CZK",
    英國: "GBP", 倫敦: "GBP",
    香港: "HKD", 澳門: "HKD",
    新加坡: "SGD", 馬來西亞: "SGD", 吉隆坡: "SGD",
    澳洲: "AUD", 紐西蘭: "AUD",
    越南: "VND", 胡志明市: "VND", 河內: "VND",
};

/** 由目的地名稱推斷預設幣別，找不到回 null（視為台幣） */
export function currencyForDestination(destination: string | null | undefined): string | null {
    if (!destination) return null;
    for (const [kw, code] of Object.entries(DESTINATION_CURRENCY)) {
        if (destination.includes(kw)) return code;
    }
    return null;
}

/** 從訊息文字偵測明確標示的幣別（如「拉麵 20鎂」「咖啡 5歐」），找不到回 null */
export function detectCurrencyFromText(text: string): string | null {
    const lower = text.toLowerCase();
    for (const def of Object.values(CURRENCIES)) {
        if (def.code === "TWD") continue;
        if (def.keywords.some(kw => lower.includes(kw.toLowerCase()))) return def.code;
    }
    return null;
}

/**
 * 決定一筆記帳該用的幣別：明確文字 > 旅遊模式幣別 > 台幣。
 */
export function resolveCurrency(
    text: string,
    travelState?: { active: boolean; currency?: string | null } | null,
): string {
    const explicit = detectCurrencyFromText(text);
    if (explicit) return explicit;
    if (travelState?.active && travelState.currency) return travelState.currency;
    return "TWD";
}

/** 從文字偵測付款方式（快速指令／規則路徑用，無 Gemini 時），找不到回 undefined */
export function detectPaymentMethod(text: string): "cash" | "credit_card" | "e_payment" | undefined {
    const lower = text.toLowerCase();
    if (/悠遊卡|一卡通|line\s*pay|linepay|街口|apple\s*pay|google\s*pay|電子支付|行動支付|嗶|icash|悠遊付/.test(lower)) return "e_payment";
    if (/刷卡|信用卡|刷了|visa|master|jcb/.test(lower)) return "credit_card";
    if (/現金|付現|現鈔/.test(lower)) return "cash";
    return undefined;
}

/** 付款方式顯示對應 */
export const PAYMENT_LABELS: Record<string, { label: string; emoji: string }> = {
    cash: { label: "現金", emoji: "💵" },
    credit_card: { label: "信用卡", emoji: "💳" },
    e_payment: { label: "電子支付", emoji: "📲" },
};

/**
 * 計算一筆記帳的幣別欄位（exchangeRate + amountTWD）。
 * 旅遊模式且幣別相同時沿用啟動時抓的匯率；否則即時抓（含 fallback）。
 */
export async function computeCurrencyFields(
    amount: number,
    currency: string,
    travelState?: { active: boolean; currency?: string | null; exchangeRate?: number | null } | null,
): Promise<{ currency: string; exchangeRate: number; amountTWD: number }> {
    if (!currency || currency === "TWD") {
        return { currency: "TWD", exchangeRate: 1, amountTWD: Math.round(amount) };
    }
    let rate: number | null = null;
    if (travelState?.active && travelState.currency === currency && travelState.exchangeRate) {
        rate = travelState.exchangeRate;
    }
    if (!rate) rate = await fetchRateToTWD(currency);
    return { currency, exchangeRate: rate, amountTWD: Math.round(amount * rate) };
}

/** 產生代墊／借貸的說明文字，無代墊時回 null */
export function settlementNote(e: {
    amount?: number;
    currency?: string;
    settlement?: { paidBy: "me" | "other"; counterparty: string; myShare: number; settled?: boolean } | null;
}): string | null {
    const s = e.settlement;
    if (!s) return null;
    const cur = e.currency;
    const full = e.amount ?? 0;
    const settledMark = s.settled ? "（已結清）" : "";
    if (s.paidBy === "me") {
        const owed = Math.max(0, full - s.myShare);
        return `🤝 我先付 ${formatMoney(full, cur)}，我的份 ${formatMoney(s.myShare, cur)}，${s.counterparty} 欠我 ${formatMoney(owed, cur)}${settledMark}`;
    }
    return `🤝 ${s.counterparty} 先付 ${formatMoney(full, cur)}，我欠 ${s.counterparty} ${formatMoney(s.myShare, cur)}${settledMark}`;
}

/** 格式化原幣金額，例如 formatMoney(1200, "JPY") → "¥1,200" */
export function formatMoney(amount: number, currency: string | undefined): string {
    const def = CURRENCIES[currency ?? "TWD"] ?? CURRENCIES.TWD;
    const num = amount.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: def.decimals,
    });
    return `${def.symbol}${num}`;
}

/**
 * 統計用：回傳「我實際該負擔的金額（換算台幣）」。
 * - 有代墊（settlement）時只算 myShare；否則算整筆。
 * - 優先用已換算好的 amountTWD；沒有則用 amount * exchangeRate（向後相容舊台幣資料）。
 */
export function myExpenseTWD(e: {
    amount?: number;
    amountTWD?: number;
    exchangeRate?: number;
    settlement?: { myShare?: number } | null;
}): number {
    const rate = e.exchangeRate ?? 1;
    if (e.settlement) {
        const share = e.settlement.myShare ?? e.amount ?? 0;
        return Math.round(share * rate);
    }
    return e.amountTWD ?? Math.round((e.amount ?? 0) * rate);
}
