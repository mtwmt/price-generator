import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DonationRequestDTO,
  D1UserResponseDTO,
} from '@app/features/user/user.model';

/**
 * AdminApiService - Repository Pattern (Transport Layer)
 * 職責：負責管理員專用的 API 網路傳輸作業。
 * 原則：僅在具備 Admin 權限的使用者環境下調用。
 * 認證 headers 由 authInterceptor 自動附加。
 */
@Injectable({
  providedIn: 'root',
})
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.portalApiUrl}/api/portal/admin`;

  /**
   * 獲取所有使用者列表
   */
  getAllUsers(limit?: number): Observable<{ data: D1UserResponseDTO[] }> {
    const url = limit
      ? `${this.apiUrl}/users?limit=${limit}`
      : `${this.apiUrl}/users`;
    return this.http.get<{ data: D1UserResponseDTO[] }>(url);
  }

  /**
   * 獲取所有待審核的贊助申請
   */
  getPendingDonations(): Observable<{ data: DonationRequestDTO[] }> {
    return this.http.get<{ data: DonationRequestDTO[] }>(
      `${this.apiUrl}/donations/pending`,
    );
  }

  /**
   * 獲取所有已處理的贊助申請
   */
  getProcessedDonations(): Observable<{ data: DonationRequestDTO[] }> {
    return this.http.get<{ data: DonationRequestDTO[] }>(
      `${this.apiUrl}/donations/processed`,
    );
  }

  /**
   * 核准贊助申請
   */
  approveDonation(requestId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.apiUrl}/donations/${requestId}/approve`,
      {},
    );
  }

  /**
   * 拒絕贊助申請
   */
  rejectDonation(requestId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.apiUrl}/donations/${requestId}/reject`,
      {},
    );
  }

  /**
   * 重新審核申請 (重設狀態為 pending)
   */
  resetDonationStatus(requestId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.apiUrl}/donations/${requestId}/reset`,
      {},
    );
  }

  /**
   * 更新使用者角色與到期日
   */
  updateUserRole(
    uid: string,
    role: string,
    premiumUntil: number | null,
  ): Observable<{ success: boolean }> {
    return this.http.patch<{ success: boolean }>(
      `${this.apiUrl}/users/${uid}/role`,
      { role, premiumUntil },
    );
  }

  /**
   * 刪除使用者
   */
  deleteUser(uid: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/users/${uid}`,
    );
  }
}
