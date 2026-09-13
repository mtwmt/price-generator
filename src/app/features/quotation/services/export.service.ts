import { Injectable, inject } from '@angular/core';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import * as ExcelJS from 'exceljs';
import { QuotationData } from '@app/features/quotation/models/quotation.model';
import { ExcelExporter } from '@app/features/templates/models/quotation-template.model';
import { AnalyticsService } from '@app/core/services/analytics.service';
import { LoggerService } from '@app/shared/services/logger.service';



@Injectable({
  providedIn: 'root',
})
export class ExportService {
  // Constants
  private readonly CANVAS_SCALE = 2;
  private readonly IMAGE_QUALITY = 0.95;
  private readonly URL_REVOKE_DELAY_MS = 100;
  private readonly ASSET_READY_TIMEOUT_MS = 5000;
  private readonly MIN_ELEMENT_SIZE = 0;
  private readonly A4_WIDTH_PX = 794; // A4 寬度（以 96 DPI 計算：210mm ≈ 794px）

  // PDF 尺寸常數 (mm)
  private readonly PDF_PAGE_WIDTH = 210;
  private readonly PDF_PAGE_HEIGHT = 297;
  private readonly PDF_CONTENT_WIDTH = 208; // 左右各留 1mm 邊距
  private readonly PDF_MARGIN = 1;

  private analytics = inject(AnalyticsService);
  private logger = inject(LoggerService);

