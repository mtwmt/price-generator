/** @jest-environment jsdom */
jest.mock('@angular/core', () => {
  const signal = <T>(initial: T) => {
    let value = initial;
    const read = (() => value) as (() => T) & {
      set: (next: T) => void;
      update: (updater: (current: T) => T) => void;
    };
    read.set = (next) => { value = next; };
    read.update = (updater) => { value = updater(value); };
    return read;
  };
  const input = Object.assign(
    <T>(initial: T) => () => initial,
    { required: <T>() => () => undefined as T }
  );
  return {
    ChangeDetectionStrategy: { OnPush: 'OnPush' },
    Component: () => (target: unknown) => target,
    computed: <T>(compute: () => T) => compute,
    HostListener: () => () => undefined,
    input,
    output: () => ({ emit: jest.fn() }),
    signal,
  };
});
jest.mock('@lucide/angular', () => ({
  LucideChevronDown: class {}, LucideFilePlus: class {}, LucideHistory: class {},
  LucideSearch: class {}, LucideX: class {},
}), { virtual: true });

import { QuotationHistory } from './quotation-history.component';

describe('QuotationHistory 復原與舊資料認領互動', () => {
  it('只把有效且使用者逐筆勾選的 legacy 索引交給容器', () => {
    const component = new QuotationHistory();
    // input 在此最小單元測試中是空陣列；覆寫 read signal 模擬容器綁定。
    Object.defineProperty(component, 'legacyCandidates', {
      value: () => [{ customerCompany: 'A' }, { customerCompany: 'B' }],
    });

    component.toggleLegacyCandidate(1, true);
    component.toggleLegacyCandidate(0, true);
    component.toggleLegacyCandidate(1, false);
    component.claimSelectedLegacy();

    expect(component.claimLegacy.emit).toHaveBeenCalledWith([0]);
  });

  it('只把檔案交給 scope-aware 容器，不在子元件非同步讀取', () => {
    const component = new QuotationHistory();
    const input = document.createElement('input');
    const file = { text: jest.fn().mockResolvedValue('{broken backup') } as unknown as File;
    Object.defineProperty(input, 'files', { value: [file] });

    component.onRecoveryFileSelected({ target: input } as unknown as Event);

    expect(component.restoreRecovery.emit).toHaveBeenCalledWith(file);
    expect(file.text).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('下載按鈕以 Blob 與 download filename 下載，不把備份內容送出瀏覽器', () => {
    const component = new QuotationHistory();
    Object.defineProperty(component, 'recoveryBackup', {
      value: () => ({ fileName: 'quotation-recovery-backup.json', mimeType: 'application/json', content: '{raw}' }),
    });
    const createObjectURL = jest.fn().mockReturnValue('blob:synthetic-backup');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    component.downloadRecoveryBackup();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-backup');
    click.mockRestore();
  });
});
