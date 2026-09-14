const dependencies = new Map<unknown, unknown>();

jest.mock('@angular/core', () => ({
  Injectable: () => (target: unknown) => target,
  inject: (token: unknown) => dependencies.get(token),
  signal: <T>(value: T) => {
    let current = value;
    const state = (() => current) as { (): T; set(value: T): void; update(updater: (value: T) => T): void };
    state.set = (value) => { current = value; };
    state.update = (updater) => { current = updater(current); };
    return state;
  },
}));
jest.mock('@app/shared/services/storage.service', () => ({ StorageService: class StorageService {} }), { virtual: true });

import { StorageService } from '@app/shared/services/storage.service';
import { createTemplateOperation } from '../cloud/template-sync-domain';
import { QuotationTemplatesService } from './quotation-templates.service';

interface MemoryStorage {
  values: Map<string, unknown>;
  failWrites: boolean;
  readJson<T>(key: string): { status: 'ok'; value: T } | { status: 'missing' } | { status: 'parse-failed' };
  setDetailed<T>(key: string, value: T): { success: boolean };
}

function createStorage(): MemoryStorage {
  const values = new Map<string, unknown>();
  return {
    values,
    failWrites: false,
    readJson<T>(key: string) {
      if (!values.has(key)) return { status: 'missing' };
      const value = values.get(key);
      return value === '__broken__' ? { status: 'parse-failed' } : { status: 'ok', value: value as T };
    },
    setDetailed<T>(key: string, value: T) {
      if (this.failWrites) return { success: false };
      values.set(key, JSON.parse(JSON.stringify(value)) as unknown);
      return { success: true };
    },
  };
}

function installLocks(): void {
  const tails = new Map<string, Promise<void>>();
  const locks = {
    async request<T>(name: string, callback: () => Promise<T>): Promise<T> {
      const prior = tails.get(name) ?? Promise.resolve();
      let release: (() => void) | undefined;
      const tail = new Promise<void>((resolve) => { release = resolve; });
      tails.set(name, prior.then(() => tail));
      await prior;
      try { return await callback(); } finally { release?.(); }
    },
  };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks } });
}

