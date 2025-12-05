import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  OnDestroy,
  Renderer2,
  signal,
  computed,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormArray, ReactiveFormsModule } from '@angular/forms';

import Litepicker from 'litepicker';
import { QuotationPreview } from '@app/features/quotation/quotation-preview/quotation-preview.component';
import { QuotationData } from '@app/features/quotation/models/quotation.model';
import { AnalyticsService } from '@app/core/services/analytics.service';
import { ToastService } from '@app/shared/services/toast.service';
import { QuotationStorageService } from '@app/features/quotation/services/quotation-storage.service';
import { ImageUploadService } from '@app/features/quotation/services/image-upload.service';
import { DatePickerService } from '@app/features/quotation/services/date-picker.service';
import { QuotationFormService } from '@app/features/quotation/services/quotation-form.service';
import { QuotationHistory } from './quotation-history/quotation-history.component';
import { CustomerInfoSection } from './customer-info-section/customer-info-section.component';
import { QuoterInfoSection } from './quoter-info-section/quoter-info-section.component';
import { ServiceItemsSection } from './service-items-section/service-items-section.component';
import { OtherInfoSection } from './other-info-section/other-info-section.component';
import {
  LucideAngularModule,
  Eye,
  FileText,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-angular';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-quotation-generator',
  standalone: true,
  styles: [
    `
      /* Chrome, Safari, Edge, Opera */
      input[type='number']::-webkit-inner-spin-button,
      input[type='number']::-webkit-outer-spin-button {
        -webkit-appearance: none;
        appearance: none;
      }

      /* Firefox */
      input[type='number'] {
        -moz-appearance: textfield;
      }
    `,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    QuotationPreview,
    QuotationHistory,
    CustomerInfoSection,
    QuoterInfoSection,
    ServiceItemsSection,
    OtherInfoSection,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quotation-generator.component.html',
})
export class QuotationGeneratorComponent implements OnInit, OnDestroy {
  // Constants
  private readonly DESKTOP_BREAKPOINT_PX = 1024;

  // Dependencies
  private quotationFormService = inject(QuotationFormService);
  private renderer = inject(Renderer2);
  private analytics = inject(AnalyticsService);
  readonly toastService = inject(ToastService);
  private quotationStorage = inject(QuotationStorageService);
  private imageUploadService = inject(ImageUploadService);
  private datePickerService = inject(DatePickerService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  // View Children
  private startDateInput = viewChild<ElementRef>('startDate');
  private endDateInput = viewChild<ElementRef>('endDate');
  private previewModal =
    viewChild<ElementRef<HTMLDialogElement>>('preview_modal');

  // Listeners
  private resizeListener?: () => void;

  // Icons
  readonly Eye = Eye;
  readonly FileText = FileText;
  readonly Check = Check;
  readonly PanelLeftClose = PanelLeftClose;
  readonly PanelLeftOpen = PanelLeftOpen;

  startDate!: Litepicker;
  endDate!: Litepicker;

  form!: FormGroup;

  // Signals
  historyData = signal<QuotationData[]>([]);
  customerLogo = signal<string>('');
  stamp = signal<string>('');
  quoterLogo = signal<string>('');
  selectedHistoryIndex = signal<number | null>(null);
  showPreview = signal<boolean>(true);

  // Computed
  hasHistory = computed(() => this.historyData().length > 0);

  get serviceItems() {
    return this.form?.get('serviceItems') as FormArray;
  }

  ngOnInit() {
    this.loadHistoryFromLocalStorage();

    // 初始化表單
    this.form = this.quotationFormService.createForm();

    // 預設建立一個服務項目
    this.createServiceItem();

    // 設定監聽器
    this.quotationFormService.setupFormListeners(this.form);

    this.setupResizeListener();
  }

  private loadHistoryFromLocalStorage(): void {
    const history = this.quotationStorage.getHistory();
    this.historyData.set(history);
  }

  private setupResizeListener(): void {
    this.resizeListener = this.renderer.listen('window', 'resize', () => {
      if (this.isDesktopView()) {
        this.closePreviewModal();
      }
    });
  }

  private isDesktopView(): boolean {
    return window.innerWidth >= this.DESKTOP_BREAKPOINT_PX;
  }

  private closePreviewModal(): void {
    const modal = this.previewModal()?.nativeElement;
    if (modal?.open) {
      modal.close();
    }
  }

  normalizeDiscountValue(): void {
    this.quotationFormService.normalizeDiscountValue(this.form);
  }

  normalizePercentage(): void {
    this.quotationFormService.normalizePercentage(this.form);
  }

  onTaxRateChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const taxName = target.value;

    let percentage = 0;
    switch (taxName) {
      case '免稅':
        percentage = 0;
        break;
      case '營業稅':
        percentage = 5;
        break;
      case '二代健保':
        percentage = 2.11;
        break;
      case '自訂':
        // 不自動設定稅率，讓使用者手動輸入
        break;
      default:
        this.form.get('customTaxName')?.patchValue('');
        percentage = 0;
    }

    this.form.patchValue({ percentage });
  }

  async onLogoChange(file: FileList) {
    if (!file?.[0]) return;

    const base64 = await this.imageUploadService.uploadImage(file[0]);
    if (base64) {
      this.customerLogo.set(base64);
    }
  }

  async onQuoterLogoChange(file: FileList) {
    if (!file?.[0]) return;

    const base64 = await this.imageUploadService.uploadImage(file[0]);
    if (base64) {
      this.quoterLogo.set(base64);
    }
  }

