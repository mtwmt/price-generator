import {
  MAX_TEMPLATE_OPERATION_BYTES,
  TemplateOperation,
  createTemplateOperation,
  mergeTemplateOperations,
  validateTemplateOperation,
  validateTemplateValue,
} from './template-sync-domain';

const owner = 'firebase uid / accepted as-is';

function operationInput(overrides: Partial<Omit<TemplateOperation, 'schemaVersion' | 'contentHash'>> = {}): Omit<TemplateOperation, 'schemaVersion' | 'contentHash'> {
  return {
    ownerSub: owner,
    resourceKind: 'customers',
    entityId: 'legacy customer / 1',
    revisionId: 'revision-1',
    operationId: 'operation-1',
    parentRevisionIds: [],
    action: 'put',
    value: { id: 'legacy customer / 1', name: '窗口', customerCompany: '合成公司' },
    createdAt: '2026-09-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('template sync domain', () => {
  it('建立後可驗證，canonical hash 不受 parent 輸入順序影響', async () => {
    const op = await createTemplateOperation(operationInput({
      revisionId: 'revision-3',
      parentRevisionIds: ['revision-2', 'revision-1'],
    }));
    expect(op.parentRevisionIds).toEqual(['revision-1', 'revision-2']);
    await expect(validateTemplateOperation(JSON.parse(JSON.stringify(op)), owner)).resolves.toEqual(op);
    await expect(validateTemplateOperation({ ...op, parentRevisionIds: ['revision-2', 'revision-1'] }, owner)).resolves.toEqual(op);
  });

  it('保留並行修改與刪除 tombstone，後繼可涵蓋所有衝突分支', async () => {
    const root = await createTemplateOperation(operationInput());
    const changed = await createTemplateOperation(operationInput({ revisionId: 'revision-2', operationId: 'operation-2', parentRevisionIds: [root.revisionId], value: { id: root.entityId, name: '新名稱', customerCompany: '合成公司' } }));
    const deleted = await createTemplateOperation(operationInput({ revisionId: 'revision-3', operationId: 'operation-3', parentRevisionIds: [root.revisionId], action: 'delete', value: null }));
    expect(mergeTemplateOperations([root, changed, deleted], owner)[0]?.heads.map((head) => head.revisionId)).toEqual(['revision-2', 'revision-3']);

    const resolved = await createTemplateOperation(operationInput({ revisionId: 'revision-4', operationId: 'operation-4', parentRevisionIds: [deleted.revisionId, changed.revisionId], value: { id: root.entityId, name: '已解決', customerCompany: '合成公司' } }));
    expect(mergeTemplateOperations([root, changed, deleted, resolved], owner)[0]?.heads.map((head) => head.revisionId)).toEqual(['revision-4']);
  });

  it('同一操作可折疊，重複 identity 不同內容會拒絕', async () => {
    const first = await createTemplateOperation(operationInput());
    expect(mergeTemplateOperations([first, first], owner)[0]?.heads).toEqual([first]);
    const forged = { ...first, value: { id: first.entityId, name: '遭改寫', customerCompany: '合成公司' } };
    expect(() => mergeTemplateOperations([first, forged], owner)).toThrow('不同內容');
  });

  it('拒絕缺少或跨實體父節點、循環與跨帳號操作', async () => {
    const first = await createTemplateOperation(operationInput());
    const missing = await createTemplateOperation(operationInput({ revisionId: 'revision-2', operationId: 'operation-2', parentRevisionIds: ['not-here'] }));
    expect(() => mergeTemplateOperations([first, missing], owner)).toThrow('缺少父版本');
    const other = await createTemplateOperation(operationInput({ entityId: 'other', revisionId: 'revision-3', operationId: 'operation-3', value: { id: 'other', name: '另一筆', customerCompany: '合成公司' } }));
    const cross = await createTemplateOperation(operationInput({ revisionId: 'revision-4', operationId: 'operation-4', parentRevisionIds: [other.revisionId] }));
    expect(() => mergeTemplateOperations([other, cross], owner)).toThrow('其他帳號或其他實體');
    const cycleA = await createTemplateOperation(operationInput({ revisionId: 'cycle-a', operationId: 'cycle-operation-a', parentRevisionIds: ['cycle-b'] }));
    const cycleB = await createTemplateOperation(operationInput({ revisionId: 'cycle-b', operationId: 'cycle-operation-b', parentRevisionIds: ['cycle-a'] }));
    expect(() => mergeTemplateOperations([cycleA, cycleB], owner)).toThrow('循環');
    expect(() => mergeTemplateOperations([first], 'other owner')).toThrow('目前帳號');
  });

  it('拒絕錯誤 hash、未知 schema、delete/put 不合規與超大內容', async () => {
    const first = await createTemplateOperation(operationInput());
    await expect(validateTemplateOperation({ ...first, contentHash: '0'.repeat(64) }, owner)).rejects.toThrow('不一致');
    await expect(validateTemplateOperation({ ...first, schemaVersion: 2 }, owner)).rejects.toThrow('不支援');
    await expect(createTemplateOperation(operationInput({ action: 'delete', value: operationInput().value }))).rejects.toThrow('必須為 null');
    await expect(createTemplateOperation(operationInput({ value: null }))).rejects.toThrow('不可為 null');
    await expect(createTemplateOperation(operationInput({ value: { id: 'legacy customer / 1', name: 'x'.repeat(MAX_TEMPLATE_OPERATION_BYTES), customerCompany: '合成公司' } }))).rejects.toThrow(/長度超過|大小不可超過/);
  });

  it('模型欄位採嚴格白名單，客戶與服務項目的必要文字和價格都會驗證', () => {
    expect(validateTemplateValue('customers', { id: 'old id', name: '名稱', customerCompany: '公司', unexpected: true })).toBe(false);
    expect(validateTemplateValue('customers', { id: 'old id', name: ' ', customerCompany: '公司' })).toBe(false);
    expect(validateTemplateValue('service-items', { id: 'service-1', name: '設計', item: '網站設計', price: 0, category: '設計' })).toBe(true);
    expect(validateTemplateValue('service-items', { id: 'service-1', name: '設計', item: '網站設計', price: -1 })).toBe(false);
    expect(validateTemplateValue('service-items', { id: 'service-1', name: '設計', item: '網站設計', price: Number.NaN })).toBe(false);
  });
});
