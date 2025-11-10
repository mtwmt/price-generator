import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { QuotationData } from '../models/quotation.model';
import { AnalyticsService } from './analytics';
import { environment } from '../../environments/environment';

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
    exportMethod: string
  ): Promise<void> {
    try {
      const payload = { ...this.preparePayload(data), exportMethod };
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
}
