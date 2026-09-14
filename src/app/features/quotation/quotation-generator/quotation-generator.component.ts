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

import Litepicker from 'litepicker';
import { QuotationPreview } from '@app/features/quotation/quotation-preview/quotation-preview.component';
import { QuotationData } from '@app/features/quotation/models/quotation.model';
import {
  CustomerTemplate,
  ServiceItemTemplate,
  QuotationVersionSnapshot,
} from '@app/features/quotation/models/quotation.model';
import {
  CUSTOM_TAX_NAME,
  getTaxPercentage,
} from '@app/features/quotation/models/quotation.constants';
import { AnalyticsService } from '@app/core/services/analytics.service';
import { AuthService } from '@app/core/services/auth.service';
import { ToastService } from '@app/shared/services/toast.service';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog.service';
import { QuotationStorageService } from '@app/features/quotation/services/quotation-storage.service';
import {
  QuotationStorageRecoveryBackup,
  QuotationStorageRecoveryInfo,
} from '@app/features/quotation/services/quotation-storage.service';
import { ImageUploadService } from '@app/features/quotation/services/image-upload.service';
import { DatePickerService } from '@app/features/quotation/services/date-picker.service';
import { QuotationFormService } from '@app/features/quotation/services/quotation-form.service';
import { QuotationTemplatesService } from '@app/features/quotation/services/quotation-templates.service';
import {
  cloneAsNewQuotation,
  createNextBusinessVersion,
  hasDuplicateQuotationNumber,
  normalizeQuotationLifecycle,
  QUOTATION_STATUSES,
  quotationStatusLabel,
} from '@app/features/quotation/utils/quotation-lifecycle';
import { CloudQuotationSyncService, CloudSaveIntent } from '@app/features/quotation/cloud/cloud-quotation-sync.service';
import { StorageRouteCoordinator } from './storage-route-coordinator';
import { restoreRecoveryFileForCurrentScope } from './recovery-restore';
import { CloudSyncStatusComponent } from '@app/features/quotation/cloud/cloud-sync-status/cloud-sync-status.component';
import { QuotationHistory } from './quotation-history/quotation-history.component';
import { CustomerInfoSection } from './customer-info-section/customer-info-section.component';
import { QuoterInfoSection } from './quoter-info-section/quoter-info-section.component';
import { ServiceItemsSection } from './service-items-section/service-items-section.component';
import { PricingSection } from './pricing-section/pricing-section.component';
import { OtherInfoSection } from './other-info-section/other-info-section.component';
import { QuotationInfoSection } from './quotation-info-section/quotation-info-section.component';
import { SearchableSelectComponent } from '@app/shared/components/searchable-select/searchable-select.component';
import {
  LucideBookmarkPlus,
  LucideCheck,
  LucideCloudUpload,
  LucideCopy,
  LucideEye,
  LucideFileText,
  LucidePanelLeftClose,
  LucidePanelLeftOpen,
  LucidePencil,
  LucideTrash2,
} from '@lucide/angular';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

interface QuotationSubmission {
  readonly epoch: number;
  readonly scope: string;
  readonly repository: 'local' | 'cloud';
  readonly editorFingerprint: string;
  readonly editorSource: QuotationData;
  readonly payload: QuotationData;
  readonly forceCreate: boolean;
  readonly cloudIntent?: CloudSaveIntent;
  readonly duplicateNumber: boolean;
  duplicateConfirmed: boolean;
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
    QuotationInfoSection,
    QuoterInfoSection,
    ServiceItemsSection,
    PricingSection,
    OtherInfoSection,
    CloudSyncStatusComponent,
    SearchableSelectComponent,
    LucideBookmarkPlus,
    LucideCheck,
    LucideCloudUpload,
    LucideCopy,
    LucideEye,
    LucideFileText,
    LucidePanelLeftClose,
    LucidePanelLeftOpen,
    LucidePencil,
    LucideTrash2,
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
  private quotationTemplates = inject(QuotationTemplatesService);
  private imageUploadService = inject(ImageUploadService);
  private datePickerService = inject(DatePickerService);
  private cloudQuotationSync = inject(CloudQuotationSyncService);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  private document = inject(DOCUMENT);
  private initializedStorageRouteKey: string | null = null;
  private activeUserId: string | null | undefined;
  private documentEpoch = 0;
  private documentScope: string | null = null;
  private viewingBusinessSnapshot = false;
  private snapshotViewRequest = 0;
  private historyLoadRequest = 0;
  private cloudToggleRequest = 0;
  private pendingSubmission: QuotationSubmission | null = null;
  private submissionFlight: Promise<void> | null = null;
  readonly isSubmitting = signal(false);
  readonly submissionUncertain = signal(false);
  private storageRouteEffect = effect(() => {
    const user = this.authService.currentUser();
    const userData = this.authService.userData();
    const nextUserId = user?.uid ?? null;
    if (
      this.form &&
      this.activeUserId !== undefined &&
      nextUserId !== this.activeUserId
    ) {
      this.detachDocumentIdentity();
    }
    this.activeUserId = nextUserId;
    this.quotationTemplates.setScope(nextUserId ? `user:${nextUserId}` : 'visitor');
    this.clearTemplateSelections();
    this.refreshTemplates();
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
    this.refreshLegacyCandidates();
    void this.initializeStorageRoute();
  });
  private observedRepository: boolean | undefined;
  private repositoryEffect = effect(() => {
    this.reconcileRepositoryIdentity();
  });

  /** Commit identity changes only when the actual logical repository changed. */
  private reconcileRepositoryIdentity(): void {
    const cloud = this.isCloudStorage();
    if (this.form && this.observedRepository !== undefined && this.observedRepository !== cloud) {
      this.detachDocumentIdentity();
    }
    this.observedRepository = cloud;
  }

  // View Children
  private startDateInput = viewChild<ElementRef>('startDate');
  private endDateInput = viewChild<ElementRef>('endDate');
  private previewModal =
    viewChild<ElementRef<HTMLDialogElement>>('preview_modal');

