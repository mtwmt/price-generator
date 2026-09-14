const dependencies = new Map<unknown, unknown>();

jest.mock('@angular/core', () => ({
  Injectable: () => (target: unknown) => target,
  inject: (token: unknown) => dependencies.get(token),
}));
jest.mock('@app/core/services/auth.service', () => ({
  AuthService: class AuthService {},
}), { virtual: true });
jest.mock('./drive-authorization-api.service', () => {
  class DriveAuthorizationApiService {}
  class DriveAuthorizationBrokerError extends Error {
    constructor(readonly failure: string, readonly status: number | null, readonly safeMessage: string) {
      super(safeMessage);
    }
    get requiresReauthorization(): boolean {
      return ['not_connected', 'reauthorization_required', 'account_mismatch', 'scope_not_granted'].includes(this.failure);
    }
  }
  return { DriveAuthorizationApiService, DriveAuthorizationBrokerError };
});
jest.mock('./template-sync-domain', () => ({
  MAX_TEMPLATE_OPERATION_BYTES: 65_536,
  canonicalTemplateOperation: (operation: Record<string, unknown>) => {
    const { contentHash: _contentHash, ...content } = operation;
    return JSON.stringify(content);
  },
  validateTemplateOperation: async (value: unknown, owner: string) => {
    const operation = value as Record<string, unknown>;
    if (
      !operation ||
      operation['schemaVersion'] !== 1 ||
      operation['ownerSub'] !== owner ||
      operation['contentHash'] !== 'valid-hash'
    ) {
      throw new Error('template operation is invalid');
    }
    return operation;
  },
}));

import { AuthService } from '@app/core/services/auth.service';
import {
  DriveAuthorizationApiService,
  DriveAuthorizationBrokerError,
} from './drive-authorization-api.service';
import {
  DriveAuthorizationRequiredError,
  DriveCloudApiService,
} from './drive-cloud-api.service';
import type { TemplateOperation } from './template-sync-domain';

const grant = {
  accessToken: 'drive-token',
  expiresIn: 3600,
  email: 'member@example.com',
  ownerId: 'member-1',
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
  } as Response;
}

const templateOperation: TemplateOperation = {
  schemaVersion: 1,
  ownerSub: 'member-1',
  resourceKind: 'customers',
  entityId: 'customer-1',
  revisionId: 'revision-1',
  operationId: 'operation-1',
  parentRevisionIds: [],
  action: 'put',
  value: { id: 'customer-1', name: '王小明', customerCompany: '測試公司' },
  createdAt: '2026-09-15T00:00:00.000Z',
  contentHash: 'valid-hash',
};

function templateFile(fileId = 'template-file-1') {
  return {
    id: fileId,
    appProperties: {
      app: 'price-quotation-templates',
      ownerSub: 'member-1',
      operationId: 'operation-1',
      revisionId: 'revision-1',
    },
  };
}

