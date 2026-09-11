/** @jest-environment jsdom */
const mockDependencies = new Map<unknown, unknown>();

jest.mock('@angular/core', () => ({
  ChangeDetectionStrategy: { OnPush: 'OnPush' },
  Component: () => (target: unknown) => target,
  inject: (token: unknown) => mockDependencies.get(token),
  input: <T>(initial: T) => () => initial,
}));
jest.mock('@app/core/services/auth.service', () => ({
  AuthService: class AuthService {},
}), { virtual: true });

import { AuthService } from '@app/core/services/auth.service';
import { GoogleSignInComponent } from './google-sign-in.component';

describe('GoogleSignInComponent', () => {
  it('點擊既有樣式按鈕時呼叫授權碼登入', () => {
    const loginWithGoogle = jest.fn();
    mockDependencies.set(AuthService, { loginWithGoogle });
    const component = new GoogleSignInComponent();

    component.onLoginTrigger();

    expect(loginWithGoogle).toHaveBeenCalledTimes(1);
  });
});
