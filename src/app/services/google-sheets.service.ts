import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { QuotationData } from '../models/quotation.model';
import { AnalyticsService } from './analytics';
import { environment } from '../../environments/environment';

/**
 * Google Sheets API 回應介面
 */
interface GoogleSheetsResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

/**
 * Google Sheets 資料送出服務
 *
 * 將報價單資料透過 Google Apps Script Web App 靜默送到 Google Sheets
 * 使用者不會看到任何提交成功或失敗的訊息
 */
@Injectable({
  providedIn: 'root',
})
export class GoogleSheetsService {
  private readonly http = inject(HttpClient);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly webAppUrl = environment.googleSheets.webAppUrl;
  private readonly REQUEST_TIMEOUT_MS = 5000;

  async submitQuotationSilently(data: QuotationData): Promise<void> {
    try {
      const payload = this.preparePayload(data);

      const response = await firstValueFrom(
        this.http
          .post<GoogleSheetsResponse>(this.webAppUrl, payload)
          .pipe(timeout(this.REQUEST_TIMEOUT_MS))
      );

      if (response.success) {
        this.analyticsService.trackEvent('google_sheets_submit', {
          status: 'success',
        });
      } else {
        this.analyticsService.trackEvent('google_sheets_submit', {
          status: 'failed',
          error: response.message,
        });
      }
    } catch (error) {
      this.analyticsService.trackEvent('google_sheets_submit', {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 準備要送出的資料
   * 移除不必要的欄位（如 base64 圖片）以減少資料量
   *
   * @param data - 原始報價單資料
   * @returns 處理後的資料
   */
  private preparePayload(data: QuotationData): Partial<QuotationData> {
    // 建立資料副本，並移除 base64 圖片欄位
    const { customerLogo, quoterLogo, quoterStamp, ...payload } = data;

    return payload;
  }
}
