import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Shield } from 'lucide-angular';
import { Timestamp } from 'firebase/firestore';
import { AuthService } from '@app/core/services/auth.service';
import { FirestoreService } from '@app/core/services/firestore.service';
import { ToastService } from '@app/shared/services/toast.service';
import { UserData } from '@app/features/user/shared/models/user.model';
import { UserListComponent } from './user-list/user-list.component';
import { UserEditFormComponent } from './user-edit-modal/user-edit-modal.component';

/**
 * 管理員控制台元件
 * 職責：管理員頁面的容器，協調使用者列表和編輯功能
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    UserListComponent,
    UserEditFormComponent,
  ],
  templateUrl: './admin.component.html',
})
export class AdminComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly firestoreService = inject(FirestoreService);
  private readonly toastService = inject(ToastService);

  readonly Shield = Shield;

  users = signal<UserData[]>([]);
  loading = signal<boolean>(false);
  editingUser = signal<UserData | null>(null);

  ngOnInit() {
    if (this.authService.isAdmin()) {
      this.loadUsers();
    }
  }

  async loadUsers() {
    this.loading.set(true);
    try {
      const users = await this.firestoreService.getAllUsers(100);
      this.users.set(users);
    } catch (error) {
      console.error('Failed to load users:', error);
      this.toastService.error('載入使用者列表失敗');
    } finally {
      this.loading.set(false);
    }
  }

  startEdit(user: UserData) {
    this.editingUser.set(user);
  }

  cancelEdit() {
    this.editingUser.set(null);
  }

  async handleSave(updates: { role: any; premiumUntil?: Timestamp | null }) {
    const user = this.editingUser();
    if (!user) return;

    try {
      await this.firestoreService.updateUserRole(
        user.uid,
        updates.role,
        updates.premiumUntil ? updates.premiumUntil.toDate() : null
      );
      this.toastService.success('使用者權限已更新');
      await this.loadUsers();
      this.cancelEdit();
    } catch (error) {
      console.error('Failed to update user:', error);
      this.toastService.error('更新使用者權限失敗');
    }
  }
}
