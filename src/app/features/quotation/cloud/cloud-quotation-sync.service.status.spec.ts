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
  class DriveServiceUnavailableError extends Error {}
  return {
    DriveCloudApiService: class DriveCloudApiService {},
    DriveAuthorizationRequiredError,
    DriveServiceUnavailableError,
  };
});
jest.mock('./cloud-sync-preference', () => ({
  ...jest.requireActual('./cloud-sync-preference'),
  readSavedCloudSyncPreference: jest.fn(() => true),
  writeCloudSyncEnabledPreference: jest.fn(),
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
import { readSavedCloudSyncPreference } from './cloud-sync-preference';
import {
  CloudQuotationSyncService,
  type CloudSyncStatus,
} from './cloud-quotation-sync.service';
import {
  DriveAuthorizationRequiredError,
  DriveServiceUnavailableError,
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

function createService(apiOverrides: Record<string, unknown> = {}, savedPreference: boolean | null = true) {
  dependencies.clear();
  jest.mocked(readSavedCloudSyncPreference).mockReturnValue(savedPreference);
  let authenticated = true;
  let premium = true;
  let admin = false;
  let userId = 'member-1';
  let userEmail = 'member@example.test';
  const auth = {
    isAuthenticated: () => authenticated,
    isPremium: () => premium,
    isAdmin: () => admin,
    userId: () => userId,
    userEmail: () => userEmail,
    setAccount: (next: {
      authenticated?: boolean;
      premium?: boolean;
      admin?: boolean;
      userId?: string;
      userEmail?: string;
    }) => {
      authenticated = next.authenticated ?? authenticated;
      premium = next.premium ?? premium;
      admin = next.admin ?? admin;
      userId = next.userId ?? userId;
      userEmail = next.userEmail ?? userEmail;
    },
  };
  const api = {
    disconnect: jest.fn(),
    isConfigured: () => true,
    restoreConnection: jest.fn(() => Promise.resolve(true)),
    beginConnect: jest.fn(() => Promise.resolve()),
    listRevisions: jest.fn(() => Promise.resolve(page())),
    ...apiOverrides,
  };
  dependencies.set(AuthService, auth);
  dependencies.set(DriveCloudApiService, api);
  return { service: new CloudQuotationSyncService(), api, auth };
}

async function connect(service: CloudQuotationSyncService): Promise<void> {
  await service.beginConnect();
  expect(service.syncStatus()).toBe('synced');
}

describe('CloudQuotationSyncService 同步狀態', () => {
  it('後端設定未完成時呈現服務問題，不要求使用者重複授權', async () => {
    const error = Object.assign(Object.create(DriveServiceUnavailableError.prototype), {
      code: 'configuration', safeMessage: '雲端服務尚未設定完成，請稍後再試',
    });
    const { service } = createService({ restoreConnection: jest.fn(async () => { throw error; }) });
    await service.initialize();
    expect(service.syncStatus()).toBe('error');
    expect(service.syncError()).toBe('雲端服務尚未設定完成，請稍後再試');
    expect(service.isCloudStorage()).toBe(false);
  });

  it('會員權限失效時離開雲端路由，避免繼續使用舊連線儲存', async () => {
    const error = Object.assign(Object.create(DriveServiceUnavailableError.prototype), {
      code: 'forbidden', safeMessage: '目前帳號無法使用雲端同步',
    });
    const { service, api } = createService();
    await service.initialize();
    expect(service.isCloudStorage()).toBe(true);
    api.listRevisions.mockRejectedValueOnce(error);
    await expect(service.reloadHistory()).rejects.toBe(error);
    expect(service.syncStatus()).toBe('error');
    expect(service.isCloudStorage()).toBe(false);
    expect(api.disconnect).toHaveBeenCalled();
  });
  it('新瀏覽器登入後可找回既有授權並載入雲端歷史', async () => {
    const { service, api } = createService({}, null);
    expect(service.isSyncEnabled()).toBe(false);
    await service.initialize();
    expect(api.restoreConnection).toHaveBeenCalledTimes(1);
    expect(service.isSyncEnabled()).toBe(true);
    expect(service.isCloudStorage()).toBe(true);
    expect(api.listRevisions).toHaveBeenCalledTimes(1);
  });

  it('首次使用且尚無雲端授權時保持本機，不要求重新連線', async () => {
    const { service, api } = createService({
      restoreConnection: jest.fn(async () => false),
    }, null);
    await service.initialize();
    expect(service.isSyncEnabled()).toBe(false);
    expect(service.syncStatus()).toBe('local');
    expect(api.listRevisions).not.toHaveBeenCalled();
  });

  it('明確關閉同步時登入也不會自動探測雲端', async () => {
    const { service, api } = createService({}, false);
    await service.initialize();
    expect(api.restoreConnection).not.toHaveBeenCalled();
    expect(service.syncStatus()).toBe('local');
  });

  it('停用只暫停本頁連線，重新啟用先無提示恢復而不開 popup', async () => {
    const { service, api } = createService();
    await service.initialize();
    api.restoreConnection.mockClear();

    await service.setSyncEnabled(false);
    expect(api.disconnect).toHaveBeenCalled();
    expect(service.syncStatus()).toBe('local');

    await service.setSyncEnabled(true);
    expect(api.restoreConnection).toHaveBeenCalledWith('member@example.test');
    expect(api.beginConnect).not.toHaveBeenCalled();
    expect(service.isCloudStorage()).toBe(true);
  });

  it('重新啟用但尚無授權時只呈現重新連線，不自行開啟授權視窗', async () => {
    const { service, api } = createService({
      restoreConnection: jest.fn(async () => false),
    });
    await service.setSyncEnabled(true);

    expect(api.beginConnect).not.toHaveBeenCalled();
    expect(service.syncStatus()).toBe('reconnect');
    expect(service.isCloudStorage()).toBe(false);
  });

  it('頁面初始化會無提示恢復既有 Drive 授權並載入雲端歷史', async () => {
    const { service, api } = createService();

    await service.initialize();

    expect(api.disconnect).not.toHaveBeenCalled();
    expect(api.restoreConnection).toHaveBeenCalledWith('member@example.test');
    expect(api.listRevisions).toHaveBeenCalledTimes(1);
    expect(service.isCloudStorage()).toBe(true);
    expect(service.history()).toEqual([]);
    expect(service.syncStatus()).toBe('synced');
    expect(service.syncError()).toBeNull();
  });

  it('無法無提示恢復時保留本機歷史路由，並要求使用者重新連線', async () => {
    const { service, api } = createService({
      restoreConnection: jest.fn(() => Promise.resolve(false)),
    });

    await service.initialize();

    expect(api.disconnect).not.toHaveBeenCalled();
    expect(api.listRevisions).not.toHaveBeenCalled();
    expect(service.isCloudStorage()).toBe(false);
    expect(service.history()).toEqual([]);
    expect(service.syncStatus()).toBe('reconnect');
    expect(service.syncError()).toBeNull();
  });

  it('初始化恢復發生授權錯誤時顯示重新連線，且不阻斷本機模式', async () => {
    const { service } = createService({
      restoreConnection: () =>
        Promise.reject(new DriveAuthorizationRequiredError('access_token=secret')),
    });

    await service.initialize();

    expect(service.isCloudStorage()).toBe(false);
    expect(service.syncStatus()).toBe('reconnect');
    expect(service.syncError()).toBe('Google Drive 授權已失效，請重新連線');
  });

  it('缺少 Drive scope 時保留使用者可採取動作的安全訊息', async () => {
    const { service } = createService({
      restoreConnection: () => Promise.reject(
        new DriveAuthorizationRequiredError('請允許 Google Drive 存取權限後重新連線')
      ),
    });
    await service.initialize();
    expect(service.syncStatus()).toBe('reconnect');
    expect(service.syncError()).toBe('請允許 Google Drive 存取權限後重新連線');
  });

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

  it('登出後舊的初始化恢復晚到，不會重設為雲端模式', async () => {
    const restoreGate = deferred<boolean>();
    const { service, api } = createService({
      restoreConnection: () => restoreGate.promise,
    });

    const initializing = service.initialize();
    await Promise.resolve();
    service.disconnect();
    restoreGate.resolve(true);
    await initializing;

    expect(api.listRevisions).not.toHaveBeenCalled();
    expect(service.history()).toEqual([]);
    expect(service.isCloudStorage()).toBe(false);
    expect(service.syncStatus()).toBe('local');
  });

  it('帳號切換後舊恢復晚到，不會覆蓋新帳號的雲端資料', async () => {
    const firstRestore = deferred<boolean>();
    const secondRestore = deferred<boolean>();
    const { service, api, auth } = createService({
      restoreConnection: jest
        .fn()
        .mockReturnValueOnce(firstRestore.promise)
        .mockReturnValueOnce(secondRestore.promise),
      listRevisions: jest.fn(() => Promise.resolve(pageWithRevision('member-2'))),
    });

    const firstInitialization = service.initialize();
    await Promise.resolve();
    auth.setAccount({
      userId: 'member-2',
      userEmail: 'member-2@example.test',
    });
    const secondInitialization = service.initialize();
    await Promise.resolve();
    secondRestore.resolve(true);
    await secondInitialization;
    firstRestore.resolve(true);
    await firstInitialization;

    expect(api.restoreConnection).toHaveBeenNthCalledWith(
      1,
      'member@example.test'
    );
    expect(api.restoreConnection).toHaveBeenNthCalledWith(
      2,
      'member-2@example.test'
    );
    expect(service.history()[0]?.quotationId).toBe('member-2');
    expect(service.isCloudStorage()).toBe(true);
    expect(service.syncStatus()).toBe('synced');
  });

  it('A 關閉同步不會使 B 登入後略過 silent restore', async () => {
    const { service, api, auth } = createService();
    jest.mocked(readSavedCloudSyncPreference).mockImplementation((ownerId) =>
      ownerId === 'member-1' ? false : null
    );
    await service.initialize();
    expect(api.restoreConnection).not.toHaveBeenCalled();

    auth.setAccount({ userId: 'member-2', userEmail: 'member-2@example.test' });
    await service.initialize();
    expect(api.restoreConnection).toHaveBeenCalledWith('member-2@example.test');
  });
});
