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
import {
  NgbDatepickerModule,
  NgbModal,
  NgbModalRef,
} from '@ng-bootstrap/ng-bootstrap';
import { ServiceItemControlComponent } from '../service-item-control/service-item-control.component';
import Litepicker from 'litepicker';
import { debounceTime, filter, map } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { QuotationModalComponent } from '../quotation-modal/quotation-modal.component';
import { CommentsComponent } from '../comments/comments.component';
import { DonateComponent } from '../donate/donate.component';
import { ChangelogComponent } from '../changelog/changelog';
import { QuotationData } from '../models/quotation.model';

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
  private el = inject(ElementRef);

  private destroyRef = inject(DestroyRef);

  startDate!: Litepicker;
  endDate!: Litepicker;

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
      this.historyData.set(JSON.parse(localStorage.getItem('quotation') || '[]'));
    } catch (error) {
      console.error('Failed to load quotation history from localStorage:', error);
      this.historyData.set([]);
    }
    this.createForm();
    this.createTodoItem();

    this.onTaxIdValueChange('customerTaxID');
    this.onTaxIdValueChange('quoterTaxID');
    this.setStartDate();
    this.setEndDate();

    this.serviceItems.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        const total = res.reduce((acc: number, item: any) => {
          return acc + item.amount;
        }, 0);
        this.form.get('excludingTax')?.patchValue(total, { emitEvent: false });
      });

    // calculate tax
    this.form.valueChanges
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        debounceTime(200),
        filter(({ excludingTax, percentage }) => {
          return excludingTax || percentage;
        }),
        map(({ excludingTax, percentage }) => {
          return { excludingTax, percentage };
        })
      )
      .subscribe(({ excludingTax, percentage }) => {
        const tax = Math.ceil((percentage / 100) * +excludingTax);
        this.form.get('tax')?.patchValue(tax, { emitEvent: false });
        this.form.get('includingTax')?.patchValue(excludingTax + tax, { emitEvent: false });
      });
  }

  createForm() {
    this.form = this.fb.group({
      logo: new FormControl(),
      stamp: new FormControl(),
      company: new FormControl(null, Validators.required),
      customerTaxID: new FormControl(null, Validators.pattern(/^[0-9]{8}$/)),

      quoterName: new FormControl(null, Validators.required),
      quoterTaxID: new FormControl(null, Validators.pattern(/^[0-9]{8}$/)),
      email: new FormControl(null, [Validators.required, Validators.email]),
      tel: new FormControl(),

      startDate: new FormControl(),
      endDate: new FormControl(),

      serviceItems: new FormArray([], Validators.required),
      excludingTax: new FormControl(),

      // taxItem: new FormArray([]),

      taxName: new FormControl(),
      percentage: new FormControl(),
      tax: new FormControl({ value: 0, disabled: true }),

      includingTax: new FormControl(),
      desc: new FormControl(),
      isSign: new FormControl(true),
    });
  }

  onLogoChange(file: FileList) {
    if (file && file[0]) {
      // 使用 FileReader 轉成 base64，方便儲存到 localStorage
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

  onTaxIdValueChange(controlName: string) {
    const control = this.form.get(controlName);

    control?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef), debounceTime(200))
      .subscribe((value: string) => {
        const sanitizedValue = value?.replace(/[^0-9]/g, '') || '';
        if (sanitizedValue !== value) {
          control.setValue(sanitizedValue, { emitEvent: false });
        }
      });
  }

  setStartDate() {
    const element = this.el.nativeElement.querySelector('#startDate');
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
    const element = this.el.nativeElement.querySelector('#endDate');
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
      this.fb.group({
        category: [null],
        item: [null],
        price: [null],
        count: [1],
        unit: [null],
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

  onHistoryChange(event: any) {
    const idx = event.target.value;
    const data = this.historyData()[idx];

    // 排除 logo 和 stamp 欄位（因為 file input 不能被程式設定值）
    const { logo, stamp, ...formData } = data || {};
    this.form.patchValue({ ...formData });

    // 載入印章圖片（從 localStorage 載入的是 base64）
    if (stamp) {
      this.stamp.set(stamp);
    } else {
      this.stamp.set('');
    }

    // 載入 LOGO 圖片
    if (logo) {
      this.logo.set(logo);
    } else {
      this.logo.set('');
    }

    this.serviceItems.clear();

    if (!idx) {
      this.createTodoItem();
    } else {
      data?.serviceItems.forEach((item: any) => {
        this.serviceItems.push(
          this.fb.group({
            category: [item.category],
            item: [item.item],
            price: [item.price],
            count: [item.count],
            unit: [item.unit],
            amount: [item.amount],
          })
        );
      });
    }
  }

  onSubmit() {
    const data = this.form.getRawValue();
    // 將 LOGO 和印章圖片一起儲存
    const dataWithImages = { ...data, logo: this.logo(), stamp: this.stamp() };
    this.saveLocalStorage(dataWithImages);
    this.openModal();
  }

  onPreview() {
    this.openModal(true);
  }

  openModal(isPreview: boolean = false) {
    const modalRef: NgbModalRef = this.modal.open(QuotationModalComponent, {
      backdropClass: '',
      size: 'lg',
      centered: true,
      ariaLabelledBy: 'modal-basic-title',
    });

    // Signal Input 仍然支援透過 componentInstance 設定
    const component = modalRef.componentInstance;
    component.data = this.form.getRawValue();
    component.logo = this.logo();
    component.stamp = this.stamp();
    component.isPreview = isPreview;
  }

  ngOnDestroy() {
    this.startDate?.destroy();
    this.endDate?.destroy();
  }

  saveLocalStorage(data: QuotationData) {
    this.historyData.update(history => {
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
