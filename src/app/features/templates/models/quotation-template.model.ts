import { Type } from '@angular/core';
import * as ExcelJS from 'exceljs';
import { QuotationData } from '@app/features/quotation/models/quotation.model';

/**
 * 報價單樣板配置介面
 */
export interface QuotationTemplate {
  /** 樣式 ID */
  id: string;
  /** 顯示名稱 */
  name: string;
  /** 對應的 HTML 渲染器元件 */
  component: Type<any>;
  /** 對應的 Excel 匯出器類別 */
  excelExporter: Type<ExcelExporter>;
}

/**
 * Excel 匯出器介面
 * 定義每個樣板的 Excel 匯出器必須實作的方法
 */
export interface ExcelExporter {
  /**
   * 匯出報價單資料為 Excel 工作表
   * @param worksheet - ExcelJS 工作表物件
   * @param workbook - ExcelJS 工作簿物件（用於新增圖片等）
   * @param data - 報價單資料
   * @param logo - 客戶 LOGO（base64 格式）
   * @param stamp - 公司章（base64 格式）
   */
  export(
    worksheet: ExcelJS.Worksheet,
    workbook: ExcelJS.Workbook,
    data: QuotationData,
    logo: string,
    stamp: string
  ): void;
}
