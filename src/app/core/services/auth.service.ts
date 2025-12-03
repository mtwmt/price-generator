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
} from 'firebase/auth';
import { AnalyticsService } from '@app/core/services/analytics.service';
import { FirestoreService } from '@app/core/services/firestore.service';
import { UserData } from '@app/features/user/shared/models/user.model';

/**
 * 認證服務
 * 處理 Google 登入/登出功能，整合 Firestore 使用者權限管理
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly analyticsService = inject(AnalyticsService);
  private readonly firestoreService = inject(FirestoreService);

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
  readonly isPremium = computed(() =>
    this.firestoreService.isPremiumUser(this.userData())
  );
  readonly isAdmin = computed(
    () => this.userData()?.platforms.quotation?.role === 'admin'
  );
  readonly userRole = computed(
    () => this.userData()?.platforms.quotation?.role || 'free'
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
        // 載入使用者的 Firestore 資料
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
   * 載入使用者的 Firestore 資料
   * @param user Firebase Auth 使用者
   */
  private async loadUserData(user: User): Promise<void> {
    try {
      const data = await this.firestoreService.getOrCreateUserData(
        user.uid,
        user.email,
        user.displayName,
        user.photoURL
      );

      // 記錄使用者存取當前平台
      await this.firestoreService.recordPlatformAccess(user.uid);

      this.userData.set(data);
    } catch (error: any) {
      console.error('Failed to load user data:', error);
      this.analyticsService.trackError(error, 'load_user_data');
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
}
