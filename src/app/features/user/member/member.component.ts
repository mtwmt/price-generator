import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  User,
  Check,
  Clock,
  CircleX,
} from 'lucide-angular';
import { AuthService } from '@app/core/services/auth.service';
import { UserProfileComponent } from './user-profile/user-profile.component';
import { DonationFormComponent } from './donation-form/donation-form.component';
import { AdminPanelComponent } from './admin-panel/admin-panel.component';
import { DonationsStore } from '@app/features/user/donations.store';
import { ProfileStore } from '@app/features/user/profile.store';

/**
 * 會員中心主元件
 *
 * 職責：協調子元件，委託狀態管理給 Stores
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
  // ==================== Services & Stores ====================
  readonly authService = inject(AuthService);
  readonly donationsStore = inject(DonationsStore);
  readonly profileStore = inject(ProfileStore);

  // ==================== Icons ====================
  readonly User = User;
  readonly Check = Check;
  readonly Clock = Clock;
  readonly CircleX = CircleX;

  // ==================== Constructor ====================
  constructor() {
    // 監聽 userData 變化，自動初始化贊助申請資料
    effect(() => {
      const userData = this.profileStore.userData();
      const isPremium = this.profileStore.isPremium();
      const isAdmin = this.profileStore.isAdmin();

      if (userData && !isAdmin) {
        this.donationsStore.initForUser(userData, isPremium);
      }
    });
  }

  // ==================== Methods ====================
  /**
   * 處理贊助申請提交
   */
  handleDonationSubmit(data: { proof: string; note: string }): void {
    const user = this.authService.currentUser();
    const userData = this.profileStore.userData();

    if (!user || !userData) return;

    this.donationsStore.submitRequest({
      uid: user.uid,
      displayName: userData.displayName || user.email || 'Unknown',
      email: userData.email || 'No Email',
      proof: data.proof,
      note: data.note,
      isPremium: this.profileStore.isPremium(),
    });
  }

  /**
   * 處理顯示名稱變更
   */
  async handleDisplayNameChange(newName: string): Promise<void> {
    try {
      await this.authService.updateDisplayName(newName);
    } catch (error: any) {
      console.error('Failed to update display name:', error);
    }
  }

  /**
   * 撤回申請
   */
  handleWithdraw(requestId: string): void {
    if (!confirm('確定要撤回申請嗎？撤回後您可以重新提交。')) return;

    const user = this.authService.currentUser();
    if (!user) return;

    this.donationsStore.withdrawRequest({
      requestId,
      uid: user.uid,
    });
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
}