  // Listeners
  private resizeListener?: () => void;
  private exportInvalidListener?: () => void;

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
  /** 索引會因排序／刪除改變；資料操作一律以這個穩定 ID 找回目前索引。 */
  selectedHistoryId = signal<string | null>(null);
  /** 載入或成功儲存後的不可變版本，供「建立下一版」保存真正舊內容。 */
  savedBusinessVersion = signal<QuotationData | null>(null);
  readonly legacyHistoryCount = signal(0);
  readonly recoveryInfo = signal<QuotationStorageRecoveryInfo | null>(null);
  readonly recoveryBackup = signal<QuotationStorageRecoveryBackup | null>(null);
  readonly legacyCandidates = signal<QuotationData[]>([]);
  readonly templateSearch = signal('');
  readonly templateRevision = signal(0);
  readonly selectedCustomerTemplateId = signal('');
  readonly selectedServiceItemTemplateId = signal('');
  readonly quotationNumber = signal('');
  readonly quotationStatus = signal<'draft' | 'sent' | 'won' | 'lost'>('draft');
  readonly quotationBusinessVersion = signal(1);
  readonly quotationStatuses = QUOTATION_STATUSES;
  readonly statusLabel = quotationStatusLabel;
  readonly historyMetadataIncomplete = computed(() =>
    this.isCloudStorage() && this.cloudQuotationSync.hasIncompleteHistoryMetadata()
  );
  showPreview = signal<boolean>(true);
  readonly cloudRoute = this.cloudQuotationSync.route;
  readonly cloudAvailable = this.cloudQuotationSync.isAvailable;
  readonly cloudEligible = this.cloudQuotationSync.isEligible;
  /** 舊資料匯入只對匿名訪客與具資格會員保留；免費會員仍可使用一般歷史記錄。 */
  readonly legacyImportEnabled = computed(
    () => !this.authService.isAuthenticated() || this.cloudEligible()
  );
  /** 贊助會員預設進階版；此狀態只決定介面可見性，不會寫入報價表單。 */
  readonly advancedMode = signal(true);
  readonly showAdvancedFeatures = computed(
    () => this.cloudEligible() && this.advancedMode()
  );
  readonly cloudSyncEnabled = this.cloudQuotationSync.isSyncEnabled;
  readonly syncStatus = this.cloudQuotationSync.syncStatus;
  readonly lastSyncedAt = this.cloudQuotationSync.lastSyncedAt;
  readonly syncError = this.cloudQuotationSync.syncError;

  // Computed
  hasHistory = computed(() => this.historyData().length > 0);
  customerTemplates = computed(() => {
    this.templateRevision();
    return this.quotationTemplates.getCustomers(this.templateSearch());
  });
  serviceItemTemplates = computed(() => {
    this.templateRevision();
    return this.quotationTemplates.getServiceItems(this.templateSearch());
  });
  readonly selectedCustomerTemplate = computed(() => {
    const id = this.selectedCustomerTemplateId();
    return id
      ? this.customerTemplates().find((template) => template.id === id) ?? null
      : null;
  });
  readonly selectedServiceItemTemplate = computed(() => {
    const id = this.selectedServiceItemTemplateId();
    return id
      ? this.serviceItemTemplates().find((template) => template.id === id) ?? null
      : null;
  });
  hasLocalHistoryToSync = computed(
    () => this.isCloudStorage() && this.localHistoryData().length > 0
  );
  isSyncingLocalHistory = signal(false);
  isCloudStorage = this.cloudQuotationSync.isCloudRepository;
  driveAction = computed(() => this.cloudRoute().cloudAction);
  storageModeLabel = computed(() =>
    this.isCloudStorage() ? '雲端同步' : '本機儲存'
  );
  private previousAdvancedEligibility = false;
  private advancedModeOwner: string | null | undefined;
  private readonly advancedModeEligibilityEffect = effect(() => {
    const eligible = this.cloudEligible();
    const owner = this.authService.userId();

    if (!eligible) {
      this.advancedMode.set(false);
    } else if (!this.previousAdvancedEligibility) {
      // 首次取得贊助資格（含升級）預設為進階版。
      this.advancedMode.set(true);
    } else if (owner !== this.advancedModeOwner) {
      // 切換贊助帳號時不沿用上一位使用者的介面偏好。
      this.advancedMode.set(false);
    }

    this.previousAdvancedEligibility = eligible;
    this.advancedModeOwner = owner;
  });

