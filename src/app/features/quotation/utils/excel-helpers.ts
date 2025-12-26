import * as ExcelJS from 'exceljs';
import { QuotationData } from '@app/features/quotation/models/quotation.model';
import { EXCEL_STYLES, extractBase64 } from '@app/features/quotation/models/excel-styles';

/**
 * Excel 匯出器共用輔助函數
 * 避免在各個匯出器中重複相同的程式碼
 */

/**
 * 取得稅額標籤（處理自訂稅名）
 */
export function getTaxLabel(data: QuotationData): string {
  return data.taxName === '自訂' && data.customTaxName
    ? data.customTaxName
    : data.taxName || '';
}

/**
 * 新增圖片到工作表
 * @param workbook - ExcelJS 工作簿
 * @param worksheet - ExcelJS 工作表
 * @param dataUrl - 圖片 data URL
 * @param imageName - 圖片名稱（用於錯誤訊息）
 * @param col - 圖片左上角欄位
 * @param row - 圖片左上角列位
 */
export function addImageToWorksheet(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  dataUrl: string,
  imageName: string,
  col: number,
  row: number
): void {
  const imageId = workbook.addImage({
    base64: extractBase64(dataUrl, imageName),
    extension: 'png',
  });

  const imageSize =
    imageName === 'LOGO'
      ? EXCEL_STYLES.IMAGE_SIZES.LOGO
      : EXCEL_STYLES.IMAGE_SIZES.STAMP;

  worksheet.addImage(imageId, {
    tl: { col, row },
    ext: imageSize,
    editAs: 'oneCell',
  });
}

/**
 * 樣式化表頭列
 * @param row - ExcelJS 列
 * @param bgColor - 背景顏色
 * @param columnCount - 欄位數量
 */
export function styleHeaderRow(
  row: ExcelJS.Row,
  bgColor: ExcelJS.Fill,
  columnCount: number
): void {
  row.font = { size: EXCEL_STYLES.FONT_SIZES.NORMAL, bold: true };
  row.alignment = { horizontal: 'center', vertical: 'middle' };
  for (let col = 1; col <= columnCount; col++) {
    row.getCell(col).fill = bgColor;
  }
}

/**
 * 樣式化資料列
 * @param row - ExcelJS 列
 * @param fontSize - 字體大小（預設為 NORMAL）
 */
export function styleDataRow(
  row: ExcelJS.Row,
  fontSize: number = EXCEL_STYLES.FONT_SIZES.SMALL
): void {
  row.eachCell((cell) => {
    cell.font = { size: fontSize };
  });
}

/**
 * 樣式化總計列
 * @param row - ExcelJS 列
 * @param amount - 金額（用於判斷顏色）
 * @param labelCol - 標籤欄位編號
 * @param amountCol - 金額欄位編號
 */
export function styleSummaryRow(
  row: ExcelJS.Row,
  amount: number,
  labelCol: number,
  amountCol: number
): void {
  row.getCell(labelCol).font = {
    size: EXCEL_STYLES.FONT_SIZES.NORMAL,
    bold: true,
  };
  row.getCell(labelCol).alignment = { horizontal: 'right' };

  const isDiscountRow = typeof amount === 'number' && amount < 0;
  row.getCell(amountCol).font = {
    size: EXCEL_STYLES.FONT_SIZES.NORMAL,
    bold: true,
    color: {
      argb: isDiscountRow
        ? EXCEL_STYLES.COLORS.DISCOUNT_GREEN
        : EXCEL_STYLES.COLORS.AMOUNT_RED,
    },
  };
  row.getCell(amountCol).alignment = { horizontal: 'right' };
}

/**
 * 樣式化備註標題列
 * @param row - ExcelJS 列
 * @param bgColor - 背景顏色
 * @param columnCount - 欄位數量
 */
export function styleRemarkTitleRow(
  row: ExcelJS.Row,
  bgColor: ExcelJS.Fill,
  columnCount: number
): void {
  row.getCell(1).font = {
    size: EXCEL_STYLES.FONT_SIZES.NORMAL,
    bold: true,
  };
  row.alignment = { horizontal: 'center', vertical: 'middle' };
  for (let col = 1; col <= columnCount; col++) {
    row.getCell(col).fill = bgColor;
  }
}

