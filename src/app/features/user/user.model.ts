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
 * 單一平台的權限資料 (對齊 D1 與 Portal API)
 */
export interface PlatformPermission {
  role: UserRole;
  premiumUntil?: number | null;
  firstAccessTime?: number | null;
  lastAccessTime?: number | null;
}

/**
 * D1 API 傳出的原始數據結構 (Data Transfer Object)
 * 所有時間統一使用 Unix Timestamp (ms)
 */
export interface D1QuotationDTO {
  uid: string;
  role: UserRole;
  premiumUntil: number | null;
  firstAccessTime: number | null;
  lastAccessTime: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface DonationRequestDTO {
  id: string;
  uid: string;
  status: DonationStatus;
  note: string | null;
  proof: string | null;
  userDisplayName: string | null;
  userEmail: string | null;
  reviewedBy: string | null;
  reviewedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface D1UserDTO {
  id: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface D1UserResponseDTO {
  user: D1UserDTO;
  profiles: {
    quotation?: D1QuotationDTO;
    bookshelf?: any;
  };
  timestamp: number;
}

/**
 * 使用者資料 (前端 Domain Model)
 * 職責：在應用程式內部流轉，解耦外部 API 結構。
 */
export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  platforms: {
    [K in PlatformType]?: PlatformPermission;
  };
  createdAt?: number;
  updatedAt?: number;
}

/**
 * 贊助申請資料 (前端 Domain Model)
 */
export interface DonationRequest {
  id?: string;
  uid: string;
  userDisplayName: string;
  userEmail: string;
  proof: string;
  proofKey?: string;
  note: string;
  status: DonationStatus;
  createdAt: number;
  updatedAt: number;
  reviewedBy?: string;
  reviewedAt?: number | null;
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
  premiumUntil: number | null;
}

/**
 * 標記過期的參數（系統自動檢查）
 * - premiumUntil 必須有值，用於判斷是否過期
 */
export interface MarkExpiredParams extends UserRoleBaseParams {
  premiumUntil: number;
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
