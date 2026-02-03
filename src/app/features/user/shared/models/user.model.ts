/**
 * 使用者角色類型
 * - free: 免費會員
 * - premium: 贊助會員
 * - admin: 管理員（可管理其他會員的權限）
 */
export type UserRole = 'free' | 'premium' | 'admin';

/**
 * 平台類型
 * - quotation: 報價單生成器
 */
export type PlatformType = 'quotation';

/**
 * 單一平台的權限資訊
 */
export interface PlatformPermission {
  role: UserRole;
  premiumUntil?: number | null;
  firstAccessTime: number;
  lastAccessTime: number;
}

/**
 * 使用者資料介面（跨平台設計）
 */
export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  platforms: {
    [key in PlatformType]?: PlatformPermission;
  };
  createdAt: number;
  updatedAt: number;
}

/**
 * 贊助申請狀態
 */
export type DonationStatus = 'pending' | 'approved' | 'rejected' | 'expired';

/**
 * 贊助申請資料
 */
export interface DonationRequest {
  id?: string;
  uid: string;
  userDisplayName: string;
  userEmail: string;
  proof: string; // base64 image
  note: string;
  status: DonationStatus;
  createdAt: number;
  updatedAt: number;
  reviewedBy?: string; // admin uid
  reviewedAt?: number;
}
