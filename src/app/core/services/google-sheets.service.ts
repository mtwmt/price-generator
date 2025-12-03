import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { QuotationData } from '@app/features/quotation/models/quotation.model';
import { AnalyticsService } from '@app/core/services/analytics.service';
import { environment } from 'src/environments/environment';

interface GoogleSheetsResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class GoogleSheetsService {
  private readonly http = inject(HttpClient);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly webAppUrl = environment.googleSheets.webAppUrl;
  private readonly REQUEST_TIMEOUT_MS = 5000;

  async submitQuotationSilently(
    data: QuotationData,
    exportMethod: string,
    templateStyle: string
  ): Promise<void> {
    try {
      // 偵測裝置類型
      const deviceType = this.getDeviceType();

      const exportInfo = `${templateStyle} - ${exportMethod} - ${deviceType}`;

      const payload = {
        ...this.preparePayload(data),
        exportMethod: exportInfo,
      };
      const params = new URLSearchParams({
        data: JSON.stringify(payload),
      });

      const response = await firstValueFrom(
        this.http
          .get<GoogleSheetsResponse>(`${this.webAppUrl}?${params.toString()}`)
          .pipe(timeout(this.REQUEST_TIMEOUT_MS))
      );

      if (response.success) {
        this.analyticsService.trackEvent('sheets_submit', {
          status: 'success',
        });
      } else {
        this.analyticsService.trackEvent('sheets_submit', {
          status: 'failed',
          error: response.message,
        });
      }
    } catch (error) {
      this.analyticsService.trackEvent('sheets_submit', {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private preparePayload(data: QuotationData): Partial<QuotationData> {
    const { customerLogo, quoterLogo, quoterStamp, ...payload } = data;
    return payload;
  }

  private getDeviceType(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile =
      /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent
      );
    return isMobile ? '行動版' : '桌面版';
  }
}
