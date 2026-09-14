/** @jest-environment jsdom */
jest.mock('@angular/core', () => {
  const signal = <T>(initial: T) => {
    let value = initial;
    const getter = () => value;
    getter.set = (next: T) => {
      value = next;
    };
    return getter;
  };
  return {
    ChangeDetectionStrategy: { OnPush: 'OnPush' },
    Component: () => (target: unknown) => target,
    ElementRef: class {
      nativeElement = document.createElement('div');
    },
    HostListener: () => () => {},
    computed: <T>(compute: () => T) => compute,
    inject: () => ({ nativeElement: document.createElement('div') }),
    input: <T>(initial: T) => () => initial,
    output: () => ({ emit: jest.fn() }),
    signal,
  };
});

jest.mock('@lucide/angular', () => ({
  LucideChevronDown: class {},
  LucideSearch: class {},
  LucideX: class {},
}), { virtual: true });

import { SearchableSelectComponent } from './searchable-select.component';

describe('SearchableSelectComponent', () => {
  it('搜尋關鍵字與清除邏輯正常運作', () => {
    const comp = new SearchableSelectComponent();
    expect(comp.searchKeyword()).toBe('');

    comp.onSearchInput({ target: { value: '服務項目' } } as unknown as Event);
    expect(comp.searchKeyword()).toBe('服務項目');

    const stopPropagation = jest.fn();
    comp.clearSearch({ stopPropagation } as unknown as MouseEvent);
    expect(stopPropagation).toHaveBeenCalled();
    expect(comp.searchKeyword()).toBe('');
  });

  it('選取項目時收合下拉並重設搜尋關鍵字', () => {
    const comp = new SearchableSelectComponent();
    const details = document.createElement('details');
    details.open = true;
    const emitSpy = jest.spyOn(comp.selectionChange, 'emit');

    comp.onSelect('item-123', details);

    expect(details.open).toBe(false);
    expect(comp.searchKeyword()).toBe('');
    expect(emitSpy).toHaveBeenCalledWith('item-123');
  });

  it('預設非 join-item', () => {
    const comp = new SearchableSelectComponent();
    expect(comp.joinItem()).toBe(false);
  });
});