  readonly coordinator = new StorageRouteCoordinator({
    isCloudStorage: () => this.isCloudStorage(),
    loadLocalHistory: () => this.quotationStorage.getHistory(this.localStorageScope()),
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

  readonly showAdvancedPromoModal = signal(false);

  setAdvancedMode(enabled: boolean): void {
    if (!this.cloudEligible()) return;
    this.advancedMode.set(enabled);
  }

  openAdvancedPromoModal(): void {
    this.showAdvancedPromoModal.set(true);
  }

  closeAdvancedPromoModal(): void {
    this.showAdvancedPromoModal.set(false);
  }

  goToDonation(): void {
    this.closeAdvancedPromoModal();
    if (this.authService.isAuthenticated()) {
      const navTarget = this.document?.defaultView ?? (typeof window !== 'undefined' ? window : null);
      if (navTarget) {
        navTarget.location.href = '/member';
      }
    } else {
      this.authService.loginWithGoogle();
    }
  }

  ngOnInit() {
    this.loadHistoryFromLocalStorage();

    // 初始化表單
    this.form = this.quotationFormService.createForm();

    // 預設建立一個服務項目
    this.createServiceItem();

    // 設定監聽器（綁定本元件生命週期，元件銷毀時自動退訂）
    this.quotationFormService.setupFormListeners(this.form, this.destroyRef);

    this.setupExportInvalidListener();

    this.setupResizeListener();
  }

  private setupExportInvalidListener(): void {
    this.exportInvalidListener = this.renderer.listen(
      'document',
      'quotation-export-invalid',
      () => this.focusFirstInvalidControl()
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

  private serializeCurrentFormData(): string {
    // Comparing editor state must not allocate lifecycle identity for a blank form.
    return JSON.stringify(this.readEditorData());
  }

  private markFormPristine(): void {
    this.form.markAsPristine();
  }

  private async confirmDiscardUnsavedChanges(
    title: string,
    message: string
  ): Promise<boolean> {
    if (!this.form.dirty) return true;
    const confirmed = await this.confirmDialog.confirm({
      title,
      message,
      confirmText: '放棄變更',
      confirmStyle: 'warning',
    });
    return confirmed;
  }

  async confirmDiscardBeforeLeaving(): Promise<boolean> {
    const confirmed = await this.confirmDiscardUnsavedChanges(
      '離開報價單',
      '目前報價單尚未儲存，確定要離開並放棄變更嗎？'
    );
    if (confirmed) this.resetFormForNewQuotation();
    return confirmed;
  }

  private resetFormForNewQuotation(): void {
    this.detachDocumentIdentity();
    this.resetForm();
    this.markFormPristine();
  }

  /** Repository/owner changes retain editor content but require a fresh document identity. */
  private detachDocumentIdentity(): void {
    ++this.documentEpoch;
    this.observedRepository = this.isCloudStorage();
    this.viewingBusinessSnapshot = false;
    this.documentScope = null;
    this.pendingSubmission = null;
    this.submissionFlight = null;
    this.isSubmitting.set(false);
    this.submissionUncertain.set(false);
    this.selectedHistoryIndex.set(null);
    this.selectedHistoryId.set(null);
    this.savedBusinessVersion.set(null);
    this.coordinator.setSelectedStorage(null);
    this.quotationNumber.set('');
    this.quotationStatus.set('draft');
    this.quotationBusinessVersion.set(1);
    this.form?.patchValue({ quotationId: '', quotationNumber: '', status: 'draft', businessVersion: 1, previousVersions: [] }, { emitEvent: false });
  }

  private loadHistoryFromLocalStorage(): void {
    const history = this.quotationStorage
      .getHistory(this.localStorageScope())
      .map((entry) => normalizeQuotationLifecycle(entry));
    this.localHistoryData.set(history);
    this.historyData.set(history);
    const scope = this.localStorageScope();
    this.recoveryInfo.set(this.quotationStorage.getRecoveryInfo(scope));
    this.recoveryBackup.set(this.quotationStorage.createRecoveryBackup(scope));
    this.refreshLegacyCandidates();
    this.coordinator.resetInapplicableSelectedIndex(history.length);
  }

  private refreshLegacyCandidates(): void {
    const legacy = this.legacyImportEnabled()
      ? this.quotationStorage.getLegacyHistory()
      : [];
    this.legacyCandidates.set(legacy);
    this.legacyHistoryCount.set(legacy.length);
  }

  /** 訪客與每個 UID 使用不同 key；不以 localStorage 當作系統層安全性。 */
  private localStorageScope(): string {
    const uid = this.authService.currentUser()?.uid;
    return uid ? `quotation:user:${uid}` : 'quotation:visitor';
  }

  claimSelectedLegacyHistory(selectedIndexes: readonly number[]): void {
    if (!this.legacyImportEnabled()) return;
    const scope = this.localStorageScope();
    const version = this.coordinator.nextOperationVersion();
    const result = this.quotationStorage.claimLegacyHistory(
      scope,
      selectedIndexes
    );
    if (!this.coordinator.isCurrentOperation(version) || scope !== this.localStorageScope()) return;
    if (!result.success && result.reason === 'target-full') {
      this.toastService.warning('舊資料與目前歷史合計超過 5 筆；請在後續版本選擇要匯入的項目，原資料已保留');
      return;
    }
    if (!result.success) {
      this.toastService.error('匯入舊報價失敗，原始資料未變更');
      return;
    }
    this.loadHistoryFromLocalStorage();
    this.toastService.success(result.claimed ? `已匯入 ${result.claimed} 筆此瀏覽器的舊報價` : '所選舊資料已在目前資料區');
  }

  async restoreRecoveryBackup(file: File): Promise<void> {
    const scope = this.localStorageScope();
    const outcome = await restoreRecoveryFileForCurrentScope({
      file,
      scope,
      beginOperation: () => this.coordinator.nextOperationVersion(),
      isCurrentOperation: (version) => this.coordinator.isCurrentOperation(version),
      getCurrentScope: () => this.localStorageScope(),
      restore: (rawSource, targetScope) =>
        this.quotationStorage.restoreRecoveryBackup(rawSource, targetScope).success,
    });
    if (outcome === 'stale') return;
    if (outcome === 'read-failed') {
      this.toastService.error('無法讀取備份檔；現有資料未被覆寫');
      return;
    }
    if (outcome === 'invalid') {
      this.toastService.error('無法還原備份；現有資料未被覆寫');
      return;
    }
    this.loadHistoryFromLocalStorage();
    this.toastService.success('已還原本機歷史備份，請檢查內容後再儲存');
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
      this.form.markAsDirty();
    }
  }

  async onQuoterLogoChange(file: FileList) {
    if (!file?.[0]) return;

    const base64 = await this.imageUploadService.uploadImage(file[0]);
    if (base64) {
      this.quoterLogo.set(base64);
      this.form.markAsDirty();
    }
  }

  async onStampChange(file: FileList) {
    if (!file?.[0]) return;

    const base64 = await this.imageUploadService.uploadImage(file[0]);
    if (base64) {
      this.stamp.set(base64);
      this.form.markAsDirty();
    }
  }

  removeLogo() {
    this.customerLogo.set('');
    this.form.markAsDirty();
  }

  removeQuoterLogo() {
    this.quoterLogo.set('');
    this.form.markAsDirty();
  }

  removeStamp() {
    this.stamp.set('');
    this.form.markAsDirty();
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

  async onRemoveField(index: number): Promise<void> {
    if (this.serviceItems.value.length <= 1) return;
    const itemValue = this.serviceItems.at(index)?.value;
    const hasContent =
      itemValue && (itemValue.item?.trim() || itemValue.price > 0);
    if (hasContent) {
      const itemName = itemValue.item?.trim()
        ? `「${itemValue.item.trim()}」`
        : '此項目';
      const confirmed = await this.confirmDialog.confirm({
        title: '確認刪除服務項目',
        message: `確定要從報價單中刪除${itemName}嗎？`,
        confirmText: '刪除',
        confirmStyle: 'error',
      });
      if (!confirmed) return;
    }
    this.serviceItems.removeAt(index);
    this.form.markAsDirty();
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

  onTemplateSearch(event: Event): void {
    this.templateSearch.set((event.target as HTMLInputElement).value);
    if (!this.customerTemplates().some((template) => template.id === this.selectedCustomerTemplateId())) {
      this.selectedCustomerTemplateId.set('');
    }
    if (!this.serviceItemTemplates().some((template) => template.id === this.selectedServiceItemTemplateId())) {
      this.selectedServiceItemTemplateId.set('');
    }
  }

  onCustomerTemplateSelected(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedCustomerTemplateId.set(id);
  }

  onCustomerTemplateSelectedById(id: string): void {
    this.selectedCustomerTemplateId.set(id);
  }

  onServiceItemTemplateSelected(event: Event): void {
    this.selectedServiceItemTemplateId.set((event.target as HTMLSelectElement).value);
  }

  onServiceItemTemplateSelectedById(id: string): void {
    this.selectedServiceItemTemplateId.set(id);
  }

  applySelectedCustomerTemplate(): void {
    const template = this.selectedCustomerTemplate();
    if (template) this.applyCustomerTemplate(template);
  }

  applySelectedServiceItemTemplate(): void {
    const template = this.selectedServiceItemTemplate();
    if (template) this.applyServiceItemTemplate(template);
  }

  renameSelectedCustomerTemplate(): void {
    const template = this.selectedCustomerTemplate();
    if (template) this.renameCustomerTemplate(template);
  }

  async deleteSelectedCustomerTemplate(): Promise<void> {
    const template = this.selectedCustomerTemplate();
    if (!template) return;
    const confirmed = await this.confirmDialog.confirm({
      title: '確認刪除常用客戶',
      message: `確定要刪除常用客戶「${template.name}」嗎？此動作無法復原。`,
      confirmText: '刪除',
      confirmStyle: 'error',
    });
    if (!confirmed) return;
    this.deleteCustomerTemplate(template.id);
    this.selectedCustomerTemplateId.set('');
    this.toastService.success('已刪除常用客戶');
  }

  renameSelectedServiceItemTemplate(): void {
    const template = this.selectedServiceItemTemplate();
    if (template) this.renameServiceItemTemplate(template);
  }

  async deleteSelectedServiceItemTemplate(): Promise<void> {
    const template = this.selectedServiceItemTemplate();
    if (!template) return;
    const confirmed = await this.confirmDialog.confirm({
      title: '確認刪除常用服務項目',
      message: `確定要刪除常用服務項目「${template.name}」嗎？此動作無法復原。`,
      confirmText: '刪除',
      confirmStyle: 'error',
    });
    if (!confirmed) return;
    this.deleteServiceItemTemplate(template.id);
    this.selectedServiceItemTemplateId.set('');
    this.toastService.success('已刪除常用服務項目');
  }

  saveCurrentCustomerTemplate(): void {
    const value = this.form.getRawValue();
    if (!this.quotationTemplates.saveCustomer({
      name: value.customerCompany || '',
      customerCompany: value.customerCompany || '',
      customerTaxID: value.customerTaxID || undefined,
      customerContact: value.customerContact || undefined,
      customerPhone: value.customerPhone || undefined,
      customerPhoneExt: value.customerPhoneExt || undefined,
      customerEmail: value.customerEmail || undefined,
      customerAddress: value.customerAddress || undefined,
    })) {
      this.toastService.error('請先填寫客戶名稱，才能儲存為常用客戶');
      return;
    }
    this.refreshTemplates();
    this.toastService.success('已儲存常用客戶（只在目前資料區）');
  }

  applyCustomerTemplate(template: CustomerTemplate): void {
    const current = this.form.getRawValue();
    const fields: (keyof CustomerTemplate)[] = [
      'customerCompany', 'customerTaxID', 'customerContact', 'customerPhone',
      'customerPhoneExt', 'customerEmail', 'customerAddress',
    ];
    const overwritesExisting = fields.some((field) => {
      const existing = current[field] ?? '';
      const replacement = template[field] ?? '';
      return existing !== '' && existing !== replacement;
    });
    if (overwritesExisting &&
      !window.confirm('套用常用客戶會取代目前客戶資訊，是否繼續？')) return;
    this.form.patchValue({
      customerCompany: template.customerCompany,
      customerTaxID: template.customerTaxID || '',
      customerContact: template.customerContact || '',
      customerPhone: template.customerPhone || '',
      customerPhoneExt: template.customerPhoneExt || '',
      customerEmail: template.customerEmail || '',
      customerAddress: template.customerAddress || '',
    });
    this.form.markAsDirty();
  }

  applyServiceItemTemplate(template: ServiceItemTemplate): void {
    const item = this.quotationFormService.createServiceItem();
    item.patchValue({
      category: template.category || '', item: template.item, price: template.price,
      unit: template.unit || '', count: 1,
    });
    this.serviceItems.push(item);
    this.form.markAsDirty();
  }

  saveServiceItemTemplate(index: number): void {
    const value = this.serviceItems.at(index)?.getRawValue();
    if (!value || !this.quotationTemplates.saveServiceItem({
      name: value.item || '', item: value.item || '', price: Number(value.price),
      unit: value.unit || undefined, category: value.category || undefined,
    })) {
      this.toastService.error('請填寫有效的項目名稱與非負單價');
      return;
    }
    this.refreshTemplates();
    this.toastService.success('已儲存常用服務項目');
  }

  renameCustomerTemplate(template: CustomerTemplate): void {
    const name = window.prompt('常用客戶名稱', template.name)?.trim();
    if (!name) return;
    this.quotationTemplates.saveCustomer({ ...template, name });
    this.refreshTemplates();
  }

  deleteCustomerTemplate(id: string): void {
    if (this.quotationTemplates.deleteCustomer(id)) this.refreshTemplates();
  }

  renameServiceItemTemplate(template: ServiceItemTemplate): void {
    const name = window.prompt('常用服務項目名稱', template.name)?.trim();
    if (!name) return;
    this.quotationTemplates.saveServiceItem({ ...template, name });
    this.refreshTemplates();
  }

  deleteServiceItemTemplate(id: string): void {
    if (this.quotationTemplates.deleteServiceItem(id)) this.refreshTemplates();
  }

  onCreateNextBusinessVersion(): void {
    const saved = this.savedBusinessVersion();
    if (!saved || this.documentScope !== this.localStorageScope() ||
        this.coordinator.getSelectedStorage() !== (this.isCloudStorage() ? 'cloud' : 'local') ||
        this.pendingSubmission || this.isSubmitting()) {
      this.toastService.error('請先完成儲存並確認結果，再建立下一版');
      return;
    }
    const current = this.collectFormData();
    let next: QuotationData;
    try {
      next = createNextBusinessVersion(current, saved);
    } catch {
      this.toastService.error('找不到已儲存的原始版本，請先儲存後再建立下一版');
      return;
    }
    this.quotationNumber.set(next.quotationNumber || '');
    this.quotationStatus.set(next.status || 'draft');
    this.quotationBusinessVersion.set(next.businessVersion || 1);
    this.form.patchValue({
      quotationId: next.quotationId || '',
      quotationNumber: next.quotationNumber || '',
      status: next.status || 'draft',
      businessVersion: next.businessVersion || 1,
      previousVersions: next.previousVersions || [],
    });
    // 下一個業務版本仍是同一份報價單；保留選取來源使儲存原地更新，
    // 舊版本只會保存在 previousVersions，不會另建同 ID 的 top-level 紀錄。
    this.form.markAsDirty();
    this.toastService.info('已建立下一個業務版本，儲存後才會寫入歷史');
  }

  onStatusChange(event: Event): void {
    const status = (event.target as HTMLSelectElement).value as 'draft' | 'sent' | 'won' | 'lost';
    this.quotationStatus.set(status);
    this.form.get('status')?.setValue(status);
    this.form.markAsDirty();
  }

  /** 雲端 v2 payload 與本機都保存此快照；查看不會覆寫目前文件。 */
  async onViewBusinessVersion(snapshot: QuotationVersionSnapshot): Promise<void> {
    if (this.blockWhileSubmissionPending()) return;
    const request = ++this.snapshotViewRequest;
    const epoch = this.documentEpoch;
    const scope = this.localStorageScope();
    const repository = this.isCloudStorage();
    const editor = JSON.stringify(this.readEditorData());
    const data = structuredClone(snapshot.data);
    const confirmed = await this.confirmDiscardUnsavedChanges(
      `查看 v${snapshot.businessVersion} 快照`,
      '目前版本尚未儲存，確定要放棄變更並查看舊版嗎？舊版儲存時會建立新的報價單。'
    );
    if (!confirmed || request !== this.snapshotViewRequest || epoch !== this.documentEpoch ||
        scope !== this.localStorageScope() || repository !== this.isCloudStorage() ||
        editor !== JSON.stringify(this.readEditorData()) || this.blockWhileSubmissionPending()) return;
    this.detachDocumentIdentity();
    this.loadQuotationData(data);
    this.documentScope = null;
    this.savedBusinessVersion.set(null);
    this.viewingBusinessSnapshot = true;
    this.selectedHistoryIndex.set(null);
    this.selectedHistoryId.set(null);
    this.coordinator.setSelectedStorage(null);
    this.form.markAsPristine();
    this.toastService.info(`正在查看 v${snapshot.businessVersion} 快照；儲存將建立新的報價，而非覆寫原文件`);
  }

  private refreshTemplates(): void {
    this.templateRevision.update((value) => value + 1);
  }

  private clearTemplateSelections(): void {
    this.selectedCustomerTemplateId.set('');
    this.selectedServiceItemTemplateId.set('');
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
    if (this.blockWhileSubmissionPending()) return;
    const confirmed = await this.confirmDiscardUnsavedChanges(
      '建立新表單',
      '目前表單尚未儲存，確定要建立新表單嗎？'
    );
    if (!confirmed || this.blockWhileSubmissionPending()) return;

    this.resetFormForNewQuotation();
  }

  async onLoadHistory(index: number): Promise<void> {
    if (this.blockWhileSubmissionPending()) return;
    const request = ++this.historyLoadRequest;
    const epoch = this.documentEpoch;
    const scope = this.localStorageScope();
    const repository = this.isCloudStorage();
    const formSnapshotAtLoad = this.serializeCurrentFormData();
    let data = this.historyData()[index];
    const entry = repository ? this.cloudQuotationSync.history()[index] : undefined;
    if (!data || (repository && !entry)) return;
    const isCurrent = () => request === this.historyLoadRequest &&
      epoch === this.documentEpoch && scope === this.localStorageScope() &&
      repository === this.isCloudStorage();
    const confirmed = await this.confirmDiscardUnsavedChanges(
      '載入其他報價單',
      '目前表單尚未儲存，確定要載入其他報價單嗎？'
    );
    if (!confirmed || !isCurrent() || this.blockWhileSubmissionPending()) return;
    if (formSnapshotAtLoad !== this.serializeCurrentFormData()) {
      this.toastService.warning('載入期間表單已變更，已保留目前編輯內容');
      return;
    }

    this.analytics.trackHistoryLoaded(index);

    if (entry) {
      try {
        data = await this.cloudQuotationSync.load(entry);
        if (!isCurrent() || this.blockWhileSubmissionPending()) return;
        if (formSnapshotAtLoad !== this.serializeCurrentFormData()) {
          this.toastService.warning('載入期間表單已變更，已保留目前編輯內容');
          return;
        }
        this.loadCloudHistory();
      } catch {
        if (isCurrent()) this.toastService.error('無法讀取雲端報價單，請稍後再試');
        return;
      }
    }
    this.selectedHistoryIndex.set(index);
    this.selectedHistoryId.set(normalizeQuotationLifecycle(data).quotationId || null);
    this.coordinator.setSelectedStorage(
      repository ? 'cloud' : 'local'
    );
    this.loadQuotationData(data);
    this.markFormPristine();
  }

  async onDeleteHistory(index: number): Promise<void> {
    if (this.blockWhileSubmissionPending()) return;
    const startedScope = this.localStorageScope();
    const startedRoute = this.isCloudStorage() ? 'cloud' : 'local';
    const startedVersion = this.coordinator.nextOperationVersion();
    const startedData = this.historyData()[index];
    const startedCloudEntry = startedRoute === 'cloud'
      ? this.cloudQuotationSync.history()[index]
      : undefined;
    const targetId = startedRoute === 'cloud'
      ? startedCloudEntry?.quotationId
      : startedData && normalizeQuotationLifecycle(startedData).quotationId;
    if (!startedData || !targetId) return;
    const confirmed = await this.confirmDialog.confirm({
      title: '刪除歷史記錄',
      message: '確定要刪除此筆歷史記錄嗎？',
      confirmText: '刪除',
      confirmStyle: 'error',
    });
    if (!confirmed || this.blockWhileSubmissionPending()) return;
    if (!this.coordinator.isCurrentOperation(startedVersion) ||
      startedScope !== this.localStorageScope() ||
      startedRoute !== (this.isCloudStorage() ? 'cloud' : 'local')) {
      return;
    }

    const currentIndex = startedRoute === 'cloud'
      ? this.cloudQuotationSync.history().findIndex((entry) => entry.quotationId === targetId)
      : this.historyData().findIndex(
          (entry) => normalizeQuotationLifecycle(entry).quotationId === targetId
        );
    if (currentIndex < 0) return;

    if (startedRoute === 'cloud') {
      const entry = this.cloudQuotationSync.history().find(
        (item) => item.quotationId === targetId
      );
      if (!entry) return;
      try {
        await this.cloudQuotationSync.delete(entry);
        if (!this.coordinator.isCurrentOperation(startedVersion) ||
          startedScope !== this.localStorageScope() || !this.isCloudStorage()) return;
        this.analytics.trackHistoryDeleted(currentIndex);
        this.updateSelectedIndexAfterDelete(currentIndex);
        this.loadCloudHistory();
      } catch {
        this.toastService.error('無法刪除雲端報價單，請稍後再試');
      }
      return;
    }

    const success = this.quotationStorage.deleteFromHistory(currentIndex, startedScope);
    if (success) {
      this.analytics.trackHistoryDeleted(currentIndex);
      this.updateSelectedIndexAfterDelete(currentIndex);
      this.loadHistoryFromLocalStorage();
    }
  }

  private updateSelectedIndexAfterDelete(deletedIndex: number): void {
    const currentIndex = this.selectedHistoryIndex();

    if (currentIndex === deletedIndex) {
      this.selectedHistoryIndex.set(null);
      this.selectedHistoryId.set(null);
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
    this.quotationNumber.set('');
    this.quotationStatus.set('draft');
    this.quotationBusinessVersion.set(1);
    this.savedBusinessVersion.set(null);
    this.form?.patchValue({ quotationId: '', quotationNumber: '', status: 'draft', businessVersion: 1, previousVersions: [] });
  }

  private loadQuotationData(data: QuotationData): void {
    const normalized = normalizeQuotationLifecycle(data);
    this.documentScope = this.localStorageScope();
    this.quotationFormService.loadQuotationData(this.form, normalized);
    this.customerLogo.set(data.customerLogo || '');
    this.stamp.set(data.quoterStamp || '');
    this.quoterLogo.set(data.quoterLogo || '');
    this.quotationNumber.set(normalized.quotationNumber || '');
    this.quotationStatus.set(normalized.status || 'draft');
    this.quotationBusinessVersion.set(normalized.businessVersion || 1);
    this.selectedHistoryId.set(normalized.quotationId || null);
    this.savedBusinessVersion.set(structuredClone(normalized));
    this.form.patchValue({
      quotationId: normalized.quotationId || '',
      quotationNumber: normalized.quotationNumber || '',
      status: normalized.status || 'draft',
      businessVersion: normalized.businessVersion || 1,
      previousVersions: normalized.previousVersions || [],
    }, { emitEvent: false });
  }

  /** 收集目前表單內容（含圖片）為 QuotationData */
  private collectFormData(): QuotationData {
    const data = this.form.getRawValue();
    return normalizeQuotationLifecycle({
      ...data,
      customerLogo: this.customerLogo(),
      quoterStamp: this.stamp(),
      quoterLogo: this.quoterLogo(),
      quotationNumber: this.quotationNumber(),
      status: this.quotationStatus(),
      businessVersion: this.quotationBusinessVersion(),
      quotationId: data.quotationId || undefined,
      previousVersions: data.previousVersions || [],
    });
  }

  /**
   * 儲存記錄：編輯既有筆時覆蓋更新，否則新增
   */
  onSubmit(): Promise<void> {
    return this.submitQuotation(false);
  }

  /**
   * 另存新檔：不論目前是否在編輯既有筆，都以目前內容新增一筆
   */
  onSaveAsNew(): Promise<void> {
    return this.submitQuotation(true);
  }

  private showSuccessToast(isUpdate: boolean): void {
    this.toastService.success(isUpdate ? '報價單已更新' : '報價單已成功儲存');
  }

  ngOnDestroy(): void {
    this.cleanupResources();
  }

  private cleanupResources(): void {
    this.datePickerService.destroy(this.startDate);
    this.datePickerService.destroy(this.endDate);
    this.resizeListener?.();
    this.exportInvalidListener?.();
  }

  private saveLocalStorage(data: QuotationData, forceCreate = false): boolean {
    const current = data;
    const selectedId = this.selectedHistoryId();
    const baseline = this.savedBusinessVersion();
    const isUpdate = !forceCreate && (selectedId !== null || baseline !== null);
    if (isUpdate && (!selectedId || !baseline || this.coordinator.getSelectedStorage() !== 'local')) {
      this.toastService.error('原本的報價紀錄無法定位；未新增任何紀錄，請重新載入確認');
      return false;
    }
    const storedHistory = this.quotationStorage.getHistory(this.localStorageScope());
    const selectedIndex = selectedId
      ? storedHistory.findIndex((entry) => entry.quotationId === selectedId)
      : null;
    const isCopyOfExisting =
      forceCreate &&
      selectedIndex !== null &&
      selectedIndex >= 0 &&
      selectedIndex < storedHistory.length &&
      this.coordinator.getSelectedStorage() === 'local';

    // 載入既有紀錄並修改 → 原地覆蓋更新；否則新增一筆
    const success = isUpdate
      ? this.quotationStorage.updateHistoryById(selectedId!, current, baseline!, this.localStorageScope())
      : isCopyOfExisting
        ? this.quotationStorage.saveCopyToHistory(current, selectedIndex, this.localStorageScope())
      : this.quotationStorage.saveToHistory(current, this.localStorageScope());

    if (success) {
      // 重新載入歷史記錄
      this.loadHistoryFromLocalStorage();
      this.applySavedQuotationState(current, 'local');

      // 新增時，新紀錄位於最前面，將選取索引指向它，
      // 以便後續再次儲存時會更新同一筆，而非持續新增重複
      this.showSuccessToast(isUpdate);
    }
    return success;
  }

  async onDriveConnect(): Promise<void> {
    if (this.isCloudStorage()) {
      await this.resumeCloudConnection(() => this.cloudQuotationSync.beginConnect());
      return;
    }
    const scope = this.localStorageScope();
    try {
      await this.coordinator.handleConnect(
        () => this.cloudQuotationSync.beginConnect(),
        (error) => {
          const message =
            error instanceof Error ? error.message : 'Google Drive 授權流程失敗';
          this.toastService.error(`Google Drive 連結失敗：${message}`);
        }
      );
    } finally {
      if (scope === this.localStorageScope()) this.reconcileRepositoryIdentity();
    }
  }

  async onCloudSyncToggleChange(event: Event): Promise<void> {
    const control = event.currentTarget as HTMLInputElement;
    const enabled = control.checked;
    const request = ++this.cloudToggleRequest;
    // Native change already toggled the DOM, even if the signal stays unchanged.
    control.checked = this.isCloudStorage();
    try {
      await this.onCloudSyncToggle(enabled);
    } finally {
      // Never restore an old owner's requested value or touch a detached control.
      if (request === this.cloudToggleRequest && control.isConnected) {
        control.checked = this.isCloudStorage();
      }
    }
  }

  async onCloudSyncToggle(enabled: boolean): Promise<void> {
    if (enabled && this.isCloudStorage()) {
      await this.resumeCloudConnection(() => this.cloudQuotationSync.setSyncEnabled(true));
      return;
    }
    const scope = this.localStorageScope();
    try {
      await this.coordinator.handleToggle(() => this.cloudQuotationSync.setSyncEnabled(enabled));
    } finally {
      if (scope === this.localStorageScope()) this.reconcileRepositoryIdentity();
    }
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
    if (this.isCloudStorage()) {
      await this.resumeCloudConnection(() => this.cloudQuotationSync.initialize());
      return;
    }
    const scope = this.localStorageScope();
    try {
      await this.coordinator.handleInitialize(() => this.cloudQuotationSync.initialize());
    } finally {
      if (scope === this.localStorageScope()) this.reconcileRepositoryIdentity();
    }
  }

  private async resumeCloudConnection(connect: () => Promise<void>): Promise<void> {
    const epoch = this.documentEpoch;
    const scope = this.localStorageScope();
    try {
      await connect();
      if (epoch !== this.documentEpoch || scope !== this.localStorageScope() ||
          !this.isCloudStorage() || !this.cloudQuotationSync.isCloudStorage()) return;
      this.loadCloudHistory();
      const index = this.cloudQuotationSync.history().findIndex((entry) => entry.quotationId === this.selectedHistoryId());
      this.selectedHistoryIndex.set(index >= 0 ? index : null);
      if (this.pendingSubmission) await this.submitQuotation(false);
    } catch (error) {
      if (epoch !== this.documentEpoch || scope !== this.localStorageScope()) return;
      this.toastService.error(error instanceof Error ? error.message : 'Google Drive 重新連線失敗');
    }
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

  private readEditorData(): QuotationData {
    return {
      ...this.form.getRawValue(),
      customerLogo: this.customerLogo(), quoterStamp: this.stamp(), quoterLogo: this.quoterLogo(),
      quotationNumber: this.quotationNumber(), status: this.quotationStatus(),
      businessVersion: this.quotationBusinessVersion(),
    };
  }

  private blockWhileSubmissionPending(): boolean {
    if (!this.pendingSubmission) return false;
    this.toastService.warning('請先完成或確認目前儲存，再切換報價單');
    return true;
  }

  private isCurrentSubmission(submission: QuotationSubmission): boolean {
    return submission.epoch === this.documentEpoch &&
      submission.scope === this.localStorageScope() &&
      submission.repository === (this.isCloudStorage() ? 'cloud' : 'local');
  }

  private submitQuotation(forceCreate: boolean): Promise<void> {
    this.reconcileRepositoryIdentity();
    if (this.documentScope !== null &&
        (this.documentScope !== this.localStorageScope() ||
         (this.coordinator.getSelectedStorage() !== null &&
          this.coordinator.getSelectedStorage() !== (this.isCloudStorage() ? 'cloud' : 'local')))) {
      this.detachDocumentIdentity();
    }
    if (this.pendingSubmission && !this.isCurrentSubmission(this.pendingSubmission)) {
      this.detachDocumentIdentity();
    }
    if (this.submissionFlight) return this.submissionFlight;
    if (this.isCloudStorage() && !this.cloudQuotationSync.isCloudStorage()) {
      this.toastService.warning('請先重新連線 Google Drive；原文件與未確認提交已保留');
      return Promise.resolve();
    }
    // An uncertain prior submission is resolved even if later edits are invalid.
    // This click never submits those later edits or creates a second copy.
    if (!this.pendingSubmission) {
      if (this.form.invalid) {
        this.form.markAllAsTouched();
        this.toastService.error('請先修正標示的金額或必填欄位，才能儲存報價單');
        this.focusFirstInvalidControl();
        return Promise.resolve();
      }
      const editor = this.readEditorData();
      const collected = this.collectFormData();
      forceCreate ||= this.viewingBusinessSnapshot;
      const payload = structuredClone(forceCreate ? cloneAsNewQuotation(collected) : collected);
      const repository = this.isCloudStorage() ? 'cloud' : 'local';
      const existing = !forceCreate && this.coordinator.getSelectedStorage() === 'cloud'
        ? this.cloudQuotationSync.history().find((entry) => entry.quotationId === this.selectedHistoryId())
        : undefined;
      try {
        this.pendingSubmission = {
          epoch: this.documentEpoch, scope: this.localStorageScope(), repository,
          editorFingerprint: JSON.stringify(editor), editorSource: editor, payload, forceCreate,
          duplicateNumber: hasDuplicateQuotationNumber(
            this.historyData(), payload.quotationNumber || '', payload.quotationId
          ),
          duplicateConfirmed: false,
          cloudIntent: repository === 'cloud' ? this.cloudQuotationSync.prepareSave(payload, existing) : undefined,
        };
      } catch {
        this.toastService.error('無法開始儲存；若上次結果尚未確認，請先確認原提交');
        return Promise.resolve();
      }
    }
    const submission = this.pendingSubmission;
    this.isSubmitting.set(true);
    // Install the shared flight before any asynchronous work can start.
    const flight = Promise.resolve().then(() => this.completeSubmission(submission)).finally(() => {
      if (this.submissionFlight === flight) {
        this.submissionFlight = null;
        this.isSubmitting.set(false);
      }
    });
    this.submissionFlight = flight;
    return flight;
  }

  private async completeSubmission(submission: QuotationSubmission): Promise<void> {
    if (!this.isCurrentSubmission(submission)) return;
    try {
      if (submission.duplicateNumber && !submission.duplicateConfirmed) {
        const confirmed = await this.confirmDialog.confirm({
          title: '報價編號重複',
          message: '目前已載入的歷史中有相同報價編號。離線或其他裝置仍可能有未同步資料；要繼續儲存嗎？',
          confirmText: '仍要儲存', confirmStyle: 'warning',
        });
        if (!this.isCurrentSubmission(submission)) return;
        if (!confirmed) {
          if (submission.cloudIntent) this.cloudQuotationSync.cancelPreparedSave(submission.cloudIntent);
          this.pendingSubmission = null;
          return;
        }
        submission.duplicateConfirmed = true;
      }
      if (submission.cloudIntent) {
        const saved = await this.cloudQuotationSync.submitSave(submission.cloudIntent);
        if (!this.isCurrentSubmission(submission)) return;
        const editor = this.readEditorData();
        const edited = JSON.stringify(editor) !== submission.editorFingerprint;
        this.loadCloudHistory();
        const index = this.cloudQuotationSync.history().findIndex((entry) => entry.revisionId === saved.revisionId);
        this.applySavedQuotationState(saved.data, 'cloud', index);
        // Preserve edits made while awaiting/retrying, including user-edited
        // metadata, while the verified saved baseline advances independently.
        if (edited) {
          for (const field of ['quotationNumber', 'status', 'businessVersion', 'previousVersions'] as const) {
            if (JSON.stringify(editor[field]) !== JSON.stringify(submission.editorSource[field])) {
              this.form.patchValue({ [field]: editor[field] }, { emitEvent: false });
              if (field === 'quotationNumber') this.quotationNumber.set(editor.quotationNumber || '');
              if (field === 'status') this.quotationStatus.set(editor.status || 'draft');
              if (field === 'businessVersion') this.quotationBusinessVersion.set(editor.businessVersion || 1);
            }
          }
          this.form.markAsDirty();
          this.toastService.info('已確認上次儲存；後續編輯仍保留，請再次儲存以送出變更');
        } else {
          this.markFormPristine();
          this.showSuccessToast(submission.cloudIntent.input.kind === 'update');
        }
      } else {
        const editor = this.readEditorData();
        if (!this.saveLocalStorage(submission.payload, submission.forceCreate)) {
          this.pendingSubmission = null;
          return;
        }
        if (JSON.stringify(editor) !== submission.editorFingerprint) {
          this.restoreSubmissionMetadataEdits(editor, submission);
          this.form.markAsDirty();
        } else this.markFormPristine();
      }
      this.pendingSubmission = null;
      this.submissionUncertain.set(false);
      this.analytics.trackQuotationGenerated();
    } catch {
      if (!this.isCurrentSubmission(submission)) return;
      const uncertain = !!submission.cloudIntent &&
        this.cloudQuotationSync.saveOutcome(submission.cloudIntent) === 'unknown';
      this.submissionUncertain.set(uncertain);
      if (!uncertain) this.pendingSubmission = null;
      this.toastService.error(uncertain
        ? '尚未確認儲存結果。再次按儲存會先確認上次提交；後續編輯將保留'
        : '儲存尚未送出，請稍後再試');
    }
  }
  private restoreSubmissionMetadataEdits(editor: QuotationData, submission: QuotationSubmission): void {
    for (const field of ['quotationNumber', 'status', 'businessVersion', 'previousVersions'] as const) {
      if (JSON.stringify(editor[field]) !== JSON.stringify(submission.editorSource[field])) {
        this.form.patchValue({ [field]: editor[field] }, { emitEvent: false });
        if (field === 'quotationNumber') this.quotationNumber.set(editor.quotationNumber || '');
        if (field === 'status') this.quotationStatus.set(editor.status || 'draft');
        if (field === 'businessVersion') this.quotationBusinessVersion.set(editor.businessVersion || 1);
      }
    }
  }
  /** 將 repository 回傳的 canonical 資料回寫畫面；本機、雲端走相同收斂路徑。 */
  private applySavedQuotationState(
    data: QuotationData,
    storage: 'local' | 'cloud',
    selectedIndex?: number
  ): void {
    const normalized = normalizeQuotationLifecycle(data);
    this.viewingBusinessSnapshot = false;
    this.documentScope = this.localStorageScope();
    this.form.patchValue({
      quotationId: normalized.quotationId || '',
      quotationNumber: normalized.quotationNumber || '',
      status: normalized.status || 'draft',
      businessVersion: normalized.businessVersion || 1,
      previousVersions: normalized.previousVersions || [],
    }, { emitEvent: false });
    this.quotationNumber.set(normalized.quotationNumber || '');
    this.quotationStatus.set(normalized.status || 'draft');
    this.quotationBusinessVersion.set(normalized.businessVersion || 1);
    this.selectedHistoryId.set(normalized.quotationId || null);
    this.savedBusinessVersion.set(structuredClone(normalized));
    const index = selectedIndex ?? this.historyData().findIndex(
      (entry) => normalizeQuotationLifecycle(entry).quotationId === normalized.quotationId
    );
    this.selectedHistoryIndex.set(index >= 0 ? index : null);
    this.coordinator.setSelectedStorage(index >= 0 ? storage : null);
  }
}
