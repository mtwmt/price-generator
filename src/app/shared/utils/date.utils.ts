import { Timestamp } from 'firebase/firestore';

/**
 * 日期相關的通用工具函數
 */

/**
 * 將各種日期格式統一轉換為 Date 物件
 * @param date 支援 Timestamp、Date、ISO String
 */
export function autoToDate(
  date: Timestamp | Date | string | null | undefined
): Date | null {
  if (!date) return null;
  if (date instanceof Date) return date;
  if (typeof date === 'string') return new Date(date);
  // 處理 Firebase Timestamp (具備 toDate 方法)
  if (typeof (date as any).toDate === 'function') {
    return (date as any).toDate();
  }
  return new Date(date as any);
}

/**
 * 格式化日期為本地化字串
 * @param date 日期（支援 Timestamp、Date、ISO String 或 null）
 * @returns 格式化後的日期字串，若無日期則回傳 '-'
 */
export function formatDate(
  date: Timestamp | Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }
): string {
  const dateObj = autoToDate(date);
  if (!dateObj) return '-';
  return dateObj.toLocaleDateString('zh-TW', options);
}

/**
 * 格式化日期時間為本地化字串（含時間）
 * @param date 日期（支援 Timestamp、Date、ISO String 或 null）
 * @returns 格式化後的日期時間字串，格式：2024/12/19 14:30
 */
export function formatDateTime(
  date: Timestamp | Date | string | null | undefined
): string {
  const dateObj = autoToDate(date);
  if (!dateObj) return '-';

  return (
    dateObj.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }) +
    ' ' +
    dateObj.toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  );
}

/**
 * 計算兩個日期之間的天數差
 * @param targetDate 目標日期
 * @param fromDate 起始日期（預設為今天）
 * @returns 天數差（正數表示未來，負數表示過去），若無日期則回傳 null
 */
export function getDaysDiff(
  targetDate: Timestamp | Date | string | null | undefined,
  fromDate: Date = new Date()
): number | null {
  const dateObj = autoToDate(targetDate);
  if (!dateObj) return null;

  const diff = dateObj.getTime() - fromDate.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
