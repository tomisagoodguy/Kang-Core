"use client";

import { useState } from "react";

interface FireCalculatorProps {
    /** 近 12 月平均月支出（台幣），作為預設值 */
    avgMonthlyExpense: number;
    /** 近 12 月平均月儲蓄（台幣），作為預設每月投入 */
    avgMonthlySavings: number;
    /** 目前淨資產（台幣） */
    currentAssets: number;
}

const MAX_YEARS = 100;

/** 逐月複利模擬：現有資產以年化報酬成長 + 每月投入，直到達到 FIRE 目標 */
function simulateYearsToFire(
    currentAssets: number,
    monthlyContribution: number,
    annualReturnPct: number,
    fireNumber: number,
): number | null {
    if (currentAssets >= fireNumber) return 0;
    const monthlyRate = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
    let assets = currentAssets;
    for (let month = 1; month <= MAX_YEARS * 12; month++) {
        assets = assets * (1 + monthlyRate) + monthlyContribution;
        if (assets >= fireNumber) return month / 12;
    }
    return null; // 百年內達不到
}

export function FireCalculator({ avgMonthlyExpense, avgMonthlySavings, currentAssets }: FireCalculatorProps) {
    const [monthlyExpense, setMonthlyExpense] = useState(Math.max(0, Math.round(avgMonthlyExpense)));
    const [monthlyContribution, setMonthlyContribution] = useState(Math.max(0, Math.round(avgMonthlySavings)));
    const [annualReturnPct, setAnnualReturnPct] = useState(5);
    const [withdrawalRatePct, setWithdrawalRatePct] = useState(4);

    const annualExpense = monthlyExpense * 12;
    const fireNumber = withdrawalRatePct > 0 ? annualExpense / (withdrawalRatePct / 100) : 0;
    const progressPct = fireNumber > 0 ? Math.min(100, (currentAssets / fireNumber) * 100) : 0;
    const yearsToFire = fireNumber > 0
        ? simulateYearsToFire(currentAssets, monthlyContribution, annualReturnPct, fireNumber)
        : null;

    return (
        <div className="glass-card" style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>
                🔥 FIRE 計算機
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "16px" }}>
                月支出與每月投入已自動帶入近 12 個月實際數據，可手動調整
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "16px" }}>
                <FireInput label="月支出（退休後）" value={monthlyExpense} onChange={setMonthlyExpense} step={1000} />
                <FireInput label="每月投入" value={monthlyContribution} onChange={setMonthlyContribution} step={1000} />
                <FireInput label="預期年化報酬 %" value={annualReturnPct} onChange={setAnnualReturnPct} step={0.5} />
                <FireInput label="提領率 %" value={withdrawalRatePct} onChange={setWithdrawalRatePct} step={0.5} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "12px" }}>
                <div>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>FIRE 目標（年支出 ÷ 提領率）</p>
                    <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f59e0b" }}>${Math.round(fireNumber).toLocaleString()}</p>
                </div>
                <div>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>目前淨資產</p>
                    <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "#818cf8" }}>${Math.round(currentAssets).toLocaleString()}</p>
                </div>
                <div>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>預估達成時間</p>
                    <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "#38bdf8" }}>
                        {yearsToFire === null
                            ? "—（百年內無法達成）"
                            : yearsToFire === 0
                                ? "🎉 已達成"
                                : `約 ${yearsToFire.toFixed(1)} 年`}
                    </p>
                </div>
            </div>

            <div style={{ height: "8px", borderRadius: "4px", background: "var(--border-color)", overflow: "hidden" }}>
                <div style={{
                    height: "100%",
                    width: `${progressPct}%`,
                    background: progressPct >= 100 ? "#22c55e" : "#f59e0b",
                    transition: "width 0.3s",
                }} />
            </div>
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>
                進度 {progressPct.toFixed(1)}%
            </p>
        </div>
    );
}

function FireInput({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step: number }) {
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
