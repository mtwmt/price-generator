import {
  Component,
  output,
  forwardRef,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
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
import { ServiceItem } from '../models/quotation.model';

@Component({
  selector: 'app-service-item-control',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass],
  templateUrl: './service-item-control.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  implements ControlValueAccessor, Validator
{
  // 使用 Signal Output API
  removeField = output<void>();

  private serviceItem: ServiceItem = {
    item: '',
    price: 0,
    count: 0,
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

  public onChange: (serviceItem: ServiceItem) => void = () => {};

  public onTouched = () => {};

  touched = signal<boolean>(false);
  disabled = signal<boolean>(false);

  public writeValue(serviceItem: ServiceItem) {
    this.serviceItem = serviceItem;
    this.form.patchValue({ ...serviceItem });
  }

  public registerOnChange(onChange: (serviceItem: ServiceItem) => void) {
    this.onChange = onChange;
  }

  public registerOnTouched(onTouched: () => void) {
    this.onTouched = onTouched;
  }

  public setDisabledState(isDisabled: boolean) {
    this.disabled.set(isDisabled);
  }

  public validate(control: AbstractControl): ValidationErrors | null {
    return (
      this.form.get('item')?.errors || this.form.get('price')?.errors || null
    );
  }

  private markAsTouched() {
    if (!this.touched()) {
      this.onTouched();
      this.touched.set(true);
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
