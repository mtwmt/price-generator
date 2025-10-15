import {
  ChangeDetectionStrategy,
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
  afterNextRender,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormGroup,
  FormControl,
  FormArray,
  ReactiveFormsModule,
  Validators,
  FormBuilder,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NgbDatepickerModule,
  NgbModal,
  NgbModalRef,
} from '@ng-bootstrap/ng-bootstrap';
import { ServiceItemControlComponent } from '../service-item-control/service-item-control.component';
import Litepicker from 'litepicker';
import { QuotationModalComponent } from '../quotation-modal/quotation-modal.component';
import { CommentsComponent } from '../comments/comments.component';
import { DonateComponent } from '../donate/donate.component';
import { ChangelogComponent } from '../changelog/changelog';
import { QuotationData } from '../quotation.model';
import { AnalyticsService } from '../services/analytics';
import { taxIdValidator } from '../validators/tax-id.validator';

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
    NgbDatepickerModule,
    ServiceItemControlComponent,
    CommentsComponent,
    DonateComponent,
    ChangelogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './price-generator.component.html',
})
export class PriceGeneratorComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private modal = inject(NgbModal);
  private renderer = inject(Renderer2);
  private analytics = inject(AnalyticsService);
  private destroyRef = inject(DestroyRef);

  private startDateInput = viewChild<ElementRef>('startDate');
  private endDateInput = viewChild<ElementRef>('endDate');

  startDate!: Litepicker;
  endDate!: Litepicker;

  constructor() {
    afterNextRender(() => {
      this.setStartDate();
      this.setEndDate();
    });
  }

  form!: FormGroup;

  logo = signal<string>('');
  stamp = signal<string>('');
  historyData = signal<QuotationData[]>([]);
  activeTab = signal<'quotation' | 'changelog'>('quotation');

  hasHistory = computed(() => this.historyData().length > 0);

  get serviceItems() {
    return this.form?.get('serviceItems') as FormArray;
  }

  ngOnInit() {
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
  }

  private setupFormListeners(): void {
    this.serviceItems.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.calculateTotals());

    this.form.get('percentage')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
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

  initForm() {
    this.form = this.fb.group({
      logo: [''],
      stamp: [''],
      company: ['', Validators.required],
      customerTaxID: ['', taxIdValidator()],
      quoterName: ['', Validators.required],
      quoterTaxID: ['', taxIdValidator()],
      email: ['', [Validators.required, Validators.email]],
      tel: [''],
      startDate: [this.getTodayDate()],
      endDate: [''],
      serviceItems: this.fb.array([], Validators.required),
      excludingTax: [0],
      taxName: [''],
      percentage: [0],
      tax: [{ value: 0, disabled: true }],
      includingTax: [0],
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
        this.logo.set(e.target.result);
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

  removeLogo(input: HTMLInputElement) {
    this.logo.set('');
    input.value = '';
  }

  removeStamp(input: HTMLInputElement) {
    this.stamp.set('');
    input.value = '';
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
        });
        return btn;
      },
    });

    this.endDate.on('selected', (date) => {
      this.form.get('endDate')?.setValue(date.format('YYYY-MM-DD'));
    });
  }

  createTodoItem() {
    this.serviceItems.push(
      new FormControl({
        category: null,
        item: null,
        price: null,
        count: 1,
        unit: null,
        amount: 0,
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

  onHistoryChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const index = target.value;

    if (index) {
      this.analytics.trackHistoryLoaded(parseInt(index, 10));
    }

    if (!index) {
      this.resetForm();
      return;
    }

    const data = this.historyData()[parseInt(index, 10)];
    if (!data) {
      console.warn(`History data not found at index: ${index}`);
      return;
    }

    this.loadQuotationData(data);
  }

  private resetForm(): void {
    this.form.reset({
      logo: '',
      stamp: '',
      company: '',
      customerTaxID: '',
      quoterName: '',
      quoterTaxID: '',
      email: '',
      tel: '',
      startDate: this.getTodayDate(),
      endDate: '',
      excludingTax: 0,
      taxName: '',
      percentage: 0,
      tax: 0,
      includingTax: 0,
      desc: '',
      isSign: true,
    });
    this.logo.set('');
    this.stamp.set('');
    this.serviceItems.clear();
    this.createTodoItem();
  }

  private loadQuotationData(data: QuotationData): void {
    const { logo, stamp, serviceItems, ...formData } = data;
    this.form.patchValue(formData);
    this.logo.set(logo || '');
    this.stamp.set(stamp || '');
    this.loadServiceItems(serviceItems);
  }

  private loadServiceItems(items: any[]): void {
    this.serviceItems.clear();
    items.forEach((item) => {
      this.serviceItems.push(
        this.fb.control({
          category: item.category ?? null,
          item: item.item ?? null,
          price: item.price ?? null,
          count: item.count ?? 1,
          unit: item.unit ?? null,
          amount: item.amount ?? 0,
        })
      );
    });
  }

  onSubmit() {
    const data = this.form.getRawValue();
    const dataWithImages = { ...data, logo: this.logo(), stamp: this.stamp() };
    this.saveLocalStorage(dataWithImages);
    this.openModal();
  }

  onPreview() {
    this.openModal(true);
  }

  openModal(isPreview: boolean = false) {
    if (isPreview) {
      this.analytics.trackQuotationPreviewed();
    } else {
      this.analytics.trackQuotationGenerated();
    }

    const modalRef: NgbModalRef = this.modal.open(QuotationModalComponent, {
      backdropClass: '',
      size: 'lg',
      centered: true,
      ariaLabelledBy: 'modal-basic-title',
    });

    const component = modalRef.componentInstance;
    component.data = this.form.getRawValue();
    component.logo = this.logo();
    component.stamp = this.stamp();
    component.isPreview = isPreview;
  }

  onTabChange(tab: 'quotation' | 'changelog') {
    this.activeTab.set(tab);
    this.analytics.trackTabChange(tab);
  }

  ngOnDestroy() {
    this.startDate?.destroy();
    this.endDate?.destroy();
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
