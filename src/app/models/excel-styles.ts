import * as ExcelJS from 'exceljs';

/**
 * Excel 樣式常數
 * 避免 Magic Values，集中管理常用的樣式設定
 */
export const EXCEL_STYLES = {
  // 顏色
  COLORS: {
    TITLE_BG: 'FFD9D9D9',
    HEADER_BG: 'FFE8E8E8',
    LABEL_BG: 'FFF2F2F2',
    AMOUNT_RED: 'FFFF0000',
    DISCOUNT_GREEN: 'FF008000',
  },

  // 字體大小
  FONT_SIZES: {
    TITLE: 18,
    SUBTITLE: 14,
    NORMAL: 12,
    SMALL: 10,
  },

  // 欄位寬度
  COLUMN_WIDTHS: {
    CATEGORY: 16,
    ITEM: 24,
    PRICE: 12,
    COUNT: 12,
    AMOUNT: 12,
  },

  // 圖片尺寸
  IMAGE_SIZES: {
    LOGO: { width: 80, height: 60 },
    STAMP: { width: 120, height: 80 },
  },

  // 其他常數
  DEFAULT_ROW_HEIGHT: 20,
  DEFAULT_COL_WIDTH: 12,
} as const;

/**
 * Excel 邊框樣式
 */
export const BORDER_STYLE: ExcelJS.Border = {
  style: 'thin',
  color: { argb: 'FF000000' },
};

/**
 * 建立填滿樣式
 */
export function createFillStyle(color: string): ExcelJS.Fill {
  return {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: color },
  };
}

/**
 * 從 data URL 提取 base64 編碼
 */
export function extractBase64(dataUrl: string, imageName: string): string {
  if (!dataUrl || !dataUrl.includes(',')) {
    throw new Error(`無效的${imageName}格式`);
  }
  const parts = dataUrl.split(',');
  if (parts.length !== 2) {
    throw new Error(`無效的${imageName}格式`);
  }
  return parts[1];
}
