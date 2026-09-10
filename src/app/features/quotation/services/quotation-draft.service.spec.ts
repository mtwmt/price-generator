/** @jest-environment jsdom */
const dependencies = new Map<unknown, unknown>();

jest.mock('@angular/core', () => ({
  Injectable: () => (target: unknown) => target,
  inject: (token: unknown) => dependencies.get(token),
}));
jest.mock('@app/core/services/auth.service', () => ({
  AuthService: class AuthService {},
}), { virtual: true });

import type { QuotationData } from '@app/features/quotation/models/quotation.model';
import { AuthService } from '@app/core/services/auth.service';
import { QuotationDraftService } from './quotation-draft.service';

const DRAFT_KEY = 'price-generator:quotation-draft:member-a';

function quotation(): QuotationData {
  return {
    customerCompany: '測試客戶',
    quoterName: '測試報價者',
    quoterEmail: 'quote@example.test',
    startDate: '2026-09-11',
    serviceItems: [{ item: '設計服務', price: 1000, count: 1, amount: 1000 }],
    excludingTax: 1000,
    tax: 50,
    includingTax: 1050,
    isSign: false,
  };
}

describe('QuotationDraftService', () => {
  let service: QuotationDraftService;
  let owner: string | null;

  beforeEach(() => {
    localStorage.clear();
    owner = 'member-a';
    dependencies.set(AuthService, { userId: () => owner });
    service = new QuotationDraftService();
  });

  it('以獨立版本化 envelope 儲存並讀回草稿', () => {
    const data = quotation();

    expect(service.save(data)).toBe(true);
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '')).toMatchObject({
      version: 1,
      data: { customerCompany: '測試客戶' },
    });
    expect(service.load()).toEqual(data);
    expect(service.hasDraft()).toBe(true);
  });

  it('資料深拷貝，兩端修改都不會影響另一端', () => {
    const data = quotation();
    expect(service.save(data)).toBe(true);
    data.serviceItems[0].item = '呼叫端修改';

    const loaded = service.load();
    expect(loaded?.serviceItems[0].item).toBe('設計服務');
    loaded!.serviceItems[0].item = '讀取端修改';
    expect(service.load()?.serviceItems[0].item).toBe('設計服務');
  });

  it('損壞 JSON 或最低 schema 不符時清除且不拋出', () => {
    localStorage.setItem(DRAFT_KEY, '{broken');
    expect(service.load()).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();

    localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, data: {} }));
    expect(service.hasDraft()).toBe(false);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('容量錯誤回傳 false，clear 可安全移除草稿', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    expect(service.save(quotation())).toBe(false);
    jest.restoreAllMocks();

    localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, data: quotation() }));
    service.clear();
    expect(service.hasDraft()).toBe(false);
  });

  it('依登入帳號隔離草稿，不會恢復其他使用者的客戶資料', () => {
    expect(service.save(quotation())).toBe(true);

    owner = 'member-b';
    expect(service.load()).toBeNull();
    expect(service.hasDraft()).toBe(false);
    expect(service.load('member-a')?.customerCompany).toBe('測試客戶');

    owner = 'member-a';
    expect(service.load()?.customerCompany).toBe('測試客戶');
  });
});
