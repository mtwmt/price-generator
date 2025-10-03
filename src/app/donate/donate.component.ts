import { Component, inject } from '@angular/core';
import { AnalyticsService } from '../services/analytics';

@Component({
  selector: 'app-donate',
  imports: [],
  templateUrl: './donate.component.html',
})
export class DonateComponent {
  private analytics = inject(AnalyticsService);

  onDonateClick() {
    this.analytics.trackDonateClick();
  }
}
