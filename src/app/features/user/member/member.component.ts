import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  User,
  Check,
  Clock,
  XCircle,
} from 'lucide-angular';
import { AuthService } from '@app/core/services/auth.service';
import { ToastService } from '@app/shared/services/toast.service';
import { FirestoreService } from '@app/core/services/firestore.service';
import {
  UserData,
  DonationRequest,
} from '@app/features/user/shared/models/user.model';
import { UserProfileComponent } from './user-profile/user-profile.component';
import { DonationFormComponent } from './donation-form/donation-form.component';
import { AdminPanelComponent } from './admin-panel/admin-panel.component';
import { DonationService } from '@app/core/services/donation.service';

/**
 * 會員中心主元件
 * 職責：協調子元件，處理資料流和業務邏輯
 */
@Component({
  selector: 'app-member',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    UserProfileComponent,
    DonationFormComponent,
    AdminPanelComponent,
  ],
  templateUrl: './member.component.html',
})
export class MemberComponent {
  readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly firestoreService = inject(FirestoreService);
  private readonly donationService = inject(DonationService);

  // Icons
  readonly User = User;
  readonly Check = Check;
  readonly Clock = Clock;
  readonly XCircle = XCircle;

  // 管理員：使用者管理
  users = signal<UserData[]>([]);
  loading = signal<boolean>(false);

  // 使用者：我的贊助申請
  myDonationRequests = signal<DonationRequest[]>([]);

  // Computed signals for formatted dates (避免在模板中重複執行函數)
  formattedCreatedAt = computed(() => {
    const createdAt = this.authService.userData()?.createdAt;
    if (!createdAt) return null;
    return this.formatDate(createdAt);
  });

  formattedPremiumUntil = computed(() => {
    const premiumUntil =
      this.authService.userData()?.platforms.quotation?.premiumUntil;
    if (!premiumUntil) return null;
    return this.formatDate(premiumUntil);
  });

  daysUntilExpiry = computed(() => {
    const premiumUntil =
      this.authService.userData()?.platforms.quotation?.premiumUntil;
    if (!premiumUntil) return null;

    const now = new Date();
    const diff = premiumUntil.toDate().getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  });

  // 是否顯示到期警告（即將到期或已過期）
  showExpiryWarning = computed(() => {
    const days = this.daysUntilExpiry();
    const userData = this.authService.userData();
    const quotation = userData?.platforms.quotation;

    // 有設定到期日，且剩餘天數 <= 7 天（包含已過期的負數）
    return quotation?.premiumUntil && days !== null && days <= 7;
  });

  constructor() {
    // 使用 effect 監聽 userData 的變化
    effect(() => {
      const userData = this.authService.userData();
      const isAdmin = this.authService.isAdmin();
      const isPremium = this.authService.isPremium();

      // 管理員：載入使用者列表
      if (userData && isAdmin && this.users().length === 0) {
        this.loadUsers();
      }

      // 非 Premium 使用者：載入自己的申請
      // 這包含過期的 Premium 會員（isPremium 會是 false 因為 role 已被降級）
      if (userData && !isPremium && !isAdmin) {
        // 檢查是否有過期的申請需要標記
        this.checkAndMarkExpiredRequest(userData);
        this.loadMyRequests();
      }
    });
  }

  /**
   * 檢查並標記過期的申請
   */
  private async checkAndMarkExpiredRequest(userData: any): Promise<void> {
    const quotation = userData?.platforms?.quotation;
    // 如果有 premiumUntil 但已過期（此時 role 應該已被降級為 free）
    if (
      quotation?.premiumUntil &&
      quotation.premiumUntil.toDate() < new Date() &&
      quotation.role === 'free'
    ) {
      try {
        await this.donationService.markAsExpired(userData.uid);
      } catch (error) {
        console.error('Failed to mark request as expired:', error);
      }
    }
  }

  /**
   * 處理贊助申請提交
   */
  async handleDonationSubmit(data: {
    proof: string;
    note: string;
  }): Promise<void> {
    const user = this.authService.currentUser();
    const userData = this.authService.userData();

    if (!user || !userData) {
      this.toastService.error('請先登入');
      return;
    }

    try {
      await this.donationService.createOrUpdateRequest(
        user.uid,
        userData.displayName || user.email || 'Unknown',
        userData.email || 'No Email',
        data.proof,
        data.note,
        this.authService.isPremium()
      );
      this.toastService.success('贊助申請已送出，我們會儘快審核！');
      // 重新載入申請狀態
      await this.loadMyRequests();
    } catch (error) {
      console.error('Failed to submit donation request:', error);
      this.toastService.error('申請送出失敗，請稍後再試');
    }
  }

  /**
   * 格式化日期
   */
  private formatDate(date: Date | { toDate(): Date }): string {
    const dateObj = date instanceof Date ? date : date.toDate();
    return dateObj.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * 載入所有使用者（管理員專用）
   */
  async loadUsers(): Promise<void> {
    this.loading.set(true);
    try {
      const users = await this.firestoreService.getAllUsers(100);
      this.users.set(users);
    } catch (error: any) {
      console.error('loadUsers: Failed!', error);
      this.toastService.error(
        '載入使用者列表失敗：' + (error.message || '未知錯誤')
      );
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * 開啟憑證預覽 Modal
   */
  openProofModal(modalId: string): void {
    const modal = document.getElementById(modalId) as HTMLDialogElement;
    if (modal) {
      modal.showModal();
    }
  }

  /**
   * 撤回申請
   */
  async handleWithdraw(requestId: string): Promise<void> {
    if (!confirm('確定要撤回申請嗎？撤回後您可以重新提交。')) return;

    const user = this.authService.currentUser();
    if (!user) return;

    try {
      await this.donationService.withdrawRequest(requestId, user.uid);
      this.toastService.success('已撤回申請');
      await this.loadMyRequests();
    } catch (error) {
      console.error('Failed to withdraw request:', error);
      this.toastService.error('撤回失敗，請稍後再試');
    }
  }

  /**
   * 載入使用者自己的申請（非 premium 使用者）
   */
  async loadMyRequests(): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) return;

    try {
      const requests = await this.donationService.getMyRequests(user.uid);
      this.myDonationRequests.set(requests);
    } catch (error: any) {
      console.error('loadMyRequests: Failed!', error);
      // 靜默失敗，不顯示錯誤訊息
    }
  }
}
