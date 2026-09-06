import { QuotationData } from '@app/features/quotation/models/quotation.model';
import {
  CLOUD_SCHEMA_VERSION,
  CloudQuotationKind,
  CloudQuotationRevision,
  CloudQuotationRevisionInput,
  CloudQuotationSummary,
  CloudRevisionContent,
  CloudRevisionHashDocument,
  VerifiedCloudQuotationRevision,
} from './cloud-contracts';
import { CloudDomainError } from './cloud-errors';
import { ContentHashProvider } from './cloud-hash';
import {
  JsonValue,
  canonicalizeJsonValue,
  isPlainJsonObject,
} from './cloud-json';

const ENVELOPE_REQUIRED_KEYS = [
  'schemaVersion',
  'quotationId',
  'revisionId',
  'parentRevisionIds',
  'operationId',
  'ownerSub',
  'kind',
  'payload',
  'summary',
  'createdAt',
  'contentHash',
] as const;

const CONTENT_REQUIRED_KEYS = ENVELOPE_REQUIRED_KEYS.filter(
  (key) => key !== 'contentHash'
);

const ENVELOPE_OPTIONAL_KEYS = ['driveFileId'] as const;

const SUMMARY_REQUIRED_KEYS = [
  'customerCompany',
  'quoterName',
  'startDate',
  'serviceItemCount',
  'excludingTax',
  'includingTax',
] as const;

const SUMMARY_OPTIONAL_KEYS = ['endDate'] as const;

const QUOTATION_REQUIRED_KEYS = [
  'customerCompany',
  'quoterName',
  'quoterEmail',
  'startDate',
  'serviceItems',
  'excludingTax',
  'tax',
  'includingTax',
  'isSign',
] as const;

const QUOTATION_OPTIONAL_STRING_KEYS = [
  'customerLogo',
  'customerTaxID',
  'customerContact',
  'customerPhone',
  'customerPhoneExt',
  'customerEmail',
  'customerAddress',
  'quoterLogo',
  'quoterStamp',
  'quoterTaxID',
  'quoterAddress',
  'quoterPhone',
  'quoterPhoneExt',
  'endDate',
  'taxName',
  'customTaxName',
  'paymentTerms',
  'desc',
] as const;

const QUOTATION_OPTIONAL_NUMBER_KEYS = [
  'discountValue',
  'discountAmount',
  'afterDiscount',
  'percentage',
] as const;

const QUOTATION_OPTIONAL_KEYS = [
  ...QUOTATION_OPTIONAL_STRING_KEYS,
  ...QUOTATION_OPTIONAL_NUMBER_KEYS,
  'discountType',
  'taxMode',
] as const;

const SERVICE_ITEM_REQUIRED_KEYS = [
  'item',
  'price',
  'count',
  'amount',
] as const;
const SERVICE_ITEM_OPTIONAL_KEYS = ['category', 'unit'] as const;

type UnknownRecord = Record<string, unknown>;

/** 序列化或複製後不會保留；外部資料必須重新驗證 contentHash。 */
const verifiedCloudRevisions = new WeakSet<object>();

function invalidEnvelope(message: string): never {
  throw new CloudDomainError('INVALID_ENVELOPE', message);
}

function assertExactKeys(
  value: UnknownRecord,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[],
  path: string
): void {
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === 'symbol')) {
    invalidEnvelope(`${path} 不允許 symbol 欄位`);
  }

  const names = ownKeys as string[];
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  const unknownKeys = names.filter((key) => !allowed.has(key));
  if (unknownKeys.length > 0) {
    invalidEnvelope(`${path} 含未知欄位：${unknownKeys.join(', ')}`);
  }

  const missingKeys = requiredKeys.filter(
    (key) => !Object.prototype.hasOwnProperty.call(value, key)
  );
  if (missingKeys.length > 0) {
    invalidEnvelope(`${path} 缺少必要欄位：${missingKeys.join(', ')}`);
  }

  for (const key of names) {
    if (!Object.prototype.propertyIsEnumerable.call(value, key)) {
      invalidEnvelope(`${path}.${key} 必須是 enumerable 欄位`);
    }
  }
}

function asPlainRecord(value: unknown, path: string): UnknownRecord {
  if (!isPlainJsonObject(value)) {
    invalidEnvelope(`${path} 必須是普通物件`);
  }
  return value;
}

