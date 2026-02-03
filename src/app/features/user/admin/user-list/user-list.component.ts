import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  Users,
  Crown,
  Shield,
  Search,
  RefreshCw,
} from 'lucide-angular';
import { PaginationComponent } from '@app/shared/components/pagination/pagination.component';
import { UsersStore } from '@app/features/user/users.store';
import { UserData, UserRole } from '@app/features/user/user.model';
import { UserEditFormComponent } from '@app/features/user/admin/user-edit-modal/user-edit-modal.component';
import {
  toUserDisplayDataList,
  UserDisplayData,
} from '@app/features/user/admin/utils/user-display.mapper';

/**
 * 使用者列表元件
 *
 * 職責：
 * - 顯示使用者列表（含分頁）
 * - 處理使用者編輯（透過 UsersStore）
 */
@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    PaginationComponent,
    UserEditFormComponent,
  ],
  templateUrl: './user-list.component.html',
})
export class UserListComponent implements OnInit {
  // ==================== Store ====================
  readonly usersStore = inject(UsersStore);

  // ==================== Icons ====================
  readonly Users = Users;
  readonly Crown = Crown;
  readonly Shield = Shield;
  readonly Search = Search;
  readonly RefreshCw = RefreshCw;

  // ==================== 分頁狀態 ====================
  currentPage = signal(1);
  pageSize = signal(10);

  // ==================== 編輯狀態 ====================
  editingUser = signal<UserData | null>(null);

  // ==================== Computed ====================
  readonly totalUsers = computed(() => this.usersStore.filteredUsers().length);
  readonly hasUsers = computed(() => this.usersStore.users().length > 0);

  readonly paginatedUsersDisplay = computed<UserDisplayData[]>(() => {
    const filtered = this.usersStore.filteredUsers();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    const end = start + size;

    return toUserDisplayDataList(filtered.slice(start, end));
  });

  // ==================== Lifecycle ====================
  ngOnInit(): void {
    if (!this.usersStore.hasUsers()) {
      this.usersStore.loadUsers();
    }
  }

  // ==================== 分頁方法 ====================
  onRefresh(): void {
    this.usersStore.loadUsers();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  onSearchChange(query: string): void {
    this.usersStore.setSearchQuery(query);
    this.currentPage.set(1);
  }

  // ==================== 編輯方法 ====================
  startEdit(user: UserData): void {
    this.editingUser.set(user);
  }

  cancelEdit(): void {
    this.editingUser.set(null);
  }

  handleSave(updates: { role: UserRole; premiumUntil?: number | null }): void {
    const user = this.editingUser();
    if (!user) return;

    this.usersStore.updateUserRole({
      uid: user.uid,
      role: updates.role,
      premiumUntil: updates.premiumUntil ?? null,
    });

    this.cancelEdit();
  }

  // ==================== 刪除方法 ====================
  confirmDelete(user: UserData): void {
    const displayName = user.displayName || user.email || user.uid;
    if (!confirm(`確定要刪除使用者「${displayName}」嗎？此操作無法復原。`)) {
      return;
    }
    this.usersStore.deleteUser(user.uid);
  }
}
