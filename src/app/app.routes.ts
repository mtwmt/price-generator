import { Routes } from '@angular/router';
import { authGuard } from '@app/core/guards/auth.guard';
import { adminGuard } from '@app/core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import(
        '@app/features/quotation/quotation-generator/quotation-generator.component'
      ).then((m) => m.QuotationGeneratorComponent),
  },
  {
    path: 'changelog',
    loadComponent: () =>
      import('@app/features/changelog/changelog.component').then(
        (m) => m.ChangelogComponent
      ),
  },
  {
    path: 'member',
    loadComponent: () =>
      import('@app/features/user/member/member.component').then(
        (m) => m.MemberComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    loadComponent: () =>
      import(
        '@app/features/user/member/admin-panel/admin-panel.component'
      ).then((m) => m.AdminPanelComponent),
    canActivate: [authGuard, adminGuard],
  },
  {
    path: 'privacy',
    loadComponent: () =>
      import('@app/features/privacy/privacy.component').then(
        (m) => m.PrivacyComponent
      ),
  },
  { path: '**', redirectTo: '' },
];
