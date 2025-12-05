import { Component, input, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  Crown,
  User,
  Mail,
  Calendar,
  Clock,
  Pencil,
  Check,
  X,
} from 'lucide-angular';

/**
 * 會員資料卡片元件
 * 職責：顯示使用者的個人資訊，可編輯顯示名稱
 */
@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './user-profile.component.html',
})
export class UserProfileComponent {
  // Inputs - 從父元件接收資料
  userDisplayName = input.required<string>();
  userEmail = input<string | null>(null);
  isPremium = input<boolean>(false);
  isAdmin = input<boolean>(false);
  formattedCreatedAt = input<string | null>(null);
  formattedPremiumUntil = input<string | null>(null);
  daysUntilExpiry = input<number | null>(null);
  showExpiryWarning = input<boolean>(false);

  // Outputs - 編輯事件
  displayNameChange = output<string>();

  // 編輯狀態
  isEditing = signal(false);
  editingName = signal('');

  // Icons
  readonly Crown = Crown;
  readonly User = User;
  readonly Mail = Mail;
  readonly Calendar = Calendar;
  readonly Clock = Clock;
  readonly Pencil = Pencil;
  readonly Check = Check;
  readonly X = X;

  /**
   * 開始編輯
   */
  startEditing(): void {
    this.editingName.set(this.userDisplayName());
    this.isEditing.set(true);
  }

  /**
   * 取消編輯
   */
  cancelEditing(): void {
    this.isEditing.set(false);
    this.editingName.set('');
  }

  /**
   * 保存編輯
   */
  saveEditing(): void {
    const newName = this.editingName().trim();
    if (newName && newName !== this.userDisplayName()) {
      this.displayNameChange.emit(newName);
    }
    this.isEditing.set(false);
  }
}
