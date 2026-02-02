import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DonationRequestDTO,
  D1UserResponseDTO,
} from '@app/features/user/user.model';
import { AuthService } from './auth.service';

/**
 * AdminApiService - Repository Pattern (Transport Layer)
 * 職責：負責管理員專用的 API 網路傳輸作業。
 * 原則：僅在具備 Admin 權限的使用者環境下調用。
 */
@Injectable({
  providedIn: 'root',
})
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = `${environment.portalApiUrl}/api/portal/admin`;

  /**
   * 建立帶有 Authorization header 的請求
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

  /**
   * 獲取所有使用者列表
   */
  getAllUsers(limit?: number): Observable<{ data: D1UserResponseDTO[] }> {
    const url = limit
      ? `${this.apiUrl}/users?limit=${limit}`
      : `${this.apiUrl}/users`;
    return this.withAuth((headers) =>
      this.http.get<{ data: D1UserResponseDTO[] }>(url, { headers })
    );
  }

  /**
   * 獲取所有待審核的贊助申請
   */
  getPendingDonations(): Observable<{ data: DonationRequestDTO[] }> {
    return this.withAuth((headers) =>
      this.http.get<{ data: DonationRequestDTO[] }>(
        `${this.apiUrl}/donations/pending`,
        { headers }
      )
    );
  }

  /**
   * 獲取所有已處理的贊助申請
   */
  getProcessedDonations(): Observable<{ data: DonationRequestDTO[] }> {
    return this.withAuth((headers) =>
      this.http.get<{ data: DonationRequestDTO[] }>(
        `${this.apiUrl}/donations/processed`,
        { headers }
      )
    );
  }

  /**
   * 核准贊助申請
   */
  approveDonation(requestId: string): Observable<{ success: boolean }> {
    return this.withAuth((headers) =>
      this.http.post<{ success: boolean }>(
        `${this.apiUrl}/donations/${requestId}/approve`,
        {},
        { headers }
      )
    );
  }

  /**
   * 拒絕贊助申請
   */
  rejectDonation(requestId: string): Observable<{ success: boolean }> {
    return this.withAuth((headers) =>
      this.http.post<{ success: boolean }>(
        `${this.apiUrl}/donations/${requestId}/reject`,
        {},
        { headers }
      )
    );
  }

  /**
   * 重新審核申請 (重設狀態為 pending)
   */
  resetDonationStatus(requestId: string): Observable<{ success: boolean }> {
    return this.withAuth((headers) =>
      this.http.post<{ success: boolean }>(
        `${this.apiUrl}/donations/${requestId}/reset`,
        {},
        { headers }
      )
    );
  }

  /**
   * 更新使用者角色與到期日
   */
  updateUserRole(
    uid: string,
    role: string,
    premiumUntil: string | null
  ): Observable<{ success: boolean }> {
    return this.withAuth((headers) =>
      this.http.patch<{ success: boolean }>(
        `${this.apiUrl}/users/${uid}/role`,
        { role, premiumUntil },
        { headers }
      )
    );
  }

  /**
   * 刪除使用者
   */
  deleteUser(uid: string): Observable<{ success: boolean }> {
    return this.withAuth((headers) =>
      this.http.delete<{ success: boolean }>(`${this.apiUrl}/users/${uid}`, {
        headers,
      })
    );
  }
}
