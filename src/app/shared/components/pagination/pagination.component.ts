import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * 共用分頁元件
 *
 * @example
 * ```html
 * <app-pagination
 *   [totalItems]="users.length"
 *   [pageSize]="10"
 *   [currentPage]="1"
 *   (pageChange)="onPageChange($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pagination.component.html',
})
export class PaginationComponent {
  // ==================== Inputs ====================

  /** 總資料筆數 */
  totalItems = input.required<number>();

  /** 每頁顯示筆數 */
  pageSize = input<number>(10);

  /** 目前頁碼（1-indexed） */
  currentPage = input<number>(1);

  /** 可選的每頁筆數選項 */
  pageSizeOptions = input<number[]>([5, 10, 20, 50]);

  /** 是否顯示每頁筆數選擇器 */
  showPageSizeSelector = input<boolean>(true);

  /** 是否顯示統計資訊 */
  showInfo = input<boolean>(true);

  /** 最多顯示幾個頁碼按鈕 */
  maxVisiblePages = input<number>(5);

  /** 按鈕大小：xs, sm, md, lg */
  size = input<'xs' | 'sm' | 'md' | 'lg'>('sm');

  // ==================== Outputs ====================

  /** 頁碼變更事件 */
  pageChange = output<number>();

  /** 每頁筆數變更事件 */
  pageSizeChange = output<number>();

  // ==================== Computed Properties ====================

  /** 計算總頁數 */
  totalPages = computed(() => {
    const total = this.totalItems();
    const size = this.pageSize();
    return Math.ceil(total / size) || 1;
  });

  /** 計算可見的頁碼陣列 */
  visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const maxVisible = this.maxVisiblePages();

    if (total <= maxVisible) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;

    if (end > total) {
      end = total;
      start = Math.max(1, end - maxVisible + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });

  /** 取得按鈕 CSS class */
  btnClass = computed(() => {
    const sizeMap = {
      xs: 'btn-xs',
      sm: 'btn-sm',
      md: '',
      lg: 'btn-lg',
    };
    return `join-item btn ${sizeMap[this.size()]}`;
  });

  /** 計算顯示範圍的起始索引 */
  startIndex = computed(() => {
    const total = this.totalItems();
    if (total === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  /** 計算顯示範圍的結束索引 */
  endIndex = computed(() => {
    const end = this.currentPage() * this.pageSize();
    return Math.min(end, this.totalItems());
  });

  /** 是否在第一頁 */
  isFirstPage = computed(() => this.currentPage() <= 1);

  /** 是否在最後一頁 */
  isLastPage = computed(() => this.currentPage() >= this.totalPages());

  // ==================== Methods ====================

  /**
   * 前往指定頁碼
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages() && page !== this.currentPage()) {
      this.pageChange.emit(page);
    }
  }

  /**
   * 前往第一頁
   */
  goToFirstPage(): void {
    this.goToPage(1);
  }

  /**
   * 前往最後一頁
   */
  goToLastPage(): void {
    this.goToPage(this.totalPages());
  }

  /**
   * 前往上一頁
   */
  goToPreviousPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  /**
   * 前往下一頁
   */
  goToNextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  /**
   * 變更每頁筆數
   */
  onPageSizeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const newSize = parseInt(target.value, 10);

    if (newSize !== this.pageSize()) {
      this.pageSizeChange.emit(newSize);
      // 重設到第一頁
      this.pageChange.emit(1);
    }
  }
}

