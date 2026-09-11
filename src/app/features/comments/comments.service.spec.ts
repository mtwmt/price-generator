const dependencies = new Map<unknown, unknown>();

jest.mock('@angular/core', () => ({
  Injectable: () => (target: unknown) => target,
  inject: (token: unknown) => dependencies.get(token),
}));

jest.mock('@angular/common/http', () => ({
  HttpClient: class HttpClient {},
}));

jest.mock('@app/core/services/auth.service', () => ({
  AuthService: class AuthService {},
}), { virtual: true });

jest.mock('src/environments/environment', () => ({
  environment: { googleSheets: { commentsUrl: 'https://comments.example.test' } },
}), { virtual: true });

import { HttpClient } from '@angular/common/http';
import { AuthService } from '@app/core/services/auth.service';
import { NEVER, firstValueFrom, of } from 'rxjs';
import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  const http = { get: jest.fn() };

  beforeEach(() => {
    dependencies.clear();
    dependencies.set(HttpClient, http);
    dependencies.set(AuthService, {});
    http.get.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('留言讀取超過 12 秒時回傳可理解的逾時錯誤', async () => {
    jest.useFakeTimers();
    http.get.mockReturnValue(NEVER);
    const service = new CommentsService();

    const result = firstValueFrom(service.fetchComments('/price-generator/'));
    const expectation = expect(result).rejects.toThrow(
      '留言載入逾時，請檢查網路後再重試'
    );
    await jest.advanceTimersByTimeAsync(12_000);

    await expectation;
  });

  it('成功讀取時回傳留言，且不改寫回應資料', async () => {
    const response = {
      success: true,
      message: '',
      timestamp: '2026-09-11T00:00:00.000Z',
      data: [],
    };
    http.get.mockReturnValue(of(response));
    const service = new CommentsService();

    await expect(firstValueFrom(service.fetchComments('/price-generator/'))).resolves.toEqual(
      []
    );
  });
});
