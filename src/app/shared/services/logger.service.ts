import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * 日誌服務
 * 僅在非正式環境輸出日誌，避免生產環境洩漏除錯資訊
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  warn(message: string, ...args: unknown[]): void {
    if (!environment.production) {
      console.warn(message, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (!environment.production) {
      console.error(message, ...args);
    }
  }

  log(message: string, ...args: unknown[]): void {
    if (!environment.production) {
      console.log(message, ...args);
    }
  }
}
