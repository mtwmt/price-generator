const dependencies = new Map<unknown, unknown>();

jest.mock('@angular/core', () => ({
  Injectable: () => (target: unknown) => target,
  inject: (token: unknown) => dependencies.get(token),
}));
jest.mock('@angular/common/http', () => {
  class HttpClient {}
  class HttpHeaders {
    constructor(readonly values: Record<string, string>) {}
  }
  class HttpErrorResponse extends Error {
    constructor(readonly init: { status: number; error?: unknown }) { super('http'); }
    get status(): number { return this.init.status; }
    get error(): unknown { return this.init.error; }
  }
  return { HttpClient, HttpHeaders, HttpErrorResponse };
});
jest.mock('../../../../environments/environment', () => ({
  environment: { portalApiUrl: 'https://portal.example.test' },
}));

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import {
  DriveAuthorizationApiService,
  DriveAuthorizationBrokerError,
} from './drive-authorization-api.service';

describe('DriveAuthorizationApiService', () => {
  const http = { post: jest.fn() };

  beforeEach(() => {
    dependencies.clear();
    dependencies.set(HttpClient, http);
    http.post.mockReset();
  });

  it('以受 interceptor 保護的 HTTP 呼叫 connect，且不保存 token', async () => {
    http.post.mockReturnValue(of({ accessToken: 'token', expiresIn: 3600, email: 'member@example.com', ownerId: 'uid-1' }));
    const result = await new DriveAuthorizationApiService().connect('code');
    expect(result.accessToken).toBe('token');
    expect(http.post).toHaveBeenCalledWith(
      'https://portal.example.test/api/drive-auth/connect',
      { code: 'code' },
      expect.objectContaining({ headers: expect.anything() })
    );
    expect(http.post.mock.calls[0][2].headers.values).toEqual({
      'X-Requested-With': 'XMLHttpRequest',
    });
  });

  it.each([
    [409, 'drive_not_connected', 'not_connected'],
    [503, 'drive_configuration_error', 'configuration'],
    [503, 'drive_temporarily_unavailable', 'temporarily_unavailable'],
    [403, 'drive_forbidden', 'forbidden'],
    [403, 'drive_scope_not_granted', 'scope_not_granted'],
  ])('將 %s/%s 映射為安全錯誤', async (status, error, failure) => {
    http.post.mockReturnValue(throwError(() => new HttpErrorResponse({ status, error: { error } })));
    await expect(new DriveAuthorizationApiService().token()).rejects.toEqual(
      expect.objectContaining({ failure, status })
    );
  });

  it('拒絕格式不正確的 token 回應', async () => {
    http.post.mockReturnValue(of({ accessToken: 'token' }));
    await expect(new DriveAuthorizationApiService().token()).rejects.toEqual(
      expect.objectContaining({ failure: 'invalid_response' })
    );
    expect(DriveAuthorizationBrokerError).toBeDefined();
  });
});
