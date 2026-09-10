import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  withInterceptors,
  withXhr,
} from '@angular/common/http';
import { authInterceptor } from '@app/core/interceptors/auth.interceptor';
import { routes } from './app.routes';
import { AuthService } from '@app/core/services/auth.service';
import { GlobalErrorHandler } from '@app/core/services/error-handler.service';
import { GOOGLE_ID_TOKEN_LOGIN_ENABLED } from '@app/core/config/auth.config';

/**
 * Auth 初始化工廠函數
 * 在應用程式啟動時初始化 Google OAuth 2.0 認證
 */
async function initializeAuthApp(): Promise<void> {
  const authService = inject(AuthService);
  await authService.initializeAuth();
}

export const appConfig: ApplicationConfig = {
  providers: [
    // 後端 /api/auth/google/login 已發布；改回 false 可回退舊登入入口。
    { provide: GOOGLE_ID_TOKEN_LOGIN_ENABLED, useValue: true },
    provideRouter(routes),
    // Angular 22 保留 XHR backend，維持既有檔案上傳流程的相容性。
    provideHttpClient(withXhr(), withInterceptors([authInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    // OAuth 初始化 - 使用 provideAppInitializer (Angular 19+ 推薦方式)
    provideAppInitializer(initializeAuthApp),
  ],
};
