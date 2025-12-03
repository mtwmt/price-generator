import { Component, computed, input } from '@angular/core';
import { FormArray, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';

/**
 * 簡潔版報價單渲染器
 * 純內容渲染，無匯出按鈕
 */
@Component({
  selector: 'app-template-classic',
  imports: [CommonModule],
  templateUrl: './template-classic.html',
})
export class TemplateClassic {
  // 接收表單資料
  form = input.required<FormGroup>();
  quoterLogo = input<string>('');
  customerLogo = input<string>('');
  stamp = input<string>('');

  // 取得服務項目 FormArray
  serviceItems = computed(() => {
    return this.form().get('serviceItems') as FormArray;
  });
}
