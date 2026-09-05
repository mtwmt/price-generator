import {
  Component,
  computed,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormArray, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';

/**
 * 完整版報價單渲染器
 * 純內容渲染，無匯出按鈕
 */
@Component({
  selector: 'app-template-detail',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './template-detail.component.html',
})
export class TemplateDetail {
  // 接收表單資料
  form = input.required<FormGroup>();
  quoterLogo = input<string>('');
  customerLogo = input<string>('');
  stamp = input<string>('');
  isPremium = input<boolean>(false);

  serviceItems = computed(() => {
    return this.form().get('serviceItems') as FormArray;
  });
}
