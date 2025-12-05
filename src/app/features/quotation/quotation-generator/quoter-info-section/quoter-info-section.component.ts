import {
  Component,
  input,
  output,
  viewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  MessageSquareQuote,
  UserRound,
  ReceiptText,
  Mail,
  Phone,
  MapPin,
  Calendar1,
} from 'lucide-angular';
import { FileUpload } from '@app/shared/components/file-upload/file-upload';

/**
 * 報價人員資料區塊元件
 * 包含報價人員基本資料、進階資料（收合式）、和日期選擇器
 */
@Component({
  selector: 'app-quoter-info-section',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, FileUpload],
  templateUrl: './quoter-info-section.component.html',
})
export class QuoterInfoSection implements AfterViewInit, OnDestroy {
  // Icons
  readonly MessageSquareQuote = MessageSquareQuote;
  readonly UserRound = UserRound;
  readonly ReceiptText = ReceiptText;
  readonly Mail = Mail;
  readonly Phone = Phone;
  readonly MapPin = MapPin;
  readonly Calendar1 = Calendar1;

  // Inputs
  readonly form = input.required<FormGroup>();
  readonly quoterLogo = input<string>('');
  readonly stamp = input<string>('');

  // Outputs
  readonly quoterLogoChange = output<FileList>();
  readonly quoterLogoRemove = output<void>();
  readonly stampChange = output<FileList>();
  readonly stampRemove = output<void>();
  readonly datePickersReady = output<{
    startDateEl: ElementRef<HTMLInputElement>;
    endDateEl: ElementRef<HTMLInputElement>;
  }>();

  // View Children
  readonly startDateInput =
    viewChild<ElementRef<HTMLInputElement>>('startDate');
  readonly endDateInput = viewChild<ElementRef<HTMLInputElement>>('endDate');

  ngAfterViewInit(): void {
    // Emit the date picker elements to parent for Litepicker initialization
    const startDateEl = this.startDateInput();
    const endDateEl = this.endDateInput();

    if (startDateEl && endDateEl) {
      this.datePickersReady.emit({
        startDateEl,
        endDateEl,
      });
    }
  }

  ngOnDestroy(): void {
    // Cleanup will be handled by parent component
  }

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
