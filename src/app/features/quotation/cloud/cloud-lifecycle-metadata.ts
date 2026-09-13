import type { QuotationData } from '../models/quotation.model';
import { QUOTATION_STATUSES } from '../utils/quotation-lifecycle';

/** Optional listing hints, never part of the revision's canonical summary/hash.
 * Drive limits each UTF-8 property key + value to 124 bytes. Oversize values are
 * omitted, not truncated into a misleading quotation number; payload stays intact.
 */
export function readCloudLifecycleMetadata(value: unknown): Pick<QuotationData, 'quotationNumber' | 'status'> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const number = record['quotationNumber'];
  const status = record['status'];
  return {
    ...(typeof number === 'string' && !/[\u0000-\u001f\u007f]/.test(number) &&
      new TextEncoder().encode(`quotationNumber${number}`).byteLength <= 124
      ? { quotationNumber: number.trim() } : {}),
    ...(typeof status === 'string' && QUOTATION_STATUSES.includes(status as NonNullable<QuotationData['status']>)
      ? { status: status as NonNullable<QuotationData['status']> } : {}),
  };
}
