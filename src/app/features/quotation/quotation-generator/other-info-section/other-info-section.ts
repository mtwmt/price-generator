import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule, FileCheck } from 'lucide-angular';

/**
 * 其他資訊區塊元件
 * 包含備註欄位和簽章欄位顯示選項
 */
@Component({
  selector: 'app-other-info-section',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './other-info-section.html',
})
export class OtherInfoSection {
  // Icons
  readonly FileCheck = FileCheck;

  // Inputs
  readonly form = input.required<FormGroup>();
}
