import {
  CLOUD_SCHEMA_VERSION,
  CloudQuotationDraft,
  CloudQuotationKind,
  CloudQuotationOperation,
  CloudQuotationRevision,
  CloudQuotationSummary,
} from './cloud-contracts';
import {
  checkCloudOperationIdempotency,
  createCloudQuotationRevision,
  normalizeCloudParentRevisionIds,
  validateCloudQuotationEnvelope,
  verifyCloudQuotationEnvelope,
} from './cloud-domain';
import { CloudDomainError } from './cloud-errors';
import { ContentHashProvider } from './cloud-hash';
import { JsonValue, isPlainJsonObject } from './cloud-json';

export type CloudSaveKind = Exclude<CloudQuotationKind, 'delete'>;

/** 建立一筆待送儲存操作時唯一可變的呼叫端輸入。識別欄位必須由呼叫端持久保存。 */
export interface CreateCloudSaveOperationInput<TPayload> {
  readonly draft: CloudQuotationDraft<TPayload>;
  readonly operationId: string;
  readonly revisionId: string;
  readonly kind: CloudSaveKind;
  readonly createdAt: string;
}

export interface CloudRemoteDraftObservation<TPayload> {
  readonly draft: CloudQuotationDraft<TPayload>;
  readonly status: 'already-based' | 'new-remote-revision';
  readonly remoteRevisionId: string;
}

export interface CreateCloudSuccessorDraftInput<TPayload> {
  readonly draft: CloudQuotationDraft<TPayload>;
  readonly parentOperation: CloudQuotationOperation<TPayload>;
  readonly payload: TPayload;
  readonly summary: CloudQuotationSummary;
}

function readIdentifier(value: string, name: string): string {
  if (value.trim().length === 0) {
    throw new CloudDomainError('INVALID_OPERATION', `${name} 不可為空字串`);
  }
  return value;
}

function freezeDraft<TPayload>(
  draft: CloudQuotationDraft<TPayload>
): CloudQuotationDraft<TPayload> {
  return Object.freeze({
    ...draft,
    baseRevisionIds: Object.freeze([...draft.baseRevisionIds]),
  });
}

function freezeOperation<TPayload>(
  operation: CloudQuotationOperation<TPayload>
): CloudQuotationOperation<TPayload> {
  return Object.freeze(operation);
}

/** 嚴格驗證從 IndexedDB／傳輸層讀回的待送操作，不接受額外欄位。 */
export function validateCloudQuotationOperation(
  value: unknown
): CloudQuotationOperation<JsonValue> {
  if (!isPlainJsonObject(value)) {
    throw new CloudDomainError('INVALID_OPERATION', '待送操作必須是普通物件');
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== 2 ||
    Object.keys(value).length !== 2 ||
    !Object.prototype.hasOwnProperty.call(value, 'revision') ||
    !Object.prototype.hasOwnProperty.call(value, 'retryAttempt')
  ) {
    throw new CloudDomainError(
      'INVALID_OPERATION',
      '待送操作只能包含 revision 與 retryAttempt'
    );
  }
  if (
    !Number.isSafeInteger(value['retryAttempt']) ||
    (value['retryAttempt'] as number) < 0
  ) {
    throw new CloudDomainError(
      'INVALID_OPERATION',
      'retryAttempt 必須是非負安全整數'
    );
  }

  return freezeOperation({
    revision: validateCloudQuotationEnvelope(value['revision']),
    retryAttempt: value['retryAttempt'] as number,
  });
}

/** 嚴格驗證操作結構，並重算其中修訂的 contentHash。 */
export async function verifyCloudQuotationOperation(
  value: unknown,
  hashProvider: ContentHashProvider
): Promise<CloudQuotationOperation<JsonValue>> {
  const operation = validateCloudQuotationOperation(value);
  return freezeOperation({
    revision: await verifyCloudQuotationEnvelope(
      operation.revision,
      hashProvider
    ),
    retryAttempt: operation.retryAttempt,
  });
}

/**
 * 以編輯開始時的父集合建立草稿。這裡刻意不參考遠端最新版本，
 * 因為保存舊草稿必須形成分支，而非偷偷改掛到遠端新版本。
 */
export function createCloudQuotationDraft<TPayload>(input: {
  readonly ownerSub: string;
  readonly quotationId: string;
  readonly baseRevisionIds: readonly string[];
  readonly payload: TPayload;
  readonly summary: CloudQuotationSummary;
}): CloudQuotationDraft<TPayload> {
  return freezeDraft({
    ownerSub: readIdentifier(input.ownerSub, 'ownerSub'),
    quotationId: readIdentifier(input.quotationId, 'quotationId'),
    baseRevisionIds: normalizeCloudParentRevisionIds(
      input.baseRevisionIds,
      '$.baseRevisionIds'
    ),
    payload: input.payload,
    summary: input.summary,
  });
}

/**
 * 將草稿轉成一筆不可變的待送操作。operationId、revisionId 與父集合都在此時固定；
 * 重試時必須呼叫 retryCloudQuotationOperation，而不是重新建立。
 */
