import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  LucideMail,
  LucideMapPin,
  LucideMessageSquareQuote,
  LucidePhone,
  LucideReceiptText,
  LucideUserRound,
} from '@lucide/angular';
import { FileUpload } from '@app/shared/components/file-upload/file-upload';

/**
 * 報價人員資料區塊元件
 * 包含報價人員基本資料與進階資料（收合式）
 */
@Component({
  selector: 'app-quoter-info-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FileUpload,
    LucideMail,
    LucideMapPin,
    LucideMessageSquareQuote,
    LucidePhone,
    LucideReceiptText,
    LucideUserRound,
  ],
  templateUrl: './quoter-info-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoterInfoSection {
  // Inputs
  readonly form = input.required<FormGroup>();
  readonly quoterLogo = input<string>('');
  readonly stamp = input<string>('');

  // Outputs
  readonly quoterLogoChange = output<FileList>();
  readonly quoterLogoRemove = output<void>();
  readonly stampChange = output<FileList>();
  readonly stampRemove = output<void>();
  /**
   * 報價人員 LOGO 變更處理
   */
  onQuoterLogoChange(files: FileList): void {
    this.quoterLogoChange.emit(files);
  }

  /**
   * 報價人員 LOGO 移除處理
   */
  onQuoterLogoRemove(): void {
    this.quoterLogoRemove.emit();
  }

  /**
   * 印章變更處理
   */
  onStampChange(files: FileList): void {
    this.stampChange.emit(files);
  }

  /**
   * 印章移除處理
   */
  onStampRemove(): void {
    this.stampRemove.emit();
  }
}
