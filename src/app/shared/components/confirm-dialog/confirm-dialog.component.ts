import {
  Component,
  inject,
  ChangeDetectionStrategy,
  HostListener,
} from '@angular/core';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

/**
 * 確認對話框元件
 * 全域共用，搭配 ConfirmDialogService 使用
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (dialog.visible()) {
      <div
        class="modal modal-open"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div class="modal-box">
          <h3 id="confirm-dialog-title" class="text-lg font-bold">
            {{ dialog.title() }}
          </h3>
          <p class="py-4">{{ dialog.message() }}</p>
          <div class="modal-action">
            <button class="btn" (click)="dialog.onCancel()">
              {{ dialog.cancelText() }}
            </button>
            <button
              class="btn"
              [class.btn-primary]="dialog.confirmStyle() === 'primary'"
              [class.btn-error]="dialog.confirmStyle() === 'error'"
              [class.btn-warning]="dialog.confirmStyle() === 'warning'"
              (click)="dialog.onConfirm()"
            >
              {{ dialog.confirmText() }}
            </button>
          </div>
        </div>
        <div class="modal-backdrop" (click)="dialog.onCancel()"></div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  protected readonly dialog = inject(ConfirmDialogService);

  /** ESC 鍵關閉對話框 */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dialog.visible()) {
      this.dialog.onCancel();
    }
  }
}
