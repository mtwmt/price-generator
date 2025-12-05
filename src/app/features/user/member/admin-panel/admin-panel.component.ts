import { Component, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Shield } from 'lucide-angular';
import { Timestamp } from 'firebase/firestore';
import { UserData } from '@app/features/user/shared/models/user.model';
import { UserListComponent } from '@app/features/user/admin/user-list/user-list.component';
import { UserEditFormComponent } from '@app/features/user/admin/user-edit-modal/user-edit-modal.component';
import { ProofModalComponent } from '@app/features/user/admin/proof-modal/proof-modal.component';
import { FirestoreService } from '@app/core/services/firestore.service';
import { ToastService } from '@app/shared/services/toast.service';
import { DonationService } from '@app/core/services/donation.service';
import { AuthService } from '@app/core/services/auth.service';
import { DonationRequest } from '@app/features/user/shared/models/user.model';

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
    UserEditFormComponent,
    ProofModalComponent,
  ],
  templateUrl: './admin-panel.component.html',
})
export class AdminPanelComponent {
  private readonly firestoreService = inject(FirestoreService);
  private readonly donationService = inject(DonationService);
  private readonly toastService = inject(ToastService);
  private readonly authService = inject(AuthService);

  // Inputs
  users = input.required<UserData[]>();
  loading = input<boolean>(false);

  // Outputs
  refreshUsers = output<void>();

  // 內部狀態
  editingUser = signal<UserData | null>(null);
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
   * 開始編輯使用者
   */
  startEdit(user: UserData): void {
    this.editingUser.set(user);
  }

  /**
   * 取消編輯
   */
  cancelEdit(): void {
    this.editingUser.set(null);
  }

  /**
   * 儲存使用者權限
   */
  async handleSave(updates: {
    role: any;
    premiumUntil?: Timestamp | null;
  }): Promise<void> {
    const user = this.editingUser();
    if (!user) return;

    try {
      await this.firestoreService.updateUserRole(
        user.uid,
        updates.role,
        updates.premiumUntil ? updates.premiumUntil.toDate() : null
      );
      this.toastService.success('使用者權限已更新');
      this.refreshUsers.emit();
      this.cancelEdit();
    } catch (error) {
      console.error('Failed to update user:', error);
      this.toastService.error('更新使用者權限失敗');
    }
  }

  /**
   * 確認刪除使用者
   */
  confirmDelete(user: UserData): void {
    const userName = user.displayName || user.email || 'Unknown User';
    const confirmed = confirm(
      `確定要刪除使用者「${userName}」嗎？\n\n此操作無法復原！`
    );

    if (confirmed) {
      this.handleDelete(user);
    }
  }

  /**
   * 刪除使用者
   */
  async handleDelete(user: UserData): Promise<void> {
    try {
      await this.firestoreService.deleteUser(user.uid);
      this.toastService.success('使用者已刪除');
      this.refreshUsers.emit();
    } catch (error) {
      console.error('Failed to delete user:', error);
      this.toastService.error('刪除使用者失敗');
    }
  }

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
      this.refreshUsers.emit();
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
