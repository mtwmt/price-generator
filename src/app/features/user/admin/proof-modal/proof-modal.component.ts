import { Component, input, output, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DonationApiService } from '@app/core/services/donation-api.service';
import { LoggerService } from '@app/shared/services/logger.service';
import { environment } from 'src/environments/environment';
import { firstValueFrom } from 'rxjs';

/**
 * 憑證預覽 Modal 元件
 * 職責：顯示贊助憑證圖片的彈窗，支援簽章 URL 解析
 */
@Component({
  selector: 'app-proof-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './proof-modal.component.html',
})
export class ProofModalComponent {
  private readonly donationApi = inject(DonationApiService);
  private readonly logger = inject(LoggerService);

  isOpen = input<boolean>(false);
  proofKey = input<string>('');
  title = input<string>('贊助憑證');

  close = output<void>();

  resolvedUrl = signal<string>('');
  loading = signal<boolean>(false);
  errorMessage = signal<string>('');

  /** 追蹤當前請求的 key，防止競態條件 */
  private currentRequestKey = '';

  constructor() {
    effect(() => {
      const key = this.proofKey();
      const open = this.isOpen();

      // 重設狀態，確保切換使用者時不會殘留舊資料
      this.resolvedUrl.set('');
      this.errorMessage.set('');
      this.currentRequestKey = '';

      if (open && key) {
        if (key.startsWith('data:image')) {
          this.resolvedUrl.set(key);
        } else {
          this.loadSignedUrl(key);
        }
      }
    });
  }

  /** 重新載入當前憑證 */
  retry(): void {
    const key = this.proofKey();
    if (key && !key.startsWith('data:image')) {
      this.errorMessage.set('');
      this.loadSignedUrl(key);
    }
  }

  /** 圖片載入失敗（簽章 URL 已過期或 R2 檔案不存在） */
  onImageError(): void {
    this.resolvedUrl.set('');
    this.errorMessage.set('圖片載入失敗，簽章可能已過期');
  }

  private async loadSignedUrl(key: string): Promise<void> {
    this.currentRequestKey = key;
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const response = await firstValueFrom(
        this.donationApi.getProofSignedUrl(key),
      );

      // 競態保護：回應到達時確認仍為當前請求的 key
      if (this.currentRequestKey !== key) return;

      const baseUrl = `${environment.portalApiUrl}/api/portal/user`;
      this.resolvedUrl.set(`${baseUrl}${response.url}`);
    } catch (err: unknown) {
      if (this.currentRequestKey !== key) return;
      const msg = err instanceof Error ? err.message : '未知錯誤';
      this.logger.error('[ProofModal] Failed to load signed URL:', key, msg);
      this.resolvedUrl.set('');
      this.errorMessage.set(msg.includes('Token') ? '登入已過期，請重新登入' : `無法取得憑證（${msg}）`);
    } finally {
      if (this.currentRequestKey === key) {
        this.loading.set(false);
      }
    }
  }

  onClose(): void {
    this.currentRequestKey = '';
    this.resolvedUrl.set('');
    this.errorMessage.set('');
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}
