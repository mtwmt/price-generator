import {
  CustomerTemplate,
  ServiceItemTemplate,
} from '@app/features/quotation/models/quotation.model';
import { WebCryptoSha256HashProvider } from './cloud-hash';
import { canonicalizeJsonValue, isPlainJsonObject } from './cloud-json';

/** 目前常用資料操作格式的唯一支援版本。 */
export const TEMPLATE_OPERATION_SCHEMA_VERSION = 1 as const;
export const MAX_TEMPLATE_OPERATION_BYTES = 65_536;

export type TemplateKind = 'customers' | 'service-items';
export type TemplateValue = CustomerTemplate | ServiceItemTemplate;
export type TemplateAction = 'put' | 'delete';

/**
 * 一筆 append-only 常用資料操作。刪除一律以 value: null 的 tombstone 表示，
 * 因此離線裝置不會因為看不到已刪資料而把它復活。
 */
export interface TemplateOperation {
  readonly schemaVersion: typeof TEMPLATE_OPERATION_SCHEMA_VERSION;
  readonly ownerSub: string;
  readonly resourceKind: TemplateKind;
  readonly entityId: string;
  readonly revisionId: string;
  readonly operationId: string;
  readonly parentRevisionIds: readonly string[];
  readonly action: TemplateAction;
  readonly value: TemplateValue | null;
  readonly createdAt: string;
  readonly contentHash: string;
}

export interface TemplateEntity {
  readonly resourceKind: TemplateKind;
  readonly entityId: string;
  /** 沒有已知子節點的所有分支，包含 delete tombstone。 */
  readonly heads: readonly TemplateOperation[];
}

export class TemplateSyncDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateSyncDomainError';
  }
}

const OPERATION_KEYS = [
  'schemaVersion',
  'ownerSub',
  'resourceKind',
  'entityId',
  'revisionId',
  'operationId',
  'parentRevisionIds',
  'action',
  'value',
  'createdAt',
  'contentHash',
] as const;

const OPERATION_CONTENT_KEYS = OPERATION_KEYS.filter(
  (key) => key !== 'contentHash'
);

const CUSTOMER_REQUIRED_KEYS = ['id', 'name', 'customerCompany'] as const;
const CUSTOMER_OPTIONAL_KEYS = [
  'customerTaxID',
  'customerContact',
  'customerPhone',
  'customerPhoneExt',
  'customerEmail',
  'customerAddress',
] as const;
const SERVICE_ITEM_REQUIRED_KEYS = ['id', 'name', 'item', 'price'] as const;
const SERVICE_ITEM_OPTIONAL_KEYS = ['unit', 'category'] as const;

const MAX_OWNER_SUB_LENGTH = 512;
const MAX_IDENTIFIER_LENGTH = 200;
const MAX_ENTITY_ID_LENGTH = 512;
const MAX_NAME_LENGTH = 300;
const MAX_COMPANY_LENGTH = 500;
const MAX_ITEM_LENGTH = 500;
const MAX_ADDRESS_LENGTH = 2_000;
const MAX_TEXT_LENGTH = 500;
const MAX_EMAIL_LENGTH = 254;
const MAX_PARENT_COUNT = 128;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const SAFE_OPERATION_IDENTIFIER = /^[A-Za-z0-9._-]+$/;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/;

type UnknownRecord = Record<string, unknown>;

function invalid(message: string): never {
  throw new TemplateSyncDomainError(message);
}

function asPlainRecord(value: unknown, path: string): UnknownRecord {
  if (!isPlainJsonObject(value)) {
    invalid(`${path} 必須是普通物件`);
  }
  return value;
}

