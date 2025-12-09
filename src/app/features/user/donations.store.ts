import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { from, pipe, switchMap, tap } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import {
  DonationRequest,
  SubmitDonationParams,
  WithdrawRequestParams,
  MarkExpiredParams,
  UserData,
} from '@app/features/user/user.model';
import { DonationService } from '@app/core/services/donation.service';
import { ToastService } from '@app/shared/services/toast.service';

/**
 * 贊助申請狀態
 */
interface DonationsState {
  myRequests: DonationRequest[];
  loading: boolean;
  submitting: boolean;
  error: string | null;
}

const initialState: DonationsState = {
  myRequests: [],
  loading: false,
  submitting: false,
  error: null,
};


/**
 * 贊助申請 Store
 *
 * 職責：管理使用者的贊助申請（提交、撤回、載入）
 */
export const DonationsStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed(({ myRequests }) => ({
    /**
     * 是否有待處理的申請
     */
    hasPendingRequest: computed(() =>
      myRequests().some((r) => r.status === 'pending')
    ),

    /**
     * 待處理的申請
     */
    pendingRequest: computed(() =>
      myRequests().find((r) => r.status === 'pending')
    ),

    /**
     * 是否有申請記錄
     */
    hasRequests: computed(() => myRequests().length > 0),
  })),

  withMethods(
    (
      store,
      donationService = inject(DonationService),
      toastService = inject(ToastService)
    ) => ({
      /**
       * 載入我的申請
       */
      loadMyRequests: rxMethod<string>(
        pipe(
          tap(() =>
            patchState(store, {
              loading: true,
              error: null,
            })
          ),
          switchMap((uid) =>
            from(donationService.getMyRequests(uid)).pipe(
              tapResponse({
                next: (myRequests) =>
                  patchState(store, {
                    myRequests,
                    loading: false,
                  }),
                error: (error: Error) => {
                  patchState(store, {
                    error: error.message || '載入申請失敗',
                    loading: false,
                  });
                  // 靜默失敗，不顯示 toast
                },
              })
            )
          )
        )
      ),

      /**
       * 提交贊助申請
       */
      submitRequest: rxMethod<SubmitDonationParams>(
        pipe(
          tap(() =>
            patchState(store, {
              submitting: true,
              error: null,
            })
          ),
          switchMap(({ uid, displayName, email, proof, note, isPremium }) =>
            from(
              donationService.createOrUpdateRequest(
                uid,
                displayName,
                email,
                proof,
                note,
                isPremium
              )
            ).pipe(
              tapResponse({
                next: () => {
                  patchState(store, { submitting: false });
                  toastService.success('贊助申請已送出，我們會儘快審核！');
                  // 重新載入申請列表
                  from(donationService.getMyRequests(uid)).subscribe({
                    next: (myRequests) => patchState(store, { myRequests }),
                  });
                },
                error: (error: Error) => {
                  patchState(store, {
                    error: error.message || '申請送出失敗',
                    submitting: false,
                  });
                  toastService.error(error.message || '申請送出失敗，請稍後再試');
                },
              })
            )
          )
        )
      ),

      /**
       * 撤回申請
       */
      withdrawRequest: rxMethod<WithdrawRequestParams>(
        pipe(
          tap(() =>
            patchState(store, {
              submitting: true,
              error: null,
            })
          ),
          switchMap(({ requestId, uid }) =>
            from(donationService.withdrawRequest(requestId, uid)).pipe(
              tapResponse({
                next: () => {
                  patchState(store, { submitting: false });
                  toastService.success('已撤回申請');
                  // 重新載入申請列表
                  from(donationService.getMyRequests(uid)).subscribe({
                    next: (myRequests) => patchState(store, { myRequests }),
                  });
                },
                error: (error: Error) => {
                  patchState(store, {
                    error: error.message || '撤回失敗',
                    submitting: false,
                  });
                  toastService.error('撤回失敗，請稍後再試');
                },
              })
            )
          )
        )
      ),

      /**
       * 標記過期申請
       */
      markAsExpired: rxMethod<MarkExpiredParams>(
        pipe(
          switchMap(({ uid, premiumUntil, role }) => {
            // 如果 premiumUntil 已過期且 role 是 free，標記為過期
            if (premiumUntil < new Date() && role === 'free') {
              return from(donationService.markAsExpired(uid)).pipe(
                tapResponse({
                  next: () => {
                    // 靜默成功
                  },
                  error: (error: Error) => {
                    console.error('Failed to mark as expired:', error);
                  },
                })
              );
            }
            return from(Promise.resolve());
          })
        )
      ),

      /**
       * 為使用者初始化贊助申請資料
       * - 載入使用者的申請記錄
       * - 檢查並標記過期的申請
       */
      initForUser(userData: UserData, isPremium: boolean): void {
        // Premium 使用者不需要載入申請（已經是贊助會員）
        if (isPremium) return;

        // 載入申請記錄
        this.loadMyRequests(userData.uid);

        // 檢查是否有過期的申請需要標記
        const quotation = userData.platforms?.quotation;
        if (quotation?.premiumUntil) {
          this.markAsExpired({
            uid: userData.uid,
            premiumUntil: quotation.premiumUntil.toDate(),
            role: quotation.role || 'free',
          });
        }
      },

      /**
       * 清除錯誤
       */
      clearError(): void {
        patchState(store, { error: null });
      },

      /**
       * 重置狀態
       */
      reset(): void {
        patchState(store, initialState);
      },
    })
  )
);
