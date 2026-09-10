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

function firstClassTokens(template: string): Set<string> {
  const tagStart = template.indexOf('<div');
  const tagEnd = template.indexOf('>', tagStart);
  const classAttribute = template
    .slice(tagStart, tagEnd)
    .match(/class="([^"]+)"/);

  return new Set(classAttribute?.[1].split(/\s+/) ?? []);
}

function classTokensAfter(template: string, marker: string): Set<string> {
  const markerIndex = template.indexOf(marker);
  const tagStart = template.indexOf('<div', markerIndex);
  const tagEnd = template.indexOf('>', tagStart);
  const classAttribute = template
    .slice(tagStart, tagEnd)
    .match(/class="([^"]+)"/);

  return new Set(classAttribute?.[1].split(/\s+/) ?? []);
}

describe('報價單窄螢幕版面結構', () => {
  it('服務項目的類別與項目在手機保持並排', () => {
    const template = readTemplate(
      '../service-item-control/service-item-control.component.html'
    );
    const outer = firstClassTokens(template);
    const categoryAndItem = classTokensAfter(template, '<!-- 第一行');
    const pricing = classTokensAfter(template, '<!-- 第二行');

    expect([...outer]).toEqual(expect.not.arrayContaining(['flex-col']));
    expect([...outer]).toEqual(expect.arrayContaining(['flex', 'flex-wrap']));
    expect([...categoryAndItem]).toEqual(
      expect.arrayContaining(['flex', 'w-full', 'min-w-0', 'md:w-3/7'])
    );
    expect([...pricing]).toEqual(
      expect.arrayContaining(['flex', 'w-full', 'min-w-0', 'md:w-4/7'])
    );
    expect(template).not.toContain('grid-cols-2');
    expect(
      template.match(/class="fieldset min-w-0 flex-1 max-w-16"/g)
    ).toHaveLength(2);
    expect(template.match(/flex-\[2_1_0%\]/g)).toHaveLength(2);
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

  it('手機預覽的關閉列固定在安全區內，預覽內容獨立捲動', () => {
    const template = readTemplate('./quotation-generator.component.html');

    expect(template).toContain('h-[100dvh] max-h-[100dvh]');
    expect(template).toContain(
      'sticky top-0 z-50 flex shrink-0 items-center justify-between'
    );
    expect(template).toContain(
      'pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2'
    );
    expect(template).toContain(
      'min-h-0 flex-1 overflow-y-auto overscroll-contain'
    );
    expect(template).toContain('aria-label="關閉預覽"');
  });

  it('基本資料工具列在窄螢幕分行，避免登入後的同步狀態撐寬頁面', () => {
    const template = readTemplate('./quotation-generator.component.html');

    expect(template).toContain(
      'class="flex min-w-0 flex-wrap items-center gap-3 border-b border-base-200 pb-3"'
    );
    expect(template).toContain(
      'hasHistory() || cloudEligible() || hasLocalHistoryToSync()'
    );
    expect(template).toContain(
      'class="flex w-full min-w-0 max-w-full flex-wrap items-center gap-2 lg:ml-auto lg:w-auto"'
    );
    expect(template).toContain(
      'class="flex w-full min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1 empty:hidden lg:w-auto"'
    );
    expect(template).toContain('class="min-w-0 max-w-full flex-1"');
    expect(template).not.toContain('sm:shrink-0 sm:flex-nowrap');
  });

  it('雲端同步狀態本身允許縮小與換行', () => {
    const template = readTemplate(
      '../cloud/cloud-sync-status/cloud-sync-status.component.html'
    );

    expect(template).toContain(
      'flex min-w-0 max-w-full flex-wrap items-center'
    );
    expect(template).toContain('min-w-0 break-words text-xs text-error');
  });

  it('promo 浮窗只在桌面顯示，避免覆蓋手機表單', () => {
    const template = readTemplate(
      '../../../shared/components/promo-float/promo-float.component.html'
    );

    expect(template).toContain(
      'fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 animate-slide-up lg:block'
    );
  });

  it('歷史記錄列限制在清單寬度內，讓長名稱截斷並保留刪除按鈕', () => {
    const template = readTemplate(
      './quotation-history/quotation-history.component.html'
    );
    const row = classTokensAfter(template, '@for (entry');

    expect([...row]).toEqual(
      expect.arrayContaining(['flex', 'w-full', 'min-w-0'])
    );
    expect(template).toContain('class="min-w-0 flex-1 text-left"');
    expect(template).toContain('class="block truncate font-semibold"');
    expect(template).toContain('btn-circle flex-shrink-0');
    expect(template).toContain('[title]');
  });
});
