import { Component, input, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  MapPin,
  Phone,
  Mail,
  User,
  Printer,
  FileDown,
  Image,
  FileSpreadsheet,
  Info,
} from 'lucide-angular';
import { ExportService } from '../services/export';
import { QuotationData } from '../quotation.model';

@Component({
  selector: 'app-quotation-preview',
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './quotation-preview.html',
})
export class QuotationPreview {
  // Lucide Icons
  readonly MapPin = MapPin;
  readonly Phone = Phone;
  readonly Mail = Mail;
  readonly User = User;
  readonly Printer = Printer;
  readonly FileDown = FileDown;
  readonly Image = Image;
  readonly FileSpreadsheet = FileSpreadsheet;
  readonly Info = Info;

  // Services
  private exportService = inject(ExportService);

  // 接收表單資料
  form = input.required<FormGroup>();
  quoterLogo = input<string>('');
  customerLogo = input<string>('');
  stamp = input<string>('');

  // 取得服務項目 FormArray
  get serviceItems() {
    return this.form().get('serviceItems') as any;
  }

  // 匯出功能
  async onPrint() {
    this.exportService.print();
  }

  async onExportPDF() {
    try {
      await this.exportService.exportAsPDF('quotation-preview-content');
    } catch (error) {
      alert((error as Error).message);
    }
  }

  async onExportImage() {
    try {
      await this.exportService.exportAsImage('quotation-preview-content');
    } catch (error) {
      alert((error as Error).message);
    }
  }

  async onExportExcel() {
    try {
      const formValue = this.form().getRawValue();
      const data: QuotationData = {
        ...formValue,
        serviceItems: formValue.serviceItems || [],
      };
      await this.exportService.exportAsExcel(
        data,
        this.customerLogo(),
        this.stamp()
      );
    } catch (error) {
      alert((error as Error).message);
    }
  }
}
