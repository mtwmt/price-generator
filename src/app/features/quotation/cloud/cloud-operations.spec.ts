import { QuotationData } from '@app/features/quotation/models/quotation.model';
import {
  ContentHashProvider,
  CloudDomainError,
  createCloudQuotationDraft,
  createCloudSaveOperation,
  createCloudSuccessorDraft,
  createQuotationCloudSummary,
  foldCloudQuotationOperations,
  observeCloudDraftRemoteRevision,
  retryCloudQuotationOperation,
  validateCloudQuotationOperation,
  verifyCloudQuotationOperation,
} from './index';

class DeterministicHashProvider implements ContentHashProvider {
  private readonly hashes = new Map<string, string>();

  async hash(canonicalJson: string): Promise<string> {
    const known = this.hashes.get(canonicalJson);
    if (known) {
      return known;
    }

    const hash = `hash-${this.hashes.size + 1}`;
    this.hashes.set(canonicalJson, hash);
    return hash;
  }
}

function createQuotation(customerCompany = '測試客戶'): QuotationData {
  return {
    customerCompany,
    quoterName: '測試報價者',
    quoterEmail: 'quote@example.com',
    startDate: '2026-09-06',
    serviceItems: [
      {
        item: '折抵項目',
        price: -500,
        count: 0,
        amount: 0,
      },
    ],
    excludingTax: 0,
    tax: 0,
    includingTax: 0,
    isSign: false,
  };
}

function createDraft(
  quotation = createQuotation(),
  baseRevisionIds: readonly string[] = ['revision-base']
) {
  return createCloudQuotationDraft({
    ownerSub: 'google-sub-1',
    quotationId: 'quotation-1',
    baseRevisionIds,
    payload: quotation,
    summary: createQuotationCloudSummary(quotation),
  });
}

describe('雲端報價單同步操作', () => {
  it('operation 往返後應嚴格驗證結構與修訂雜湊', async () => {
    const provider = new DeterministicHashProvider();
    const operation = await createCloudSaveOperation(
      {
        draft: createDraft(),
        operationId: 'operation-validated',
        revisionId: 'revision-validated',
        kind: 'update',
        createdAt: '2026-09-06T00:00:00.000Z',
      },
      provider
    );
    const roundTripped: unknown = JSON.parse(JSON.stringify(operation));

    await expect(
      verifyCloudQuotationOperation(roundTripped, provider)
    ).resolves.toEqual(operation);
    expect(() =>
      validateCloudQuotationOperation({
        ...operation,
        unexpected: true,
      })
    ).toThrow(
      expect.objectContaining<Partial<CloudDomainError>>({
        code: 'INVALID_OPERATION',
      })
    );
    expect(() =>
      validateCloudQuotationOperation({ ...operation, retryAttempt: -1 })
    ).toThrow(
      expect.objectContaining<Partial<CloudDomainError>>({
        code: 'INVALID_OPERATION',
      })
    );
  });

  it('回應遺失後重試會沿用固定修訂，並折疊為一個邏輯操作', async () => {
    const provider = new DeterministicHashProvider();
    const first = await createCloudSaveOperation(
      {
        draft: createDraft(),
        operationId: 'operation-1',
        revisionId: 'revision-1',
        kind: 'update',
        createdAt: '2026-09-06T00:00:00.000Z',
      },
      provider
    );

    const retry = retryCloudQuotationOperation(first);
    const folded = foldCloudQuotationOperations([first, retry]);

    expect(retry.revision).toBe(first.revision);
    expect(retry.revision.parentRevisionIds).toEqual(['revision-base']);
    expect(folded).toHaveLength(1);
    expect(folded[0]).toMatchObject({
      retryAttempt: 1,
      revision: {
        operationId: 'operation-1',
        revisionId: 'revision-1',
      },
    });
  });

  it('同一 ownerSub 與 operationId 的不同內容不可折疊', async () => {
    const provider = new DeterministicHashProvider();
    const first = await createCloudSaveOperation(
      {
        draft: createDraft(createQuotation('客戶 A')),
        operationId: 'operation-1',
        revisionId: 'revision-1',
        kind: 'update',
        createdAt: '2026-09-06T00:00:00.000Z',
      },
      provider
    );
    const changed = await createCloudSaveOperation(
      {
        draft: createDraft(createQuotation('客戶 B')),
        operationId: 'operation-1',
        revisionId: 'revision-1',
        kind: 'update',
        createdAt: '2026-09-06T00:00:00.000Z',
      },
      provider
    );

    expect(() => foldCloudQuotationOperations([first, changed])).toThrow(
      expect.objectContaining<Partial<CloudDomainError>>({
        code: 'OPERATION_ID_CONFLICT',
      })
    );
  });

  it('舊草稿讀到遠端新修訂時，基底父集合保持不變', () => {
    const draft = createDraft(createQuotation(), ['revision-old']);

    const observation = observeCloudDraftRemoteRevision(draft, {
      ownerSub: 'google-sub-1',
      quotationId: 'quotation-1',
      revisionId: 'revision-remote-new',
    });

    expect(observation).toMatchObject({
      status: 'new-remote-revision',
      remoteRevisionId: 'revision-remote-new',
    });
    expect(observation.draft).toBe(draft);
    expect(draft.baseRevisionIds).toEqual(['revision-old']);
  });

  it('離線連續儲存兩次會形成 A → B 父子鏈，並保留數量 0 與負單價', async () => {
    const provider = new DeterministicHashProvider();
    const firstDraft = createDraft(createQuotation(), []);
    const operationA = await createCloudSaveOperation(
      {
        draft: firstDraft,
        operationId: 'operation-a',
        revisionId: 'revision-a',
        kind: 'create',
        createdAt: '2026-09-06T00:00:00.000Z',
      },
      provider
    );
    const quotationB = createQuotation('第二次離線儲存');
    const secondDraft = createCloudSuccessorDraft({
      draft: firstDraft,
      parentOperation: operationA,
      payload: quotationB,
      summary: createQuotationCloudSummary(quotationB),
    });
    const operationB = await createCloudSaveOperation(
      {
        draft: secondDraft,
        operationId: 'operation-b',
        revisionId: 'revision-b',
        kind: 'update',
        createdAt: '2026-09-06T00:01:00.000Z',
      },
      provider
    );

    expect(operationA.revision.parentRevisionIds).toEqual([]);
    expect(operationB.revision.parentRevisionIds).toEqual(['revision-a']);
    expect(operationB.revision.payload.serviceItems).toEqual([
      expect.objectContaining({ count: 0, price: -500 }),
    ]);
    expect(foldCloudQuotationOperations([operationA, operationB])).toHaveLength(
      2
    );
  });
});