describe('DriveCloudApiService', () => {
  const originalFetch = globalThis.fetch;
  const browser = globalThis as unknown as { window?: typeof window };
  const auth = { userId: jest.fn(() => 'member-1') };
  const broker = { connect: jest.fn(), token: jest.fn() };
  let fetchMock: jest.Mock;
  let codeConfig:
    | {
        hint?: string;
        scope?: string;
        ux_mode?: string;
        include_granted_scopes?: boolean;
        callback: (response: { code?: string }) => void;
      }
    | undefined;

  beforeEach(() => {
    dependencies.clear();
    dependencies.set(AuthService, auth);
    dependencies.set(DriveAuthorizationApiService, broker);
    auth.userId.mockReturnValue('member-1');
    broker.connect.mockReset();
    broker.token.mockReset();
    codeConfig = undefined;
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    browser.window = {} as typeof window;
    browser.window.google = {
      accounts: {
        oauth2: {
          initCodeClient: (config) => {
            codeConfig = config;
            return { requestCode: () => config.callback({ code: 'google-code' }) };
          },
        },
      },
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete browser.window;
  });

  it('重新載入後以 broker 無視窗恢復同帳號 token', async () => {
    broker.token.mockResolvedValue(grant);
    const service = new DriveCloudApiService();
    await expect(service.restoreConnection('member@example.com')).resolves.toBe(true);
    expect(broker.token).toHaveBeenCalledTimes(1);
    expect(codeConfig).toBeUndefined();
  });

  it('使用授權碼 popup 連線，並以 hint 限定會員帳號', async () => {
    broker.connect.mockResolvedValue(grant);
    const service = new DriveCloudApiService();
    await service.beginConnect('member@example.com');
    expect(broker.connect).toHaveBeenCalledWith('google-code');
    expect(codeConfig).toMatchObject({
      hint: 'member@example.com', ux_mode: 'popup', include_granted_scopes: true,
    });
    expect(codeConfig?.scope).toContain('drive.appdata');
  });

  it('已撤銷授權時恢復連線回傳 false', async () => {
    broker.token.mockRejectedValue(new DriveAuthorizationBrokerError('reauthorization_required', 409, 'safe'));
    await expect(new DriveCloudApiService().restoreConnection('member@example.com')).resolves.toBe(false);
  });

  it('Drive scope 未授與時要求重新連線並保留安全說明', async () => {
    broker.token.mockRejectedValue(new DriveAuthorizationBrokerError(
      'scope_not_granted', 403, '請允許 Google Drive 存取權限後重新連線'
    ));
    await expect(new DriveCloudApiService().restoreConnection('member@example.com')).rejects.toThrow(
      '請允許 Google Drive 存取權限後重新連線'
    );
  });

  it('服務設定錯誤不會偽裝成重新連線', async () => {
    broker.token.mockRejectedValue(new DriveAuthorizationBrokerError('configuration', 503, 'safe'));
    await expect(new DriveCloudApiService().restoreConnection('member@example.com')).rejects.toEqual(
      expect.objectContaining({ code: 'configuration', status: 503 })
    );
  });

  it('晚到 token 不會在登出後覆蓋連線', async () => {
    let resolveToken!: (value: typeof grant) => void;
    broker.token.mockReturnValue(new Promise((resolve) => { resolveToken = resolve; }));
    const service = new DriveCloudApiService();
    const restoring = service.restoreConnection('member@example.com');
    service.disconnect();
    resolveToken(grant);
    await expect(restoring).rejects.toThrow('Google Drive 連線已取消');
  });

  it('同會員信箱更名可恢復，但不同 uid 必須拒絕', async () => {
    broker.token.mockResolvedValue({ ...grant, email: 'other@example.com' });
    await expect(new DriveCloudApiService().restoreConnection('member@example.com')).resolves.toBe(true);

    broker.token.mockResolvedValue({ ...grant, ownerId: 'member-2' });
    await expect(new DriveCloudApiService().restoreConnection('member@example.com')).rejects.toThrow(
      '目前會員不一致'
    );
  });

  it('過期 token 的並行請求共用一次 broker 更新', async () => {
    broker.connect.mockResolvedValue({ ...grant, expiresIn: 1 });
    broker.token.mockResolvedValue(grant);
    fetchMock.mockResolvedValue(jsonResponse({ files: [] }));
    const service = new DriveCloudApiService();
    await service.beginConnect('member@example.com');
    await Promise.all([service.listRevisions('member-1'), service.listRevisions('member-1')]);
    expect(broker.token).toHaveBeenCalledTimes(1);
  });

  it('Drive 401 會更新 token 後只重試一次', async () => {
    broker.connect.mockResolvedValue(grant);
    broker.token.mockResolvedValue({ ...grant, accessToken: 'new-token' });
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 401)).mockResolvedValueOnce(jsonResponse({ files: [] }));
    const service = new DriveCloudApiService();
    await service.beginConnect('member@example.com');
    await expect(service.listRevisions('member-1')).resolves.toEqual({ files: [], nextPageToken: null });
    expect(broker.token).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('第二次 Drive 401 不會無限重試', async () => {
    broker.connect.mockResolvedValue(grant);
    broker.token.mockResolvedValue({ ...grant, accessToken: 'new-token' });
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 401)).mockResolvedValueOnce(jsonResponse({}, 401));
    const service = new DriveCloudApiService();
    await service.beginConnect('member@example.com');
    await expect(service.listRevisions('member-1')).rejects.toBeInstanceOf(DriveAuthorizationRequiredError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('常用資料清單只查獨立 namespace，且拒絕不合格 metadata', async () => {
    broker.connect.mockResolvedValue(grant);
    fetchMock.mockResolvedValue(jsonResponse({ files: [templateFile()] }));
    const service = new DriveCloudApiService();
    await service.beginConnect('member@example.com');

    await expect(service.listTemplateOperations('member-1')).resolves.toEqual({
      files: [{ fileId: 'template-file-1' }], nextPageToken: null,
    });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('price-quotation-templates');
    expect(url).not.toContain("value%3D%27price-quotation%27");

    fetchMock.mockResolvedValueOnce(jsonResponse({ files: [{ ...templateFile(), appProperties: { ...templateFile().appProperties, app: 'price-quotation' } }] }));
    await expect(service.listTemplateOperations('member-1')).rejects.toThrow('namespace');
  });

  it('讀取常用資料時套用 64 KiB、schema、owner 與 hash 驗證', async () => {
    broker.connect.mockResolvedValue(grant);
    const service = new DriveCloudApiService();
    await service.beginConnect('member@example.com');

    fetchMock.mockResolvedValueOnce(jsonResponse('x'.repeat(65_537)));
    await expect(service.getTemplateOperation('member-1', 'template-file-1')).rejects.toThrow('64 KiB');

    fetchMock.mockResolvedValueOnce(jsonResponse({ ...templateOperation, schemaVersion: 2 }));
    await expect(service.getTemplateOperation('member-1', 'template-file-1')).rejects.toThrow('invalid');
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...templateOperation, ownerSub: 'member-2' }));
    await expect(service.getTemplateOperation('member-1', 'template-file-1')).rejects.toThrow('invalid');
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...templateOperation, contentHash: 'bad-hash' }));
    await expect(service.getTemplateOperation('member-1', 'template-file-1')).rejects.toThrow('invalid');
  });

  it('相同 operationId 的所有分頁內容相同時折疊，不會再次 POST', async () => {
    broker.connect.mockResolvedValue(grant);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ files: [], nextPageToken: 'page-2' }))
      .mockResolvedValueOnce(jsonResponse({ files: [templateFile()] }))
      .mockResolvedValueOnce(jsonResponse(templateOperation));
    const service = new DriveCloudApiService();
    await service.beginConnect('member@example.com');

    await expect(service.createTemplateOperation(templateOperation)).resolves.toBeUndefined();
    expect(String(fetchMock.mock.calls[1][0])).toContain('pageToken=page-2');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('相同 operationId 的內容不同時拒絕，絕不 POST', async () => {
    broker.connect.mockResolvedValue(grant);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ files: [templateFile()] }))
      .mockResolvedValueOnce(jsonResponse({ ...templateOperation, value: { ...templateOperation.value, name: '不同內容' } }));
    const service = new DriveCloudApiService();
    await service.beginConnect('member@example.com');

    await expect(service.createTemplateOperation(templateOperation)).rejects.toThrow('內容不一致');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('停用同步、切換帳號或 401 後不會接續 POST', async () => {
    broker.connect.mockResolvedValue(grant);
    const service = new DriveCloudApiService();
    await service.beginConnect('member@example.com');

    let current = true;
    fetchMock.mockImplementationOnce(async () => {
      current = false;
      return jsonResponse({ files: [] });
    });
    await expect(service.createTemplateOperation(templateOperation, () => current)).rejects.toThrow('停止');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    current = true;
    fetchMock.mockImplementationOnce(async () => {
      auth.userId.mockReturnValue('member-2');
      return jsonResponse({ files: [] });
    });
    await expect(service.createTemplateOperation(templateOperation, () => current)).rejects.toThrow('帳號已變更');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    auth.userId.mockReturnValue('member-1');
    fetchMock.mockImplementationOnce(async () => {
      auth.userId.mockReturnValue('member-2');
      return jsonResponse({}, 401);
    });
    await expect(service.listTemplateOperations('member-1')).rejects.toThrow('帳號已變更');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
