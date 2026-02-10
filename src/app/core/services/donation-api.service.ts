import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DonationRequestDTO } from '@app/features/user/user.model';
import { AuthService } from '@app/core/services/auth.service';
import { HttpHeaders } from '@angular/common/http';
import { from, switchMap, throwError } from 'rxjs';

/**
 * DonationApiService - Repository Pattern (Transport Layer)
 * 職責：負責使用者側贊助申請相關的網路傳輸作業。
 */
@Injectable({
  providedIn: 'root',
})
export class DonationApiService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = `${environment.portalApiUrl}/api/portal/user/donations`;

  /**
   * 提交新的贊助申請
   */
  submitDonation(data: {
    note: string;
    proof: string;
  }): Observable<{ success: boolean }> {
    return this.withAuth((headers) =>
      this.http.post<{ success: boolean }>(this.apiUrl, data, { headers })
    );
  }

  /**
   * 獲取使用者的申請紀錄
   */
  getMyDonations(): Observable<{ data: DonationRequestDTO[] }> {
    return this.withAuth((headers) =>
      this.http.get<{ data: DonationRequestDTO[] }>(`${this.apiUrl}/my`, {
        headers,
      })
    );
  }

  /**
   * 撤回贊助申請
   */
  withdrawDonation(requestId: string): Observable<{ success: boolean }> {
    return this.withAuth((headers) =>
      this.http.delete<{ success: boolean }>(`${this.apiUrl}/${requestId}`, {
        headers,
      })
    );
  }

  /**
   * 標記贊助過期
   */
  markAsExpired(): Observable<{ success: boolean }> {
    return this.withAuth((headers) =>
      this.http.post<{ success: boolean }>(
        `${this.apiUrl}/mark-expired`,
        {},
        { headers }
      )
    );
  }

  /**
   * 取得贊助證明的簽章 URL
   */
  getProofSignedUrl(key: string): Observable<{ url: string }> {
    return this.withAuth((headers) =>
      this.http.get<{ url: string }>(
        `${this.apiUrl}/proof-url/${encodeURIComponent(key)}`,
        { headers },
      ),
    );
  }

  /**
   * 帶有驗證 Token 的請求輔助函數
   */
  private withAuth<T>(
    requestFn: (headers: HttpHeaders) => Observable<T>
  ): Observable<T> {
    return from(this.authService.getIdToken()).pipe(
      switchMap((token) => {
        if (!token) {
          return throwError(() => new Error('未登入或無法取得驗證 Token'));
        }
        const headers = new HttpHeaders({
          Authorization: `Bearer ${token}`,
          'x-platform-key': 'quotation',
        });
        return requestFn(headers);
      })
    );
  }
}
