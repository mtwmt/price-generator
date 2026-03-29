import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  Renderer2,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X, BookOpen } from 'lucide-angular';
import { AnalyticsService } from '@app/core/services/analytics.service';

const DISMISSED_KEY = 'promo_bookshelf_dismissed';
const SCROLL_THRESHOLD = 300;
const SHOW_DELAY_MS = 500;

@Component({
  selector: 'app-promo-float',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './promo-float.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromoFloatComponent implements OnInit, OnDestroy {
  private analytics = inject(AnalyticsService);
  private renderer = inject(Renderer2);
  private scrollListener?: () => void;
  private tracked = false;

  readonly X = X;
  readonly BookOpen = BookOpen;

  readonly visible = signal(false);

  ngOnInit(): void {
    if (this.isDismissed()) return;

    this.scrollListener = this.renderer.listen('window', 'scroll', () => {
      if (window.scrollY > SCROLL_THRESHOLD && !this.visible()) {
        setTimeout(() => {
          this.visible.set(true);
          this.trackView();
        }, SHOW_DELAY_MS);
        // 觸發後移除監聽
        this.scrollListener?.();
        this.scrollListener = undefined;
      }
    });
  }

  ngOnDestroy(): void {
    this.scrollListener?.();
  }

  onClickPromo(): void {
    this.analytics.trackEvent('promo_click', {
      event_category: 'promo',
      event_label: 'bookshelf_diary',
    });
  }

  onDismiss(): void {
    this.visible.set(false);
    sessionStorage.setItem(DISMISSED_KEY, 'true');
    this.analytics.trackEvent('promo_dismiss', {
      event_category: 'promo',
      event_label: 'bookshelf_diary',
    });
  }

  private isDismissed(): boolean {
    return sessionStorage.getItem(DISMISSED_KEY) === 'true';
  }

  private trackView(): void {
    if (this.tracked) return;
    this.tracked = true;
    this.analytics.trackEvent('promo_view', {
      event_category: 'promo',
      event_label: 'bookshelf_diary',
    });
  }
}
