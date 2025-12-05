import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormArray, ReactiveFormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import {
  LucideAngularModule,
  ShoppingCart,
  ListPlus,
  GripVertical,
} from 'lucide-angular';
import { ServiceItemControlComponent } from '@app/features/quotation/service-item-control/service-item-control.component';

/**
 * 服務項目區塊元件
 * 包含服務項目列表（支援拖曳排序）、折扣設定、稅別設定、金額統計
 */
@Component({
  selector: 'app-service-items-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    ServiceItemControlComponent,
    DragDropModule,
  ],
  templateUrl: './service-items-section.component.html',
})
export class ServiceItemsSection {
  // Icons
  readonly ShoppingCart = ShoppingCart;
  readonly ListPlus = ListPlus;
  readonly GripVertical = GripVertical;

  // Inputs
  readonly form = input.required<FormGroup>();

  // Outputs
  readonly addField = output<void>();
  readonly removeField = output<number>();
  readonly drop = output<CdkDragDrop<string[]>>();
  readonly taxRateChange = output<Event>();
  readonly normalizePercentageValue = output<void>();
  readonly normalizeDiscountAmount = output<void>();

  /**
   * 取得服務項目 FormArray
   */
  get serviceItems(): FormArray {
    return this.form().get('serviceItems') as FormArray;
  }

  /**
   * 新增服務項目
   */
  onAddField(): void {
    this.addField.emit();
  }

  /**
   * 移除服務項目
   */
  onRemoveField(index: number): void {
    this.removeField.emit(index);
  }

  /**
   * 拖曳排序
   */
  onDrop(event: CdkDragDrop<string[]>): void {
    this.drop.emit(event);
  }

  /**
   * 稅率變更
   */
  onTaxRateChange(event: Event): void {
    this.taxRateChange.emit(event);
  }

  /**
   * 標準化稅率百分比
   */
  normalizePercentage(): void {
    this.normalizePercentageValue.emit();
  }

  /**
   * 標準化折扣值
   */
  normalizeDiscountValue(): void {
    this.normalizeDiscountAmount.emit();
  }
}
