import { classifyDriveFailure } from './cloud-failures';

describe('Drive 失敗分類', () => {
  it('invalid_grant 應要求重新連結，不得一般重試', () => {
    expect(
      classifyDriveFailure({ status: 400, reason: 'invalid_grant' })
    ).toEqual({
      category: 'auth-reconnect',
      action: 'reconnect',
      retryable: false,
      requiresReconnect: true,
      requiresMembership: false,
    });
  });

  it('會員資格不足應停同步並指向會員狀態', () => {
    expect(
      classifyDriveFailure({ status: 403, reason: 'membership_required' })
    ).toMatchObject({
      category: 'membership',
      action: 'check-membership',
      retryable: false,
      requiresMembership: true,
    });
  });

  it('429 限流應可重試並保留 Retry-After', () => {
    expect(
      classifyDriveFailure({
        status: 429,
        reason: 'rateLimitExceeded',
        retryAfterMs: 1250,
      })
    ).toEqual({
      category: 'rate-limit-retry',
      action: 'retry',
      retryable: true,
      requiresReconnect: false,
      requiresMembership: false,
      retryAfterMs: 1250,
    });
  });

  it('網路／服務暫時故障可重試', () => {
    expect(classifyDriveFailure({ status: 503 })).toMatchObject({
      category: 'transient-retry',
      action: 'retry',
      retryable: true,
    });
  });

  it('403 容量不足與未知 403 都不得當成一般 retry', () => {
    expect(
      classifyDriveFailure({ status: 403, reason: 'storageQuotaExceeded' })
    ).toMatchObject({
      category: 'permanent-failure',
      retryable: false,
    });
    expect(classifyDriveFailure({ status: 403 })).toMatchObject({
      category: 'permanent-failure',
      retryable: false,
    });
  });
});