function readString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    invalidEnvelope(`${path} 必須是字串`);
  }
  return value;
}

function readIdentifier(value: unknown, path: string): string {
  const result = readString(value, path);
  if (result.trim().length === 0) {
    invalidEnvelope(`${path} 不可為空字串`);
  }
  return result;
}

function readFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    invalidEnvelope(`${path} 必須是有限數字`);
  }
  return Object.is(value, -0) ? 0 : value;
}

function readBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    invalidEnvelope(`${path} 必須是布林值`);
  }
  return value;
}

function normalizeServiceItem(value: unknown, index: number): JsonValue {
  const path = `$.payload.serviceItems[${index}]`;
  const item = asPlainRecord(value, path);
  assertExactKeys(
    item,
    SERVICE_ITEM_REQUIRED_KEYS,
    SERVICE_ITEM_OPTIONAL_KEYS,
    path
  );

  const normalized: Record<string, JsonValue> = {
    item: readString(item['item'], `${path}.item`),
    price: readFiniteNumber(item['price'], `${path}.price`),
    count: readFiniteNumber(item['count'], `${path}.count`),
    amount: readFiniteNumber(item['amount'], `${path}.amount`),
  };

  for (const key of SERVICE_ITEM_OPTIONAL_KEYS) {
    if (Object.prototype.hasOwnProperty.call(item, key)) {
      normalized[key] = readString(item[key], `${path}.${key}`);
    }
  }
  return normalized;
}

