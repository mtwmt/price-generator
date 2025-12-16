import { Component, input, signal, computed, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ExportControls } from '@app/features/quotation/quotation-export-controls/export-controls.component';
import { QUOTATION_TEMPLATES } from '@app/features/templates/configs/quotation-templates.config';
import { AuthService } from '@app/core/services/auth.service';

/**
 * 報價單預覽容器元件
 * 整合匯出控制和多樣式渲染器
 * 使用動態元件載入實現樣式切換
 */
@Component({
  selector: 'app-quotation-preview',
  imports: [CommonModule, ExportControls],
  templateUrl: './quotation-preview.component.html',
  standalone: true,
})
export class QuotationPreview {
  // Constants
  private readonly DEFAULT_TEMPLATE = 'classic';

  // Services
  private readonly authService = inject(AuthService);

  // Inputs
  form = input.required<FormGroup>();
  quoterLogo = input<string>('');
  customerLogo = input<string>('');
  stamp = input<string>('');

  // State
  selectedTemplate = signal<string>(this.DEFAULT_TEMPLATE);

  /**
   * 根據選擇的樣式 ID 動態取得對應的渲染器元件
   */
  currentRenderer = computed(() => {
    const template = QUOTATION_TEMPLATES.find(
      (t) => t.id === this.selectedTemplate()
    );
    return template?.component;
  });

  /**
   * 準備傳入渲染器的 inputs
   */
  rendererInputs = computed(() => ({
    form: this.form(),
    customerLogo: this.customerLogo(),
    quoterLogo: this.quoterLogo(),
    stamp: this.stamp(),
    isPremium: this.authService.isPremium(),
  }));

  /**
   * 處理樣式切換
   */
  onTemplateChange(templateId: string): void {
    this.selectedTemplate.set(templateId);
  }
}
