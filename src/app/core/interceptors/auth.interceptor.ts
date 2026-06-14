import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap, catchError, throwError } from 'rxjs';
import { AuthService } from '@app/core/services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Auth HTTP Interceptor（永久登入版）
 * - 為指向 Portal API 的請求附加 access token 與 x-platform-key
 * - 遇 401 自動用 refresh token 換新並重試一次
 * - /api/auth/* 端點本身不附 token、不做重試（避免遞迴）
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.portalApiUrl)) {
    return next(req);
  }

  const authService = inject(AuthService);

  // 認證端點（exchange/refresh/logout）不附 token、不重試
  if (req.url.includes('/api/auth/')) {
    return next(req);
  }

  const withAuth = (token: string) =>
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}`, 'x-platform-key': 'quotation' },
    });

  return from(authService.getAccessToken()).pipe(
    switchMap((token) => {
      const firstReq = token ? withAuth(token) : req;
      return next(firstReq).pipe(
        catchError((err: HttpErrorResponse) => {
          // 401 且原本有帶 token → 嘗試刷新一次後重試
          if (err.status === 401 && token) {
            return from(authService.refreshTokens()).pipe(
              switchMap((ok) =>
                ok
                  ? from(authService.getAccessToken()).pipe(
                      switchMap((newToken) =>
                        newToken ? next(withAuth(newToken)) : throwError(() => err),
                      ),
                    )
                  : throwError(() => err),
              ),
            );
          }
          return throwError(() => err);
        }),
      );
    }),
  );
};
