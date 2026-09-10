import {
  Component,
  DOCUMENT,
  input,
  output,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  LucideCircleCheck,
  LucideFileDown,
  LucideFileSpreadsheet,
  LucideImage,
  LucideInfo,
} from '@lucide/angular';
import { ExportService } from '@app/features/quotation/services/export.service';
import { ToastService } from '@app/shared/services/toast.service';
import { QuotationData } from '@app/features/quotation/models/quotation.model';
import { QuotationTemplate } from '@app/features/templates/models/quotation-template.model';
import { QUOTATION_TEMPLATES } from '@app/features/templates/configs/quotation-templates.config';
import { ensureExportFormIsValid } from './export-validation';

/**
 * 報價單匯出控制元件
 * 包含匯出按鈕和樣式選擇器
 */
@Component({
  selector: 'app-export-controls',
  imports: [
    CommonModule,
    LucideCircleCheck,
    LucideFileDown,
    LucideFileSpreadsheet,
    LucideImage,
    LucideInfo,
  ],
  templateUrl: './export-controls.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
})
export class ExportControls {
  // Services
  private exportService = inject(ExportService);
  private toastService = inject(ToastService);
  private document = inject(DOCUMENT);

  // Inputs
  form = input.required<FormGroup>();
  selectedTemplate = input.required<string>();
  customerLogo = input<string>('');
  quoterLogo = input<string>('');
  stamp = input<string>('');

  // Outputs
  templateChange = output<string>();

  // Templates
  templates = QUOTATION_TEMPLATES;

  /**
   * 樣式切換
   */
  onTemplateChange(templateId: string) {
    this.templateChange.emit(templateId);
  }

  /**
   * 取得當前選擇的樣式資訊
   */
  getCurrentTemplate(): QuotationTemplate | undefined {
    return this.templates.find((t) => t.id === this.selectedTemplate());
  }

  /**
   * 取得報價單資料
   */
  private getQuotationData(): QuotationData {
    const formValue = this.form().getRawValue();
    return {
      ...formValue,
      serviceItems: formValue.serviceItems || [],
    };
  }

  /**
   * 匯出按鈕保留可操作性，讓使用者能立即得知缺少哪些欄位。
   * 以原生事件通知外層表單處理焦點與捲動，避免預覽元件成為耦合點。
   */
  private validateBeforeExport(): boolean {
    return ensureExportFormIsValid(this.form(), () => {
      this.toastService.error('請先完成必填欄位後才能匯出報價單');
      this.document.dispatchEvent(new CustomEvent('quotation-export-invalid'));
    });
  }

  /**
   * 匯出 PDF
   */
  async onExportPDF() {
    if (!this.validateBeforeExport()) return;
    try {
      const contentId = this.selectedTemplate();
      const quotationData = this.getQuotationData();
      const template = this.getCurrentTemplate();
      const templateName = template?.name || '';
      await this.exportService.exportAsPDF(
        contentId,
        quotationData,
        templateName
      );
    } catch (error) {
      this.toastService.error((error as Error).message);
    }
  }

  /**
   * 匯出圖片
   */
  async onExportImage() {
    if (!this.validateBeforeExport()) return;
    try {
      const contentId = this.selectedTemplate();
      const customerName = this.form().get('customerCompany')?.value || '';
      const quotationData = this.getQuotationData();
      const template = this.getCurrentTemplate();
      const templateName = template?.name || '';
      await this.exportService.exportAsImage(
        contentId,
        customerName,
        quotationData,
        templateName
      );
    } catch (error) {
      this.toastService.error((error as Error).message);
    }
  }

  /**
   * 匯出 Excel
   */
  async onExportExcel() {
    if (!this.validateBeforeExport()) return;
    try {
      const data = this.getQuotationData();

      // 取得當前樣板的 Excel 匯出器
      const currentTemplate = this.getCurrentTemplate();
      if (!currentTemplate) {
        throw new Error('無法找到當前樣板配置');
      }

      await this.exportService.exportAsExcel(
        data,
        currentTemplate.excelExporter,
        this.customerLogo(),
        this.stamp(),
        currentTemplate.name
      );
    } catch (error) {
      this.toastService.error((error as Error).message);
    }
  }
}
