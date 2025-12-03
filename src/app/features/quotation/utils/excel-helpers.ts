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
