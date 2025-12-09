import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { getAuth } from 'firebase/auth';

/**
 * 路由守衛：檢查使用者是否已登入
 * 未登入時導向首頁
 */
export const authGuard: CanActivateFn = async () => {
  const auth = getAuth();
  const router = inject(Router);

  // 等待 Firebase Auth 狀態初始化完成
  await auth.authStateReady();

  return auth.currentUser ? true : router.createUrlTree(['/']);
};
