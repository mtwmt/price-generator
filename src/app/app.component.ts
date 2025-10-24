import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PriceGeneratorComponent } from './price-generator/price-generator.component';
import { CommentsComponent } from './comments/comments.component';
import { DonateComponent } from './donate/donate.component';
import { ChangelogComponent } from './changelog/changelog';
import { AnalyticsService } from './services/analytics';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    PriceGeneratorComponent,
    CommentsComponent,
    DonateComponent,
    ChangelogComponent,
    LucideAngularModule,
  ],
  templateUrl: './app.component.html',
})
export class AppComponent {
  private analytics = inject(AnalyticsService);
  activeTab = signal<'quotation' | 'changelog'>('quotation');

  readonly currentYear = new Date().getFullYear();

  onTabChange(tab: 'quotation' | 'changelog') {
    this.activeTab.set(tab);
    this.analytics.trackTabChange(tab);
  }
}
