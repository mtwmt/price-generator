/**
 * ServiceItemControl 使用 calculator 的同一份規則；此測試刻意不複製元件的
 * fallback 邏輯，避免空白數量被錯誤地默認為 1。
 */
import { calculateServiceItemAmount } from '../utils/calculator';

describe('服務項目金額規則', () => {
  it('免費項目與小數數量仍可計算', () => {
    expect(calculateServiceItemAmount({ price: 0, count: 1.5 })).toBe(0);
    expect(calculateServiceItemAmount({ price: 120.5, count: 2.5 })).toBe(301.25);
  });

  it.each([
    [{ price: null, count: 1 }],
    [{ price: -1, count: 1 }],
    [{ price: Infinity, count: 1 }],
    [{ price: 10, count: null }],
    [{ price: 10, count: '' }],
    [{ price: 10, count: 0 }],
    [{ price: 10, count: -1 }],
  ])('無效單價或數量不產生金額：%o', (input) => {
    expect(calculateServiceItemAmount(input)).toBeNull();
  });

  it('相乘溢位不產生可交付金額', () => {
    expect(
      calculateServiceItemAmount({ price: Number.MAX_SAFE_INTEGER, count: 2 })
    ).toBeNull();
  });
});
