import { Injectable, signal, computed, inject } from '@angular/core';
import { AnalyticsService } from '@app/core/services/analytics.service';
import { ToastService } from '@app/shared/services/toast.service';
import { UserData } from '@app/features/user/user.model';
import { AuthApiService } from '@app/core/services/auth-api.service';
import { UserApiMapper } from '@app/core/mappers/user-api.mapper';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';

/**
 * Google 使用者資料
 */
export interface GoogleUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

/**
 * 認證服務
 * 使用 OAuth 2.0 Implicit Flow 處理 Google 登入/登出功能，整合 D1 使用者權限管理
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly analyticsService = inject(AnalyticsService);
  private readonly toastService = inject(ToastService);
  private readonly authApi = inject(AuthApiService);

  /** 儲存的 Google ID Token */
  private idTokenValue: string | null = null;
  private tokenExpiry = 0;

  readonly currentUser = signal<GoogleUser | null>(null);
  readonly userData = signal<UserData | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly userDisplayName = computed(
    () => this.currentUser()?.displayName || '訪客'
  );
  readonly userPhotoURL = computed(() => this.currentUser()?.photoURL || null);
  readonly userEmail = computed(() => this.currentUser()?.email || null);
  readonly userId = computed(() => this.currentUser()?.uid || null);
  readonly isPremium = computed(() => this.userRole() === 'premium');
  readonly isAdmin = computed(() => this.userRole() === 'admin');
  readonly userRole = computed(
    () => this.userData()?.platforms?.quotation?.role || 'free'
  );

  /**
   * 初始化認證
   * 檢查 OAuth callback 或從 localStorage 恢復 session
   */
  async initializeAuth(): Promise<void> {
    // 檢查是否為 OAuth callback（popup 被重新導向回來）
    if (this.handleOAuthCallback()) return;

    // 嘗試從 localStorage 恢復 session
    this.restoreSession();
  }

  /**
   * 處理 OAuth implicit flow callback
   * 當 popup 被 Google 重新導向回來時，URL hash 會包含 id_token
   * 將 token 傳回主視窗並關閉 popup
   */
  private handleOAuthCallback(): boolean {
    const hash = window.location.hash;
    if (!hash || !hash.includes('id_token')) return false;

    const params = new URLSearchParams(hash.substring(1));
    const idToken = params.get('id_token');

    if (!idToken) return false;

    // 透過 localStorage 將 token 傳給主視窗（不受 COOP 限制）
    // 主視窗透過 storage 事件接收
    localStorage.setItem('oauth_callback_token', idToken);
    window.close();

    // 如果 window.close() 沒有作用（非 popup），直接在此視窗處理
    setTimeout(() => {
      localStorage.removeItem('oauth_callback_token');
      window.location.hash = '';
      this.handleCredentialResponse({ credential: idToken });
    }, 200);
    return true;
  }

  /**
   * 從 localStorage 恢復 session
   */
  private restoreSession(): void {
    const savedToken = localStorage.getItem('oauth_credential');
    if (!savedToken) return;

    const payload = this.decodeJwt(savedToken);
    if (payload && payload.exp * 1000 > Date.now()) {
      this.setSession(savedToken, payload);
      this.loadUserData(savedToken);
    } else {
      localStorage.removeItem('oauth_credential');
    }
  }

  /**
   * Google 登入（由自訂按鈕呼叫）
   * 使用 OAuth 2.0 Implicit Flow 開啟帳戶選擇器彈窗，取得 ID Token
   */
  loginWithGoogle(): void {
    const nonce = crypto.randomUUID();

    const params = new URLSearchParams({
      client_id: environment.googleClientId,
      redirect_uri: window.location.origin,
      response_type: 'id_token',
      scope: 'openid email profile',
      nonce,
      prompt: 'select_account',
    });

    const width = 500;
    const height = 600;
    const left = Math.round((screen.width - width) / 2);
    const top = Math.round((screen.height - height) / 2);

    const popup = window.open(
      `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      'google-auth',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );

    if (!popup) {
      this.toastService.error('無法開啟登入視窗，請允許彈出視窗');
      return;
    }

    // 監聽 popup 透過 localStorage 傳回的 token（storage 事件不受 COOP 限制）
    const storageHandler = (event: StorageEvent) => {
      if (event.key !== 'oauth_callback_token' || !event.newValue) return;
      window.removeEventListener('storage', storageHandler);
      localStorage.removeItem('oauth_callback_token');
      this.handleCredentialResponse({ credential: event.newValue });
    };
    window.addEventListener('storage', storageHandler);

    // 安全逾時：30 秒後若仍未收到 token，清除 listener
    setTimeout(() => {
      window.removeEventListener('storage', storageHandler);
    }, 30_000);
  }

  /**
   * Credential 回呼處理
   */
  private handleCredentialResponse(response: any): void {
    const payload = this.decodeJwt(response.credential);
    if (!payload) {
      this.toastService.error('登入失敗，請稍後再試');
      return;
    }

    this.setSession(response.credential, payload);
    this.loadUserData(response.credential);
    this.toastService.success('登入成功');

    this.analyticsService.trackEvent('user_signed_in', {
      method: 'google',
      user_id: payload.sub,
      user_role: this.userRole(),
    });
  }

  /**
   * 設定本地 session（token + 使用者資訊）
   */
  private setSession(token: string, payload: any): void {
    this.idTokenValue = token;
    this.tokenExpiry = payload.exp * 1000;
    localStorage.setItem('oauth_credential', token);

    this.currentUser.set({
      uid: payload.sub,
      email: payload.email,
      displayName: payload.name,
      photoURL: payload.picture,
    });
  }

  /**
   * 解碼 JWT（不做簽章驗證，僅用於讀取 payload）
   */
  private decodeJwt(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  }

  /**
   * 載入使用者的 D1 資料
   * @param idToken Google ID Token
   */
  private async loadUserData(idToken: string): Promise<void> {
    try {
      const d1Response = await firstValueFrom(
        this.authApi.getUserMe(idToken)
      );
      const data = UserApiMapper.mapD1ToUserData(d1Response);
      this.userData.set(data);

      // 將 currentUser.uid 校正為 D1 users.id（既有使用者的 ID 可能與 Google sub 不同）
      const current = this.currentUser();
      if (current && data.uid && data.uid !== current.uid) {
        this.currentUser.set({ ...current, uid: data.uid });
      }
    } catch (error: any) {
      console.error('無法從 D1 載入使用者資料:', error);
      this.analyticsService.trackError(error, 'load_user_data_d1');
      this.userData.set(null);
    }
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    const userId = this.userId();

    this.idTokenValue = null;
    this.tokenExpiry = 0;
    localStorage.removeItem('oauth_credential');
    this.currentUser.set(null);
    this.userData.set(null);

    this.analyticsService.trackEvent('logout_success', {
      user_id: userId,
    });
  }

  /**
   * 取得使用者 ID Token（用於後端驗證）
   * 若 token 已過期則清除登入狀態
   */
  async getIdToken(): Promise<string | null> {
    if (!this.idTokenValue) {
      return null;
    }

    // 若 token 已過期，清除登入狀態
    if (Date.now() > this.tokenExpiry) {
      await this.logout();
      this.toastService.warning('登入已過期，請重新登入');
      return null;
    }

    return this.idTokenValue;
  }

  /**
   * 更新使用者顯示名稱
   * 僅更新本地狀態
   * @param newDisplayName 新的顯示名稱
   */
  async updateDisplayName(newDisplayName: string): Promise<void> {
    const current = this.currentUser();
    if (!current) {
      throw new Error('使用者未登入');
    }

    const trimmedName = newDisplayName.trim();
    if (!trimmedName) {
      throw new Error('顯示名稱不能為空');
    }

    if (trimmedName.length > 50) {
      throw new Error('顯示名稱不能超過 50 個字');
    }

    // 更新本地 currentUser
    this.currentUser.set({ ...current, displayName: trimmedName });

    // 更新本地 userData
    const currentData = this.userData();
    if (currentData) {
      this.userData.set({
        ...currentData,
        displayName: trimmedName,
      });
    }

    this.toastService.success('顯示名稱已更新');
  }
}