describe('QuotationTemplatesService v2 本機封套', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    dependencies.clear();
    storage = createStorage();
    dependencies.set(StorageService, storage);
    installLocks();
  });

  it('遷移兩個 v1 來源為單一封套，保留來源並持久待送操作', async () => {
    storage.values.set('quotation:templates:visitor:customers', {
      schemaVersion: 1, entries: [{ id: 'c-1', name: '客戶', customerCompany: '合成公司' }],
    });
    storage.values.set('quotation:templates:visitor:service-items', {
      schemaVersion: 1, entries: [{ id: 's-1', name: '設計', item: '網站設計', price: 12000 }],
    });
    const service = new QuotationTemplatesService();
    await service.ready();

    expect(service.getCustomers()).toEqual([expect.objectContaining({ id: 'c-1', customerCompany: '合成公司' })]);
    expect(service.getServiceItems()).toEqual([expect.objectContaining({ id: 's-1', price: 12000 })]);
    expect(service.snapshot().pendingIds).toHaveLength(2);
    expect(storage.values.get('quotation:templates:visitor:customers')).toBeDefined();
    expect(storage.values.get('quotation:templates:visitor:service-items')).toBeDefined();
    expect(storage.values.get('quotation:templates:visitor:v2')).toEqual(expect.objectContaining({ schemaVersion: 2, migrationComplete: true }));

    const reloaded = new QuotationTemplatesService();
    await reloaded.ready();
    expect(reloaded.snapshot().pendingIds).toHaveLength(2);
    expect(reloaded.getCustomers()).toHaveLength(1);
  });

  it('遷移含首尾空白的舊 ID 後改名仍沿用原 entityId', async () => {
    storage.values.set('quotation:templates:visitor:customers', {
      schemaVersion: 1, entries: [{ id: ' legacy-id ', name: '舊名稱', customerCompany: '合成公司' }],
    });
    const service = new QuotationTemplatesService();
    await service.ready();
    const template = service.getCustomers()[0]!;
    expect(template.id).toBe(' legacy-id ');
    expect(await service.saveCustomer({ ...template, name: '新名稱' }, service.baseFor(template))).toBe(true);
    const operations = service.snapshot().operations;
    expect(operations.at(-1)).toEqual(expect.objectContaining({ entityId: ' legacy-id ', parentRevisionIds: [operations[0]?.revisionId] }));
  });

  it('來源格式、重複 ID 或目標未知 schema 失敗時不覆寫也不復活已刪資料', async () => {
    storage.values.set('quotation:templates:visitor:customers', {
      schemaVersion: 1, entries: [{ id: 'same', name: '一', customerCompany: '一' }, { id: 'same', name: '二', customerCompany: '二' }],
    });
    const invalidLegacy = new QuotationTemplatesService();
    await expect(invalidLegacy.ready()).rejects.toThrow('重複識別');
    expect(invalidLegacy.error()).toContain('重複識別');
    expect(storage.values.has('quotation:templates:visitor:v2')).toBe(false);

    storage.values.set('quotation:templates:visitor:v2', { schemaVersion: 9 });
    const invalidTarget = new QuotationTemplatesService();
    await expect(invalidTarget.ready()).rejects.toThrow();
    expect(invalidTarget.getCustomers()).toEqual([]);
    expect(storage.values.get('quotation:templates:visitor:v2')).toEqual({ schemaVersion: 9 });
  });

  it('新增與確認送出會原子保存封套；容量失敗不會假稱成功', async () => {
    const service = new QuotationTemplatesService();
    await service.ready();
    expect(await service.saveCustomer({ name: '窗口', customerCompany: '合成公司' })).toBe(true);
    const [operation] = service.snapshot().operations;
    expect(service.snapshot().pendingIds).toEqual([operation.operationId]);
    await service.acknowledge(operation.operationId, () => true);
    expect(service.snapshot().pendingIds).toEqual([]);

    storage.failWrites = true;
    expect(await service.saveCustomer({ name: '失敗', customerCompany: '不能存' })).toBe(false);
    expect(service.getCustomers().map((value) => value.name)).toEqual(['窗口']);
  });

  it('兩個 service 共用儲存時由真實序列化 lock 保留雙方新增與待送紀錄', async () => {
    const first = new QuotationTemplatesService();
    const second = new QuotationTemplatesService();
    await Promise.all([first.ready(), second.ready()]);
    await Promise.all([
      first.saveCustomer({ name: '分頁 A', customerCompany: 'A 公司' }),
      second.saveCustomer({ name: '分頁 B', customerCompany: 'B 公司' }),
    ]);
    await first.refresh();
    expect(first.getCustomers().map((value) => value.name).sort()).toEqual(['分頁 A', '分頁 B']);
    expect(first.snapshot().pendingIds).toHaveLength(2);
  });

  it('遠端重複列出相同操作時封套只保存一筆且重新載入可驗證', async () => {
    const service = new QuotationTemplatesService();
    await service.ready();
    const operation = await createTemplateOperation({
      ownerSub: 'visitor', resourceKind: 'customers', entityId: 'remote-customer',
      revisionId: 'remote-r-1', operationId: 'remote-o-1', parentRevisionIds: [], action: 'put',
      value: { id: 'remote-customer', name: '遠端客戶', customerCompany: '遠端公司' },
      createdAt: '2026-09-15T00:00:00.000Z',
    });
    await service.mergeRemote([operation, operation], () => true);
    expect(service.snapshot().operations).toHaveLength(1);
    const reloaded = new QuotationTemplatesService();
    await reloaded.ready();
    expect(reloaded.getCustomers()).toEqual([expect.objectContaining({ id: 'remote-customer' })]);
  });

  it('兩個並行衝突解決者只有先取得 lock 者可寫入，後者不會另建 sibling', async () => {
    const service = new QuotationTemplatesService();
    await service.ready();
    const root = await createTemplateOperation({
      ownerSub: 'visitor', resourceKind: 'customers', entityId: 'conflict-customer', revisionId: 'root-r', operationId: 'root-o', parentRevisionIds: [], action: 'put',
      value: { id: 'conflict-customer', name: '初始', customerCompany: '初始' }, createdAt: '2026-09-15T00:00:00.000Z',
    });
    const branch = (revisionId: string, operationId: string, name: string) => createTemplateOperation({
      ownerSub: 'visitor', resourceKind: 'customers' as const, entityId: 'conflict-customer', revisionId, operationId, parentRevisionIds: ['root-r'], action: 'put' as const,
      value: { id: 'conflict-customer', name, customerCompany: name }, createdAt: '2026-09-15T00:00:01.000Z',
    });
    const [left, right] = await Promise.all([branch('left-r', 'left-o', '左'), branch('right-r', 'right-o', '右')]);
    await service.mergeRemote([root, left, right], () => true);
    const parents = service.getConflicts()[0]?.heads.map((head) => head.revisionId) ?? [];
    const results = await Promise.all([
      service.resolveConflict('customers', 'conflict-customer', 'left-r', false, parents),
      service.resolveConflict('customers', 'conflict-customer', 'left-r', false, parents),
    ]);
    expect(results).toEqual([true, false]);
    expect(service.getConflicts()).toEqual([]);
    expect(service.snapshot().operations).toHaveLength(4);
  });

  it('scope 切換清空快取，過期 owner 回應不可污染新帳號', async () => {
    const service = new QuotationTemplatesService();
    await service.ready();
    await service.saveCustomer({ name: '訪客', customerCompany: '訪客' });
    const old = service.snapshot().operations;
    await service.setScope('user:user-a');
    expect(service.getCustomers()).toEqual([]);
    await service.mergeRemote(old, () => false);
    expect(service.getCustomers()).toEqual([]);
    await service.setScope('visitor');
    expect(service.getCustomers().map((value) => value.name)).toEqual(['訪客']);
  });

  it('遠端驗證晚到失敗後切換帳號，不會把 A 的 error 寫到 B', async () => {
    const service = new QuotationTemplatesService();
    await service.ready();
    const lateFailure = service.mergeRemote([{} as never], () => true);
    await service.setScope('user:account-b');
    await lateFailure;
    expect(service.currentScope()).toBe('user:account-b');
    expect(service.error()).toBeNull();
  });

  it('無 Web Locks 時拒絕不安全寫入', async () => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    const service = new QuotationTemplatesService();
    await service.ready();
    expect(await service.saveCustomer({ name: '不可寫', customerCompany: '不可寫' })).toBe(false);
    expect(storage.values.has('quotation:templates:visitor:v2')).toBe(false);
    expect(service.error()).toContain('鎖定');
  });
});
