import { decideQuotationStorageRoute } from './cloud-storage-routing';

describe('報價單儲存路由決策', () => {
  it('非贊助會員即使曾連結 Drive 也維持既有五筆 localStorage 歷史', () => {
    expect(
      decideQuotationStorageRoute({
        isPremium: false,
        driveConnection: 'connected',
      })
    ).toEqual({
      repository: 'local-history',
      reason: 'not-premium',
      maxHistoryItems: 5,
      cloudAction: 'none',
    });
  });

  it('已連結 Drive 的贊助會員才路由到雲端同步', () => {
    expect(
      decideQuotationStorageRoute({
        isPremium: true,
        driveConnection: 'connected',
      })
    ).toEqual({
      repository: 'cloud-sync',
      reason: 'premium-drive-connected',
      cloudAction: 'sync',
    });
  });

  it('贊助會員尚未連結或需重新連結時保留本機模式並指示正確動作', () => {
    expect(
      decideQuotationStorageRoute({
        isPremium: true,
        driveConnection: 'not-connected',
      })
    ).toMatchObject({
      repository: 'local-history',
      reason: 'drive-not-connected',
      cloudAction: 'connect-drive',
    });
    expect(
      decideQuotationStorageRoute({
        isPremium: true,
        driveConnection: 'reconnect-required',
      })
    ).toMatchObject({
      repository: 'local-history',
      reason: 'drive-reconnect-required',
      cloudAction: 'reconnect-drive',
    });
  });
});
