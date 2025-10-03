import { Injectable } from '@angular/core';

declare global {
  interface Window {
    gtag?: (command: string, ...args: any[]) => void;
  }
}

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  // 追蹤自訂事件
  trackEvent(eventName: string, eventParams?: Record<string, any>) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, eventParams);
    }
  }

  // 報價單相關事件
  trackQuotationGenerated() {
    this.trackEvent('quotation_generated', {
      event_category: 'quotation',
      event_label: 'generate',
    });
  }

  trackQuotationPreviewed() {
    this.trackEvent('quotation_previewed', {
      event_category: 'quotation',
      event_label: 'preview',
    });
  }

  // 匯出相關事件
  trackExport(format: 'pdf' | 'image' | 'excel') {
    this.trackEvent('export', {
      event_category: 'export',
      event_label: format,
      export_format: format,
    });
  }

  // 歷史記錄相關事件
  trackHistoryLoaded(index: number) {
    this.trackEvent('history_loaded', {
      event_category: 'history',
      event_label: 'load',
      history_index: index,
    });
  }

  trackHistoryDeleted(index: number) {
    this.trackEvent('history_deleted', {
      event_category: 'history',
      event_label: 'delete',
      history_index: index,
    });
  }

  // Donate 相關事件
  trackDonateClick() {
    this.trackEvent('donate_click', {
      event_category: 'engagement',
      event_label: 'donate',
    });
  }

  // Tab 切換事件
  trackTabChange(tabName: string) {
    this.trackEvent('tab_change', {
      event_category: 'navigation',
      event_label: tabName,
    });
  }

  // 錯誤追蹤
  trackError(error: Error, context?: string) {
    this.trackEvent('error', {
      event_category: 'error',
      event_label: context || 'unknown',
      error_message: error.message,
      error_stack: error.stack?.substring(0, 150), // 限制長度
    });
  }
}
