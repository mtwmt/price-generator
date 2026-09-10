import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { GOOGLE_ID_TOKEN_LOGIN_ENABLED } from '@app/core/config/auth.config';
import { AuthService } from '@app/core/services/auth.service';

/**
 * Google 登入入口：新 API 未上線時保留既有 OAuth 授權碼登入；啟用後改由 GIS 官方按鈕提供 ID token。
 */
@Component({
  selector: 'app-google-sign-in',
  standalone: true,
  templateUrl: './google-sign-in.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoogleSignInComponent implements AfterViewInit, OnDestroy {
  readonly legacyButtonClass = input('btn btn-primary');
  readonly legacyLabel = input('登入');
  readonly legacyLabelClass = input('');
  readonly googleButton = viewChild<ElementRef<HTMLDivElement>>('googleButton');
  readonly loadError = signal(false);

  readonly idTokenLoginEnabled = inject(GOOGLE_ID_TOKEN_LOGIN_ENABLED);
  private readonly authService = inject(AuthService);

  ngAfterViewInit(): void {
    if (this.idTokenLoginEnabled) void this.renderOfficialButton();
  }

  ngOnDestroy(): void {
    // GIS 按鈕由 Google 管理；元件銷毀時僅清空容器，避免殘留 DOM。
    this.googleButton()?.nativeElement.replaceChildren();
  }

  loginWithLegacyGoogle(): void {
    void this.authService.loginWithGoogle();
  }

  retryGoogleScript(): void {
    this.loadError.set(false);
    void this.renderOfficialButton();
  }

  private async renderOfficialButton(): Promise<void> {
    const host = this.googleButton()?.nativeElement;
    if (!host) return;

    try {
      await this.authService.renderGoogleIdSignInButton(host);
      this.loadError.set(false);
    } catch {
      this.loadError.set(true);
    }
  }
}
