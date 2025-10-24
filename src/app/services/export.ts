import { Injectable, inject } from '@angular/core';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import * as ExcelJS from 'exceljs';
import { QuotationData } from '../quotation.model';
import { AnalyticsService } from './analytics';

@Injectable({
  providedIn: 'root',
})
export class ExportService {
  // Constants
  private readonly DATA_URL_PARTS_COUNT = 2;
  private readonly CANVAS_SCALE = 2;
  private readonly IMAGE_QUALITY = 0.95;
  private readonly URL_REVOKE_DELAY_MS = 100;
  private readonly MIN_ELEMENT_SIZE = 0;
  private readonly A4_WIDTH_PX = 794; // A4 寬度（以 96 DPI 計算：210mm ≈ 794px）

  private analytics = inject(AnalyticsService);

  /**
   * 生成帶有時間戳的檔名
   */
  private generateFileName(extension: string): string {
    const timestamp = new Date().toLocaleString('roc', { hour12: false });
    return `${timestamp}_quotation.${extension}`;
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
    if (parts.length !== this.DATA_URL_PARTS_COUNT) {
      throw new Error(`無效的${imageName}格式`);
    }
    return parts[1];
  }

  /**
   * 捕捉指定元素為 Canvas
   */
  async captureElement(elementId: string): Promise<HTMLCanvasElement> {
    // 等待 DOM 更新以確保所有樣式已套用
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

    // 嘗試找到尺寸不為 0 的元素（可能有多個相同 ID 的元素，選擇可見的那個）
    const elements = document.querySelectorAll(`#${elementId}`);

    let element: HTMLElement | null = null;
    for (const el of Array.from(elements)) {
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.width > this.MIN_ELEMENT_SIZE && rect.height > this.MIN_ELEMENT_SIZE) {
        element = el as HTMLElement;
        break;
      }
    }

    if (!element) {
      throw new Error(`無法找到尺寸不為 0 的元素: ${elementId}`);
    }

    // 儲存原始樣式
    const originalWidth = element.style.width;
    const originalMaxWidth = element.style.maxWidth;
    const originalMinWidth = element.style.minWidth;

    // 在擷取前設定固定寬度以符合 A4 尺寸
    element.style.width = `${this.A4_WIDTH_PX}px`;
    element.style.maxWidth = `${this.A4_WIDTH_PX}px`;
    element.style.minWidth = `${this.A4_WIDTH_PX}px`;

