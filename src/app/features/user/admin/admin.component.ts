import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideShield } from '@lucide/angular';
import { AuthService } from '@app/core/services/auth.service';
import { UserListComponent } from './user-list/user-list.component';

/**
 * 管理員控制台元件
 * 職責：管理員頁面的容器
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, LucideShield, UserListComponent],
  templateUrl: './admin.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent {
  readonly authService = inject(AuthService);
}
