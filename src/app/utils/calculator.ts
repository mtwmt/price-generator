/**
 * 折扣計算工具函數
 */

// Constants
const MIN_AMOUNT = 0;
const PERCENTAGE_DIVISOR = 100;
const SINGLE_DIGIT_THRESHOLD = 10;

export interface DiscountCalculationResult {
  /** 折扣金額 */
  discountAmount: number;
  /** 折扣後金額 */
  afterDiscount: number;
}

/**
 * 計算折扣
 * @param excludingTax 未稅金額（小計）
 * @param discountType 折扣類型：'amount' 固定金額 | 'percentage' 折數
 * @param discountValue 折扣值
 * @returns 折扣計算結果
 */
export function calculateDiscount(
  excludingTax: number,
  discountType: 'amount' | 'percentage',
  discountValue: number
): DiscountCalculationResult {
  const discountAmount = discountType === 'amount'
    ? calculateFixedDiscount(discountValue)
    : calculatePercentageDiscount(excludingTax, discountValue);

  const afterDiscount = ensureNonNegative(excludingTax - discountAmount);

  return { discountAmount, afterDiscount };
}

/**
 * 確保金額不為負數
 */
function ensureNonNegative(amount: number): number {
  return Math.max(MIN_AMOUNT, amount);
}

/**
 * 計算固定金額折扣
 */
function calculateFixedDiscount(discountValue: number): number {
  return discountValue;
}

/**
 * 計算折數折扣
 * 台灣習慣：8折 = 80折 = 付80%，95折 = 付95%
 */
function calculatePercentageDiscount(
  excludingTax: number,
  discountValue: number
): number {
  if (discountValue === MIN_AMOUNT) {
    return MIN_AMOUNT;
  }

  const actualDiscount = normalizeDiscountValue(discountValue);
  const discountRate = calculateDiscountRate(actualDiscount);

  return Math.ceil(excludingTax * discountRate);
}

/**
 * 計算折扣率（扣掉的百分比）
 * 例如：95折 → 扣5% → 0.05
 */
function calculateDiscountRate(actualDiscount: number): number {
  return (PERCENTAGE_DIVISOR - actualDiscount) / PERCENTAGE_DIVISOR;
}

/**
 * 標準化折扣值
 * 如果輸入 < 10，自動乘以10（8 → 80）
 */
function normalizeDiscountValue(value: number): number {
  const isSingleDigit = value < SINGLE_DIGIT_THRESHOLD;
  return isSingleDigit ? value * SINGLE_DIGIT_THRESHOLD : value;
}

/**
 * 計算稅額和總計
 * @param afterDiscount 折扣後金額
 * @param taxPercentage 稅率百分比
 * @returns 包含稅額和總計的結果
 */
export function calculateTaxAndTotal(
  afterDiscount: number,
  taxPercentage: number
): { tax: number; includingTax: number } {
  const tax = calculateTax(afterDiscount, taxPercentage);
  const includingTax = afterDiscount + tax;

  return { tax, includingTax };
}

/**
 * 計算稅額
 */
function calculateTax(amount: number, taxPercentage: number): number {
  return Math.ceil((taxPercentage / PERCENTAGE_DIVISOR) * amount);
}