function assertExactKeys(
  record: UnknownRecord,
  required: readonly string[],
  optional: readonly string[],
  path: string
): void {
  const keys = Reflect.ownKeys(record);
  if (keys.some((key) => typeof key !== 'string')) {
    invalid(`${path} 不允許 symbol 欄位`);
  }
  const names = keys as string[];
  const allowed = new Set([...required, ...optional]);
  const unknown = names.filter((key) => !allowed.has(key));
  const missing = required.filter(
    (key) => !Object.prototype.hasOwnProperty.call(record, key)
  );
  if (unknown.length > 0) invalid(`${path} 含未知欄位：${unknown.join(', ')}`);
  if (missing.length > 0) invalid(`${path} 缺少必要欄位：${missing.join(', ')}`);
  for (const key of names) {
    if (!Object.prototype.propertyIsEnumerable.call(record, key)) {
      invalid(`${path}.${key} 必須是 enumerable 欄位`);
    }
  }
}

function readText(
  value: unknown,
  path: string,
  maximumLength: number,
  required: boolean
): string {
  if (typeof value !== 'string') invalid(`${path} 必須是字串`);
  if (value.length > maximumLength) invalid(`${path} 長度超過上限`);
  if (CONTROL_CHARACTER.test(value)) invalid(`${path} 不可包含控制字元`);
  if (required && value.trim().length === 0) invalid(`${path} 不可為空白字串`);
  return value;
}

function readSafeIdentifier(value: unknown, path: string): string {
  const result = readText(value, path, MAX_IDENTIFIER_LENGTH, true);
  if (!SAFE_OPERATION_IDENTIFIER.test(result)) {
    invalid(`${path} 只允許英數、句點、底線與連字號`);
  }
  return result;
}

function readEntityId(value: unknown): string {
  // 舊版 localStorage 的 ID 沒有 UUID 格式保證；僅拒絕空白、控制字元與過大值。
  return readText(value, '$.entityId', MAX_ENTITY_ID_LENGTH, true);
}

function readOwnerSub(value: unknown): string {
  // Firebase UID 不是 UUID；不能用 identifier regex 限縮合法帳號。
  return readText(value, '$.ownerSub', MAX_OWNER_SUB_LENGTH, true);
}

function readCreatedAt(value: unknown): string {
  const result = readText(value, '$.createdAt', 40, true);
  const date = new Date(result);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== result) {
    invalid('$.createdAt 必須是 UTC ISO 8601 日期時間字串');
  }
  return result;
}

function normalizeParents(value: unknown): readonly string[] {
  if (!Array.isArray(value)) invalid('$.parentRevisionIds 必須是陣列');
  if (value.length > MAX_PARENT_COUNT) invalid('$.parentRevisionIds 數量超過上限');
  const parents = value.map((parent, index) =>
    readSafeIdentifier(parent, `$.parentRevisionIds[${index}]`)
  );
  if (new Set(parents).size !== parents.length) {
    invalid('$.parentRevisionIds 不可包含重複 revisionId');
  }
  return Object.freeze([...parents].sort(compareStrings));
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function optionalText(
  record: UnknownRecord,
  key: string,
  maximumLength = MAX_TEXT_LENGTH
): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(record, key)) return undefined;
  return readText(record[key], `$.value.${key}`, maximumLength, false);
}

function normalizeCustomer(value: unknown, entityId: string): CustomerTemplate {
  const record = asPlainRecord(value, '$.value');
  assertExactKeys(record, CUSTOMER_REQUIRED_KEYS, CUSTOMER_OPTIONAL_KEYS, '$.value');
  const id = readEntityTemplateId(record['id'], entityId);
  const normalized: {
    id: string;
    name: string;
    customerCompany: string;
    customerTaxID?: string;
    customerContact?: string;
    customerPhone?: string;
    customerPhoneExt?: string;
    customerEmail?: string;
    customerAddress?: string;
  } = {
    id,
    name: readText(record['name'], '$.value.name', MAX_NAME_LENGTH, true),
    customerCompany: readText(
      record['customerCompany'],
      '$.value.customerCompany',
      MAX_COMPANY_LENGTH,
      true
    ),
  };
  const optionalValues: ReadonlyArray<readonly [keyof Omit<CustomerTemplate, 'id' | 'name' | 'customerCompany'>, number]> = [
    ['customerTaxID', MAX_TEXT_LENGTH],
    ['customerContact', MAX_TEXT_LENGTH],
    ['customerPhone', MAX_TEXT_LENGTH],
    ['customerPhoneExt', MAX_TEXT_LENGTH],
    ['customerEmail', MAX_EMAIL_LENGTH],
    ['customerAddress', MAX_ADDRESS_LENGTH],
  ];
  for (const [key, maximumLength] of optionalValues) {
    const text = optionalText(record, key, maximumLength);
    if (text !== undefined) {
      normalized[key] = text;
    }
  }
  return normalized;
}

