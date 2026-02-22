import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmStyle?: 'primary' | 'error' | 'warning';
}

/**
 * 確認對話框服務
 * 提供全域的確認對話框功能，取代原生 window.confirm()
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  readonly visible = signal(false);
  readonly title = signal('');
  readonly message = signal('');
  readonly confirmText = signal('確認');
  readonly cancelText = signal('取消');
  readonly confirmStyle = signal<'primary' | 'error' | 'warning'>('primary');

  private resolveRef: ((value: boolean) => void) | null = null;

  /**
   * 顯示確認對話框，回傳 Promise<boolean>
   */
  confirm(options: ConfirmOptions): Promise<boolean> {
    this.title.set(options.title);
    this.message.set(options.message);
    this.confirmText.set(options.confirmText ?? '確認');
    this.cancelText.set(options.cancelText ?? '取消');
    this.confirmStyle.set(options.confirmStyle ?? 'primary');
    this.visible.set(true);
    return new Promise<boolean>((resolve) => {
      this.resolveRef = resolve;
    });
  }

  /** 使用者點擊確認 */
  onConfirm(): void {
    this.visible.set(false);
    this.resolveRef?.(true);
    this.resolveRef = null;
  }

  /** 使用者點擊取消 */
  onCancel(): void {
    this.visible.set(false);
    this.resolveRef?.(false);
    this.resolveRef = null;
  }
}
