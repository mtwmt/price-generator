import { WebCryptoSha256HashProvider } from './cloud-hash';
import { createLocalMigrationOperation } from './cloud-local-migration';
import {
  buildCloudHistoryEntries,
  DriveRevisionMetadata,
} from './cloud-history';
import type { QuotationData } from '../models/quotation.model';

const hashProvider = new WebCryptoSha256HashProvider();
const data: QuotationData = {
  customerCompany: '本機客戶',
  quoterName: '',
  quoterEmail: '',
  startDate: '2026-09-09',
  serviceItems: [],
  excludingTax: 0,
  tax: 0,
  includingTax: 0,
  isSign: false,
};
const dataHash = 'a'.repeat(64);
const create = (revisions: readonly DriveRevisionMetadata[]) =>
  createLocalMigrationOperation(
    'owner-a',
    data,
    dataHash,
    revisions,
    hashProvider
  );
function metadata(
  revisionId: string,
  kind: DriveRevisionMetadata['kind'],
  parentRevisionIds: string[] = []
): DriveRevisionMetadata {
  return {
    fileId: `file-${revisionId}`,
    name: '報價單 本機客戶',
    quotationId: `local-${dataHash}`,
    revisionId,
    kind,
    parentRevisionIds,
    createdAt: '2026-09-09T00:00:00.000Z',
  };
}

describe('本機報價單明確再次匯入', () => {
  it('刪除再匯入會接續 delete 恢復，再按時去重', async () => {
    const original = (await create([]))!.revision;
    const revisions = [
      metadata(original.revisionId, 'create'),
      metadata('deleted', 'delete', [original.revisionId]),
    ];
    expect(buildCloudHistoryEntries(revisions)).toHaveLength(0);
    const restored = (await create(revisions))!.revision;
    expect(restored.kind).toBe('restore');
    expect(restored.parentRevisionIds).toEqual(['deleted']);
    expect(restored.operationId).not.toBe(original.operationId);
    revisions.push(
      metadata(restored.revisionId, 'restore', [...restored.parentRevisionIds])
    );
    expect(buildCloudHistoryEntries(revisions)).toHaveLength(1);
    expect(await create(revisions)).toBeNull();
  });

  it('相同 delete heads 重試保持完整內容與 ID，即使 metadata 順序改變', async () => {
    const revisions = [
      metadata('deleted-b', 'delete'),
      metadata('deleted-a', 'delete'),
    ];
    expect(await create(revisions)).toEqual(
      await create([...revisions].reverse())
    );
    expect((await create(revisions))!.revision.parentRevisionIds).toEqual([
      'deleted-a',
      'deleted-b',
    ]);
    expect(
      (await create([metadata('deleted-c', 'delete')]))!.revision.operationId
    ).not.toEqual((await create(revisions))!.revision.operationId);
  });

  it('保留 active 雲端修改，包含 delete 與 active 並存的分支', async () => {
    const revisions = [
      metadata('original', 'create'),
      metadata('edited', 'update', ['original']),
    ];
    expect(await create(revisions)).toBeNull();
    expect(
      await create([...revisions, metadata('deleted', 'delete', ['original'])])
    ).toBeNull();
    expect(buildCloudHistoryEntries(revisions)[0].revisionId).toBe('edited');
  });
});
