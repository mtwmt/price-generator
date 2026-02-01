import { Injectable, signal, computed, inject } from '@angular/core';
import {
  Auth,
  User,
  UserCredential,
  getAuth,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { AnalyticsService } from '@app/core/services/analytics.service';
import { ToastService } from '@app/shared/services/toast.service';
import { UserData } from '@app/features/user/user.model';
import { AuthApiService } from '@app/core/services/auth-api.service';
import { UserApiMapper } from '@app/core/mappers/user-api.mapper';
import { firstValueFrom } from 'rxjs';

/**
 * 認證服務
 * 處理 Google 登入/登出功能，整合 D1 使用者權限管理
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly analyticsService = inject(AnalyticsService);
  private readonly toastService = inject(ToastService);
  private readonly authApi = inject(AuthApiService);

  // Firebase Auth 實例（在 app.config 初始化後會被設定）
  private auth: Auth | null = null;

  readonly currentUser = signal<User | null>(null);
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
   * 初始化 Firebase Auth
   * 必須在 Firebase App 初始化後呼叫
   */
  initializeAuth(): void {
    this.auth = getAuth();

    // 監聽登入狀態變化
    onAuthStateChanged(this.auth, async (user) => {
      this.currentUser.set(user);

      if (user) {
        // 載入使用者的 D1 資料
        await this.loadUserData(user);

        this.analyticsService.trackEvent('user_signed_in', {
          method: 'google',
          user_id: user.uid,
          user_role: this.userRole(),
        });
      } else {
        this.userData.set(null);
      }
    });
  }

  /**
   * 載入使用者的 D1 資料
   * @param user Firebase Auth 使用者
   */
  private async loadUserData(user: User): Promise<void> {
    try {
      // 1. 獲取 Google ID Token
      const idToken = await user.getIdToken();

      // 2. 從 D1 後端獲取整合後的 UserProfile (DTO -> Domain Model)
      const d1Response = await firstValueFrom(this.authApi.getUserMe(idToken));
      const data = UserApiMapper.mapD1ToUserData(d1Response);

      this.userData.set(data);
    } catch (error: any) {
      console.error('無法從 D1 載入使用者資料:', error);
      this.analyticsService.trackError(error, 'load_user_data_d1');
      // D1 為唯一資料來源，若失敗則設為 null
      this.userData.set(null);
    }
  }

  /**
   * 使用 Google 帳號登入
   */
  async loginWithGoogle(): Promise<UserCredential> {
    if (!this.auth) {
      throw new Error('Firebase Auth not initialized');
    }

    try {
      const provider = new GoogleAuthProvider();
      // 強制選擇帳號（即使只有一個帳號）
      provider.setCustomParameters({
        prompt: 'select_account',
      });

      const result = await signInWithPopup(this.auth, provider);

      this.analyticsService.trackEvent('login_success', {
        method: 'google',
        user_id: result.user.uid,
      });

      return result;
    } catch (error: any) {
      console.error('Login failed:', error);

      this.analyticsService.trackEvent('login_failed', {
        method: 'google',
        error_code: error.code,
        error_message: error.message,
      });

      throw error;
    }
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    if (!this.auth) {
      throw new Error('Firebase Auth not initialized');
    }

    try {
      const userId = this.userId();
      await signOut(this.auth);

      this.analyticsService.trackEvent('logout_success', {
        user_id: userId,
      });
    } catch (error: any) {
      console.error('Logout failed:', error);

      this.analyticsService.trackEvent('logout_failed', {
        error_message: error.message,
      });

      throw error;
    }
  }

  /**
   * 取得當前使用者
   * @returns 當前使用者或 null
   */
  getCurrentUser(): User | null {
    return this.currentUser();
  }

  /**
   * 取得使用者 ID Token（用於後端驗證）
   */
  async getIdToken(): Promise<string | null> {
    const user = this.currentUser();
    if (!user) {
      return null;
    }

    try {
      return await user.getIdToken();
    } catch (error) {
      console.error('Failed to get ID token:', error);
      return null;
    }
  }

  /**
   * 更新使用者顯示名稱
   * @param newDisplayName 新的顯示名稱
   */
  async updateDisplayName(newDisplayName: string): Promise<void> {
    const user = this.currentUser();
    if (!user) {
      throw new Error('使用者未登入');
    }

    const trimmedName = newDisplayName.trim();
    if (!trimmedName) {
      throw new Error('顯示名稱不能為空');
    }

    if (trimmedName.length > 50) {
      throw new Error('顯示名稱不能超過 50 個字');
    }

    try {
      // 1. 更新 Firebase Auth Profile（D1 會在下次登入時自動同步）
      await updateProfile(user, { displayName: trimmedName });

      // 2. 更新本地 userData
      const currentData = this.userData();
      if (currentData) {
        this.userData.set({
          ...currentData,
          displayName: trimmedName,
        });
      }

      this.toastService.success('顯示名稱已更新');
    } catch (error: any) {
      console.error('Failed to update display name:', error);
      this.analyticsService.trackError(error, 'update_display_name');
      throw error;
    }
  }
}
