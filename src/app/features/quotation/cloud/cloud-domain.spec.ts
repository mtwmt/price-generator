import { QuotationData } from '@app/features/quotation/models/quotation.model';
import * as cloudPublicApi from './index';
import {
  CLOUD_SCHEMA_VERSION,
  CloudDomainError,
  ContentHashProvider,
  CloudQuotationRevision,
  CloudQuotationRevisionInput,
  VerifiedCloudQuotationRevision,
  assertParentRevisionIdsImmutable,
  canonicalizeCloudRevisionContent,
  checkCloudOperationIdempotency,
  createCloudQuotationRevision,
  createQuotationCloudSummary,
  validateCloudQuotationEnvelope,
  verifyCloudQuotationEnvelope,
} from './index';
import { createCloudQuotationRevisionWriterForAdapter } from './cloud-revision-writer.internal';

class DeterministicFakeHashProvider implements ContentHashProvider {
  private readonly values = new Map<string, string>();
  private nextValue = 0;

  hash(canonicalJson: string): Promise<string> {
    let hash = this.values.get(canonicalJson);
    if (!hash) {
      this.nextValue += 1;
      hash = `fake-vector-${this.nextValue}`;
      this.values.set(canonicalJson, hash);
    }
    return Promise.resolve(hash);
  }
}

function sampleQuotation(): QuotationData {
  return {
    customerCompany: '測試客戶',
    quoterName: '測試報價者',
    quoterEmail: 'quote@example.com',
    startDate: '2026-09-06',
    serviceItems: [
      {
        item: '折抵項目',
        price: -500,
        count: 0,
        amount: -0,
      },
    ],
    excludingTax: 0,
    tax: 0,
    includingTax: 0,
    isSign: false,
  };
}

function sampleInput(
  overrides: Partial<CloudQuotationRevisionInput<QuotationData>> = {}
): CloudQuotationRevisionInput<QuotationData> {
  const quotation = sampleQuotation();
  return {
    schemaVersion: CLOUD_SCHEMA_VERSION,
    quotationId: 'quotation-1',
    revisionId: 'revision-1',
    parentRevisionIds: ['parent-b', 'parent-a'],
    operationId: 'operation-1',
    ownerSub: 'google-sub-1',
    kind: 'create',
    payload: quotation,
    summary: createQuotationCloudSummary(quotation),
    createdAt: '2026-09-06T00:00:00.000Z',
    ...overrides,
  };
}

async function createSampleRevision(
  provider: ContentHashProvider,
  overrides: Partial<CloudQuotationRevisionInput<QuotationData>> = {}
): Promise<CloudQuotationRevision<QuotationData>> {
  return createCloudQuotationRevision(sampleInput(overrides), provider);
}

