import { Injectable } from '@angular/core';
import {
  getFirestore,
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  collection,
  query,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import {
  UserData,
  UserRole,
  PlatformType,
} from '@app/features/user/shared/models/user.model';

/**
 * Firestore 服務
 * 處理使用者權限資料的讀寫
 */
@Injectable({
  providedIn: 'root',
})
export class FirestoreService {
  private db: Firestore | null = null;
  private readonly USERS_COLLECTION = 'users';
  private readonly CURRENT_PLATFORM: PlatformType = 'quotation';

  /**
   * 初始化 Firestore
   * 必須在 Firebase App 初始化後呼叫
   */
  initializeFirestore(): void {
    this.db = getFirestore();
  }

  /**
   * 取得使用者資料
   * @param uid 使用者 UID
   * @returns 使用者資料或 null
   */
  async getUserData(uid: string): Promise<UserData | null> {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }

    try {
      const userDocRef = doc(this.db, this.USERS_COLLECTION, uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        return null;
      }

      return userDoc.data() as UserData;
    } catch (error) {
      console.error('Failed to get user data:', error);
      throw error;
    }
  }

  /**
   * 建立新使用者資料
   * @param uid 使用者 UID
   * @param email 使用者 Email
   * @param displayName 使用者顯示名稱
   * @param photoURL 使用者頭像 URL
   */
  async createUserData(
    uid: string,
    email: string | null,
    displayName: string | null,
    photoURL: string | null
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }

    try {
      const userDocRef = doc(this.db, this.USERS_COLLECTION, uid);
      const now = serverTimestamp();

      const userData = {
        uid,
        email,
        displayName,
        photoURL,
        platforms: {
          [this.CURRENT_PLATFORM]: {
            role: 'free',
            firstAccessTime: now,
            lastAccessTime: now,
          },
        },
        createdTime: now,
        updatedTime: now,
      };

      await setDoc(userDocRef, userData);
    } catch (error) {
      console.error('Failed to create user data:', error);
      throw error;
    }
  }

  /**
   * 更新使用者在當前平台的角色
   * @param uid 使用者 UID
   * @param role 新角色
   * @param premiumUntil 贊助到期日（可選）
   */
  async updateUserRole(
    uid: string,
    role: UserRole,
    premiumUntil?: Date | null
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }

    try {
      const userDocRef = doc(this.db, this.USERS_COLLECTION, uid);

      const updateData: any = {
        [`platforms.${this.CURRENT_PLATFORM}.role`]: role,
        updatedTime: serverTimestamp(),
      };

      if (premiumUntil !== undefined) {
        updateData[`platforms.${this.CURRENT_PLATFORM}.premiumUntil`] =
          premiumUntil ? Timestamp.fromDate(premiumUntil) : null;
      }

      await updateDoc(userDocRef, updateData);
    } catch (error) {
      console.error('Failed to update user role:', error);
      throw error;
    }
  }

  /**
   * 檢查使用者是否為贊助會員
   * @param userData 使用者資料
   * @returns 是否為有效的贊助會員
   */
  isPremiumUser(userData: UserData | null): boolean {
    if (!userData) {
      return false;
    }

    const platformData = userData.platforms[this.CURRENT_PLATFORM];

    if (!platformData || platformData.role !== 'premium') {
      return false;
    }

    // 如果有設定到期日，檢查是否已過期
    if (platformData.premiumUntil) {
      return platformData.premiumUntil.toDate() > new Date();
    }

    // 沒有設定到期日，視為永久贊助會員
    return true;
  }

  /**
   * 記錄使用者存取當前平台
   * 如果是新平台，自動初始化該平台權限
   */
  async recordPlatformAccess(uid: string): Promise<void> {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }

    try {
      const userDocRef = doc(this.db, this.USERS_COLLECTION, uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        console.error('User document does not exist:', uid);
        return;
      }

      const userData = userDoc.data() as UserData;
      const currentPlatformData = userData.platforms[this.CURRENT_PLATFORM];

      if (!currentPlatformData) {
        // 新平台：初始化權限
        await updateDoc(userDocRef, {
          [`platforms.${this.CURRENT_PLATFORM}`]: {
            role: 'free',
            firstAccessTime: serverTimestamp(),
            lastAccessTime: serverTimestamp(),
          },
          updatedTime: serverTimestamp(),
        });
      } else {
        // 已存在平台：更新最後存取時間
        await updateDoc(userDocRef, {
          [`platforms.${this.CURRENT_PLATFORM}.lastAccessTime`]:
            serverTimestamp(),
          updatedTime: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Failed to record platform access:', error);
      throw error;
    }
  }

  /**
   * 取得或建立使用者資料
   * 如果使用者不存在，會自動建立新資料
   */
  async getOrCreateUserData(
    uid: string,
    email: string | null,
    displayName: string | null,
    photoURL: string | null
  ): Promise<UserData> {
    let userData = await this.getUserData(uid);

    if (!userData) {
      await this.createUserData(uid, email, displayName, photoURL);
      userData = await this.getUserData(uid);

      if (!userData) {
        throw new Error('Failed to create user data');
      }
    }

    return userData;
  }

  /**
   * 取得所有使用者列表（管理員專用）
   * @param maxResults 最多回傳幾筆資料（預設 100）
   * @returns 使用者列表
   */
  async getAllUsers(maxResults: number = 100): Promise<UserData[]> {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }

    try {
      const usersRef = collection(this.db, this.USERS_COLLECTION);
      const q = query(
        usersRef,
        orderBy('createdTime', 'desc'),
        limit(maxResults)
      );
      const querySnapshot = await getDocs(q);

      const users: UserData[] = [];
      querySnapshot.forEach((doc) => {
        users.push(doc.data() as UserData);
      });

      return users;
    } catch (error) {
      console.error('Failed to get all users:', error);
      throw error;
    }
  }

  /**
   * 更新使用者資料（管理員專用）
   * @param uid 使用者 UID
   * @param updates 要更新的欄位
   */
  async updateUser(
    uid: string,
    updates: Partial<Omit<UserData, 'uid' | 'createdTime' | 'updatedTime'>>
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }

    try {
      const userDocRef = doc(this.db, this.USERS_COLLECTION, uid);

      const updateData: any = {
        ...updates,
        updatedTime: serverTimestamp(),
      };

      await updateDoc(userDocRef, updateData);
    } catch (error) {
      console.error('Failed to update user:', error);
      throw error;
    }
  }

  /**
   * 刪除使用者（管理員專用）
   * @param uid 使用者 UID
   */
  async deleteUser(uid: string): Promise<void> {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }

    try {
      const userDocRef = doc(this.db, this.USERS_COLLECTION, uid);
      await deleteDoc(userDocRef);
    } catch (error) {
      console.error('Failed to delete user:', error);
      throw error;
    }
  }
}
