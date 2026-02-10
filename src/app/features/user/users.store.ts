import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, pipe, switchMap, tap } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { UserData, UpdateUserRoleParams } from '@app/features/user/user.model';
import { AdminApiService } from '@app/core/services/admin-api.service';
import { UserApiMapper } from '@app/core/mappers/user-api.mapper';
import { ToastService } from '@app/shared/services/toast.service';

/**
 * 使用者資料狀態
 */
interface UsersState {
  users: UserData[];
  searchQuery: string;
  loading: boolean;
  updating: boolean;
  error: string | null;
}

const initialState: UsersState = {
  users: [],
  searchQuery: '',
  loading: false,
  updating: false,
  error: null,
};

/**
 * 使用者資料 Store（全局）
 *
 * 職責：管理使用者資料的載入、更新
 */
export const UsersStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed(({ users, searchQuery }) => ({
    totalUsers: computed(() => users().length),
    hasUsers: computed(() => users().length > 0),
    filteredUsers: computed(() => {
      const query = searchQuery().toLowerCase().trim();
      if (!query) return users();

      return users().filter(
        (user) =>
          user.displayName?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query)
      );
    }),
  })),

  withMethods(
    (
      store,
      adminApiService = inject(AdminApiService),
      toastService = inject(ToastService)
    ) => ({
      loadUsers: rxMethod<number | void>(
        pipe(
          tap(() =>
            patchState(store, {
              loading: true,
              error: null,
            })
          ),
          switchMap((maxResults) =>
            adminApiService
              .getAllUsers(
                maxResults !== undefined &&
                  maxResults !== null &&
                  typeof maxResults === 'number'
                  ? maxResults
                  : undefined
              )
              .pipe(
                tapResponse({
                  next: (response: any) => {
                    const users = UserApiMapper.mapMany(response.data);
                    patchState(store, {
                      users,
                      loading: false,
                    });
                  },
                  error: (error: Error) => {
                    patchState(store, {
                      error: error.message || '載入使用者列表失敗',
                      loading: false,
                    });
                    toastService.error('載入使用者列表失敗');
                  },
                })
              )
          )
        )
      ),
      updateUserRole: rxMethod<UpdateUserRoleParams>(
        pipe(
          tap(() =>
            patchState(store, {
              updating: true,
              error: null,
            })
          ),
          switchMap(({ uid, role, premiumUntil }) =>
            adminApiService.updateUserRole(uid, role, premiumUntil).pipe(
              switchMap(() => {
                patchState(store, { updating: false });
                toastService.success('使用者權限已更新');
                return adminApiService.getAllUsers().pipe(
                  catchError(() => EMPTY)
                );
              }),
              tapResponse({
                next: (res: any) => {
                  const users = UserApiMapper.mapMany(res.data);
                  patchState(store, { users });
                },
                error: (error: Error) => {
                  patchState(store, {
                    error: error.message || '更新使用者權限失敗',
                    updating: false,
                  });
                  toastService.error('更新使用者權限失敗');
                },
              })
            )
          )
        )
      ),
      deleteUser: rxMethod<string>(
        pipe(
          tap(() =>
            patchState(store, {
              updating: true,
              error: null,
            })
          ),
          switchMap((uid) =>
            adminApiService.deleteUser(uid).pipe(
              tapResponse({
                next: () => {
                  // 從本地列表移除
                  const users = store.users().filter((u) => u.uid !== uid);
                  patchState(store, { users, updating: false });
                  toastService.success('使用者已刪除');
                },
                error: (error: Error) => {
                  patchState(store, {
                    error: error.message || '刪除使用者失敗',
                    updating: false,
                  });
                  toastService.error('刪除使用者失敗');
                },
              })
            )
          )
        )
      ),

      /**
       * 清除錯誤
       */
      clearError(): void {
        patchState(store, { error: null });
      },

      /**
       * 設定搜尋關鍵字
       */
      setSearchQuery(query: string): void {
        patchState(store, { searchQuery: query });
      },
    })
  )
);
