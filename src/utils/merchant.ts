/**
 * 商家名稱正規化：去公司型態與分公司尾綴。
 * 用途：電子發票成員歸屬規則的 key、前端連鎖商家彙總（同品牌不同分店合併統計）。
 */
export function normalizeMerchant(name: string): string {
    return name
        .replace(/股份有限公司|有限公司|商行|企業社/g, "")
        .replace(/第?[一二三四五六七八九十百千\d０-９]+分公司/g, "")
        .replace(/台北市|臺北市|新北市/g, "")
        .trim();
}
