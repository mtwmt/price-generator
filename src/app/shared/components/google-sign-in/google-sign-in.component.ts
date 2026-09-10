import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
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
  private static nextPickerId = 0;

  readonly legacyButtonClass = input('btn btn-primary');
  readonly legacyLabel = input('登入');
  readonly legacyLabelClass = input('');
  readonly dropdownAlign = input<'start' | 'end'>('end');
  readonly pickerId = `google-account-picker-${GoogleSignInComponent.nextPickerId++}`;
  readonly menuOpen = signal(false);
  readonly dropdownRoot = viewChild<ElementRef<HTMLDivElement>>('dropdownRoot');
  readonly loginTrigger = viewChild<ElementRef<HTMLButtonElement>>('loginTrigger');
  readonly googlePanel = viewChild<ElementRef<HTMLDivElement>>('googlePanel');
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

  /**
   * 新登入流程由原按鈕展開 Google 官方帳號選擇器；回退旗標關閉時才走舊 OAuth。
   */
  onLoginTrigger(): void {
    if (!this.idTokenLoginEnabled) {
      this.loginWithLegacyGoogle();
      return;
    }

    const willOpen = !this.menuOpen();
    this.menuOpen.set(willOpen);
    if (willOpen) {
      queueMicrotask(() => this.googlePanel()?.nativeElement.focus());
    }
  }

  closeLoginMenu(): void {
    this.menuOpen.set(false);
    this.loginTrigger()?.nativeElement.focus();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    const root = this.dropdownRoot()?.nativeElement;
    if (this.menuOpen() && target && root && !root.contains(target)) {
      this.menuOpen.set(false);
    }
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
