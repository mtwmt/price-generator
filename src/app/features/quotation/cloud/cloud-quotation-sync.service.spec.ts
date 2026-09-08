import {
  buildCloudHistoryEntries,
  type DriveRevisionMetadata,
} from './cloud-history';

function revision(
  overrides: Partial<DriveRevisionMetadata>
): DriveRevisionMetadata {
  return {
    fileId: 'file-a',
    name: '報價單 測試客戶',
    quotationId: 'quotation-a',
    revisionId: 'revision-a',
    parentRevisionIds: [],
    kind: 'create',
    createdAt: '2026-09-06T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildCloudHistoryEntries', () => {
  it('只保留未被後繼版本取代的 head，並保留同一報價單的全部分支父版本', () => {
    const history = buildCloudHistoryEntries([
      revision({ revisionId: 'revision-a' }),
      revision({
        fileId: 'file-b',
        revisionId: 'revision-b',
        parentRevisionIds: ['revision-a'],
        kind: 'update',
        createdAt: '2026-09-06T01:00:00.000Z',
      }),
      revision({
        fileId: 'file-c',
        revisionId: 'revision-c',
        parentRevisionIds: ['revision-a'],
        kind: 'update',
        createdAt: '2026-09-06T02:00:00.000Z',
      }),
    ]);

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      quotationId: 'quotation-a',
      revisionId: 'revision-c',
      headRevisionIds: ['revision-b', 'revision-c'],
    });
  });

  it('最新 head 是 delete 時不再顯示該報價單，但不限制其他報價單筆數', () => {
    const history = buildCloudHistoryEntries([
      revision({ quotationId: 'quotation-a', revisionId: 'revision-a' }),
      revision({
        quotationId: 'quotation-a',
        revisionId: 'revision-b',
        parentRevisionIds: ['revision-a'],
        kind: 'delete',
      }),
      revision({
        fileId: 'file-c',
        quotationId: 'quotation-b',
        revisionId: 'revision-c',
      }),
    ]);

    expect(history.map((item) => item.quotationId)).toEqual(['quotation-b']);
  });

  it('重新讀取 Drive metadata 時從檔名還原日期與客戶名稱', () => {
    const history = buildCloudHistoryEntries([
      revision({
        name: '報價單 2026-08-31 Drive雲端測試客戶 revision-a.json',
        createdAt: '2026-09-06T00:00:00.000Z',
      }),
    ]);

    expect(history[0]?.data).toMatchObject({
      customerCompany: 'Drive雲端測試客戶',
      startDate: '2026-08-31',
    });
  });
});
