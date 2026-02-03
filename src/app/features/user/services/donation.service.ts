import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DonationRequest } from '@app/features/user/user.model';
import { DonationApiService } from '@app/core/services/donation-api.service';
import { AdminApiService } from '@app/core/services/admin-api.service';
import { DonationApiMapper } from '@app/core/mappers/donation-api.mapper';
import { NotificationService } from './notification.service';
import { ProfileStore } from '@app/features/user/profile.store';

/**
 * DonationService - Domain Service
 * 職責：處理贊助工作流與業務邏輯。
 * 原則：協調 API Repository 與其他領域服務，不直接處理 HTTP。
 */
@Injectable({
  providedIn: 'root',
})
export class DonationService {
  private readonly donationApi = inject(DonationApiService);
  private readonly adminApi = inject(AdminApiService);
  private readonly notificationService = inject(NotificationService);
  private readonly profileStore = inject(ProfileStore);

  /**
   * 建立或更新贊助申請
   */
  async createOrUpdateRequest(
    uid: string,
    userDisplayName: string,
    userEmail: string,
    proof: string,
    note: string,
    isPremium: boolean = false
  ): Promise<void> {
    try {
      // 0. 權限檢查：Admin 不需要申請
      if (this.profileStore.isAdmin()) {
        throw new Error('管理員不需要申請贊助，您已擁有所有權限');
      }

      // 1. 提交申請 (主要判斷邏輯已移至後端 D1 Service 以維護資料一致性)
      await firstValueFrom(this.donationApi.submitDonation({ note, proof }));
    } catch (error) {
      console.error('Failed to create or update donation request:', error);
      throw error;
    }
  }

  /**
   * 取得待審核的申請 (管理員用)
   */
  async getPendingRequests(): Promise<DonationRequest[]> {
    try {
      const response = await firstValueFrom(
        this.adminApi.getPendingDonations()
      );
      return DonationApiMapper.mapMany(response.data);
    } catch (error) {
      console.error('Failed to get pending requests:', error);
      throw error;
    }
  }

  /**
   * 取得使用者自己的申請
   */
  async getMyRequests(uid: string): Promise<DonationRequest[]> {
    try {
      const response = await firstValueFrom(this.donationApi.getMyDonations());
      return DonationApiMapper.mapMany(response.data);
    } catch (error) {
      console.error('Failed to get my requests:', error);
      throw error;
    }
  }

  /**
   * 核准申請
   */
  async approveRequest(
    requestId: string,
    adminUid: string,
    userUid: string,
    userEmail: string,
    userDisplayName: string
  ): Promise<void> {
    try {
      // 1. 核准申請狀態
      await firstValueFrom(this.adminApi.approveDonation(requestId));

      // 2. 自動更新使用者權限（預設給予 30 天）
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      const premiumUntil = Date.now() + THIRTY_DAYS_MS;

      await firstValueFrom(
        this.adminApi.updateUserRole(userUid, 'premium', premiumUntil)
      );

      // 3. 發送 Email 通知
      await this.notificationService.sendSponsorApprovalEmail(
        userEmail,
        userDisplayName
      );
    } catch (error) {
      console.error('Failed to approve request:', error);
      throw error;
    }
  }

  /**
   * 拒絕申請
   */
  async rejectRequest(requestId: string, adminUid: string): Promise<void> {
    try {
      await firstValueFrom(this.adminApi.rejectDonation(requestId));
    } catch (error) {
      console.error('Failed to reject request:', error);
      throw error;
    }
  }

  /**
   * 撤回申請
   */
  async withdrawRequest(requestId: string, uid: string): Promise<void> {
    try {
      await firstValueFrom(this.donationApi.withdrawDonation(requestId));
    } catch (error) {
      console.error('Failed to withdraw request:', error);
      throw error;
    }
  }

  /**
   * 取得已處理的申請 (管理員用)
   */
  async getProcessedRequests(): Promise<DonationRequest[]> {
    try {
      const response = await firstValueFrom(
        this.adminApi.getProcessedDonations()
      );
      return DonationApiMapper.mapMany(response.data);
    } catch (error) {
      console.error('Failed to get processed requests:', error);
      throw error;
    }
  }

  /**
   * 重新審核 (將狀態重設回 pending)
   */
  async resetRequestStatus(requestId: string): Promise<void> {
    try {
      await firstValueFrom(this.adminApi.resetDonationStatus(requestId));
    } catch (error) {
      console.error('Failed to reset request status:', error);
      throw error;
    }
  }

  /**
   * 標記贊助已過期 (當權限檢查過期後由前端觸發)
   */
  async markAsExpired(uid: string): Promise<void> {
    try {
      await firstValueFrom(this.donationApi.markAsExpired());
    } catch (error) {
      console.error('Failed to mark as expired:', error);
      throw error;
    }
  }

  /**
   * 刪除使用者時清理相關贊助數據 (後端 deleteUser 已內建連動刪除)
   */
  async deleteUserDonations(uid: string): Promise<void> {}
}
