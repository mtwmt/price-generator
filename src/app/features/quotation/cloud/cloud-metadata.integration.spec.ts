const dependencies = new Map<unknown, unknown>();
jest.mock('@angular/core', () => ({
  Injectable: () => (target: unknown) => target,
  inject: (token: unknown) => dependencies.get(token), computed: (fn: () => unknown) => fn,
  signal: <T>(initial: T) => { let value = initial; return Object.assign(() => value, {
    set: (next: T) => { value = next; }, update: (fn: (current: T) => T) => { value = fn(value); },
  }); },
}));
jest.mock('@app/core/services/auth.service', () => ({ AuthService: class {} }));
jest.mock('./drive-authorization-api.service', () => ({
  DriveAuthorizationApiService: class {}, DriveAuthorizationBrokerError: class extends Error {},
}));
jest.mock('./cloud-sync-preference', () => ({
  ...jest.requireActual('./cloud-sync-preference'),
  readSavedCloudSyncPreference: () => true, writeCloudSyncEnabledPreference: () => undefined,
}));
import { AuthService } from '@app/core/services/auth.service';
import { DriveAuthorizationApiService } from './drive-authorization-api.service';
import { DriveCloudApiService, DriveOperationNotSentError } from './drive-cloud-api.service';
import { CloudQuotationSyncService } from './cloud-quotation-sync.service';
import { createCloudQuotationRevision, createQuotationCloudSummary } from './cloud-domain';
import { WebCryptoSha256HashProvider } from './cloud-hash';
import { readCloudLifecycleMetadata } from './cloud-lifecycle-metadata';
import { filterQuotationHistory } from '../quotation-generator/quotation-history/quotation-history.utils';
import type { QuotationData } from '../models/quotation.model';

const quote = (): QuotationData => ({
  quotationId: 'q-cold', quotationNumber: 'Q-C2-001', status: 'sent', businessVersion: 1,
  customerCompany: 'C2 Alpha', quoterName: 'synthetic', quoterEmail: 'q@example.test',
  startDate: '2026-09-12', serviceItems: [], excludingTax: 0, tax: 0, includingTax: 0, isSign: false,
});

