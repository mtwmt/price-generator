import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  forwardRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormGroup,
  FormControl,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  ControlValueAccessor,
  Validator,
  AbstractControl,
  ValidationErrors,
  Validators,
} from '@angular/forms';

@Component({
  selector: 'app-service-item-control',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './service-item-control.component.html',

  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: forwardRef(() => ServiceItemControlComponent),
    },
    {
      provide: NG_VALIDATORS,
      multi: true,
      useExisting: forwardRef(() => ServiceItemControlComponent),
    },
  ],
})
export class ServiceItemControlComponent
  implements OnInit, ControlValueAccessor, Validator
{
  @Output() removeField: EventEmitter<any> = new EventEmitter();

  private serviceItem: any = {
    category: null,
    item: null,
    price: null,
    count: 0,
    unit: null,
    amount: 0,
  };

  public form: FormGroup = new FormGroup({
    category: new FormControl(),
    item: new FormControl(null, Validators.required),
    price: new FormControl(null, Validators.required),
    count: new FormControl(),
    unit: new FormControl(),
    amount: new FormControl({ value: 0, disabled: true }),
  });

  public onChange = (serviceItem: any) => serviceItem;

  public onTouched = () => {};

  public touched = false;

  public disabled = false;

  ngOnInit(): void {}

  public writeValue(serviceItem: any) {
    this.serviceItem = serviceItem;
    this.form.patchValue({ ...serviceItem });
  }

  public registerOnChange(onChange: any) {
    this.onChange = onChange;
  }

  public registerOnTouched(onTouched: any) {
    this.onTouched = onTouched;
  }

  public setDisabledState(disabled: boolean) {
    this.disabled = disabled;
    if (disabled) {
      this.form?.disable();
    } else {
      this.form?.enable();
    }
  }

  public validate(control: AbstractControl): ValidationErrors | null {
    return (
      this.form.get('item')?.errors || this.form.get('price')?.errors || null
    );
  }

  private markAsTouched() {
    if (!this.touched) {
      this.onTouched();
      this.touched = true;
    }
  }

  public onInputChange() {
    this.markAsTouched();
    this.onChange(this.form.getRawValue());
  }

  public onAmountChange() {
    const price = this.form.get('price')?.value;
    const count = this.form.get('count')?.value;

    this.form.get('amount')?.setValue(price * count);

    this.onInputChange();
  }

  public onRemoveField(e?: MouseEvent): void {
    e?.preventDefault();
    this.markAsTouched();
    this.removeField.emit();
  }
}