function normalizeServiceItem(value: unknown, entityId: string): ServiceItemTemplate {
  const record = asPlainRecord(value, '$.value');
  assertExactKeys(record, SERVICE_ITEM_REQUIRED_KEYS, SERVICE_ITEM_OPTIONAL_KEYS, '$.value');
  if (typeof record['price'] !== 'number' || !Number.isFinite(record['price']) || record['price'] < 0) {
    invalid('$.value.price 必須是非負有限數字');
  }
  const normalized: {
    id: string;
    name: string;
    item: string;
    price: number;
    unit?: string;
    category?: string;
  } = {
    id: readEntityTemplateId(record['id'], entityId),
    name: readText(record['name'], '$.value.name', MAX_NAME_LENGTH, true),
    item: readText(record['item'], '$.value.item', MAX_ITEM_LENGTH, true),
    price: Object.is(record['price'], -0) ? 0 : record['price'],
  };
  for (const key of SERVICE_ITEM_OPTIONAL_KEYS) {
    const text = optionalText(record, key);
    if (text !== undefined) normalized[key] = text;
  }
  return normalized;
}

function readEntityTemplateId(value: unknown, entityId: string): string {
  const id = readText(value, '$.value.id', MAX_ENTITY_ID_LENGTH, true);
  if (id !== entityId) invalid('$.value.id 必須與 $.entityId 一致');
  return id;
}

/** 以 resourceKind 驗證資料模型；欄位白名單防止未來意外同步 UI 暫存內容。 */
export function validateTemplateValue(
  kind: TemplateKind,
  value: unknown
): value is TemplateValue {
  try {
    if (kind !== 'customers' && kind !== 'service-items') return false;
    const record = asPlainRecord(value, '$.value');
    const id = readText(record['id'], '$.value.id', MAX_ENTITY_ID_LENGTH, true);
    if (kind === 'customers') {
      normalizeCustomer(value, id);
    } else {
      normalizeServiceItem(value, id);
    }
    return true;
  } catch {
    return false;
  }
}

function normalizeValue(
  kind: TemplateKind,
  action: TemplateAction,
  value: unknown,
  entityId: string
): TemplateValue | null {
  if (action === 'delete') {
    if (value !== null) invalid('delete 操作的 $.value 必須為 null');
    return null;
  }
  if (value === null) invalid('put 操作的 $.value 不可為 null');
  return kind === 'customers'
    ? normalizeCustomer(value, entityId)
    : normalizeServiceItem(value, entityId);
}

