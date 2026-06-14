import { Injectable, inject } from '@angular/core';
import { StorageService } from '@app/shared/services/storage.service';
import { LoggerService } from '@app/shared/services/logger.service';
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
  private readonly logger = inject(LoggerService);

  // Constants
  private readonly STORAGE_KEY = 'quotation';
  private readonly MAX_HISTORY_ITEMS = 5;

  /**
   * 取得歷史記錄列表
   * 自動遷移舊版 multi-tax 格式為現行單一稅別格式
   * @returns 歷史記錄陣列（最多 5 筆）
   */
  getHistory(): QuotationData[] {
    const raw = this.storage.get<Record<string, unknown>[]>(this.STORAGE_KEY, []);
    return raw.map((item) => this.migrateRecord(item));
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
   * 更新（覆蓋）指定索引的歷史記錄
   * 用於載入既有紀錄、修改後原地儲存，避免產生重複筆數
   * @param index 要更新的索引（0-based）
   * @param quotation 更新後的報價單資料
   * @returns 是否成功更新
   */
  updateHistory(index: number, quotation: QuotationData): boolean {
    const history = this.getHistory();

    if (index < 0 || index >= history.length) {
      this.logger.warn(`Invalid history index: ${index}`);
      return false;
    }

    const newHistory = [...history];
    newHistory[index] = quotation;

    return this.storage.set(this.STORAGE_KEY, newHistory);
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
      this.logger.warn(`Invalid history index: ${index}`);
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

  /**
   * 遷移舊版 multi-tax 格式（taxes[] 陣列）為現行單一稅別格式
   * 舊版格式：taxes: [{ name, percentage, amount }]
   * 現行格式：taxName, percentage, tax
   */
  private migrateRecord(record: Record<string, unknown>): QuotationData {
    const taxes = record['taxes'] as Array<{ name: string; percentage: number; amount: number }> | undefined;

    // 已有現行格式的 taxName 或沒有舊版 taxes，無需遷移
    if (!Array.isArray(taxes) || taxes.length === 0 || record['taxName']) {
      return record as unknown as QuotationData;
    }

    // 取第一筆有效稅別
    const firstTax = taxes.find((t) => t.name) || taxes[0];
    if (!firstTax?.name) {
      this.logger.warn('遷移失敗：舊版記錄無有效稅名', { taxes });
      return record as unknown as QuotationData;
    }

    const totalTax = taxes.reduce((sum, t) => sum + (t.amount || 0), 0);

    if (taxes.length > 1) {
      this.logger.warn('遷移舊版 multi-tax 記錄（只保留第一筆稅別）', { taxes, kept: firstTax });
    } else {
      this.logger.warn('遷移舊版 multi-tax 記錄', { taxes });
    }

    const migrated = { ...record };
    migrated['taxName'] = firstTax.name || '';
    migrated['percentage'] = firstTax.percentage || 0;
    migrated['tax'] = totalTax;
    delete migrated['taxes'];
    delete migrated['customTaxOptions'];

    return migrated as unknown as QuotationData;
  }
}
