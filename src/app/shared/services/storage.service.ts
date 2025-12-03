import { Injectable, inject } from '@angular/core';
import { ToastService } from './toast.service';

/**
 * 統一管理 localStorage 的服務
 * 提供型別安全的讀寫、錯誤處理、使用者友善的通知
 */
@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly toastService = inject(ToastService);

  /**
   * 從 localStorage 讀取資料
   * @param key 儲存鍵值
   * @param defaultValue 預設值（讀取失敗或不存在時返回）
   * @returns 讀取的資料或預設值
   */
  get<T>(key: string, defaultValue: T): T {
    try {
      const raw = localStorage.getItem(key);

      if (!raw) {
        return defaultValue;
      }

      const parsed = JSON.parse(raw);
      return parsed as T;
    } catch (error) {
      console.error(`Failed to read from localStorage (key: ${key}):`, error);
      this.toastService.warning('讀取資料失敗，已使用預設值');
      return defaultValue;
    }
  }

  /**
   * 寫入資料到 localStorage
   * @param key 儲存鍵值
   * @param value 要儲存的資料
   * @returns 是否成功儲存
   */
  set<T>(key: string, value: T): boolean {
    try {
      const json = JSON.stringify(value);
      localStorage.setItem(key, json);
      return true;
    } catch (error) {
      console.error(`Failed to write to localStorage (key: ${key}):`, error);

      // 檢查是否為容量超出錯誤
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.toastService.error('儲存空間已滿，請清理瀏覽器資料');
      } else {
        this.toastService.error('儲存失敗，請稍後再試');
      }

      return false;
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
      console.error(`Failed to remove from localStorage (key: ${key}):`, error);
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
      console.error('Failed to clear localStorage:', error);
      this.toastService.error('清空資料失敗');
    }
  }

  /**
   * 檢查指定鍵值是否存在
   * @param key 要檢查的鍵值
   * @returns 是否存在
   */
  has(key: string): boolean {
    return localStorage.getItem(key) !== null;
  }
}
