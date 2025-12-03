import { ErrorHandler, Injectable, inject } from '@angular/core';
import { AnalyticsService } from './analytics.service';

/**
 * 全域錯誤處理器
 *
 * 職責：
 * - 捕捉應用程式中未處理的錯誤
 * - 過濾已知的無害錯誤（如 Angular 19 的 ControlValueAccessor 問題）
 * - 將錯誤發送到 Analytics 服務進行追蹤
 *
 * @example
 * // 在 app.config.ts 中使用
 * { provide: ErrorHandler, useClass: GlobalErrorHandler }
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private analytics = inject(AnalyticsService);

  /**
   * 處理全域錯誤
   *
   * @param error 錯誤物件或訊息
   */
  handleError(error: any): void {
    // 過濾 Angular 19 在處理自訂 ControlValueAccessor 時的已知問題
    // 這個錯誤不影響功能，可以安全忽略
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('registerOnChange is not a function')) {
      return;
    }

    // 記錄錯誤到 console
    console.error('Global error:', error);

    // 發送錯誤到 Analytics 進行追蹤
    this.analytics.trackError(error, 'global');
  }
}
