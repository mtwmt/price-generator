import * as ExcelJS from 'exceljs';
import { QuotationData } from '../../models/quotation.model';
import { ExcelExporter } from '../../models/quotation-template.model';
import {
  EXCEL_STYLES,
  BORDER_STYLE,
  createFillStyle,
} from '../../models/excel-styles';
import {
  getTaxLabel,
  addImageToWorksheet,
  styleHeaderRow,
  styleDataRow,
  styleSummaryRow,
  styleRemarkTitleRow,
} from '../../utils/excel-helpers';

export class ClassicExcelExporter implements ExcelExporter {
  private readonly PRINT_AREA = 'A1:E25';
  private readonly TABLE_COLUMNS = 5;

  export(
    worksheet: ExcelJS.Worksheet,
    workbook: ExcelJS.Workbook,
    data: QuotationData,
    logo: string,
    stamp: string
  ): void {
    this.setupWorksheet(worksheet);
    this.createTitleSection(worksheet, workbook, data, logo);
    this.createCompanyInfoSection(worksheet, workbook, data, stamp);
    this.createServiceItemsTable(worksheet, data);
    this.createSummarySection(worksheet, data);
    this.createNotesAndSignature(worksheet, data);
    this.applyBorders(worksheet);
  }

  private setupWorksheet(worksheet: ExcelJS.Worksheet): void {
    worksheet.properties.defaultRowHeight = EXCEL_STYLES.DEFAULT_ROW_HEIGHT;
    worksheet.properties.defaultColWidth = EXCEL_STYLES.DEFAULT_COL_WIDTH;
    worksheet.pageSetup.printArea = this.PRINT_AREA;

    worksheet.columns = [
      { width: EXCEL_STYLES.COLUMN_WIDTHS.CATEGORY },
      { width: EXCEL_STYLES.COLUMN_WIDTHS.ITEM },
      { width: EXCEL_STYLES.COLUMN_WIDTHS.PRICE },
      { width: EXCEL_STYLES.COLUMN_WIDTHS.COUNT },
      { width: EXCEL_STYLES.COLUMN_WIDTHS.AMOUNT },
    ];
  }

  private createTitleSection(
    worksheet: ExcelJS.Worksheet,
    workbook: ExcelJS.Workbook,
    data: QuotationData,
    logo: string
  ): void {
    const titleBgColor = createFillStyle(EXCEL_STYLES.COLORS.TITLE_BG);
    const titleStartCol = logo ? 'B1:C2' : 'A1:C2';

    // 合併標題儲存格
    worksheet.mergeCells(titleStartCol);
    const titleCell = worksheet.getCell(titleStartCol.split(':')[0]);
    titleCell.value = `${data.customerCompany} - 報價單`;
    titleCell.font = { size: EXCEL_STYLES.FONT_SIZES.TITLE, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = titleBgColor;

    // 新增客戶 LOGO
    if (logo) {
      addImageToWorksheet(workbook, worksheet, logo, 'LOGO', 0, 0);
    }

    // 設定右側儲存格背景
    ['D1', 'E1', 'D2', 'E2'].forEach((cellAddr) => {
      worksheet.getCell(cellAddr).fill = titleBgColor;
    });

    // 新增統一編號
    if (data.customerTaxID) {
      const taxIdLabelCell = worksheet.getCell('D2');
      taxIdLabelCell.value = '統一編號：';
      taxIdLabelCell.font = {
        size: EXCEL_STYLES.FONT_SIZES.NORMAL,
        bold: true,
      };
      taxIdLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

      const taxIdValueCell = worksheet.getCell('E2');
      taxIdValueCell.value = data.customerTaxID;
      taxIdValueCell.font = { size: EXCEL_STYLES.FONT_SIZES.NORMAL };
      taxIdValueCell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  }

  private createCompanyInfoSection(
    worksheet: ExcelJS.Worksheet,
    workbook: ExcelJS.Workbook,
    data: QuotationData,
    stamp: string
  ): void {
    const labelBgColor = createFillStyle(EXCEL_STYLES.COLORS.LABEL_BG);

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
      row.getCell(1).fill = labelBgColor;
      row.getCell(1).font = {
        size: EXCEL_STYLES.FONT_SIZES.NORMAL,
        bold: true,
      };
      row.getCell(2).font = { size: EXCEL_STYLES.FONT_SIZES.NORMAL };
    });

    // 新增公司章
    if (stamp) {
      addImageToWorksheet(workbook, worksheet, stamp, '公司章', 2, 3);
    }
  }

