/** @jest-environment jsdom */

const dependencies = new Map<unknown, unknown>();
const mockHtml2canvas = jest.fn();
const mockPdfInstance = {
  addPage: jest.fn(),
  addImage: jest.fn(),
  rect: jest.fn(),
  save: jest.fn(),
  setFillColor: jest.fn(),
};
const mockJsPdf = jest.fn(() => mockPdfInstance);
const mockWorksheet = {};
const mockWriteBuffer = jest.fn();
const mockWorkbook = {
  addWorksheet: jest.fn(() => mockWorksheet),
  xlsx: { writeBuffer: mockWriteBuffer },
};

// 只替換 Angular DI 外殼，仍以 new ExportService() 執行所有真實匯出程式。
jest.mock('@angular/core', () => ({
  Injectable: () => (target: unknown) => target,
  inject: (token: unknown) => dependencies.get(token),
}));
jest.mock('@app/core/services/analytics.service', () => ({
  AnalyticsService: class AnalyticsService {},
}));
jest.mock('@app/shared/services/logger.service', () => ({
  LoggerService: class LoggerService {},
}));
jest.mock('html2canvas-pro', () => ({
  __esModule: true,
  default: mockHtml2canvas,
}));
jest.mock('jspdf', () => ({
  __esModule: true,
  default: mockJsPdf,
}));
jest.mock('exceljs', () => ({
  Workbook: jest.fn(() => mockWorkbook),
}));

import { AnalyticsService } from '@app/core/services/analytics.service';
import { LoggerService } from '@app/shared/services/logger.service';
import { ExportService } from './export.service';

type ExportServiceInternals = {
  calculatePdfPageRanges: (
    height: number,
    blocks: Array<{ top: number; bottom: number }>,
    contentBottom?: number
  ) => Array<{ start: number; end: number }>;
  getPdfContentHeight: (container: HTMLElement) => number;
  getKeepTogetherBlocks: (container: HTMLElement) => Array<{ top: number; bottom: number }>;
};