  /**
   * 生成帶有時間戳的檔名
   */
  private generateFileName(extension: string): string {
    // 使用檔名安全的時間戳（避免 '/'、':' 等非法字元）
    // 沿用民國紀年（西元年 - 1911），格式：YYY-MM-DD_HHmmss
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const rocYear = now.getFullYear() - 1911;
    const timestamp =
      `${rocYear}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
      `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
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
   * 等待字型、尚未載入的圖片與下一個繪製循環完成。
   * 匯出 PDF 時，這個等待必須發生在套用 A4 寬度之後，否則換行與
   * `data-pdf-keep-together` 的量測會和實際擷取結果不同。
   */
  private async waitForStableRender(element: HTMLElement): Promise<void> {
    const fontSet = document.fonts;
    if (fontSet?.ready) {
      try {
        await fontSet.ready;
      } catch {
        // 字型 API 的失敗不應阻止使用已回退字型的匯出。
      }
    }

    const pendingImages = Array.from(element.querySelectorAll('img')).filter(
      (image) => !image.complete
    );
    await Promise.all(
      pendingImages.map(
        (image) =>
          new Promise<void>((resolve) => {
            // 遠端圖片長時間未回應時仍要讓使用者可以完成匯出；html2canvas
            // 會以當下可用的內容擷取，而不是把原畫面永久留在 A4 寬度。
            const timeoutId = window.setTimeout(
              settle,
              this.ASSET_READY_TIMEOUT_MS
            );
            function settle() {
              window.clearTimeout(timeoutId);
              resolve();
            }
            image.addEventListener('load', settle, { once: true });
            image.addEventListener('error', settle, { once: true });
          })
      )
    );

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }

  /** 找出目前實際顯示的報價預覽節點。 */
  private findVisibleElement(elementId: string): HTMLElement {
    const elements = document.querySelectorAll(`#${elementId}`);
    for (const candidate of Array.from(elements)) {
      const rect = (candidate as HTMLElement).getBoundingClientRect();
      if (
        rect.width > this.MIN_ELEMENT_SIZE &&
        rect.height > this.MIN_ELEMENT_SIZE
      ) {
        return candidate as HTMLElement;
      }
    }

    throw new Error(`無法找到尺寸不為 0 的元素: ${elementId}`);
  }

  /**
   * 捕捉指定元素為 Canvas
   * @param elementId - 要捕捉的元素 ID
   * @param forceA4Width - 強制使用 A4 寬度（用於 PDF 匯出）
   */
  async captureElement(
    elementId: string,
    forceA4Width = false,
    onStableRender?: (element: HTMLElement) => void
  ): Promise<HTMLCanvasElement> {
    const element = this.findVisibleElement(elementId);

    // 儲存原始樣式
    const originalWidth = element.style.width;
    const originalMaxWidth = element.style.maxWidth;
    const originalMinWidth = element.style.minWidth;
    const originalPadding = element.style.padding;
    const originalBorder = element.style.border;
    const originalBorderRadius = element.style.borderRadius;
    const originalBoxShadow = element.style.boxShadow;
    // 預覽元件以 #classic/#full/#invoice 外層作為擷取目標，但 PDF 專用
    // padding 標記位於實際樣板根節點。不能只讀外層 dataset，否則手機
    // viewport 仍會保留 p-2，而桌面 clone 變成 md:p-4，導致同份報價
    // 產生不同幾何與分頁。
    const pdfPaddingElement = element.matches('[data-pdf-padding]')
      ? element
      : element.querySelector<HTMLElement>('[data-pdf-padding]');
    const originalPdfPadding = pdfPaddingElement?.style.padding ?? '';
    const originalPdfBorder = pdfPaddingElement?.style.border ?? '';
    const originalPdfRadius = pdfPaddingElement?.style.borderRadius ?? '';
    const originalPdfShadow = pdfPaddingElement?.style.boxShadow ?? '';

    // 判斷是否需要設定固定寬度
    // 手機匯出圖片時使用實際寬度，桌面或 PDF 匯出時使用 A4 寬度
    const shouldUseA4Width = forceA4Width || !this.isMobileDevice();

    if (shouldUseA4Width) {
      // 在擷取前設定固定寬度以符合 A4 尺寸
      element.style.width = `${this.A4_WIDTH_PX}px`;
      element.style.maxWidth = `${this.A4_WIDTH_PX}px`;
      element.style.minWidth = `${this.A4_WIDTH_PX}px`;

      // `md:p-*` 是依瀏覽器 viewport（不是元素寬度）判斷。若只固定元素
      // 寬度，手機 viewport 的量測會是 p-2、html2canvas clone 的 A4 viewport
      // 卻會是 p-4，導致換行和分頁位置不同。各樣板在根節點標記 PDF 專用
      // padding，讓量測與 clone 都使用同一份明確值。
      const pdfPadding = pdfPaddingElement?.dataset['pdfPadding'];
      if (pdfPadding && pdfPaddingElement) {
        pdfPaddingElement.style.padding = pdfPadding;
      }

      // 外框不屬於輸出成品。必須在量測前移除，而非只在 onclone 移除，
      // 否則 keep-together 的 DOM 座標會和實際 canvas 差一個 border box。
      element.style.borderWidth = '0';
      element.style.borderStyle = 'none';
      element.style.borderRadius = '0';
      element.style.boxShadow = 'none';
      if (forceA4Width && pdfPaddingElement) {
        // The template root (not its #id wrapper) owns the preview frame.
        // A frame-only remainder must not become a separate PDF page.
        pdfPaddingElement.style.border = '0 none';
        pdfPaddingElement.style.borderRadius = '0';
        pdfPaddingElement.style.boxShadow = 'none';
      }
    }

    try {
      await this.waitForStableRender(element);
      // 量測與 html2canvas 使用完全相同的固定版面，避免不同螢幕寬度換行後
      // 仍套用舊座標造成切到表格列、簽章或總計區。
      onStableRender?.(element);

      return await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: this.CANVAS_SCALE,
        logging: false,
        useCORS: true,
        // 讓 clone 的 media query 使用 A4 寬度；搭配上方 inline padding，
        // 手機與桌面取得的 PDF 幾何完全一致。
        windowWidth: this.A4_WIDTH_PX,
        // 不啟用 allowTaint：避免跨域圖片污染 canvas 導致 toDataURL/toBlob 拋錯而匯出失敗
        // （logo、印章皆為同源 base64 data URL，不受影響）
        allowTaint: false,
        onclone: (clonedDoc) => {
          // 在 clone 的文檔中處理元素
          const clonedElements = clonedDoc.querySelectorAll(`#${elementId}`);
          clonedElements.forEach((clonedElement) => {
            const el = clonedElement as HTMLElement;
            if (forceA4Width) {
              // Canvas background patterns otherwise inherit a different global
              // pixel origin from the desktop preview versus the mobile dialog.
              el.style.position = 'fixed';
              el.style.left = '0';
              el.style.top = '0';
              el.style.margin = '0';
            }
            // html2canvas 建立 clone 時會重新套用 media query，不能假定原始
            // 節點的 inline padding 已被完整保留。再次固定內層樣板根節點，
            // 才能讓 375px 的量測與 A4 clone 的實際 canvas 幾何一致。
            const clonedPdfPaddingElement = el.matches('[data-pdf-padding]')
              ? el
              : el.querySelector<HTMLElement>('[data-pdf-padding]');
            const clonedPdfPadding = clonedPdfPaddingElement?.dataset['pdfPadding'];
            if (clonedPdfPadding && clonedPdfPaddingElement) {
              clonedPdfPaddingElement.style.padding = clonedPdfPadding;
              if (forceA4Width) {
                clonedPdfPaddingElement.style.border = '0 none';
                clonedPdfPaddingElement.style.borderRadius = '0';
                clonedPdfPaddingElement.style.boxShadow = 'none';
              }
            }

            // 移除按鈕
            const buttons = el.querySelectorAll('button');
            buttons.forEach((btn) => btn.remove());

            // 移除邊框、圓角和陰影
            el.style.borderWidth = '0';
            el.style.borderStyle = 'none';
            el.style.borderRadius = '0';
            el.style.boxShadow = 'none';
          });
        },
      });
    } finally {
      // 恢復原始樣式
      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxWidth;
      element.style.minWidth = originalMinWidth;
      element.style.padding = originalPadding;
      element.style.border = originalBorder;
      element.style.borderRadius = originalBorderRadius;
      element.style.boxShadow = originalBoxShadow;
      if (pdfPaddingElement) {
        pdfPaddingElement.style.padding = originalPdfPadding;
        pdfPaddingElement.style.border = originalPdfBorder;
        pdfPaddingElement.style.borderRadius = originalPdfRadius;
        pdfPaddingElement.style.boxShadow = originalPdfShadow;
      }
    }
  }

  /**
   * 匯出為圖片
   * 在手機上若支援 Web Share API，會開啟分享選單；否則直接下載
   * @param elementId - 要匯出的元素 ID
   * @param customerName - 客戶名稱（用於分享文字）
   * @param quotationData - 保留舊呼叫端相容性；不會傳送或保留此資料
   */
  async exportAsImage(
    elementId: string,
    customerName?: string,
    _quotationData?: QuotationData,
    _templateStyle?: string
  ): Promise<void> {
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
          this.logger.log('分享取消或不支援，改用下載方式');
        }
      }

      // 降級方案：使用傳統下載方式
      const dataUrl = canvas.toDataURL('image/jpeg', this.IMAGE_QUALITY);
      this.downloadFile(dataUrl, fileName);
      this.analytics.trackExport('image');
    } catch (error) {
      this.logger.error('匯出圖片失敗:', error);
      // 不將底層例外（可能含 DOM、URL 或使用者內容）送入分析事件。
      this.analytics.trackError(new Error('image export failed'), 'export_image');
      throw new Error('匯出圖片失敗，請重試');
    }
  }

  /**
   * 匯出為 PDF
   * @param elementId - 要匯出的元素 ID
   * @param quotationData - 保留舊呼叫端相容性；不會傳送或保留此資料
   * @param templateStyle - 保留舊呼叫端相容性；不會傳送或保留此資料
   */
  async exportAsPDF(
    elementId: string,
    _quotationData?: QuotationData,
    _templateStyle?: string
  ): Promise<void> {
    try {
      let keepTogetherBlocks: Array<{ top: number; bottom: number }> = [];
      let measuredContainerHeight = 0;
      let measuredContentHeight = 0;

      // 固定 A4 寬度、等待素材與量測不可切割區塊都在同一個 capture transaction
      // 內，無論擷取成功或失敗都由 captureElement 的 finally 恢復原本 UI。
      const canvas = await this.captureElement(elementId, true, (element) => {
        keepTogetherBlocks = this.getKeepTogetherBlocks(element);
        measuredContainerHeight = element.getBoundingClientRect().height;
        measuredContentHeight = this.getPdfContentHeight(element);
      });
      const dataUrl = canvas.toDataURL('image/png');
      const fileName = this.generateFileName('pdf');

      // 計算圖片在 PDF 中的尺寸
      const imgWidth = this.PDF_CONTENT_WIDTH;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // 計算縮放比例：從 DOM 座標轉換到 PDF 座標
      if (measuredContainerHeight <= 0) {
        throw new Error('無法量測報價單高度');
      }
      const scaleRatio = imgHeight / measuredContainerHeight;

      // 智慧分頁
      this.exportPdfSmartPage(dataUrl, imgWidth, imgHeight, fileName, keepTogetherBlocks, scaleRatio,
        measuredContentHeight * scaleRatio);

      this.analytics.trackExport('pdf');
    } catch (error) {
      this.logger.error('匯出 PDF 失敗:', error);
      this.analytics.trackError(new Error('pdf export failed'), 'export_pdf');
      throw new Error('匯出 PDF 失敗，請重試');
    }
  }

  /**
   * 取得標記為不可切割的區塊位置
   * @param container - 容器元素
   * @returns 區塊的 top 和 bottom 位置（相對於容器）
   */
  private getKeepTogetherBlocks(container: HTMLElement): Array<{ top: number; bottom: number }> {
    const keepTogetherElements = container.querySelectorAll('[data-pdf-keep-together], img, svg, canvas');
    const containerRect = container.getBoundingClientRect();

    const blocks = Array.from(keepTogetherElements).map(el => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      return {
        top: rect.top - containerRect.top,
        bottom: rect.bottom - containerRect.top
      };
    });
    // Long notes/oversized sections may span pages, but individual rendered
    // text lines and small images must not be bisected by the page boundary.
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let text: Node | null;
    while ((text = walker.nextNode())) {
      if (!text.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(text);
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.height > 0 && rect.width > 0) blocks.push({
          top: rect.top - containerRect.top,
          bottom: rect.bottom - containerRect.top,
        });
      }
    }
    return blocks;
  }

  /** Only the marked template root's trailing padding may be omitted. Never
   * infer empty content from pixel density: one small footer is still content.
   * Descendants overflowing into padding extend this boundary conservatively. */
  private getPdfContentHeight(container: HTMLElement): number {
    const bounds = container.getBoundingClientRect();
    const root = container.matches('[data-pdf-padding]')
      ? container : container.querySelector<HTMLElement>('[data-pdf-padding]');
    if (!root) return bounds.height;
    const rootBounds = root.getBoundingClientRect();
    const padding = Number.parseFloat(getComputedStyle(root).paddingBottom) || 0;
    let bottom = rootBounds.bottom - bounds.top - padding;
    for (const child of container.querySelectorAll('*')) {
      // Ancestor wrappers include root padding in their own bounds.
      if (child === root || child.contains(root)) continue;
      const rect = child.getBoundingClientRect();
      if (rect.height > 0 && rect.width > 0) bottom = Math.max(bottom, rect.bottom - bounds.top);
    }
    const range = document.createRange();
    range.selectNodeContents(root);
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.height > 0 && rect.width > 0) bottom = Math.max(bottom, rect.bottom - bounds.top);
    }
    return bottom > 0 ? Math.min(bounds.height, bottom) : bounds.height;
  }

  /**
   * 將整張擷取圖切成有進展的頁面範圍。小於一頁的 keep-together 區塊會
   * 整塊移到下一頁；超過一頁的區塊則安全地依頁高拆分，避免空白頁或無限迴圈。
   */
  private calculatePdfPageRanges(
    imgHeight: number,
    blocks: Array<{ top: number; bottom: number }>,
    contentBottom = imgHeight
  ): Array<{ start: number; end: number }> {
    const contentHeight = this.PDF_PAGE_HEIGHT - this.PDF_MARGIN * 2;
    const ranges: Array<{ start: number; end: number }> = [];
    const sortedBlocks = blocks
      .filter((block) => block.bottom > block.top && block.bottom > 0)
      .map((block) => ({
        top: Math.max(0, block.top),
        bottom: Math.min(imgHeight, block.bottom),
      }))
      .sort((a, b) => a.top - b.top);

    let start = 0;
    // At most the final root-padding-only page is skipped. Every content-bearing
    // range is retained, including sparse footer text or the end of a giant block.
    while (start < imgHeight && start < contentBottom) {
      const naturalEnd = Math.min(start + contentHeight, imgHeight);
      let end = naturalEnd;

      for (const block of sortedBlocks) {
        const blockHeight = block.bottom - block.top;
        if (
          blockHeight <= contentHeight &&
          block.top > start &&
          block.top < naturalEnd &&
          block.bottom > naturalEnd
        ) {
          end = Math.min(end, block.top);
        }
      }

      // 若區塊剛好位於頁首，或可用範圍不足，直接切割大型區塊以確保進展。
      if (end <= start) {
        end = naturalEnd;
      }

      ranges.push({ start, end });
      start = end;
    }

    return ranges;
  }

  /**
   * 智慧分頁 PDF
   * 避免在標記區塊中間切割，如有需要則提前換頁
   */
  private exportPdfSmartPage(
    dataUrl: string,
    imgWidth: number,
    imgHeight: number,
    fileName: string,
    keepTogetherBlocks: Array<{ top: number; bottom: number }>,
    scaleRatio: number,
    contentBottom = imgHeight
  ): void {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageHeight = this.PDF_PAGE_HEIGHT;
    const pageWidth = this.PDF_PAGE_WIDTH;

    // 轉換區塊座標到 PDF 座標
    const pdfBlocks = keepTogetherBlocks.map(block => ({
      top: block.top * scaleRatio,
      bottom: block.bottom * scaleRatio
    }));

    const pageRanges = this.calculatePdfPageRanges(imgHeight, pdfBlocks, contentBottom);

    for (let pageIndex = 0; pageIndex < pageRanges.length; pageIndex++) {
      if (pageIndex > 0) {
        pdf.addPage();
      }

      const { start: pageStartY, end: pageEndY } = pageRanges[pageIndex];

      // 計算此頁的顯示範圍
      // 將圖片偏移，使 pageStartY 對齊頁面頂部
      const yOffset = -pageStartY + this.PDF_MARGIN;

      // 先畫白色背景覆蓋整頁
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');

      // 畫圖片
      pdf.addImage(
        dataUrl,
        'PNG',
        this.PDF_MARGIN,
        yOffset,
        imgWidth,
        imgHeight
      );

      // 用白色遮罩覆蓋頁面上方和下方的超出內容
      // 上方遮罩
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, this.PDF_MARGIN, 'F');

      // 下方遮罩：從有效內容結束位置到頁面底部
      const contentEndOnPage = (pageEndY - pageStartY) + this.PDF_MARGIN;
      if (contentEndOnPage < pageHeight) {
        // Extend only BELOW the physical page. jsPDF's rounded A4 MediaBox and
        // raster edge coverage otherwise expose one last image row at y=297mm.
        // Keep the content cut unchanged: no overlap can erase the final text line.
        pdf.rect(0, contentEndOnPage, pageWidth, pageHeight - contentEndOnPage + this.PDF_MARGIN, 'F');
      }
    }

    pdf.save(fileName);
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
    stamp: string = '',
    _templateStyle?: string
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
      this.logger.error('匯出 Excel 失敗:', error);
      this.analytics.trackError(new Error('excel export failed'), 'export_excel');
      throw new Error('匯出 Excel 失敗，請重試');
    }
  }
}
