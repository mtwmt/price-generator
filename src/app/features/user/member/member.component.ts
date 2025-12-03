import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, User } from 'lucide-angular';
import { AuthService } from '@app/core/services/auth.service';
import { ToastService } from '@app/shared/services/toast.service';
import { FirestoreService } from '@app/core/services/firestore.service';
import { UserData } from '@app/features/user/shared/models/user.model';
import { UserProfileComponent } from './user-profile/user-profile.component';
import { DonationFormComponent } from './donation-form/donation-form.component';
import { AdminPanelComponent } from './admin-panel/admin-panel.component';

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

  // Icons
  readonly User = User;

  // 管理員：使用者管理
  users = signal<UserData[]>([]);
  loading = signal<boolean>(false);

  // Computed signals for formatted dates (避免在模板中重複執行函數)
  formattedCreatedTime = computed(() => {
    const createdTime = this.authService.userData()?.createdTime;
    if (!createdTime) return null;
    return this.formatDate(createdTime);
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

  constructor() {
    // 使用 effect 監聽 userData 的變化
    // 當使用者資料載入完成且為管理員時，自動載入使用者列表
    effect(() => {
      const userData = this.authService.userData();
      const isAdmin = this.authService.isAdmin();

      if (userData && isAdmin && this.users().length === 0) {
        this.loadUsers();
      }
    });
  }

  /**
   * 處理贊助申請提交
   */
  handleDonationSubmit(data: { proof: string; note: string }): void {
    this.toastService.success('贊助申請已送出，我們會儘快審核！');
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
}
