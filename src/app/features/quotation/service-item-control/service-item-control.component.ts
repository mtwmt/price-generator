import {
  Component,
  output,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  LucideCopy,
  LucideTrash2,
  LucideEllipsis,
  LucideBookmarkPlus,
} from '@lucide/angular';
import { calculateServiceItemAmount } from '@app/features/quotation/utils/calculator';

@Component({
  selector: 'app-service-item-control',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    LucideCopy,
    LucideTrash2,
    LucideEllipsis,
    LucideBookmarkPlus,
  ],
  templateUrl: './service-item-control.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceItemControlComponent {
  // Constants
  private readonly DECIMAL_POINT = '.';
  private readonly ZERO = '0';

  // Signal Input/Output API
  formGroup = input.required<FormGroup>();
  index = input<number>(0);
  advancedMode = input<boolean>(false);
  removeField = output<void>();
  copyField = output<void>();
  saveTemplate = output<void>();

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
    (document.activeElement as HTMLElement)?.blur();
    this.removeField.emit();
  }

  onCopyField(e?: MouseEvent): void {
    e?.preventDefault();
    (document.activeElement as HTMLElement)?.blur();
    this.copyField.emit();
  }

  onSaveTemplate(e?: MouseEvent): void {
    e?.preventDefault();
    (document.activeElement as HTMLElement)?.blur();
    this.saveTemplate.emit();
  }

  getControlError(controlName: string): string | null {
    const errors = this.formGroup().get(controlName)?.errors;
    if (!errors || errors['required']) return null;
    const validation = Object.values(errors).find(
      (value): value is { message: string } =>
        typeof value === 'object' && value !== null && 'message' in value
    );
    return validation?.message ?? '輸入值無效';
  }

  getAmountError(): string | null {
    const error = this.formGroup().errors?.['unsafeAmount'];
    return error?.message ?? null;
  }

  private calculateAmount(): number | null {
    return calculateServiceItemAmount({
      price: this.formGroup().get('price')?.value,
      count: this.formGroup().get('count')?.value,
    }) ?? null;
  }

  private updateAmount(amount: number | null): void {
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
