import { ApplicationConfig, ErrorHandler, Injectable, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { AnalyticsService } from './services/analytics';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private analytics = inject(AnalyticsService);

  handleError(error: Error): void {
    console.error('Global error:', error);
    this.analytics.trackError(error, 'global');
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};
