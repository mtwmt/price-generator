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
import {
  FormGroup,
  FormArray,
  ReactiveFormsModule,
  Validators,
  FormBuilder,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
// Removed NgbModal - will use DaisyUI modal instead
import { ServiceItemControlComponent } from '../service-item-control/service-item-control.component';
import Litepicker from 'litepicker';
import { QuotationPreview } from '../quotation-preview/quotation-preview';
import { QuotationData } from '../quotation.model';
import { AnalyticsService } from '../services/analytics';
import { taxIdValidator } from '../validators/tax-id.validator';
import { phoneValidator } from '../validators/phone.validator';
import { FileUpload } from '../file-upload/file-upload';
import { calculateDiscount, calculateTaxAndTotal } from '../utils/calculator';
import {
  LucideAngularModule,
  ListPlus,
  Eye,
  Upload,
  Trash2,
  History,
  FileText,
  Check,
  Mail,
  Phone,
  X,
  Users,
  Building2,
  ShoppingCart,
  FileCheck,
  ReceiptText,
  MessageSquareQuote,
  UserRound,
  MapPin,
  Calendar1,
  ChevronDown,
  FilePlus,
  GripVertical,
  EyeOff,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-angular';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-price-generator',
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
    ServiceItemControlComponent,
    QuotationPreview,
    LucideAngularModule,
    FileUpload,
    DragDropModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './price-generator.component.html',
})
export class PriceGeneratorComponent implements OnInit, OnDestroy {
  // Constants
  private readonly MAX_HISTORY_ITEMS = 5;
  private readonly TOAST_DISPLAY_DURATION_MS = 3000;
  private readonly DESKTOP_BREAKPOINT_PX = 1024;
  private readonly LOCALSTORAGE_KEY = 'quotation';

  // Dependencies
  private fb = inject(FormBuilder);
  private renderer = inject(Renderer2);
  private analytics = inject(AnalyticsService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  // View Children
  private startDateInput = viewChild<ElementRef>('startDate');
  private endDateInput = viewChild<ElementRef>('endDate');
  private previewModal =
    viewChild<ElementRef<HTMLDialogElement>>('preview_modal');

  // Listeners
  private resizeListener?: () => void;

  // Lucide Icons
  readonly Eye = Eye;
  readonly Upload = Upload;
  readonly Trash2 = Trash2;
  readonly ListPlus = ListPlus;
  readonly History = History;
  readonly FileText = FileText;
  readonly Check = Check;
  readonly Mail = Mail;
  readonly Phone = Phone;
  readonly X = X;
  readonly Users = Users;
  readonly Building2 = Building2;
  readonly ShoppingCart = ShoppingCart;
  readonly FileCheck = FileCheck;
  readonly ReceiptText = ReceiptText;
  readonly MessageSquareQuote = MessageSquareQuote;
  readonly UserRound = UserRound;
  readonly MapPin = MapPin;
  readonly Calendar1 = Calendar1;
  readonly ChevronDown = ChevronDown;
  readonly FilePlus = FilePlus;
  readonly GripVertical = GripVertical;
  readonly EyeOff = EyeOff;
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
  showToast = signal<boolean>(false);
  showPreview = signal<boolean>(true);

  // Computed
  hasHistory = computed(() => this.historyData().length > 0);

  get serviceItems() {
    return this.form?.get('serviceItems') as FormArray;
  }

  ngOnInit() {
    this.setStartDate();
    this.setEndDate();
    this.loadHistoryFromLocalStorage();
    this.initForm();
    this.createServiceItem();
    this.setupFormListeners();
    this.setupResizeListener();
  }

  private loadHistoryFromLocalStorage(): void {
    try {
      const storedData = localStorage.getItem(this.LOCALSTORAGE_KEY) || '[]';
      this.historyData.set(JSON.parse(storedData));
    } catch (error) {
      console.error(
        'Failed to load quotation history from localStorage:',
        error
      );
      this.historyData.set([]);
    }
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

  private setupFormListeners(): void {
    this.subscribeToServiceItemsChanges();
    this.subscribeToFormControlChanges('percentage');
    this.subscribeToFormControlChanges('discountType');
    this.subscribeToFormControlChanges('discountValue');
  }

  private subscribeToServiceItemsChanges(): void {
    this.serviceItems.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.calculateTotals());
  }

  private subscribeToFormControlChanges(controlName: string): void {
    this.form
      .get(controlName)
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.calculateTotals());
  }

