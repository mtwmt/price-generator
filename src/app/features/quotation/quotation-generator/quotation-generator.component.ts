import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  effect,
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, Subject } from 'rxjs';

import Litepicker from 'litepicker';
import { QuotationPreview } from '@app/features/quotation/quotation-preview/quotation-preview.component';
import { QuotationData } from '@app/features/quotation/models/quotation.model';
import {
  CUSTOM_TAX_NAME,
  getTaxPercentage,
} from '@app/features/quotation/models/quotation.constants';
import { AnalyticsService } from '@app/core/services/analytics.service';
import { AuthService } from '@app/core/services/auth.service';
import { ToastService } from '@app/shared/services/toast.service';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog.service';
import { QuotationStorageService } from '@app/features/quotation/services/quotation-storage.service';
import { ImageUploadService } from '@app/features/quotation/services/image-upload.service';
import { DatePickerService } from '@app/features/quotation/services/date-picker.service';
import { QuotationFormService } from '@app/features/quotation/services/quotation-form.service';
import { QuotationDraftService } from '@app/features/quotation/services/quotation-draft.service';
import { CloudQuotationSyncService } from '@app/features/quotation/cloud/cloud-quotation-sync.service';
import { CloudSyncStatusComponent } from '@app/features/quotation/cloud/cloud-sync-status/cloud-sync-status.component';
import { QuotationHistory } from './quotation-history/quotation-history.component';
import { CustomerInfoSection } from './customer-info-section/customer-info-section.component';
import { QuoterInfoSection } from './quoter-info-section/quoter-info-section.component';
import { ServiceItemsSection } from './service-items-section/service-items-section.component';
import { PricingSection } from './pricing-section/pricing-section.component';
import { OtherInfoSection } from './other-info-section/other-info-section.component';
import {
  LucideCheck,
  LucideCloudUpload,
  LucideCopy,
  LucideEye,
  LucideFileText,
  LucidePanelLeftClose,
  LucidePanelLeftOpen,
} from '@lucide/angular';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

export interface StorageRouteCoordinatorContext<T = QuotationData> {
  isCloudStorage: () => boolean;
  loadLocalHistory: () => T[];
  loadCloudHistory: () => T[];
  setHistoryData: (data: T[]) => void;
  setLocalHistoryData?: (data: T[]) => void;
  getSelectedIndex: () => number | null;
  setSelectedIndex: (index: number | null) => void;
  getHistoryLength?: () => number;
}

export class StorageRouteCoordinator<T = QuotationData> {
  private operationVersion = 0;
  readonly selectedStorage = signal<'local' | 'cloud' | null>(null);

  constructor(private readonly ctx: StorageRouteCoordinatorContext<T>) {}

  nextOperationVersion(): number {
    return ++this.operationVersion;
  }

  isCurrentOperation(version: number): boolean {
    return version === this.operationVersion;
  }

  setSelectedStorage(storage: 'local' | 'cloud' | null): void {
    this.selectedStorage.set(storage);
  }

  getSelectedStorage(): 'local' | 'cloud' | null {
    return this.selectedStorage();
  }

  isEditingExisting(historyLength?: number): boolean {
    const length = historyLength ?? this.ctx.getHistoryLength?.() ?? 0;
    const index = this.ctx.getSelectedIndex();
    if (index === null || index < 0 || index >= length) return false;
    const currentMode = this.ctx.isCloudStorage() ? 'cloud' : 'local';
    return this.selectedStorage() === currentMode;
  }

  resetInapplicableSelectedIndex(historyLength?: number): void {
    const length = historyLength ?? this.ctx.getHistoryLength?.() ?? 0;
    const index = this.ctx.getSelectedIndex();
    if (index === null) {
      this.selectedStorage.set(null);
      return;
    }
    const currentMode = this.ctx.isCloudStorage() ? 'cloud' : 'local';
    if (
      this.selectedStorage() !== currentMode ||
      index < 0 ||
      index >= length
    ) {
      this.ctx.setSelectedIndex(null);
      this.selectedStorage.set(null);
    }
  }

