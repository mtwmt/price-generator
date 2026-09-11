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
    // 維持原本的按鈕與授權碼登入：只有使用者按下登入才載入 Google 元件。
    // 這避免未登入首頁在載入時引入 Google Identity 的外部樣式與 CSP 相依。
    { provide: GOOGLE_ID_TOKEN_LOGIN_ENABLED, useValue: false },
    provideRouter(routes),
    // Angular 22 保留 XHR backend，維持既有檔案上傳流程的相容性。
    provideHttpClient(withXhr(), withInterceptors([authInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    // OAuth 初始化 - 使用 provideAppInitializer (Angular 19+ 推薦方式)
    provideAppInitializer(initializeAuthApp),
  ],
};
