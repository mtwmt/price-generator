import { Injectable, inject } from '@angular/core';
import { StorageService } from '@app/shared/services/storage.service';
import { QuotationData } from '@app/features/quotation/models/quotation.model';

/**
 * 報價單歷史記錄管理服務
 * 負責報價單資料的儲存、讀取、刪除
 */
@Injectable({
  providedIn: 'root',
})
export class QuotationStorageService {
  private readonly storage = inject(StorageService);

  // Constants
  private readonly STORAGE_KEY = 'quotation';
  private readonly MAX_HISTORY_ITEMS = 5;

  /**
   * 取得歷史記錄列表
   * @returns 歷史記錄陣列（最多 5 筆）
   */
  getHistory(): QuotationData[] {
    return this.storage.get<QuotationData[]>(this.STORAGE_KEY, []);
  }

  /**
   * 儲存報價單到歷史記錄
   * 新記錄會插入到最前面，超過 5 筆會自動刪除最舊的
   * @param quotation 要儲存的報價單資料
   * @returns 是否成功儲存
   */
  saveToHistory(quotation: QuotationData): boolean {
    const history = this.getHistory();
    const newHistory = [quotation, ...history];

    // 限制最多 5 筆
    const limitedHistory = this.limitHistorySize(newHistory);

    return this.storage.set(this.STORAGE_KEY, limitedHistory);
  }

  /**
   * 從歷史記錄中刪除指定索引的項目
   * @param index 要刪除的索引（0-based）
   * @returns 是否成功刪除
   */
  deleteFromHistory(index: number): boolean {
    const history = this.getHistory();

    // 檢查索引是否有效
    if (index < 0 || index >= history.length) {
      console.warn(`Invalid history index: ${index}`);
      return false;
    }

    // 移除指定索引的項目
    const newHistory = [...history];
    newHistory.splice(index, 1);

    return this.storage.set(this.STORAGE_KEY, newHistory);
  }

  /**
   * 清空所有歷史記錄
   * @returns 是否成功清空
   */
  clearHistory(): boolean {
    return this.storage.set(this.STORAGE_KEY, []);
  }

  /**
   * 取得歷史記錄數量
   * @returns 歷史記錄筆數
   */
  getHistoryCount(): number {
    return this.getHistory().length;
  }

  /**
   * 檢查是否有歷史記錄
   * @returns 是否有記錄
   */
  hasHistory(): boolean {
    return this.getHistoryCount() > 0;
  }

  /**
   * 限制歷史記錄數量
   * @param history 歷史記錄陣列
   * @returns 限制後的陣列（最多 5 筆）
   */
  private limitHistorySize(history: QuotationData[]): QuotationData[] {
    if (history.length > this.MAX_HISTORY_ITEMS) {
      return history.slice(0, this.MAX_HISTORY_ITEMS);
    }
    return history;
  }
}
