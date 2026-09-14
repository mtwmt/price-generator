/** Sync coordinator integration: two isolated local stores and an in-memory Drive log. */
const dependencies = new Map<unknown, unknown>();
class MockDestroyRef {}

jest.mock('@angular/core', () => ({
  Injectable: () => (target: unknown) => target,
  inject: (token: unknown) => dependencies.get(token),
  signal: <T>(initial: T) => {
    let value = initial;
    const state = (() => value) as (() => T) & { set(next: T): void; update(fn: (value: T) => T): void };
    state.set = (next) => { value = next; };
    state.update = (fn) => { value = fn(value); };
    return state;
  },
  DestroyRef: MockDestroyRef,
}));
jest.mock('@app/core/services/auth.service', () => ({ AuthService: class AuthService {} }), { virtual: true });
jest.mock('./drive-cloud-api.service', () => ({
  DriveCloudApiService: class DriveCloudApiService {},
  DriveAuthorizationRequiredError: class DriveAuthorizationRequiredError extends Error {},
}));
jest.mock('@app/shared/services/storage.service', () => ({ StorageService: class StorageService {} }), { virtual: true });
jest.mock('./cloud-quotation-sync.service', () => ({
  CloudQuotationSyncService: class CloudQuotationSyncService {},
}));

import { AuthService } from '@app/core/services/auth.service';
import { CloudTemplateSyncService } from './cloud-template-sync.service';
import { CloudQuotationSyncService } from './cloud-quotation-sync.service';
import { DriveCloudApiService } from './drive-cloud-api.service';
import { createTemplateOperation, mergeTemplateOperations, type TemplateOperation } from './template-sync-domain';
import { QuotationTemplatesService } from '../services/quotation-templates.service';
import { StorageService } from '@app/shared/services/storage.service';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

interface MemoryStorage {
  readonly values: Map<string, unknown>;
  failWrites: boolean;
  readJson<T>(key: string): { status: 'ok'; value: T } | { status: 'missing' };
  setDetailed<T>(key: string, value: T): { success: boolean };
}

function memoryStorage(): MemoryStorage {
  const values = new Map<string, unknown>();
  return {
    values, failWrites: false,
    readJson<T>(key: string) { return values.has(key) ? { status: 'ok', value: values.get(key) as T } : { status: 'missing' }; },
    setDetailed<T>(key: string, value: T) {
      if (this.failWrites) return { success: false };
      values.set(key, JSON.parse(JSON.stringify(value)) as unknown);
      return { success: true };
    },
  };
}

function installLockSerializer(): void {
  const tails = new Map<string, Promise<void>>();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    locks: { async request<T>(name: string, callback: () => Promise<T>): Promise<T> {
      const prior = tails.get(name) ?? Promise.resolve();
      let release!: () => void;
      const tail = new Promise<void>((done) => { release = done; });
      tails.set(name, prior.then(() => tail));
      await prior;
      try { return await callback(); } finally { release(); }
    } },
  } });
}

const liveSyncs: CloudTemplateSyncService[] = [];

afterEach(() => {
  // Error paths schedule exponential retry; disable each coordinator so no timer
  // survives the test process and accidentally drives the next device fixture.
  liveSyncs.splice(0).forEach((service) => service.configure(null, false, false));
});

