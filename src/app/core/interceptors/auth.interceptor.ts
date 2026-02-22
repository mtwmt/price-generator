import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '@app/core/services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Auth HTTP Interceptor
 * 自動為指向 Portal API 的請求附加 Authorization 與 x-platform-key headers
 * 若 token 不存在則直接放行（不阻擋未認證的請求）
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // 僅攔截指向 Portal API 的請求
  if (!req.url.startsWith(environment.portalApiUrl)) {
    return next(req);
  }

  const authService = inject(AuthService);

  return from(authService.getIdToken()).pipe(
    switchMap((token) => {
      // 無 token 時直接放行
      if (!token) {
        return next(req);
      }

      // 附加認證 headers
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
          'x-platform-key': 'quotation',
        },
      });

      return next(authReq);
    }),
  );
};
