/**
 * 純前端路由決策。會員與 Drive 連線狀態必須由 Worker 回應提供；
 * 此函式不接觸 token、localStorage、IndexedDB 或網路。
 */
export interface CloudStorageEligibility {
  readonly isPremium: boolean;
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
      readonly reason: 'drive-reconnect-required';
      readonly maxHistoryItems: 5;
      readonly cloudAction: 'reconnect-drive';
    }
  | {
      readonly repository: 'cloud-sync';
      readonly reason: 'premium-drive-connected';
      readonly localDraftStore: 'indexeddb-adapter';
      readonly cloudAction: 'sync';
    };

/**
 * 非贊助會員一律走既有五筆 localStorage 歷史；不因這項功能而要求 Drive 授權。
 * 贊助會員尚未連結或需要重新連結時仍保留本機模式，UI 只需顯示相應入口。
 */
export function decideQuotationStorageRoute(
  eligibility: CloudStorageEligibility
): QuotationStorageRoute {
  if (!eligibility.isPremium) {
    return {
      repository: 'local-history',
      reason: 'not-premium',
      maxHistoryItems: 5,
      cloudAction: 'none',
    };
  }

  if (eligibility.driveConnection === 'connected') {
    return {
      repository: 'cloud-sync',
      reason: 'premium-drive-connected',
      localDraftStore: 'indexeddb-adapter',
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