class TemplateStore {
  private static replicas = 0;
  private readonly replica = ++TemplateStore.replicas;
  private operations: TemplateOperation[] = [];
  private pending = new Set<string>();
  private scope = 'visitor';
  readonly saved = new Map<string, TemplateOperation>();
  failAcknowledge = false;
  async ready() { /* mirrors durable-store readiness */ }
  async refresh() { /* each test has its own local storage mock */ }
  currentScope() { return this.scope; }
  setScope(scope: string) { this.scope = scope; }
  snapshot() { return { operations: [...this.operations], pendingIds: [...this.pending] }; }
  getConflicts() { return mergeTemplateOperations(this.operations, this.scope.slice(5)).filter(entity => entity.heads.length > 1); }
  async mergeRemote(remote: readonly TemplateOperation[]) {
    const seen = new Set(this.operations.map(operation => operation.revisionId));
    this.operations.push(...remote.filter(operation => !seen.has(operation.revisionId)));
    // A malformed remote graph must fail before mutating the local branch.
    mergeTemplateOperations(this.operations, this.scope.slice(5));
  }
  async acknowledge(operationId: string) {
    if (this.failAcknowledge) throw new DOMException('quota', 'QuotaExceededError');
    this.pending.delete(operationId);
  }
  async put(owner: string, id: string, name: string, kind: 'customers' | 'service-items' = 'customers') {
    const heads = mergeTemplateOperations(this.operations, owner)
      .find(entity => entity.resourceKind === kind && entity.entityId === id)?.heads ?? [];
    const serial = this.operations.length + 1;
    const operation = await createTemplateOperation({
      ownerSub: owner, resourceKind: kind, entityId: id,
      revisionId: `r-${owner}-${this.replica}-${serial}`, operationId: `o-${owner}-${this.replica}-${serial}`,
      parentRevisionIds: heads.map(head => head.revisionId), action: 'put',
      value: kind === 'customers'
        ? { id, name, customerCompany: name }
        : { id, name, item: name, price: serial },
      createdAt: `2026-09-15T00:00:${String(serial).padStart(2, '0')}.000Z`,
    });
    this.operations.push(operation); this.pending.add(operation.operationId); this.saved.set(id, operation);
    return operation;
  }
  async remove(owner: string, id: string, kind: 'customers' | 'service-items' = 'customers') {
    const heads = mergeTemplateOperations(this.operations, owner)
      .find(entity => entity.resourceKind === kind && entity.entityId === id)?.heads ?? [];
    const serial = this.operations.length + 1;
    const operation = await createTemplateOperation({
      ownerSub: owner, resourceKind: kind, entityId: id,
      revisionId: `r-${owner}-${this.replica}-${serial}`, operationId: `o-${owner}-${this.replica}-${serial}`,
      parentRevisionIds: heads.map(head => head.revisionId), action: 'delete', value: null,
      createdAt: `2026-09-15T00:01:${String(serial).padStart(2, '0')}.000Z`,
    });
    this.operations.push(operation); this.pending.add(operation.operationId); this.saved.set(id, operation);
    return operation;
  }
  async resolve(owner: string, id: string, name: string) {
    // Resolution must cover every visible branch, rather than silently choosing one.
    return this.put(owner, id, name);
  }
}

function createHarness(owner = 'owner-A', files = new Map<string, TemplateOperation>()) {
  dependencies.clear();
  let activeOwner: string | null = owner;
  let listGate: ReturnType<typeof deferred<void>> | undefined;
  let offline = false;
  let invalidRemote = false;
  let loseReceipt = false;
  const calls = { list: 0, get: 0, create: 0 };
  const api = {
    listTemplateOperations: jest.fn(async (requestedOwner: string) => {
      calls.list++;
      if (listGate) await listGate.promise;
      if (offline) throw new Error('offline');
      return {
        files: [...files].filter(([, operation]) => operation.ownerSub === requestedOwner)
          .map(([fileId]) => ({ fileId })), nextPageToken: null,
      };
    }),
    getTemplateOperation: jest.fn(async (_owner: string, fileId: string) => {
      calls.get++;
      if (invalidRemote) throw new Error('遠端 schema 不合法');
      return files.get(fileId)!;
    }),
    createTemplateOperation: jest.fn(async (operation: TemplateOperation) => {
      calls.create++;
      const present = [...files.values()].some(prior => prior.operationId === operation.operationId);
      if (!present) files.set(`file-${files.size + 1}`, operation);
      if (loseReceipt) { loseReceipt = false; throw new Error('accepted but receipt lost'); }
    }),
  };
  const templates = new TemplateStore(); templates.setScope(`user:${owner}`);
  const auth = { userId: () => activeOwner };
  const quotations = { isEligible: () => true, isSyncEnabled: () => true, isCloudStorage: () => true };
  const destroy = { onDestroy: jest.fn() };
  dependencies.set(AuthService, auth); dependencies.set(DriveCloudApiService, api);
  dependencies.set(CloudQuotationSyncService, quotations); dependencies.set(QuotationTemplatesService, templates);
  dependencies.set(MockDestroyRef, destroy);
  const service = new CloudTemplateSyncService();
  liveSyncs.push(service);
  service.configure(owner, true, true);
  return {
    service, templates, api, files, calls,
    offline: (next: boolean) => { offline = next; },
    invalidateRemote: () => { invalidRemote = true; },
    loseReceipt: () => { loseReceipt = true; },
    gateList: () => { listGate = deferred<void>(); return listGate; },
    switchOwner: (next: string | null, enabled = true) => { activeOwner = next; templates.setScope(next ? `user:${next}` : 'visitor'); service.configure(next, enabled, true); },
  };
}

