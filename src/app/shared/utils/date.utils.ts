import { Timestamp } from 'firebase/firestore';

/**
 * 日期相關的通用工具函數
 * 支援 Unix Timestamp (number), Date, ISO String 與 Firebase Timestamp
 */

/**
 * 將各種日期格式統一轉換為 Date 物件
 * @param date 支援 number (Unix Timestamp ms), Timestamp, Date, ISO String
 */
export function autoToDate(
  date: number | Timestamp | Date | string | null | undefined
): Date | null {
  // 1. 基本空值檢查 (包含空字串)
  if (date === null || date === undefined || date === '') return null;

  let result: Date;

  // 2. 處理 Date 物件
  if (date instanceof Date) {
    result = date;
  }
  // 3. 處理數字 (假設為毫秒 Timestamp)
  else if (typeof date === 'number') {
    result = new Date(date);
  }
  // 4. 處理字串
  else if (typeof date === 'string') {
    // 檢查字串是否其實是純數字 (例如 "1738569600000")
    if (!isNaN(Number(date)) && date.trim() !== '') {
      result = new Date(Number(date));
    } else {
      result = new Date(date);
    }
  }
  // 5. 處理 Firebase Timestamp (具備 toDate 方法)
  else if (typeof (date as any).toDate === 'function') {
    result = (date as any).toDate();
  }
  // 6. 其他情況
  else {
    result = new Date(date as any);
  }

  // 最終檢查：確保日期有效 (isNaN(getTime) 為 true 表示 Invalid Date)
  if (isNaN(result.getTime())) {
    return null;
  }

  return result;
}

/**
 * 格式化日期為本地化字串
 * @param date 日期（支援 number, Timestamp, Date, ISO String 或 null）
 * @returns 格式化後的日期字串，若無日期則回傳 '-'
 */
export function formatDate(
  date: number | Timestamp | Date | string | null | undefined,
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
 * @param date 日期（支援 number, Timestamp, Date, ISO String 或 null）
 * @returns 格式化後的日期時間字串，格式：2024/12/19 14:30
 */
export function formatDateTime(
  date: number | Timestamp | Date | string | null | undefined
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
  targetDate: number | Timestamp | Date | string | null | undefined,
  fromDate: Date = new Date()
): number | null {
  const dateObj = autoToDate(targetDate);
  if (!dateObj) return null;

  const diff = dateObj.getTime() - fromDate.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
