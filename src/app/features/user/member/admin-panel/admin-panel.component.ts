import { Component, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Shield } from 'lucide-angular';
import { Timestamp } from 'firebase/firestore';
import { UserData } from '@app/features/user/shared/models/user.model';
import { UserListComponent } from '@app/features/user/admin/user-list/user-list.component';
import { UserEditFormComponent } from '@app/features/user/admin/user-edit-modal/user-edit-modal.component';
import { FirestoreService } from '@app/core/services/firestore.service';
import { ToastService } from '@app/shared/services/toast.service';

/**
 * 管理員面板元件
 * 職責：管理使用者列表、編輯和刪除功能
 */
@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    UserListComponent,
    UserEditFormComponent,
  ],
  templateUrl: './admin-panel.component.html',
})
export class AdminPanelComponent {
  private readonly firestoreService = inject(FirestoreService);
  private readonly toastService = inject(ToastService);

  // Inputs
  users = input.required<UserData[]>();
  loading = input<boolean>(false);

  // Outputs
  refreshUsers = output<void>();

  // 內部狀態
  editingUser = signal<UserData | null>(null);

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
}
