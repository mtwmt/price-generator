import { CommonModule } from '@angular/common';
import {
  Component,
  output,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule, Trash2 } from 'lucide-angular';

@Component({
  selector: 'app-service-item-control',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './service-item-control.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceItemControlComponent {
  // 使用 Signal Input/Output API
  formGroup = input.required<FormGroup>();
  index = input<number>(0);
  removeField = output<void>();

  // Lucide Icons
  readonly Trash2 = Trash2;

  onAmountChange() {
    const form = this.formGroup();
    const price = Number(form.get('price')?.value) || 0;
    const count = Number(form.get('count')?.value) || 1;
    const amount = price * count;

    // 移除 { emitEvent: false }，讓變更能觸發父元件的 valueChanges
    form.get('amount')?.setValue(amount);
  }

  onInput(event: Event, controlName: string) {
    const input = event.target as HTMLInputElement;
    let value = input.value;

    // 移除前導零：如果輸入的是 "0123"，自動轉換為 "123"
    // 但保留單純的 "0" 和小數點開頭的數字如 "0.5"
    if (
      value &&
      value.length > 1 &&
      value.startsWith('0') &&
      value[1] !== '.'
    ) {
      value = value.replace(/^0+/, '');
      // 如果移除後變成空字串（例如輸入 "000"），保留一個 0
      if (value === '') {
        value = '0';
      }
      // 更新 input 的值（這會移除前導零）
      input.value = value;

      // 更新表單控制項的值
      const form = this.formGroup();
      const numValue = value === '' ? null : Number(value);
      form.get(controlName)?.setValue(numValue);
    }

    // 觸發金額計算（無論是否移除前導零，都需要計算）
    this.onAmountChange();
  }

  onRemoveField(e?: MouseEvent): void {
    e?.preventDefault();
    this.removeField.emit();
  }
}
