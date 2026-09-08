import type { QuotationData } from '../models/quotation.model';
import type { DriveRevisionMetadata } from './cloud-history';
import type { ContentHashProvider } from './cloud-hash';
import { canonicalizeJsonValue } from './cloud-json';
import {
  createCloudQuotationDraft,
  createCloudSaveOperation,
} from './cloud-operations';
import { createQuotationCloudSummary } from './cloud-domain';

/** 明確再次匯入才恢復刪除版本；已有雲端內容時不重播舊 create。 */
export async function createLocalMigrationOperation(
  ownerSub: string,
  data: QuotationData,
  dataHash: string,
  revisions: readonly DriveRevisionMetadata[],
  hashProvider: ContentHashProvider
) {
  const quotationId = `local-${dataHash}`;
  const matching = revisions.filter((item) => item.quotationId === quotationId);
  const parents = new Set(matching.flatMap((item) => item.parentRevisionIds));
  const heads = matching.filter((item) => !parents.has(item.revisionId));
  if (heads.some((item) => item.kind !== 'delete')) return null;
  // 有資料卻找不到 head 時不猜測，避免產生新的根分支。
  if (matching.length > 0 && heads.length === 0) return null;
  const baseRevisionIds = [
    ...new Set(heads.map((item) => item.revisionId)),
  ].sort();
  const restoring = baseRevisionIds.length > 0;
  const restoreHash = restoring
    ? await hashProvider.hash(
        canonicalizeJsonValue({ ownerSub, dataHash, baseRevisionIds })
      )
    : dataHash;
  const createdAt = restoring
    ? heads
        .map((item) => item.createdAt)
        .sort()
        .at(-1)!
    : localMigrationCreatedAt(data, dataHash);
  return createCloudSaveOperation(
    {
      draft: createCloudQuotationDraft({
        ownerSub,
        quotationId,
        baseRevisionIds,
        payload: data,
        summary: createQuotationCloudSummary(data),
      }),
      operationId: restoring
        ? `local-restore-${restoreHash}`
        : `local-migration-${dataHash}`,
      revisionId: restoring
        ? `local-restore-revision-${restoreHash}`
        : `local-revision-${dataHash}`,
      kind: restoring ? 'restore' : 'create',
      createdAt,
    },
    hashProvider
  );
}

function localMigrationCreatedAt(
  data: QuotationData,
  dataHash: string
): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(data.startDate)) {
    const timestamp = Date.parse(`${data.startDate}T00:00:00.000Z`);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
  }
  const fallbackOffset =
    Number.parseInt(dataHash.slice(0, 8), 16) % (24 * 60 * 60 * 1000);
  return new Date(Date.UTC(2000, 0, 1) + fallbackOffset).toISOString();
}
