declare const require: (moduleName: string) => unknown;
declare const __dirname: string;

const { readFileSync } = require('fs') as {
  readFileSync: (path: string, encoding: string) => string;
};
const { resolve } = require('path') as {
  resolve: (...paths: string[]) => string;
};

function readTemplate(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), 'utf8');
}

describe('報價單窄螢幕版面結構', () => {
  it('服務項目的類別與項目在手機垂直堆疊，sm 以上恢復橫向', () => {
    const template = readTemplate(
      '../service-item-control/service-item-control.component.html'
    );

    expect(template).toContain(
      'flex w-full min-w-0 flex-col gap-2 sm:flex-row md:w-3/7'
    );
    expect(template).toContain(
      'grid w-full min-w-0 grid-cols-2 gap-2 md:flex md:w-4/7 md:flex-nowrap'
    );
  });

  it('拖曳把手保持固定寬度，不壓縮服務項目欄位', () => {
    const template = readTemplate(
      './service-items-section/service-items-section.component.html'
    );

    expect(template).toContain('w-5 shrink-0 cursor-move');
    expect(template).toContain('flex min-w-0 items-start gap-2');
  });

  it('sticky 操作列保留手機安全區與底部捲動避讓空間', () => {
    const template = readTemplate('./quotation-generator.component.html');

    expect(template).toContain(
      'pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0'
    );
    expect(template).toContain(
      'p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:p-4'
    );
  });

  it('基本資料標題列在窄螢幕可換行，避免歷史按鈕造成水平溢出', () => {
    const template = readTemplate('./quotation-generator.component.html');

    expect(template).toContain(
      'class="flex flex-wrap items-center gap-3 border-b border-base-200 pb-3"'
    );
  });

  it('promo 浮窗只在桌面顯示，避免覆蓋手機表單', () => {
    const template = readTemplate(
      '../../../shared/components/promo-float/promo-float.component.html'
    );

    expect(template).toContain(
      'fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 animate-slide-up lg:block'
    );
  });
});
