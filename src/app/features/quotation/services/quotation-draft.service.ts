import { Injectable, inject } from '@angular/core';
import type { QuotationData } from '@app/features/quotation/models/quotation.model';
import { AuthService } from '@app/core/services/auth.service';

const DRAFT_STORAGE_KEY_PREFIX = 'price-generator:quotation-draft';
const DRAFT_SCHEMA_VERSION = 1;

interface QuotationDraftEnvelope {
  readonly version: number;
  readonly data: QuotationData;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 草稿僅驗證足以讓表單安全還原的必要欄位，避免把損壞資料帶回呼叫端。 */
function isQuotationData(value: unknown): value is QuotationData {
  if (!isRecord(value)) return false;
  return (
    typeof value['customerCompany'] === 'string' &&
    typeof value['quoterName'] === 'string' &&
    typeof value['quoterEmail'] === 'string' &&
    typeof value['startDate'] === 'string' &&
    Array.isArray(value['serviceItems']) &&
    typeof value['excludingTax'] === 'number' &&
    typeof value['tax'] === 'number' &&
    typeof value['includingTax'] === 'number' &&
    typeof value['isSign'] === 'boolean'
  );
}

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/**
 * 編輯中的報價草稿；與五筆歷史記錄及雲端同步使用完全獨立的 localStorage key。
 */
@Injectable({ providedIn: 'root' })
export class QuotationDraftService {
  private readonly auth = inject(AuthService);

  private storageKey(ownerId: string | null = this.auth.userId()): string {
    const owner = ownerId?.trim() || 'anonymous';
    return `${DRAFT_STORAGE_KEY_PREFIX}:${encodeURIComponent(owner)}`;
  }

  load(ownerId: string | null = this.auth.userId()): QuotationData | null {
    const storage = getStorage();
    if (!storage) return null;

    try {
      const raw = storage.getItem(this.storageKey(ownerId));
      if (!raw) return null;
      const envelope: unknown = JSON.parse(raw);
      if (
        !isRecord(envelope) ||
        envelope['version'] !== DRAFT_SCHEMA_VERSION ||
        !isQuotationData(envelope['data'])
      ) {
        this.clear(ownerId);
        return null;
      }
      return cloneData(envelope['data']);
    } catch {
      this.clear(ownerId);
      return null;
    }
  }

  save(
    data: QuotationData,
    ownerId: string | null = this.auth.userId()
  ): boolean {
    const storage = getStorage();
    if (!storage) return false;

    try {
      const copy = cloneData(data);
      if (!isQuotationData(copy)) return false;
      const envelope: QuotationDraftEnvelope = {
        version: DRAFT_SCHEMA_VERSION,
        data: copy,
      };
      storage.setItem(this.storageKey(ownerId), JSON.stringify(envelope));
      return true;
    } catch {
      return false;
    }
  }

  clear(ownerId: string | null = this.auth.userId()): void {
    try {
      getStorage()?.removeItem(this.storageKey(ownerId));
    } catch {
      // localStorage 可能被瀏覽器政策停用；清除草稿不應影響報價流程。
    }
  }

  hasDraft(ownerId: string | null = this.auth.userId()): boolean {
    return this.load(ownerId) !== null;
  }
}
