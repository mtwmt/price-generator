import { Component, input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  MapPin,
  Phone,
  Mail,
  User,
  ReceiptText,
  UserRound
} from 'lucide-angular';

/**
 * 完整版報價單渲染器
 * 純內容渲染，無匯出按鈕
 */
@Component({
  selector: 'app-renderer-full',
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './renderer-full.html',
  standalone: true,
})
export class RendererFull {
  // Lucide Icons
  readonly MapPin = MapPin;
  readonly Phone = Phone;
  readonly Mail = Mail;
  readonly User = User;
  readonly ReceiptText = ReceiptText;
  readonly UserRound = UserRound;

  // 接收表單資料
  form = input.required<FormGroup>();
  quoterLogo = input<string>('');
  customerLogo = input<string>('');
  stamp = input<string>('');

  // 取得服務項目 FormArray
  get serviceItems() {
    return this.form().get('serviceItems') as any;
  }
}
