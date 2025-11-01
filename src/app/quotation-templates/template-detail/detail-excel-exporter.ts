import * as ExcelJS from 'exceljs';
import { QuotationData } from '../../models/quotation.model';
import { ExcelExporter } from '../../models/quotation-template.model';
import {
  EXCEL_STYLES,
  BORDER_STYLE,
  createFillStyle,
} from '../../models/excel-styles';
import {
  styleDataRow,
  styleHeaderRow,
  addImageToWorksheet,
  getTaxLabel,
  styleSummaryRow,
} from '../../utils/excel-helpers';

export class DetailExcelExporter implements ExcelExporter {
  private readonly PRINT_AREA = 'A1:E30';
  private readonly TABLE_COLUMNS = 5;

  export(
    worksheet: ExcelJS.Worksheet,
    workbook: ExcelJS.Workbook,
    data: QuotationData,
    logo: string,
    stamp: string
  ): void {
    this.setupWorksheet(worksheet);
    this.createHeaderSection(worksheet, data);
    this.createQuoterInfoSection(worksheet, data);
    this.createCustomerInfoSection(worksheet, data);
    this.createServiceItemsTable(worksheet, data);
    this.createSummarySection(worksheet, data, workbook, stamp);
    this.createNotesSection(worksheet, data);
    this.createSignatureSection(worksheet, data);
    this.createFooterSection(worksheet, data);
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

  private createHeaderSection(
    worksheet: ExcelJS.Worksheet,
    data: QuotationData
  ): void {
    const titleBgColor = createFillStyle(EXCEL_STYLES.COLORS.TITLE_BG);

    // 報價單標題
    worksheet.mergeCells('A1:E1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = '報價單';
    titleCell.font = { size: EXCEL_STYLES.FONT_SIZES.TITLE, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = titleBgColor;

    // 日期資訊（右側）
    const dateCell = worksheet.getCell('E2');
    dateCell.value = `報價日期：${data.startDate}`;
    dateCell.font = { size: EXCEL_STYLES.FONT_SIZES.SMALL };
    dateCell.alignment = { horizontal: 'right', vertical: 'middle' };

    if (data.endDate) {
      const endDateCell = worksheet.getCell('E3');
      endDateCell.value = `有效期限：${data.endDate}`;
      endDateCell.font = { size: EXCEL_STYLES.FONT_SIZES.SMALL };
      endDateCell.alignment = { horizontal: 'right', vertical: 'middle' };
    }

    // 新增 LOGO
    // if (logo) {
    //   addImageToWorksheet(workbook, worksheet, logo, 'LOGO', 0, 0);
    // }

    worksheet.addRow([]);
  }

  private createQuoterInfoSection(
    worksheet: ExcelJS.Worksheet,
    data: QuotationData
  ): void {
    const labelBgColor = createFillStyle(EXCEL_STYLES.COLORS.LABEL_BG);

    // 報價方資訊標題
    const quoterTitleRow = worksheet.addRow(['報價方資訊']);
    worksheet.mergeCells(`A${quoterTitleRow.number}:E${quoterTitleRow.number}`);
    quoterTitleRow.getCell(1).font = {
      size: EXCEL_STYLES.FONT_SIZES.NORMAL,
      bold: true,
    };
    quoterTitleRow.getCell(1).fill = labelBgColor;

    // 報價方資料
    const quoterInfoRows = [
      ['公司名稱', data.quoterName || '[公司名稱]'],
      ...(data.quoterTaxID ? [['統編', data.quoterTaxID]] : []),
      ...(data.quoterAddress ? [['地址', data.quoterAddress]] : []),
      ...(data.quoterPhone ? [['電話', data.quoterPhone]] : []),
      ...(data.quoterEmail ? [['Email', data.quoterEmail]] : []),
    ];

    quoterInfoRows.forEach((rowData) => {
      const row = worksheet.addRow(rowData);
      row.getCell(1).font = { size: EXCEL_STYLES.FONT_SIZES.SMALL, bold: true };
      row.getCell(1).fill = labelBgColor;
      row.getCell(2).font = { size: EXCEL_STYLES.FONT_SIZES.SMALL };
    });

    worksheet.addRow([]);
  }

  private createCustomerInfoSection(
    worksheet: ExcelJS.Worksheet,
    data: QuotationData
  ): void {
    const labelBgColor = createFillStyle(EXCEL_STYLES.COLORS.LABEL_BG);

    // 客戶資訊標題
    const customerTitleRow = worksheet.addRow(['客戶資訊']);
    worksheet.mergeCells(
      `A${customerTitleRow.number}:E${customerTitleRow.number}`
    );
    customerTitleRow.getCell(1).font = {
      size: EXCEL_STYLES.FONT_SIZES.NORMAL,
      bold: true,
    };
    customerTitleRow.getCell(1).fill = labelBgColor;

    // 客戶資料
    const customerInfoRows = [
      ['客戶名稱', data.customerCompany],
      ...(data.customerContact ? [['聯絡人', data.customerContact]] : []),
      ...(data.customerPhone ? [['電話', data.customerPhone]] : []),
      ...(data.customerEmail ? [['E-Mail', data.customerEmail]] : []),
      ...(data.customerAddress ? [['地址', data.customerAddress]] : []),
      ...(data.customerTaxID ? [['統編', data.customerTaxID]] : []),
    ];

    customerInfoRows.forEach((rowData) => {
      const row = worksheet.addRow(rowData);
      row.getCell(1).font = { size: EXCEL_STYLES.FONT_SIZES.SMALL, bold: true };
      row.getCell(1).fill = labelBgColor;
      row.getCell(2).font = { size: EXCEL_STYLES.FONT_SIZES.SMALL };
    });

    worksheet.addRow([]);
  }

  private createServiceItemsTable(
    worksheet: ExcelJS.Worksheet,
    data: QuotationData
  ): void {
    const headerBgColor = createFillStyle(EXCEL_STYLES.COLORS.HEADER_BG);

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
    data: QuotationData,
    workbook: ExcelJS.Workbook,
    stamp: string
  ): void {
    const startRow = worksheet.rowCount + 1;
    const taxLabel = getTaxLabel(data);

    // 小計
    const subtotalRow = worksheet.addRow([
      '',
      '',
      '',
      '小計：',
      data.excludingTax,
    ]);
    styleSummaryRow(subtotalRow, data.excludingTax, 4, 5);

    // 折扣
    if (data.discountValue && data.discountValue > 0) {
      const discountLabel =
        data.discountType === 'percentage'
          ? `折扣 (${data.discountValue} 折)：`
          : '折扣：';
      const discountRow = worksheet.addRow([
        '',
        '',
        '',
        discountLabel,
        -(data.discountAmount || 0),
      ]);
      styleSummaryRow(discountRow, -(data.discountAmount || 0), 4, 5);
    }

    // 稅額
    if (taxLabel) {
      const taxRow = worksheet.addRow([
        '',
        '',
        '',
        `${taxLabel}(${data.percentage}%)`,
        data.tax,
      ]);
      styleSummaryRow(taxRow, data.tax, 4, 5);
    }

    // 總計
    const totalRow = worksheet.addRow([
      '',
      '',
      '',
      '總計：',
      data.includingTax,
    ]);
    totalRow.getCell(4).font = {
      size: EXCEL_STYLES.FONT_SIZES.SUBTITLE,
      bold: true,
    };
    totalRow.getCell(5).font = {
      size: EXCEL_STYLES.FONT_SIZES.SUBTITLE,
      bold: true,
      color: { argb: EXCEL_STYLES.COLORS.AMOUNT_RED },
    };
    totalRow.getCell(5).alignment = { horizontal: 'right' };

    // 新增公司章（左側）
    if (stamp) {
      addImageToWorksheet(
        workbook,
        worksheet,
        stamp,
        '公司章',
        0,
        startRow - 1
      );
    }
  }

  private createNotesSection(
    worksheet: ExcelJS.Worksheet,
    data: QuotationData
  ): void {
    if (data.desc) {
      worksheet.addRow([]);
      const titleBgColor = createFillStyle(EXCEL_STYLES.COLORS.TITLE_BG);

      const remarkTitleRow = worksheet.addRow(['備註']);
      worksheet.mergeCells(
        `A${remarkTitleRow.number}:E${remarkTitleRow.number}`
      );
      remarkTitleRow.getCell(1).font = {
        size: EXCEL_STYLES.FONT_SIZES.NORMAL,
        bold: true,
      };
      remarkTitleRow.getCell(1).fill = titleBgColor;
      remarkTitleRow.getCell(1).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };

      const descRow = worksheet.addRow([data.desc]);
      worksheet.mergeCells(`A${descRow.number}:E${descRow.number}`);
      descRow.getCell(1).font = { size: EXCEL_STYLES.FONT_SIZES.SMALL };
      descRow.getCell(1).alignment = { wrapText: true };
    }
  }

  private createSignatureSection(
    worksheet: ExcelJS.Worksheet,
    data: QuotationData
  ): void {
    if (data.isSign) {
      worksheet.addRow([]);

      // 簽章區標題
      const signTitleRow = worksheet.addRow(['報價人簽章', '', '客戶簽章確認']);
      worksheet.mergeCells(`A${signTitleRow.number}:C${signTitleRow.number}`);
      worksheet.mergeCells(`D${signTitleRow.number}:E${signTitleRow.number}`);
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
  }

  private createFooterSection(
    worksheet: ExcelJS.Worksheet,
    data: QuotationData
  ): void {
    worksheet.addRow([]);
    const footerText = `本報價單由 ${data.quoterName || '[公司名稱]'} 提供${
      data.quoterAddress ? ' | 地址：' + data.quoterAddress : ''
    }${data.quoterPhone ? ' | 電話：' + data.quoterPhone : ''}`;

    const footerRow = worksheet.addRow([footerText]);
    worksheet.mergeCells(`A${footerRow.number}:E${footerRow.number}`);
    footerRow.getCell(1).font = { size: EXCEL_STYLES.FONT_SIZES.SMALL };
    footerRow.getCell(1).alignment = { horizontal: 'center' };
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
