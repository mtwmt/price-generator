jest.mock('@angular/core', () => ({ isDevMode: () => true }));
jest.mock('@angular/common/http', () => ({}));
jest.mock('src/environments/environment', () => ({
  environment: { portalApiUrl: 'https://quotation-api.mandy-94b.workers.dev' },
}), { virtual: true });

import { localApiProxyUrl } from './local-api-proxy.interceptor';

const api = 'https://quotation-api.mandy-94b.workers.dev';

describe('local development API routing', () => {
  it.each(['localhost', '127.0.0.1', '[::1]'])('proxies only the configured API on %s', (host) => {
    expect(localApiProxyUrl(`${api}/api/auth/google/exchange`, api, host, true))
      .toBe('/__portal/api/auth/google/exchange');
    expect(localApiProxyUrl(`${api}/api/portal/user/me?view=full`, api, host, true))
      .toBe('/__portal/api/portal/user/me?view=full');
    expect(localApiProxyUrl(`${api}/api/drive-auth/token`, api, host, true))
      .toBe('/__portal/api/drive-auth/token');
  });

  it('preserves production builds and non-local hosts', () => {
    const url = `${api}/api/auth/google/exchange`;
    expect(localApiProxyUrl(url, api, 'localhost', false)).toBe(url);
    expect(localApiProxyUrl(url, api, 'mtwmt.com', true)).toBe(url);
  });

  it('never redirects another backend, another origin or non-API URLs', () => {
    const url = `${api}/api/auth/google/exchange`;
    expect(localApiProxyUrl(url, 'https://synthetic.example.test', 'localhost', true)).toBe(url);
    for (const other of ['https://www.googleapis.com/drive/v3/files', `${api}.example.test/api/auth`, `${api}/assets/logo.png`, '/api/local']) {
      expect(localApiProxyUrl(other, api, 'localhost', true)).toBe(other);
    }
  });
});
