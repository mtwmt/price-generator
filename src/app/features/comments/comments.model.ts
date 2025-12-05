/**
 * 留言介面
 */
export interface Comment {
  id: string;
  discussionId: string;
  createdAt: number;
  updatedAt: number;
  authorUserId: string;
  authorLogin: string;
  authorEmail: string;
  authorAvatarUrl: string;
  body: string;
  bodyHTML: string;
  replyToId?: string;
  reactionsTotal: number;
  reactionsThumbsUp: string[]; // 使用者 ID 陣列
  reactionsLaugh: string[]; // 使用者 ID 陣列
  reactionsHeart: string[]; // 使用者 ID 陣列
  reactionsHooray: string[]; // 使用者 ID 陣列
  reactionsConfused: string[]; // 使用者 ID 陣列
  reactionsThumbsDown: string[]; // 使用者 ID 陣列
  isPinned: boolean; // 是否置頂
  replies?: Comment[];
}

/**
 * API 回應介面
 */
export interface CommentResponse {
  success: boolean;
  message: string;
  data?: any;
  timestamp: string;
}

/**
 * 反應回應介面
 */
export interface ReactionResponse {
  count: number;
  total: number;
}

/**
 * 留言 Store 狀態介面
 */
export interface CommentsState {
  comments: Comment[];
  loading: boolean;
  error: string | null;
  currentPagePath: string | null;
  sortOrder: 'newest' | 'oldest';
}
