import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { D1UserResponseDTO } from '@app/features/user/user.model';

/**
 * AuthApiService - Repository Pattern (Transport Layer)
 * 職責：負責與身份驗證相關的後端 API 進行網路傳輸作業。
 * 原則：不處理業務邏輯或數據轉換，僅返回 Observable<DTO>。
 * 認證 headers 由 authInterceptor 自動附加。
 */
@Injectable({
  providedIn: 'root',
})
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.portalApiUrl + '/api/portal';

  /**
   * 獲取當前登入使用者在 D1 中的完整資料
   */
  getUserMe(): Observable<D1UserResponseDTO> {
    return this.http.get<D1UserResponseDTO>(`${this.apiUrl}/user/me`);
  }
}