  async onStampChange(file: FileList) {
    if (!file?.[0]) return;

    const base64 = await this.imageUploadService.uploadImage(file[0]);
    if (base64) {
      this.stamp.set(base64);
    }
  }

  removeLogo() {
    this.customerLogo.set('');
  }

  removeQuoterLogo() {
    this.quoterLogo.set('');
  }

  removeStamp() {
    this.stamp.set('');
  }

  /**
   * 處理日期選擇器元素準備就緒事件
   */
  onDatePickersReady(event: {
    startDateEl: ElementRef<HTMLInputElement>;
    endDateEl: ElementRef<HTMLInputElement>;
  }): void {
    // Store the elements and initialize Litepicker
    setTimeout(() => {
      this.initializeDatePicker(event.startDateEl, 'start');
      this.initializeDatePicker(event.endDateEl, 'end');
    });
  }

  private initializeDatePicker(
    elementRef: ElementRef<HTMLInputElement>,
    type: 'start' | 'end'
  ): void {
    const element = elementRef.nativeElement;
    if (!element) return;

    if (type === 'start') {
      this.startDate = this.datePickerService.createStartDatePicker(
        element,
        (date) => {
          this.form.get('startDate')?.setValue(date);
          this.cdr.markForCheck();
        }
      );
    } else {
      this.endDate = this.datePickerService.createEndDatePicker(
        element,
        (date) => {
          this.form.get('endDate')?.setValue(date);
          this.cdr.markForCheck();
        },
        () => {
          this.form.get('endDate')?.setValue(null);
          this.cdr.markForCheck();
        }
      );
    }
  }

  private createServiceItem(): void {
    const item = this.quotationFormService.createServiceItem();
    this.serviceItems.push(item);
  }

  onAddField(): void {
    this.createServiceItem();
  }

  onRemoveField(index: number) {
    if (this.serviceItems.value.length > 1) {
      this.serviceItems.removeAt(index);
    }
  }

  /**
   * 處理拖曳排序事件
   */
  onDrop(event: CdkDragDrop<any>): void {
    const previousIndex = event.previousIndex;
    const currentIndex = event.currentIndex;

    if (previousIndex === currentIndex) {
      return;
    }

    // 取得被移動的項目
    const movedItem = this.serviceItems.at(previousIndex);

    // 先移除原位置的項目
    this.serviceItems.removeAt(previousIndex);

    // 插入到新位置
    this.serviceItems.insert(currentIndex, movedItem);
  }

  onCreateNewForm(): void {
    // 確認是否要建立新表單
    if (this.form.dirty && !confirm('目前表單尚未儲存，確定要建立新表單嗎？')) {
      return;
    }

    this.selectedHistoryIndex.set(null);
    this.resetForm();
  }

  onLoadHistory(index: number): void {
    this.analytics.trackHistoryLoaded(index);

    const data = this.historyData()[index];
    if (!data) {
      console.warn(`History data not found at index: ${index}`);
      return;
    }

    this.selectedHistoryIndex.set(index);
    this.loadQuotationData(data);
  }

  onDeleteHistory(index: number): void {
    if (!this.confirmDelete()) {
      return;
    }

    this.analytics.trackHistoryDeleted(index);
    this.updateSelectedIndexAfterDelete(index);

    // 使用 QuotationStorageService 刪除
    const success = this.quotationStorage.deleteFromHistory(index);
    if (success) {
      // 重新載入歷史記錄
      this.loadHistoryFromLocalStorage();
    }
  }

  private confirmDelete(): boolean {
    return confirm('確定要刪除此筆歷史記錄嗎？');
  }

  private updateSelectedIndexAfterDelete(deletedIndex: number): void {
    const currentIndex = this.selectedHistoryIndex();

    if (currentIndex === deletedIndex) {
      this.selectedHistoryIndex.set(null);
    } else if (currentIndex !== null && currentIndex > deletedIndex) {
      this.selectedHistoryIndex.update((current) => current! - 1);
    }
  }

  private resetForm(): void {
    this.quotationFormService.resetForm(this.form);
    this.customerLogo.set('');
    this.stamp.set('');
    this.quoterLogo.set('');
  }

  private loadQuotationData(data: QuotationData): void {
    this.quotationFormService.loadQuotationData(this.form, data);
    this.customerLogo.set(data.customerLogo || '');
    this.stamp.set(data.quoterStamp || '');
    this.quoterLogo.set(data.quoterLogo || '');
  }

  onSubmit() {
    const data = this.form.getRawValue();
    const dataWithImages = {
      ...data,
      customerLogo: this.customerLogo(),
      quoterStamp: this.stamp(),
      quoterLogo: this.quoterLogo(),
    };
    this.saveLocalStorage(dataWithImages);
    this.analytics.trackQuotationGenerated();

    // 顯示成功通知
    this.showSuccessToast();
  }

  private showSuccessToast(): void {
    this.toastService.success('報價單已成功儲存');
  }

  ngOnDestroy(): void {
    this.cleanupResources();
  }

  private cleanupResources(): void {
    this.datePickerService.destroy(this.startDate);
    this.datePickerService.destroy(this.endDate);
    this.resizeListener?.();
  }

  private saveLocalStorage(data: QuotationData): void {
    // 使用 QuotationStorageService 儲存
    const success = this.quotationStorage.saveToHistory(data);
    if (success) {
      // 重新載入歷史記錄
      this.loadHistoryFromLocalStorage();
    }
  }
}
