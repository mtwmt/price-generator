import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Shield } from 'lucide-angular';
import { UserData, DonationRequest } from '@app/features/user/user.model';
import { UserListComponent } from '@app/features/user/admin/user-list/user-list.component';
import { ProofModalComponent } from '@app/features/user/admin/proof-modal/proof-modal.component';
import { ToastService } from '@app/shared/services/toast.service';
import { DonationService } from '@app/core/services/donation.service';
import { AuthService } from '@app/core/services/auth.service';
import { UsersStore } from '@app/features/user/users.store';

/**
 * 管理員面板元件
 * 職責：管理使用者列表、編輯和刪除功能、贊助申請審核
 */
@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    UserListComponent,
    ProofModalComponent,
  ],
  templateUrl: './admin-panel.component.html',
})
export class AdminPanelComponent {
  private readonly donationService = inject(DonationService);
  private readonly toastService = inject(ToastService);
  private readonly authService = inject(AuthService);
  readonly usersStore = inject(UsersStore);

  // 內部狀態
  pendingRequests = signal<DonationRequest[]>([]);
  processedRequests = signal<DonationRequest[]>([]);
  activeTab = signal<'users' | 'donations'>('users');
  donationTab = signal<'pending' | 'history'>('pending');
  donationLoading = signal<boolean>(false);
  isProofModalOpen = signal<boolean>(false);
  selectedProofUrl = signal<string>('');

  // Icons
  readonly Shield = Shield;

  /**
   * 切換主頁籤
   */
  switchTab(tab: 'users' | 'donations'): void {
    this.activeTab.set(tab);
    if (tab === 'donations') {
      this.loadPendingRequests();
    }
  }

  /**
   * 切換贊助申請子頁籤
   */
  switchDonationTab(tab: 'pending' | 'history'): void {
    this.donationTab.set(tab);
    if (tab === 'pending') {
      this.loadPendingRequests();
    } else {
      this.loadProcessedRequests();
    }
  }

  /**
   * 載入待審核申請
   */
  async loadPendingRequests(): Promise<void> {
    this.donationLoading.set(true);
    try {
      const requests = await this.donationService.getPendingRequests();
      this.pendingRequests.set(requests);
    } catch (error) {
      console.error('Failed to load pending requests:', error);
      this.toastService.error('載入申請失敗');
    } finally {
      this.donationLoading.set(false);
    }
  }

  /**
   * 載入已處理申請
   */
  async loadProcessedRequests(): Promise<void> {
    this.donationLoading.set(true);
    try {
      const requests = await this.donationService.getProcessedRequests();
      this.processedRequests.set(requests);
    } catch (error) {
      console.error('Failed to load processed requests:', error);
      this.toastService.error('載入歷史紀錄失敗');
    } finally {
      this.donationLoading.set(false);
    }
  }

  /**
   * 開啟憑證預覽 Modal
   */
  openProofModal(proofUrl: string): void {
    this.selectedProofUrl.set(proofUrl);
    this.isProofModalOpen.set(true);
  }

  /**
   * 關閉憑證預覽 Modal
   */
  closeProofModal(): void {
    this.isProofModalOpen.set(false);
    this.selectedProofUrl.set('');
  }

  /**
   * 核准申請
   */
  async approveRequest(request: DonationRequest): Promise<void> {
    if (!confirm(`確定要核准 ${request.userDisplayName} 的申請嗎？`)) return;

    try {
      const admin = this.authService.currentUser();
      if (!admin) return;

      await this.donationService.approveRequest(
        request.id!,
        admin.uid,
        request.uid
      );
      this.toastService.success('已核准申請');

      // 重新整理列表
      await this.loadPendingRequests();
      this.usersStore.loadUsers();
    } catch (error) {
      console.error('Failed to approve request:', error);
      this.toastService.error('核准失敗');
    }
  }

  /**
   * 拒絕申請
   */
  async rejectRequest(request: DonationRequest): Promise<void> {
    if (!confirm(`確定要拒絕 ${request.userDisplayName} 的申請嗎？`)) return;

    try {
      const admin = this.authService.currentUser();
      if (!admin) return;

      await this.donationService.rejectRequest(request.id!, admin.uid);
      this.toastService.success('已拒絕申請');

      // 重新整理列表
      await this.loadPendingRequests();
    } catch (error) {
      console.error('Failed to reject request:', error);
      this.toastService.error('拒絕失敗');
    }
  }

  /**
   * 重新審核（將 rejected 改回 pending）
   */
  async resetRequest(request: DonationRequest): Promise<void> {
    if (!confirm(`確定要重新審核 ${request.userDisplayName} 的申請嗎？`))
      return;

    try {
      await this.donationService.resetRequestStatus(request.id!);
      this.toastService.success('已重新開放審核');

      // 重新整理列表
      await this.loadProcessedRequests();
    } catch (error) {
      console.error('Failed to reset request:', error);
      this.toastService.error('重新審核失敗');
    }
  }
}
