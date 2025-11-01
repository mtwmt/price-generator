import { Injectable, inject } from '@angular/core';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import * as ExcelJS from 'exceljs';
import { QuotationData } from '../models/quotation.model';
import { ExcelExporter } from '../models/quotation-template.model';
import { AnalyticsService } from './analytics';

@Injectable({
  providedIn: 'root',
})
export class ExportService {
  // Constants
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
   * 偵測是否為行動裝置
   */
  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }

  /**
   * 檢查瀏覽器是否支援 Web Share API
   */
  private canUseWebShare(file: File): boolean {
    return (
      this.isMobileDevice() &&
      'canShare' in navigator &&
      navigator.canShare?.({ files: [file] }) === true
    );
  }

  /**
   * 將 canvas 轉換為 File 物件
   */
  private async canvasToFile(
    canvas: HTMLCanvasElement,
    fileName: string
  ): Promise<File> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('無法轉換圖片'));
            return;
          }
          const file = new File([blob], fileName, { type: 'image/jpeg' });
          resolve(file);
        },
        'image/jpeg',
        this.IMAGE_QUALITY
      );
    });
  }

  /**
   * 捕捉指定元素為 Canvas
   * @param elementId - 要捕捉的元素 ID
   * @param forceA4Width - 強制使用 A4 寬度（用於 PDF 匯出）
   */
  async captureElement(
    elementId: string,
    forceA4Width = false
  ): Promise<HTMLCanvasElement> {
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

    // 判斷是否需要設定固定寬度
    // 手機匯出圖片時使用實際寬度，桌面或 PDF 匯出時使用 A4 寬度
    const shouldUseA4Width = forceA4Width || !this.isMobileDevice();

    if (shouldUseA4Width) {
      // 在擷取前設定固定寬度以符合 A4 尺寸
      element.style.width = `${this.A4_WIDTH_PX}px`;
      element.style.maxWidth = `${this.A4_WIDTH_PX}px`;
      element.style.minWidth = `${this.A4_WIDTH_PX}px`;
    }

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
   * 在手機上若支援 Web Share API，會開啟分享選單；否則直接下載
   * @param elementId - 要匯出的元素 ID
   * @param customerName - 客戶名稱（用於分享文字）
   */
  async exportAsImage(elementId: string, customerName?: string): Promise<void> {
    try {
      const canvas = await this.captureElement(elementId);
      const fileName = this.generateFileName('jpg');

      // 嘗試使用 Web Share API（手機優先）
      if (this.isMobileDevice()) {
        try {
          const file = await this.canvasToFile(canvas, fileName);

          if (this.canUseWebShare(file)) {
            const shareText = customerName
              ? `${customerName} - 報價單`
              : '報價單';

            await navigator.share({
              files: [file],
              title: shareText,
              text: shareText,
            });
            this.analytics.trackExport('image_share');
            return;
          }
        } catch (shareError) {
          // Web Share API 失敗或使用者取消，繼續使用下載方式
          console.log('分享取消或不支援，改用下載方式');
        }
      }

      // 降級方案：使用傳統下載方式
      const dataUrl = canvas.toDataURL('image/jpeg', this.IMAGE_QUALITY);
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
      // PDF 匯出強制使用 A4 寬度
      const canvas = await this.captureElement(elementId, true);
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
   * @param data - 報價單資料
   * @param exporter - Excel 匯出器類別
   * @param logo - 客戶 LOGO（base64）
   * @param stamp - 公司章（base64）
   */
  async exportAsExcel(
    data: QuotationData,
    exporter: new () => ExcelExporter,
    logo: string = '',
    stamp: string = ''
  ): Promise<void> {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('報價單');

      // 使用傳入的匯出器實例來生成 Excel
      const exporterInstance = new exporter();
      exporterInstance.export(worksheet, workbook, data, logo, stamp);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const fileName = this.generateFileName('xlsx');

      this.downloadFile(url, fileName);
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
}
