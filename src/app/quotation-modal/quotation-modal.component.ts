import {
  Component,
  Input,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import * as ExcelJS from 'exceljs';
import { QuotationData } from '../models/quotation.model';

@Component({
  selector: 'app-quotation-modal',
  standalone: true,
  imports: [],
  templateUrl: './quotation-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotationModalComponent {
  // 動態開啟的 Modal 無法使用 Signal Input，需使用傳統 @Input
  @Input() data!: QuotationData;
  @Input() logo: string = '';
  @Input() stamp: string = '';
  @Input() isPreview: boolean = false;

  isPrint = signal<boolean>(false);

  constructor(public activeModal: NgbActiveModal) {}

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
    } catch (error) {
      console.error('匯出圖片失敗:', error);
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
    } catch (error) {
      console.error('匯出 PDF 失敗:', error);
      alert('匯出 PDF 失敗，請重試');
    } finally {
      this.isPrint.set(false);
    }
  }

  async onExportExcel() {
    const data = this.data;
    const date = new Date().toLocaleString('roc', { hour12: false });

    // 建立活頁簿和工作表
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('報價單');

    // 設定工作表預設樣式
    worksheet.properties.defaultRowHeight = 20;
    worksheet.properties.defaultColWidth = 12;

    // 設定列印範圍
    worksheet.pageSetup.printArea = 'A1:E25';

    const titleBgColor = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' },
    } as const;

    // 設定欄位寬度
    worksheet.columns = [
      { width: 16 }, // A - 類別
      { width: 24 }, // B - 項目名稱
      { width: 12 }, // C - 單價
      { width: 12 }, // D - 數量
      { width: 12 }, // E - 金額
    ];

    // 標題列：報價單（佔兩行）
    // 如果有 LOGO，標題從 B1 開始；否則從 A1 開始
    const titleStartCol = this.logo ? 'B1:C2' : 'A1:C2';
    worksheet.mergeCells(titleStartCol);
    const titleCell = worksheet.getCell(titleStartCol.split(':')[0]);
    titleCell.value = data.company + ' - 報價單';
    titleCell.font = { size: 18, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = titleBgColor;

    // 如果有 LOGO，插入圖片到 A1:A2（保持比例，不變形）
    if (this.logo) {
      const logoImageId = workbook.addImage({
        base64: this.extractBase64(this.logo, 'LOGO'),
        extension: 'png',
      });
      worksheet.addImage(logoImageId, {
        tl: { col: 0, row: 0 }, // A1 左上角
        ext: { width: 80, height: 60 }, // 設定最大寬高（像素），圖片會保持比例
        editAs: 'oneCell',
      });
    }

    // 第二行右側：D2 和 E2 始終套用與標題相同的底色
    ['D1', 'E1', 'D2', 'E2'].forEach((cellAddr) => {
      const cell = worksheet.getCell(cellAddr);
      cell.fill = titleBgColor;
    });

    // 統一編號（如果有的話）
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

    // 報價公司資訊表格（左右兩欄）
    const infoRows = [
      ['報價公司/人員', data.quoterName],
      ...(data.quoterTaxID ? [['統一編號：', data.quoterTaxID]] : []),
      ...(data.tel ? [['聯絡電話', data.tel]] : []),
      ['E-Mail', data.email],
      ['報價日期：', data.startDate],
      ...(data.endDate ? [['有效日期：', data.endDate]] : []),
    ];

    infoRows.forEach((rowData) => {
      const row = worksheet.addRow(rowData);
      // 只對第1欄（A欄）設定背景色
      const firstCell = row.getCell(1);
      firstCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' },
      };
      firstCell.font = { size: 12, bold: true };
      // 第2欄設定字體大小
      const secondCell = row.getCell(2);
      secondCell.font = { size: 12 };
    });

    // 如果有公司章，插入圖片到 C4:E7（報價公司資訊區的右側，保持比例）
    if (this.stamp) {
      const stampImageId = workbook.addImage({
        base64: this.extractBase64(this.stamp, '公司發票章'),
        extension: 'png',
      });
      worksheet.addImage(stampImageId, {
        tl: { col: 2, row: 3 }, // C4 左上角
        ext: { width: 120, height: 80 }, // 設定最大寬高（像素），圖片會保持比例
        editAs: 'oneCell',
      });
    }

    // 空白列
    worksheet.addRow([]);

    // 服務項目表頭
    const headerRow = worksheet.addRow([
      '類別',
      '項目',
      '單價',
      '數量',
      '金額',
    ]);
    headerRow.font = { size: 12, bold: true };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    // 只對 A 到 E 欄設定背景色
    for (let col = 1; col <= 5; col++) {
      headerRow.getCell(col).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8E8E8' },
      };
    }

    // 服務項目資料
    data.serviceItems.forEach((item, index) => {
      const row = worksheet.addRow([
        item.category,
        item.item,
        item.price,
        item.count + (item.unit ? ' ' + item.unit : ''),
        item.amount,
      ]);
      // 設定所有欄位字體大小和邊框
      row.eachCell((cell) => {
        cell.font = { size: 12 };
      });
      // 金額欄位靠右對齊
      row.getCell(5).alignment = { horizontal: 'right' };
    });

    // 含稅計區
    const summaryData = [
      ['', '', '', '未稅', data.excludingTax],
      ['', '', data.taxName + '稅', data.percentage + '%', data.tax],
      ['', '', '', '含稅計', data.includingTax],
    ];

    summaryData.forEach((rowData) => {
      const row = worksheet.addRow(rowData);
      // 設定所有欄位字體大小
      row.eachCell((cell) => {
        cell.font = { size: 12 };
      });
      row.getCell(5).font = {
        size: 12,
        bold: true,
        color: { argb: 'FFFF0000' },
      };
      row.getCell(5).alignment = { horizontal: 'right' };
      row.getCell(6).font = {
        size: 12,
        bold: true,
        color: { argb: 'FFFF0000' },
      };
      row.getCell(6).alignment = { horizontal: 'right' };
    });

    // 備註
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

    // 在 A1:E{lastRow} 範圍畫外框（動態計算最後一列）
    const lastRow = worksheet.rowCount;
    const borderStyle = { style: 'thin' as const, color: { argb: 'FF000000' } };
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

    // 匯出檔案
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${date}_quotation.xlsx`;
    link.click();

    // 釋放 URL 避免記憶體洩漏
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}
