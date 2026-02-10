import { Component, input, output, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DonationApiService } from '@app/core/services/donation-api.service';
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

  isOpen = input<boolean>(false);
  proofKey = input<string>('');
  title = input<string>('贊助憑證');

  close = output<void>();

  resolvedUrl = signal<string>('');
  loading = signal<boolean>(false);

  constructor() {
    effect(() => {
      const key = this.proofKey();
      const open = this.isOpen();

      if (open && key) {
        if (key.startsWith('data:image')) {
          this.resolvedUrl.set(key);
        } else {
          this.loadSignedUrl(key);
        }
      }
    });
  }

  private async loadSignedUrl(key: string): Promise<void> {
    this.loading.set(true);
    try {
      const response = await firstValueFrom(
        this.donationApi.getProofSignedUrl(key),
      );
      const baseUrl = `${environment.portalApiUrl}/api/portal/user`;
      this.resolvedUrl.set(`${baseUrl}${response.url}`);
    } catch {
      console.error('[ProofModal] Failed to load signed URL');
      this.resolvedUrl.set('');
    } finally {
      this.loading.set(false);
    }
  }

  onClose(): void {
    this.resolvedUrl.set('');
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}
