import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

/**
 * Toast 通知服務
 * 提供全域的 Toast 訊息顯示功能
 */
@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly DEFAULT_DURATION_MS = 3000;

  // Signal: Toast 顯示狀態
  readonly visible = signal<boolean>(false);

  // Signal: Toast 訊息內容
  readonly message = signal<string>('');

  // Signal: Toast 類型
  readonly type = signal<'success' | 'error' | 'info' | 'warning'>('success');

  private timeoutId?: number;

  /**
   * 顯示成功訊息
   */
  success(message: string = '操作成功', duration?: number): void {
    this.show(message, 'success', duration);
  }

  /**
   * 顯示錯誤訊息
   */
  error(message: string = '操作失敗', duration?: number): void {
    this.show(message, 'error', duration);
  }

  /**
   * 顯示資訊訊息
   */
  info(message: string, duration?: number): void {
    this.show(message, 'info', duration);
  }

  /**
   * 顯示警告訊息
   */
  warning(message: string, duration?: number): void {
    this.show(message, 'warning', duration);
  }

  /**
   * 顯示 Toast 訊息
   */
  private show(
    message: string,
    type: 'success' | 'error' | 'info' | 'warning',
    duration?: number
  ): void {
    // 清除之前的 timeout
    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId);
    }

    // 設定訊息內容
    this.message.set(message);
    this.type.set(type);
    this.visible.set(true);

    // 自動隱藏
    const displayDuration = duration ?? this.DEFAULT_DURATION_MS;
    this.timeoutId = window.setTimeout(() => {
      this.hide();
    }, displayDuration);
  }

  /**
   * 隱藏 Toast
   */
  hide(): void {
    this.visible.set(false);
    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }
}
