import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Shield } from 'lucide-angular';
import {
  UserData,
  UserRole,
  DonationRequest,
} from '@app/features/user/user.model';
import { UserListComponent } from '@app/features/user/admin/user-list/user-list.component';
import { PaginationComponent } from '@app/shared/components/pagination/pagination.component';
import { ProofModalComponent } from '@app/features/user/admin/proof-modal/proof-modal.component';
import { UserEditFormComponent } from '@app/features/user/admin/user-edit-modal/user-edit-modal.component';
import { ToastService } from '@app/shared/services/toast.service';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog.service';
import { DonationService } from '@app/features/user/services/donation.service';
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
    PaginationComponent,
    ProofModalComponent,
    UserEditFormComponent,
  ],
  templateUrl: './admin-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPanelComponent {
  private readonly donationService = inject(DonationService);
  private readonly toastService = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly authService = inject(AuthService);
  readonly usersStore = inject(UsersStore);

  // 內部狀態
  pendingRequests = signal<DonationRequest[]>([]);
  processedRequests = signal<DonationRequest[]>([]);
  activeTab = signal<'users' | 'pending' | 'history'>('users');
  donationLoading = signal<boolean>(false);
  isProofModalOpen = signal<boolean>(false);
  selectedProofKey = signal<string>('');

  // 已處理分頁狀態
  processedPage = signal(1);
  processedPageSize = signal(10);
  readonly processedTotal = computed(() => this.processedRequests().length);
  readonly paginatedProcessedRequests = computed(() => {
    const all = this.processedRequests();
    const start = (this.processedPage() - 1) * this.processedPageSize();
    return all.slice(start, start + this.processedPageSize());
  });

  // 操作中狀態（防連點）
  processing = signal<boolean>(false);

  // 編輯權限相關
  editingUser = signal<UserData | null>(null);

  // Icons
  readonly Shield = Shield;

  /**
   * 切換頁籤
   */
  switchTab(tab: 'users' | 'pending' | 'history'): void {
    this.activeTab.set(tab);
    if (tab === 'pending') {
      this.loadPendingRequests();
    } else if (tab === 'history') {
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
   * 核准申請
   */
  async approveRequest(request: DonationRequest): Promise<void> {
    if (this.processing()) return;
    const approved = await this.confirmDialog.confirm({
      title: '核准申請',
      message: `確定要核准 ${request.userDisplayName} 的申請嗎？`,
      confirmText: '核准',
      confirmStyle: 'primary',
    });
    if (!approved) return;

    this.processing.set(true);
    try {
      const admin = this.authService.currentUser();
      if (!admin) return;

      await this.donationService.approveRequest(
        request.id!,
        admin.uid,
        request.uid,
        request.userEmail,
        request.userDisplayName
      );
      this.toastService.success('已核准申請');

      // 重新整理列表
      await this.loadPendingRequests();
      this.usersStore.loadUsers();
    } catch (error) {
      console.error('Failed to approve request:', error);
      this.toastService.error('核准失敗');
    } finally {
      this.processing.set(false);
    }
  }

  /**
   * 拒絕申請
   */
  async rejectRequest(request: DonationRequest): Promise<void> {
    if (this.processing()) return;
    const confirmed = await this.confirmDialog.confirm({
      title: '拒絕申請',
      message: `確定要拒絕 ${request.userDisplayName} 的申請嗎？`,
      confirmText: '拒絕',
      confirmStyle: 'error',
    });
    if (!confirmed) return;

    this.processing.set(true);
    try {
      const admin = this.authService.currentUser();
      if (!admin) return;

      await this.donationService.rejectRequest(request.id!, admin.uid, request.uid);
      this.toastService.success('已拒絕申請');

      // 重新整理列表
      await this.loadPendingRequests();
      this.usersStore.loadUsers();
    } catch (error) {
      console.error('Failed to reject request:', error);
      this.toastService.error('拒絕失敗');
    } finally {
      this.processing.set(false);
    }
  }

  /**
   * 重新審核（將 rejected 改回 pending）
   */
  async resetRequest(request: DonationRequest): Promise<void> {
    if (this.processing()) return;
    const confirmed = await this.confirmDialog.confirm({
      title: '重新審核',
      message: `確定要重新審核 ${request.userDisplayName} 的申請嗎？`,
      confirmText: '重新審核',
      confirmStyle: 'warning',
    });
    if (!confirmed) return;

    this.processing.set(true);
    try {
      await this.donationService.resetRequestStatus(request.id!);
      this.toastService.success('已重新開放審核');

      // 重新整理列表
      await this.loadProcessedRequests();
      await this.loadPendingRequests();
    } catch (error) {
      console.error('Failed to reset request:', error);
      this.toastService.error('重新審核失敗');
    } finally {
      this.processing.set(false);
    }
  }

  // ==================== 已處理分頁方法 ====================
  onProcessedPageChange(page: number): void {
    this.processedPage.set(page);
  }

  onProcessedPageSizeChange(size: number): void {
    this.processedPageSize.set(size);
    this.processedPage.set(1);
  }

  // ==================== 編輯權限方法 ====================

  /**
   * 從贊助申請開啟編輯權限
   */
  startEditFromRequest(request: DonationRequest): void {
    // 從 usersStore 取得完整的 UserData
    const users = this.usersStore.users();
    const user = users.find((u) => u.uid === request.uid);

    if (user) {
      this.editingUser.set(user);
    } else {
      // 如果使用者列表尚未載入，先載入
      this.usersStore.loadUsers();
      this.toastService.info('載入使用者資料中...');
    }
  }

  /**
   * 儲存編輯的權限
   */
  handleSaveEdit(updates: {
    role: UserRole;
    premiumUntil?: number | null;
  }): void {
    const user = this.editingUser();
    if (!user) return;

    this.usersStore.updateUserRole({
      uid: user.uid,
      role: updates.role,
      premiumUntil: updates.premiumUntil ?? null,
    });

    this.cancelEdit();

    // 身分變更後刷新列表以反映最新狀態
    setTimeout(() => {
      this.loadPendingRequests();
      this.loadProcessedRequests();
    }, 500);
  }

  /**
   * 取消編輯
   */
  cancelEdit(): void {
    this.editingUser.set(null);
  }
}