/**
 * 取得報價方資訊列表
 * @param data - 報價單資料
 * @returns 報價方資訊字串陣列
 */
export function getQuoterInfoRows(data: QuotationData): string[] {
  const rows: string[] = [];
  if (data.quoterTaxID) rows.push(`統編：${data.quoterTaxID}`);
  if (data.quoterAddress) rows.push(`地址：${data.quoterAddress}`);
  if (data.quoterPhone) rows.push(`電話：${data.quoterPhone}`);
  if (data.quoterEmail) rows.push(`Email：${data.quoterEmail}`);
  return rows;
}

/**
 * 取得客戶資訊列表
 * @param data - 報價單資料
 * @returns 客戶資訊字串陣列
 */
export function getCustomerInfoRows(data: QuotationData): string[] {
  const rows: string[] = [];
  if (data.customerContact) rows.push(`聯絡人：${data.customerContact}`);
  if (data.customerTaxID) rows.push(`統編：${data.customerTaxID}`);
  if (data.customerAddress) rows.push(`地址：${data.customerAddress}`);
  if (data.customerPhone) rows.push(`電話：${data.customerPhone}`);
  if (data.customerEmail) rows.push(`Email：${data.customerEmail}`);
  return rows;
}

/**
 * 建立簽章區
 * @param worksheet - ExcelJS 工作表
 * @param isSign - 是否顯示簽章區
 */
export function createSignatureSection(
  worksheet: ExcelJS.Worksheet,
  isSign: boolean
): void {
  if (!isSign) return;

  worksheet.addRow([]);

  // 簽章區標題
  const signTitleRow = worksheet.addRow([
    '報價人簽章',
    '',
    '客戶簽章確認',
  ]);
  worksheet.mergeCells(`A${signTitleRow.number}:B${signTitleRow.number}`);
  worksheet.mergeCells(`C${signTitleRow.number}:E${signTitleRow.number}`);
  signTitleRow.getCell(1).font = {
    size: EXCEL_STYLES.FONT_SIZES.NORMAL,
    bold: true,
  };
  signTitleRow.getCell(3).font = {
    size: EXCEL_STYLES.FONT_SIZES.NORMAL,
    bold: true,
  };

  // 簽章欄位
  const signRow1 = worksheet.addRow([
    '簽章：______________',
    '',
    '簽章：______________',
  ]);
  worksheet.mergeCells(`A${signRow1.number}:B${signRow1.number}`);
  worksheet.mergeCells(`C${signRow1.number}:E${signRow1.number}`);

  const signRow2 = worksheet.addRow([
    '日期：______________',
    '',
    '日期：______________',
  ]);
  worksheet.mergeCells(`A${signRow2.number}:B${signRow2.number}`);
  worksheet.mergeCells(`C${signRow2.number}:E${signRow2.number}`);
}

/**
 * Footer 資料結構
 */
export interface FooterData {
  quoterName?: string;
  quoterAddress?: string;
  quoterPhone?: string;
  quoterPhoneExt?: string;
}

/**
 * 建立頁尾區
 * @param worksheet - ExcelJS 工作表
 * @param data - 頁尾資料
 */
export function createFooterSection(
  worksheet: ExcelJS.Worksheet,
  data: FooterData
): void {
  worksheet.addRow([]);
  const footerText = `本報價單由 ${data.quoterName || '[公司名稱]'} 提供${
    data.quoterAddress ? ' | 地址：' + data.quoterAddress : ''
  }${
    data.quoterPhone
      ? ' | 電話：' +
        data.quoterPhone +
        (data.quoterPhoneExt ? ` #${data.quoterPhoneExt}` : '')
      : ''
  }`;

  const footerRow = worksheet.addRow([footerText]);
  worksheet.mergeCells(`A${footerRow.number}:E${footerRow.number}`);
  footerRow.getCell(1).font = { size: EXCEL_STYLES.FONT_SIZES.SMALL };
  footerRow.getCell(1).alignment = { horizontal: 'center' };
}
