import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@app/core/services/auth.service';

/**
 * 路由守衛：檢查使用者是否已登入
 * 未登入時導向首頁
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // 未登入，導向首頁
  return router.createUrlTree(['/']);
};
