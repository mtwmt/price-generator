import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DonationRequestDTO } from '@app/features/user/user.model';

/**
 * DonationApiService - Repository Pattern (Transport Layer)
 * 職責：負責使用者側贊助申請相關的網路傳輸作業。
 * 認證 headers 由 authInterceptor 自動附加。
 */
@Injectable({
  providedIn: 'root',
})
export class DonationApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.portalApiUrl}/api/portal/user/donations`;

  /**
   * 提交新的贊助申請
   */
  submitDonation(data: {
    note: string;
    proof: string;
  }): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(this.apiUrl, data);
  }

  /**
   * 獲取使用者的申請紀錄
   */
  getMyDonations(): Observable<{ data: DonationRequestDTO[] }> {
    return this.http.get<{ data: DonationRequestDTO[] }>(
      `${this.apiUrl}/my`,
    );
  }

  /**
   * 撤回贊助申請
   */
  withdrawDonation(requestId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/${requestId}`,
    );
  }

  /**
   * 標記贊助過期
   */
  markAsExpired(): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.apiUrl}/mark-expired`,
      {},
    );
  }

  /**
   * 取得贊助證明的簽章 URL
   */
  getProofSignedUrl(key: string): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(
      `${this.apiUrl}/proof-url/${encodeURIComponent(key)}`,
    );
  }
}