describe('real sync → real Drive metadata writer/parser → cold device', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  function boundary() {
    dependencies.clear();
    dependencies.set(AuthService, { userId: () => 'c2-user', userEmail: () => 'c2@example.test',
      isAuthenticated: () => true, isPremium: () => true, isAdmin: () => false });
    dependencies.set(DriveAuthorizationApiService, { token: async () => ({
      accessToken: 'synthetic-only', expiresIn: 3600, email: 'c2@example.test', ownerId: 'c2-user',
    }) });
    const files: Array<{ id: string; name: string; appProperties: Record<string, string>; content: string }> = [];
    const mediaReads: string[] = [];
    globalThis.fetch = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (init?.method === 'POST') {
        const body = await (init.body as Blob).text();
        const boundary = body.slice(0, body.indexOf('\r\n'));
        const parts = body.split(boundary).slice(1, 3).map((part) => part.slice(part.indexOf('\r\n\r\n') + 4).trim());
        const metadata = JSON.parse(parts[0]);
        const file = { ...metadata, id: `file-${files.length}`, content: parts[1] };
        files.push(file); return new Response(JSON.stringify({ id: file.id }));
      }
      if (url.searchParams.get('alt') === 'media') {
        const id = url.pathname.split('/').at(-1)!; mediaReads.push(id);
        return new Response(files.find((file) => file.id === id)!.content);
      }
      const query = url.searchParams.get('q') || '';
      const operation = /key='operationId' and value='([^']+)'/.exec(query)?.[1];
      return new Response(JSON.stringify({ files: files.filter((file) => !operation || file.appProperties['operationId'] === operation)
        .map(({ id, name, appProperties }) => ({ id, name, appProperties })) }));
    }) as typeof fetch;
    const device = async () => {
      const api = new DriveCloudApiService(); dependencies.set(DriveCloudApiService, api);
      const sync = new CloudQuotationSyncService(); await sync.initialize();
      return { api, sync };
    };
    return { files, mediaReads, device };
  }

  it('A writes number/status appProperties; cold B searches listing without downloading payload', async () => {
    const h = boundary(); const a = await h.device(); await a.sync.save(quote());
    expect(h.files[0].appProperties).toMatchObject({ quotationNumber: 'Q-C2-001', status: 'sent' });
    const b = await h.device();
    expect(h.mediaReads).toEqual([]);
    const history = b.sync.history().map((entry) => entry.data);
    for (const query of ['C2 Alpha', 'Q-C2-001', '已送出', 'sent']) expect(filterQuotationHistory(history, query)).toHaveLength(1);
    expect(history[0].quotationId).toBe('q-cold');
    expect(b.sync.hasIncompleteHistoryMetadata()).toBe(false);
    await b.sync.load(b.sync.history()[0]); expect(h.mediaReads).toHaveLength(1);
  });

  it.each([1, 2] as const)('legacy schema %s without hints remains readable, hash unchanged, incomplete until selected', async (schemaVersion) => {
    const h = boundary(); const a = await h.device();
    const payload = quote(); delete payload.quotationNumber; delete payload.status; delete payload.businessVersion;
    if (schemaVersion === 1) delete payload.quotationId;
    const revision = await createCloudQuotationRevision({ schemaVersion, ownerSub: 'c2-user', quotationId: 'q-cold',
      revisionId: `legacy-${schemaVersion}`, operationId: `op-${schemaVersion}`, kind: 'create', parentRevisionIds: [],
      createdAt: '2026-09-12T00:00:00.000Z', payload, summary: createQuotationCloudSummary(payload),
    }, new WebCryptoSha256HashProvider());
    await a.api.createOperation(revision); const before = h.files[0].content;
    const b = await h.device();
    expect(b.sync.hasIncompleteHistoryMetadata()).toBe(true);
    expect(filterQuotationHistory(b.sync.history().map((entry) => entry.data), '草稿')).toHaveLength(0);
    await b.sync.load(b.sync.history()[0]);
    expect(b.sync.hasIncompleteHistoryMetadata()).toBe(false);
    expect(h.files[0].content).toBe(before);
    expect(JSON.parse(before).contentHash).toBe(revision.contentHash);
  });

  it('lookup failure is explicitly not sent and makes no upload request', async () => {
    const h = boundary(); const a = await h.device();
    globalThis.fetch = jest.fn(async () => { throw new Error('synthetic lookup failure'); }) as typeof fetch;
    const intent = a.sync.prepareSave(quote());
    await expect(a.sync.submitSave(intent)).rejects.toBeInstanceOf(DriveOperationNotSentError);
    expect(a.sync.saveOutcome(intent)).toBe('not-sent'); expect(h.files).toHaveLength(0);
  });

  it('over-8MB local preflight is not-sent, never uploads, and a reduced payload can reserve a new operation', async () => {
    const h = boundary(); const a = await h.device();
    const oversized = { ...quote(), desc: 'x'.repeat(8 * 1024 * 1024) };
    const intent = a.sync.prepareSave(oversized);
    await expect(a.sync.submitSave(intent)).rejects.toBeInstanceOf(DriveOperationNotSentError);
    expect(a.sync.saveOutcome(intent)).toBe('not-sent');
    expect(h.files).toHaveLength(0);
    expect((globalThis.fetch as jest.Mock).mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    const smaller = a.sync.prepareSave({ ...quote(), desc: 'reduced after preflight failure' });
    expect(smaller.input.operationId).not.toBe(intent.input.operationId);
    const saved = await a.sync.submitSave(smaller);
    expect(saved.data.desc).toBe('reduced after preflight failure'); expect(h.files).toHaveLength(1);
  });

  it('a previously accepted/lost upload stays unknown after a later not-sent lookup failure, then replays one operation', async () => {
    const h = boundary(); const a = await h.device(); const backend = globalThis.fetch;
    globalThis.fetch = jest.fn(async (input, init) => {
      const response = await backend(input, init);
      if (init?.method === 'POST') throw new Error('accepted but response lost');
      return response;
    }) as typeof fetch;
    const intent = a.sync.prepareSave(quote());
    await expect(a.sync.submitSave(intent)).rejects.toThrow('accepted but response lost');
    expect(a.sync.saveOutcome(intent)).toBe('unknown'); expect(h.files).toHaveLength(1);
    globalThis.fetch = jest.fn(async () => { throw new Error('lookup unavailable'); }) as typeof fetch;
    await expect(a.sync.submitSave(intent)).rejects.toBeInstanceOf(DriveOperationNotSentError);
    expect(a.sync.saveOutcome(intent)).toBe('unknown');
    expect(() => a.sync.prepareSave({ ...quote(), desc: 'must not replace unknown' })).toThrow();
    globalThis.fetch = backend;
    const saved = await a.sync.submitSave(intent);
    expect(saved.revisionId).toBe(intent.input.revisionId); expect(h.files).toHaveLength(1);
  });

  it('untrusted fields and UTF-8 overlength hints are omitted, never truncated or defaulted', () => {
    expect(readCloudLifecycleMetadata({ quotationNumber: '中'.repeat(37), status: 'bogus' })).toEqual({});
    expect(readCloudLifecycleMetadata({ quotationNumber: '中'.repeat(36), status: 'won' })).toEqual({ quotationNumber: '中'.repeat(36), status: 'won' });
    expect(readCloudLifecycleMetadata({ quotationNumber: 'bad\nnumber', status: 'draft' })).toEqual({ status: 'draft' });
    expect(readCloudLifecycleMetadata({ quotationNumber: 123, status: {} })).toEqual({});
  });
});
