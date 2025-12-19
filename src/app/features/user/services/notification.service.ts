import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

/**
 * 通知服務
 * 負責呼叫 Google Apps Script Web App 發送各類通知
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly NOTIFICATION_URL = environment.googleSheets.notificationUrl;

  /**
   * 發送贊助會員申請通過通知
   * @param email 收件者 Email
   * @param userName 使用者名稱
   */
  async sendSponsorApprovalEmail(
    email: string,
    userName: string
  ): Promise<void> {
    // 如果沒有設定 GAS URL，跳過發送
    if (!this.NOTIFICATION_URL) {
      console.warn(
        'GAS Web App URL not configured, skipping email notification'
      );
      return;
    }

    try {
      const response = await fetch(this.NOTIFICATION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({
          action: 'sendApprovalEmail',
          email,
          userName,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('Sponsor approval email sent successfully');
    } catch (error) {
      console.error('Failed to send sponsor approval email:', error);
    }
  }
}