  private calculateTotals(): void {
    // 1. 計算小計（服務項目總和）
    const excludingTax = this.calculateSubtotal();

    // 2. 計算折扣
    const discountType = this.form.get('discountType')?.value || 'amount';
    const discountValue = Number(this.form.get('discountValue')?.value) || 0;
    const { discountAmount, afterDiscount } = calculateDiscount(
      excludingTax,
      discountType,
      discountValue
    );

    // 3. 計算稅額和總計
    const taxPercentage = Number(this.form.get('percentage')?.value) || 0;
    const { tax, includingTax } = calculateTaxAndTotal(
      afterDiscount,
      taxPercentage
    );

    // 4. 更新表單
    this.form.patchValue(
      { excludingTax, discountAmount, afterDiscount, tax, includingTax },
      { emitEvent: false }
    );
  }

  /**
   * 計算小計（所有服務項目的金額總和）
   */
  private calculateSubtotal(): number {
    const items = this.serviceItems.value;
    return items.reduce((acc: number, item: any) => {
      return acc + (item.amount || 0);
    }, 0);
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

  /**
   * 統一處理數字輸入欄位的正規化
   * - 移除前導零
   * - 可選的最大值限制
   */
  private normalizeNumberInput(controlName: string, maxValue?: number): void {
    const control = this.form.get(controlName);
    if (!control) return;

    const value = control.value;
    if (value === null || value === undefined || value === '') return;

    let numValue = Number(value);
    if (isNaN(numValue)) return;

    // 如果有最大值限制
    if (maxValue !== undefined && numValue > maxValue) {
      numValue = maxValue;
    }

    control.setValue(numValue);
  }

  /**
   * 處理折扣值的正規化
   * 固定金額折扣不可超過小計
   */
  normalizeDiscountValue(): void {
    const discountType = this.form.get('discountType')?.value;
    const maxValue =
      discountType === 'amount'
        ? this.form.get('excludingTax')?.value || 0
        : undefined;

    this.normalizeNumberInput('discountValue', maxValue);
  }

  /**
   * 處理稅率的正規化
   * - 移除前導零
   * - 限制在 0-100 之間
   */
  normalizePercentage(): void {
    this.normalizeNumberInput('percentage', 100);
  }

  initForm() {
    this.form = this.fb.group({
      // 客戶資料
      customerCompany: ['', Validators.required],
      customerTaxID: ['', taxIdValidator()],
      customerContact: [''],
      customerPhone: ['', phoneValidator()],
      customerEmail: ['', Validators.email],
      customerAddress: [''],

      // 報價者資料
      quoterName: ['', Validators.required],
      quoterTaxID: ['', taxIdValidator()],
      quoterAddress: [''],
      quoterEmail: ['', [Validators.required, Validators.email]],
      quoterPhone: ['', phoneValidator()],
      startDate: [this.getTodayDate()],
      endDate: [''],

      // 服務項目與稅率
      serviceItems: this.fb.array([], Validators.required),
      excludingTax: [0],
      discountType: ['amount'], // 折扣類型：amount 或 percentage
      discountValue: [0], // 折扣值
      discountAmount: [0], // 計算後的折扣金額
      afterDiscount: [0], // 折扣後金額
      taxName: [''],
      customTaxName: [''], // 自訂稅別名稱
      percentage: [0],
      tax: [{ value: 0, disabled: true }],
      includingTax: [0],

      // 其他資訊
      desc: [''],
      isSign: [true],
    });
  }

  private getTodayDate(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onLogoChange(file: FileList) {
    if (file && file[0]) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.customerLogo.set(e.target.result);
      };
      reader.readAsDataURL(file[0]);
    }
  }

