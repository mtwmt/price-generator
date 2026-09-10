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
    .filter(({ data }) =>
      data.customerCompany.toLocaleLowerCase().includes(keyword)
    );
}
