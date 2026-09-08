import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
} from '@angular/core';

import {
  Router,
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { CommentsComponent } from '@app/features/comments/comments.component';
import { DonateComponent } from '@app/shared/components/donate/donate.component';
import { PromoFloatComponent } from '@app/shared/components/promo-float/promo-float.component';
import { ConfirmDialogComponent } from '@app/shared/components/confirm-dialog/confirm-dialog.component';
import { AnalyticsService } from '@app/core/services/analytics.service';
import {
  LucideCheck,
  LucideCrown,
  LucideFileText,
  LucideLogIn,
  LucideLogOut,
  LucideMessageSquareQuote,
  LucideX,
} from '@lucide/angular';
import { AuthService } from '@app/core/services/auth.service';
import { CloudQuotationSyncService } from '@app/features/quotation/cloud/cloud-quotation-sync.service';
import { ToastService } from '@app/shared/services/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CommentsComponent,
    DonateComponent,
    PromoFloatComponent,
    LucideCheck,
    LucideCrown,
    LucideFileText,
    LucideLogIn,
    LucideLogOut,
    LucideMessageSquareQuote,
    LucideX,
    ConfirmDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './app.component.html',
})
export class AppComponent {
  private analytics = inject(AnalyticsService);
  private router = inject(Router);
  private cloudQuotationSync = inject(CloudQuotationSyncService);
  readonly authService = inject(AuthService);
  readonly toastService = inject(ToastService);

  readonly currentYear = new Date().getFullYear();

  private authStateEffect = effect(() => {
    if (!this.authService.currentUser()) {
      this.cloudQuotationSync.disconnect();
    }
  });

  /**
   * 登入
   */
  loginWithGoogle(): void {
    this.authService.loginWithGoogle();
  }

  /**
   * 導航至指定分頁
   */
  navigateToTab(tab: 'quotation' | 'changelog' | 'member') {
    this.router.navigate([`/${tab}`]);
    this.analytics.trackTabChange(tab);
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    this.cloudQuotationSync.disconnect();
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
