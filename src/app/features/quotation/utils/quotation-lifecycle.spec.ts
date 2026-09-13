import {
  cloneAsNewQuotation,
  createNextBusinessVersion,
  hasDuplicateQuotationNumber,
  normalizeQuotationLifecycle,
} from './quotation-lifecycle';
import { QuotationData } from '../models/quotation.model';

const quotation: QuotationData = {
  customerCompany: '合成客戶', quoterName: '報價者', quoterEmail: 'test@example.invalid',
  startDate: '2026-09-12', serviceItems: [], excludingTax: 0, tax: 0,
  includingTax: 0, isSign: false,
};

describe('報價業務生命週期', () => {
  it('讀取舊資料時補足穩定 ID、草稿狀態與第一版', () => {
    const normalized = normalizeQuotationLifecycle(quotation);
    expect(normalized.quotationId).toMatch(/^quotation-/);
    expect(normalized.status).toBe('draft');
    expect(normalized.businessVersion).toBe(1);
  });

  it('下一業務版本保留文件身份與先前快照', () => {
    const source = normalizeQuotationLifecycle({ ...quotation, status: 'sent', quotationNumber: 'Q-1' });
    const next = createNextBusinessVersion(source);
    expect(next.quotationId).toBe(source.quotationId);
    expect(next.businessVersion).toBe(2);
    expect(next.status).toBe('draft');
    expect(next.previousVersions).toHaveLength(1);
    expect(next.previousVersions?.[0].data.quotationNumber).toBe('Q-1');
  });

  it('複製成新報價取得新 ID、不承接對外編號或舊版', () => {
    const source = normalizeQuotationLifecycle({ ...quotation, quotationNumber: 'Q-1' });
    const copy = cloneAsNewQuotation(source);
    expect(copy.quotationId).not.toBe(source.quotationId);
    expect(copy.quotationNumber).toBe('');
    expect(copy.previousVersions).toEqual([]);
  });

  it('重複編號只作警示判斷，同一文件不誤報', () => {
    const source = normalizeQuotationLifecycle({ ...quotation, quotationNumber: 'Q-1' });
    expect(hasDuplicateQuotationNumber([source], 'Q-1', source.quotationId)).toBe(false);
    expect(hasDuplicateQuotationNumber([source], 'Q-1')).toBe(true);
  });
});
