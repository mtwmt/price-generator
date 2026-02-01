import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { initializeApp } from 'firebase/app';
import { routes } from './app.routes';
import { AuthService } from '@app/core/services/auth.service';
import { GlobalErrorHandler } from '@app/core/services/error-handler.service';
import { environment } from 'src/environments/environment';

/**
 * Firebase 初始化工廠函數
 * 在應用程式啟動時初始化 Firebase App 和 Auth（用於 Google 登入）
 */
function initializeFirebaseApp(): void {
  const authService = inject(AuthService);

  try {
    // 初始化 Firebase App（僅用於 Auth）
    initializeApp(environment.firebase);

    // 初始化 Auth Service
    authService.initializeAuth();
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    throw error;
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    // Firebase 初始化 - 使用 provideAppInitializer (Angular 19+ 推薦方式)
    provideAppInitializer(initializeFirebaseApp),
  ],
};
