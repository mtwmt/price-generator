import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  Crown,
  User,
  Mail,
  Calendar,
  Clock,
} from 'lucide-angular';

/**
 * 會員資料卡片元件
 * 職責：純展示元件，顯示使用者的個人資訊
 */
@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './user-profile.component.html',
})
export class UserProfileComponent {
  // Inputs - 從父元件接收資料
  userDisplayName = input.required<string>();
  userEmail = input<string | null>(null);
  isPremium = input<boolean>(false);
  isAdmin = input<boolean>(false);
  formattedCreatedTime = input<string | null>(null);
  formattedPremiumUntil = input<string | null>(null);
  daysUntilExpiry = input<number | null>(null);

  // Icons
  readonly Crown = Crown;
  readonly User = User;
  readonly Mail = Mail;
  readonly Calendar = Calendar;
  readonly Clock = Clock;
}
