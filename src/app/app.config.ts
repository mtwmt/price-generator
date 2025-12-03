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
import { FirestoreService } from '@app/core/services/firestore.service';
import { GlobalErrorHandler } from '@app/core/services/error-handler.service';
import { environment } from '../environments/environment.dev';

/**
 * Firebase 初始化工廠函數
 * 在應用程式啟動時初始化 Firebase、Firestore 和 Auth
 */
function initializeFirebaseApp(): void {
  const authService = inject(AuthService);
  const firestoreService = inject(FirestoreService);

  try {
    // 初始化 Firebase App
    initializeApp(environment.firebase);

    // 初始化 Firestore
    firestoreService.initializeFirestore();

    // 初始化 Auth Service
    authService.initializeAuth();
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    throw error; // 重新拋出錯誤，讓應用程式知道初始化失敗
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
