import type { QuotationData } from '../../models/quotation.model';

export interface QuotationHistoryMatch {
  readonly data: QuotationData;
  readonly originalIndex: number;
}

/** 篩選時保留原始索引，讓載入與刪除仍指向正確記錄。 */
export function filterQuotationHistory(
  history: readonly QuotationData[],
  query: string
): QuotationHistoryMatch[] {
  const keyword = query.trim().toLocaleLowerCase();
  return history
    .map((data, originalIndex) => ({ data, originalIndex }))
    .filter(({ data }) => {
      // 舊版或外部載入的 JSON 不保證名稱為字串；搜尋不能中斷整頁渲染。
      // 僅正規化搜尋值，保留原始資料與索引供載入／刪除使用。
      const name = typeof data.customerCompany === 'string'
        ? data.customerCompany
        : '';
      return name.toLocaleLowerCase().includes(keyword);
    });
}
