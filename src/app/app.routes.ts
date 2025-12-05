import { Routes } from '@angular/router';
import { ChangelogComponent } from '@app/features/changelog/changelog.component';
import { MemberComponent } from '@app/features/user/member/member.component';
import { QuotationGeneratorComponent } from './features/quotation/quotation-generator/quotation-generator.component';

export const routes: Routes = [
  { path: '', component: QuotationGeneratorComponent },
  { path: 'changelog', component: ChangelogComponent },
  { path: 'member', component: MemberComponent },
];