    return html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: this.CANVAS_SCALE,
      logging: false,
      useCORS: true,
      allowTaint: true,
      onclone: (clonedDoc) => {
        // 在 clone 的文檔中處理元素
        const clonedElements = clonedDoc.querySelectorAll(`#${elementId}`);
        clonedElements.forEach((clonedElement) => {
          const el = clonedElement as HTMLElement;

          // 移除按鈕
          const buttons = el.querySelectorAll('button');
          buttons.forEach((btn) => btn.remove());

          // 移除邊框、圓角和陰影
          el.style.border = 'none';
          el.style.borderRadius = '0';
          el.style.boxShadow = 'none';
        });
      },
    }).finally(() => {
      // 恢復原始樣式
      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxWidth;
      element.style.minWidth = originalMinWidth;
    });
  }

  /**
   * 匯出為圖片
   */
  async exportAsImage(elementId: string): Promise<void> {
    try {
      const canvas = await this.captureElement(elementId);
      const dataUrl = canvas.toDataURL('image/jpeg', this.IMAGE_QUALITY);
      const fileName = this.generateFileName('jpg');

      this.downloadFile(dataUrl, fileName);
      this.analytics.trackExport('image');
    } catch (error) {
      console.error('匯出圖片失敗:', error);
      this.analytics.trackError(error as Error, 'export_image');
      throw new Error('匯出圖片失敗，請重試');
    }
  }

  /**
   * 匯出為 PDF
   */
  async exportAsPDF(elementId: string): Promise<void> {
    try {
      const canvas = await this.captureElement(elementId);
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
      throw new Error('匯出 PDF 失敗，請重試');
    }
  }

  /**
   * 匯出為 Excel
   */
  async exportAsExcel(
    data: QuotationData,
    logo: string = '',
    stamp: string = ''
  ): Promise<void> {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('報價單');

      const titleBgColor = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9D9D9' },
      } as const;

      this.setupWorksheetStyles(worksheet);
      this.createTitleSection(worksheet, workbook, data, logo, titleBgColor);
      this.createCompanyInfoSection(worksheet, workbook, data, stamp);
      this.createServiceItemsTable(worksheet, data);
      this.createSummarySection(worksheet, data);
      this.createNotesAndSignature(worksheet, data, titleBgColor);
      this.applyBorders(worksheet);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const date = new Date().toLocaleString('roc', { hour12: false });

      this.downloadFile(url, `${date}_quotation.xlsx`);
      setTimeout(() => URL.revokeObjectURL(url), this.URL_REVOKE_DELAY_MS);

      this.analytics.trackExport('excel');
    } catch (error) {
      console.error('匯出 Excel 失敗:', error);
      this.analytics.trackError(error as Error, 'export_excel');
      throw new Error('匯出 Excel 失敗，請重試');
    }
  }

  /**
   * 列印
   */
  print(): void {
    window.print();
    this.analytics.trackEvent('print', {
      event_category: 'export',
      event_label: 'print',
    });
  }

  // === Excel 相關私有方法 ===

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

  private createTitleSection(
    worksheet: ExcelJS.Worksheet,
    workbook: ExcelJS.Workbook,
    data: QuotationData,
    logo: string,
    titleBgColor: ExcelJS.Fill
  ): void {
    const titleStartCol = logo ? 'B1:C2' : 'A1:C2';
    worksheet.mergeCells(titleStartCol);
    const titleCell = worksheet.getCell(titleStartCol.split(':')[0]);
    titleCell.value = data.customerCompany + ' - 報價單';
    titleCell.font = { size: 18, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = titleBgColor;

    if (logo) {
      const logoImageId = workbook.addImage({
        base64: this.extractBase64(logo, 'LOGO'),
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

    if (data.customerTaxID) {
      const taxIdLabelCell = worksheet.getCell('D2');
      taxIdLabelCell.value = '統一編號：';
      taxIdLabelCell.font = { size: 12, bold: true };
      taxIdLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

      const taxIdValueCell = worksheet.getCell('E2');
      taxIdValueCell.value = data.customerTaxID;
      taxIdValueCell.font = { size: 12 };
      taxIdValueCell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  }

  private createCompanyInfoSection(
    worksheet: ExcelJS.Worksheet,
    workbook: ExcelJS.Workbook,
    data: QuotationData,
    stamp: string
  ): void {
    const infoRows = [
      ['報價公司/人員', data.quoterName],
      ...(data.quoterTaxID ? [['統一編號：', data.quoterTaxID]] : []),
      ...(data.quoterPhone ? [['聯絡電話', data.quoterPhone]] : []),
      ['E-Mail', data.quoterEmail],
      ['報價日期：', data.startDate],
      ...(data.endDate ? [['有效日期：', data.endDate]] : []),
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

    if (stamp) {
      const stampImageId = workbook.addImage({
        base64: this.extractBase64(stamp, '公司章'),
        extension: 'png',
      });
      worksheet.addImage(stampImageId, {
        tl: { col: 2, row: 3 },
        ext: { width: 120, height: 80 },
        editAs: 'oneCell',
      });
    }
  }

  private createServiceItemsTable(
    worksheet: ExcelJS.Worksheet,
    data: QuotationData
  ): void {
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

    data.serviceItems.forEach((item) => {
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

  private createSummarySection(
    worksheet: ExcelJS.Worksheet,
    data: QuotationData
  ): void {
    const taxLabel =
      data.taxName === '自訂' && data.customTaxName
        ? data.customTaxName
        : data.taxName;

    const summaryData: any[] = [
      ['', '', '', '小計', data.excludingTax],
    ];

    // 如果有折扣，加入折扣行
    if (data.discountValue && data.discountValue > 0) {
      const discountLabel =
        data.discountType === 'percentage'
          ? `折扣 (${data.discountValue} 折)`
          : '折扣';
      summaryData.push(['', '', '', discountLabel, -(data.discountAmount || 0)]);
      summaryData.push(['', '', '', '折扣後', data.afterDiscount || 0]);
    }

    // 加入稅額和總計
    summaryData.push(['', '', taxLabel + '稅', data.percentage + '%', data.tax]);
    summaryData.push(['', '', '', '含稅計', data.includingTax]);

    summaryData.forEach((rowData) => {
      const row = worksheet.addRow(rowData);
      row.eachCell((cell) => {
        cell.font = { size: 12 };
      });

      // 檢查是否為折扣行（金額為負數）
      const isDiscountRow = typeof rowData[4] === 'number' && rowData[4] < 0;

      row.getCell(5).font = {
        size: 12,
        bold: true,
        color: { argb: isDiscountRow ? 'FF008000' : 'FFFF0000' }, // 折扣用綠色，其他用紅色
      };
      row.getCell(5).alignment = { horizontal: 'right' };
    });
  }

  private createNotesAndSignature(
    worksheet: ExcelJS.Worksheet,
    data: QuotationData,
    titleBgColor: ExcelJS.Fill
  ): void {
    if (data.desc) {
      worksheet.addRow([]);
      const remarkTitleRow = worksheet.addRow(['【備 註】']);
      remarkTitleRow.getCell(1).font = { size: 12, bold: true };
      remarkTitleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      for (let col = 1; col <= 5; col++) {
        remarkTitleRow.getCell(col).fill = titleBgColor;
      }

      const descRow = worksheet.addRow([data.desc]);
      const descRowIndex = descRow.number;
      worksheet.mergeCells(`A${descRowIndex}:E${descRowIndex}`);
      descRow.getCell(1).font = { size: 12 };
    }

    worksheet.addRow([]);
    const signRow = worksheet.addRow(['客戶簽章：']);
    signRow.getCell(1).font = { size: 12 };
    worksheet.addRow([]);
  }

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
