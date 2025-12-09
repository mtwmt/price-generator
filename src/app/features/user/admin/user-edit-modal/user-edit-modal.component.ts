import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Timestamp } from 'firebase/firestore';
import {
  UserData,
  UserRole,
} from '@app/features/user/user.model';

/**
 * 使用者編輯表單元件
 * 職責：純表單元件，處理使用者角色和權限的編輯邏輯
 * 注意：不包含彈窗邏輯，由父元件處理
 */
@Component({
  selector: 'app-user-edit-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-edit-modal.component.html',
})
export class UserEditFormComponent {
  // Inputs
  user = input.required<UserData>();

  // Outputs
  save = output<{ role: UserRole; premiumUntil?: Timestamp | null }>();
  cancel = output<void>();

  // Form state
  selectedRole = signal<UserRole>('free');
  premiumUntilDate = signal<string>('');

  constructor() {
    // 當 user 變更時，初始化表單
    effect(() => {
      const userData = this.user();
      const quotationData = userData.platforms.quotation;

      this.selectedRole.set(quotationData?.role || 'free');

      if (quotationData?.premiumUntil) {
        const date = quotationData.premiumUntil.toDate();
        this.premiumUntilDate.set(date.toISOString().split('T')[0]);
      } else {
        this.premiumUntilDate.set('');
      }
    });
  }

  handleCancel() {
    this.cancel.emit();
  }

  handleSave() {
    const updates: { role: UserRole; premiumUntil?: Timestamp | null } = {
      role: this.selectedRole(),
    };

    // 如果是 premium，設定到期日
    if (this.selectedRole() === 'premium' && this.premiumUntilDate()) {
      updates.premiumUntil = Timestamp.fromDate(
        new Date(this.premiumUntilDate())
      );
    } else {
      updates.premiumUntil = null;
    }

    this.save.emit(updates);
  }
}
