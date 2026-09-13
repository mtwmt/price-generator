import { Component, input, output, ChangeDetectionStrategy, ChangeDetectorRef, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormArray, ReactiveFormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import {
  LucideGripVertical,
  LucideListPlus,
  LucideShoppingCart,
} from '@lucide/angular';
import { ServiceItemControlComponent } from '@app/features/quotation/service-item-control/service-item-control.component';

/**
 * 服務項目區塊元件
 * 包含服務項目列表（支援拖曳排序）
 */
@Component({
  selector: 'app-service-items-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideGripVertical,
    LucideListPlus,
    LucideShoppingCart,
    ServiceItemControlComponent,
    DragDropModule,
  ],
  templateUrl: './service-items-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceItemsSection {
  // Inputs
  readonly form = input.required<FormGroup>();
  readonly advancedMode = input(false);
  private readonly changeDetector = inject(ChangeDetectorRef);
  // Parent-side template application mutates FormArray without replacing FormGroup.
  // An OnPush child must be marked even when the originating click was outside it.
  private readonly formChanges = effect((onCleanup) => {
    const subscription = this.form().valueChanges.subscribe(() => this.changeDetector.markForCheck());
    onCleanup(() => subscription.unsubscribe());
  });

  // Outputs
  readonly addField = output<void>();
  readonly removeField = output<number>();
  readonly copyField = output<number>();
  readonly saveTemplate = output<number>();
  readonly drop = output<CdkDragDrop<string[]>>();

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
   * 複製服務項目
   */
  onCopyField(index: number): void {
    this.copyField.emit(index);
  }

  onSaveTemplate(index: number): void {
    this.saveTemplate.emit(index);
  }

  /**
   * 拖曳排序
   */
  onDrop(event: CdkDragDrop<string[]>): void {
    this.drop.emit(event);
  }
}
