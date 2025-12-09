import { computed, inject } from '@angular/core';
import { signalStore, withComputed } from '@ngrx/signals';
import { AuthService } from '@app/core/services/auth.service';
import { formatDateLong, getDaysDiff } from '@app/shared/utils/date.utils';

/**
 * 使用者 Profile Store
 *
 * 職責：管理當前使用者 Profile 的衍生狀態（用於顯示）
 */
export const ProfileStore = signalStore(
  { providedIn: 'root' },

  withComputed(() => {
    const authService = inject(AuthService);

    return {
      /**
       * 使用者資料
       */
      userData: computed(() => authService.userData()),

      /**
       * 使用者顯示名稱
       */
      userDisplayName: computed(() => authService.userDisplayName()),

      /**
       * 使用者 Email
       */
      userEmail: computed(() => authService.userEmail()),

      /**
       * 是否為 Premium 會員
       */
      isPremium: computed(() => authService.isPremium()),

      /**
       * 是否為管理員
       */
      isAdmin: computed(() => authService.isAdmin()),

      /**
       * 格式化的註冊日期
       */
      formattedCreatedAt: computed(() => {
        const createdAt = authService.userData()?.createdAt;
        if (!createdAt) return null;
        return formatDateLong(createdAt);
      }),

      /**
       * 格式化的贊助到期日
       */
      formattedPremiumUntil: computed(() => {
        const premiumUntil =
          authService.userData()?.platforms.quotation?.premiumUntil;
        if (!premiumUntil) return null;
        return formatDateLong(premiumUntil);
      }),

      /**
       * 距離到期的天數
       */
      daysUntilExpiry: computed(() => {
        const premiumUntil =
          authService.userData()?.platforms.quotation?.premiumUntil;
        return getDaysDiff(premiumUntil);
      }),

      /**
       * 是否顯示到期警告（7天內到期或已過期）
       */
      showExpiryWarning: computed(() => {
        const premiumUntil =
          authService.userData()?.platforms.quotation?.premiumUntil;
        if (!premiumUntil) return false;

        const days = getDaysDiff(premiumUntil);
        return days !== null && days <= 7;
      }),

      /**
       * 當前使用者的角色
       */
      currentRole: computed(() => {
        const quotation = authService.userData()?.platforms.quotation;
        return quotation?.role || 'free';
      }),
    };
  })
);
