import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Router,
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { CommentsComponent } from '@app/features/comments/comments.component';
import { DonateComponent } from '@app/shared/components/donate/donate.component';
import { AnalyticsService } from '@app/core/services/analytics.service';
import {
  LucideAngularModule,
  LogIn,
  LogOut,
  Check,
  X,
  FileText,
  MessageSquareQuote,
  Crown,
} from 'lucide-angular';
import { AuthService } from '@app/core/services/auth.service';
import { ToastService } from '@app/shared/services/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CommentsComponent,
    DonateComponent,
    LucideAngularModule,
  ],
  templateUrl: './app.component.html',
})
export class AppComponent {
  private analytics = inject(AnalyticsService);
  private router = inject(Router);
  readonly authService = inject(AuthService);
  readonly toastService = inject(ToastService);

  readonly currentYear = new Date().getFullYear();

  // Lucide Icons
  readonly LogIn = LogIn;
  readonly LogOut = LogOut;
  readonly Check = Check;
  readonly X = X;
  readonly FileText = FileText;
  readonly MessageSquareQuote = MessageSquareQuote;
  readonly Crown = Crown;

  /**
   * 導航至指定分頁
   */
  navigateToTab(tab: 'quotation' | 'changelog' | 'member') {
    this.router.navigate([`/${tab}`]);
    this.analytics.trackTabChange(tab);
  }

  /**
   * 使用 Google 登入
   */
  async loginWithGoogle(): Promise<void> {
    try {
      await this.authService.loginWithGoogle();
      this.toastService.success('登入成功');
    } catch (error: any) {
      console.error('Login error:', error);

      // 處理常見錯誤
      if (error.code === 'auth/popup-closed-by-user') {
        this.toastService.info('登入已取消');
      } else if (error.code === 'auth/popup-blocked') {
        this.toastService.warning('彈出視窗被封鎖，請允許彈出視窗後重試');
      } else {
        this.toastService.error('登入失敗，請稍後再試');
      }
    }
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    try {
      await this.authService.logout();
      this.toastService.info('已登出');
    } catch (error) {
      console.error('Logout error:', error);
      this.toastService.error('登出失敗');
    }
  }

  /**
   * 取得當前路徑作為 discussionId
   */
  getCurrentPath(): string {
    return this.router.url || '/';
  }
}
