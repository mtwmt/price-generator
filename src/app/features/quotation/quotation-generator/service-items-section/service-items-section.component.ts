import { Component, input, output, computed, ChangeDetectionStrategy, ChangeDetectorRef, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormArray, ReactiveFormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import {
  LucideGripVertical,
  LucideListPlus,
  LucidePencil,
  LucideShoppingCart,
  LucideTrash2,
} from '@lucide/angular';
import { ServiceItemControlComponent } from '@app/features/quotation/service-item-control/service-item-control.component';
import { ServiceItemTemplate } from '@app/features/quotation/models/quotation.model';
import { SearchableSelectComponent } from '@app/shared/components/searchable-select/searchable-select.component';

/**
 * 服務項目區塊元件
 * 包含服務項目列表（支援拖曳排序）與常用服務項目操作
 */
@Component({
  selector: 'app-service-items-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideGripVertical,
    LucideListPlus,
    LucidePencil,
    LucideShoppingCart,
    LucideTrash2,
    ServiceItemControlComponent,
    SearchableSelectComponent,
    DragDropModule,
  ],
  templateUrl: './service-items-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceItemsSection {
  // Inputs
  readonly form = input.required<FormGroup>();
  readonly advancedMode = input(false);
  readonly serviceItemTemplates = input<ServiceItemTemplate[]>([]);
  readonly selectedServiceItemTemplateId = input<string>('');

  readonly selectedServiceItemTemplate = computed(() => {
    const id = this.selectedServiceItemTemplateId();
    return id
      ? this.serviceItemTemplates().find((template) => template.id === id) ?? null
      : null;
  });

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
  readonly selectServiceItemTemplate = output<string>();
  readonly applyServiceItemTemplate = output<void>();
  readonly renameServiceItemTemplate = output<void>();
  readonly deleteServiceItemTemplate = output<void>();

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

  onSelectServiceTemplate(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectServiceItemTemplate.emit(target.value);
  }

  onApplyServiceTemplate(): void {
    this.applyServiceItemTemplate.emit();
  }

  onRenameServiceTemplate(): void {
    this.renameServiceItemTemplate.emit();
  }

  onDeleteServiceTemplate(): void {
    this.deleteServiceItemTemplate.emit();
  }
}
