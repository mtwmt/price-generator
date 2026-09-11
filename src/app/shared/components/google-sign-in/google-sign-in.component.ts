import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { AuthService } from '@app/core/services/auth.service';

/** Google 登入入口（GIS popup 授權碼模式）。 */
@Component({
  selector: 'app-google-sign-in',
  standalone: true,
  templateUrl: './google-sign-in.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoogleSignInComponent {
  readonly legacyButtonClass = input('btn btn-primary');
  readonly legacyLabel = input('登入');
  readonly legacyLabelClass = input('');
  private readonly authService = inject(AuthService);

  onLoginTrigger(): void {
    void this.authService.loginWithGoogle();
  }
}
