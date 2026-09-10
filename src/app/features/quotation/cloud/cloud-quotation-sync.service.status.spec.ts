const dependencies = new Map<unknown, unknown>();

jest.mock('@angular/core', () => ({
  Injectable: () => (target: unknown) => target,
  computed: <T>(compute: () => T) => compute,
  inject: (token: unknown) => dependencies.get(token),
  signal: <T>(initial: T) => {
    let value = initial;
    const state = (() => value) as (() => T) & {
      set(next: T): void;
      update(updater: (current: T) => T): void;
    };
    state.set = (next: T): void => {
      value = next;
    };
    state.update = (updater: (current: T) => T): void => {
      value = updater(value);
    };
    return state;
  },
}));

jest.mock('@app/core/services/auth.service', () => ({
  AuthService: class AuthService {},
}), { virtual: true });
jest.mock('./drive-cloud-api.service', () => {
  class DriveAuthorizationRequiredError extends Error {}
  return {
    DriveCloudApiService: class DriveCloudApiService {},
    DriveAuthorizationRequiredError,
  };
});
jest.mock('./cloud-sync-preference', () => ({
  readCloudSyncEnabledPreference: () => true,
  writeCloudSyncEnabledPreference: jest.fn(),
  decideCloudSyncInitialization: () => 'restore',
}));
jest.mock('./cloud-history', () => ({
  buildCloudHistoryEntries: (revisions: Array<Record<string, unknown>>) =>
    revisions.map((revision) => ({
      fileId: revision['fileId'],
      quotationId: revision['quotationId'],
      revisionId: revision['revisionId'],
      headRevisionIds: [revision['revisionId']],
      data: { customerCompany: revision['quotationId'] },
    })),
}));
jest.mock('./index', () => ({
  CLOUD_SCHEMA_VERSION: 1,
  WebCryptoSha256HashProvider: class WebCryptoSha256HashProvider {},
  createCloudQuotationDraft: jest.fn(),
  createCloudQuotationRevision: jest.fn(),
  createCloudSaveOperation: jest.fn(),
  createQuotationCloudSummary: jest.fn(),
  verifyCloudQuotationEnvelope: jest.fn(),
  decideQuotationStorageRoute: (input: { driveConnection: string }) =>
    input.driveConnection === 'connected'
      ? { repository: 'cloud-sync', reason: 'premium-drive-connected', cloudAction: 'sync' }
      : {
          repository: 'local-history',
          reason:
            input.driveConnection === 'reconnect-required'
              ? 'drive-reconnect-required'
              : 'drive-not-connected',
          maxHistoryItems: 5,
          cloudAction: 'none',
        },
}));

import { AuthService } from '@app/core/services/auth.service';
import {
  CloudQuotationSyncService,
  type CloudSyncStatus,
} from './cloud-quotation-sync.service';
import {
  DriveAuthorizationRequiredError,
  DriveCloudApiService,
} from './drive-cloud-api.service';

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function page() {
  return { files: [], nextPageToken: null };
}

function pageWithRevision(id: string) {
  return {
    files: [
      {
        fileId: `file-${id}`,
        name: `quotation-${id}`,
        quotationId: id,
        revisionId: `revision-${id}`,
        parentRevisionIds: [],
        kind: 'create',
        createdAt: '2026-09-11T00:00:00.000Z',
      },
    ],
    nextPageToken: null,
  };
}

function createService(apiOverrides: Record<string, unknown> = {}) {
  dependencies.clear();
  const auth = {
    isAuthenticated: () => true,
    isPremium: () => true,
    isAdmin: () => false,
    userId: () => 'member-1',
    userEmail: () => 'member@example.test',
  };
  const api = {
    disconnect: jest.fn(),
    isConfigured: () => true,
    restoreConnection: () => Promise.resolve(true),
    beginConnect: () => Promise.resolve(),
    listRevisions: () => Promise.resolve(page()),
    ...apiOverrides,
  };
  dependencies.set(AuthService, auth);
  dependencies.set(DriveCloudApiService, api);
  return { service: new CloudQuotationSyncService(), api };
}

async function connect(service: CloudQuotationSyncService): Promise<void> {
  await service.beginConnect();
  expect(service.syncStatus()).toBe('synced');
}

