import { UserRole } from '@app/features/user/shared/models/user.model';
import { Timestamp } from 'firebase/firestore';

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

/**
 * 格式化日期（支援 Timestamp 和 Date）
 */
export function formatDate(date: Timestamp | Date | null | undefined): string {
  if (!date) return '-';
  const dateObj = date instanceof Date ? date : date.toDate();
  return dateObj.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 計算到期日剩餘天數（支援 Timestamp 和 Date）
 */
export function getDaysUntilExpiry(premiumUntil: Timestamp | Date | null | undefined): number | null {
  if (!premiumUntil) return null;
  const now = new Date();
  const dateObj = premiumUntil instanceof Date ? premiumUntil : premiumUntil.toDate();
  const diff = dateObj.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
