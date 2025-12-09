import { UserRole } from '@app/features/user/user.model';

/**
 * 角色相關的純函數工具
 * 職責：提供角色顯示、樣式等純函數
 */

/**
 * 取得角色顯示名稱
 */
export function getRoleDisplayName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    free: '免費會員',
    premium: '贊助會員',
    admin: '管理員',
  };
  return roleNames[role] || role;
}

/**
 * 取得角色樣式類別
 */
export function getRoleBadgeClass(role: UserRole): string {
  const badgeClasses: Record<UserRole, string> = {
    free: 'badge-ghost',
    premium: 'badge-warning',
    admin: 'badge-error',
  };
  return badgeClasses[role] || 'badge-ghost';
}