  syncHistoryByCurrentRoute(): void {
    if (this.ctx.isCloudStorage()) {
      const cloud = this.ctx.loadCloudHistory();
      this.ctx.setHistoryData(cloud);
      this.resetInapplicableSelectedIndex(cloud.length);
    } else {
      const local = this.ctx.loadLocalHistory();
      this.ctx.setLocalHistoryData?.(local);
      this.ctx.setHistoryData(local);
      this.resetInapplicableSelectedIndex(local.length);
    }
  }

  async handleInitialize(initFn: () => Promise<void>): Promise<void> {
    const version = this.nextOperationVersion();
    await initFn();
    if (!this.isCurrentOperation(version)) return;
    this.syncHistoryByCurrentRoute();
  }

  async handleToggle(toggleFn: () => Promise<void>): Promise<void> {
    const version = this.nextOperationVersion();
    await toggleFn();
    if (!this.isCurrentOperation(version)) return;
    this.ctx.setSelectedIndex(null);
    this.selectedStorage.set(null);
    this.syncHistoryByCurrentRoute();
  }

  async handleConnect(
    connectFn: () => Promise<void>,
    onError: (error: unknown) => void
  ): Promise<void> {
    const version = this.nextOperationVersion();
    try {
      await connectFn();
      if (!this.isCurrentOperation(version)) return;
      this.ctx.setSelectedIndex(null);
      this.selectedStorage.set(null);
      this.syncHistoryByCurrentRoute();
    } catch (error) {
      if (!this.isCurrentOperation(version)) return;
      this.syncHistoryByCurrentRoute();
      onError(error);
    }
  }
}

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
    PricingSection,
    OtherInfoSection,
    CloudSyncStatusComponent,
    LucideCheck,
    LucideCloudUpload,
    LucideCopy,
    LucideEye,
    LucideFileText,
    LucidePanelLeftClose,
    LucidePanelLeftOpen,
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
  private confirmDialog = inject(ConfirmDialogService);
  private quotationStorage = inject(QuotationStorageService);
  private imageUploadService = inject(ImageUploadService);
  private datePickerService = inject(DatePickerService);
  private cloudQuotationSync = inject(CloudQuotationSyncService);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  private document = inject(DOCUMENT);
  private quotationDraft = inject(QuotationDraftService);
  private initializedStorageRouteKey: string | null = null;
  private readonly draftSaveRequests = new Subject<number>();
  private readonly draftTrackingEnabled = signal(false);
  private draftBaseline = '';
  private draftGeneration = 0;
  private draftOwnerId: string | null = null;
  private draftOwnerInitialized = false;
  private storageRouteEffect = effect(() => {
    const user = this.authService.currentUser();
    const userData = this.authService.userData();
    const nextDraftOwnerId = user?.uid ?? null;
    if (
      this.form &&
      this.draftOwnerInitialized &&
      nextDraftOwnerId !== this.draftOwnerId
    ) {
      this.switchDraftOwner(nextDraftOwnerId);
    }
    if (!user || !userData) {
      this.initializedStorageRouteKey = null;
      this.coordinator.nextOperationVersion();
      this.cloudQuotationSync.disconnect();
      this.loadHistoryFromLocalStorage();
      return;
    }

    const role = userData.platforms?.quotation?.role ?? 'free';
    const routeKey = `${user.uid}:${role}`;
    if (this.initializedStorageRouteKey === routeKey) return;
    this.initializedStorageRouteKey = routeKey;
    void this.initializeStorageRoute();
  });
  private imageDraftEffect = effect(() => {
    this.customerLogo();
    this.stamp();
    this.quoterLogo();
    if (this.draftTrackingEnabled()) this.queueDraftSave();
  });

  // View Children
  private startDateInput = viewChild<ElementRef>('startDate');
  private endDateInput = viewChild<ElementRef>('endDate');
  private previewModal =
    viewChild<ElementRef<HTMLDialogElement>>('preview_modal');

  // Listeners
  private resizeListener?: () => void;
  private exportInvalidListener?: () => void;
  private beforeUnloadListener?: () => void;
  private pageHideListener?: () => void;
  private pageShowListener?: () => void;

  startDate!: Litepicker;
  endDate!: Litepicker;

  form!: FormGroup;

  // Signals
  historyData = signal<QuotationData[]>([]);
  localHistoryData = signal<QuotationData[]>([]);
  customerLogo = signal<string>('');
  stamp = signal<string>('');
  quoterLogo = signal<string>('');
  selectedHistoryIndex = signal<number | null>(null);
  showPreview = signal<boolean>(true);
  readonly cloudRoute = this.cloudQuotationSync.route;
  readonly cloudAvailable = this.cloudQuotationSync.isAvailable;
  readonly cloudEligible = this.cloudQuotationSync.isEligible;
  readonly cloudSyncEnabled = this.cloudQuotationSync.isSyncEnabled;
  readonly syncStatus = this.cloudQuotationSync.syncStatus;
  readonly lastSyncedAt = this.cloudQuotationSync.lastSyncedAt;
  readonly syncError = this.cloudQuotationSync.syncError;

  // Computed
  hasHistory = computed(() => this.historyData().length > 0);
  hasLocalHistoryToSync = computed(
    () => this.isCloudStorage() && this.localHistoryData().length > 0
  );
  isSyncingLocalHistory = signal(false);
  isCloudStorage = this.cloudQuotationSync.isCloudStorage;
  driveAction = computed(() => this.cloudRoute().cloudAction);
  storageModeLabel = computed(() =>
    this.isCloudStorage() ? '雲端同步' : '本機儲存'
  );

  readonly coordinator = new StorageRouteCoordinator({
    isCloudStorage: () => this.isCloudStorage(),
    loadLocalHistory: () => this.quotationStorage.getHistory(),
    loadCloudHistory: () =>
      this.cloudQuotationSync.history().map((entry) => entry.data),
    setHistoryData: (data) => this.historyData.set(data),
    setLocalHistoryData: (data) => this.localHistoryData.set(data),
    getSelectedIndex: () => this.selectedHistoryIndex(),
    setSelectedIndex: (index) => this.selectedHistoryIndex.set(index),
    getHistoryLength: () => this.historyData().length,
  });

  /** 目前是否正在編輯一筆既有的歷史記錄（決定儲存時是覆蓋或新增） */
  isEditingExisting = computed(() =>
    this.coordinator.isEditingExisting(this.historyData().length)
  );

  get serviceItems() {
    return this.form?.get('serviceItems') as FormArray;
  }

  ngOnInit() {
    this.loadHistoryFromLocalStorage();

    // 初始化表單
    this.form = this.quotationFormService.createForm();

    // 預設建立一個服務項目
    this.createServiceItem();

    // 設定監聽器（綁定本元件生命週期，元件銷毀時自動退訂）
    this.quotationFormService.setupFormListeners(this.form, this.destroyRef);

    this.setupDraftTracking();
    this.setupExportInvalidListener();
    this.setupBeforeUnloadProtection();

    this.setupResizeListener();
  }

  private setupDraftTracking(): void {
    this.draftSaveRequests
      .pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef))
      .subscribe((generation) => {
        if (generation === this.draftGeneration) this.saveDraft();
      });

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.queueDraftSave());

    this.draftOwnerId = this.authService.userId();
    this.draftOwnerInitialized = true;
    // 草稿只在本次開啟期間暫存；重新進入網站一律從空白報價單開始。
    this.clearDraftSafely();
    this.markDraftBaseline();
    this.draftTrackingEnabled.set(true);
  }

  private setupExportInvalidListener(): void {
    this.exportInvalidListener = this.renderer.listen(
      'document',
      'quotation-export-invalid',
      () => this.focusFirstInvalidControl()
    );
  }

  private setupBeforeUnloadProtection(): void {
    this.beforeUnloadListener = this.renderer.listen(
      'window',
      'beforeunload',
      () => this.discardDraftOnExit()
    );
    // iOS Safari 不保證觸發 beforeunload；pagehide 可涵蓋關閉分頁與重新整理。
    this.pageHideListener = this.renderer.listen('window', 'pagehide', () =>
      this.discardDraftOnExit()
    );
    this.pageShowListener = this.renderer.listen(
      'window',
      'pageshow',
      (event: PageTransitionEvent) => {
        if (event.persisted) this.resetDraftAfterPageRestore();
      }
    );
  }

  private focusFirstInvalidControl(): void {
    setTimeout(() => {
      const form = this.document.getElementById('form');
      if (!form) return;
      const invalidControl = Array.from(
        form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          'input.ng-invalid, select.ng-invalid, textarea.ng-invalid'
        )
      ).find((control) => !control.disabled);
      if (!invalidControl) return;

      invalidControl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      invalidControl.focus({ preventScroll: true });
    });
  }

  private queueDraftSave(): void {
    if (!this.draftTrackingEnabled()) return;
    if (!this.hasMeaningfulUnsavedChanges()) {
      this.clearDraftSafely();
      return;
    }
    this.draftSaveRequests.next(this.draftGeneration);
  }

  private saveDraft(): void {
    if (!this.draftTrackingEnabled() || !this.hasMeaningfulUnsavedChanges()) {
      return;
    }
    try {
      this.quotationDraft.save(this.collectFormData(), this.draftOwnerId);
    } catch {
      // localStorage 可能被瀏覽器禁止；草稿失敗不能中斷使用者編輯。
    }
  }

  private hasMeaningfulUnsavedChanges(): boolean {
    return (
      this.draftBaseline !== '' &&
      this.serializeCurrentFormData() !== this.draftBaseline
    );
  }

  private isCurrentDraftSession(
    ownerId: string | null,
    generation: number
  ): boolean {
    return (
      this.draftTrackingEnabled() &&
      ownerId === this.draftOwnerId &&
      generation === this.draftGeneration
    );
  }

  private serializeCurrentFormData(): string {
    return JSON.stringify(this.collectFormData());
  }

  private markDraftBaseline(): void {
    this.draftBaseline = this.serializeCurrentFormData();
    this.form.markAsPristine();
  }

  private clearDraftSafely(ownerId = this.draftOwnerId): void {
    try {
      this.quotationDraft.clear(ownerId);
    } catch {
      // 清除失敗不應使切換或儲存流程中斷。
    }
  }

  private discardDraftOnExit(): void {
    this.draftTrackingEnabled.set(false);
    this.draftGeneration += 1;
    this.clearDraftSafely();
  }

  /** Safari 從返回快取還原頁面時不會重跑 ngOnInit，需主動回到空白表單。 */
  private resetDraftAfterPageRestore(): void {
    this.draftTrackingEnabled.set(false);
    this.draftGeneration += 1;
    this.clearDraftSafely();
    this.selectedHistoryIndex.set(null);
    this.coordinator.setSelectedStorage(null);
    this.resetForm();
    this.markDraftBaseline();
    this.draftTrackingEnabled.set(true);
  }

  private clearDraftAndMarkPristine(): void {
    this.clearDraftSafely();
    this.markDraftBaseline();
  }

  private finishSuccessfulSave(savedData: QuotationData): void {
    this.draftBaseline = JSON.stringify(savedData);
    if (this.serializeCurrentFormData() === this.draftBaseline) {
      this.clearDraftSafely();
      this.form.markAsPristine();
      return;
    }

    // 儲存等待期間又有編輯：保留新內容為草稿，不可當成已儲存。
    this.form.markAsDirty();
    this.saveDraft();
  }

  private async confirmDiscardUnsavedChanges(
    title: string,
    message: string
  ): Promise<boolean> {
    if (!this.hasMeaningfulUnsavedChanges()) return true;
    const ownerAtConfirmation = this.draftOwnerId;
    const generationAtConfirmation = this.draftGeneration;
    const confirmed = await this.confirmDialog.confirm({
      title,
      message,
      confirmText: '放棄變更',
      confirmStyle: 'warning',
    });
    return (
      confirmed &&
      ownerAtConfirmation === this.draftOwnerId &&
      generationAtConfirmation === this.draftGeneration
    );
  }

  async confirmDiscardBeforeLeaving(): Promise<boolean> {
    const confirmed = await this.confirmDiscardUnsavedChanges(
      '離開報價單',
      '目前報價單尚未儲存，確定要離開並放棄變更嗎？'
    );
    if (confirmed) this.clearDraftAndMarkPristine();
    return confirmed;
  }

  private switchDraftOwner(nextOwnerId: string | null): void {
    this.draftTrackingEnabled.set(false);
    this.draftGeneration += 1;
    this.clearDraftSafely();
    this.draftOwnerId = nextOwnerId;
    this.selectedHistoryIndex.set(null);
    this.coordinator.setSelectedStorage(null);
    this.resetForm();

    this.clearDraftSafely(nextOwnerId);
    this.markDraftBaseline();
    this.draftTrackingEnabled.set(true);
  }

  private loadHistoryFromLocalStorage(): void {
    const history = this.quotationStorage.getHistory();
    this.localHistoryData.set(history);
    this.historyData.set(history);
    this.coordinator.resetInapplicableSelectedIndex(history.length);
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

    // 自訂稅率：不自動設定，讓使用者手動輸入
    if (taxName === CUSTOM_TAX_NAME) {
      return;
    }

    // 根據稅率名稱取得對應百分比
    const percentage = getTaxPercentage(taxName);
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
   * 複製服務項目
   */
  onCopyField(index: number): void {
    const source = this.serviceItems.at(index) as FormGroup;
    const newItem = this.quotationFormService.createServiceItem();
    newItem.patchValue(source.getRawValue());
    this.serviceItems.insert(index + 1, newItem);
  }

  /**
   * 處理拖曳排序事件
   */
  onDrop(event: CdkDragDrop<string[]>): void {
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

  async onCreateNewForm(): Promise<void> {
    const confirmed = await this.confirmDiscardUnsavedChanges(
      '建立新表單',
      '目前表單尚未儲存，確定要建立新表單嗎？'
    );
    if (!confirmed) return;

    this.selectedHistoryIndex.set(null);
    this.coordinator.setSelectedStorage(null);
    this.resetForm();
    this.clearDraftAndMarkPristine();
  }

  async onLoadHistory(index: number): Promise<void> {
    const confirmed = await this.confirmDiscardUnsavedChanges(
      '載入其他報價單',
      '目前表單尚未儲存，確定要載入其他報價單嗎？'
    );
    if (!confirmed) return;

    const loadGeneration = this.draftGeneration;
    const formSnapshotAtLoad = this.serializeCurrentFormData();

    this.analytics.trackHistoryLoaded(index);

    let data = this.historyData()[index];
    if (!data) {
      console.warn(`History data not found at index: ${index}`);
      return;
    }

    if (this.isCloudStorage()) {
      const entry = this.cloudQuotationSync.history()[index];
      if (!entry) return;
      try {
        data = await this.cloudQuotationSync.load(entry);
        this.loadCloudHistory();
        if (
          loadGeneration !== this.draftGeneration ||
          formSnapshotAtLoad !== this.serializeCurrentFormData()
        ) {
          this.toastService.warning(
            '載入期間表單已變更，已保留目前編輯內容'
          );
          return;
        }
      } catch {
        this.toastService.error('無法讀取雲端報價單，請稍後再試');
        return;
      }
    }
    this.selectedHistoryIndex.set(index);
    this.coordinator.setSelectedStorage(
      this.isCloudStorage() ? 'cloud' : 'local'
    );
    this.loadQuotationData(data);
    this.clearDraftAndMarkPristine();
  }

  async onDeleteHistory(index: number): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: '刪除歷史記錄',
      message: '確定要刪除此筆歷史記錄嗎？',
      confirmText: '刪除',
      confirmStyle: 'error',
    });
    if (!confirmed) return;

    if (this.isCloudStorage()) {
      const entry = this.cloudQuotationSync.history()[index];
      if (!entry) return;
      try {
        await this.cloudQuotationSync.delete(entry);
        this.analytics.trackHistoryDeleted(index);
        this.updateSelectedIndexAfterDelete(index);
        this.loadCloudHistory();
      } catch {
        this.toastService.error('無法刪除雲端報價單，請稍後再試');
      }
      return;
    }

    this.analytics.trackHistoryDeleted(index);
    this.updateSelectedIndexAfterDelete(index);
    const success = this.quotationStorage.deleteFromHistory(index);
    if (success) {
      this.loadHistoryFromLocalStorage();
    }
  }

  private updateSelectedIndexAfterDelete(deletedIndex: number): void {
    const currentIndex = this.selectedHistoryIndex();

    if (currentIndex === deletedIndex) {
      this.selectedHistoryIndex.set(null);
      this.coordinator.setSelectedStorage(null);
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

  /** 收集目前表單內容（含圖片）為 QuotationData */
  private collectFormData(): QuotationData {
    const data = this.form.getRawValue();
    return {
      ...data,
      customerLogo: this.customerLogo(),
      quoterStamp: this.stamp(),
      quoterLogo: this.quoterLogo(),
    };
  }

  /**
   * 儲存記錄：編輯既有筆時覆蓋更新，否則新增
   */
  async onSubmit(): Promise<void> {
    const data = this.collectFormData();
    const draftOwner = this.draftOwnerId;
    const draftGeneration = this.draftGeneration;
    if (await this.saveQuotation(data)) {
      if (!this.isCurrentDraftSession(draftOwner, draftGeneration)) return;
      this.finishSuccessfulSave(data);
      this.analytics.trackQuotationGenerated();
    }
  }

  /**
   * 另存新檔：不論目前是否在編輯既有筆，都以目前內容新增一筆
   */
  async onSaveAsNew(): Promise<void> {
    const data = this.collectFormData();
    const draftOwner = this.draftOwnerId;
    const draftGeneration = this.draftGeneration;
    if (await this.saveQuotation(data, true)) {
      if (!this.isCurrentDraftSession(draftOwner, draftGeneration)) return;
      this.finishSuccessfulSave(data);
      this.analytics.trackQuotationGenerated();
    }
  }

  private showSuccessToast(isUpdate: boolean): void {
    this.toastService.success(isUpdate ? '報價單已更新' : '報價單已成功儲存');
  }

  ngOnDestroy(): void {
    this.cleanupResources();
  }

  private cleanupResources(): void {
    this.discardDraftOnExit();
    this.datePickerService.destroy(this.startDate);
    this.datePickerService.destroy(this.endDate);
    this.resizeListener?.();
    this.exportInvalidListener?.();
    this.beforeUnloadListener?.();
    this.pageHideListener?.();
    this.pageShowListener?.();
  }

  private saveLocalStorage(data: QuotationData, forceCreate = false): boolean {
    this.coordinator.resetInapplicableSelectedIndex(this.historyData().length);
    const selectedIndex = this.selectedHistoryIndex();
    const isUpdate =
      !forceCreate &&
      selectedIndex !== null &&
      selectedIndex >= 0 &&
      selectedIndex < this.historyData().length;
    const isCopyOfExisting =
      forceCreate &&
      selectedIndex !== null &&
      selectedIndex >= 0 &&
      selectedIndex < this.historyData().length &&
      this.coordinator.getSelectedStorage() === 'local';

    // 載入既有紀錄並修改 → 原地覆蓋更新；否則新增一筆
    const success = isUpdate
      ? this.quotationStorage.updateHistory(selectedIndex, data)
      : isCopyOfExisting
        ? this.quotationStorage.saveCopyToHistory(data, selectedIndex)
      : this.quotationStorage.saveToHistory(data);

    if (success) {
      // 重新載入歷史記錄
      this.loadHistoryFromLocalStorage();

      // 新增時，新紀錄位於最前面，將選取索引指向它，
      // 以便後續再次儲存時會更新同一筆，而非持續新增重複
      if (!isUpdate) {
        this.selectedHistoryIndex.set(0);
        this.coordinator.setSelectedStorage('local');
      }

      this.showSuccessToast(isUpdate);
    }
    return success;
  }

  async onDriveConnect(): Promise<void> {
    await this.coordinator.handleConnect(
      () => this.cloudQuotationSync.beginConnect(),
      (error) => {
        const message =
          error instanceof Error ? error.message : 'Google Drive 授權流程失敗';
        this.toastService.error(`Google Drive 連結失敗：${message}`);
      }
    );
  }

  async onCloudSyncToggle(enabled: boolean): Promise<void> {
    await this.coordinator.handleToggle(() =>
      this.cloudQuotationSync.setSyncEnabled(enabled)
    );
  }

  async onSyncLocalHistory(): Promise<void> {
    if (
      !this.isCloudStorage() ||
      this.localHistoryData().length === 0 ||
      this.isSyncingLocalHistory()
    ) {
      return;
    }

    this.isSyncingLocalHistory.set(true);
    try {
      const result = await this.cloudQuotationSync.syncLocalHistory(
        this.localHistoryData()
      );
      this.coordinator.syncHistoryByCurrentRoute();
      this.toastService.success(
        result.uploaded > 0
          ? `已將 ${result.uploaded} 筆本機報價單同步到雲端`
          : '本機報價單已同步到雲端，沒有新增資料'
      );
    } catch {
      this.toastService.error('本機報價單同步失敗，請稍後再試');
    } finally {
      this.isSyncingLocalHistory.set(false);
    }
  }

  private async initializeStorageRoute(): Promise<void> {
    await this.coordinator.handleInitialize(() =>
      this.cloudQuotationSync.initialize()
    );
  }

  private loadHistoryForCurrentStorage(): void {
    this.coordinator.syncHistoryByCurrentRoute();
  }

  private loadCloudHistory(): void {
    if (!this.isCloudStorage()) {
      this.loadHistoryFromLocalStorage();
      return;
    }
    this.historyData.set(
      this.cloudQuotationSync.history().map((entry) => entry.data)
    );
    this.coordinator.resetInapplicableSelectedIndex(this.historyData().length);
  }

  private async saveQuotation(
    data: QuotationData,
    forceCreate = false
  ): Promise<boolean> {
    if (!this.isCloudStorage()) {
      return this.saveLocalStorage(data, forceCreate);
    }

    this.coordinator.resetInapplicableSelectedIndex(this.historyData().length);
    const selectedIndex = this.selectedHistoryIndex();
    const existing =
      forceCreate || selectedIndex === null
        ? undefined
        : this.cloudQuotationSync.history()[selectedIndex];
    try {
      const saved = await this.cloudQuotationSync.save(data, existing);
      this.loadCloudHistory();
      const nextIndex = this.cloudQuotationSync
        .history()
        .findIndex((entry) => entry.revisionId === saved.revisionId);
      this.selectedHistoryIndex.set(nextIndex >= 0 ? nextIndex : null);
      this.coordinator.setSelectedStorage(nextIndex >= 0 ? 'cloud' : null);
      this.showSuccessToast(!!existing);
      return true;
    } catch {
      this.toastService.error('無法儲存到 Google Drive，請確認連線後再試');
      return false;
    }
  }
}
