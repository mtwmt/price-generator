import {
  Component,
  input,
  signal,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { ExportControls } from '@app/features/quotation/quotation-export-controls/export-controls.component';
import { TemplateClassic } from '@app/features/templates/template-classic/template-classic.component';
import { TemplateDetail } from '@app/features/templates/template-detail/template-detail.component';
import { TemplateSideBySide } from '@app/features/templates/template-side-by-side/template-side-by-side.component';
import { AuthService } from '@app/core/services/auth.service';

/**
 * 報價單預覽容器元件
 * 整合匯出控制和多樣式渲染器
 * 使用動態元件載入實現樣式切換
 */
@Component({
  selector: 'app-quotation-preview',
  imports: [
    ExportControls,
    TemplateClassic,
    TemplateDetail,
    TemplateSideBySide,
  ],
  templateUrl: './quotation-preview.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
})
export class QuotationPreview {
  // Constants
  private readonly DEFAULT_TEMPLATE = 'classic';

  // Services
  private readonly authService = inject(AuthService);
  readonly isPremium = this.authService.isPremium;

  // Inputs
  form = input.required<FormGroup>();
  quoterLogo = input<string>('');
  customerLogo = input<string>('');
  stamp = input<string>('');

  // State
  selectedTemplate = signal<string>(this.DEFAULT_TEMPLATE);

  /**
   * 處理樣式切換
   */
  onTemplateChange(templateId: string): void {
    this.selectedTemplate.set(templateId);
  }
}
