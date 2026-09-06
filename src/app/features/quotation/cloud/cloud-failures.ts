export type DriveFailureCategory =
  | 'auth-reconnect'
  | 'membership'
  | 'rate-limit-retry'
  | 'transient-retry'
  | 'permanent-failure';

export type DriveFailureAction =
  'reconnect' | 'check-membership' | 'retry' | 'report-failure';

/** category 是判別欄位，呼叫端窄化後不會得到互相矛盾的處置旗標。 */
export type DriveFailureClassification =
  | {
      readonly category: 'auth-reconnect';
      readonly action: 'reconnect';
      readonly retryable: false;
      readonly requiresReconnect: true;
      readonly requiresMembership: false;
    }
  | {
      readonly category: 'membership';
      readonly action: 'check-membership';
      readonly retryable: false;
      readonly requiresReconnect: false;
      readonly requiresMembership: true;
    }
  | {
      readonly category: 'rate-limit-retry';
      readonly action: 'retry';
      readonly retryable: true;
      readonly requiresReconnect: false;
      readonly requiresMembership: false;
      readonly retryAfterMs?: number;
    }
  | {
      readonly category: 'transient-retry';
      readonly action: 'retry';
      readonly retryable: true;
      readonly requiresReconnect: false;
      readonly requiresMembership: false;
    }
  | {
      readonly category: 'permanent-failure';
      readonly action: 'report-failure';
      readonly retryable: false;
      readonly requiresReconnect: false;
      readonly requiresMembership: false;
    };

/** 可由 Worker、Google API adapter 或網路層轉成的最小失敗訊號。 */
export interface DriveFailureSignal {
  readonly status?: number;
  readonly code?: string | number;
  readonly reason?: string;
  readonly message?: string;
  readonly name?: string;
  readonly retryAfterMs?: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string');
}

function firstFiniteNumber(...values: unknown[]): number | undefined {
  return values.find(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value)
  );
}

function extractSignal(error: unknown): DriveFailureSignal {
  if (typeof error === 'string') {
    return { message: error };
  }
  if (typeof error === 'number' && Number.isFinite(error)) {
    return { status: error };
  }

  const root = asRecord(error);
  if (!root) {
    return {};
  }

  const response = asRecord(root['response']);
  const nestedError = asRecord(root['error']);
  const errorDetails = Array.isArray(root['errors'])
    ? asRecord(root['errors'][0])
    : null;
  const nestedErrorText =
    typeof root['error'] === 'string' ? root['error'] : undefined;

  return {
    status: firstFiniteNumber(
      root['status'],
      root['statusCode'],
      response?.['status'],
      nestedError?.['status']
    ),
    code:
      firstString(
        root['code'],
        nestedError?.['code'],
        nestedErrorText,
        errorDetails?.['code']
      ) ?? firstFiniteNumber(root['code'], nestedError?.['code']),
    reason: firstString(
      root['reason'],
      nestedError?.['reason'],
      errorDetails?.['reason']
    ),
    message: firstString(
      root['message'],
      nestedError?.['message'],
      errorDetails?.['message']
    ),
    name: firstString(root['name']),
    retryAfterMs: firstFiniteNumber(
      root['retryAfterMs'],
      response?.['retryAfterMs']
    ),
  };
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[.:/]+/g, '_');
}

function hasToken(tokens: readonly string[], ...expected: string[]): boolean {
  return expected.some((value) => tokens.includes(value));
}

function normalizedRetryAfter(value: number | undefined): number | undefined {
  if (value === undefined || value < 0) {
    return undefined;
  }
  return Math.round(value);
}

function authReconnect(): DriveFailureClassification {
  return {
    category: 'auth-reconnect',
    action: 'reconnect',
    retryable: false,
    requiresReconnect: true,
    requiresMembership: false,
  };
}

function membershipRequired(): DriveFailureClassification {
  return {
    category: 'membership',
    action: 'check-membership',
    retryable: false,
    requiresReconnect: false,
    requiresMembership: true,
  };
}

function rateLimitRetry(
  retryAfterMs: number | undefined
): DriveFailureClassification {
  return {
    category: 'rate-limit-retry',
    action: 'retry',
    retryable: true,
    requiresReconnect: false,
    requiresMembership: false,
    ...(normalizedRetryAfter(retryAfterMs) === undefined
      ? {}
      : { retryAfterMs: normalizedRetryAfter(retryAfterMs) }),
  };
}

function transientRetry(): DriveFailureClassification {
  return {
    category: 'transient-retry',
    action: 'retry',
    retryable: true,
    requiresReconnect: false,
    requiresMembership: false,
  };
}

function permanentFailure(): DriveFailureClassification {
  return {
    category: 'permanent-failure',
    action: 'report-failure',
    retryable: false,
    requiresReconnect: false,
    requiresMembership: false,
  };
}

/**
 * 將 Drive／Worker 失敗分成可行動類別。
 * 特別保留 403 的原因：權限、會員資格、限流與容量不能共用同一 retry 路徑。
 */
export function classifyDriveFailure(
  error: unknown
): DriveFailureClassification {
  const signal = extractSignal(error);
  const tokens = [signal.reason, signal.code]
    .filter((value): value is string | number => value !== undefined)
    .map((value) => normalizeToken(String(value)));
  const message = (signal.message ?? '').toLowerCase();
  const name = normalizeToken(signal.name ?? '');

  if (
    hasToken(
      tokens,
      'invalid_grant',
      'unauthorized',
      'unauthenticated',
      'auth_required',
      'token_expired',
      'access_revoked',
      'drive_access_revoked',
      'insufficient_permissions',
      'insufficientpermissions'
    ) ||
    /invalid[ _-]?grant|token expired|access revoked/.test(message) ||
    signal.status === 401
  ) {
    return authReconnect();
  }

  if (
    hasToken(
      tokens,
      'membership_required',
      'sponsor_required',
      'premium_required',
      'not_a_sponsor',
      'membershiprequired'
    )
  ) {
    return membershipRequired();
  }

  if (
    hasToken(
      tokens,
      'storage_quota_exceeded',
      'storagequotaexceeded',
      'quota_exceeded',
      'quotaexceeded'
    ) ||
    /storage quota|quota exceeded|insufficient storage/.test(message)
  ) {
    return permanentFailure();
  }

  if (
    hasToken(
      tokens,
      'rate_limit_exceeded',
      'ratelimitexceeded',
      'user_rate_limit_exceeded',
      'userratelimitexceeded',
      'daily_limit_exceeded',
      'dailylimitexceeded'
    ) ||
    signal.status === 429
  ) {
    return rateLimitRetry(signal.retryAfterMs);
  }

  if (
    hasToken(
      tokens,
      'service_unavailable',
      'serviceunavailable',
      'backend_unavailable',
      'timeout',
      'network_error',
      'networkerror',
      'temporarily_unavailable'
    ) ||
    [408, 500, 502, 503, 504].includes(signal.status ?? -1) ||
    /fetch failed|network error|timed out|temporarily unavailable/.test(
      message
    ) ||
    name === 'networkerror'
  ) {
    return transientRetry();
  }

  // 未知 403 一律保守視為永久失敗，不能因 status 403 就盲目重試。
  return permanentFailure();
}