function normalizedContent(value: unknown, expectedOwner: string): Omit<TemplateOperation, 'contentHash'> {
  const record = asPlainRecord(value, '$');
  assertExactKeys(record, OPERATION_CONTENT_KEYS, [], '$');
  if (record['schemaVersion'] !== TEMPLATE_OPERATION_SCHEMA_VERSION) {
    invalid(`不支援的 schemaVersion：${String(record['schemaVersion'])}`);
  }
  const ownerSub = readOwnerSub(record['ownerSub']);
  if (ownerSub !== expectedOwner) invalid('$.ownerSub 與目前帳號不一致');
  const resourceKind = record['resourceKind'];
  if (resourceKind !== 'customers' && resourceKind !== 'service-items') {
    invalid('$.resourceKind 不受支援');
  }
  const entityId = readEntityId(record['entityId']);
  const action = record['action'];
  if (action !== 'put' && action !== 'delete') invalid('$.action 必須是 put 或 delete');
  const revisionId = readSafeIdentifier(record['revisionId'], '$.revisionId');
  const operationId = readSafeIdentifier(record['operationId'], '$.operationId');
  const parentRevisionIds = normalizeParents(record['parentRevisionIds']);
  if (parentRevisionIds.includes(revisionId)) invalid('$.parentRevisionIds 不可包含自身 revisionId');
  return {
    schemaVersion: TEMPLATE_OPERATION_SCHEMA_VERSION,
    ownerSub,
    resourceKind,
    entityId,
    revisionId,
    operationId,
    parentRevisionIds,
    action,
    value: normalizeValue(resourceKind, action, record['value'], entityId),
    createdAt: readCreatedAt(record['createdAt']),
  };
}

function normalizeOperation(value: unknown, expectedOwner: string): TemplateOperation {
  const record = asPlainRecord(value, '$');
  assertExactKeys(record, OPERATION_KEYS, [], '$');
  const content = normalizedContent(
    Object.fromEntries(OPERATION_CONTENT_KEYS.map((key) => [key, record[key]])),
    expectedOwner
  );
  const contentHash = readText(record['contentHash'], '$.contentHash', 64, true);
  if (!SHA256_HEX.test(contentHash)) invalid('$.contentHash 必須是小寫 SHA-256 十六進位字串');
  const operation = { ...content, contentHash };
  assertOperationSize(operation);
  return deepFreeze(operation);
}

