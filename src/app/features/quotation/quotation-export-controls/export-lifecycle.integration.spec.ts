/** @jest-environment jsdom */
/** Real controls → real export service/exporters; only raster/download/DI boundaries are replaced. */
const dependencies = new Map<unknown, unknown>();
const pdf = { addPage: jest.fn(), addImage: jest.fn(), rect: jest.fn(), save: jest.fn(), setFillColor: jest.fn() };
jest.mock('@angular/core', () => ({
  Component: () => (target: unknown) => target, Injectable: () => (target: unknown) => target,
  ChangeDetectionStrategy: { Eager: 'Eager' }, DOCUMENT: 'document',
  inject: (token: unknown) => dependencies.get(token),
  input: Object.assign((value: unknown) => () => value, { required: () => () => undefined }),
  output: () => ({ emit: jest.fn() }),
}));
jest.mock('@angular/common', () => ({ CommonModule: class {} }));
jest.mock('@angular/forms', () => ({}));
jest.mock('@lucide/angular', () => ({}));
jest.mock('@app/core/services/analytics.service', () => ({ AnalyticsService: class {} }));
jest.mock('@app/shared/services/logger.service', () => ({ LoggerService: class {} }));
jest.mock('@app/shared/services/toast.service', () => ({ ToastService: class {} }));
jest.mock('@app/features/templates/template-classic/template-classic.component', () => ({ TemplateClassic: class {} }));
jest.mock('@app/features/templates/template-detail/template-detail.component', () => ({ TemplateDetail: class {} }));
jest.mock('@app/features/templates/template-side-by-side/template-side-by-side.component', () => ({ TemplateSideBySide: class {} }));
jest.mock('jspdf', () => ({ __esModule: true, default: jest.fn(() => pdf) }));
jest.mock('html2canvas-pro', () => ({ __esModule: true, default: jest.fn(async () => ({
  width: 1588, height: 1000, toDataURL: () => 'data:image/png;base64,c3ludGhldGlj',
  toBlob: (callback: BlobCallback) => callback(new Blob(['synthetic'])),
})) }));
import { DOCUMENT } from '@angular/core';
import * as ExcelJS from 'exceljs';
import { ExportControls } from './export-controls.component';
import { ExportService } from '../services/export.service';
import { AnalyticsService } from '@app/core/services/analytics.service';
import { LoggerService } from '@app/shared/services/logger.service';
import { ToastService } from '@app/shared/services/toast.service';

describe('export lifecycle is read-only', () => {
  it.each(['draft', 'sent', 'won', 'lost'])('%s stays unchanged after PDF, image and actual three Excel exporters', async (status) => {
    const value = { quotationId: 'q-export', quotationNumber: 'Q-EXPORT', businessVersion: 2, status,
      customerCompany: '合成客戶', quoterName: '合成報價者', quoterEmail: 'q@example.test', startDate: '2026-09-12',
      serviceItems: [{ item: 'synthetic', price: 100, count: 1, amount: 100 }],
      excludingTax: 100, tax: 5, includingTax: 105, isSign: false };
    const before = JSON.stringify(value);
    const toast = { error: jest.fn() };
    dependencies.set(DOCUMENT, document); dependencies.set(ToastService, toast);
    dependencies.set(AnalyticsService, { trackError: jest.fn(), trackExport: jest.fn() });
    dependencies.set(LoggerService, { log: jest.fn(), error: jest.fn() });
    dependencies.set(ExportService, new ExportService());
    const controls = new ExportControls();
    controls.form = (() => ({ valid: true, getRawValue: () => value,
      get: (key: keyof typeof value) => ({ value: value[key] }) })) as never;
    globalThis.requestAnimationFrame = (callback) => { callback(0); return 0; };
    Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:synthetic' });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const worksheets: ExcelJS.Worksheet[] = [];
    const original = ExcelJS.Workbook.prototype.addWorksheet;
    const sheetSpy = jest.spyOn(ExcelJS.Workbook.prototype, 'addWorksheet').mockImplementation(function(this: ExcelJS.Workbook, ...args) {
      const worksheet = original.apply(this, args); worksheets.push(worksheet); return worksheet;
    });
    try {
      for (const template of ['classic', 'full', 'invoice']) {
        controls.selectedTemplate = (() => template) as never;
        const element = document.createElement('section'); element.id = template;
        element.textContent = 'Q-EXPORT'; document.body.replaceChildren(element);
        jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({ width: 794, height: 500, top: 0, bottom: 500, left: 0, right: 794 } as DOMRect);
        await controls.onExportPDF(); expect(JSON.stringify(value)).toBe(before);
        await controls.onExportImage(); expect(JSON.stringify(value)).toBe(before);
        await controls.onExportExcel(); expect(JSON.stringify(value)).toBe(before);
      }
      expect(toast.error).not.toHaveBeenCalled();
      expect(worksheets).toHaveLength(3);
      for (const sheet of worksheets) {
        const cells: string[] = []; sheet.eachRow((row) => row.eachCell((cell) => cells.push(String(cell.value))));
        expect(cells.join(' ')).toContain('Q-EXPORT');
      }
    } finally { click.mockRestore(); sheetSpy.mockRestore(); document.body.replaceChildren(); }
  });
});