describe('CloudTemplateSyncService → in-memory Drive cross-device integration', () => {
  it('實際 TemplatesService 以兩個獨立本機封套同步新增、更新與刪除', async () => {
    installLockSerializer();
    const files = new Map<string, TemplateOperation>();
    const api = {
      listTemplateOperations: async (owner: string) => ({
        files: [...files].filter(([, operation]) => operation.ownerSub === owner).map(([fileId]) => ({ fileId })),
        nextPageToken: null,
      }),
      getTemplateOperation: async (_owner: string, fileId: string) => files.get(fileId)!,
      createTemplateOperation: async (operation: TemplateOperation) => {
        if (![...files.values()].some((prior) => prior.operationId === operation.operationId)) {
          files.set(`file-${files.size + 1}`, operation);
        }
      },
    };
    const createDevice = async (storage: MemoryStorage) => {
      dependencies.clear();
      dependencies.set(StorageService, storage);
      dependencies.set(AuthService, { userId: () => 'owner-A' });
      dependencies.set(DriveCloudApiService, api);
      dependencies.set(CloudQuotationSyncService, { isEligible: () => true, isSyncEnabled: () => true, isCloudStorage: () => true });
      dependencies.set(MockDestroyRef, { onDestroy: jest.fn() });
      const templates = new QuotationTemplatesService();
      await templates.setScope('user:owner-A');
      dependencies.set(QuotationTemplatesService, templates);
      const sync = new CloudTemplateSyncService(); liveSyncs.push(sync);
      sync.configure('owner-A', true, true); await sync.retry();
      return { templates, sync };
    };
    const a = await createDevice(memoryStorage());
    expect(await a.templates.saveCustomer({ id: 'customer-1', name: '初版', customerCompany: '初版公司' })).toBe(true);
    expect(await a.templates.saveServiceItem({ id: 'item-1', name: '設計', item: '設計', price: 1000 })).toBe(true);
    await a.sync.retry();
    const b = await createDevice(memoryStorage());
    expect(b.templates.getCustomers()).toEqual([expect.objectContaining({ id: 'customer-1', name: '初版' })]);
    expect(b.templates.getServiceItems()).toEqual([expect.objectContaining({ id: 'item-1', price: 1000 })]);
    const customer = a.templates.getCustomers()[0];
    expect(await a.templates.saveCustomer({ ...customer, name: '更新版' }, a.templates.baseFor(customer))).toBe(true);
    expect(await a.templates.deleteServiceItem('item-1')).toBe(true);
    await a.sync.retry(); await b.sync.retry();
    expect(b.templates.getCustomers()).toEqual([expect.objectContaining({ id: 'customer-1', name: '更新版' })]);
    expect(b.templates.getServiceItems()).toEqual([]);
    expect(b.templates.snapshot().pendingIds).toEqual([]);

    // Drive 被清空（例如同 UID 重新連線到不同 appData）後，已 ack 的
    // 本機操作也必須依 DAG 補送；否則 tombstone 會遺失並在新裝置復活。
    files.clear();
    await a.sync.retry();
    expect(files.size).toBe(a.templates.snapshot().operations.length);
    const fresh = await createDevice(memoryStorage());
    expect(fresh.templates.getCustomers()).toEqual([expect.objectContaining({ id: 'customer-1', name: '更新版' })]);
    expect(fresh.templates.getServiceItems()).toEqual([]);
  });

  it('A 新增後 B 可拉取；後續更新、服務項目與刪除不會被舊快取復活', async () => {
    const files = new Map<string, TemplateOperation>();
    const a = createHarness('owner-A', files); await a.service.retry();
    await a.templates.put('owner-A', 'customer-1', '第一版');
    await a.templates.put('owner-A', 'item-1', '設計費', 'service-items');
    await a.service.retry();
    const b = createHarness('owner-A', files); await b.service.retry();
    expect(mergeTemplateOperations(b.templates.snapshot().operations, 'owner-A').find(entity => entity.entityId === 'customer-1')?.heads[0].value).toMatchObject({ name: '第一版' });
    expect(mergeTemplateOperations(b.templates.snapshot().operations, 'owner-A').find(entity => entity.entityId === 'item-1')?.heads[0].value).toMatchObject({ item: '設計費' });
    await a.templates.put('owner-A', 'customer-1', '第二版'); await a.templates.remove('owner-A', 'item-1', 'service-items');
    await a.service.retry(); await b.service.retry();
    const item = mergeTemplateOperations(b.templates.snapshot().operations, 'owner-A').find(entity => entity.entityId === 'item-1');
    expect(mergeTemplateOperations(b.templates.snapshot().operations, 'owner-A').find(entity => entity.entityId === 'customer-1')?.heads[0].value).toMatchObject({ name: '第二版' });
    expect(item?.heads[0].action).toBe('delete');
  });

  it('離線 refresh 保留 pending；Drive 接受但 receipt 遺失時以同一 operation 重試', async () => {
    const h = createHarness(); await h.service.retry();
    const operation = await h.templates.put('owner-A', 'customer-1', '離線客戶');
    h.offline(true); await h.service.retry();
    expect(h.service.status()).toBe('error'); expect(h.templates.snapshot().pendingIds).toContain(operation.operationId);
    h.offline(false); h.loseReceipt(); await h.service.retry();
    expect(h.templates.snapshot().pendingIds).toContain(operation.operationId);
    await h.service.retry();
    expect(h.templates.snapshot().pendingIds).not.toContain(operation.operationId);
    const writes = h.api.createTemplateOperation.mock.calls.map(([sent]) => (sent as TemplateOperation).operationId);
    expect(writes.filter(id => id === operation.operationId)).toHaveLength(2);
    expect([...h.files.values()].filter(remote => remote.operationId === operation.operationId)).toHaveLength(1);
  });

  it('並行 edit/delete 保留兩個 heads；拉取途中再編輯仍會排入上傳', async () => {
    const files = new Map<string, TemplateOperation>();
    const a = createHarness('owner-A', files); await a.service.retry(); await a.templates.put('owner-A', 'customer-1', '原稿'); await a.service.retry();
    const b = createHarness('owner-A', files); await b.service.retry();
    await a.templates.put('owner-A', 'customer-1', 'A 編輯'); await b.templates.remove('owner-A', 'customer-1');
    await a.service.retry(); await b.service.retry(); await a.service.retry();
    expect(a.templates.getConflicts()[0]?.heads).toHaveLength(2);
    const resolved = await a.templates.resolve('owner-A', 'customer-1', '採用 A 編輯'); await a.service.retry();
    expect(resolved.parentRevisionIds).toHaveLength(2);
    expect(a.templates.getConflicts()).toEqual([]);
    const c = createHarness('owner-A', files); const gate = c.gateList();
    const loading = c.service.retry(); await Promise.resolve();
    const late = await c.templates.put('owner-A', 'customer-2', '拉取中編輯'); gate.resolve(); await loading;
    expect([...files.values()].some(remote => remote.operationId === late.operationId)).toBe(true);
  });

  it('切 owner、登出或停用後，舊回應不污染新 scope 也不接著送出', async () => {
    const h = createHarness(); await h.service.retry(); await h.templates.put('owner-A', 'customer-1', '舊帳號');
    const gate = h.gateList(); const running = h.service.retry(); await Promise.resolve();
    h.switchOwner('owner-B'); gate.resolve(); await running;
    expect(h.templates.snapshot().pendingIds).toHaveLength(1);
    expect(h.calls.create).toBe(0);
    h.switchOwner(null, false); await h.service.retry(); expect(h.calls.create).toBe(0);
  });

  it('遠端 schema 錯誤或本機 quota ack 失敗不會視為空資料或已同步', async () => {
    const malformed = createHarness(); const local = await malformed.templates.put('owner-A', 'customer-1', '本機保留');
    malformed.files.set('bad-schema-file', local);
    malformed.invalidateRemote(); await malformed.service.retry();
    expect(malformed.service.status()).toBe('error'); expect(malformed.templates.snapshot().operations).toHaveLength(1);
    const quota = createHarness(); await quota.service.retry(); const op = await quota.templates.put('owner-A', 'customer-2', '容量失敗'); quota.templates.failAcknowledge = true;
    await quota.service.retry();
    expect(quota.service.status()).toBe('error'); expect(quota.templates.snapshot().pendingIds).toContain(op.operationId);
  });
});
