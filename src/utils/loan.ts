/**
 * 貸款等額本息（本息平均攤還）計算。
 */

/** 計算每月應繳金額（本金+利息）。annualRate 為百分比，如 3.5 代表 3.5%。 */
export function computeMonthlyPayment(principal: number, annualRate: number, termMonths: number): number {
    const r = annualRate / 100 / 12;
    if (r === 0) {
        return Math.round(principal / termMonths);
    }
    const payment = (principal * r) / (1 - Math.pow(1 + r, -termMonths));
    return Math.round(payment);
}

/** 計算單期扣款的本金/利息拆分。最後一期直接把剩餘本金全部收清，避免四捨五入殘值累積。 */
export function computeInstallment(
    remainingPrincipal: number,
    annualRate: number,
    monthlyPayment: number,
    isLastInstallment: boolean
): { interestPortion: number; principalPortion: number } {
    const r = annualRate / 100 / 12;
    const interestPortion = Math.round(remainingPrincipal * r);
    const principalPortion = isLastInstallment
        ? remainingPrincipal
        : Math.min(monthlyPayment - interestPortion, remainingPrincipal);
    return { interestPortion, principalPortion };
}