describe('CloudQuotationSyncService 同步狀態', () => {
  it('本機預設為 local，連線、同步成功後更新最後同步時間', async () => {
    const connectGate = deferred<void>();
    const listGate = deferred<ReturnType<typeof page>>();
    const { service } = createService({
      beginConnect: () => connectGate.promise,
      listRevisions: () => listGate.promise,
    });

    expect(service.syncStatus()).toBe<CloudSyncStatus>('local');
    const connecting = service.beginConnect();
    expect(service.syncStatus()).toBe('connecting');

    connectGate.resolve();
    await Promise.resolve();
    expect(service.syncStatus()).toBe('syncing');
    listGate.resolve(page());
    await connecting;

    expect(service.syncStatus()).toBe('synced');
    expect(service.lastSyncedAt()).toEqual(expect.any(Number));
    expect(service.syncError()).toBeNull();
  });

  it('可恢復錯誤使用安全訊息，授權失效要求重新連線', async () => {
    const transient = createService({
      listRevisions: () => Promise.reject({ status: 503, message: 'token=secret' }),
    }).service;
    await expect(transient.beginConnect()).rejects.toEqual(expect.anything());
    expect(transient.syncStatus()).toBe('error');
    expect(transient.syncError()).toBe('雲端同步暫時無法完成，請稍後重試');

    const authorization = createService({
      listRevisions: () =>
        Promise.reject(new DriveAuthorizationRequiredError('access_token=secret')),
    }).service;
    await expect(authorization.beginConnect()).rejects.toEqual(expect.anything());
    expect(authorization.syncStatus()).toBe('reconnect');
    expect(authorization.syncError()).toBe('Google Drive 授權已失效，請重新連線');
  });

  it('較舊操作晚到失敗時不覆蓋較新同步成功的狀態', async () => {
    const first = deferred<ReturnType<typeof page>>();
    const second = deferred<ReturnType<typeof page>>();
    const { service } = createService({
      listRevisions: jest
        .fn()
        .mockReturnValueOnce(Promise.resolve(page()))
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise),
    });
    await connect(service);

    const olderOperation = service.reloadHistory();
    await Promise.resolve();
    const newerOperation = service.reloadHistory();
    second.resolve(page());
    await newerOperation;
    first.reject(new DriveAuthorizationRequiredError('stale authorization'));
    await expect(olderOperation).rejects.toEqual(expect.anything());

    expect(service.syncStatus()).toBe('synced');
    expect(service.syncError()).toBeNull();
    expect(service.isCloudStorage()).toBe(true);
  });

  it('較舊清單成功回應不會覆蓋較新的歷史資料', async () => {
    const first = deferred<ReturnType<typeof pageWithRevision>>();
    const second = deferred<ReturnType<typeof pageWithRevision>>();
    const { service } = createService({
      listRevisions: jest
        .fn()
        .mockReturnValueOnce(Promise.resolve(page()))
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise),
    });
    await connect(service);

    const olderOperation = service.reloadHistory();
    await Promise.resolve();
    const newerOperation = service.reloadHistory();
    second.resolve(pageWithRevision('newer'));
    await newerOperation;
    first.resolve(pageWithRevision('older'));
    await olderOperation;

    expect(service.history()[0]?.quotationId).toBe('newer');
    expect(service.syncStatus()).toBe('synced');
  });

  it('舊的自動恢復失敗不會把較新成功同步切回本機', async () => {
    const older = deferred<ReturnType<typeof page>>();
    const newer = deferred<ReturnType<typeof page>>();
    const { service } = createService({
      listRevisions: jest
        .fn()
        .mockReturnValueOnce(older.promise)
        .mockReturnValueOnce(newer.promise),
    });

    const initializing = service.initialize();
    await Promise.resolve();
    await Promise.resolve();
    const reloading = service.reloadHistory();
    newer.resolve(page());
    await reloading;
    older.reject(new DriveAuthorizationRequiredError('stale authorization'));
    await initializing;

    expect(service.isCloudStorage()).toBe(true);
    expect(service.syncStatus()).toBe('synced');
    expect(service.syncError()).toBeNull();
  });
});
