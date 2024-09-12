import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  Renderer2,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormGroup,
  FormControl,
  FormArray,
  ReactiveFormsModule,
  Validators,
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
import { QuotationModelComponent } from '../quotation-model/quotation-model.component';
import { CommentsComponent } from '../comments/comments.component';

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './price-generator.component.html',
})
export class PriceGeneratorComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  startDate!: Litepicker;
  endDate!: Litepicker;

  form: FormGroup = new FormGroup({
    logo: new FormControl(),
    company: new FormControl(null, Validators.required),
    customerTaxID: new FormControl(null, Validators.pattern(/^[0-9]{8}$/)),

    quoterName: new FormControl(null, Validators.required),
    quoterTaxID: new FormControl(null, Validators.pattern(/^[0-9]{8}$/)),
    email: new FormControl(),
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

  logo = '';

  closeResult = '';

  historyData!: any[];

  constructor(
    private modal: NgbModal,
    private renderer: Renderer2,
    private el: ElementRef
  ) {
    this.historyData = JSON.parse(localStorage.getItem('quotation') || '[]');

    this.createTodoItem();

    this.serviceItems.valueChanges.subscribe((res) => {
      const total = res.reduce((acc: number, item: any) => {
        return acc + item.amount;
      }, 0);
      this.form.get('excludingTax')?.setValue(total);
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
        this.form.get('tax')?.setValue(tax);
        this.form.get('includingTax')?.setValue(excludingTax + tax);
      });
  }

  get serviceItems() {
    return this.form.get('serviceItems') as FormArray;
  }

  ngOnInit() {
    this.onTaxIdValueChange('customerTaxID');
    this.onTaxIdValueChange('quoterTaxID');
    this.setStartDate();
    this.setEndDate();
  }

  onLogoChange(file: FileList) {
    this.logo = URL.createObjectURL(file[0]);
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
    this.startDate = new Litepicker({
      element: this.el.nativeElement.querySelector('#startDate'),
      startDate: new Date(),
    });

    this.startDate.on('selected', (date) => {
      this.form.get('startDate')?.setValue(date.format('YYYY-MM-DD'));
    });
  }

  setEndDate() {
    this.endDate = new Litepicker({
      element: this.el.nativeElement.querySelector('#endDate'),
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

  onAddField(event: any) {
    this.createTodoItem();
  }

  onRemoveField(index: number) {
    if (this.serviceItems.value.length > 1) {
      this.serviceItems.removeAt(index);
    }
  }

  onHistoryChange(event: any) {
    const idx = event.target.value;
    const data = this.historyData[idx];

    this.form.patchValue({ ...data });

    this.serviceItems.clear();
    data.serviceItems.forEach((item: any) => {
      this.serviceItems.push(
        new FormControl({
          category: item.category,
          item: item.item,
          price: item.price,
          count: item.count,
          unit: item.unit,
          amount: item.amount,
        })
      );
    });
  }

  onSubmit() {
    const data = this.form.getRawValue();
    this.saveLocalStorage(data);
    this.openModal();
  }

  onPreview() {
    this.openModal(true);
  }

  openModal(isPreview: boolean = false) {
    const modalRef: NgbModalRef = this.modal.open(QuotationModelComponent, {
      backdropClass: '',
      size: 'lg',
      centered: true,
      ariaLabelledBy: 'modal-basic-title',
    });

    modalRef.componentInstance.data = this.form.getRawValue();
    modalRef.componentInstance.logo = this.logo;
    modalRef.componentInstance.isPreview = isPreview;
  }

  saveLocalStorage(data: any) {
    this.historyData.unshift(data);
    if (this.historyData.length > 5) {
      this.historyData.pop();
    }

    localStorage.setItem('quotation', JSON.stringify(this.historyData));
  }
}
