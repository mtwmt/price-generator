import {
  Component,
  computed,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';

import {
  LucideChevronDown,
  LucideFilePlus,
  LucideHistory,
  LucideSearch,
  LucideX,
} from '@lucide/angular';
import { QuotationData } from '@app/features/quotation/models/quotation.model';
import { filterQuotationHistory } from './quotation-history.utils';

/**
 * 歷史記錄元件
 * 顯示可搜尋、捲動的報價單歷史記錄，支援載入、刪除、建立新表單
 */
@Component({
  selector: 'app-quotation-history',
  standalone: true,
  imports: [
    LucideChevronDown,
    LucideFilePlus,
    LucideHistory,
    LucideSearch,
    LucideX,
  ],
  templateUrl: './quotation-history.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotationHistory {
  // Inputs
  readonly history = input.required<QuotationData[]>();
  readonly selectedIndex = input<number | null>(null);

  readonly searchQuery = signal('');
  readonly filteredHistory = computed(() =>
    filterQuotationHistory(this.history(), this.searchQuery())
  );

  // Outputs
  readonly load = output<number>();
  readonly delete = output<number>();
  readonly createNew = output<void>();

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  /**
   * 載入歷史記錄
   */
  onLoad(index: number): void {
    this.load.emit(index);
  }

  /**
   * 刪除歷史記錄
   */
  onDelete(index: number, event: Event): void {
    event.stopPropagation();
    // 關閉 daisyUI dropdown，避免與確認對話框焦點衝突
    (document.activeElement as HTMLElement)?.blur();
    this.delete.emit(index);
  }

  /**
   * 建立新表單
   */
  onCreateNew(): void {
    this.createNew.emit();
  }
}
