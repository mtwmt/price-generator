import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject,
  ElementRef,
  HostListener,
} from '@angular/core';
import { LucideChevronDown, LucideSearch, LucideX } from '@lucide/angular';

export interface SelectOption {
  readonly id: string;
  readonly name: string;
}

/**
 * DaisyUI 可搜尋下拉選單元件
 * 外觀為標準 select，展開後頂部內建搜尋框，支援即時過濾
 */
@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [LucideChevronDown, LucideSearch, LucideX],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-w-0',
  },
  template: `
    <details
      #detailsRef
      class="dropdown w-full min-w-0"
      [attr.id]="selectId()"
      (toggle)="onToggle($event)"
    >
      <summary
        class="input input-sm w-full flex items-center justify-between font-normal cursor-pointer list-none bg-base-100 border border-base-300 min-w-0 px-2.5 hover:border-base-content/40 transition-colors"
        [class.rounded-r-none]="joinItem()"
        [attr.aria-label]="ariaLabel() || placeholder()"
      >
        <span class="truncate" [class.text-base-content/50]="!selectedOption()">
          {{ selectedOption()?.name || placeholder() }}
        </span>
        <svg lucideChevronDown [size]="14" class="shrink-0 opacity-60 ml-1.5" />
      </summary>

      <div
        class="dropdown-content bg-base-100 rounded-box z-50 w-full min-w-[14rem] p-2 shadow-lg border border-base-200 mt-1"
      >
        <label
          class="input input-xs flex items-center gap-1.5 w-full bg-base-200/60 mb-1.5 rounded"
        >
          <svg lucideSearch [size]="14" class="opacity-60 shrink-0" />
          <input
            #searchBox
            type="search"
            class="grow min-w-0"
            [placeholder]="searchPlaceholder()"
            [value]="searchKeyword()"
            (input)="onSearchInput($event)"
            (keydown.enter)="$event.preventDefault()"
          />
          @if (searchKeyword()) {
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-circle h-4 w-4 min-h-0"
              (click)="clearSearch($event)"
            >
              <svg lucideX [size]="12" />
            </button>
          }
        </label>

        <ul class="menu menu-xs max-h-48 overflow-y-auto flex-col gap-0.5 p-0">
          <li>
            <button
              type="button"
              class="py-1.5 text-base-content/60"
              [class.active]="!selectedId()"
              (click)="onSelect('', detailsRef)"
            >
              {{ placeholder() }}
            </button>
          </li>
          @for (item of filteredOptions(); track item.id) {
            <li>
              <button
                type="button"
                class="py-1.5 truncate text-left"
                [class.active]="item.id === selectedId()"
                (click)="onSelect(item.id, detailsRef)"
              >
                {{ item.name }}
              </button>
            </li>
          }
          @if (filteredOptions().length === 0) {
            <li class="disabled">
              <span class="text-xs text-base-content/50 py-2"
                >無符合的項目</span
              >
            </li>
          }
        </ul>
      </div>
    </details>
  `,
  styles: [
    `
      details summary::-webkit-details-marker {
        display: none;
      }
    `,
  ],
})
export class SearchableSelectComponent {
  readonly options = input<readonly SelectOption[]>([]);
  readonly selectedId = input<string>('');
  readonly placeholder = input<string>('請選擇');
  readonly searchPlaceholder = input<string>('搜尋...');
  readonly ariaLabel = input<string>('');
  readonly selectId = input<string>('');
  readonly joinItem = input<boolean>(false);

  readonly selectionChange = output<string>();

  readonly searchKeyword = signal('');

  private readonly elementRef = inject(ElementRef);

  readonly selectedOption = computed(
    () =>
      this.options().find((o: SelectOption) => o.id === this.selectedId()) ??
      null
  );

  readonly filteredOptions = computed(() => {
    const kw = this.searchKeyword().toLowerCase().trim();
    if (!kw) return this.options();
    return this.options().filter((o: SelectOption) =>
      o.name.toLowerCase().includes(kw)
    );
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      const details =
        this.elementRef.nativeElement.querySelector('details');
      if (details) details.open = false;
    }
  }

  onToggle(event: Event): void {
    const details = event.target as HTMLDetailsElement;
    if (details.open) {
      setTimeout(() => {
        const input = this.elementRef.nativeElement.querySelector(
          'input[type="search"]'
        ) as HTMLInputElement;
        input?.focus();
      }, 50);
    }
  }

  onSearchInput(event: Event): void {
    this.searchKeyword.set((event.target as HTMLInputElement).value);
  }

  clearSearch(event: MouseEvent): void {
    event.stopPropagation();
    this.searchKeyword.set('');
  }

  onSelect(id: string, details: HTMLDetailsElement): void {
    details.open = false;
    this.searchKeyword.set('');
    this.selectionChange.emit(id);
  }
}
