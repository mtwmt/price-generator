import { Injectable, Renderer2, RendererFactory2, inject } from '@angular/core';
import Litepicker from 'litepicker';

@Injectable({
  providedIn: 'root',
})
export class DatePickerService {
  private rendererFactory = inject(RendererFactory2);
  private renderer: Renderer2;

  constructor() {
    // 使用 RendererFactory2 手動建立 Renderer2 實例
    this.renderer = this.rendererFactory.createRenderer(null, null);
  }

  /**
   * 建立開始日期選擇器
   * @param element HTML 元素
   * @param onSelect 日期選擇後的回呼函數
   * @returns Litepicker 實例
   */
  createStartDatePicker(
    element: HTMLElement,
    onSelect: (date: string) => void
  ): Litepicker {
    const picker = new Litepicker({
      element: element,
      startDate: new Date(),
    });

    picker.on('selected', (date) => {
      onSelect(date.format('YYYY-MM-DD'));
    });

    return picker;
  }

  /**
   * 建立結束日期選擇器（包含重置按鈕）
   * @param element HTML 元素
   * @param onSelect 日期選擇後的回呼函數
   * @param onReset 重置按鈕點擊後的回呼函數
   * @returns Litepicker 實例
   */
  createEndDatePicker(
    element: HTMLElement,
    onSelect: (date: string) => void,
    onReset: () => void
  ): Litepicker {
    const picker = new Litepicker({
      element: element,
      lockDays: [[new Date(0), new Date()]],
      resetButton: () => {
        // 使用 renderer 建立元素，符合 Angular 最佳實踐
        const btn = this.renderer.createElement('a');
        this.renderer.addClass(btn, 'btn');
        this.renderer.addClass(btn, 'btn-primary');
        this.renderer.addClass(btn, 'btn-sm');
        this.renderer.setProperty(btn, 'innerText', '待確認');

        // 使用 renderer 監聽事件
        this.renderer.listen(btn, 'click', (evt) => {
          evt.preventDefault();
          onReset();
        });
        return btn;
      },
    });

    picker.on('selected', (date) => {
      onSelect(date.format('YYYY-MM-DD'));
    });

    return picker;
  }

  /**
   * 銷毀選擇器實例
   */
  destroy(picker: Litepicker | undefined): void {
    if (picker) {
      picker.destroy();
    }
  }
}
