import { Component, input, output, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  FileDown,
  Image,
  FileSpreadsheet,
  CircleCheck,
  Info
} from 'lucide-angular';
import { ExportService } from '../services/export';
import { QuotationData } from '../models/quotation.model';
import { QuotationTemplate } from '../models/quotation-template.model';
import { QUOTATION_TEMPLATES } from '../configs/quotation-templates.config';

/**
 * 報價單匯出控制元件
 * 包含匯出按鈕和樣式選擇器
 */
@Component({
  selector: 'app-export-controls',
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './export-controls.html',
  standalone: true,
})
export class ExportControls {
  // Icons
  readonly FileDown = FileDown;
  readonly Image = Image;
  readonly FileSpreadsheet = FileSpreadsheet;
  readonly CircleCheck = CircleCheck;
  readonly Info = Info;

  // Services
  private exportService = inject(ExportService);

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
    return this.templates.find(t => t.id === this.selectedTemplate());
  }

  /**
   * 匯出 PDF
   */
  async onExportPDF() {
    try {
      const contentId = this.selectedTemplate();
      await this.exportService.exportAsPDF(contentId);
    } catch (error) {
      alert((error as Error).message);
    }
  }

  /**
   * 匯出圖片
   */
  async onExportImage() {
    try {
      const contentId = this.selectedTemplate();
      const customerName = this.form().get('customerCompany')?.value || '';
      await this.exportService.exportAsImage(contentId, customerName);
    } catch (error) {
      alert((error as Error).message);
    }
  }

  /**
   * 匯出 Excel
   */
  async onExportExcel() {
    try {
      const formValue = this.form().getRawValue();
      const data: QuotationData = {
        ...formValue,
        serviceItems: formValue.serviceItems || [],
      };

      // 取得當前樣板的 Excel 匯出器
      const currentTemplate = this.getCurrentTemplate();
      if (!currentTemplate) {
        throw new Error('無法找到當前樣板配置');
      }

      await this.exportService.exportAsExcel(
        data,
        currentTemplate.excelExporter,
        this.customerLogo(),
        this.stamp()
      );
    } catch (error) {
      alert((error as Error).message);
    }
  }
}
