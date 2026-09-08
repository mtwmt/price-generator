import { QuotationData } from '@app/features/quotation/models/quotation.model';
import { CloudQuotationKind } from './cloud-contracts';

export interface DriveRevisionMetadata {
  readonly fileId: string;
  readonly name: string;
  readonly quotationId: string;
  readonly revisionId: string;
  readonly parentRevisionIds: readonly string[];
  readonly kind: CloudQuotationKind;
  readonly createdAt: string;
}

export interface CloudQuotationHistoryEntry {
  readonly fileId: string;
  readonly quotationId: string;
  readonly revisionId: string;
  /** 同一報價單所有尚未被後繼 revision 取代的版本，儲存時會合併為共同父版本。 */
  readonly headRevisionIds: readonly string[];
  readonly data: QuotationData;
}

function parseQuotationFileName(metadata: DriveRevisionMetadata): {
  readonly customerCompany: string;
  readonly startDate: string;
} {
  let label = metadata.name.trim().replace(/^報價單\s+/, '');
  const revisionSuffix = ` ${metadata.revisionId}.json`;
  if (label.endsWith(revisionSuffix)) {
    label = label.slice(0, -revisionSuffix.length).trim();
  } else {
    label = label.replace(/\.json$/i, '').trim();
  }

  const dateMatch = /^(\d{4}-\d{2}-\d{2})(?:\s+|$)/.exec(label);
  const startDate = dateMatch?.[1] ?? metadata.createdAt.slice(0, 10);
  const customerCompany = dateMatch
    ? label.slice(dateMatch[0].length).trim()
    : label;

  return {
    customerCompany: customerCompany || '雲端報價單',
    startDate,
  };
}

function placeholderData(metadata: DriveRevisionMetadata): QuotationData {
  const summary = parseQuotationFileName(metadata);
  return {
    customerCompany: summary.customerCompany,
    quoterName: '',
    quoterEmail: '',
    startDate: summary.startDate,
    serviceItems: [],
    excludingTax: 0,
    tax: 0,
    includingTax: 0,
    isSign: false,
  };
}

/** 從 append-only revision stream 找出每張報價單的 head；不對筆數設定任何上限。 */
export function buildCloudHistoryEntries(
  revisions: readonly DriveRevisionMetadata[]
): readonly CloudQuotationHistoryEntry[] {
  const parentIds = new Set(
    revisions.flatMap((revision) => revision.parentRevisionIds)
  );
  const headsByQuotation = new Map<string, DriveRevisionMetadata[]>();
  for (const revision of revisions) {
    if (parentIds.has(revision.revisionId)) continue;
    const heads = headsByQuotation.get(revision.quotationId) ?? [];
    heads.push(revision);
    headsByQuotation.set(revision.quotationId, heads);
  }

  const entries: CloudQuotationHistoryEntry[] = [];
  for (const [quotationId, heads] of headsByQuotation) {
    const activeHeads = heads.filter((head) => head.kind !== 'delete');
    if (activeHeads.length === 0) continue;
    const newest = [...activeHeads].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    )[0];
    if (!newest) continue;
    entries.push({
      fileId: newest.fileId,
      quotationId,
      revisionId: newest.revisionId,
      headRevisionIds: Object.freeze(
        activeHeads.map((head) => head.revisionId).sort()
      ),
      data: placeholderData(newest),
    });
  }
  return Object.freeze(
    entries.sort((left, right) =>
      right.data.startDate.localeCompare(left.data.startDate)
    )
  );
}
