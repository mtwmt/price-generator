import { Component, inject, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  User,
  Check,
  Clock,
  CircleX,
} from 'lucide-angular';
import { AuthService } from '@app/core/services/auth.service';
import { DonationApiService } from '@app/core/services/donation-api.service';
import { UserProfileComponent } from './user-profile/user-profile.component';
import { DonationFormComponent } from './donation-form/donation-form.component';
import { AdminPanelComponent } from './admin-panel/admin-panel.component';
import { ProofModalComponent } from '@app/features/user/admin/proof-modal/proof-modal.component';
import { DonationsStore } from '@app/features/user/donations.store';
import { ProfileStore } from '@app/features/user/profile.store';
import { environment } from 'src/environments/environment';
import { firstValueFrom } from 'rxjs';

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
    ProofModalComponent,
  ],
  templateUrl: './member.component.html',
})
export class MemberComponent {
  // ==================== Services & Stores ====================
  readonly authService = inject(AuthService);
  readonly donationsStore = inject(DonationsStore);
  readonly profileStore = inject(ProfileStore);
  private readonly donationApi = inject(DonationApiService);

  // ==================== Proof URL Resolution ====================
  resolvedProofUrls = signal<Record<string, string>>({});
  isProofModalOpen = signal(false);
  selectedProofKey = signal('');

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

    // 監聽 myRequests 變化，解析 R2 key 為簽章 URL
    effect(() => {
      const requests = this.donationsStore.myRequests();
      for (const req of requests) {
        if (req.proofKey && !this.resolvedProofUrls()[req.proofKey]) {
          this.resolveProofUrl(req.proofKey);
        }
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
  openProofModal(proofKey: string): void {
    this.selectedProofKey.set(proofKey);
    this.isProofModalOpen.set(true);
  }

  /**
   * 關閉憑證預覽 Modal
   */
  closeProofModal(): void {
    this.isProofModalOpen.set(false);
    this.selectedProofKey.set('');
  }

  /**
   * 取得已解析的 proof URL
   */
  getResolvedProofUrl(request: { proof: string; proofKey?: string }): string {
    if (request.proof) return request.proof;
    if (request.proofKey) return this.resolvedProofUrls()[request.proofKey] || '';
    return '';
  }

  /**
   * 解析 R2 key 為簽章 URL
   */
  private async resolveProofUrl(key: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.donationApi.getProofSignedUrl(key),
      );
      const baseUrl = `${environment.portalApiUrl}/api/portal/user`;
      this.resolvedProofUrls.update((urls) => ({
        ...urls,
        [key]: `${baseUrl}${response.url}`,
      }));
    } catch {
      console.error('[Member] Failed to resolve proof URL');
    }
  }
}
