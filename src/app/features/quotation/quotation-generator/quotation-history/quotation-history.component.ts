import {
  Component,
  computed,
  HostListener,
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
import type {
  QuotationStorageRecoveryBackup,
  QuotationStorageRecoveryInfo,
} from '@app/features/quotation/services/quotation-storage.service';
import { filterQuotationHistory } from './quotation-history.utils';
import { quotationStatusLabel } from '../../utils/quotation-lifecycle';

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
  readonly statusLabel = quotationStatusLabel;
  readonly metadataIncomplete = input(false);
  /** 免費會員的本機歷史固定只有少量筆數，不需要搜尋入口。 */
  readonly searchEnabled = input(false);
  // Inputs
  readonly history = input.required<QuotationData[]>();
  readonly selectedIndex = input<number | null>(null);
  /** 由容器提供；元件只負責本機 UI，不直接讀寫任何 storage key。 */
  readonly recovery = input<QuotationStorageRecoveryInfo | null>(null);
  readonly recoveryBackup = input<QuotationStorageRecoveryBackup | null>(null);
  readonly legacyCandidates = input<QuotationData[]>([]);

  readonly searchQuery = signal('');
  readonly selectedLegacyIndexes = signal<readonly number[]>([]);
  readonly alignDropdownEnd = signal(false);
  private dropdownTrigger: HTMLElement | null = null;
  readonly filteredHistory = computed(() =>
    filterQuotationHistory(this.history(), this.searchEnabled() ? this.searchQuery() : '')
  );

  // Outputs
  readonly load = output<number>();
  readonly delete = output<number>();
  readonly createNew = output<void>();
  /** 指派容器執行認領，避免子元件在帳號切換時取得過期 scope。 */
  readonly claimLegacy = output<readonly number[]>();
  /** 容器須在讀取檔案前後確認目前 scope，避免非同步讀取寫入另一個帳號。 */
  readonly restoreRecovery = output<File>();

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  updateDropdownAlignment(event: Event): void {
    const trigger = event.currentTarget;
    if (!(trigger instanceof HTMLElement) || typeof window === 'undefined') return;
    this.dropdownTrigger = trigger;
    this.updateDropdownAlignmentFor(trigger);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateDropdownAlignmentFor(this.dropdownTrigger);
  }

  private updateDropdownAlignmentFor(trigger: HTMLElement | null): void {
    const panel = trigger?.parentElement?.querySelector<HTMLElement>('.dropdown-content');
    const panelWidth = panel?.getBoundingClientRect().width ?? 0;
    if (!trigger?.isConnected || panelWidth <= 0) return;
    this.alignDropdownEnd.set(trigger.getBoundingClientRect().right >= panelWidth);
  }

  clearSearch(searchInput: HTMLInputElement, event: MouseEvent): void {
    event.preventDefault();
    this.searchQuery.set('');
    searchInput.focus();
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

  isLegacySelected(index: number): boolean {
    return this.selectedLegacyIndexes().includes(index);
  }

  toggleLegacyCandidate(index: number, checked: boolean): void {
    this.selectedLegacyIndexes.update((selected) => {
      const next = new Set(selected);
      checked ? next.add(index) : next.delete(index);
      return [...next].sort((left, right) => left - right);
    });
  }

  claimSelectedLegacy(): void {
    const valid = this.selectedLegacyIndexes().filter(
      (index) => index >= 0 && index < this.legacyCandidates().length
    );
    if (valid.length > 0) this.claimLegacy.emit(valid);
  }

  downloadRecoveryBackup(): void {
    const backup = this.recoveryBackup();
    if (!backup || typeof document === 'undefined') return;
    const url = URL.createObjectURL(new Blob([backup.content], { type: backup.mimeType }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = backup.fileName;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  onRecoveryFileSelected(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const file = inputElement.files?.[0];
    // Permit choosing the same file again after an unsuccessful restore.
    inputElement.value = '';
    if (!file) return;
    this.restoreRecovery.emit(file);
  }
}