function makeRect(width: number, height: number, top = 0): DOMRect {
  return {
    bottom: top + height,
    height,
    left: 0,
    right: width,
    top,
    width,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function makeCanvas(): HTMLCanvasElement {
  return {
    height: 3_000,
    toBlob: (callback: BlobCallback) => callback(new Blob(['synthetic'])),
    toDataURL: jest.fn(() => 'data:image/png;base64,synthetic'),
    width: 1_588,
  } as unknown as HTMLCanvasElement;
}

function createService() {
  const analytics = { trackError: jest.fn(), trackExport: jest.fn() };
  const logger = { error: jest.fn(), log: jest.fn() };
  dependencies.set(AnalyticsService, analytics);
  dependencies.set(LoggerService, logger);
  return { analytics, logger, service: new ExportService() };
}

function addQuotation(id: string, height = 1_500): HTMLElement {
  const quotation = document.createElement('section');
  quotation.id = id;
  quotation.dataset['pdfPadding'] = '1rem';
  quotation.style.width = '375px';
  quotation.style.padding = '0.5rem';
  quotation.style.border = '1px solid black';
  quotation.style.borderRadius = '0.5rem';
  quotation.style.boxShadow = '0 1px 2px black';
  const keepTogether = document.createElement('div');
  keepTogether.dataset['pdfKeepTogether'] = '';
  quotation.append(keepTogether, document.createElement('button'));
  document.body.append(quotation);

  jest.spyOn(quotation, 'getBoundingClientRect').mockImplementation(() =>
    makeRect(quotation.style.width === '794px' ? 794 : 375, height)
  );
  jest.spyOn(keepTogether, 'getBoundingClientRect').mockImplementation(() =>
    makeRect(794, 200, 1_100)
  );
  return quotation;
}

describe('ExportService', () => {
  let anchorClick: jest.SpyInstance;
  let originalUserAgent: PropertyDescriptor | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    dependencies.clear();
    document.body.replaceChildren();
    globalThis.requestAnimationFrame = (callback) => {
      callback(0);
      return 0;
    };
    anchorClick = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    originalUserAgent = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
    mockWriteBuffer.mockResolvedValue(new ArrayBuffer(8));
    mockHtml2canvas.mockResolvedValue(makeCanvas());
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true, value: jest.fn(() => []),
    });
  });

  afterEach(() => {
    anchorClick.mockRestore();
    if (originalUserAgent) {
      Object.defineProperty(navigator, 'userAgent', originalUserAgent);
    }
  });

  it('以固定 A4 viewport、padding 與無外框的同一版面量測、擷取並還原 UI', async () => {
    const { service } = createService();
    const quotation = addQuotation('synthetic-quotation');

    mockHtml2canvas.mockImplementation(async (element: HTMLElement, options) => {
      expect(element.style.width).toBe('794px');
      expect(element.style.padding).toBe('1rem');
      expect(element.style.borderWidth).toBe('0px');
      expect(element.style.borderRadius).toBe('0');
      expect(options.windowWidth).toBe(794);

      const clonedDoc = document.implementation.createHTMLDocument('PDF clone');
      const clonedQuotation = element.cloneNode(true) as HTMLElement;
      clonedDoc.body.append(clonedQuotation);
      options.onclone(clonedDoc);
      expect(clonedQuotation.querySelector('button')).toBeNull();
      expect(clonedQuotation.style.borderWidth).toBe('0px');
      expect(clonedQuotation.style.position).toBe('fixed');
      expect(clonedQuotation.style.left).toBe('0px');
      expect(clonedQuotation.style.top).toBe('0px');
      return makeCanvas();
    });

    await service.exportAsPDF('synthetic-quotation');

    expect(quotation.style.width).toBe('375px');
    expect(quotation.style.padding).toBe('0.5rem');
    expect(quotation.style.border).toBe('1px solid black');
    expect(quotation.style.borderRadius).toBe('0.5rem');
    expect(quotation.style.boxShadow).toBe('0 1px 2px black');
    expect(mockPdfInstance.addImage).toHaveBeenCalled();
    expect(mockPdfInstance.save).toHaveBeenCalledTimes(1);
    const masks = mockPdfInstance.rect.mock.calls.filter((call) => call[1] > 0);
    expect(masks.length).toBeGreaterThan(0);
    for (const mask of masks) {
      // Only the out-of-page end is extended; the content boundary is untouched.
      expect(mask[1] + mask[3]).toBeCloseTo(298, 8);
    }
  });

  it('讀取樣板內層的 PDF padding 標記，避免手機外層 #id 遺漏 md 版面', async () => {
    const { service } = createService();
    const quotation = addQuotation('nested-padding-quotation');
    delete quotation.dataset['pdfPadding'];
    const templateRoot = document.createElement('div');
    templateRoot.dataset['pdfPadding'] = '1.5rem';
    templateRoot.style.padding = '0.5rem';
    templateRoot.style.border = '1px solid black';
    templateRoot.style.borderRadius = '8px';
    templateRoot.style.boxShadow = '0 1px 2px black';
    quotation.append(templateRoot);

    mockHtml2canvas.mockImplementation(async (_element: HTMLElement) => {
      expect(templateRoot.style.padding).toBe('1.5rem');
      expect(templateRoot.style.borderWidth).toBe('0px');
      expect(templateRoot.style.boxShadow).toBe('none');
      return makeCanvas();
    });

    await service.exportAsPDF(quotation.id);

    expect(templateRoot.style.padding).toBe('0.5rem');
    expect(templateRoot.style.border).toBe('1px solid black');
    expect(templateRoot.style.borderRadius).toBe('8px');
    expect(templateRoot.style.boxShadow).toBe('0 1px 2px black');
  });

  it('不會在圖片、PDF 或 Excel 輸出時靜默上傳資料', async () => {
    const { analytics, service } = createService();
    const quotation = addQuotation('local-only-quotation');
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    const fetchMock = jest.fn();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fetchMock });
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:synthetic') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    const exporterExport = jest.fn();
    class SyntheticExporter {
      export = exporterExport;
    }

    try {
      await service.exportAsImage(quotation.id, '合成客戶');
      await service.exportAsPDF(quotation.id);
      await service.exportAsExcel({ customerCompany: '合成客戶' } as never, SyntheticExporter);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(analytics.trackExport).toHaveBeenCalledWith('image');
      expect(analytics.trackExport).toHaveBeenCalledWith('pdf');
      expect(analytics.trackExport).toHaveBeenCalledWith('excel');
      expect(exporterExport).toHaveBeenCalledWith(mockWorksheet, mockWorkbook, expect.anything(), '', '');
      expect(anchorClick).toHaveBeenCalledTimes(2);
    } finally {
      if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
      else Reflect.deleteProperty(globalThis, 'fetch');
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectUrl });
    }
  });

  it('PDF 失敗後可重試，且行動分享取消會安全改為本機下載', async () => {
    const { analytics, service } = createService();
    const quotation = addQuotation('retry-quotation');
    mockHtml2canvas
      .mockRejectedValueOnce(new Error('synthetic rendering error'))
      .mockResolvedValueOnce(makeCanvas())
      .mockResolvedValueOnce(makeCanvas());

    await expect(service.exportAsPDF(quotation.id)).rejects.toThrow('匯出 PDF 失敗，請重試');
    await expect(service.exportAsPDF(quotation.id)).resolves.toBeUndefined();
    expect(analytics.trackError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'pdf export failed' }),
      'export_pdf'
    );
    expect(analytics.trackExport).toHaveBeenCalledWith('pdf');

    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'iPhone' });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: jest.fn(() => true) });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: jest.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')),
    });
    await expect(service.exportAsImage(quotation.id, '合成客戶')).resolves.toBeUndefined();

    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(analytics.trackExport).toHaveBeenCalledWith('image');
  });

  it('遇到不可切割區塊會提早換頁，超過一頁的區塊仍持續前進', () => {
    const { service } = createService();
    const ranges = (service as unknown as ExportServiceInternals).calculatePdfPageRanges(1_000, [
      { top: 290, bottom: 350 },
      { top: 500, bottom: 1_000 },
    ]);

    expect(ranges[0]).toEqual({ start: 0, end: 290 });
    expect(ranges.every((range) => range.end > range.start)).toBe(true);
    expect(ranges.at(-1)?.end).toBe(1_000);
  });

  it('四頁後只有已量測的 root padding 時，不新增空白頁；少量真實尾文仍須保留', () => {
    const { service } = createService();
    const internal = service as unknown as ExportServiceInternals;
    const paddingOnly = internal.calculatePdfPageRanges(1180.5, [], 1174);
    expect(paddingOnly).toHaveLength(4);
    expect(paddingOnly.at(-1)).toEqual({ start: 885, end: 1180 });
    // A half-millimetre of real content may be sparse but cannot be discarded.
    const tinyFooter = internal.calculatePdfPageRanges(1180.5, [], 1180.5);
    expect(tinyFooter).toHaveLength(5);
    expect(tinyFooter.at(-1)?.end).toBe(1180.5);
  });

  it('巨大區塊與尾端 keep-together 文字各保留完整連續範圍且有界結束', () => {
    const { service } = createService();
    const internal = service as unknown as ExportServiceInternals;
    const ranges = internal.calculatePdfPageRanges(1200, [
      { top: 100, bottom: 1100 }, { top: 1170, bottom: 1190 },
    ], 1190);
    expect(ranges).toHaveLength(5);
    expect(ranges.at(-2)?.end).toBe(1170);
    expect(ranges.at(-1)).toEqual({ start: 1170, end: 1200 });
    ranges.forEach((range, index) => {
      expect(range.end).toBeGreaterThan(range.start);
      expect(range.end - range.start).toBeLessThanOrEqual(295);
      if (index > 0) expect(range.start).toBe(ranges[index - 1].end);
    });
  });

  it('長備註跨页時以實際文字行矩形提前換頁，不切開一行或小圖片', () => {
    const { service } = createService();
    const internal = service as unknown as ExportServiceInternals;
    const container = addQuotation('long-notes', 600);
    container.replaceChildren(document.createTextNode('LONG NOTES END'));
    jest.mocked(Range.prototype.getClientRects).mockReturnValue([
      makeRect(100, 12, 290), makeRect(100, 12, 305),
    ] as unknown as DOMRectList);
    const logo = document.createElement('img'); container.append(logo);
    jest.spyOn(logo, 'getBoundingClientRect').mockReturnValue(makeRect(40, 30, 560));
    const blocks = internal.getKeepTogetherBlocks(container);
    expect(blocks).toEqual(expect.arrayContaining([
      { top: 290, bottom: 302 }, { top: 305, bottom: 317 }, { top: 560, bottom: 590 },
    ]));
    const ranges = internal.calculatePdfPageRanges(600, blocks);
    expect(ranges[0].end).toBe(290);
    expect(ranges[1].end).toBe(560);
    expect(ranges.at(-1)?.end).toBe(600);
  });

  it('只排除標記 root 的尾端 padding，伸入 padding 的文字或圖片仍推進內容邊界', () => {
    const { service } = createService();
    const internal = service as unknown as ExportServiceInternals;
    const container = addQuotation('content-bottom', 1200);
    container.style.padding = '24px';
    expect(internal.getPdfContentHeight(container)).toBe(1200); // existing overflow block ends at 1300
    container.replaceChildren();
    expect(internal.getPdfContentHeight(container)).toBe(1176);
    const tinyFooter = document.createElement('span');
    tinyFooter.textContent = 'END';
    container.append(tinyFooter);
    jest.spyOn(tinyFooter, 'getBoundingClientRect').mockReturnValue(makeRect(15, 6, 1182));
    expect(internal.getPdfContentHeight(container)).toBe(1188);
    jest.mocked(Range.prototype.getClientRects).mockReturnValue([makeRect(15, 6, 1192)] as unknown as DOMRectList);
    expect(internal.getPdfContentHeight(container)).toBe(1198);
  });
});
