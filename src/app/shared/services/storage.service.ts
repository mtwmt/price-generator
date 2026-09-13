import { Injectable, inject } from '@angular/core';
import { ToastService } from './toast.service';
import { LoggerService } from './logger.service';

/** localStorage JSON 讀取結果。呼叫端可據此區分不存在、格式損壞與存取遭拒。 */
export type StorageReadStatus =
  | 'ok'
  | 'missing'
  | 'parse-failed'
  | 'access-denied';

export interface StorageReadResult<T> {
  readonly status: StorageReadStatus;
  readonly value?: T;
  /** 未經 JSON 解析的原始內容，供資料復原流程建立備份。 */
  readonly raw?: string;
  readonly error?: unknown;
}

export type StorageWriteFailureReason =
  | 'quota-exceeded'
  | 'access-denied'
  | 'serialization-failed'
  | 'write-failed';

export interface StorageWriteResult {
  readonly success: boolean;
  readonly reason?: StorageWriteFailureReason;
  readonly error?: unknown;
}

/**
 * 統一管理 localStorage 的服務
 * 提供型別安全的讀寫、錯誤處理、使用者友善的通知
 */
@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly toastService = inject(ToastService);
  private readonly logger = inject(LoggerService);

  /**
   * 從 localStorage 讀取資料
   * @param key 儲存鍵值
   * @param defaultValue 預設值（讀取失敗或不存在時返回）
   * @returns 讀取的資料或預設值
   */
  get<T>(key: string, defaultValue: T): T {
    const result = this.readJson<T>(key);
    if (result.status === 'ok') return result.value as T;
    if (result.status === 'missing') return defaultValue;

    this.reportReadFailure(key, result);
    return defaultValue;
  }

  /**
   * 讀取並解析 JSON，但不把失敗偽裝成預設值。
   *
   * 資料擁有者（例如報價歷史）應使用此方法，才能在復原前避免覆寫損壞來源。
   */
  readJson<T>(key: string): StorageReadResult<T> {
    const rawResult = this.readRaw(key);
    if (rawResult.status !== 'ok') return rawResult as StorageReadResult<T>;

    try {
      return { status: 'ok', raw: rawResult.raw, value: JSON.parse(rawResult.raw as string) as T };
    } catch (error) {
      return { status: 'parse-failed', raw: rawResult.raw, error };
    }
  }

  /** 讀取未解析內容，讓復原流程可保留原始資料。 */
  readRaw(key: string): StorageReadResult<never> {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? { status: 'missing' } : { status: 'ok', raw };
    } catch (error) {
      return { status: 'access-denied', error };
    }
  }

  /**
   * 寫入資料到 localStorage
   * @param key 儲存鍵值
   * @param value 要儲存的資料
   * @returns 是否成功儲存
   */
  set<T>(key: string, value: T): boolean {
    return this.setDetailed(key, value).success;
  }

  /**
   * 寫入使用者明確選取的復原原文。復原檔可能本來就是無法解析的 JSON，
   * 因此不可 parse/stringify 後再寫入。
   */
  setRawDetailed(key: string, raw: string): StorageWriteResult {
    try {
      localStorage.setItem(key, raw);
      return { success: true };
    } catch (error) {
      return this.reportWriteFailure(key, error);
    }
  }

  /**
   * 寫入 JSON 並回傳可判別的失敗原因；不將容量或權限錯誤誤報為成功。
   */
  setDetailed<T>(key: string, value: T): StorageWriteResult {
    let json: string;
    try {
      json = JSON.stringify(value);
    } catch (error) {
      this.logger.error(`Failed to serialize localStorage data (key: ${key}):`, error);
      this.toastService.error('資料無法序列化，未覆寫既有本機資料');
      return { success: false, reason: 'serialization-failed', error };
    }

    try {
      localStorage.setItem(key, json);
      return { success: true };
    } catch (error) {
      return this.reportWriteFailure(key, error);
    }
  }

  /**
   * 從 localStorage 移除指定鍵值
   * @param key 要移除的鍵值
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      this.logger.error(`Failed to remove from localStorage (key: ${key}):`, error);
    }
  }

  /**
   * 清空所有 localStorage 資料
   * ⚠️ 危險操作，會清除所有資料
   */
  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      this.logger.error('Failed to clear localStorage:', error);
      this.toastService.error('清空資料失敗');
    }
  }

  /**
   * 檢查指定鍵值是否存在
   * @param key 要檢查的鍵值
   * @returns 是否存在
   */
  has(key: string): boolean {
    try {
      return localStorage.getItem(key) !== null;
    } catch (error) {
      this.logger.error(`Failed to access localStorage (key: ${key}):`, error);
      return false;
    }
  }

  private reportReadFailure<T>(key: string, result: StorageReadResult<T>): void {
    this.logger.error(`Failed to read from localStorage (key: ${key}):`, result.error);
    if (result.status === 'parse-failed') {
      this.toastService.warning('本機資料格式損壞，已保留原始內容供復原');
    } else {
      this.toastService.warning('瀏覽器拒絕讀取本機資料，已保留目前表單內容');
    }
  }

  private getWriteFailureReason(error: unknown): StorageWriteFailureReason {
    const name = error instanceof Error ? error.name : '';
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return 'quota-exceeded';
    }
    if (name === 'SecurityError' || name === 'NotAllowedError') {
      return 'access-denied';
    }
    return 'write-failed';
  }

  private reportWriteFailure(key: string, error: unknown): StorageWriteResult {
    const reason = this.getWriteFailureReason(error);
    this.logger.error(`Failed to write to localStorage (key: ${key}):`, error);
    if (reason === 'quota-exceeded') {
      this.toastService.error('儲存空間已滿；請先下載備份，再清理不需要的報價紀錄');
    } else if (reason === 'access-denied') {
      this.toastService.error('瀏覽器拒絕存取本機儲存空間，未覆寫既有資料');
    } else {
      this.toastService.error('儲存失敗，未覆寫既有本機資料，請稍後再試');
    }
    return { success: false, reason, error };
  }
}
