import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  LucideBuilding2,
  LucideMail,
  LucideMapPin,
  LucidePhone,
  LucideReceiptText,
  LucideUserRound,
  LucideUsers,
} from '@lucide/angular';
import { FileUpload } from '@app/shared/components/file-upload/file-upload';

/**
 * 客戶資料區塊元件
 * 包含客戶基本資料和進階資料（收合式）
 */
@Component({
  selector: 'app-customer-info-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FileUpload,
    LucideBuilding2,
    LucideMail,
    LucideMapPin,
    LucidePhone,
    LucideReceiptText,
    LucideUserRound,
    LucideUsers,
  ],
  templateUrl: './customer-info-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerInfoSection {
  // Inputs
  readonly form = input.required<FormGroup>();
  readonly customerLogo = input<string>('');

  // Outputs
  readonly logoChange = output<FileList>();
  readonly logoRemove = output<void>();

  /**
   * LOGO 變更處理
   */
  onLogoChange(files: FileList): void {
    this.logoChange.emit(files);
  }

  /**
   * LOGO 移除處理
   */
  onLogoRemove(): void {
    this.logoRemove.emit();
  }
}
