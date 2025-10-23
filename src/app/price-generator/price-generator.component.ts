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
import { HistoryModal } from '../history-modal/history-modal';
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
} from 'lucide-angular';

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
    HistoryModal,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './price-generator.component.html',
})
export class PriceGeneratorComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private renderer = inject(Renderer2);
  private analytics = inject(AnalyticsService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  private startDateInput = viewChild<ElementRef>('startDate');
  private endDateInput = viewChild<ElementRef>('endDate');
  private previewModal =
    viewChild<ElementRef<HTMLDialogElement>>('preview_modal');
  historyModal = viewChild(HistoryModal);

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

  // Computed
  hasHistory = computed(() => this.historyData().length > 0);

  get serviceItems() {
    return this.form?.get('serviceItems') as FormArray;
  }

  ngOnInit() {
    this.setStartDate();
    this.setEndDate();
    try {
      this.historyData.set(
        JSON.parse(localStorage.getItem('quotation') || '[]')
      );
    } catch (error) {
      console.error(
        'Failed to load quotation history from localStorage:',
        error
      );
      this.historyData.set([]);
    }
    this.initForm();
    this.createTodoItem();
    this.setupFormListeners();
    this.setupResizeListener();
  }

  private setupResizeListener(): void {
    this.resizeListener = this.renderer.listen('window', 'resize', () => {
      // DaisyUI 的 lg 斷點是 1024px
      if (window.innerWidth >= 1024) {
        const modal = this.previewModal()?.nativeElement;
        if (modal?.open) {
          modal.close();
        }
      }
    });
  }

  private setupFormListeners(): void {
    this.serviceItems.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.calculateTotals());

    this.form
      .get('percentage')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.calculateTotals());
  }

  private calculateTotals(): void {
    const items = this.serviceItems.value;
    const excludingTax = items.reduce((acc: number, item: any) => {
      return acc + (item.amount || 0);
    }, 0);

    const percentage = Number(this.form.get('percentage')?.value) || 0;
    const tax = Math.ceil((percentage / 100) * excludingTax);
    const includingTax = excludingTax + tax;

    this.form.patchValue(
      { excludingTax, tax, includingTax },
      { emitEvent: false }
    );
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
        return;
      default:
        percentage = 0;
    }

    this.form.patchValue({ percentage });
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

  createTodoItem() {
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

  onAddField() {
    this.createTodoItem();
  }

  onRemoveField(index: number) {
    if (this.serviceItems.value.length > 1) {
      this.serviceItems.removeAt(index);
    }
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
    // 確認刪除
    if (!confirm('確定要刪除此筆歷史記錄嗎？')) {
      return;
    }

    this.analytics.trackHistoryDeleted(index);

    // 如果刪除的是目前選取的項目，重置選取狀態
    if (this.selectedHistoryIndex() === index) {
      this.selectedHistoryIndex.set(null);
    } else if (this.selectedHistoryIndex() !== null && this.selectedHistoryIndex()! > index) {
      // 如果刪除的項目在目前選取項目之前，需要調整索引
      this.selectedHistoryIndex.update(current => current! - 1);
    }

    // 從陣列中移除指定索引的項目
    this.historyData.update((history) => {
      const newHistory = [...history];
      newHistory.splice(index, 1);
      return newHistory;
    });

    // 更新 localStorage
    try {
      localStorage.setItem('quotation', JSON.stringify(this.historyData()));
    } catch (error) {
      console.error('Failed to update quotation history in localStorage:', error);
    }
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
    this.createTodoItem();
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
    // 3 秒後自動隱藏
    setTimeout(() => {
      this.showToast.set(false);
    }, 3000);
  }

  ngOnDestroy() {
    this.startDate?.destroy();
    this.endDate?.destroy();
    this.resizeListener?.();
  }

  saveLocalStorage(data: QuotationData) {
    this.historyData.update((history) => {
      const newHistory = [data, ...history];
      if (newHistory.length > 5) {
        newHistory.pop();
      }
      return newHistory;
    });

    try {
      localStorage.setItem('quotation', JSON.stringify(this.historyData()));
    } catch (error) {
      console.error('Failed to save quotation to localStorage:', error);
    }
  }
}
