"use client";

import { useState } from "react";

const MAX_YEARS = 60;

/** 逐月複利模擬：本金 + 每月定期定額，以年化報酬成長 */
function simulateFutureValue(
    principal: number,
    monthlyContribution: number,
    annualReturnPct: number,
    years: number,
): number {
    const monthlyRate = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
    let assets = principal;
    const months = Math.round(years * 12);
    for (let m = 0; m < months; m++) {
        assets = assets * (1 + monthlyRate) + monthlyContribution;
    }
    return assets;
}

interface CagrLookupResult {
    symbol: string;
    startPrice: number;
    latestPrice: number;
    actualYears: number;
    cagrPct: number;
}

export function CagrCalculator() {
    const [market, setMarket] = useState<"TW" | "US">("TW");
    const [ticker, setTicker] = useState("0050");
    const [lookupYears, setLookupYears] = useState(10);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [lookupError, setLookupError] = useState("");
    const [lookupResult, setLookupResult] = useState<CagrLookupResult | null>(null);

    const [principal, setPrincipal] = useState(100000);
    const [monthlyContribution, setMonthlyContribution] = useState(10000);
    const [annualReturnPct, setAnnualReturnPct] = useState(8);
    const [projectionYears, setProjectionYears] = useState(20);

    const handleLookup = async () => {
        if (!ticker.trim()) return;
        setLookupLoading(true);
        setLookupError("");
        setLookupResult(null);
        try {
            const res = await fetch(`/api/market/cagr?market=${market}&ticker=${encodeURIComponent(ticker.trim())}&years=${lookupYears}`);
            const data = await res.json();
            if (!res.ok) {
                setLookupError(data?.error ?? "查詢失敗");
                return;
            }
            setLookupResult(data as CagrLookupResult);
            setAnnualReturnPct(data.cagrPct);
        } catch {
            setLookupError("查詢失敗，請稍後再試或手動輸入年化報酬率");
        } finally {
            setLookupLoading(false);
        }
    };

    const futureValue = simulateFutureValue(
        Math.max(0, principal),
        Math.max(0, monthlyContribution),
        annualReturnPct,
        Math.min(MAX_YEARS, Math.max(1, projectionYears)),
    );
    const totalContributed = principal + monthlyContribution * projectionYears * 12;
    const totalGrowth = futureValue - totalContributed;

    return (
        <div className="glass-card" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>
                📈 複利試算（CAGR）
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "16px" }}>
                可查詢台美股歷史年化報酬率自動帶入，或直接手動輸入預期報酬率
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 90px auto", gap: "8px", marginBottom: "8px", alignItems: "end" }}>
                <CagrSelect label="市場" value={market} onChange={(v) => setMarket(v as "TW" | "US")} options={[["TW", "台股"], ["US", "美股"]]} />
                <CagrTextInput label="代號" value={ticker} onChange={setTicker} placeholder={market === "TW" ? "例：0050" : "例：SPY"} />
                <CagrNumberInput label="回溯年數" value={lookupYears} onChange={setLookupYears} step={1} />
                <button
                    onClick={handleLookup}
                    disabled={lookupLoading}
                    style={{ padding: "8px 14px", borderRadius: "6px", border: "none", background: "var(--primary)", color: "white", fontWeight: 600, cursor: "pointer", height: "34px" }}
                >
                    {lookupLoading ? "查詢中..." : "查詢歷史 CAGR"}
                </button>
            </div>

            {lookupError && (
                <p style={{ fontSize: "0.75rem", color: "var(--danger)", marginBottom: "12px" }}>⚠️ {lookupError}</p>
            )}
            {lookupResult && (
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                    {lookupResult.symbol}：近 {lookupResult.actualYears} 年由 {lookupResult.startPrice.toFixed(2)} → {lookupResult.latestPrice.toFixed(2)}，年化報酬 {lookupResult.cagrPct}%（已自動帶入下方預期年化報酬）
                </p>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                <CagrNumberInput label="本金" value={principal} onChange={setPrincipal} step={10000} />
                <CagrNumberInput label="每月定期定額" value={monthlyContribution} onChange={setMonthlyContribution} step={1000} />
                <CagrNumberInput label="預期年化報酬 %" value={annualReturnPct} onChange={setAnnualReturnPct} step={0.5} />
                <CagrNumberInput label="試算年數" value={projectionYears} onChange={setProjectionYears} step={1} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
                <div>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>累積投入本金</p>
                    <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "#818cf8" }}>${Math.round(totalContributed).toLocaleString()}</p>
                </div>
                <div>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>複利成長</p>
                    <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "#22c55e" }}>${Math.round(totalGrowth).toLocaleString()}</p>
                </div>
                <div>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{projectionYears} 年後預估資產</p>
                    <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f59e0b" }}>${Math.round(futureValue).toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
}

function CagrNumberInput({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step: number }) {
    return (
        <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.72rem", color: "var(--text-muted)" }}>
            {label}
            <input
                type="number"
                value={value}
                step={step}
                onChange={(e) => onChange(Number(e.target.value) || 0)}
                style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)", fontSize: "0.875rem" }}
            />
        </label>
    );
}

function CagrTextInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.72rem", color: "var(--text-muted)" }}>
            {label}
            <input
                type="text"
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)", fontSize: "0.875rem" }}
            />
        </label>
    );
}

function CagrSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
    return (
        <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.72rem", color: "var(--text-muted)" }}>
            {label}
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-color)", color: "var(--text-primary)", fontSize: "0.875rem" }}
            >
                {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
        </label>
    );
}
