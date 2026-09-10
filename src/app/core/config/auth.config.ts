import { InjectionToken } from '@angular/core';

/**
 * Google ID token 登入的漸進式啟用開關。
 * 後端 /api/auth/google/login 上線前維持 false；部署時於 application providers 覆寫為 true。
 */
export const GOOGLE_ID_TOKEN_LOGIN_ENABLED = new InjectionToken<boolean>(
  'GOOGLE_ID_TOKEN_LOGIN_ENABLED',
  { factory: () => false },
);
