import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  History,
  FilePlus,
  X,
  ChevronDown,
} from 'lucide-angular';
import { QuotationData } from '@app/features/quotation/models/quotation.model';

/**
 * 歷史記錄元件
 * 顯示報價單歷史記錄的 dropdown，支援載入、刪除、建立新表單
 */
@Component({
  selector: 'app-quotation-history',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './quotation-history.component.html',
})
export class QuotationHistory {
  // Icons
  readonly History = History;
  readonly FilePlus = FilePlus;
  readonly X = X;
  readonly ChevronDown = ChevronDown;

  // Inputs
  readonly history = input.required<QuotationData[]>();
  readonly selectedIndex = input<number | null>(null);

  // Outputs
  readonly load = output<number>();
  readonly delete = output<number>();
  readonly createNew = output<void>();

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
    this.delete.emit(index);
  }

  /**
   * 建立新表單
   */
  onCreateNew(): void {
    this.createNew.emit();
  }
}
