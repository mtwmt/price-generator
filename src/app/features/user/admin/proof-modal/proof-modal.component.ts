import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * 憑證預覽 Modal 元件
 * 職責：顯示贊助憑證圖片的彈窗
 */
@Component({
  selector: 'app-proof-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './proof-modal.component.html',
})
export class ProofModalComponent {
  // Inputs
  isOpen = input<boolean>(false);
  proofUrl = input<string>('');
  title = input<string>('贊助憑證');

  // Outputs
  close = output<void>();

  /**
   * 關閉 Modal
   */
  onClose(): void {
    this.close.emit();
  }

  /**
   * 點擊背景關閉
   */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}
