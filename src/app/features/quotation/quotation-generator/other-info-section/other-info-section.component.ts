import { Component, input, ChangeDetectionStrategy } from '@angular/core';

import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { LucideFileCheck } from '@lucide/angular';

/**
 * 其他資訊區塊元件
 * 包含備註欄位和簽章欄位顯示選項
 */
@Component({
  selector: 'app-other-info-section',
  standalone: true,
  imports: [ReactiveFormsModule, LucideFileCheck],
  templateUrl: './other-info-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OtherInfoSection {
  // Inputs
  readonly form = input.required<FormGroup>();
}
