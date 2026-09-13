const dependencies = new Map<unknown, unknown>();

jest.mock('@angular/core', () => ({
  Injectable: () => (target: unknown) => target,
  computed: <T>(compute: () => T) => compute,
  inject: (token: unknown) => dependencies.get(token),
  signal: <T>(initial: T) => {
    let value = initial;
    const state = (() => value) as (() => T) & { set(value: T): void; update(fn: (value: T) => T): void };
    state.set = (next) => { value = next; };
    state.update = (fn) => { value = fn(value); };
    return state;
  },
}));
jest.mock('@app/core/services/auth.service', () => ({ AuthService: class AuthService {} }), { virtual: true });
jest.mock('./drive-cloud-api.service', () => ({
  DriveCloudApiService: class DriveCloudApiService {},
  DriveAuthorizationRequiredError: class DriveAuthorizationRequiredError extends Error {},
  DriveServiceUnavailableError: class DriveServiceUnavailableError extends Error {},
  DriveOperationNotSentError: class extends Error {},
}));
jest.mock('./cloud-sync-preference', () => ({
  readSavedCloudSyncPreference: jest.fn(() => true),
  writeCloudSyncEnabledPreference: jest.fn(),
}));

import { AuthService } from '@app/core/services/auth.service';
import { createNextBusinessVersion } from '@app/features/quotation/utils/quotation-lifecycle';
import { DriveCloudApiService } from './drive-cloud-api.service';
import { CloudQuotationSyncService } from './cloud-quotation-sync.service';
import type { CloudQuotationRevision } from './cloud-contracts';
import type { QuotationData } from '../models/quotation.model';

function quotation(company = '客戶 A'): QuotationData {
  return {
    customerCompany: company, quoterName: '報價者', quoterEmail: 'quote@example.test',
    startDate: '2026-09-12', serviceItems: [], excludingTax: 0, tax: 0,
    includingTax: 0, isSign: false,
  };
}

function createHarness(responseLostOnce = false) {
  dependencies.clear();
  const revisions = new Map<string, CloudQuotationRevision<QuotationData>>();
  const operations = new Map<string, { revision: CloudQuotationRevision<QuotationData>; fileId: string }>();
  let loseResponse = responseLostOnce;
  const api = {
    isConfigured: () => true,
    disconnect: jest.fn(),
    beginConnect: jest.fn(async () => undefined),
    restoreConnection: jest.fn(async () => true),
    listRevisions: jest.fn(async () => ({
      files: [...operations.values()].map(({ revision, fileId }) => ({
        fileId, name: `報價單 ${revision.summary.customerCompany}`,
        quotationId: revision.quotationId, revisionId: revision.revisionId,
        parentRevisionIds: revision.parentRevisionIds, kind: revision.kind,
        createdAt: revision.createdAt,
      })), nextPageToken: null,
    })),
    getRevision: jest.fn(async (fileId: string) => revisions.get(fileId)),
    createOperation: jest.fn(async (revision: CloudQuotationRevision<QuotationData>) => {
      const prior = operations.get(revision.operationId);
      if (prior) {
        return { operationId: revision.operationId, quotationId: revision.quotationId,
          revisionId: revision.revisionId, driveFileId: prior.fileId, status: 'replayed' as const, idempotent: true };
      }
      const fileId = `file-${operations.size + 1}`;
      operations.set(revision.operationId, { revision, fileId });
      revisions.set(fileId, revision);
      if (loseResponse) { loseResponse = false; throw new Error('response lost after accepted'); }
      return { operationId: revision.operationId, quotationId: revision.quotationId,
        revisionId: revision.revisionId, driveFileId: fileId, status: 'accepted' as const, idempotent: false };
    }),
  };
  const auth = { isAuthenticated: () => true, isPremium: () => true, isAdmin: () => false,
    userId: () => 'member-1', userEmail: () => 'member@example.test' };
  dependencies.set(AuthService, auth);
  dependencies.set(DriveCloudApiService, api);
  return { service: new CloudQuotationSyncService(), api, operations };
}

describe('CloudQuotationSyncService → mock Drive integration', () => {
  it('create / load / update / copy / 下一業務版本都以同一實際服務流程保存 canonical payload', async () => {
    const { service, api } = createHarness();
    await service.beginConnect();

    const created = await service.save(quotation());
    expect(created.data.quotationId).toBe(created.quotationId);
    expect((await service.load(created)).quotationId).toBe(created.quotationId);

    const updated = await service.save({ ...created.data, customerCompany: '客戶 A 更新' }, created);
    expect(updated.quotationId).toBe(created.quotationId);
    expect(updated.headRevisionIds).not.toContain(created.revisionId);

    const copied = await service.save({ ...updated.data, quotationId: undefined }, undefined);
    expect(copied.quotationId).not.toBe(created.quotationId);

    const next = createNextBusinessVersion(updated.data, updated.data);
    const versioned = await service.save(next, updated);
    expect(versioned.quotationId).toBe(created.quotationId);
    expect(versioned.data.previousVersions).toHaveLength(1);
    expect(service.history().filter((entry) => entry.quotationId === created.quotationId)).toHaveLength(1);
    expect(api.createOperation).toHaveBeenCalledTimes(4);
  });

  it('Drive 接受但回應遺失時重試重用 operation、revision、createdAt，且只保留一個 logical head', async () => {
    const { service, api, operations } = createHarness(true);
    await service.beginConnect();
    const source = quotation();
    await expect(service.save(source)).rejects.toThrow('response lost');
    const saved = await service.save(source);

    expect(api.createOperation).toHaveBeenCalledTimes(2);
    const [first, retry] = api.createOperation.mock.calls.map(([revision]) => revision as CloudQuotationRevision<QuotationData>);
    expect(retry.operationId).toBe(first.operationId);
    expect(retry.revisionId).toBe(first.revisionId);
    expect(retry.createdAt).toBe(first.createdAt);
    expect(operations.size).toBe(1);
    expect(service.history()).toHaveLength(1);
    expect(saved.revisionId).toBe(first.revisionId);
  });
});
