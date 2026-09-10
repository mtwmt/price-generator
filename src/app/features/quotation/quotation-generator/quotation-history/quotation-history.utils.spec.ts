import type { QuotationData } from '../../models/quotation.model';
import { filterQuotationHistory } from './quotation-history.utils';

function quotation(customerCompany: string, startDate: string): QuotationData {
  return {
    customerCompany,
    quoterName: '合成報價公司',
    quoterEmail: 'fixture@example.test',
    startDate,
    serviceItems: [],
    excludingTax: 0,
    tax: 0,
    includingTax: 0,
    isSign: false,
  };
}

describe('filterQuotationHistory', () => {
  it('以中文名稱子字串篩選，且保留來源順序與原始索引', () => {
    const history = [
      quotation('日光設計', '2026-09-01'),
      quotation('山海工程', '2026-09-02'),
      quotation('日光科技', '2026-09-03'),
    ];

    const result = filterQuotationHistory(history, '日光');

    expect(result).toEqual([
      { data: history[0], originalIndex: 0 },
      { data: history[2], originalIndex: 2 },
    ]);
  });

  it('英文搜尋不分大小寫，並忽略查詢字串前後空白', () => {
    const history = [
      quotation('Alpha Studio', '2026-09-01'),
      quotation('beta works', '2026-09-02'),
    ];

    expect(filterQuotationHistory(history, '  ALpHa  ')).toEqual([
      { data: history[0], originalIndex: 0 },
    ]);
  });

  it('空白查詢會還原全部記錄，且不合併相同日期的不同名稱', () => {
    const history = [
      quotation('北極星商行', '2026-09-01'),
      quotation('南十字企業', '2026-09-01'),
    ];

    expect(filterQuotationHistory(history, '   ')).toEqual([
      { data: history[0], originalIndex: 0 },
      { data: history[1], originalIndex: 1 },
    ]);
  });

  it('無符合項目與空歷史皆回傳空陣列', () => {
    const history = [quotation('北極星商行', '2026-09-01')];

    expect(filterQuotationHistory(history, '不存在的客戶')).toEqual([]);
    expect(filterQuotationHistory([], '任何名稱')).toEqual([]);
  });

  it('同日期且同名的兩筆記錄仍保留各自的資料與索引', () => {
    const history = [
      quotation('同名客戶', '2026-09-01'),
      quotation('同名客戶', '2026-09-01'),
    ];

    const filtered = filterQuotationHistory(history, '同名');

    expect(filtered.map(({ originalIndex }) => originalIndex)).toEqual([0, 1]);
    expect(filtered[0].data).toBe(history[0]);
    expect(filtered[1].data).toBe(history[1]);
  });

  it('篩選結果以來源索引載入或刪除，刪除後新陣列會重新索引', () => {
    const history = [
      quotation('其他客戶 A', '2026-09-01'),
      quotation('目標客戶 B', '2026-09-02'),
      quotation('其他客戶 C', '2026-09-03'),
      quotation('目標客戶 D', '2026-09-04'),
    ];
    const originalSnapshot = history.map((item) => ({ ...item }));

    const filtered = filterQuotationHistory(history, '目標客戶');

    expect(filtered.map(({ originalIndex }) => originalIndex)).toEqual([1, 3]);
    expect(filtered.map(({ data }) => data.customerCompany)).toEqual([
      '目標客戶 B',
      '目標客戶 D',
    ]);
    expect(history).toEqual(originalSnapshot);

    const remainingHistory = history.filter(
      (_, index) => index !== filtered[0].originalIndex
    );

    expect(filterQuotationHistory(remainingHistory, '目標客戶')).toEqual([
      { data: remainingHistory[2], originalIndex: 2 },
    ]);
  });
});
