import { Timestamp } from 'firebase/firestore';

/**
 * 日期相關的通用工具函數
 */

/**
 * 格式化日期為本地化字串
 * @param date 日期（支援 Timestamp、Date 或 null）
 * @param options 格式化選項
 * @returns 格式化後的日期字串，若無日期則回傳 '-'
 */
export function formatDate(
  date: Timestamp | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }
): string {
  if (!date) return '-';
  const dateObj = date instanceof Date ? date : date.toDate();
  return dateObj.toLocaleDateString('zh-TW', options);
}

/**
 * 格式化日期為長格式（包含月份名稱）
 * @param date 日期（支援 Timestamp、Date 或 null）
 * @returns 格式化後的日期字串
 */
export function formatDateLong(
  date: Timestamp | Date | null | undefined
): string {
  return formatDate(date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * 計算兩個日期之間的天數差
 * @param targetDate 目標日期
 * @param fromDate 起始日期（預設為今天）
 * @returns 天數差（正數表示未來，負數表示過去），若無日期則回傳 null
 */
export function getDaysDiff(
  targetDate: Timestamp | Date | null | undefined,
  fromDate: Date = new Date()
): number | null {
  if (!targetDate) return null;
  const dateObj =
    targetDate instanceof Date ? targetDate : targetDate.toDate();
  const diff = dateObj.getTime() - fromDate.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
