import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Users, Crown, Shield } from 'lucide-angular';
import { UserData } from '@app/features/user/shared/models/user.model';
import {
  getRoleDisplayName,
  getRoleBadgeClass,
  formatDate,
  getDaysUntilExpiry,
} from '@app/features/user/admin/utils/user-role.helpers';

/**
 * 使用者列表元件
 * 職責：純展示元件，顯示使用者列表表格
 */
@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './user-list.component.html',
})
export class UserListComponent {
  // Inputs
  users = input.required<UserData[]>();
  loading = input<boolean>(false);

  // Outputs
  refresh = output<void>();
  editUser = output<UserData>();
  deleteUser = output<UserData>();

  // Icons
  readonly Users = Users;
  readonly Crown = Crown;
  readonly Shield = Shield;

  // Helper functions (從 utils 匯入)
  readonly getRoleDisplayName = getRoleDisplayName;
  readonly getRoleBadgeClass = getRoleBadgeClass;
  readonly formatDate = formatDate;
  readonly getDaysUntilExpiry = getDaysUntilExpiry;
}
