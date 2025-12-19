import { UserData, UserRole } from '@app/features/user/user.model';
import { getRoleDisplayName, getRoleBadgeClass } from './user-role.helpers';
import { formatDateTime, getDaysDiff } from '@app/shared/utils/date.utils';

/**
 * 使用者顯示資料（用於模板綁定）
 */
export interface UserDisplayData {
  user: UserData;
  displayName: string;
  email: string;
  uidShort: string;
  role: UserRole;
  roleDisplayName: string;
  roleBadgeClass: string;
  premiumUntilFormatted: string | null;
  daysUntilExpiry: number | null;
  isExpired: boolean;
  createdAtFormatted: string;
}

/**
 * 將 UserData 轉換為 UserDisplayData
 */
export function toUserDisplayData(user: UserData): UserDisplayData {
  const quotation = user.platforms.quotation;
  const role = quotation?.role || 'free';
  const premiumUntil = quotation?.premiumUntil;
  const daysUntil = getDaysDiff(premiumUntil);

  return {
    user,
    displayName: user.displayName || 'Unknown',
    email: user.email || 'No Email',
    uidShort: user.uid.substring(0, 8),
    role,
    roleDisplayName: getRoleDisplayName(role),
    roleBadgeClass: getRoleBadgeClass(role),
    premiumUntilFormatted: premiumUntil ? formatDateTime(premiumUntil) : null,
    daysUntilExpiry: daysUntil,
    isExpired: role === 'premium' && daysUntil !== null && daysUntil < 0,
    createdAtFormatted: user.createdAt ? formatDateTime(user.createdAt) : '-',
  };
}

/**
 * 將 UserData 陣列轉換為 UserDisplayData 陣列
 */
export function toUserDisplayDataList(users: UserData[]): UserDisplayData[] {
  return users.map(toUserDisplayData);
}
