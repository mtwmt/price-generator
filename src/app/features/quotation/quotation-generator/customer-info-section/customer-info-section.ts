import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  Users,
  Building2,
  ReceiptText,
  UserRound,
  Phone,
  Mail,
  MapPin,
} from 'lucide-angular';
import { FileUpload } from '@app/shared/components/file-upload/file-upload';

/**
 * 客戶資料區塊元件
 * 包含客戶基本資料和進階資料（收合式）
 */
@Component({
  selector: 'app-customer-info-section',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, FileUpload],
  templateUrl: './customer-info-section.html',
})
export class CustomerInfoSection {
  // Icons
  readonly Users = Users;
  readonly Building2 = Building2;
  readonly ReceiptText = ReceiptText;
  readonly UserRound = UserRound;
  readonly Phone = Phone;
  readonly Mail = Mail;
  readonly MapPin = MapPin;

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
