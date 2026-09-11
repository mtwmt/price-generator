import { ErrorHandler, Injectable, inject } from '@angular/core';
import { AnalyticsService } from './analytics.service';
import { environment } from '../../../environments/environment';

/**
 * 全域錯誤處理器
 *
 * 職責：
 * - 捕捉應用程式中未處理的錯誤
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
  handleError(error: unknown): void {
    // 開發時保留原始錯誤，方便追查；正式環境只輸出固定、安全的診斷資訊，
    // 避免報價內容、權杖或其他例外訊息進入使用者可見的 console。
    if (!environment.production) {
      console.error('Global error:', error);
    } else {
      console.error('Global error handled:', this.getProductionDiagnostic(error));
    }

    // Analytics 不能讓原始例外的診斷消失，也不能讓 ErrorHandler 再次拋錯造成遞迴。
    try {
      this.analytics.trackError(error as Error, 'global');
    } catch (analyticsError) {
      if (!environment.production) {
        console.error('Global error analytics reporting failed:', analyticsError);
      } else {
        console.error('Global error analytics reporting failed.');
      }
    }
  }

  private getProductionDiagnostic(error: unknown): string {
    const diagnostics = [this.getSafeErrorType(error)];
    const angularErrorCode = this.getAngularErrorCode(error);
    if (angularErrorCode) {
      diagnostics.push(angularErrorCode);
    }

    diagnostics.push(...this.getSafeStackLocations(error));
    return diagnostics.join(' | ');
  }

  private getAngularErrorCode(error: unknown): string | undefined {
    try {
      const message = error instanceof Error || typeof error === 'string'
        ? error.toString()
        : '';
      const match = /\bNG(\d{3,6})\b/.exec(message);
      return match ? `NG${match[1]}` : undefined;
    } catch {
      // 例外物件可能有會拋錯的 toString；正式環境一律不嘗試輸出其內容。
      return undefined;
    }
  }

  private getSafeErrorType(error: unknown): string {
    if (error instanceof TypeError) {
      return 'TypeError';
    }
    if (error instanceof RangeError) {
      return 'RangeError';
    }
    if (error instanceof ReferenceError) {
      return 'ReferenceError';
    }
    if (error instanceof SyntaxError) {
      return 'SyntaxError';
    }

    return error instanceof Error ? 'Error' : 'Non-Error value';
  }

  private getSafeStackLocations(error: unknown): string[] {
    if (!(error instanceof Error)) {
      return [];
    }

    try {
      const stack = error.stack;
      if (!stack) {
        return [];
      }

      const appOrigin = typeof location === 'undefined' ? undefined : location.origin;
      const locations = new Set<string>();
      const stackLines = stack.split('\n').slice(1);

      for (const stackLine of stackLines) {
        const match = /((?:https?:\/\/[^\s()]+?\.js(?:\?[^\s()]*)?|\/[^\s()]+?\.js(?:\?[^\s()]*)?|[A-Za-z0-9_.-]+\.js)):(\d+):(\d+)/.exec(stackLine);
        if (!match) {
          continue;
        }

        const filename = this.getBundleFilename(match[1], appOrigin);
        if (filename) {
          locations.add(`${filename}:${match[2]}:${match[3]}`);
        }
        if (locations.size === 3) {
          break;
        }
      }

      return [...locations];
    } catch {
      // stack 也可能來自自訂例外；不能因取診斷資訊而讓 ErrorHandler 失敗。
      return [];
    }
  }

  private getBundleFilename(source: string, appOrigin: string | undefined): string | undefined {
    try {
      if (source.startsWith('http')) {
        const url = new URL(source);
        if (!appOrigin || url.origin !== appOrigin) {
          return undefined;
        }
        return this.getSafeFilename(url.pathname);
      }

      if (source.startsWith('/')) {
        if (!appOrigin) {
          return undefined;
        }
        return this.getSafeFilename(new URL(source, appOrigin).pathname);
      }

      // 沒有來源路徑的檔名無法驗證是否屬於本站，避免把第三方 stack 誤列為診斷資訊。
      return undefined;
    } catch {
      return undefined;
    }
  }

  private getSafeFilename(path: string): string | undefined {
    const filename = path.split('/').pop();
    // 只接受 Angular 建置會產生的入口／chunk 檔名，勿把帶有使用者資料的任意檔名輸出。
    return filename && /^(?:main|polyfills|chunk)(?:-[A-Za-z0-9_-]+)?\.js$/.test(filename)
      ? filename
      : undefined;
  }
}
