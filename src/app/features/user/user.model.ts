import { Timestamp } from 'firebase/firestore';

/**
 * 使用者角色類型
 * - free: 免費會員
 * - premium: 贊助會員
 * - admin: 管理員（可管理其他會員的權限）
 */
export type UserRole = 'free' | 'premium' | 'admin';

/**
 * 贊助申請狀態
 * - pending: 待審核
 * - approved: 已核准
 * - rejected: 已拒絕
 * - expired: 已過期（會員權限失效）
 */
export type DonationStatus = 'pending' | 'approved' | 'rejected' | 'expired';

/**
 * 支援的平台類型
 * - quotation: 報價單生成器
 */
export type PlatformType = 'quotation';

/**
 * 單一平台的權限資料
 */
export interface PlatformPermission {
  role: UserRole;
  premiumUntil?: Timestamp | null;
  firstAccessTime: Timestamp;
  lastAccessTime: Timestamp;
}

/**
 * 使用者資料
 */
export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  platforms: {
    [K in PlatformType]?: PlatformPermission;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 贊助申請資料
 */
export interface DonationRequest {
  id?: string;
  uid: string;
  userDisplayName: string;
  userEmail: string;
  proof: string;
  note: string;
  status: DonationStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
}

// ==================== Store 參數類型 ====================

/**
 * 使用者角色操作的基礎參數
 */
export interface UserRoleBaseParams {
  uid: string;
  role: UserRole;
}

/**
 * 更新使用者角色的參數（管理員操作）
 * - premiumUntil 可為 null，表示清除到期日
 */
export interface UpdateUserRoleParams extends UserRoleBaseParams {
  premiumUntil: Date | null;
}

/**
 * 標記過期的參數（系統自動檢查）
 * - premiumUntil 必須有值，用於判斷是否過期
 */
export interface MarkExpiredParams extends UserRoleBaseParams {
  premiumUntil: Date;
}

/**
 * 提交贊助申請的參數
 */
export interface SubmitDonationParams {
  uid: string;
  displayName: string;
  email: string;
  proof: string;
  note: string;
  isPremium: boolean;
}

/**
 * 撤回申請的參數
 */
export interface WithdrawRequestParams {
  requestId: string;
  uid: string;
}
