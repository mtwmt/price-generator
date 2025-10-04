import {
  Component,
  Input,
  signal,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import * as ExcelJS from 'exceljs';
import { QuotationData } from '../quotation.model';
import { AnalyticsService } from '../services/analytics';

@Component({
  selector: 'app-quotation-modal',
  standalone: true,
  imports: [],
  templateUrl: './quotation-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotationModalComponent {
  activeModal = inject(NgbActiveModal);

  @Input() data!: QuotationData;
  @Input() logo: string = '';
  @Input() stamp: string = '';
  @Input() isPreview: boolean = false;

  isPrint = signal<boolean>(false);

  private analytics = inject(AnalyticsService);

  /**
   * 生成帶有時間戳的檔名
   */
  private generateFileName(extension: string): string {
    const timestamp = new Date().toLocaleString('roc', { hour12: false });
    return `${timestamp}_quotation.${extension}`;
  }

  /**
   * 準備並捕捉報價單畫面為 Canvas
   */
  private async captureCanvas(): Promise<HTMLCanvasElement> {
    this.isPrint.set(true);

    // 等待 DOM 更新以隱藏關閉按鈕
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

    const preview = document.getElementById('contentToConvert');
    if (!preview) {
      this.isPrint.set(false);
      throw new Error('無法找到報價單內容元素');
    }

    return html2canvas(preview, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
      onclone: (clonedDoc) => {
        // 確保關閉按鈕被移除
        const closeBtn = clonedDoc.querySelector('.btn-close');
        if (closeBtn) {
          closeBtn.remove();
        }
      },
    });
  }

  /**
   * 下載檔案
   */
  private downloadFile(dataUrl: string, fileName: string): void {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    link.click();
  }

  /**
   * 從 data URL 提取 base64 編碼
   */
  private extractBase64(dataUrl: string, imageName: string): string {
    if (!dataUrl || !dataUrl.includes(',')) {
      throw new Error(`無效的${imageName}格式`);
    }
    const parts = dataUrl.split(',');
    if (parts.length !== 2) {
      throw new Error(`無效的${imageName}格式`);
    }
    return parts[1];
  }

  async onExportImage() {
    try {
      const canvas = await this.captureCanvas();
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const fileName = this.generateFileName('jpg');

      this.downloadFile(dataUrl, fileName);
      this.analytics.trackExport('image');
    } catch (error) {
      console.error('匯出圖片失敗:', error);
      this.analytics.trackError(error as Error, 'export_image');
      alert('匯出圖片失敗，請重試');
    } finally {
      this.isPrint.set(false);
    }
  }

  async onExportPdf() {
    try {
      const canvas = await this.captureCanvas();
      const dataUrl = canvas.toDataURL('image/png');
      const fileName = this.generateFileName('pdf');

      // PDF 設定選項
      const imgWidth = 208;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(dataUrl, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(fileName);
      this.analytics.trackExport('pdf');
    } catch (error) {
      console.error('匯出 PDF 失敗:', error);
      this.analytics.trackError(error as Error, 'export_pdf');
      alert('匯出 PDF 失敗，請重試');
    } finally {
      this.isPrint.set(false);
    }
  }

  async onExportExcel() {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('報價單');

      const titleBgColor = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9D9D9' },
      } as const;

      this.setupWorksheetStyles(worksheet);
      this.createTitleSection(worksheet, workbook, titleBgColor);
      this.createCompanyInfoSection(worksheet, workbook);
      this.createServiceItemsTable(worksheet);
      this.createSummarySection(worksheet);
      this.createNotesAndSignature(worksheet, titleBgColor);
      this.applyBorders(worksheet);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const date = new Date().toLocaleString('roc', { hour12: false });

      this.downloadFile(url, `${date}_quotation.xlsx`);
      setTimeout(() => URL.revokeObjectURL(url), 100);

      this.analytics.trackExport('excel');
    } catch (error) {
      console.error('匯出 Excel 失敗:', error);
      this.analytics.trackError(error as Error, 'export_excel');
      alert('匯出 Excel 失敗，請重試');
    }
  }

  /**
   * 設定 Excel 工作表的基本樣式
   */
  private setupWorksheetStyles(worksheet: ExcelJS.Worksheet): void {
    worksheet.properties.defaultRowHeight = 20;
    worksheet.properties.defaultColWidth = 12;
    worksheet.pageSetup.printArea = 'A1:E25';

    worksheet.columns = [
      { width: 16 }, // A - 類別
      { width: 24 }, // B - 項目名稱
      { width: 12 }, // C - 單價
      { width: 12 }, // D - 數量
      { width: 12 }, // E - 金額
    ];
  }

  /**
   * 建立標題列與 LOGO
   */
  private createTitleSection(
    worksheet: ExcelJS.Worksheet,
    workbook: ExcelJS.Workbook,
    titleBgColor: ExcelJS.Fill
  ): void {
    const titleStartCol = this.logo ? 'B1:C2' : 'A1:C2';
    worksheet.mergeCells(titleStartCol);
    const titleCell = worksheet.getCell(titleStartCol.split(':')[0]);
    titleCell.value = this.data.company + ' - 報價單';
    titleCell.font = { size: 18, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = titleBgColor;

    if (this.logo) {
      const logoImageId = workbook.addImage({
        base64: this.extractBase64(this.logo, 'LOGO'),
        extension: 'png',
      });
      worksheet.addImage(logoImageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 80, height: 60 },
        editAs: 'oneCell',
      });
    }

    ['D1', 'E1', 'D2', 'E2'].forEach((cellAddr) => {
      worksheet.getCell(cellAddr).fill = titleBgColor;
    });

    if (this.data.customerTaxID) {
      const taxIdLabelCell = worksheet.getCell('D2');
      taxIdLabelCell.value = '統一編號：';
      taxIdLabelCell.font = { size: 12, bold: true };
      taxIdLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

      const taxIdValueCell = worksheet.getCell('E2');
      taxIdValueCell.value = this.data.customerTaxID;
      taxIdValueCell.font = { size: 12 };
      taxIdValueCell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  }

  /**
   * 建立報價公司資訊區塊
   */
  private createCompanyInfoSection(
    worksheet: ExcelJS.Worksheet,
    workbook: ExcelJS.Workbook
  ): void {
    const infoRows = [
      ['報價公司/人員', this.data.quoterName],
      ...(this.data.quoterTaxID ? [['統一編號：', this.data.quoterTaxID]] : []),
      ...(this.data.tel ? [['聯絡電話', this.data.tel]] : []),
      ['E-Mail', this.data.email],
      ['報價日期：', this.data.startDate],
      ...(this.data.endDate ? [['有效日期：', this.data.endDate]] : []),
    ];

    infoRows.forEach((rowData) => {
      const row = worksheet.addRow(rowData);
      row.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' },
      };
      row.getCell(1).font = { size: 12, bold: true };
      row.getCell(2).font = { size: 12 };
    });

    if (this.stamp) {
      const stampImageId = workbook.addImage({
        base64: this.extractBase64(this.stamp, '公司發票章'),
        extension: 'png',
      });
      worksheet.addImage(stampImageId, {
        tl: { col: 2, row: 3 },
        ext: { width: 120, height: 80 },
        editAs: 'oneCell',
      });
    }
  }

  /**
   * 建立服務項目表格
   */
  private createServiceItemsTable(worksheet: ExcelJS.Worksheet): void {
    worksheet.addRow([]);

    const headerRow = worksheet.addRow([
      '類別',
      '項目',
      '單價',
      '數量',
      '金額',
    ]);
    headerRow.font = { size: 12, bold: true };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let col = 1; col <= 5; col++) {
      headerRow.getCell(col).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8E8E8' },
      };
    }

    this.data.serviceItems.forEach((item) => {
      const row = worksheet.addRow([
        item.category,
        item.item,
        item.price,
        item.count + (item.unit ? ' ' + item.unit : ''),
        item.amount,
      ]);
      row.eachCell((cell) => {
        cell.font = { size: 12 };
      });
      row.getCell(5).alignment = { horizontal: 'right' };
    });
  }

  /**
   * 建立稅額與總計區塊
   */
  private createSummarySection(worksheet: ExcelJS.Worksheet): void {
    const summaryData = [
      ['', '', '', '未稅', this.data.excludingTax],
      [
        '',
        '',
        this.data.taxName + '稅',
        this.data.percentage + '%',
        this.data.tax,
      ],
      ['', '', '', '含稅計', this.data.includingTax],
    ];

    summaryData.forEach((rowData) => {
      const row = worksheet.addRow(rowData);
      row.eachCell((cell) => {
        cell.font = { size: 12 };
      });
      row.getCell(5).font = {
        size: 12,
        bold: true,
        color: { argb: 'FFFF0000' },
      };
      row.getCell(5).alignment = { horizontal: 'right' };
    });
  }

  /**
   * 建立備註與簽章區塊
   */
  private createNotesAndSignature(
    worksheet: ExcelJS.Worksheet,
    titleBgColor: ExcelJS.Fill
  ): void {
    if (this.data.desc) {
      worksheet.addRow([]);
      const remarkTitleRow = worksheet.addRow(['【備 註】']);
      remarkTitleRow.getCell(1).font = { size: 12, bold: true };
      remarkTitleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      for (let col = 1; col <= 5; col++) {
        remarkTitleRow.getCell(col).fill = titleBgColor;
      }

      const descRow = worksheet.addRow([this.data.desc]);
      const descRowIndex = descRow.number;
      worksheet.mergeCells(`A${descRowIndex}:E${descRowIndex}`);
      descRow.getCell(1).font = { size: 12 };
    }

    worksheet.addRow([]);
    const signRow = worksheet.addRow(['客戶簽章：']);
    signRow.getCell(1).font = { size: 12 };
    worksheet.addRow([]);
  }

  /**
   * 為整個工作表添加外框
   */
  private applyBorders(worksheet: ExcelJS.Worksheet): void {
    const lastRow = worksheet.rowCount;
    const borderStyle = {
      style: 'thin' as const,
      color: { argb: 'FF000000' },
    };
    for (let row = 1; row <= lastRow; row++) {
      for (let col = 1; col <= 5; col++) {
        const cell = worksheet.getCell(row, col);
        cell.border = {
          top: row === 1 ? borderStyle : undefined,
          left: col === 1 ? borderStyle : undefined,
          bottom: row === lastRow ? borderStyle : undefined,
          right: col === 5 ? borderStyle : undefined,
        };
      }
    }
  }
}
