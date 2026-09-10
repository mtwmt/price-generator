import { prependHistoryCopy } from './quotation-history-copy';

describe('prependHistoryCopy', () => {
  it('未達上限時將複製項目新增到最前面', () => {
    expect(prependHistoryCopy(['A', 'B'], 'A-copy', 0, 5)).toEqual([
      'A-copy',
      'A',
      'B',
    ]);
  });

  it('已達上限且複製最舊一筆時，保留原紀錄並汰除其他舊紀錄', () => {
    expect(
      prependHistoryCopy(['A', 'B', 'C', 'D', 'E'], 'E-copy', 4, 5)
    ).toEqual(['E-copy', 'A', 'B', 'C', 'E']);
  });

  it('來源索引無效時沿用一般新增的汰舊邏輯', () => {
    expect(prependHistoryCopy(['A', 'B', 'C'], 'new', -1, 3)).toEqual([
      'new',
      'A',
      'B',
    ]);
  });
});
