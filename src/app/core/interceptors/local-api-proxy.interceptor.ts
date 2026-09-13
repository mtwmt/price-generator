import { isDevMode } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from 'src/environments/environment';

// Keep this target in sync with proxy.conf.json. Other configured APIs, including
// synthetic test backends, must never be redirected to this server.
const PROXY_TARGET = 'https://quotation-api.mandy-94b.workers.dev';

export function localApiProxyUrl(
  url: string,
  configuredApi: string,
  hostname: string,
  development: boolean,
): string {
  if (!development || !['localhost', '127.0.0.1', '[::1]'].includes(hostname)) return url;
  if (configuredApi.replace(/\/$/, '') !== PROXY_TARGET) return url;
  if (!url.startsWith(`${PROXY_TARGET}/api/`)) return url;
  return `/__portal${url.slice(PROXY_TARGET.length)}`;
}

/** Run after authInterceptor so its original API matching and headers stay intact. */
export const localApiProxyInterceptor: HttpInterceptorFn = (req, next) => {
  const url = localApiProxyUrl(
    req.url,
    environment.portalApiUrl,
    typeof location === 'undefined' ? '' : location.hostname,
    isDevMode(),
  );
  return next(url === req.url ? req : req.clone({ url }));
};
