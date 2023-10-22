import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
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
  startDate!: Litepicker;
  endDate!: Litepicker;

  form: FormGroup = new FormGroup({
    logo: new FormControl(),
    company: new FormControl(null, Validators.required),
    taxID: new FormControl(),
    name: new FormControl(null, Validators.required),
    email: new FormControl(null, Validators.required),
    tel: new FormControl(null, Validators.required),
    startDate: new FormControl(),
    endDate: new FormControl(),
    serviceItems: new FormArray([], Validators.required),

    excludingTax: new FormControl(),

    taxName: new FormControl(),
    percentage: new FormControl(),
    tax: new FormControl({ value: 0, disabled: true }),

    includingTax: new FormControl(),

    desc: new FormControl(),
  });

  logo = '';

  closeResult = '';

  constructor(
    private modal: NgbModal,
    private renderer: Renderer2,
    private el: ElementRef
  ) {
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
    this.setStartDate();
    this.setEndDate();
  }

  onLogoChange(file: FileList) {
    this.logo = URL.createObjectURL(file[0]);
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

  onSubmit() {
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
}
