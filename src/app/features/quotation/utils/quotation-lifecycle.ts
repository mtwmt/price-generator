import {
  QuotationData,
  QuotationVersionSnapshot,
} from '../models/quotation.model';

export const QUOTATION_STATUSES = ['draft', 'sent', 'won', 'lost'] as const;
export const QUOTATION_STATUS_LABELS = Object.freeze({
  draft: '草稿', sent: '已送出', won: '已成交', lost: '未成交',
});

export function quotationStatusLabel(status: unknown): string {
  return typeof status === 'string' && Object.prototype.hasOwnProperty.call(QUOTATION_STATUS_LABELS, status)
    ? QUOTATION_STATUS_LABELS[status as keyof typeof QUOTATION_STATUS_LABELS] : '';
}

export function createQuotationId(): string {
  return `quotation-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
}

/** 補足舊本機/雲端資料的 metadata，不信任舊資料的衍生版本欄位。 */
export function normalizeQuotationLifecycle(data: QuotationData): QuotationData {
  const status = QUOTATION_STATUSES.includes(data.status as typeof QUOTATION_STATUSES[number])
    ? data.status
    : 'draft';
  const businessVersion = Number.isInteger(data.businessVersion) && (data.businessVersion ?? 0) > 0
    ? data.businessVersion
    : 1;
  return {
    ...data,
    quotationId: data.quotationId || createQuotationId(),
    quotationNumber: typeof data.quotationNumber === 'string' ? data.quotationNumber.trim() : '',
    businessVersion,
    status,
    previousVersions: Array.isArray(data.previousVersions) ? data.previousVersions : [],
  };
}

/**
 * 「建立下一版」只在已送出等既有文件上建立快照，原文件 ID 不變。
 * 純草稿更新不會產生不必要版本；複製新報價則用 cloneAsNewQuotation。
 */
export function createNextBusinessVersion(
  data: QuotationData,
  savedVersion: QuotationData = data
): QuotationData {
  const current = normalizeQuotationLifecycle(data);
  const saved = normalizeQuotationLifecycle(savedVersion);
  if (saved.quotationId !== current.quotationId || saved.businessVersion !== current.businessVersion) {
    throw new Error('建立下一版需要同一份已儲存文件版本');
  }
  const snapshot: QuotationVersionSnapshot = {
    businessVersion: saved.businessVersion!,
    savedAt: new Date().toISOString(),
    data: withoutPreviousVersions(saved),
  };
  return {
    ...current,
    businessVersion: current.businessVersion! + 1,
    status: 'draft',
    previousVersions: [...(current.previousVersions ?? []), snapshot],
  };
}

export function cloneAsNewQuotation(data: QuotationData): QuotationData {
  const current = normalizeQuotationLifecycle(data);
  return {
    ...current,
    quotationId: createQuotationId(),
    quotationNumber: '',
    businessVersion: 1,
    status: 'draft',
    previousVersions: [],
  };
}

export function hasDuplicateQuotationNumber(
  history: readonly QuotationData[],
  quotationNumber: string,
  selfId?: string
): boolean {
  const normalized = quotationNumber.trim().toLocaleLowerCase();
  return !!normalized && history.some((item) =>
    item.quotationId !== selfId &&
    item.quotationNumber?.trim().toLocaleLowerCase() === normalized
  );
}

function withoutPreviousVersions(data: QuotationData): Omit<QuotationData, 'previousVersions'> {
  const { previousVersions: _previousVersions, ...snapshot } = data;
  return snapshot;
}
