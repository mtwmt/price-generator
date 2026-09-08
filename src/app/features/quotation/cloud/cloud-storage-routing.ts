/**
 * 純前端路由決策。會員狀態來自既有登入流程，Drive 連線狀態由瀏覽器記憶體維護；
 * 此函式不接觸 token、localStorage、IndexedDB 或網路。
 */
export interface CloudStorageEligibility {
  readonly isPremium: boolean;
  readonly isAdmin: boolean;
  readonly isCloudSyncEnabled: boolean;
  readonly driveConnection:
    'connected' | 'not-connected' | 'reconnect-required';
}

export type QuotationStorageRoute =
  | {
      readonly repository: 'local-history';
      readonly reason: 'not-premium';
      readonly maxHistoryItems: 5;
      readonly cloudAction: 'none';
    }
  | {
      readonly repository: 'local-history';
      readonly reason: 'drive-not-connected';
      readonly maxHistoryItems: 5;
      readonly cloudAction: 'connect-drive';
    }
  | {
      readonly repository: 'local-history';
      readonly reason: 'cloud-sync-disabled';
      readonly maxHistoryItems: 5;
      readonly cloudAction: 'none';
    }
  | {
      readonly repository: 'local-history';
      readonly reason: 'drive-reconnect-required';
      readonly maxHistoryItems: 5;
      readonly cloudAction: 'reconnect-drive';
    }
  | {
      readonly repository: 'cloud-sync';
      readonly reason: 'premium-drive-connected';
      readonly cloudAction: 'sync';
    };

/**
 * 一般會員一律走既有五筆 localStorage 歷史；贊助會員與管理員可使用 Drive。
 * 尚未連結或需要重新連結時仍保留本機模式，UI 只需顯示相應入口。
 */
export function decideQuotationStorageRoute(
  eligibility: CloudStorageEligibility
): QuotationStorageRoute {
  if (!eligibility.isPremium && !eligibility.isAdmin) {
    return {
      repository: 'local-history',
      reason: 'not-premium',
      maxHistoryItems: 5,
      cloudAction: 'none',
    };
  }

  if (!eligibility.isCloudSyncEnabled) {
    return {
      repository: 'local-history',
      reason: 'cloud-sync-disabled',
      maxHistoryItems: 5,
      cloudAction: 'none',
    };
  }

  if (eligibility.driveConnection === 'connected') {
    return {
      repository: 'cloud-sync',
      reason: 'premium-drive-connected',
      cloudAction: 'sync',
    };
  }

  if (eligibility.driveConnection === 'reconnect-required') {
    return {
      repository: 'local-history',
      reason: 'drive-reconnect-required',
      maxHistoryItems: 5,
      cloudAction: 'reconnect-drive',
    };
  }

  return {
    repository: 'local-history',
    reason: 'drive-not-connected',
    maxHistoryItems: 5,
    cloudAction: 'connect-drive',
  };
}
