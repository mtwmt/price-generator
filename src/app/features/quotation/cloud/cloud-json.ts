/**
 * 可跨前後端共用的 JSON 值型別。
 *
 * 雲端封套只接受 JSON 能表達的值，避免把 class、函式或瀏覽器物件
 * 意外寫入同步佇列，造成不同執行環境得到不同內容。
 */
export type JsonPrimitive = string | number | boolean | null;

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type JsonArray = readonly JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export class CloudJsonValidationError extends Error {
  readonly code = 'INVALID_JSON' as const;

  constructor(
    readonly path: string,
    message: string
  ) {
    super(`${path}: ${message}`);
    this.name = 'CloudJsonValidationError';
  }
}

/** 只允許普通物件，排除 Date、Map、class instance 等非 JSON 資料。 */
export function isPlainJsonObject(
  value: unknown
): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * 將輸入轉成可傳輸的 JSON 值。
 * 物件鍵不在此處排序；排序由 canonicalizeJsonValue 統一處理。
 */
export function normalizeJsonValue(value: unknown, path = '$'): JsonValue {
  if (value === null) {
    return null;
  }

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return value;
    case 'number':
      if (!Number.isFinite(value)) {
        throw new CloudJsonValidationError(path, '數值必須是有限數字');
      }
      // JSON.stringify(-0) 會輸出 0；先正規化可避免前後端字串不一致。
      return Object.is(value, -0) ? 0 : value;
    case 'undefined':
    case 'bigint':
    case 'function':
    case 'symbol':
      throw new CloudJsonValidationError(path, '不支援的 JSON 值型別');
    case 'object':
      break;
    default:
      throw new CloudJsonValidationError(path, '不支援的 JSON 值型別');
  }

  if (Array.isArray(value)) {
    const normalized: JsonValue[] = [];
    for (let index = 0; index < value.length; index += 1) {
      // 稀疏陣列在 JSON 中等同 null，明確轉換以固定跨執行環境結果。
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        normalized.push(null);
        continue;
      }
      normalized.push(normalizeJsonValue(value[index], `${path}[${index}]`));
    }
    return normalized;
  }

  if (!isPlainJsonObject(value)) {
    throw new CloudJsonValidationError(path, '只允許普通物件');
  }

  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === 'symbol')) {
    throw new CloudJsonValidationError(path, '不允許 symbol 鍵');
  }

  const normalized: Record<string, JsonValue> = Object.create(null) as Record<
    string,
    JsonValue
  >;
  for (const key of Object.getOwnPropertyNames(value)) {
    if (!Object.prototype.propertyIsEnumerable.call(value, key)) {
      throw new CloudJsonValidationError(
        `${path}.${key}`,
        '非 enumerable 欄位不可傳輸'
      );
    }
    normalized[key] = normalizeJsonValue(value[key], `${path}.${key}`);
  }
  return normalized;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function serializeCanonicalJson(value: JsonValue): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeCanonicalJson(item)).join(',')}]`;
  }

  const objectValue = value as JsonObject;
  const keys = Object.keys(objectValue).sort(compareStrings);
  return `{${keys
    .map(
      (key) =>
        `${JSON.stringify(key)}:${serializeCanonicalJson(objectValue[key])}`
    )
    .join(',')}}`;
}

/**
 * 以遞迴排序物件鍵、保留陣列順序的規範化 JSON。
 * 這個字串格式是 contentHash 的共享輸入，前後端必須共用同一測試向量。
 */
export function canonicalizeJsonValue(value: unknown): string {
  return serializeCanonicalJson(normalizeJsonValue(value));
}
