const mockDependencies = new Map<unknown, unknown>();

jest.mock('@angular/core', () => ({
  ErrorHandler: class ErrorHandler {},
  Injectable: () => (target: unknown) => target,
  inject: (token: unknown) => mockDependencies.get(token),
}));

jest.mock('./analytics.service', () => ({
  AnalyticsService: class AnalyticsService {},
}));

import { AnalyticsService } from './analytics.service';
import { environment } from '../../../environments/environment';
import { GlobalErrorHandler } from './error-handler.service';

describe('GlobalErrorHandler', () => {
  let analytics: { trackError: jest.Mock };
  let errorHandler: GlobalErrorHandler;
  let consoleError: jest.SpyInstance;
  let originalProduction: boolean;
  let originalLocation: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalProduction = environment.production;
    originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { origin: 'https://mtwmt.com' },
    });
    analytics = { trackError: jest.fn() };
    mockDependencies.clear();
    mockDependencies.set(AnalyticsService, analytics);
    consoleError = jest.spyOn(console, 'error').mockImplementation();
    errorHandler = new GlobalErrorHandler();
  });

  afterEach(() => {
    environment.production = originalProduction;
    if (originalLocation) {
      Object.defineProperty(globalThis, 'location', originalLocation);
    } else {
      Reflect.deleteProperty(globalThis, 'location');
    }
    consoleError.mockRestore();
  });

  it('正式環境只輸出安全的 Angular NG 錯誤碼，不洩漏原始訊息', () => {
    environment.production = true;
    const error = new Error('NG01203: registerOnChange is not a function; 報價：機密客戶，token=secret');

    errorHandler.handleError(error);

    expect(consoleError).toHaveBeenCalledWith('Global error handled:', 'Error | NG01203');
    expect(consoleError.mock.calls.flat()).not.toContain(error.message);
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('機密客戶');
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('token=secret');
    expect(analytics.trackError).toHaveBeenCalledWith(error, 'global');
  });

  it('正式環境對非 Angular 錯誤只輸出固定類型', () => {
    environment.production = true;

    errorHandler.handleError({ message: '客戶資料與 access token 都不應出現在 console' });

    expect(consoleError).toHaveBeenCalledWith('Global error handled:', 'Non-Error value');
  });

  it('正式環境從本站 minified bundle stack 擷取最多三個安全檔名與行列', () => {
    environment.production = true;
    const error = new TypeError('客戶：王小明，token=secret 不可出現在 console');
    Object.defineProperty(error, 'stack', {
      configurable: true,
      value: [
        error.toString(),
        'at external (https://example.com/main-OUTSIDE.js?token=outside:2:3)',
        'at unsafe (https://mtwmt.com/price-generator/app-customer-secret.js:7:6)',
        'at r (https://mtwmt.com/price-generator/main-A1B2.js?token=secret:100:20)',
        'at n (https://mtwmt.com/price-generator/chunk-C3D4.js?customer=王小明:4:8)',
        'at o (https://mtwmt.com/price-generator/polyfills.js:1:2)',
        'at p (https://mtwmt.com/price-generator/runtime.js:8:9)',
      ].join('\n'),
    });

    errorHandler.handleError(error);

    expect(consoleError).toHaveBeenCalledWith(
      'Global error handled:',
      'TypeError | main-A1B2.js:100:20 | chunk-C3D4.js:4:8 | polyfills.js:1:2',
    );
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('token=');
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('王小明');
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('example.com');
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('app-customer-secret.js');
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('runtime.js:8:9');
  });

  it('不再吞掉 registerOnChange 錯誤，仍會診斷與送出追蹤', () => {
    const error = new Error('registerOnChange is not a function');

    errorHandler.handleError(error);

    expect(consoleError).toHaveBeenCalledWith('Global error:', error);
    expect(analytics.trackError).toHaveBeenCalledWith(error, 'global');
  });

  it('Analytics 追蹤失敗時保留原始錯誤的診斷，且不再拋出', () => {
    const error = new Error('application failure');
    const analyticsFailure = new Error('analytics unavailable');
    analytics.trackError.mockImplementation(() => {
      throw analyticsFailure;
    });

    expect(() => errorHandler.handleError(error)).not.toThrow();

    expect(consoleError).toHaveBeenNthCalledWith(1, 'Global error:', error);
    expect(consoleError).toHaveBeenNthCalledWith(
      2,
      'Global error analytics reporting failed:',
      analyticsFailure,
    );
  });
});
