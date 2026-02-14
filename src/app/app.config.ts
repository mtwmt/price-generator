import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';
import { AuthService } from '@app/core/services/auth.service';
import { GlobalErrorHandler } from '@app/core/services/error-handler.service';

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
    provideRouter(routes),
    provideHttpClient(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    // OAuth 初始化 - 使用 provideAppInitializer (Angular 19+ 推薦方式)
    provideAppInitializer(initializeAuthApp),
  ],
};
