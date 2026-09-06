jest.mock('@angular/core', () => ({
  Injectable: () => (target: unknown) => target,
}));

import {
  DriveCloudApiService,
  type DriveOperationResponse,
} from './drive-cloud-api.service';
import type { CloudQuotationRevision } from './cloud-contracts';

const revision: CloudQuotationRevision<null> = {
  schemaVersion: 1,
  quotationId: 'quotation-1',
  revisionId: 'revision-1',
  parentRevisionIds: [],
  operationId: 'operation-1',
  ownerSub: 'member-1',
  kind: 'create',
  payload: null,
  summary: {
    customerCompany: '測試客戶',
    quoterName: '測試報價人',
    startDate: '2026-09-06',
    serviceItemCount: 0,
    excludingTax: 0,
    includingTax: 0,
  },
  createdAt: '2026-09-06T00:00:00.000Z',
  contentHash: 'hash-1',
};

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: new Headers(headers),
  } as Response;
}

describe('DriveCloudApiService', () => {
  const originalFetch = globalThis.fetch;
  const browser = globalThis as unknown as { window?: typeof window };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    browser.window = {} as typeof window;
    browser.window.google = {
      accounts: {
        oauth2: {
          initTokenClient: ({ callback }) => ({
            callback,
            requestAccessToken: () =>
              callback({ access_token: 'drive-token', expires_in: 3600 }),
          }),
        },
      },
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete browser.window;
  });

  it('以既有 Google 授權無提示地還原連線', async () => {
    const service = new DriveCloudApiService();

    await expect(service.restoreConnection()).resolves.toBe(true);
  });

  it('只列舉目前會員在 appDataFolder 的報價版本 metadata', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        files: [
          {
            id: 'file-1',
            name: '報價單 測試客戶.json',
            appProperties: {
              app: 'price-quotation',
              quotationId: 'quotation-1',
              revisionId: 'revision-1',
              parentRevisionIds: '[]',
              kind: 'create',
              createdAt: '2026-09-06T00:00:00.000Z',
            },
          },
          { id: 'not-a-quotation', name: '忽略' },
        ],
      })
    );
    const service = new DriveCloudApiService();
    await service.beginConnect();

    const page = await service.listRevisions('member-1');

    expect(page.files).toEqual([
      expect.objectContaining({
        fileId: 'file-1',
        quotationId: 'quotation-1',
      }),
    ]);
    const request = fetchMock.mock.calls[0][0] as URL;
    expect(request.toString()).toContain('spaces=appDataFolder');
    expect(request.searchParams.get('q')).toContain(
      "key='ownerSub' and value='member-1'"
    );
  });

  it('同一 operationId 已存在時不重複上傳版本檔', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        files: [
          {
            id: 'file-existing',
            appProperties: {
              app: 'price-quotation',
              ownerSub: revision.ownerSub,
              operationId: revision.operationId,
              quotationId: revision.quotationId,
              revisionId: revision.revisionId,
              contentHash: revision.contentHash,
              kind: revision.kind,
              createdAt: revision.createdAt,
              parentRevisionIds: JSON.stringify(revision.parentRevisionIds),
            },
          },
        ],
      })
    );
    const service = new DriveCloudApiService();
    await service.beginConnect();

    const result: DriveOperationResponse =
      await service.createOperation(revision);

    expect(result).toMatchObject({
      driveFileId: 'file-existing',
      status: 'replayed',
      idempotent: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