function normalizeQuotationPayload(value: unknown): JsonValue {
  const quotation = asPlainRecord(value, '$.payload');
  assertExactKeys(
    quotation,
    QUOTATION_REQUIRED_KEYS,
    QUOTATION_OPTIONAL_KEYS,
    '$.payload'
  );

  if (!Array.isArray(quotation['serviceItems'])) {
    invalidEnvelope('$.payload.serviceItems 必須是陣列');
  }

  const normalized: Record<string, JsonValue> = {
    customerCompany: readString(
      quotation['customerCompany'],
      '$.payload.customerCompany'
    ),
    quoterName: readString(quotation['quoterName'], '$.payload.quoterName'),
    quoterEmail: readString(quotation['quoterEmail'], '$.payload.quoterEmail'),
    startDate: readString(quotation['startDate'], '$.payload.startDate'),
    serviceItems: quotation['serviceItems'].map(normalizeServiceItem),
    excludingTax: readFiniteNumber(
      quotation['excludingTax'],
      '$.payload.excludingTax'
    ),
    tax: readFiniteNumber(quotation['tax'], '$.payload.tax'),
    includingTax: readFiniteNumber(
      quotation['includingTax'],
      '$.payload.includingTax'
    ),
    isSign: readBoolean(quotation['isSign'], '$.payload.isSign'),
  };

  for (const key of QUOTATION_OPTIONAL_STRING_KEYS) {
    if (Object.prototype.hasOwnProperty.call(quotation, key)) {
      normalized[key] = readString(quotation[key], `$.payload.${key}`);
    }
  }
  for (const key of QUOTATION_OPTIONAL_NUMBER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(quotation, key)) {
      normalized[key] = readFiniteNumber(quotation[key], `$.payload.${key}`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(quotation, 'discountType')) {
    const discountType = quotation['discountType'];
    if (discountType !== 'amount' && discountType !== 'percentage') {
      invalidEnvelope('$.payload.discountType 必須是 amount 或 percentage');
    }
    normalized['discountType'] = discountType;
  }
  if (Object.prototype.hasOwnProperty.call(quotation, 'taxMode')) {
    const taxMode = quotation['taxMode'];
    if (taxMode !== 'excluding' && taxMode !== 'including') {
      invalidEnvelope('$.payload.taxMode 必須是 excluding 或 including');
    }
    normalized['taxMode'] = taxMode;
  }

  return normalized;
}

function normalizePayload(value: unknown, kind: CloudQuotationKind): JsonValue {
  if (kind === 'delete') {
    if (value !== null) {
      invalidEnvelope('delete 修訂的 $.payload 必須是 null');
    }
    return null;
  }
  if (value === null) {
    invalidEnvelope(`${kind} 修訂的 $.payload 必須是完整報價單`);
  }
  return normalizeQuotationPayload(value);
}

function assertSummaryMatchesPayload(
  payload: JsonValue,
  summary: CloudQuotationSummary
): void {
  if (!isPlainJsonObject(payload)) {
    return;
  }

  const serviceItems = payload['serviceItems'];
  if (!Array.isArray(serviceItems)) {
    invalidEnvelope('$.payload.serviceItems 必須是陣列');
  }
  const expected: CloudQuotationSummary = {
    customerCompany: String(payload['customerCompany']),
    quoterName: String(payload['quoterName']),
    startDate: String(payload['startDate']),
    serviceItemCount: serviceItems.length,
    excludingTax: Number(payload['excludingTax']),
    includingTax: Number(payload['includingTax']),
    ...(Object.prototype.hasOwnProperty.call(payload, 'endDate')
      ? { endDate: String(payload['endDate']) }
      : {}),
  };

  if (canonicalizeJsonValue(summary) !== canonicalizeJsonValue(expected)) {
    invalidEnvelope('$.summary 必須與 $.payload 的清單欄位一致');
  }
}

function readSchemaVersion(value: unknown): typeof CLOUD_SCHEMA_VERSION {
  const schemaVersion = readFiniteNumber(value, '$.schemaVersion');
  if (
    !Number.isInteger(schemaVersion) ||
    schemaVersion !== CLOUD_SCHEMA_VERSION
  ) {
    throw new CloudDomainError(
      'UNKNOWN_SCHEMA_VERSION',
      `不支援的雲端報價單 schemaVersion：${schemaVersion}`
    );
  }
  return CLOUD_SCHEMA_VERSION;
}

function readKind(value: unknown): CloudQuotationKind {
  if (
    value !== 'create' &&
    value !== 'update' &&
    value !== 'delete' &&
    value !== 'restore'
  ) {
    throw new CloudDomainError(
      'UNSUPPORTED_KIND',
      `不支援的修訂 kind：${String(value)}`
    );
  }
  return value;
}

export function normalizeCloudParentRevisionIds(
  value: unknown,
  path = '$.parentRevisionIds'
): readonly string[] {
  if (!Array.isArray(value)) {
    invalidEnvelope(`${path} 必須是陣列`);
  }

  const ids = value.map((item, index) =>
    readIdentifier(item, `${path}[${index}]`)
  );
  if (new Set(ids).size !== ids.length) {
    invalidEnvelope(`${path} 不可包含重複 revisionId`);
  }

  return Object.freeze(
    [...ids].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
  );
}

function normalizeSummary(value: unknown): CloudQuotationSummary {
  const summary = asPlainRecord(value, '$.summary');
  assertExactKeys(
    summary,
    SUMMARY_REQUIRED_KEYS,
    SUMMARY_OPTIONAL_KEYS,
    '$.summary'
  );

  const normalized = {
    customerCompany: readString(
      summary['customerCompany'],
      '$.summary.customerCompany'
    ),
    quoterName: readString(summary['quoterName'], '$.summary.quoterName'),
    startDate: readString(summary['startDate'], '$.summary.startDate'),
    serviceItemCount: readFiniteNumber(
      summary['serviceItemCount'],
      '$.summary.serviceItemCount'
    ),
    excludingTax: readFiniteNumber(
      summary['excludingTax'],
      '$.summary.excludingTax'
    ),
    includingTax: readFiniteNumber(
      summary['includingTax'],
      '$.summary.includingTax'
    ),
  };

  if (
    !Number.isInteger(normalized.serviceItemCount) ||
    normalized.serviceItemCount < 0
  ) {
    invalidEnvelope('$.summary.serviceItemCount 必須是非負整數');
  }

  if (Object.prototype.hasOwnProperty.call(summary, 'endDate')) {
    return {
      ...normalized,
      endDate: readString(summary['endDate'], '$.summary.endDate'),
    };
  }

  return normalized;
}

function normalizeContentFields(
  value: UnknownRecord
): CloudRevisionContent<JsonValue> {
  const schemaVersion = readSchemaVersion(value['schemaVersion']);
  const kind = readKind(value['kind']);
  const payload = normalizePayload(value['payload'], kind);
  const summary = normalizeSummary(value['summary']);
  assertSummaryMatchesPayload(payload, summary);
  const createdAt = readIdentifier(value['createdAt'], '$.createdAt');
  const parsedCreatedAt = new Date(createdAt);
  if (
    !Number.isFinite(parsedCreatedAt.getTime()) ||
    parsedCreatedAt.toISOString() !== createdAt
  ) {
    invalidEnvelope('$.createdAt 必須是 UTC ISO 8601 日期時間字串');
  }

  return {
    schemaVersion,
    quotationId: readIdentifier(value['quotationId'], '$.quotationId'),
    revisionId: readIdentifier(value['revisionId'], '$.revisionId'),
    parentRevisionIds: normalizeCloudParentRevisionIds(
      value['parentRevisionIds']
    ),
    operationId: readIdentifier(value['operationId'], '$.operationId'),
    ownerSub: readIdentifier(value['ownerSub'], '$.ownerSub'),
    kind,
    payload,
    summary,
    createdAt,
  };
}

function normalizeRevisionInput<TPayload>(
  input: CloudQuotationRevisionInput<TPayload>
): CloudRevisionContent<JsonValue> {
  const record = asPlainRecord(input, '$');
  assertExactKeys(record, CONTENT_REQUIRED_KEYS, [], '$');
  return normalizeContentFields(record);
}

function deepFreeze<T>(value: T): T {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function') ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return value;
}

function markCloudQuotationRevisionVerified<TPayload>(
  revision: CloudQuotationRevision<TPayload>
): VerifiedCloudQuotationRevision<TPayload> {
  verifiedCloudRevisions.add(revision);
  return revision as VerifiedCloudQuotationRevision<TPayload>;
}

/**
 * append 前的執行期 provenance guard。結構合法、型別斷言或正確 hash 字串本身都不足夠；
 * 物件必須是本執行環境中由 create 或完整 verify 流程產生的同一個不可變實例。
 */
export function assertCloudQuotationRevisionVerified<TPayload>(
  value: unknown
): asserts value is VerifiedCloudQuotationRevision<TPayload> {
  if (
    typeof value !== 'object' ||
    value === null ||
    !verifiedCloudRevisions.has(value)
  ) {
    throw new CloudDomainError(
      'UNVERIFIED_REVISION',
      '修訂尚未完成 contentHash 驗證，不可 append'
    );
  }
}

function toHashDocument(
  value: CloudRevisionContent<unknown>
): CloudRevisionHashDocument {
  const record = asPlainRecord(value, '$');
  const content = normalizeContentFields(record);
  return {
    ...content,
    schemaVersion: CLOUD_SCHEMA_VERSION,
  };
}

/** 取得不含 contentHash 的固定內容，供前後端共用測試向量。 */
export function buildCloudRevisionHashDocument(
  value: CloudRevisionContent<unknown>
): CloudRevisionHashDocument {
  return toHashDocument(value);
}

export function canonicalizeCloudRevisionContent(
  value: CloudRevisionContent<unknown>
): string {
  return canonicalizeJsonValue(buildCloudRevisionHashDocument(value));
}

/**
 * 建立不可變修訂。每次重試都必須重用輸入中的 operationId、revisionId
 * 與 parentRevisionIds；此函式不替呼叫端重新產生或改寫任何識別欄位。
 */
export async function createCloudQuotationRevision<TPayload>(
  input: CloudQuotationRevisionInput<TPayload>,
  hashProvider: ContentHashProvider
): Promise<VerifiedCloudQuotationRevision<TPayload>> {
  const normalized = normalizeRevisionInput(input);
  const canonicalContent = canonicalizeCloudRevisionContent(normalized);
  const contentHash = await hashProvider.hash(canonicalContent);
  if (typeof contentHash !== 'string' || contentHash.trim().length === 0) {
    throw new CloudDomainError(
      'INVALID_CONTENT_HASH',
      '雜湊 provider 回傳空值'
    );
  }

  const revision = deepFreeze({
    ...normalized,
    contentHash,
  }) as CloudQuotationRevision<TPayload>;
  return markCloudQuotationRevisionVerified(revision);
}

/**
 * 驗證外部 JSON 封套。只接受目前支援的 schemaVersion，故回傳值可安全交給
 * append-only repository；未知 schema 在這一層即被拒絕，不會被寫回。
 */
export function validateCloudQuotationEnvelope(
  value: unknown
): CloudQuotationRevision<JsonValue> {
  const record = asPlainRecord(value, '$');
  assertExactKeys(record, ENVELOPE_REQUIRED_KEYS, ENVELOPE_OPTIONAL_KEYS, '$');
  const content = normalizeContentFields(record);
  const contentHash = readIdentifier(record['contentHash'], '$.contentHash');
  const driveFileId = Object.prototype.hasOwnProperty.call(
    record,
    'driveFileId'
  )
    ? readIdentifier(record['driveFileId'], '$.driveFileId')
    : undefined;
  return deepFreeze({
    ...content,
    contentHash,
    ...(driveFileId === undefined ? {} : { driveFileId }),
  });
}

/** 驗證封套並以同一 provider 重算 contentHash，供寫回前使用。 */
export async function verifyCloudQuotationEnvelope(
  value: unknown,
  hashProvider: ContentHashProvider
): Promise<VerifiedCloudQuotationRevision<JsonValue>> {
  const envelope = validateCloudQuotationEnvelope(value);
  const expectedHash = await hashProvider.hash(
    canonicalizeCloudRevisionContent(envelope)
  );
  if (typeof expectedHash !== 'string' || expectedHash.trim().length === 0) {
    throw new CloudDomainError(
      'INVALID_CONTENT_HASH',
      '雜湊 provider 回傳空值'
    );
  }
  if (envelope.contentHash !== expectedHash) {
    throw new CloudDomainError(
      'INVALID_CONTENT_HASH',
      'contentHash 與固定內容不一致'
    );
  }
  return markCloudQuotationRevisionVerified(envelope);
}

export type CloudOperationIdempotencyResult<TPayload> =
  | { readonly kind: 'new' }
  | {
      readonly kind: 'replay';
      readonly revision: CloudQuotationRevision<TPayload>;
    };

/**
 * 冪等鍵是 ownerSub＋operationId。相同鍵只能接受完全相同的固定內容，
 * 否則拒絕，避免重試悄悄改變報價單或父版本。
 */
export function checkCloudOperationIdempotency<TPayload>(
  existing: CloudQuotationRevision<TPayload> | null | undefined,
  candidate: CloudQuotationRevision<TPayload>
): CloudOperationIdempotencyResult<TPayload> {
  if (!existing) {
    return { kind: 'new' };
  }

  const sameKey =
    existing.ownerSub === candidate.ownerSub &&
    existing.operationId === candidate.operationId;
  const sameContent =
    canonicalizeCloudRevisionContent(existing) ===
      canonicalizeCloudRevisionContent(candidate) &&
    existing.contentHash === candidate.contentHash;

  if (!sameKey || !sameContent) {
    throw new CloudDomainError(
      'OPERATION_ID_CONFLICT',
      '相同 ownerSub＋operationId 的固定內容不可變更'
    );
  }

  return { kind: 'replay', revision: existing };
}

/** 同一 revisionId 的 parent 集只能被建立一次；陣列順序不影響集合語意。 */
export function assertParentRevisionIdsImmutable(
  existing: Pick<
    CloudRevisionContent<unknown>,
    'revisionId' | 'parentRevisionIds'
  >,
  candidate: Pick<
    CloudRevisionContent<unknown>,
    'revisionId' | 'parentRevisionIds'
  >
): void {
  if (existing.revisionId !== candidate.revisionId) {
    return;
  }

  const existingParents = normalizeCloudParentRevisionIds(
    existing.parentRevisionIds
  );
  const candidateParents = normalizeCloudParentRevisionIds(
    candidate.parentRevisionIds
  );
  const sameParents =
    existingParents.length === candidateParents.length &&
    existingParents.every(
      (parent, index) => parent === candidateParents[index]
    );

  if (!sameParents) {
    throw new CloudDomainError(
      'PARENT_REVISION_IMMUTABLE',
      `revisionId ${candidate.revisionId} 的 parentRevisionIds 不可改寫`
    );
  }
}

/** 從既有報價資料產生不含圖片的清單摘要；數量 0 與負單價留在 payload 原值。 */
export function createQuotationCloudSummary(
  quotation: QuotationData
): CloudQuotationSummary {
  const summary = {
    customerCompany: quotation.customerCompany,
    quoterName: quotation.quoterName,
    startDate: quotation.startDate,
    serviceItemCount: quotation.serviceItems.length,
    excludingTax: quotation.excludingTax,
    includingTax: quotation.includingTax,
  };
  return deepFreeze(
    quotation.endDate === undefined
      ? summary
      : { ...summary, endDate: quotation.endDate }
  );
}