export async function createCloudSaveOperation<TPayload>(
  input: CreateCloudSaveOperationInput<TPayload>,
  hashProvider: ContentHashProvider
): Promise<CloudQuotationOperation<TPayload>> {
  if (
    input.kind !== 'create' &&
    input.kind !== 'update' &&
    input.kind !== 'restore'
  ) {
    throw new CloudDomainError(
      'INVALID_OPERATION',
      '儲存操作 kind 必須是 create、update 或 restore'
    );
  }
  const revision = await createCloudQuotationRevision(
    {
      schemaVersion: CLOUD_SCHEMA_VERSION,
      quotationId: input.draft.quotationId,
      revisionId: input.revisionId,
      parentRevisionIds: input.draft.baseRevisionIds,
      operationId: input.operationId,
      ownerSub: input.draft.ownerSub,
      kind: input.kind,
      payload: input.draft.payload,
      summary: input.draft.summary,
      createdAt: input.createdAt,
    },
    hashProvider
  );

  return freezeOperation({ revision, retryAttempt: 0 });
}

/** 回應遺失或暫時失敗時僅遞增傳輸嘗試次數；既有 revision 物件完全沿用。 */
export function retryCloudQuotationOperation<TPayload>(
  operation: CloudQuotationOperation<TPayload>
): CloudQuotationOperation<TPayload> {
  if (
    !Number.isSafeInteger(operation.retryAttempt) ||
    operation.retryAttempt < 0
  ) {
    throw new CloudDomainError(
      'INVALID_OPERATION',
      'retryAttempt 必須是非負安全整數'
    );
  }
  if (operation.retryAttempt === Number.MAX_SAFE_INTEGER) {
    throw new CloudDomainError(
      'INVALID_OPERATION',
      'retryAttempt 已達可重試上限'
    );
  }

  return freezeOperation({
    revision: operation.revision,
    retryAttempt: operation.retryAttempt + 1,
  });
}

/**
 * 將同一 ownerSub＋operationId 的實體重試折疊為一個邏輯操作。
 * 同鍵但任何固定內容不同時由 checkCloudOperationIdempotency 明確拒絕。
 */
export function foldCloudQuotationOperations<TPayload>(
  operations: readonly CloudQuotationOperation<TPayload>[]
): readonly CloudQuotationOperation<TPayload>[] {
  const byOwner = new Map<
    string,
    Map<string, CloudQuotationOperation<TPayload>>
  >();
  const folded: CloudQuotationOperation<TPayload>[] = [];

  for (const operation of operations) {
    const { ownerSub, operationId } = operation.revision;
    const ownerOperations = byOwner.get(ownerSub) ?? new Map();
    const existing = ownerOperations.get(operationId);

    if (!existing) {
      ownerOperations.set(operationId, operation);
      byOwner.set(ownerSub, ownerOperations);
      folded.push(operation);
      continue;
    }

    checkCloudOperationIdempotency(existing.revision, operation.revision);
    if (operation.retryAttempt > existing.retryAttempt) {
      const index = folded.indexOf(existing);
      const retried = freezeOperation<TPayload>({
        revision: existing.revision,
        retryAttempt: operation.retryAttempt,
      });
      ownerOperations.set(operationId, retried);
      folded[index] = retried;
    }
  }

  return Object.freeze(folded);
}

/** 讀到遠端資料只回報狀態，不會改寫草稿父集合。 */
export function observeCloudDraftRemoteRevision<TPayload>(
  draft: CloudQuotationDraft<TPayload>,
  remoteRevision: Pick<
    CloudQuotationRevision<unknown>,
    'ownerSub' | 'quotationId' | 'revisionId'
  >
): CloudRemoteDraftObservation<TPayload> {
  if (
    draft.ownerSub !== remoteRevision.ownerSub ||
    draft.quotationId !== remoteRevision.quotationId
  ) {
    throw new CloudDomainError(
      'DRAFT_REVISION_MISMATCH',
      '遠端修訂不屬於目前草稿的帳號或報價單'
    );
  }

  return Object.freeze({
    draft,
    status: draft.baseRevisionIds.includes(remoteRevision.revisionId)
      ? 'already-based'
      : 'new-remote-revision',
    remoteRevisionId: remoteRevision.revisionId,
  });
}

/**
 * 明確儲存後才建立後繼草稿。即使父操作仍離線待送，下一次儲存也會正確引用它，
 * 因而保持 A → B 的父子鏈。
 */
export function createCloudSuccessorDraft<TPayload>(
  input: CreateCloudSuccessorDraftInput<TPayload>
): CloudQuotationDraft<TPayload> {
  const revision = input.parentOperation.revision;
  if (
    revision.ownerSub !== input.draft.ownerSub ||
    revision.quotationId !== input.draft.quotationId
  ) {
    throw new CloudDomainError(
      'DRAFT_REVISION_MISMATCH',
      '後繼草稿只能引用相同帳號與報價單的操作'
    );
  }

  return createCloudQuotationDraft({
    ownerSub: input.draft.ownerSub,
    quotationId: input.draft.quotationId,
    baseRevisionIds: [revision.revisionId],
    payload: input.payload,
    summary: input.summary,
  });
}
