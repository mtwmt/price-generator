import { CommonModule } from '@angular/common';
import {
  Component,
  output,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule, Trash2, Copy } from 'lucide-angular';

@Component({
  selector: 'app-service-item-control',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './service-item-control.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceItemControlComponent {
  // Constants
  private readonly DEFAULT_COUNT = 1;
  private readonly DEFAULT_PRICE = 0;
  private readonly DECIMAL_POINT = '.';
  private readonly ZERO = '0';

  // Signal Input/Output API
  formGroup = input.required<FormGroup>();
  index = input<number>(0);
  removeField = output<void>();
  copyField = output<void>();

  // Icons
  readonly Trash2 = Trash2;
  readonly Copy = Copy;

  onAmountChange(): void {
    const amount = this.calculateAmount();
    this.updateAmount(amount);
  }

  onInput(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    const normalizedValue = this.normalizeLeadingZeros(input.value);

    if (normalizedValue !== input.value) {
      this.updateInputAndControl(input, controlName, normalizedValue);
    }

    this.onAmountChange();
  }

  onRemoveField(e?: MouseEvent): void {
    e?.preventDefault();
    this.removeField.emit();
  }

  onCopyField(e?: MouseEvent): void {
    e?.preventDefault();
    this.copyField.emit();
  }

  private calculateAmount(): number {
    const price = this.getNumericValue('price', this.DEFAULT_PRICE);
    const count = this.getNumericValue('count', this.DEFAULT_COUNT);
    return price * count;
  }

  private getNumericValue(controlName: string, defaultValue: number): number {
    const raw = this.formGroup().get(controlName)?.value;
    const num = Number(raw);
    return raw != null && raw !== '' && !isNaN(num) ? num : defaultValue;
  }

  private updateAmount(amount: number): void {
    const form = this.formGroup();
    form.get('amount')?.setValue(amount);
  }

  private normalizeLeadingZeros(value: string): string {
    if (!this.hasLeadingZero(value)) {
      return value;
    }

    const normalized = value.replace(/^0+/, '');
    return normalized === '' ? this.ZERO : normalized;
  }

  private hasLeadingZero(value: string): boolean {
    return (
      value.length > 1 &&
      value.startsWith(this.ZERO) &&
      value[1] !== this.DECIMAL_POINT
    );
  }

  private updateInputAndControl(
    input: HTMLInputElement,
    controlName: string,
    value: string
  ): void {
    input.value = value;
    const form = this.formGroup();
    const numValue = value === '' ? null : Number(value);
    form.get(controlName)?.setValue(numValue);
  }
}