  onQuoterLogoChange(file: FileList) {
    if (file && file[0]) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.quoterLogo.set(e.target.result);
      };
      reader.readAsDataURL(file[0]);
    }
  }

  onStampChange(file: FileList) {
    if (file && file[0]) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.stamp.set(e.target.result);
      };
      reader.readAsDataURL(file[0]);
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

  setStartDate() {
    const element = this.startDateInput()?.nativeElement;
    if (!element) return;

    this.startDate = new Litepicker({
      element: element,
      startDate: new Date(),
    });

    this.startDate.on('selected', (date) => {
      this.form.get('startDate')?.setValue(date.format('YYYY-MM-DD'));
      this.cdr.markForCheck();
    });
  }

  setEndDate() {
    const element = this.endDateInput()?.nativeElement;
    if (!element) return;

    this.endDate = new Litepicker({
      element: element,
      lockDays: [[new Date(0), new Date()]],
      resetButton: () => {
        let btn = this.renderer.createElement('a');
        this.renderer.addClass(btn, 'btn');
        this.renderer.addClass(btn, 'btn-primary');
        this.renderer.addClass(btn, 'btn-sm');
        this.renderer.setProperty(btn, 'innerText', '待確認');
        this.renderer.listen(btn, 'click', (evt) => {
          evt.preventDefault();
          this.form.get('endDate')?.setValue(null);
          this.cdr.markForCheck();
        });
        return btn;
      },
    });

    this.endDate.on('selected', (date) => {
      this.form.get('endDate')?.setValue(date.format('YYYY-MM-DD'));
      this.cdr.markForCheck();
    });
  }

  private createServiceItem(): void {
    this.serviceItems.push(
      this.fb.group({
        category: [''],
        item: ['', Validators.required],
        price: [null, Validators.required],
        count: [1],
        unit: [''],
        amount: [0],
      })
    );
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
    this.removeHistoryItem(index);
    this.persistHistoryToStorage();
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

  private removeHistoryItem(index: number): void {
    this.historyData.update((history) => {
      const newHistory = [...history];
      newHistory.splice(index, 1);
      return newHistory;
    });
  }

  private resetForm(): void {
    this.form.reset({
      customerCompany: '',
      customerTaxID: '',
      customerContact: '',
      customerPhone: '',
      customerEmail: '',
      customerAddress: '',
      quoterName: '',
      quoterTaxID: '',
      quoterAddress: '',
      quoterEmail: '',
      quoterPhone: '',
      startDate: this.getTodayDate(),
      endDate: '',
      excludingTax: 0,
      discountType: 'amount',
      discountValue: 0,
      discountAmount: 0,
      afterDiscount: 0,
      taxName: '',
      customTaxName: '',
      percentage: 0,
      tax: 0,
      includingTax: 0,
      desc: '',
      isSign: true,
    });
    this.customerLogo.set('');
    this.stamp.set('');
    this.quoterLogo.set('');
    this.serviceItems.clear();
    this.createServiceItem();
  }

  private loadQuotationData(data: QuotationData): void {
    const { customerLogo, quoterLogo, quoterStamp, serviceItems, ...formData } =
      data;
    this.form.patchValue(formData);
    this.customerLogo.set(customerLogo || '');
    this.stamp.set(quoterStamp || '');
    this.quoterLogo.set(quoterLogo || '');
    this.loadServiceItems(serviceItems);
  }

  private loadServiceItems(items: any[]): void {
    this.serviceItems.clear();
    items.forEach((item) => {
      this.serviceItems.push(
        this.fb.group({
          category: [item.category ?? ''],
          item: [item.item ?? '', Validators.required],
          price: [item.price ?? 0, Validators.required],
          count: [item.count ?? 1],
          unit: [item.unit ?? ''],
          amount: [item.amount ?? 0],
        })
      );
    });
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
    this.showToast.set(true);
    setTimeout(() => {
      this.showToast.set(false);
    }, this.TOAST_DISPLAY_DURATION_MS);
  }

  ngOnDestroy(): void {
    this.cleanupResources();
  }

  private cleanupResources(): void {
    this.startDate?.destroy();
    this.endDate?.destroy();
    this.resizeListener?.();
  }

  private saveLocalStorage(data: QuotationData): void {
    this.updateHistoryData(data);
    this.persistHistoryToStorage();
  }

  private updateHistoryData(data: QuotationData): void {
    this.historyData.update((history) => {
      const newHistory = [data, ...history];
      return this.limitHistorySize(newHistory);
    });
  }

  private limitHistorySize(history: QuotationData[]): QuotationData[] {
    if (history.length > this.MAX_HISTORY_ITEMS) {
      return history.slice(0, this.MAX_HISTORY_ITEMS);
    }
    return history;
  }

  private persistHistoryToStorage(): void {
    try {
      const historyJson = JSON.stringify(this.historyData());
      localStorage.setItem(this.LOCALSTORAGE_KEY, historyJson);
    } catch (error) {
      console.error('Failed to save quotation to localStorage:', error);
    }
  }
}