describe('雲端報價單領域封套', () => {
  it('應建立可驗證且不可變的封套，保留數量 0 與負單價', async () => {
    const provider = new DeterministicFakeHashProvider();
    const revision = await createSampleRevision(provider);

    expect(revision.parentRevisionIds).toEqual(['parent-a', 'parent-b']);
    expect(revision.payload).toMatchObject({
      serviceItems: [{ count: 0, price: -500 }],
    });
    expect(revision.contentHash).toBe('fake-vector-1');
    expect(Object.isFrozen(revision)).toBe(true);
    expect(Object.isFrozen(revision.parentRevisionIds)).toBe(true);
    expect(canonicalizeCloudRevisionContent(revision)).toContain(
      '"schemaVersion":1'
    );

    const withDriveFileId = validateCloudQuotationEnvelope({
      ...revision,
      driveFileId: 'drive-file-1',
    });
    expect(canonicalizeCloudRevisionContent(withDriveFileId)).toBe(
      canonicalizeCloudRevisionContent(revision)
    );
    const withDifferentContentHash: CloudQuotationRevision<QuotationData> = {
      ...revision,
      contentHash: '另一個不應參與運算的雜湊',
    };
    expect(canonicalizeCloudRevisionContent(withDifferentContentHash)).toBe(
      canonicalizeCloudRevisionContent(revision)
    );

    const roundTripped: unknown = JSON.parse(JSON.stringify(revision));
    const verified = await verifyCloudQuotationEnvelope(roundTripped, provider);
    expect(verified).toEqual(revision);
    expect(verified.payload).toMatchObject({
      serviceItems: [{ count: 0, price: -500 }],
    });
  });

  it('同一 operationId 重試相同固定內容應回報 replay', async () => {
    const provider = new DeterministicFakeHashProvider();
    const first = await createSampleRevision(provider);
    const retry = await createSampleRevision(provider);

    expect(checkCloudOperationIdempotency(first, retry)).toEqual({
      kind: 'replay',
      revision: first,
    });
  });

  it('相同 operationId 搭配不同 payload 應拒絕', async () => {
    const provider = new DeterministicFakeHashProvider();
    const first = await createSampleRevision(provider);
    const changedQuotation = sampleQuotation();
    changedQuotation.customerCompany = '另一個客戶';
    const changed = await createSampleRevision(provider, {
      payload: changedQuotation,
      summary: createQuotationCloudSummary(changedQuotation),
    });

    expect(() => checkCloudOperationIdempotency(first, changed)).toThrow(
      expect.objectContaining<Partial<CloudDomainError>>({
        code: 'OPERATION_ID_CONFLICT',
      })
    );
  });

  it('既有 revision 的 parent 集不可被改寫，但不同順序仍視為同一集合', async () => {
    const provider = new DeterministicFakeHashProvider();
    const first = await createSampleRevision(provider);
    const reordered = await createSampleRevision(provider, {
      parentRevisionIds: ['parent-a', 'parent-b'],
    });
    expect(() =>
      assertParentRevisionIdsImmutable(first, reordered)
    ).not.toThrow();

    const changedParent = await createSampleRevision(provider, {
      parentRevisionIds: ['parent-a', 'parent-c'],
    });
    expect(() =>
      assertParentRevisionIdsImmutable(first, changedParent)
    ).toThrow(
      expect.objectContaining<Partial<CloudDomainError>>({
        code: 'PARENT_REVISION_IMMUTABLE',
      })
    );
  });

  it('未知 schemaVersion 與封套未知欄位都不得驗證或寫回', async () => {
    const provider = new DeterministicFakeHashProvider();
    const revision = await createSampleRevision(provider);

    expect(() =>
      validateCloudQuotationEnvelope({ ...revision, schemaVersion: 2 })
    ).toThrow(
      expect.objectContaining<Partial<CloudDomainError>>({
        code: 'UNKNOWN_SCHEMA_VERSION',
      })
    );
    expect(() =>
      validateCloudQuotationEnvelope({ ...revision, unexpected: true })
    ).toThrow(
      expect.objectContaining<Partial<CloudDomainError>>({
        code: 'INVALID_ENVELOPE',
      })
    );
  });

  it('payload 欄位、服務項目與摘要應做嚴格 runtime validation', async () => {
    const provider = new DeterministicFakeHashProvider();
    const revision = await createSampleRevision(provider);
    const payload = revision.payload;

    expect(() =>
      validateCloudQuotationEnvelope({
        ...revision,
        payload: {
          ...payload,
          serviceItems: [{ ...payload.serviceItems[0], price: '-500' }],
        },
      })
    ).toThrow(
      expect.objectContaining<Partial<CloudDomainError>>({
        code: 'INVALID_ENVELOPE',
      })
    );
    expect(() =>
      validateCloudQuotationEnvelope({
        ...revision,
        payload: { ...payload, unexpected: true },
      })
    ).toThrow(
      expect.objectContaining<Partial<CloudDomainError>>({
        code: 'INVALID_ENVELOPE',
      })
    );
    expect(() =>
      validateCloudQuotationEnvelope({
        ...revision,
        summary: { ...revision.summary, serviceItemCount: 99 },
      })
    ).toThrow(
      expect.objectContaining<Partial<CloudDomainError>>({
        code: 'INVALID_ENVELOPE',
      })
    );
    expect(() =>
      validateCloudQuotationEnvelope({ ...revision, kind: 'delete' })
    ).toThrow(
      expect.objectContaining<Partial<CloudDomainError>>({
        code: 'INVALID_ENVELOPE',
      })
    );
  });

  it('只有 create 或完整 verify 產生的 revision 才能 append', async () => {
    const provider = new DeterministicFakeHashProvider();
    const created = await createSampleRevision(provider);
    const appended: VerifiedCloudQuotationRevision<QuotationData>[] = [];
    const writer = createCloudQuotationRevisionWriterForAdapter<QuotationData>(
      (revision) => {
        appended.push(revision);
        return Promise.resolve();
      }
    );
    const serialized: unknown = JSON.parse(JSON.stringify(created));
    const structureOnly = validateCloudQuotationEnvelope(serialized);
    const missingHash: Record<string, unknown> = { ...created };
    delete missingHash['contentHash'];
    const forgedByTypeAssertion = {
      ...created,
      contentHash: 'tampered',
    } as unknown as VerifiedCloudQuotationRevision<QuotationData>;

    for (const unverified of [
      forgedByTypeAssertion,
      missingHash,
      { ...created, schemaVersion: 999 },
      structureOnly,
    ]) {
      await expect(writer.appendRevision(unverified)).rejects.toMatchObject({
        code: 'UNVERIFIED_REVISION',
      });
    }
    expect(appended).toEqual([]);

    await writer.appendRevision(created);
    const verified = await verifyCloudQuotationEnvelope(serialized, provider);
    await writer.appendRevision(verified);

    expect(appended).toHaveLength(2);
    expect(appended[0]).toBe(created);
    expect(appended[1]).toBe(verified);
  });

  it('public index 不得匯出 raw persistence sink 或 internal writer factory', () => {
    expect(cloudPublicApi).not.toHaveProperty(
      'createCloudQuotationRevisionWriterForAdapter'
    );
    expect(cloudPublicApi).not.toHaveProperty('appendCloudQuotationRevision');
  });

  it('contentHash 不匹配時應拒絕寫回', async () => {
    const provider = new DeterministicFakeHashProvider();
    const revision = await createSampleRevision(provider);

    await expect(
      verifyCloudQuotationEnvelope(
        { ...revision, contentHash: 'tampered' },
        provider
      )
    ).rejects.toMatchObject({ code: 'INVALID_CONTENT_HASH' });
  });
});