  private createServiceItemsTable(
    worksheet: ExcelJS.Worksheet,
    data: QuotationData
  ): void {
    const headerBgColor = createFillStyle(EXCEL_STYLES.COLORS.HEADER_BG);

    worksheet.addRow([]);

    // 建立表頭
    const headerRow = worksheet.addRow([
      '類別',
      '項目',
      '單價',
      '數量',
      '金額',
    ]);
    styleHeaderRow(headerRow, headerBgColor, this.TABLE_COLUMNS);

    // 建立服務項目列
    data.serviceItems.forEach((item) => {
      const row = worksheet.addRow([
        item.category,
        item.item,
        item.price,
        item.count + (item.unit ? `/${item.unit}` : ''),
        item.amount,
      ]);
      styleDataRow(row);
      row.getCell(this.TABLE_COLUMNS).alignment = { horizontal: 'right' };
    });
  }

  private createSummarySection(
    worksheet: ExcelJS.Worksheet,
    data: QuotationData
  ): void {
    const taxLabel = getTaxLabel(data);
    const summaryData: any[] = [['', '', '', '小計', data.excludingTax]];

    // 折扣行
    if (data.discountValue && data.discountValue > 0) {
      const discountLabel =
        data.discountType === 'percentage'
          ? `折扣 (${data.discountValue} 折)`
          : '折扣';
      summaryData.push([
        '',
        '',
        '',
        discountLabel,
        -(data.discountAmount || 0),
      ]);
      summaryData.push(['', '', '', '折扣後', data.afterDiscount || 0]);
    }

    // 稅額和總計
    summaryData.push([
      '',
      '',
      taxLabel + '稅',
      data.percentage + '%',
      data.tax,
    ]);
    summaryData.push(['', '', '', '含稅計', data.includingTax]);

    summaryData.forEach((rowData) => {
      const row = worksheet.addRow(rowData);
      row.eachCell((cell) => {
        cell.font = { size: EXCEL_STYLES.FONT_SIZES.NORMAL };
      });
      styleSummaryRow(row, rowData[4], 4, this.TABLE_COLUMNS);
    });
  }

  private createNotesAndSignature(
    worksheet: ExcelJS.Worksheet,
    data: QuotationData
  ): void {
    const titleBgColor = createFillStyle(EXCEL_STYLES.COLORS.TITLE_BG);

    // 備註區
    if (data.desc) {
      worksheet.addRow([]);
      const remarkTitleRow = worksheet.addRow(['【備 註】']);
      styleRemarkTitleRow(remarkTitleRow, titleBgColor, this.TABLE_COLUMNS);

      const descRow = worksheet.addRow([data.desc]);
      const descRowIndex = descRow.number;
      worksheet.mergeCells(`A${descRowIndex}:E${descRowIndex}`);
      descRow.getCell(1).font = { size: EXCEL_STYLES.FONT_SIZES.NORMAL };
    }

    // 簽章區
    worksheet.addRow([]);
    const signRow = worksheet.addRow(['客戶簽章：']);
    signRow.getCell(1).font = { size: EXCEL_STYLES.FONT_SIZES.NORMAL };
    worksheet.addRow([]);
  }

  private applyBorders(worksheet: ExcelJS.Worksheet): void {
    const lastRow = worksheet.rowCount;

    for (let row = 1; row <= lastRow; row++) {
      for (let col = 1; col <= this.TABLE_COLUMNS; col++) {
        const cell = worksheet.getCell(row, col);
        cell.border = {
          top: row === 1 ? BORDER_STYLE : undefined,
          left: col === 1 ? BORDER_STYLE : undefined,
          bottom: row === lastRow ? BORDER_STYLE : undefined,
          right: col === this.TABLE_COLUMNS ? BORDER_STYLE : undefined,
        };
      }
    }
  }
}