function assertOperationSize(operation: TemplateOperation): void {
  const bytes = new TextEncoder().encode(canonicalizeJsonValue(operation)).byteLength;
  if (bytes > MAX_TEMPLATE_OPERATION_BYTES) {
    invalid(`操作大小不可超過 ${MAX_TEMPLATE_OPERATION_BYTES} bytes`);
  }
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

/** 產生 contentHash 的固定輸入；contentHash 自己不能參與雜湊。 */
export function canonicalTemplateOperation(
  operation: Omit<TemplateOperation, 'contentHash'> | TemplateOperation
): string {
  const content: Omit<TemplateOperation, 'contentHash'> = {
    schemaVersion: operation.schemaVersion,
    ownerSub: operation.ownerSub,
    resourceKind: operation.resourceKind,
    entityId: operation.entityId,
    revisionId: operation.revisionId,
    operationId: operation.operationId,
    parentRevisionIds: operation.parentRevisionIds,
    action: operation.action,
    value: operation.value,
    createdAt: operation.createdAt,
  };
  return canonicalizeJsonValue({
    ...content,
    parentRevisionIds: [...content.parentRevisionIds].sort(compareStrings),
  });
}

/** 建立新的不可變操作；重試必須重用這個回傳物件，而非再次呼叫此函式。 */
export async function createTemplateOperation(
  input: Omit<TemplateOperation, 'schemaVersion' | 'contentHash'>
): Promise<TemplateOperation> {
  const content = normalizedContent(
    { ...input, schemaVersion: TEMPLATE_OPERATION_SCHEMA_VERSION },
    readOwnerSub(input.ownerSub)
  );
  const canonical = canonicalTemplateOperation(content);
  const contentHash = await new WebCryptoSha256HashProvider().hash(canonical);
  if (!SHA256_HEX.test(contentHash)) invalid('SHA-256 provider 回傳不合法雜湊');
  const operation = deepFreeze({ ...content, contentHash });
  assertOperationSize(operation);
  return operation;
}

/** 外部讀回的操作必須先驗證欄位、帳號與 SHA-256，才可交給合併核心。 */
export async function validateTemplateOperation(
  value: unknown,
  ownerSub: string
): Promise<TemplateOperation> {
  const expectedOwner = readOwnerSub(ownerSub);
  const operation = normalizeOperation(value, expectedOwner);
  const expectedHash = await new WebCryptoSha256HashProvider().hash(
    canonicalTemplateOperation(operation)
  );
  if (operation.contentHash !== expectedHash) invalid('$.contentHash 與操作內容不一致');
  return operation;
}

function operationIdentity(operation: TemplateOperation): string {
  return canonicalizeJsonValue(operation);
}

/**
 * 純 DAG 合併：不以 createdAt 決定勝負。沒有子節點的分支全數保留，
 * 呼叫端可將多個 heads 顯示為衝突並以一筆涵蓋所有 heads 的操作解決。
 */
export function mergeTemplateOperations(
  operations: readonly TemplateOperation[],
  ownerSub: string
): TemplateEntity[] {
  const expectedOwner = readOwnerSub(ownerSub);
  const byRevision = new Map<string, TemplateOperation>();
  const byOperation = new Map<string, TemplateOperation>();

  for (const candidate of operations) {
    const operation = normalizeOperation(candidate, expectedOwner);
    const sameRevision = byRevision.get(operation.revisionId);
    const sameOperation = byOperation.get(operation.operationId);
    if (sameRevision && operationIdentity(sameRevision) !== operationIdentity(operation)) {
      invalid(`revisionId ${operation.revisionId} 對應不同內容`);
    }
    if (sameOperation && operationIdentity(sameOperation) !== operationIdentity(operation)) {
      invalid(`operationId ${operation.operationId} 對應不同內容`);
    }
    if (!sameRevision) byRevision.set(operation.revisionId, operation);
    if (!sameOperation) byOperation.set(operation.operationId, operation);
  }

  for (const operation of byRevision.values()) {
    for (const parentId of operation.parentRevisionIds) {
      const parent = byRevision.get(parentId);
      if (!parent) invalid(`revisionId ${operation.revisionId} 缺少父版本 ${parentId}`);
      if (
        parent.ownerSub !== operation.ownerSub ||
        parent.resourceKind !== operation.resourceKind ||
        parent.entityId !== operation.entityId
      ) {
        invalid(`revisionId ${operation.revisionId} 不可引用其他帳號或其他實體的父版本`);
      }
    }
  }

  const visitState = new Map<string, 'visiting' | 'visited'>();
  const visit = (revisionId: string): void => {
    const state = visitState.get(revisionId);
    if (state === 'visiting') invalid('操作圖不可包含循環');
    if (state === 'visited') return;
    visitState.set(revisionId, 'visiting');
    const operation = byRevision.get(revisionId);
    if (!operation) invalid(`找不到 revisionId ${revisionId}`);
    for (const parentId of operation.parentRevisionIds) visit(parentId);
    visitState.set(revisionId, 'visited');
  };
  for (const revisionId of byRevision.keys()) visit(revisionId);

  const children = new Set<string>();
  for (const operation of byRevision.values()) {
    for (const parentId of operation.parentRevisionIds) children.add(parentId);
  }
  const entities = new Map<string, { resourceKind: TemplateKind; entityId: string; heads: TemplateOperation[] }>();
  for (const operation of byRevision.values()) {
    if (children.has(operation.revisionId)) continue;
    const key = `${operation.resourceKind}\u0000${operation.entityId}`;
    const entity = entities.get(key) ?? {
      resourceKind: operation.resourceKind,
      entityId: operation.entityId,
      heads: [],
    };
    entity.heads.push(operation);
    entities.set(key, entity);
  }
  return [...entities.values()]
    .map((entity) => deepFreeze({
      ...entity,
      heads: Object.freeze([...entity.heads].sort((left, right) => compareStrings(left.revisionId, right.revisionId))),
    }))
    .sort((left, right) =>
      compareStrings(left.resourceKind, right.resourceKind) || compareStrings(left.entityId, right.entityId)
    );
}
