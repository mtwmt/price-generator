import { Injectable, inject } from '@angular/core';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { DonationRequest } from '@app/features/user/shared/models/user.model';
import { FirestoreService } from './firestore.service';

@Injectable({
  providedIn: 'root',
})
export class DonationService {
  private readonly firestoreService = inject(FirestoreService);
  private readonly db = getFirestore();
  private readonly COLLECTION_NAME = 'donations';

  /**
   * 建立或更新贊助申請（防止重複申請）
   * @param isPremium 使用者目前是否為 Premium（用於判斷 approved 狀態是否能重新申請）
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
      const requestsRef = collection(this.db, this.COLLECTION_NAME);

      // 先查詢是否已有該使用者的申請
      const q = query(requestsRef, where('uid', '==', uid));
      const snapshot = await getDocs(q);

      const now = serverTimestamp();

      if (!snapshot.empty) {
        // 如果已有申請
        const existingDoc = snapshot.docs[0];
        const existingData = existingDoc.data() as DonationRequest;

        // 根據現有申請的狀態決定如何處理
        if (existingData.status === 'pending') {
          // 如果已經在審核中，不允許再次提交
          throw new Error('您的申請正在審核中，請耐心等候');
        } else if (existingData.status === 'approved') {
          // 如果已經核准
          if (isPremium) {
            // 仍然是 Premium，不需要再申請
            throw new Error('您已經是贊助會員了');
          } else {
            // 已被管理員降級，允許重新申請
            await updateDoc(
              doc(this.db, this.COLLECTION_NAME, existingDoc.id),
              {
                proof,
                note,
                status: 'pending',
                updatedAt: now,
              }
            );
          }
        } else if (
          existingData.status === 'rejected' ||
          existingData.status === 'expired'
        ) {
          // rejected 或 expired 的申請可以重新提交
          await updateDoc(doc(this.db, this.COLLECTION_NAME, existingDoc.id), {
            proof,
            note,
            status: 'pending', // 重設為 pending
            updatedAt: now,
          });
        }
      } else {
        // 如果沒有申請，建立新的
        const request: Omit<DonationRequest, 'id'> = {
          uid,
          userDisplayName,
          userEmail,
          proof,
          note,
          status: 'pending',
          createdAt: now as Timestamp,
          updatedAt: now as Timestamp,
        };

        await addDoc(requestsRef, request);
      }
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
      const requestsRef = collection(this.db, this.COLLECTION_NAME);
      const q = query(
        requestsRef,
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DonationRequest[];
    } catch (error) {
      console.error('Failed to get pending requests:', error);
      throw error;
    }
  }

  /**
   * 取得使用者自己的申請 (顯示 pending, rejected, expired)
   */
  async getMyRequests(uid: string): Promise<DonationRequest[]> {
    try {
      const requestsRef = collection(this.db, this.COLLECTION_NAME);
      const q = query(
        requestsRef,
        where('uid', '==', uid),
        where('status', 'in', ['pending', 'rejected', 'expired']),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DonationRequest[];
    } catch (error) {
      console.error('Failed to get my requests:', error);
      throw error;
    }
  }

  /**
   * 撤回申請（使用者用）
   * @param requestId 申請 ID
   * @param uid 使用者 UID（設定為 reviewedBy 以區分自己取消和被拒絕）
   */
  async withdrawRequest(requestId: string, uid: string): Promise<void> {
    try {
      const requestRef = doc(this.db, this.COLLECTION_NAME, requestId);
      await updateDoc(requestRef, {
        status: 'rejected',
        reviewedBy: uid, // 設定為自己的 UID，表示是自己取消
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to withdraw request:', error);
      throw error;
    }
  }

  /**
   * 取得已處理的申請 (管理員用 - 歷史紀錄)
   */
  async getProcessedRequests(): Promise<DonationRequest[]> {
    try {
      const requestsRef = collection(this.db, this.COLLECTION_NAME);
      const q = query(
        requestsRef,
        where('status', 'in', ['approved', 'rejected']),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DonationRequest[];
    } catch (error) {
      console.error('Failed to get processed requests:', error);
      throw error;
    }
  }

  /**
   * 重設申請狀態為 pending (管理員用)
   */
  async resetRequestStatus(requestId: string): Promise<void> {
    try {
      const requestRef = doc(this.db, this.COLLECTION_NAME, requestId);
      await updateDoc(requestRef, {
        status: 'pending',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to reset request status:', error);
      throw error;
    }
  }

  /**
   * 核准申請
   */
  async approveRequest(
    requestId: string,
    adminUid: string,
    userUid: string
  ): Promise<void> {
    try {
      // 1. 更新申請狀態
      const requestRef = doc(this.db, this.COLLECTION_NAME, requestId);
      const now = serverTimestamp();

      await updateDoc(requestRef, {
        status: 'approved',
        reviewedBy: adminUid,
        reviewedAt: now,
        updatedAt: now,
      });

      // 2. 計算新的到期日（從今天起算 1 個月）
      const premiumUntil = new Date();
      premiumUntil.setMonth(premiumUntil.getMonth() + 1);

      // 3. 更新使用者權限為 premium，並設定新的到期日
      await this.firestoreService.updateUserRole(
        userUid,
        'premium',
        premiumUntil
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
      const requestRef = doc(this.db, this.COLLECTION_NAME, requestId);
      const now = serverTimestamp();

      await updateDoc(requestRef, {
        status: 'rejected',
        reviewedBy: adminUid,
        reviewedAt: now,
        updatedAt: now,
      });
    } catch (error) {
      console.error('Failed to reject request:', error);
      throw error;
    }
  }

  /**
   * 標記申請為已過期（當 premium 會員到期時）
   */
  async markAsExpired(uid: string): Promise<void> {
    try {
      const requestsRef = collection(this.db, this.COLLECTION_NAME);
      const q = query(
        requestsRef,
        where('uid', '==', uid),
        where('status', '==', 'approved')
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const docRef = snapshot.docs[0].ref;
        await updateDoc(docRef, {
          status: 'expired',
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Failed to mark request as expired:', error);
      throw error;
    }
  }
}
