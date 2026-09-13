/** @jest-environment jsdom */
const dependencies = new Map<unknown, unknown>();

jest.mock('@angular/core', () => ({
  Injectable: () => (target: unknown) => target,
  inject: (token: unknown) => dependencies.get(token),
}));
jest.mock('@app/shared/services/storage.service', () => ({
  StorageService: class StorageService {},
}), { virtual: true });

import { StorageService } from '@app/shared/services/storage.service';
import { QuotationTemplatesService } from './quotation-templates.service';

interface MemoryStorage {
  values: Map<string, unknown>;
  failWrites: boolean;
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): boolean;
}

function createStorage(): MemoryStorage {
  const values = new Map<string, unknown>();
  return {
    values,
    failWrites: false,
    get<T>(key: string, fallback: T): T {
      return (values.get(key) as T | undefined) ?? fallback;
    },
    set<T>(key: string, value: T): boolean {
      if (this.failWrites) return false;
      values.set(key, JSON.parse(JSON.stringify(value)) as unknown);
      return true;
    },
  };
}

describe('QuotationTemplatesService C1 常用資料操作', () => {
  let storage: MemoryStorage;
  let service: QuotationTemplatesService;

  beforeEach(() => {
    dependencies.clear();
    storage = createStorage();
    dependencies.set(StorageService, storage);
    service = new QuotationTemplatesService();
  });

  it('建立後以獨立快照讀取，支援同名客戶並可搜尋', () => {
    expect(service.saveCustomer({
      name: ' 專案窗口 ', customerCompany: '合成公司', customerEmail: 'a@example.test',
    })).toBe(true);
    expect(service.saveCustomer({ name: '專案窗口', customerCompany: '另一家合成公司' })).toBe(true);

    const matches = service.getCustomers('窗口');
    expect(matches).toHaveLength(2);
    expect(matches.map((entry) => entry.customerCompany)).toEqual([
      '另一家合成公司', '合成公司',
    ]);
    expect(new Set(matches.map((entry) => entry.id)).size).toBe(2);

    // UI 套用取得的是儲存當時的資料，不會讓呼叫端意外改寫本機快照。
    (matches[0] as { customerCompany: string }).customerCompany = '頁面暫存修改';
    expect(service.getCustomers('窗口')[0]?.customerCompany).toBe('另一家合成公司');
  });

  it('建立、搜尋與刪除常用服務項目，保留套用所需的價格與分類快照', () => {
    expect(service.saveServiceItem({
      name: '網站設計', item: '網站設計', price: 12000, category: '設計', unit: '式',
    })).toBe(true);
    expect(service.saveServiceItem({ name: '維護', item: '維護服務', price: 3000 })).toBe(true);

    const template = service.getServiceItems('網')[0];
    expect(template).toMatchObject({ item: '網站設計', price: 12000, category: '設計', unit: '式' });
    expect(service.deleteServiceItem(template?.id ?? '')).toBe(true);
    expect(service.getServiceItems()).toEqual([
      expect.objectContaining({ item: '維護服務', price: 3000 }),
    ]);
  });

  it('切換訪客與帳號資料區時不洩漏彼此的常用資料', () => {
    service.saveCustomer({ name: '訪客客戶', customerCompany: '訪客客戶' });
    service.setScope('user-42');
    expect(service.getCustomers()).toEqual([]);
    service.saveCustomer({ name: '帳號客戶', customerCompany: '帳號客戶' });

    service.setScope('visitor');
    expect(service.getCustomers().map((entry) => entry.name)).toEqual(['訪客客戶']);
    service.setScope(' user-42 ');
    expect(service.getCustomers().map((entry) => entry.name)).toEqual(['帳號客戶']);
  });

  it('容量寫入失敗時回傳失敗且不宣稱新增或刪除成功', () => {
    service.saveCustomer({ name: '既有客戶', customerCompany: '既有客戶' });
    const existing = service.getCustomers()[0];
    storage.failWrites = true;

    expect(service.saveCustomer({ name: '無法寫入', customerCompany: '無法寫入' })).toBe(false);
    expect(service.deleteCustomer(existing?.id ?? '')).toBe(false);
    storage.failWrites = false;
    expect(service.getCustomers().map((entry) => entry.name)).toEqual(['既有客戶']);
  });

  it('隔離損壞模板項目，避免手機搜尋或套用時因缺欄位崩潰', () => {
    storage.values.set('quotation:templates:visitor:customers', {
      schemaVersion: 1,
      entries: [{ id: 'valid', name: '可套用', customerCompany: '可套用' }, { id: 'bad', name: 9 }],
    });
    storage.values.set('quotation:templates:visitor:service-items', {
      schemaVersion: 1,
      entries: [{ id: 'valid', name: '可套用', item: '可套用', price: 0 }, { id: 'bad', name: '壞資料', item: '壞資料', price: 'NaN' }],
    });

    expect(service.getCustomers('可')).toEqual([expect.objectContaining({ id: 'valid' })]);
    expect(service.getServiceItems('可')).toEqual([expect.objectContaining({ id: 'valid', price: 0 })]);
  });
});
