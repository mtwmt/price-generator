import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Crown, Upload } from 'lucide-angular';
import { FileUpload } from '@app/shared/components/file-upload/file-upload';
import { ToastService } from '@app/shared/services/toast.service';

/**
 * 贊助申請表單元件
 * 職責：處理贊助憑證上傳和表單提交
 */
@Component({
  selector: 'app-donation-form',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, FileUpload],
  templateUrl: './donation-form.component.html',
})
export class DonationFormComponent {
  private readonly toastService = inject(ToastService);

  // Outputs - 通知父元件
  submitDonation = output<{ proof: string; note: string }>();

  // 內部狀態
  donationProof = signal<string | null>(null);
  donationNote = signal<string>('');

  // Icons
  readonly Crown = Crown;
  readonly Upload = Upload;

  /**
   * 處理贊助憑證上傳
   */
  handleDonationProof(files: FileList): void {
    if (files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result as string;
      this.donationProof.set(base64);
    };

    reader.onerror = () => {
      this.toastService.error('檔案讀取失敗，請重試');
    };

    reader.readAsDataURL(file);
  }

  /**
   * 提交贊助申請
   */
  onSubmit(): void {
    if (!this.donationProof()) {
      this.toastService.error('請先上傳贊助憑證');
      return;
    }

    // 發送事件給父元件處理
    this.submitDonation.emit({
      proof: this.donationProof()!,
      note: this.donationNote(),
    });

    // 清空表單
    this.donationProof.set(null);
    this.donationNote.set('');
  }
}
